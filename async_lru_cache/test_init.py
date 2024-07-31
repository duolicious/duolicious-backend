import unittest
import asyncio
from async_lru_cache import AsyncLruCache

class TestAsyncLRUCache(unittest.TestCase):

    async def async_test_cache_basic_functionality(self):
        @AsyncLruCache(maxsize=2)
        async def fetch(x):
            return x * 2

        self.assertEqual(await fetch(1), 2)  # Cache miss
        self.assertEqual(await fetch(1), 2)  # Cache hit
        self.assertEqual(await fetch(2), 4)  # Cache miss
        self.assertEqual(await fetch(3), 6)  # Cache miss, should evict key 1
        self.assertEqual(await fetch(1), 2)  # Cache miss, as it was evicted

    async def async_test_cache_with_ttl(self):
        @AsyncLruCache(maxsize=2, ttl=0.1)  # very short TTL
        async def fetch(x):
            return x * 3

        self.assertEqual(await fetch(1), 3)  # Cache miss
        self.assertEqual(await fetch(1), 3)  # Cache hit
        await asyncio.sleep(0.2)  # Wait to ensure TTL expires
        self.assertEqual(await fetch(1), 3)  # Cache miss, as TTL expired

    async def async_test_cache_with_condition(self):
        @AsyncLruCache(maxsize=2, cache_condition=lambda x: x % 4 == 0)
        async def fetch(x):
            return x * 2

        self.assertEqual(await fetch(2), 4)   # Should not cache
        self.assertEqual(await fetch(2), 4)   # Not cached, recompute
        self.assertEqual(await fetch(4), 8)   # Should cache
        self.assertEqual(await fetch(4), 8)   # Cache hit

    def test_async_cache(self):
        """ Run all async tests """
        loop = asyncio.get_event_loop()
        loop.run_until_complete(self.async_test_cache_basic_functionality())
        loop.run_until_complete(self.async_test_cache_with_ttl())
        loop.run_until_complete(self.async_test_cache_with_condition())

if __name__ == '__main__':
    unittest.main()
