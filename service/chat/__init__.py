import os
from database.asyncdatabase import api_tx, check_connections_forever
import asyncio
import duohash
import regex
import traceback
import websockets
import sys
from websockets.exceptions import ConnectionClosedError
import notify
from async_lru_cache import AsyncLruCache
import random
from typing import Any, Optional, Tuple, Callable, Tuple, Iterable
from datetime import datetime
from service.chat.insertintrohash import insert_intro_hash
from service.chat.mayberegister import maybe_register
from service.chat.rude import is_rude
from service.chat.setmessaged import set_messaged
from service.chat.spam import is_spam
from service.chat.updatelast import update_last_forever
from service.chat.upsertlastnotification import upsert_last_notification
from service.chat.xmlparse import parse_xml_or_none
from service.chat.inbox import (
    maybe_get_inbox,
    maybe_mark_displayed,
    upsert_conversation,
)
from service.chat.mam import (
    maybe_get_conversation,
    store_message,
)
from service.chat.session import (
    Session,
    maybe_get_session_response,
)
from service.chat.online import (
    redis_publish_online,
    maybe_redis_subscribe_online,
    maybe_redis_unsubscribe_online,
)
from service.chat.ratelimit import (
    maybe_fetch_rate_limit,
)
from lxml import etree
from service.chat.util import (
    fetch_is_skipped,
    message_string_to_etree,
    to_bare_jid,
    fetch_id_from_username,
)
import uuid
import redis.asyncio as redis
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
import xmltodict
import json

app = FastAPI()

# Global publisher connection, created once per worker.
REDIS_HOST: str = os.environ.get("DUO_REDIS_HOST", "redis")
REDIS_PORT: int = int(os.environ.get("DUO_REDIS_PORT", 6379))
REDIS_WORKER_CLIENT: Optional[redis.Redis] = redis.Redis(
        host=REDIS_HOST,
        port=REDIS_PORT,
        decode_responses=True)

InputMiddleware = Callable[[str], Tuple[str, Optional[etree.Element]]]
OutputMiddleware = Callable[[str], str]
Middleware = Tuple[InputMiddleware, OutputMiddleware]

Q_SELECT_INTRO_HASH = """
SELECT
    1
FROM
    intro_hash
WHERE
    hash = %(hash)s
"""

Q_HAS_MESSAGE = """
SELECT
    1
FROM
    messaged
WHERE
    subject_person_id = %(to_id)s AND object_person_id = %(from_id)s
LIMIT 1
"""

# Accounts are trusted after they've been around for a day. Verified accounts
# are trusted a bit sooner.
Q_IS_TRUSTED_ACCOUNT = """
SELECT
    1
FROM
    person
WHERE
    id = %(from_id)s
AND
    sign_up_time < now() - (interval '1 day') / power(verification_level_id, 2)
"""

Q_IMMEDIATE_DATA = """
WITH to_notification AS (
    SELECT
        1
    FROM
        person
    WHERE
        id = %(to_id)s
    AND
        [[type]]_notification = 1 -- Immediate notification ID
    LIMIT 1
)
SELECT
    person.id AS person_id,
    person.uuid::TEXT AS person_uuid,
    person.name AS name,
    photo.uuid AS image_uuid,
    photo.blurhash AS image_blurhash
FROM
    person
LEFT JOIN
    photo
ON
    photo.person_id = person.id
WHERE
    id = %(from_id)s
AND
    EXISTS (SELECT 1 FROM to_notification)
ORDER BY
    photo.position
LIMIT 1
"""

Q_IMMEDIATE_INTRO_DATA = Q_IMMEDIATE_DATA.replace('[[type]]', 'intros')

Q_IMMEDIATE_CHAT_DATA = Q_IMMEDIATE_DATA.replace('[[type]]', 'chats')

Q_SELECT_PUSH_TOKEN = """
SELECT
    token
FROM
    duo_push_token
WHERE
    username = %(username)s::TEXT
"""

MAX_MESSAGE_LEN = 5000

NON_ALPHANUMERIC_RE = regex.compile(r'[^\p{L}\p{N}]')
REPEATED_CHARACTERS_RE = regex.compile(r'(.)\1{1,}')


async def redis_publish(channel: str, message: str):
    await REDIS_WORKER_CLIENT.publish(channel, message)


async def redis_publish_many(channel: str, messages: Iterable[str]):
    for message in messages:
        await redis_publish(channel, message)


async def redis_forward_to_websocket(
    pubsub: redis.client.PubSub,
    middleware: OutputMiddleware,
    websocket: WebSocket
) -> None:
    """
    Listens on the Redis subscription channel and forwards any messages
    to the connected websocket client.
    """
    try:
        async for message in pubsub.listen():
            if message is None or message.get("type") != "message":
                continue

            try:
                data = middleware(message['data'])
            except:
                continue

            await websocket.send_text(data)
    except asyncio.CancelledError:
        raise
    except:
        print(traceback.format_exc())


async def send_notification(
    from_name: str | None,
    to_username: str | None,
    message: str | None,
    is_intro: bool,
    data: Any,
):
    if from_name is None:
        return

    if to_username is None:
        return

    if message is None:
        return

    if data is None:
        return

    to_token = await fetch_push_token(username=to_username)

    if to_token is None:
        return

    max_notification_length = 128

    truncated_message = message[:max_notification_length] + (
            '...' if len(message) > max_notification_length else '')

    notify.enqueue_mobile_notification(
        token=to_token,
        title=f"{from_name} sent you a message",
        body=truncated_message,
        data=data,
    )

    upsert_last_notification(username=to_username, is_intro=is_intro)

def get_message_attrs(parsed_xml):
    try:
        if parsed_xml.tag != '{jabber:client}message':
            raise Exception('Not a message')

        message_type = parsed_xml.attrib.get('type')
        assert message_type in ('chat', 'typing')

        body = parsed_xml.find('{jabber:client}body')

        maybe_message_body = (
                None
                if body is None or message_type == 'typing'
                else body.text.strip())

        assert maybe_message_body or message_type == 'typing'

        _id = parsed_xml.attrib.get('id')
        assert _id is not None
        assert len(_id) <= 250

        to_jid = parsed_xml.attrib.get('to')

        to_bare_jid_ = to_bare_jid(parsed_xml.attrib.get('to'))

        to_username = str(uuid.UUID(to_bare_jid_))

        return _id, to_username, maybe_message_body
    except Exception as e:
        pass

    return None

def normalize_message(message_str):
    message_str = message_str.lower()

    # Remove everything but non-alphanumeric characters
    message_str = NON_ALPHANUMERIC_RE.sub('', message_str)

    # Remove repeated characters
    message_str = REPEATED_CHARACTERS_RE.sub(r'\1', message_str)

    return message_str

def is_text_too_long(text: str):
    return len(text) > MAX_MESSAGE_LEN

def is_ping(parsed_xml):
    try:
        return parsed_xml.tag == 'duo_ping'
    except:
        return False

@AsyncLruCache(maxsize=1024, cache_condition=lambda x: not x)
async def is_message_unique(message_str):
    normalized = normalize_message(message_str)
    hashed = duohash.md5(normalized)

    params = dict(hash=hashed)

    async with api_tx('read committed') as tx:
        cursor = await tx.execute(Q_SELECT_INTRO_HASH, params)
        rows = await cursor.fetchall()

    is_unique = not bool(rows)

    if is_unique:
        insert_intro_hash(hashed)

    return is_unique

@AsyncLruCache(maxsize=1024, cache_condition=lambda x: not x)
async def fetch_is_intro(from_id: int, to_id: int) -> bool:
    async with api_tx('read committed') as tx:
        await tx.execute(Q_HAS_MESSAGE, dict(from_id=from_id, to_id=to_id))
        row = await tx.fetchone()

    return not bool(row)

@AsyncLruCache(maxsize=1024, ttl=5)  # 5 seconds
async def fetch_is_trusted_account(from_id: int) -> bool:
    async with api_tx('read committed') as tx:
        await tx.execute(
                Q_IS_TRUSTED_ACCOUNT,
                dict(from_id=from_id))
        row = await tx.fetchone()

    return bool(row)

@AsyncLruCache(ttl=2 * 60)  # 2 minutes
async def fetch_push_token(username: str) -> str | None:
    async with api_tx('read committed') as tx:
        await tx.execute(Q_SELECT_PUSH_TOKEN, dict(username=username))
        row = await tx.fetchone()

    return row.get('token') if row else None

@AsyncLruCache(ttl=10)  # 10 seconds
async def fetch_immediate_data(from_id: int, to_id: int, is_intro: bool):
    q = Q_IMMEDIATE_INTRO_DATA if is_intro else Q_IMMEDIATE_CHAT_DATA

    async with api_tx('read committed') as tx:
        await tx.execute(q, dict(from_id=from_id, to_id=to_id))
        row = await tx.fetchone()

    return row if row else None

def get_middleware(subprotocol: str) -> Middleware:
    if subprotocol == 'json':
        def input_middleware(text: str):
            json_data = json.loads(text)
            xml_str = xmltodict.unparse(json_data, full_document=False)
            return xml_str, parse_xml_or_none(xml_str)

        def output_middleware(text: str):
            if text == '</stream:stream>':
                return '{"stream": null}'

            dict_obj = xmltodict.parse(text)
            return json.dumps(dict_obj)
    else:
        def input_middleware(text: str):
            xml_str = text
            return xml_str, parse_xml_or_none(xml_str)

        def output_middleware(text: str):
            return text

    return input_middleware, output_middleware

async def process_text(
    session: Session,
    middleware: InputMiddleware,
    pubsub: redis.client.PubSub,
    text: str
):
    from_username = session.username
    connection_uuid = session.connection_uuid

    if is_text_too_long(text):
        return await redis_publish_many(connection_uuid, [
            f'<duo_message_too_long />'
        ])

    xml_str, parsed_xml = middleware(text)

    if parsed_xml is None:
        return

    maybe_session_response = await maybe_get_session_response(
            parsed_xml, session)

    if maybe_session_response:
        return await redis_publish_many(connection_uuid, maybe_session_response)

    if is_ping(parsed_xml):
        return await redis_publish_many(connection_uuid, [
            '<duo_pong preferred_interval="10000" preferred_timeout="5000" />',
        ])

    if not from_username:
        return

    if maybe_register(parsed_xml, from_username):
        return await redis_publish_many(connection_uuid, [
            '<duo_registration_successful />'
        ])

    maybe_conversation = await maybe_get_conversation(parsed_xml, from_username)
    if maybe_conversation:
        return await redis_publish_many(connection_uuid, maybe_conversation)

    maybe_inbox = await maybe_get_inbox(parsed_xml, from_username)
    if maybe_inbox:
        return await redis_publish_many(connection_uuid, maybe_inbox)

    if maybe_mark_displayed(parsed_xml, from_username):
        return

    maybe_subscription = await maybe_redis_subscribe_online(
            from_username=from_username,
            parsed_xml=parsed_xml,
            redis_client=REDIS_WORKER_CLIENT,
            pubsub=pubsub)
    if maybe_subscription:
        return await redis_publish_many(connection_uuid, maybe_subscription)

    maybe_unsubscription = await maybe_redis_unsubscribe_online(
            parsed_xml=parsed_xml,
            pubsub=pubsub)
    if maybe_unsubscription:
        return await redis_publish_many(connection_uuid, maybe_unsubscription)

    maybe_message = get_message_attrs(parsed_xml)

    if maybe_message:
        stanza_id, to_username, maybe_message_body = maybe_message
    else:
        return

    from_id = await fetch_id_from_username(from_username)

    if not from_id:
        return

    to_id = await fetch_id_from_username(to_username)

    if not to_id:
        return

    if await fetch_is_skipped(from_id=from_id, to_id=to_id):
        return await redis_publish_many(connection_uuid, [
            f'<duo_message_blocked id="{stanza_id}"/>'
        ])

    if not maybe_message_body:
        return await redis_publish_many(to_username, [
            etree.tostring(
                message_string_to_etree(
                    to_username=to_username,
                    from_username=from_username,
                    id=str(uuid.uuid4()),
                    type='typing',
                ),
                encoding='unicode',
                pretty_print=False,
            )
        ])

    is_intro = await fetch_is_intro(from_id=from_id, to_id=to_id)

    if is_intro and is_rude(maybe_message_body):
        return await redis_publish_many(connection_uuid, [
            f'<duo_message_blocked id="{stanza_id}" reason="offensive"/>'
        ])

    if \
            is_intro and \
            is_spam(maybe_message_body) and \
            not await fetch_is_trusted_account(from_id=from_id):
        return await redis_publish_many(connection_uuid, [
            f'<duo_message_blocked id="{stanza_id}" reason="spam"/>'
        ])

    if is_intro:
        maybe_rate_limit = await maybe_fetch_rate_limit(
                from_id=from_id,
                stanza_id=stanza_id)

        if maybe_rate_limit:
            return await redis_publish_many(connection_uuid, maybe_rate_limit)

    if is_intro and not await is_message_unique(maybe_message_body):
        return await redis_publish_many(connection_uuid, [
            f'<duo_message_not_unique id="{stanza_id}"/>'
        ])

    # TODO: Updates to `mam_message` and `inbox` tables should happen in one tx
    store_message(
        maybe_message_body,
        from_username=from_username,
        to_username=to_username,
        msg_id=stanza_id)

    set_messaged(from_id=from_id, to_id=to_id)

    upsert_conversation(
        from_username=from_username,
        to_username=to_username,
        msg_id=stanza_id,
        content=xml_str)

    await redis_publish_many(to_username, [
        etree.tostring(
            message_string_to_etree(
                message_body=maybe_message_body,
                to_username=to_username,
                from_username=from_username,
                id=str(uuid.uuid4()),
            ),
            encoding='unicode',
            pretty_print=False,
        )
    ])


    immediate_data = await fetch_immediate_data(
            from_id=from_id,
            to_id=to_id,
            is_intro=is_intro)

    if immediate_data is not None:
        await send_notification(
            from_name=immediate_data['name'],
            to_username=to_username,
            message=maybe_message_body,
            is_intro=is_intro,
            data={
                'screen': 'Conversation Screen',
                'params': {
                    'personId': immediate_data['person_id'],
                    'personUuid': immediate_data['person_uuid'],
                    'name': immediate_data['name'],
                    'imageUuid': immediate_data['image_uuid'],
                    'imageBlurhash': immediate_data['image_blurhash'],
                },
            },
        )

    return await redis_publish_many(connection_uuid, [
        f'<duo_message_delivered id="{stanza_id}"/>'
    ])


@app.websocket("/")
async def process_websocket_messages(websocket: WebSocket) -> None:
    subprotocol_header = websocket.headers.get('sec-websocket-protocol')

    if subprotocol_header == 'json':
        subprotocol = 'json'
    else:
        subprotocol = 'xmpp'

    await websocket.accept(subprotocol=subprotocol)

    input_middleware, output_middleware = get_middleware(subprotocol)

    session = Session()

    redis_websocket_client: redis.Redis = redis.Redis(
            host=REDIS_HOST,
            port=REDIS_PORT,
            decode_responses=True)

    pubsub = redis_websocket_client.pubsub()

    await pubsub.subscribe(session.connection_uuid)

    # asyncio.create_task requires some manual memory management!
    # https://docs.python.org/3/library/asyncio-task.html#asyncio.create_task
    # https://github.com/python/cpython/issues/91887
    update_last_task = None

    redis_forward_to_websocket_task = asyncio.create_task(
            redis_forward_to_websocket(pubsub, output_middleware, websocket))

    is_subscribed_by_username = False

    try:
        while True:
            text = await websocket.receive_text()

            await asyncio.shield(
                    process_text(
                        session=session,
                        middleware=input_middleware,
                        pubsub=pubsub,
                        text=text))

            if not update_last_task and session.username:
                update_last_task = asyncio.create_task(
                        update_last_forever(session))

                await redis_publish_online(
                        redis_client=REDIS_WORKER_CLIENT,
                        username=session.username,
                        online=True)

            if not is_subscribed_by_username and session.username:
                await pubsub.subscribe(session.username)
                is_subscribed_by_username = True
    except WebSocketDisconnect:
        pass
    except asyncio.CancelledError:
        raise
    except:
        print(
            datetime.utcnow(),
            f"Exception while processing for username: {session.username}"
        )
        print(traceback.format_exc())
    finally:
        if update_last_task:
            update_last_task.cancel()
            try:
                await update_last_task
            except asyncio.CancelledError:
                pass


        if redis_forward_to_websocket_task:
            redis_forward_to_websocket_task.cancel()
            try:
                await redis_forward_to_websocket_task
            except asyncio.CancelledError:
                pass

        if session.username:
            try:
                await redis_publish_online(
                        redis_client=REDIS_WORKER_CLIENT,
                        username=session.username,
                        online=False)
            except asyncio.CancelledError:
                pass

        await pubsub.close()
        await redis_websocket_client.close()
