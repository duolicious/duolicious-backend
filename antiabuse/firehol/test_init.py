"""
Tests for antiabuse.firehol – updated for the pytricia-backed refactor.

The radix-trie implementation has been replaced by `pytricia.PyTricia`, wrapped
by `_PrefixTrie`. `_parse_blocklist` now yields CIDR-string prefixes (e.g.
"1.2.3.0/24") rather than `ipaddress.IPvXNetwork` objects, since pytricia
accepts string keys directly.
"""

import ipaddress
import random
import unittest
from datetime import timedelta
from typing import Iterable, Tuple, Union
from unittest.mock import patch

from antiabuse.firehol import (
    Firehol,
    _parse_blocklist,
    _PrefixTrie,
)

IPvXNetwork = Union[ipaddress.IPv4Network, ipaddress.IPv6Network]

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

def _fake_download(name: str, _update_interval: timedelta) -> str:
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
        self.assertIn("1.2.3.0/24", v4)
        self.assertIn("4.4.4.4/32", v4)
        self.assertIn("2001:db8::/32", v6)
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


class PrefixTrieTests(unittest.TestCase):
    """Random-network sanity checks for the pytricia-backed `_PrefixTrie`."""

    v4_trie: _PrefixTrie
    v6_trie: _PrefixTrie
    lookup_table: dict[IPvXNetwork, str]

    @classmethod
    def setUpClass(cls):
        random.seed(0xF1EE)
        cls.v4_trie = _PrefixTrie(32)
        cls.v6_trie = _PrefixTrie(128)
        cls.lookup_table = {}
        for family, count in (("v4", 1000), ("v6", 1000)):
            for _ in range(count):
                net, name = cls._make_random_network(family)
                trie = cls.v4_trie if family == "v4" else cls.v6_trie
                trie.insert(net.with_prefixlen, name)
                cls.lookup_table[net] = name

    @staticmethod
    def _make_random_network(family: str) -> Tuple[IPvXNetwork, str]:
        if family == "v4":
            addr_v4 = ipaddress.IPv4Address(random.getrandbits(32))
            prefix = random.randint(8, 32)
            net: IPvXNetwork = ipaddress.ip_network(
                (addr_v4, prefix), strict=False
            )
            return net, f"list_v4_{addr_v4}_{prefix}"
        else:
            addr_v6 = ipaddress.IPv6Address(random.getrandbits(128))
            prefix = random.randint(16, 128)
            net = ipaddress.ip_network((addr_v6, prefix), strict=False)
            return net, f"list_v6_{addr_v6}_{prefix}"

    def _trie_for(self, net: IPvXNetwork) -> _PrefixTrie:
        return self.v4_trie if isinstance(net, ipaddress.IPv4Network) else self.v6_trie

    def test_all_positive_matches(self):
        for net, expected in self.lookup_table.items():
            trie = self._trie_for(net)
            for addr in _sample_addresses(net):
                with self.subTest(addr=str(addr), net=str(net)):
                    self.assertIn(expected, trie.search(addr))

    def test_no_false_positives(self):
        for net, list_name in self.lookup_table.items():
            trie = self._trie_for(net)
            addr = _address_outside(net)
            with self.subTest(addr=str(addr), net=str(net)):
                self.assertNotIn(list_name, trie.search(addr))

    def test_multiple_lists_per_prefix(self):
        """A prefix shared by several lists returns *all* of them."""
        trie = _PrefixTrie(32)
        trie.insert("10.0.0.0/8", "list_a")
        trie.insert("10.0.0.0/8", "list_b")
        trie.insert("10.1.0.0/16", "list_c")
        result = sorted(trie.search(ipaddress.IPv4Address("10.1.2.3")))
        self.assertEqual(result, ["list_a", "list_b", "list_c"])

    def test_empty_trie_returns_empty_list(self):
        trie = _PrefixTrie(32)
        self.assertEqual(trie.search(ipaddress.IPv4Address("8.8.8.8")), [])


if __name__ == "__main__":
    unittest.main()
