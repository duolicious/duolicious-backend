"""
HTTP client for the FireHOL block-list lookup container.

Exposes the `matches()` surface the rest of the app relied on when `Firehol`
ran in-process, but forwards each call to the `firehol` container (see
service/firehol) so that the block-list tries are held in memory once rather
than once per API worker.

Lookups fail open: any timeout, connection error, or non-200 response yields an
empty list, i.e. "not blocked". The service itself does no timeout handling, so
timeouts are owned (and logged) here.
"""

import ipaddress
import json
import os
import socket
from datetime import datetime, timezone
from typing import Union
from urllib.error import URLError
from urllib.parse import quote
from urllib.request import urlopen

from util import timed

ListName = str
IPAddress = Union[str, ipaddress.IPv4Address, ipaddress.IPv6Address]

FIREHOL_URL = os.environ.get("DUO_FIREHOL_URL", "http://firehol:5070")

# Container-to-container lookups are fast, but we keep the timeout short so a
# slow or unavailable FireHOL container never stalls an auth request; we just
# fail open instead.
FIREHOL_TIMEOUT = float(os.environ.get("DUO_FIREHOL_TIMEOUT", "0.02"))


def _log(message: str) -> None:
    print(f"{datetime.now(timezone.utc).isoformat()} {message}")


class FireholClient:
    """Check IP addresses against the FireHOL container over HTTP."""

    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")

    def _get(self, path: str) -> object:
        url = f"{self.base_url}{path}"
        with timed("FireHOL request", _log):
            try:
                with urlopen(url, timeout=FIREHOL_TIMEOUT) as resp:
                    if resp.status != 200:
                        return None
                    return json.loads(resp.read().decode("utf-8"))
            except (URLError, TimeoutError, OSError, ValueError) as e:
                reason = getattr(e, "reason", e)
                if isinstance(e, (socket.timeout, TimeoutError)) or isinstance(
                    reason, (socket.timeout, TimeoutError)
                ):
                    _log(f"FireHOL request timed out, failing open: {url}")
                else:
                    _log(f"FireHOL request failed, failing open ({url}): {e}")
                return None

    def matches(self, ip: IPAddress) -> list[ListName]:
        """Return the FireHOL lists the address belongs to (or [])."""
        response = self._get(f"/matches?ip={quote(str(ip))}")
        if not isinstance(response, list):
            return []
        return response


# ---------------------------------------------------------------------------
# Convenience singleton
# ---------------------------------------------------------------------------

firehol = FireholClient(FIREHOL_URL)
