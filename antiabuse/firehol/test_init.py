"""
Minimal tests for the Firehol helper.

Run with:
    python -m unittest discover -v
"""

from datetime import timedelta
import ipaddress
import unittest
from unittest.mock import patch
from antiabuse.firehol import Firehol, _parse_blocklist


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

_SAMPLE_NETSET = """
# Example FireHOL netset
1.2.3.0/24
4.4.4.4
2001:db8::/32
bad_line_should_be_ignored
"""


def _fake_download(_self, _name):
    """Stand-in for Firehol._download_or_load – never touches network/disk."""
    return _SAMPLE_NETSET


class PatchedFireholMixin:
    """Mixin that patches Firehol._download_or_load for the duration of a test."""

    def setUp(self):
        self._patcher = patch.object(Firehol, "_download_or_load", _fake_download)
        self._patcher.start()

    def tearDown(self):
        self._patcher.stop()


# ---------------------------------------------------------------------------
# Unit tests
# ---------------------------------------------------------------------------

class ParseBlocklistTests(unittest.TestCase):
    def test_split_v4_and_v6(self):
        v4, v6 = _parse_blocklist(_SAMPLE_NETSET)
        self.assertIn(ipaddress.ip_network("1.2.3.0/24"), v4)
        self.assertIn(ipaddress.ip_network("4.4.4.4/32"), v4)   # single-IP → /32
        self.assertIn(ipaddress.ip_network("2001:db8::/32"), v6)
        # comment, blank and junk lines ignored
        self.assertEqual((len(v4), len(v6)), (2, 1))


class LookupTests(PatchedFireholMixin, unittest.TestCase):
    def test_ipv4_hits_and_misses(self):
        fh = Firehol(["dummy"], start_updater=False)
        fh._update_once()                       # uses patched downloader

        self.assertEqual(fh.matches("1.2.3.4"), ["dummy"])     # in /24
        self.assertEqual(fh.matches("4.4.4.4"), ["dummy"])     # exact IP
        self.assertEqual(fh.matches("5.5.5.5"), [])            # absent

    def test_ipv6_hits_and_misses(self):
        fh = Firehol(["v6only"], start_updater=False)
        fh._update_once()

        self.assertEqual(fh.matches("2001:db8::1"), ["v6only"])
        self.assertEqual(fh.matches("2001:dead::1"), [])       # outside /32


class ConstructorGuardTests(unittest.TestCase):
    def test_empty_list_names(self):
        with self.assertRaises(ValueError):
            Firehol([])
