"""
Simple FireHOL block list checker with a refresh system that uses inter‑process
locking and a jittered schedule.

This module provides :class:`Firehol`, a helper for testing whether an
IP address appears in one or more FireHOL block lists.  It keeps the block
lists cached on disk **and** in memory, refreshing them on a background thread
at a configurable interval.

Key design points
-----------------
* **Lean dependency footprint** – only the Python standard library is used.
* **Mypy‑friendly** – every public symbol is fully typed.
* **Fail‑fast style** – early ``return``/``continue`` statements keep nesting
  shallow and the control flow obvious.
* **Co‑operative multi‑process behaviour** – a POSIX file lock ensures only one
  process fetches a list, while others reuse the cached copy.
* **Jittered scheduling** – each process skews its timer to avoid the
  "thundering herd" effect.

Example
-------
>>> checker = Firehol(["firehol_level1.ipset", "firehol_level2.netset"])
>>> checker.matches("1.2.3.4")
['firehol_level1']
"""

import contextlib
import fcntl
import ipaddress
import os
import random
import threading
import time
from datetime import timedelta
from pathlib import Path
from typing import Dict, Iterable, List, Tuple, Union
from urllib.request import urlopen
import traceback

ListName = str
IPAddress = Union[str, ipaddress.IPv4Address, ipaddress.IPv6Address]
IPvXNetwork = Union[ipaddress.IPv4Network, ipaddress.IPv6Network]
IPvXAddress = Union[ipaddress.IPv4Address, ipaddress.IPv6Address]

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
) -> Tuple[List[ipaddress.IPv4Network], List[ipaddress.IPv6Network]]:
    """Convert raw *netset* text to IPv4 and IPv6 network lists."""
    v4: List[ipaddress.IPv4Network] = []
    v6: List[ipaddress.IPv6Network] = []

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


# ---------------------------------------------------------------------------
# Cross‑process file‑locking (POSIX‑only)
# ---------------------------------------------------------------------------


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
    def search(self, addr: IPvXAddress) -> List[ListName]:
        node, result = self.root, set()
        for bit in range(addr.max_prefixlen):
            if node.lists:
                result.update(node.lists)       # prefixes we’ve passed match
            b = (int(addr) >> (addr.max_prefixlen - 1 - bit)) & 1
            node = node.child[b]
            if node is None:                    # no more prefixes on this path
                break
        if node and node.lists:                 # exact-length prefix
            result.update(node.lists)
        return list(result)


# ---------------------------------------------------------------------------
# Main library class
# ---------------------------------------------------------------------------


class Firehol:
    """Check IP addresses against selected FireHOL block lists.

    Parameters
    ----------
    lists
        The short *netset* names, e.g. ``"firehol_level1"``.  See the full list
        at <https://github.com/firehol/blocklist-ipsets>.
    update_interval
        How often to fetch fresh lists.  Defaults to every 1 hour.
    start_updater
        Whether to start the background refresh thread automatically.
    """

    _lock: threading.RLock  # protects _data
    _data: Dict[  # mapping name → (v4-nets, v6-nets)
        ListName, Tuple[List[ipaddress.IPv4Network], List[ipaddress.IPv6Network]]
    ]

    def __init__(
        self,
        lists: Iterable[ListName],
        *,
        update_interval: timedelta | None = None,
        start_updater: bool = True,
    ) -> None:
        self.lists: List[ListName] = list(lists)
        if not self.lists:
            raise ValueError("At least one FireHOL list must be supplied.")

        self.update_interval = update_interval or timedelta(hours=1)
        if self.update_interval.total_seconds() <= 0:
            raise ValueError("update_interval must be positive.")

        # Each process gets a tiny random skew so that if `Firehol` is running
        # in another process, they don't attempt to download the definitions at
        # the same time
        self._jitter = random.uniform(0.0, 1.0)

        self._lock = threading.RLock()
        self._data = {}
        self._v4_trie = _Trie()
        self._v6_trie = _Trie()
        self._ready = threading.Event()

        # Kick off the daemon refresh thread, if desired
        if start_updater:
            self._thread = threading.Thread(
                target=self._run_updater,
                daemon=True
            )
            self._thread.start()

    # ---------------------------------------------------------------------
    # Public API
    # ---------------------------------------------------------------------

    def matches(self, ip: IPAddress) -> list[ListName]:
        if not self._ready.is_set():
            print(f"Warning: FireHOL block lists not yet loaded while checking {ip}")

        addr = ipaddress.ip_address(ip)
        trie = self._v4_trie if addr.version == 4 else self._v6_trie
        return trie.search(addr)

    def wait_until_loaded(self, timeout: float | None = None) -> bool:
        """Block until the first successful refresh finishes.

        Parameters
        ----------
        timeout
            Maximum seconds to wait. ``None`` waits forever.

        Returns
        -------
        bool
            ``True`` if the data became available, ``False`` on timeout.
        """
        return self._ready.wait(timeout)

    # ---------------------------------------------------------------------
    # Internal helpers
    # ---------------------------------------------------------------------

    def _run_updater(self) -> None:
        """Background loop that refreshes the block lists."""
        while True:
            time.sleep(self._jitter)
            try:
                self._update_once()
            except:
                print(traceback.format_exc())
            time.sleep(self.update_interval.total_seconds())

    def _update_once(self) -> None:
        """Fetch every configured list (network + cache) once."""
        fresh_data: Dict[
            ListName,
            Tuple[List[ipaddress.IPv4Network],
                  List[ipaddress.IPv6Network]]
        ] = {}

        for name in self.lists:
            try:
                raw = self._download_or_load(name)
            except Exception as exc:
                raise RuntimeError(f"Failed to obtain FireHOL list '{name}': {exc}") from exc

            v4, v6 = _parse_blocklist(raw)
            if not v4 and not v6:
                raise ValueError(f"FireHOL list '{name}' appears to be empty.")

            fresh_data[name] = (v4, v6)

        v4_trie, v6_trie = _Trie(), _Trie()
        for name, (v4, v6) in fresh_data.items():
            for v4net in v4:
                v4_trie.insert(v4net, name)
            for v6net in v6:
                v6_trie.insert(v6net, name)

        # Atomically replace the in‑memory data.
        with self._lock:
            self._data = fresh_data
            self._v4_trie = v4_trie
            self._v6_trie = v6_trie

        self._ready.set()

    def _download_or_load(self, name: ListName) -> str:
        """Return the raw list text (downloaded or cached), protected by a lock."""
        path = cache_dir / f"{name}"
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


firehol = Firehol(
    lists=[
        "firehol_anonymous.netset",
        "firehol_abusers_1d.netset",
    ]
)
