import ipaddress
import multiprocessing as mp
import time
import unittest
from datetime import timedelta
from unittest.mock import patch

from antiabuse.firehol import Firehol, _parse_blocklist

# ---------------------------------------------------------------------------
# Fixture data & helpers
# ---------------------------------------------------------------------------

_SAMPLE_NETSET = """
# Example FireHOL netset
1.2.3.0/24
4.4.4.4
2001:db8::/32
bad_line_should_be_ignored
"""

def _fake_download(_self, _name: str) -> str:
    """Stub that replaces Firehol._download_or_load — never hits disk/network."""
    return _SAMPLE_NETSET


class PatchedFireholMixin(unittest.TestCase):
    """
    Patches Firehol._download_or_load for the whole lifetime of the test-case,
    so both the main process *and* the worker inherit the stub.
    """

    def setUp(self) -> None:  # noqa: D401
        super().setUp()
        self._patcher = patch.object(Firehol, "_download_or_load", _fake_download)
        self._patcher.start()

    # ------------------------------------------------------------------- #
    # Helper that returns a *fully-initialised* Firehol instance.         #
    # It starts the worker process, waits for the first refresh and       #
    # keeps a handle so we can terminate the child in tearDown.           #
    # ------------------------------------------------------------------- #
    _spawned: list[Firehol] = []      # keep references so they survive GC

    def _make_loaded_firehol(self, name: str = "dummy") -> Firehol:
        fh = Firehol(
            [name],
            update_interval=timedelta(hours=1),   # long enough to avoid re-fetch
            start_updater=True,
        )
        ok = fh.wait_until_loaded(timeout=5.0)    # jitter ≤ 1 s, so 5 s is ample
        if not ok:
            self.fail("Firehol worker did not deliver data within 5 s")

        self._spawned.append(fh)
        return fh

    def tearDown(self) -> None:  # noqa: D401
        # Stop all worker processes we started in this test-case
        for fh in getattr(self, "_spawned", []):
            if fh._proc and fh._proc.is_alive():
                fh._proc.terminate()
                fh._proc.join(timeout=1)
        super().tearDown()


# ---------------------------------------------------------------------------
# Actual tests
# ---------------------------------------------------------------------------

class ParseBlocklistTests(unittest.TestCase):
    def test_split_v4_and_v6(self):
        v4, v6 = _parse_blocklist(_SAMPLE_NETSET)

        self.assertIn(ipaddress.ip_network("1.2.3.0/24"), v4)
        self.assertIn(ipaddress.ip_network("4.4.4.4/32"), v4)   # single IP ⇒ /32
        self.assertIn(ipaddress.ip_network("2001:db8::/32"), v6)

        # Comments, blanks and junk lines ignored
        self.assertEqual((len(v4), len(v6)), (2, 1))


class LookupTests(PatchedFireholMixin, unittest.TestCase):
    def test_ipv4_hits_and_misses(self):
        fh = self._make_loaded_firehol("dummy")

        self.assertEqual(sorted(fh.matches("1.2.3.4")), ["dummy"])  # in /24
        self.assertEqual(sorted(fh.matches("4.4.4.4")), ["dummy"])  # exact IP
        self.assertEqual(fh.matches("5.5.5.5"), [])                 # absent

    def test_ipv6_hits_and_misses(self):
        fh = self._make_loaded_firehol("v6only")

        self.assertEqual(sorted(fh.matches("2001:db8::1")), ["v6only"])
        self.assertEqual(fh.matches("2001:dead::1"), [])            # outside /32


class ConstructorGuardTests(unittest.TestCase):
    def test_empty_list_names(self):
        with self.assertRaises(ValueError):
            Firehol([])
