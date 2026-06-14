from lxml import etree
import redis.asyncio as redis
import traceback
from service.chat.chatutil import (
    fetch_is_public,
    fetch_is_skipped,
    fetch_id_from_username,
)
from enum import Enum
from commonsql import Q_UPDATE_LAST
from batcher import Batcher
from service.chat.session import Session
from database import api_tx
import asyncio
import traceback
import time
from functools import lru_cache
from pathlib import Path
from dataclasses import dataclass
from constants import ONLINE_RECENTLY_SECONDS, MAX_ONLINE_SUBSCRIPTIONS
from util import truncate_text

LAST_UPDATE_INTERVAL_SECONDS = 4 * 60  # 4 minutes

_TEST_INPUT_DIR = Path(__file__).parents[3] / 'test' / 'input'


def _read_test_input(name: str) -> str | None:
    try:
        return (_TEST_INPUT_DIR / name).read_text().strip()
    except:
        return None


@lru_cache(maxsize=1)
def _max_online_subscriptions(ttl_hash: int) -> int:
    # Tests may shrink the cap via `test/input/max-online-subscriptions` (only
    # when mocking is enabled) so the limit can be exercised without creating
    # hundreds of subscriptions. Production never ships these files.
    if _read_test_input('enable-mocking') != '1':
        return MAX_ONLINE_SUBSCRIPTIONS

    override = _read_test_input('max-online-subscriptions')

    try:
        return MAX_ONLINE_SUBSCRIPTIONS if override is None else int(override)
    except ValueError:
        return MAX_ONLINE_SUBSCRIPTIONS


def max_online_subscriptions() -> int:
    # Cache within a one-second window to avoid a filesystem stat per subscribe.
    return _max_online_subscriptions(ttl_hash=round(time.time()))

FMT_KEY = 'online-{username}'

FMT_ONLINE_EVENT = '<duo_online_event uuid="{username}" status="{status}" />'

FMT_SUB_OK  = '<duo_subscribe_successful uuid="{username}" />'
FMT_SUB_BAD = '<duo_subscribe_unsuccessful uuid="{username}" />'

FMT_UNSUB_OK  = '<duo_unsubscribe_successful uuid="{username}" />'
FMT_UNSUB_BAD = '<duo_unsubscribe_unsuccessful uuid="{username}" />'


class OnlineStatus(Enum):
    ONLINE = 'online'
    ONLINE_RECENTLY = 'online-recently'
    OFFLINE = 'offline'


Q_UPDATE_SESSION_LAST_ONLINE = """
UPDATE
    duo_session
SET
    last_online_time = NOW()
WHERE
    session_token_hash = %(session_token_hash)s
"""


@dataclass(frozen=True)
class UpdateLastJob:
    session_username: str
    session_token_hash: str
    do_update_last_event: bool


async def _redis_subscribe_online(
    redis_client: redis.Redis,
    pubsub: redis.client.PubSub,
    username: str,
):
    key = FMT_KEY.format(username=username)
    val = await redis_client.get(key)

    await pubsub.subscribe(key)
    return val or FMT_ONLINE_EVENT.format(
        username=username,
        status=OnlineStatus.OFFLINE.value,
    )


async def _redis_unsubscribe_online(
    pubsub: redis.client.PubSub,
    username: str,
):
    key = FMT_KEY.format(username=username)
    await pubsub.unsubscribe(key)

async def redis_publish_online(
    redis_client: redis.Redis,
    username: str,
    online: bool
):
    status = (
        OnlineStatus.ONLINE.value
        if online
        else OnlineStatus.ONLINE_RECENTLY.value)

    key = FMT_KEY.format(username=username)
    val = FMT_ONLINE_EVENT.format(username=username, status=status)

    async with redis_client.pipeline(transaction=True) as pipe:
        pipe.publish(key, val)
        pipe.set(key, val, ex=ONLINE_RECENTLY_SECONDS)
        await pipe.execute()

async def should_subscribe(from_username: str | None, to_username: str) -> bool:
    if from_username is None:
        to_id = await fetch_id_from_username(to_username)

        return (
                to_id is not None and
                await fetch_is_public(to_id))
    else:
        from_id, to_id = (
                await fetch_id_from_username(from_username),
                await fetch_id_from_username(to_username))

        return (
                from_id is not None and
                to_id is not None and
                not await fetch_is_skipped(
                    from_id=from_id, to_id=to_id))


async def _evict_oldest_online_subscriptions(
    pubsub: redis.client.PubSub,
    session: Session,
    limit: int,
):
    # Unsubscribe the earliest subscriptions until there's room for one more.
    while (
        session.online_subscriptions and
        len(session.online_subscriptions) >= limit
    ):
        oldest = next(iter(session.online_subscriptions))
        del session.online_subscriptions[oldest]
        await _redis_unsubscribe_online(pubsub=pubsub, username=oldest)


async def maybe_redis_subscribe_online(
    from_username: str | None,
    parsed_xml: etree._Element,
    redis_client: redis.Redis,
    pubsub: redis.client.PubSub,
    session: Session,
) -> list[str]:
    if parsed_xml.tag != 'duo_subscribe_online':
        return []

    to_username = parsed_xml.attrib.get('uuid')

    if not to_username:
        return []

    try:
        if not await should_subscribe(
                from_username=from_username,
                to_username=to_username):
            return [FMT_SUB_BAD.format(username=to_username)]

        # Cap concurrent subscriptions per connection. Re-subscribing to a key
        # already held is idempotent, so only new keys cost a slot; reaching the
        # cap evicts the earliest subscriptions rather than refusing new ones.
        if to_username not in session.online_subscriptions:
            await _evict_oldest_online_subscriptions(
                    pubsub=pubsub,
                    session=session,
                    limit=max_online_subscriptions())
            session.online_subscriptions[to_username] = None

        return [
            FMT_SUB_OK.format(username=to_username),
            await _redis_subscribe_online(
                    redis_client=redis_client,
                    pubsub=pubsub,
                    username=to_username),
        ]
    except:
        print(traceback.format_exc())
        return [FMT_SUB_BAD.format(username=to_username)]


async def maybe_redis_unsubscribe_online(
    parsed_xml: etree._Element,
    pubsub: redis.client.PubSub,
    session: Session,
) -> list[str]:
    if parsed_xml.tag != 'duo_unsubscribe_online':
        return []

    username = parsed_xml.attrib.get('uuid')

    if not username:
        return []

    try:
        session.online_subscriptions.pop(username, None)

        await _redis_unsubscribe_online(
                pubsub=pubsub,
                username=username)

        return [FMT_UNSUB_OK.format(username=username)]
    except:
        print(traceback.format_exc())
        return [FMT_UNSUB_BAD.format(username=username)]



def process_batch(jobs: list[UpdateLastJob]):
    update_last_params_seq = [
        dict(person_uuid=job.session_username)
        for job in jobs
    ]

    session_params_seq = [
        dict(session_token_hash=job.session_token_hash)
        for job in jobs
    ]

    with api_tx('read committed') as tx:
        tx.executemany(Q_UPDATE_LAST, update_last_params_seq)
        tx.executemany(Q_UPDATE_SESSION_LAST_ONLINE, session_params_seq)


def update_last_once(
    session_username: str,
    session_token_hash: str,
    do_update_last_event: bool,
):
    _batcher.enqueue(
        UpdateLastJob(
            session_username=session_username,
            session_token_hash=session_token_hash,
            do_update_last_event=do_update_last_event,
        )
    )


async def update_online_once(
    redis_client: redis.Redis,
    session: Session,
    online: bool,
    do_update_last_event: bool = False,
):
    if session.username is None or session.session_token_hash is None:
        return

    update_last_once(
        session_username=session.username,
        session_token_hash=session.session_token_hash,
        do_update_last_event=do_update_last_event,
    )

    await redis_publish_online(
        redis_client=redis_client,
        username=session.username,
        online=online,
    )


async def update_online_forever(
    redis_client: redis.Redis,
    session: Session,
    online: bool
):
    try:
        await update_online_once(
            redis_client=redis_client,
            session=session,
            online=online,
            do_update_last_event=True,
        )

        while True:
            await asyncio.sleep(LAST_UPDATE_INTERVAL_SECONDS)

            await update_online_once(
                redis_client=redis_client,
                session=session,
                online=online,
            )
    except asyncio.exceptions.CancelledError:
        pass
    except:
        print(traceback.format_exc())
        raise


_batcher = Batcher[UpdateLastJob](
    process_fn=process_batch,
    flush_interval=1.0,
    min_batch_size=1,
    max_batch_size=1000,
    retry=False,
)

_batcher.start()
