from typing import Any
import unittest
import uuid
from decimal import Decimal
from unittest.mock import patch

import rediscache
from rediscache import redis_cache


class FakeRedis:
    """In-memory stand-in for the synchronous redis client used by rediscache."""

    def __init__(self) -> None:
        self.store: dict[Any, Any] = {}
        self.expirations: dict[Any, Any] = {}

    def get(self, key: Any) -> Any:
        return self.store.get(key)

    def set(self, key: Any, value: Any, ex: Any = None) -> Any:
        self.store[key] = value
        self.expirations[key] = ex
        return True


class ExplodingRedis:
    """Stand-in whose every operation raises, like an unreachable Redis."""

    def get(self, key: Any) -> None:
        raise ConnectionError("redis down")

    def set(self, key: Any, value: Any, ex: Any = None) -> None:
        raise ConnectionError("redis down")


class TestRedisCache(unittest.TestCase):

    def setUp(self) -> None:
        self.fake = FakeRedis()
        patcher = patch.object(rediscache, "_redis", self.fake)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_caches_result(self) -> None:
        call_count = 0

        @redis_cache(ttl=600)
        def fetch() -> Any:
            nonlocal call_count
            call_count += 1
            return {"value": call_count}

        self.assertEqual(fetch(), {"value": 1})  # miss
        self.assertEqual(fetch(), {"value": 1})  # hit, not recomputed
        self.assertEqual(call_count, 1)

    def test_distinct_args_cached_separately(self) -> None:
        call_count = 0

        @redis_cache(ttl=600)
        def fetch(x: Any, y: int = 0) -> Any:
            nonlocal call_count
            call_count += 1
            return x + y

        self.assertEqual(fetch(1), 1)        # miss
        self.assertEqual(fetch(1), 1)        # hit
        self.assertEqual(fetch(2), 2)        # miss (different positional)
        self.assertEqual(fetch(1, y=5), 6)   # miss (different kwarg)
        self.assertEqual(fetch(1, y=5), 6)   # hit
        self.assertEqual(call_count, 3)

    def test_ttl_passed_to_redis(self) -> None:
        @redis_cache(ttl=600)
        def fetch() -> Any:
            return "x"

        fetch()
        self.assertEqual(list(self.fake.expirations.values()), [600])

    def test_serializes_db_types(self) -> None:
        u = uuid.uuid4()

        @redis_cache(ttl=600)
        def fetch() -> Any:
            return [{"prospect_uuid": u, "age": Decimal("27"), "name": "Bob"}]

        # First call computes the real result.
        self.assertEqual(
            fetch(),
            [{"prospect_uuid": u, "age": Decimal("27"), "name": "Bob"}],
        )
        # Cache hit returns the JSON-compatible round-trip (UUID/Decimal as str),
        # which is the same shape Flask serializes into the response.
        self.assertEqual(
            fetch(),
            [{"prospect_uuid": str(u), "age": "27", "name": "Bob"}],
        )

    def test_redis_errors_degrade_to_calling_function(self) -> None:
        call_count = 0

        @redis_cache(ttl=600)
        def fetch() -> Any:
            nonlocal call_count
            call_count += 1
            return call_count

        with patch.object(rediscache, "_redis", ExplodingRedis()):
            self.assertEqual(fetch(), 1)  # get raises -> miss; set raises -> swallowed
            self.assertEqual(fetch(), 2)  # still uncached, recomputed
        self.assertEqual(call_count, 2)

    def test_unserializable_arg_skips_cache(self) -> None:
        call_count = 0

        @redis_cache(ttl=600)
        def fetch(obj: Any) -> Any:
            nonlocal call_count
            call_count += 1
            return call_count

        unserializable = object()
        self.assertEqual(fetch(unserializable), 1)
        self.assertEqual(fetch(unserializable), 2)  # no stable key -> never cached
        self.assertEqual(call_count, 2)
        self.assertEqual(self.fake.store, {})


if __name__ == "__main__":
    unittest.main()
