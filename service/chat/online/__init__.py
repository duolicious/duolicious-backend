from lxml import etree
import redis.asyncio as redis
import traceback
from service.chat.chatutil import (
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
from dataclasses import dataclass
from constants import ONLINE_RECENTLY_SECONDS
from util import truncate_text

LAST_UPDATE_INTERVAL_SECONDS = 4 * 60  # 4 minutes

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


@dataclass(frozen=True)
class UpdateLastJob:
    session_username: str
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


async def maybe_redis_subscribe_online(
    from_username: str,
    parsed_xml: etree._Element,
    redis_client: redis.Redis,
    pubsub: redis.client.PubSub,
) -> list[str]:
    if parsed_xml.tag != 'duo_subscribe_online':
        return []

    to_username = parsed_xml.attrib.get('uuid')

    if not to_username:
        return []

    from_id, to_id = (
            await fetch_id_from_username(from_username),
            await fetch_id_from_username(to_username))

    try:
        assert from_id is not None
        assert to_id is not None

        result  = []
        result += [FMT_SUB_OK.format(username=to_username)]
        result += [
            await _redis_subscribe_online(
                    redis_client=redis_client,
                    pubsub=pubsub,
                    username=to_username),
        ] if not await fetch_is_skipped(from_id=from_id, to_id=to_id) else []

        return result
    except:
        print(traceback.format_exc())
        return [FMT_SUB_BAD.format(username=to_username)]


async def maybe_redis_unsubscribe_online(
    parsed_xml: etree._Element,
    pubsub: redis.client.PubSub,
) -> list[str]:
    if parsed_xml.tag != 'duo_unsubscribe_online':
        return []

    username = parsed_xml.attrib.get('uuid')

    if not username:
        return []

    try:
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

    with api_tx('read committed') as tx:
        tx.executemany(Q_UPDATE_LAST, update_last_params_seq)


def update_last_once(session_username: str, do_update_last_event: bool):
    _batcher.enqueue(
        UpdateLastJob(
            session_username=session_username,
            do_update_last_event=do_update_last_event,
        )
    )


async def update_online_once(
    redis_client: redis.Redis,
    session: Session,
    online: bool,
    do_update_last_event: bool = False,
):
    if session.username is None:
        return

    update_last_once(
        session_username=session.username,
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
