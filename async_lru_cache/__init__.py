import asyncio
from collections import OrderedDict
import functools
from typing import (
    Awaitable,
    Callable,
    ParamSpec,
    TypeVar,
)

P = ParamSpec("P")
R = TypeVar("R")

class AsyncLruCache:
    def __init__(self, maxsize=1024, ttl=None, cache_condition=None):
        self.maxsize = maxsize
        self.ttl = ttl  # seconds
        self.cache_condition = cache_condition
        self.cache = OrderedDict()

    def __call__(
        self,
        func: Callable[P, Awaitable[R]]
    ) -> Callable[P, Awaitable[R]]:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            key = args + tuple(sorted(kwargs.items()))

            # Return the cached result if available
            if key in self.cache:
                self.cache.move_to_end(key)  # Mark as recently used
                return self.cache[key][0]

            # Compute result as it's not cached
            result = await func(*args, **kwargs)

            # Determine if the result should be cached
            should_cache = self.cache_condition is None or self.cache_condition(result)
            if not should_cache:
                return result

            # Cache the result with optional TTL
            if self.ttl is not None:
                loop = asyncio.get_running_loop()
                timer = loop.call_later(self.ttl, lambda: self.cache.pop(key, None))
                self.cache[key] = (result, timer)
            else:
                self.cache[key] = (result, None)

            # Manage cache size
            if len(self.cache) > self.maxsize:
                oldest_key, oldest_value = self.cache.popitem(last=False)
                if oldest_value[1]:
                    oldest_value[1].cancel()  # Cancel the timer if it exists

            return result

        return wrapper
