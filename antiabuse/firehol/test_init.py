import ipaddress
import multiprocessing as mp
import time
import unittest
from datetime import timedelta
from unittest.mock import patch
import random
from typing import Iterable, Tuple
from antiabuse.firehol import Firehol, _parse_blocklist, _Trie, IPvXNetwork

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


def _sample_addresses(net: IPvXNetwork) -> Iterable[ipaddress._BaseAddress]:
    """
    Yield up to three representative addresses from *inside* `net`:
      • the network address
      • the broadcast/last address
      • a midpoint host (when at least 3 usable addresses)
    """
    yield net.network_address
    yield net.broadcast_address

    if net.num_addresses > 2:
        yield net[(net.num_addresses // 2)]


def _address_outside(net: IPvXNetwork) -> ipaddress._BaseAddress:
    """
    Deterministically pick an address that is *not* in `net`.
    The method biases toward nearby addresses so we sometimes cross
    prefix-boundaries.
    """
    if isinstance(net, ipaddress.IPv4Network):
        # Flip the MSB (bit-31) to guarantee we leave the /1 that contains `net`
        addr_int = int(net.network_address) ^ (1 << 31)
        return ipaddress.IPv4Address(addr_int)
    else:
        # Flip the MSB (bit-127) for IPv6
        addr_int = int(net.network_address) ^ (1 << 127)
        return ipaddress.IPv6Address(addr_int)


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


class TrieTests(unittest.TestCase):
    """
    Populates one trie with a mix of ~2 000 random networks
    and probes each one for correctness.
    """

    trie: _Trie
    lookup_table: dict[IPvXNetwork, str]

    @classmethod
    def setUpClass(cls) -> None:
        random.seed(0xF1EE)  # deterministic

        cls.trie = _Trie()
        cls.lookup_table = {}

        # Generate random networks
        for family, count in (("v4", 1000), ("v6", 1000)):
            for _ in range(count):
                net, name = cls._make_random_network(family)
                cls.trie.insert(net, name)
                cls.lookup_table[net] = name

    # ------------------------------------------------------------------ #
    #                               helpers                              #
    # ------------------------------------------------------------------ #
    @staticmethod
    def _make_random_network(
        family: str,
    ) -> Tuple[IPvXNetwork, str]:
        """
        Return a random IPv4 / IPv6 network together with a unique list-name.
        """
        addr: ipaddress.IPv4Address | ipaddress.IPv6Address
        if family == "v4":
            addr = ipaddress.IPv4Address(random.getrandbits(32))
            prefix = random.randint(8, 32)  # avoid /0 in tests
        else:
            addr = ipaddress.IPv6Address(random.getrandbits(128))
            prefix = random.randint(16, 128)

        net = ipaddress.ip_network((addr, prefix), strict=False)
        name = f"list_{family}_{addr}_{prefix}"
        return net, name

    # ------------------------------------------------------------------ #
    #                               tests                                #
    # ------------------------------------------------------------------ #

    def test_all_positive_matches(self):
        """
        Every sampled address *inside* each inserted network must match
        exactly the corresponding list-name.
        """
        for net, expected_list in self.lookup_table.items():
            for addr in _sample_addresses(net):
                with self.subTest(addr=str(addr), net=str(net)):
                    self.assertIn(
                        expected_list,
                        self.trie.search(addr),
                        msg=f"{addr} should match {net}",
                    )

    def test_no_false_positives(self):
        """
        An address deliberately chosen *outside* a network must NOT match that
        network’s list-name (though it may match something else if there is
        overlap; we merely assert it isn’t a false positive for *that* list).
        """
        for net, list_name in self.lookup_table.items():
            addr = _address_outside(net)
            with self.subTest(addr=str(addr), net=str(net)):
                self.assertNotIn(
                    list_name,
                    self.trie.search(addr),
                    msg=f"{addr} unexpectedly matched {net}",
                )

