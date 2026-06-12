"""
Generic Redis-backed result cache, exposed as the `redis_cache(ttl)` decorator.

Wrap any function whose result is worth memoizing across requests/processes:

    @redis_cache(ttl=10 * 60)
    def get_public_search():
        ...

The cache is keyed by the wrapped function's identity plus a stable hash of its
arguments, so different argument sets are cached separately. Results round-trip
through JSON, so a cache hit returns JSON-compatible types (e.g. a `uuid.UUID`
comes back as its string form) -- the same shape Flask would serialize into the
HTTP response anyway.

Like `sessioncache`, Redis is treated as a best-effort accelerator: any Redis
error -- or an argument/result that can't be encoded into a stable cache key --
degrades to simply calling the wrapped function, so callers keep working off the
database alone.
"""

import functools
import json
import os
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Callable

import redis

from duohash import sha512


REDIS_HOST: str = os.environ.get("DUO_REDIS_HOST", "redis")
REDIS_PORT: int = int(os.environ.get("DUO_REDIS_PORT", 6379))

_KEY_PREFIX = "cached_result:"

# Dedicated synchronous client, mirroring sessioncache: bounded timeouts so an
# unreachable or slow Redis turns into a fast, swallowed error rather than
# blocking the caller indefinitely.
_redis = redis.Redis(
    host=REDIS_HOST,
    port=REDIS_PORT,
    decode_responses=True,
    socket_connect_timeout=1,
    socket_timeout=1,
)


def _default(o: Any) -> str:
    """JSON encoder for the database types that show up in cached results,
    matching how Flask's default JSON provider renders them."""
    if isinstance(o, uuid.UUID):
        return str(o)
    if isinstance(o, Decimal):
        return str(o)
    if isinstance(o, (datetime, date)):
        return o.isoformat()
    raise TypeError(f"Object of type {type(o).__name__} is not JSON serializable")


def _key(func: Callable, args: tuple, kwargs: dict) -> str:
    arg_payload = json.dumps(
        [args, kwargs],
        default=_default,
        sort_keys=True,
        separators=(",", ":"),
    )
    return f"{_KEY_PREFIX}{func.__module__}.{func.__qualname__}:{sha512(arg_payload)}"


def redis_cache(ttl: int):
    """Cache the wrapped function's result in Redis for `ttl` seconds."""
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            try:
                key = _key(func, args, kwargs)
            except TypeError:
                # Arguments don't encode into a stable key; skip the cache
                # rather than risk a collision serving the wrong result.
                return func(*args, **kwargs)

            try:
                cached = _redis.get(key)
            except Exception:
                cached = None

            if cached is not None:
                try:
                    return json.loads(cached)
                except Exception:
                    pass

            result = func(*args, **kwargs)

            try:
                _redis.set(key, json.dumps(result, default=_default), ex=ttl)
            except Exception:
                pass

            return result

        return wrapper

    return decorator
