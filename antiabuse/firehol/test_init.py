"""
Tests for antiabuse.firehol – updated for the 2025 refactor that moved all
download / cache helpers out of the Firehol class and into module-level
functions.
"""

import ipaddress
import multiprocessing as mp
import random
import time
import unittest
from datetime import timedelta
from typing import Iterable, Tuple
from unittest.mock import patch

from antiabuse.firehol import (
    Firehol,
    _parse_blocklist,
    _Trie,
    IPvXNetwork,
)

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

def _fake_download(name: str, _update_interval: timedelta) -> str:   # NEW SIG
    """Stub that replaces antiabuse.firehol._download_or_load – never hits disk."""
    return _SAMPLE_NETSET


def _sample_addresses(net: IPvXNetwork) -> Iterable[ipaddress._BaseAddress]:
    yield net.network_address
    yield net.broadcast_address
    if net.num_addresses > 2:  # midpoint
        yield net[net.num_addresses // 2]


def _address_outside(net: IPvXNetwork) -> ipaddress._BaseAddress:
    if isinstance(net, ipaddress.IPv4Network):
        return ipaddress.IPv4Address(int(net.network_address) ^ (1 << 31))
    return ipaddress.IPv6Address(int(net.network_address) ^ (1 << 127))


# ---------------------------------------------------------------------------
# Mix-in that patches the *module-level* helper, not the class method anymore
# ---------------------------------------------------------------------------

class PatchedFireholMixin(unittest.TestCase):
    def setUp(self) -> None:
        super().setUp()
        self._patcher = patch("antiabuse.firehol._download_or_load", _fake_download)
        self._patcher.start()

    _spawned: list[Firehol] = []

    def _make_loaded_firehol(self, name: str = "dummy") -> Firehol:
        fh = Firehol(
            [name],
            update_interval=timedelta(hours=1),
            start_updater=True,
        )
        ok = fh.wait_until_loaded(timeout=11.0)
        if not ok:
            self.fail("Firehol worker did not deliver data within 11 s")
        self._spawned.append(fh)
        return fh

    def tearDown(self) -> None:
        for fh in getattr(self, "_spawned", []):
            if fh._proc and fh._proc.is_alive():
                fh._proc.terminate()
                fh._proc.join(timeout=1)
        self._patcher.stop()
        super().tearDown()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class ParseBlocklistTests(unittest.TestCase):
    def test_split_v4_and_v6(self):
        v4, v6 = _parse_blocklist(_SAMPLE_NETSET)
        self.assertIn(ipaddress.ip_network("1.2.3.0/24"), v4)
        self.assertIn(ipaddress.ip_network("4.4.4.4/32"), v4)
        self.assertIn(ipaddress.ip_network("2001:db8::/32"), v6)
        self.assertEqual((len(v4), len(v6)), (2, 1))


class LookupTests(PatchedFireholMixin, unittest.TestCase):
    def test_ipv4_hits_and_misses(self):
        fh = self._make_loaded_firehol("dummy")
        self.assertEqual(sorted(fh.matches("1.2.3.4")), ["dummy"])
        self.assertEqual(sorted(fh.matches("4.4.4.4")), ["dummy"])
        self.assertEqual(fh.matches("5.5.5.5"), [])

    def test_ipv6_hits_and_misses(self):
        fh = self._make_loaded_firehol("v6only")
        self.assertEqual(sorted(fh.matches("2001:db8::1")), ["v6only"])
        self.assertEqual(fh.matches("2001:dead::1"), [])


class ConstructorGuardTests(unittest.TestCase):
    """
    Expect a ValueError for an empty list-set.  We patch .close so that the
    partially-initialised instance’s __del__ doesn’t raise AttributeError.
    """

    def setUp(self):
        self._close_patcher = patch.object(Firehol, "close", lambda self, **kw: None)
        self._close_patcher.start()

    def tearDown(self):
        self._close_patcher.stop()

    def test_empty_list_names(self):
        with self.assertRaises(ValueError):
            Firehol([])


class TrieTests(unittest.TestCase):
    trie: _Trie
    lookup_table: dict[IPvXNetwork, str]

    @classmethod
    def setUpClass(cls):
        random.seed(0xF1EE)
        cls.trie = _Trie()
        cls.lookup_table = {}
        for family, count in (("v4", 1000), ("v6", 1000)):
            for _ in range(count):
                net, name = cls._make_random_network(family)
                cls.trie.insert(net, name)
                cls.lookup_table[net] = name

    @staticmethod
    def _make_random_network(family: str) -> Tuple[IPvXNetwork, str]:
        addr: ipaddress.IPv4Address | ipaddress.IPv6Address
        if family == "v4":
            addr = ipaddress.IPv4Address(random.getrandbits(32))
            prefix = random.randint(8, 32)
        else:
            addr = ipaddress.IPv6Address(random.getrandbits(128))
            prefix = random.randint(16, 128)
        net = ipaddress.ip_network((addr, prefix), strict=False)
        return net, f"list_{family}_{addr}_{prefix}"

    def test_all_positive_matches(self):
        for net, expected in self.lookup_table.items():
            for addr in _sample_addresses(net):
                with self.subTest(addr=str(addr), net=str(net)):
                    self.assertIn(expected, self.trie.search(addr))

    def test_no_false_positives(self):
        for net, list_name in self.lookup_table.items():
            addr = _address_outside(net)
            with self.subTest(addr=str(addr), net=str(net)):
                self.assertNotIn(list_name, self.trie.search(addr))
