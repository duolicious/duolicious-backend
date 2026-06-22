"""
Tests for service.firehol – the simplified single-process block-list service.

`_parse_blocklist` yields CIDR-string prefixes (e.g. "1.2.3.0/24"), which
pytricia accepts directly. Lookups go through the module-level `lookup()`, which
reads the active tries (`_tries`) the background refresher swaps in.
"""

import ipaddress
import random
import unittest
from typing import Iterable, Tuple, Union
from unittest.mock import patch

import service.firehol as firehol
from service.firehol import (
    _build_tries,
    _parse_blocklist,
    _PrefixTrie,
    lookup,
)

IPvXNetwork = Union[ipaddress.IPv4Network, ipaddress.IPv6Network]
IPvXAddress = Union[ipaddress.IPv4Address, ipaddress.IPv6Address]

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


def _sample_addresses(net: IPvXNetwork) -> Iterable[IPvXAddress]:
    yield net.network_address
    yield net.broadcast_address
    if net.num_addresses > 2:  # midpoint
        yield net[net.num_addresses // 2]


def _address_outside(net: IPvXNetwork) -> IPvXAddress:
    if isinstance(net, ipaddress.IPv4Network):
        return ipaddress.IPv4Address(int(net.network_address) ^ (1 << 31))
    return ipaddress.IPv6Address(int(net.network_address) ^ (1 << 127))


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class ParseBlocklistTests(unittest.TestCase):
    def test_split_v4_and_v6(self) -> None:
        v4, v6 = _parse_blocklist(_SAMPLE_NETSET)
        self.assertIn("1.2.3.0/24", v4)
        self.assertIn("4.4.4.4/32", v4)
        self.assertIn("2001:db8::/32", v6)
        self.assertEqual((len(v4), len(v6)), (2, 1))


class LookupTests(unittest.TestCase):
    """Exercises `lookup()` against tries built from the sample netset."""

    def setUp(self) -> None:
        v4, v6 = _parse_blocklist(_SAMPLE_NETSET)
        tries = _build_tries({"dummy": (v4, v6)})
        self._patcher = patch.object(firehol, "_tries", tries)
        self._patcher.start()

    def tearDown(self) -> None:
        self._patcher.stop()

    def test_ipv4_hits_and_misses(self) -> None:
        self.assertEqual(sorted(lookup("1.2.3.4")), ["dummy"])
        self.assertEqual(sorted(lookup("4.4.4.4")), ["dummy"])
        self.assertEqual(lookup("5.5.5.5"), [])

    def test_ipv6_hits_and_misses(self) -> None:
        self.assertEqual(sorted(lookup("2001:db8::1")), ["dummy"])
        self.assertEqual(lookup("2001:dead::1"), [])


class LookupNotLoadedTests(unittest.TestCase):
    def test_returns_empty_before_first_build(self) -> None:
        with patch.object(firehol, "_tries", None):
            self.assertEqual(lookup("1.2.3.4"), [])


class PrefixTrieTests(unittest.TestCase):
    """Random-network sanity checks for the pytricia-backed `_PrefixTrie`."""

    v4_trie: _PrefixTrie
    v6_trie: _PrefixTrie
    lookup_table: dict[IPvXNetwork, str]

    @classmethod
    def setUpClass(cls) -> None:
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

    def test_all_positive_matches(self) -> None:
        for net, expected in self.lookup_table.items():
            trie = self._trie_for(net)
            for addr in _sample_addresses(net):
                with self.subTest(addr=str(addr), net=str(net)):
                    self.assertIn(expected, trie.search(addr))

    def test_no_false_positives(self) -> None:
        for net, list_name in self.lookup_table.items():
            trie = self._trie_for(net)
            addr = _address_outside(net)
            with self.subTest(addr=str(addr), net=str(net)):
                self.assertNotIn(list_name, trie.search(addr))

    def test_multiple_lists_per_prefix(self) -> None:
        """A prefix shared by several lists returns *all* of them."""
        trie = _PrefixTrie(32)
        trie.insert("10.0.0.0/8", "list_a")
        trie.insert("10.0.0.0/8", "list_b")
        trie.insert("10.1.0.0/16", "list_c")
        result = sorted(trie.search(ipaddress.IPv4Address("10.1.2.3")))
        self.assertEqual(result, ["list_a", "list_b", "list_c"])

    def test_empty_trie_returns_empty_list(self) -> None:
        trie = _PrefixTrie(32)
        self.assertEqual(trie.search(ipaddress.IPv4Address("8.8.8.8")), [])


if __name__ == "__main__":
    unittest.main()
