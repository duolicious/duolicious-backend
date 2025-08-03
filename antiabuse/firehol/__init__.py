"""
FireHOL block-list helper that refreshes in a *separate process*
instead of a background thread.

Public API, caching behaviour and call semantics are unchanged.
"""

import contextlib
import fcntl
import ipaddress
import multiprocessing as mp
import multiprocessing.connection
import os
import random
import time
import traceback
from datetime import timedelta
from pathlib import Path
from typing import Dict, Iterable, Tuple, Union
from urllib.request import urlopen
import threading

# ---------------------------------------------------------------------------
# Type aliases
# ---------------------------------------------------------------------------

ListName = str
IPAddress = Union[str, ipaddress.IPv4Address, ipaddress.IPv6Address]
IPvXNetwork = Union[ipaddress.IPv4Network, ipaddress.IPv6Network]
IPvXAddress = Union[ipaddress.IPv4Address, ipaddress.IPv6Address]

# ---------------------------------------------------------------------------
# Cache directory (shared by all processes)
# ---------------------------------------------------------------------------

cache_dir = Path("/tmp/duolicious-firehol")
cache_dir.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------


def _blocklist_url(name: ListName) -> str:
    """Return the URL for a FireHOL list."""
    return f"https://iplists.firehol.org/files/{name}"


def _parse_blocklist(
    text: str,
) -> Tuple[list[ipaddress.IPv4Network], list[ipaddress.IPv6Network]]:
    """Convert raw *netset* text to IPv4 and IPv6 network lists."""
    v4: list[ipaddress.IPv4Network] = []
    v6: list[ipaddress.IPv6Network] = []

    for line in text.splitlines():
        # Skip comments / blank lines quickly
        if not line or line.startswith("#"):
            continue

        try:
            net = ipaddress.ip_network(line, strict=False)
        except ValueError:
            # Silently ignore malformed lines – FireHOL occasionally contains
            # quirks that are not critical for look‑ups.
            continue

        if isinstance(net, ipaddress.IPv4Network):
            v4.append(net)
        elif isinstance(net, ipaddress.IPv6Network):
            v6.append(net)

    return v4, v6


@contextlib.contextmanager
def _exclusive_lock(path: Path):
    """Context manager that takes an exclusive flock until exit."""
    fh = open(path, "a+b")
    try:
        fcntl.flock(fh, fcntl.LOCK_EX)
        yield
    finally:
        fcntl.flock(fh, fcntl.LOCK_UN)
        fh.close()


# --------------------------------------------------------------------------
# Tiny radix-trie for IPv4/IPv6 prefixes
# --------------------------------------------------------------------------

class _TrieNode:
    __slots__ = ("child", "lists")

    def __init__(self) -> None:
        self.child: list[_TrieNode | None] = [None, None]  # bit 0 / bit 1
        self.lists: set[ListName] = set()


class _Trie:
    def __init__(self):
        self.root = _TrieNode()

    # insert a network and remember which list it came from
    def insert(self, net: IPvXNetwork, list_name: ListName) -> None:
        node = self.root
        for bit in range(net.prefixlen):
            b = (int(net.network_address) >> (net.max_prefixlen - 1 - bit)) & 1
            if node.child[b] is None:
                node.child[b] = _TrieNode()
            node = node.child[b]
        node.lists.add(list_name)

    # walk the bits of an address, collecting all matching lists
    def search(self, addr: IPvXAddress) -> list[ListName]:
        node, found = self.root, set()
        for bit in range(addr.max_prefixlen):
            if node.lists:
                found.update(node.lists)
            b = (int(addr) >> (addr.max_prefixlen - 1 - bit)) & 1
            node = node.child[b]
            if node is None:
                break
        if node and node.lists:
            found.update(node.lists)
        return list(found)


# ---------------------------------------------------------------------------
# Main class
# ---------------------------------------------------------------------------


class Firehol:
    """Check IP addresses against selected FireHOL block lists.

    Parameters
    ----------
    lists
        The short *netset* names, e.g. ``"firehol_level1"``.  See the full list
        at <https://github.com/firehol/blocklist-ipsets>.
    update_interval
        How often to fetch fresh lists.
    start_updater
        Whether to start the background refresh thread automatically.
    """

    _lock: threading.RLock                                    # protects _data
    _data: Dict[ListName, Tuple[list[ipaddress.IPv4Network],  # name → nets
                                list[ipaddress.IPv6Network]]]

    # ---------------------------------------------------------------------

    def __init__(
        self,
        lists: Iterable[ListName],
        *,
        update_interval: timedelta | None = None,
        start_updater: bool = True,
    ) -> None:
        self.lists: list[ListName] = list(lists)
        if not self.lists:
            raise ValueError("At least one FireHOL list must be supplied.")

        self.update_interval = update_interval or timedelta(hours=4)
        if self.update_interval.total_seconds() <= 0:
            raise ValueError("update_interval must be positive.")

        self._jitter = random.uniform(0.0, 10.0)
        self._lock = threading.RLock()
        self._data = {}
        self._v4_trie = _Trie()
        self._v6_trie = _Trie()
        self._ready = threading.Event()

        # -----------------------------------------------------------------
        # Background process that fetches the lists and pushes them back through
        # a one-way pipe.
        # -----------------------------------------------------------------
        self._parent_conn = None
        self._proc = None

        if start_updater:
            parent_conn, child_conn = mp.Pipe(duplex=False)
            self._parent_conn = parent_conn
            self._proc = mp.Process(
                target=self._updater_process,
                args=(child_conn,),
                daemon=True,
            )
            self._proc.start()

            self._start_apply_thread()

    # ---------------------------------------------------------------------
    # Public API
    # ---------------------------------------------------------------------

    def matches(self, ip: IPAddress) -> list[ListName]:
        if not self._ready.is_set():
            print(f"Warning: FireHOL block lists not yet loaded while checking {ip}")
            return []

        addr = ipaddress.ip_address(ip)
        trie = self._v4_trie if addr.version == 4 else self._v6_trie
        return trie.search(addr)

    def wait_until_loaded(self, timeout: float | None = None) -> bool:
        """Block until the first refresh finishes."""
        return self._ready.wait(timeout)

    # ---------------------------------------------------------------------
    # Worker process logic
    # ---------------------------------------------------------------------

    def _updater_process(self, conn: mp.connection.Connection) -> None:
        """Process entry-point: repeatedly fetch & push fresh data."""
        # NB: we’re in a forked/child copy of `self` here.
        while True:
            time.sleep(self._jitter)
            try:
                fresh_data = self._collect_data_once()
                conn.send(fresh_data)                     # one-way push
            except Exception:
                print("[Firehol worker]\n" + traceback.format_exc())
            time.sleep(self.update_interval.total_seconds())

    def _collect_data_once(self) -> Dict[ListName, Tuple[
            list[ipaddress.IPv4Network], list[ipaddress.IPv6Network]
            ]]:
        """Download / load every configured list, return dict(name → nets)."""
        fresh_data: Dict[ListName, Tuple[
            list[ipaddress.IPv4Network], list[ipaddress.IPv6Network]
        ]] = {}

        for name in self.lists:
            print(f'Downloading or loading {name}')
            raw = self._download_or_load(name)
            print(f'Finished downloading or loading {name}')
            print(f'Parsing {name}')
            v4, v6 = _parse_blocklist(raw)
            print(f'Finished parsing {name}')
            if not v4 and not v6:
                raise ValueError(f"FireHOL list '{name}' appears to be empty.")
            fresh_data[name] = (v4, v6)

        return fresh_data

    def _download_or_load(self, name: ListName) -> str:
        """Return the raw list text (downloaded or cached), protected by a lock."""
        path = cache_dir / name
        lock_path = cache_dir / f"{name}.lock"

        with _exclusive_lock(lock_path):
            # Cache fast‑path
            if path.exists():
                age = time.time() - path.stat().st_mtime
                if age < self.update_interval.total_seconds():
                    print(f'Loading from disk {path}')
                    return path.read_text(encoding="utf-8", errors="ignore")

            # Cache miss or stale – download
            url = _blocklist_url(name)
            print(f'Downloading {url}')
            with urlopen(url, timeout=30) as resp:
                raw_bytes = resp.read()
            print(f'Finished downloading {url}')
            text = raw_bytes.decode("utf-8", errors="ignore")

            # Atomic write: write to tmp → replace
            tmp = path.with_suffix(".tmp")
            tmp.write_text(text, encoding="utf-8")
            os.replace(tmp, path)  # atomic on POSIX

            return text

    # ---------------------------------------------------------------------
    # Thread to apply updates
    # ---------------------------------------------------------------------
    def _build_tries(
        self,
        data: Dict[ListName, Tuple[list[ipaddress.IPv4Network],
                                   list[ipaddress.IPv6Network]]]
    ) -> tuple[_Trie, _Trie]:
        v4_trie, v6_trie = _Trie(), _Trie()

        for name, (v4_nets, v6_nets) in data.items():
            for v4net in v4_nets:
                v4_trie.insert(v4net, name)
            for v6net in v6_nets:
                v6_trie.insert(v6net, name)

        return v4_trie, v6_trie

    def _start_apply_thread(self):
        t = threading.Thread(target=self._apply_updates_loop,
                             daemon=True)
        t.start()

    def _apply_updates_loop(self):
        while True:
            latest = self._parent_conn.recv()
            v4_trie, v6_trie = self._build_tries(latest)
            with self._lock:
                self._data = latest
                self._v4_trie = v4_trie
                self._v6_trie = v6_trie
            self._ready.set()


firehol = Firehol(
    lists=[
        "firehol_anonymous.netset",
        "firehol_abusers_1d.netset",
    ]
)
