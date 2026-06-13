"""
Tests for antiabuse.firehol – the HTTP client that talks to the FireHOL
container. A tiny stub HTTP server stands in for the real container so these
tests touch neither the network nor a subprocess.
"""

import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from antiabuse.firehol import FireholClient


class _StubHandler(BaseHTTPRequestHandler):
    # Set per-test on the server instance.
    def _json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/matches":
            ip = parse_qs(parsed.query).get("ip", [None])[0]
            self._json(200, self.server.matches_for.get(ip, []))
        elif parsed.path == "/ready":
            self._json(200, {"ready": self.server.ready})
        else:
            self._json(404, {"error": "not found"})

    def log_message(self, *args):
        pass


class FireholClientTests(unittest.TestCase):
    def setUp(self):
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), _StubHandler)
        self.server.matches_for = {"1.2.3.4": ["list_a", "list_b"]}
        self.server.ready = True
        self._thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self._thread.start()
        host, port = self.server.server_address
        self.client = FireholClient(f"http://{host}:{port}")

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()

    def test_matches_hit(self):
        self.assertEqual(sorted(self.client.matches("1.2.3.4")), ["list_a", "list_b"])

    def test_matches_miss(self):
        self.assertEqual(self.client.matches("5.5.5.5"), [])

    def test_wait_until_loaded(self):
        self.assertTrue(self.client.wait_until_loaded(timeout=1.0))

    def test_wait_until_loaded_not_ready(self):
        self.server.ready = False
        self.assertFalse(self.client.wait_until_loaded(timeout=0.2))


class FireholClientFailOpenTests(unittest.TestCase):
    """A down/unreachable container must look like "not blocked"."""

    def setUp(self):
        # Port 1 is reserved and never listening, so connections are refused.
        self.client = FireholClient("http://127.0.0.1:1")

    def test_matches_fails_open(self):
        self.assertEqual(self.client.matches("1.2.3.4"), [])

    def test_wait_until_loaded_times_out(self):
        self.assertFalse(self.client.wait_until_loaded(timeout=0.3))


if __name__ == "__main__":
    unittest.main()
