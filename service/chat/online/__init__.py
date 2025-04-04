from lxml import etree
import redis.asyncio as redis
import traceback
from service.chat.util import (
    fetch_is_skipped,
    fetch_id_from_username,
)


FMT_KEY = 'online-{username}'

FMT_ONLINE_EVENT = '<duo_online_event uuid="{username}" status="{status}" />'

FMT_SUB_OK  = '<duo_subscribe_successful uuid="{username}" />'
FMT_SUB_BAD = '<duo_subscribe_unsuccessful uuid="{username}" />'

FMT_UNSUB_OK  = '<duo_unsubscribe_successful uuid="{username}" />'
FMT_UNSUB_BAD = '<duo_unsubscribe_unsuccessful uuid="{username}" />'


async def _redis_subscribe_online(
    redis_client: redis.Redis,
    pubsub: redis.client.PubSub,
    username: str,
):
    key = FMT_KEY.format(username=username)
    val = await redis_client.get(key)

    await pubsub.subscribe(key)
    return val or FMT_ONLINE_EVENT.format(username=username, status='offline')


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
    status = 'online' if online else 'offline'

    key = FMT_KEY.format(username=username)
    val = FMT_ONLINE_EVENT.format(username=username, status=status)

    async with redis_client.pipeline(transaction=True) as pipe:
        pipe.publish(key, val)
        pipe.set(key, val, ex=604800)  # Expires in one week
        await pipe.execute()


async def maybe_redis_subscribe_online(
    from_username: str,
    parsed_xml: etree.Element,
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
    parsed_xml: etree.Element,
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
