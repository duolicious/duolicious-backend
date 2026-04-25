"""
FireHOL block-list helper that refreshes in a *separate process*
instead of a background thread. This is required to avoid Python's GIL freezing
the app whenever the definitions are updated. Actually, pauses can still happen
during this implementation's RPC calls. But at least with a
multiprocessing-based implementation, we can set a timeout for those pauses, and
have them only occur for only some HTTP endpoints. With the threading-based
alternative, *all* HTTP endpoints freeze while the definitions update.

Prefix lookups are backed by `pytricia`, a C-implemented Patricia trie. Each
prefix in the trie maps to a `frozenset` of FireHOL list names that contain it,
and `matches()` walks the parent chain so that *every* covering prefix
contributes its list names (not just the longest match).
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
from urllib.request import Request, urlopen
import threading

import pytricia

# ---------------------------------------------------------------------------
# Type aliases
# ---------------------------------------------------------------------------

ListName = str
IPAddress = Union[str, ipaddress.IPv4Address, ipaddress.IPv6Address]
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


def _parse_blocklist(text: str) -> Tuple[list[str], list[str]]:
    """Convert raw *netset* text to IPv4 and IPv6 prefix-string lists."""
    v4: list[str] = []
    v6: list[str] = []

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
            v4.append(net.with_prefixlen)
        elif isinstance(net, ipaddress.IPv6Network):
            v6.append(net.with_prefixlen)

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
# Patricia-trie wrapper around `pytricia`
# --------------------------------------------------------------------------

class _PrefixTrie:
    """Thin wrapper that maps IP prefixes -> {list_name, ...}.

    pytricia stores at most one value per prefix, so when several FireHOL lists
    contain the same prefix we stash the union in a `frozenset`. `search()`
    walks the longest-match parent chain so every covering prefix contributes
    its list names (matching the previous radix-trie behaviour).
    """

    def __init__(self, max_prefixlen: int) -> None:
        self._pyt = pytricia.PyTricia(max_prefixlen)

    def insert(self, prefix: str, list_name: ListName) -> None:
        existing = self._pyt.get(prefix)
        if existing is None:
            self._pyt[prefix] = frozenset((list_name,))
        elif list_name not in existing:
            self._pyt[prefix] = existing | {list_name}

    def search(self, addr: IPvXAddress) -> list[ListName]:
        addr_str = str(addr)
        try:
            key = self._pyt.get_key(addr_str)
        except (KeyError, ValueError):
            return []
        if key is None:
            return []

        found: set[ListName] = set()
        while key is not None:
            value = self._pyt.get(key)
            if value:
                found.update(value)
            key = self._pyt.parent(key)
        return list(found)


# ---------------------------------------------------------------------------
# Worker-side helpers (download / parse / build tries)
# ---------------------------------------------------------------------------

def _download_or_load(name: ListName, update_interval: timedelta) -> str:
    """Return the raw list text (downloaded or cached), protected by a lock."""
    path = cache_dir / name
    lock_path = cache_dir / f"{name}.lock"

    with _exclusive_lock(lock_path):
        # Cache fast‑path
        if path.exists():
            age = time.time() - path.stat().st_mtime
            if age < update_interval.total_seconds():
                print(f'Loading from disk {path}')
                return path.read_text(encoding="utf-8", errors="ignore")

        # Cache miss or stale – download
        url = _blocklist_url(name)
        print(f'Downloading {url}')
        request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urlopen(request, timeout=30) as resp:
            raw_bytes = resp.read()
        print(f'Finished downloading {url}')
        text = raw_bytes.decode("utf-8", errors="ignore")

        # Atomic write: write to tmp → replace
        tmp = path.with_suffix(".tmp")
        tmp.write_text(text, encoding="utf-8")
        os.replace(tmp, path)  # atomic on POSIX

        return text


def _collect_all(
    lists: Iterable[ListName],
    update_interval: timedelta,
) -> Dict[ListName, Tuple[list[str], list[str]]]:
    """Download / load every configured list, return dict(name → prefixes)."""
    fresh: Dict[ListName, Tuple[list[str], list[str]]] = {}

    for name in lists:
        raw = _download_or_load(name, update_interval)
        v4, v6 = _parse_blocklist(raw)
        if not v4 and not v6:
            raise ValueError(f"FireHOL list '{name}' appears to be empty.")
        fresh[name] = (v4, v6)

    return fresh


def _build_tries(
    data: Dict[ListName, Tuple[list[str], list[str]]],
) -> tuple[_PrefixTrie, _PrefixTrie]:
    v4_trie = _PrefixTrie(32)
    v6_trie = _PrefixTrie(128)
    for name, (v4, v6) in data.items():
        for prefix in v4:
            v4_trie.insert(prefix, name)
        for prefix in v6:
            v6_trie.insert(prefix, name)
    return v4_trie, v6_trie


# ---------------------------------------------------------------------------
# Worker process
# ---------------------------------------------------------------------------

def _worker_main(conn: mp.connection.Connection,
                 lists: list[ListName],
                 update_interval: timedelta) -> None:
    """Run in a dedicated process: refresh lists & answer match queries."""
    jitter = random.uniform(0.0, 10.0)
    next_refresh = 0.0
    tries: tuple[_PrefixTrie, _PrefixTrie] | None = None
    refreshing = False # at most one refresh at a time

    def _async_refresh():
        nonlocal tries, refreshing, next_refresh

        print(f'Waiting for {jitter} seconds before collecting FireHOL list(s)')
        time.sleep(jitter)

        try:
            data = _collect_all(lists, update_interval)
            tries = _build_tries(data)
            next_refresh = time.time() + update_interval.total_seconds()
        finally:
            refreshing = False  # allow future refreshes

    while True:
        now = time.time()

        # ------------------------------------------------------------------
        # Kick off a background refresh if it's time and none is running
        # ------------------------------------------------------------------
        if not refreshing and now >= next_refresh:
            refreshing = True
            threading.Thread(target=_async_refresh, daemon=True).start()

        # ------------------------------------------------------------------
        # Check for incoming commands
        # ------------------------------------------------------------------
        if not conn.poll(0.1):                          # 100 ms tick
            continue

        try:
            cmd, payload = conn.recv()
        except EOFError:                                # parent is gone
            break

        # ------------------- command handlers -----------------------------
        if cmd == "query":
            if not tries:
                conn.send(None)                         # not yet loaded
                continue
            addr = ipaddress.ip_address(payload)
            v4_trie, v6_trie = tries
            trie = v4_trie if addr.version == 4 else v6_trie
            conn.send(trie.search(addr))
        elif cmd == "ready":
            conn.send(tries is not None)
        elif cmd == "shutdown":
            break

    conn.close()


# ---------------------------------------------------------------------------
# Main façade class (lives inside the web worker)
# ---------------------------------------------------------------------------

class Firehol:
    """Check IP addresses against selected FireHOL block lists."""

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

        self._conn_lock = threading.Lock()

        self._parent_conn = None
        self._proc = None

        if start_updater:
            self._parent_conn, child_conn = mp.Pipe(duplex=True)
            self._proc = mp.Process(
                target=_worker_main,
                args=(child_conn, self.lists, self.update_interval),
                daemon=True,
            )
            self._proc.start()

    # ---------------------------------------------------------------------
    # Internal RPC helper
    #
    # On my development machine, the RPC typically completes in 0.0003 once
    # the definitions are loaded. So a timeout of 0.005 (which is more than
    # 20 x 0.0003) seems generous. For comparison, running `SELECT 1` on
    # the DB takes about 0.6 ms = 0.0006 seconds.
    # ---------------------------------------------------------------------
    def _rpc(self, cmd, payload, *, timeout: float = 0.005):
        if not self._parent_conn:
            print(f"Warning: No FireHOL RPC connection. ({cmd}, {payload})")
            return None

        with self._conn_lock:
            # Drain stale data first
            while self._parent_conn.poll():
                self._parent_conn.recv()

            self._parent_conn.send((cmd, payload))

            if self._parent_conn.poll(timeout):    # nothing yet → give up
                return self._parent_conn.recv()
            else:
                print(
                    f"Warning: Timed out while waiting for FireHOL "
                    f"response ({cmd}, {payload})"
                )
                return None

    # ---------------------------------------------------------------------
    # Public API
    # ---------------------------------------------------------------------
    def matches(self, ip: IPAddress) -> list[ListName]:
        """Return the FireHOL lists the address belongs to (or [])."""
        response = self._rpc(cmd="query", payload=str(ip))

        if response is None or response is False:
            return []

        return response

    def wait_until_loaded(self, timeout: float | None = None) -> bool:
        """Block until the first refresh finishes (same semantics)."""
        start = time.time()
        while True:
            if self._rpc("ready", None):
                return True
            if timeout is not None and (time.time() - start) >= timeout:
                return False
            time.sleep(0.05)

    # ------------------------------------------------------------------
    # Graceful shutdown helpers
    # ------------------------------------------------------------------

    def close(self, *, timeout: float = 1.0) -> None:
        """Tell the worker to exit, then join it (idempotent)."""
        if self._proc is None:           # nothing to do / already closed
            return
        if self._parent_conn is None:
            return

        try:
            with self._conn_lock:
                try:
                    self._parent_conn.send(("shutdown", None))
                except (BrokenPipeError, OSError):
                    pass  # parent/child already dead

            self._parent_conn.close()

            self._proc.join(timeout)
            if self._proc.is_alive():     # still hanging around → stick
                self._proc.terminate()
                self._proc.join(0.1)
        finally:
            self._proc = None
            self._parent_conn = None

    # GC fallback – best-effort only!
    def __del__(self):
        try:
            self.close()
        except:
            print(traceback.format_exc())


# ---------------------------------------------------------------------------
# Convenience singleton
# ---------------------------------------------------------------------------

firehol = Firehol(
    lists=[
        "firehol_abusers_30d.netset",
        "firehol_anonymous.netset",
        "stopforumspam_365d.ipset",
    ]
)
