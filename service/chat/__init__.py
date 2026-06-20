import os
from database.asyncdatabase import api_tx, check_connections_forever
import asyncio
import duohash
import regex
import traceback
import sys
from websockets.exceptions import ConnectionClosedError
import notify
from async_lru_cache import AsyncLruCache
import random
from collections.abc import Iterable, Mapping
from typing import Tuple, Callable, Tuple
from datetime import datetime, timezone
from service.chat.robot9000 import Q_SELECT_INTRO_HASH, upsert_intro_hash
from service.chat.mayberegister import maybe_register
from service.chat.spam import is_spam_message
from service.chat.upsertlastnotification import upsert_last_notification
from service.chat.xmlparse import parse_xml_or_none
from service.chat.messagestorage.inbox import (
    maybe_get_inbox,
    maybe_mark_displayed,
)
from service.chat.messagestorage.mam import maybe_get_conversation
from service.chat.messagestorage import store_message
from service.chat.session import (
    Session,
    maybe_get_session_response,
)
from service.chat.online import (
    maybe_redis_subscribe_online,
    maybe_redis_unsubscribe_online,
    update_online_once,
    update_online_forever,
)
from service.chat.ratelimit import (
    maybe_fetch_rate_limit,
)
from lxml import etree
from service.chat.chatutil import (
    fetch_is_skipped,
    fetch_is_shadow_banned,
    fetch_has_gold,
    format_timestamp,
    message_string_to_etree,
    read_receipt_stanza,
    to_bare_jid,
    fetch_id_from_username,
)
from service.chat.message import (
    AudioMessage,
    ChatMessage,
    Message,
    TypingMessage,
    xml_to_message,
)
from service.chat.audiomessage import (
    transcode_and_put,
)
import redis.asyncio as redis
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
import xmltodict
import json
from constants import (
    MAX_NOTIFICATION_LENGTH,
)
from util import truncate_text
from service.chat.verification import (
    FMT_VERIFICATION_REQUIRED,
    verification_required,
)

app = FastAPI()

# Global publisher connection, created once per worker.
REDIS_HOST: str = os.environ.get("DUO_REDIS_HOST", "redis")
REDIS_PORT: int = int(os.environ.get("DUO_REDIS_PORT", 6379))
REDIS_WORKER_CLIENT: redis.Redis = redis.Redis(
        host=REDIS_HOST,
        port=REDIS_PORT,
        decode_responses=True)

InputMiddleware = Callable[[str], etree._Element | None]
OutputMiddleware = Callable[[str], str]
Middleware = Tuple[InputMiddleware, OutputMiddleware]

Q_HAS_MESSAGE = """
SELECT
    1
FROM
    messaged
WHERE
    subject_person_id = %(to_id)s AND object_person_id = %(from_id)s
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
)
SELECT
    person.id AS person_id,
    person.uuid::TEXT AS person_uuid,
    person.name AS name,
    photo.uuid AS photo_uuid,
    photo.blurhash AS photo_blurhash
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

Q_SELECT_PUSH_TOKENS = """
WITH session_summary AS (
    SELECT
        ARRAY_AGG(DISTINCT duo_session.push_token)
            FILTER (WHERE duo_session.push_token IS NOT NULL) AS push_tokens,
        MAX(duo_session.last_online_time)
            FILTER (WHERE duo_session.push_token IS NULL) AS web_last_online,
        MAX(duo_session.last_online_time)
            FILTER (WHERE duo_session.push_token IS NOT NULL) AS mobile_last_online
    FROM
        duo_session
    JOIN
        person
    ON
        person.id = duo_session.person_id
    WHERE
        person.uuid = uuid_or_null(%(username)s)
    AND
        duo_session.signed_in
)
SELECT
    unnest(push_tokens) AS token
FROM
    session_summary
WHERE
    -- A web session being strictly more recent means we defer the whole
    -- notification to the cron, which pushes *and* emails. Pushing here would
    -- upsert the last-notification time and suppress that email. Ties favour
    -- mobile, matching the cron's web-vs-mobile comparison.
    NOT COALESCE(web_last_online > mobile_last_online, FALSE)
"""

MAX_MESSAGE_LEN = 5000

NON_ALPHANUMERIC_RE = regex.compile(r'[^\p{L}\p{N}]')
REPEATED_CHARACTERS_RE = regex.compile(r'(.)\1{1,}')


async def redis_publish(channel: str, message: str) -> None:
    await REDIS_WORKER_CLIENT.publish(channel, message)


async def redis_publish_many(channel: str, messages: Iterable[str]) -> object | None:
    for message in messages:
        await redis_publish(channel, message)
    return None


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
    data: object,
) -> None:
    if from_name is None:
        return None

    if to_username is None:
        return

    if message is None:
        return

    if data is None:
        return

    to_tokens = await fetch_push_tokens(username=to_username)

    # No device is reachable by push notification. Leave the last-notification
    # time untouched so the cron job falls back to emailing the user.
    if not to_tokens:
        return

    truncated_message = truncate_text(message, MAX_NOTIFICATION_LENGTH)

    for to_token in to_tokens:
        notify.enqueue_mobile_notification(
            token=to_token,
            title=f"{from_name} sent you a message",
            body=truncated_message,
            data=data,
        )

    upsert_last_notification(username=to_username, is_intro=is_intro)


def normalize_message(message_str: str) -> str:
    message_str = message_str.lower()

    # Remove everything but non-alphanumeric characters
    message_str = NON_ALPHANUMERIC_RE.sub('', message_str)

    # Remove repeated characters
    message_str = REPEATED_CHARACTERS_RE.sub(r'\1', message_str)

    return message_str


def is_text_too_long(message: Message) -> bool:
    if isinstance(message, ChatMessage):
        return len(message.body) > MAX_MESSAGE_LEN
    else:
        return False


def is_ping(parsed_xml: object) -> bool:
    return getattr(parsed_xml, 'tag', None) == 'duo_ping'


def estimated_used_count(measured_count: int, ramp_at: int = 3333) -> int:
    # TODO: When this is removed, the tests should be updated
    #
    # intro_hash tracking started after the app launched, so raw counts are
    # under-estimates; prorate to approximate what the true count would be.
    if measured_count <= 1:
        return measured_count

    app_launched = datetime(2023, 8, 26, 1, 5, 49, tzinfo=timezone.utc)
    intro_hash_counting_started = datetime(2026, 6, 3, 1, 18, 0, tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)

    seconds_since_app_launched = (
            now - app_launched).total_seconds()

    seconds_since_intro_hash_counting = (
            now - intro_hash_counting_started).total_seconds()

    prorating = seconds_since_app_launched / seconds_since_intro_hash_counting

    prorating_certainty = max(0, min(1, measured_count / ramp_at))

    return round(
            measured_count * (1 - prorating_certainty) +
            measured_count * (0 + prorating_certainty) * prorating)


def _positive_count(count: object) -> bool:
    return isinstance(count, int) and count > 0


@AsyncLruCache(ttl=1, cache_condition=_positive_count)
async def intro_use_count(message: Message) -> int:
    if isinstance(message, AudioMessage):
        return 0

    if isinstance(message, TypingMessage):
        return 0

    normalized = normalize_message(message.body)
    hashed = duohash.md5(normalized)

    params = dict(hash=hashed)

    async with api_tx('read committed') as tx:
        cursor = await tx.execute(Q_SELECT_INTRO_HASH, params)
        row = await cursor.fetchone()

    upsert_intro_hash(hashed)

    return row['used_count'] if row is not None else 0

@AsyncLruCache(cache_condition=lambda x: not x)
async def fetch_is_intro(from_id: int, to_id: int) -> bool:
    async with api_tx('read committed') as tx:
        await tx.execute(Q_HAS_MESSAGE, dict(from_id=from_id, to_id=to_id))
        row = await tx.fetchone()

    return not bool(row)

@AsyncLruCache(ttl=5)  # 5 seconds
async def fetch_is_trusted_account(from_id: int) -> bool:
    async with api_tx('read committed') as tx:
        await tx.execute(
                Q_IS_TRUSTED_ACCOUNT,
                dict(from_id=from_id))
        row = await tx.fetchone()

    return bool(row)

@AsyncLruCache(ttl=2 * 60)  # 2 minutes
async def fetch_push_tokens(username: str) -> list[str]:
    async with api_tx('read committed') as tx:
        await tx.execute(Q_SELECT_PUSH_TOKENS, dict(username=username))
        rows = await tx.fetchall()

    return list({_row_str(row, 'token') for row in rows})

@AsyncLruCache(ttl=10)  # 10 seconds
async def fetch_immediate_data(
    from_id: int,
    to_id: int,
    is_intro: bool,
) -> Mapping[str, object] | None:
    q = Q_IMMEDIATE_INTRO_DATA if is_intro else Q_IMMEDIATE_CHAT_DATA

    async with api_tx('read committed') as tx:
        await tx.execute(q, dict(from_id=from_id, to_id=to_id))
        row = await tx.fetchone()

    return row if row else None

def _row_str(row: Mapping[str, object], key: str) -> str:
    value = row[key]
    if not isinstance(value, str):
        raise RuntimeError(f'{key} must be a string')
    return value


def _row_str_or_none(row: Mapping[str, object], key: str) -> str | None:
    value = row[key]
    if value is None or isinstance(value, str):
        return value
    raise RuntimeError(f'{key} must be a string or None')


def get_middleware(subprotocol: str) -> Middleware:
    if subprotocol == 'json':
        def input_middleware(text: str) -> etree._Element | None:
            json_data = json.loads(text)
            xml_str = xmltodict.unparse(json_data, full_document=False)
            return parse_xml_or_none(xml_str)

        def output_middleware(text: str) -> str:
            if text == '</stream:stream>':
                return '{"stream": null}'

            dict_obj = xmltodict.parse(text)
            return json.dumps(dict_obj)
    else:
        def input_middleware(text: str) -> etree._Element | None:
            return parse_xml_or_none(text)

        def output_middleware(text: str) -> str:
            return text

    return input_middleware, output_middleware

async def process_text(
    session: Session,
    middleware: InputMiddleware,
    pubsub: redis.client.PubSub,
    text: str
) -> object | None:
    from_username = session.username
    connection_uuid = session.connection_uuid

    parsed_xml = middleware(text)

    if parsed_xml is None:
        return None

    maybe_session_response = await maybe_get_session_response(
            parsed_xml, session)

    if maybe_session_response:
        return await redis_publish_many(connection_uuid, maybe_session_response)

    if is_ping(parsed_xml):
        return await redis_publish_many(connection_uuid, [
            '<duo_pong preferred_interval="10000" preferred_timeout="5000" />',
        ])

    # Online-status subscriptions are handled before the authentication gate so
    # that logged-out viewers can see the online status of public profiles. The
    # subscription handler itself restricts unauthenticated viewers to profiles
    # which have opted in to `public_profile`.
    maybe_subscription = await maybe_redis_subscribe_online(
            from_username=from_username,
            parsed_xml=parsed_xml,
            redis_client=REDIS_WORKER_CLIENT,
            pubsub=pubsub,
            session=session)
    if maybe_subscription:
        return await redis_publish_many(connection_uuid, maybe_subscription)

    maybe_unsubscription = await maybe_redis_unsubscribe_online(
            parsed_xml=parsed_xml,
            pubsub=pubsub,
            session=session)
    if maybe_unsubscription:
        return await redis_publish_many(connection_uuid, maybe_unsubscription)

    if not from_username:
        return None

    if maybe_register(parsed_xml, session.session_token_hash):
        return await redis_publish_many(connection_uuid, [
            '<duo_registration_successful />'
        ])

    maybe_conversation = await maybe_get_conversation(parsed_xml, from_username)
    if maybe_conversation:
        return await redis_publish_many(connection_uuid, maybe_conversation)

    maybe_inbox = await maybe_get_inbox(parsed_xml, from_username)
    if maybe_inbox:
        return await redis_publish_many(connection_uuid, maybe_inbox)

    displayed_to = await maybe_mark_displayed(parsed_xml, from_username)
    if displayed_to:
        # Nudge the original sender that their messages were read, but only if
        # they're a gold user (only gold users can view read receipts). The
        # nudge carries no timestamp: the client stamps it with its own clock,
        # and the authoritative read time is served from the database when the
        # conversation is fetched from the archive. The sender may receive more
        # than one nudge for the same message (e.g. on re-open); the client
        # ignores nudges that don't acknowledge a newer outgoing message.
        #
        # A shadow-banned reader's activity must stay invisible to others, so
        # the nudge is suppressed for them (their own read state is still
        # updated above, so their app behaves normally).
        reader_id = await fetch_id_from_username(from_username)
        if \
                reader_id is not None and \
                not await fetch_is_shadow_banned(reader_id) and \
                await fetch_has_gold(displayed_to):
            await redis_publish_many(displayed_to, [
                read_receipt_stanza(
                    from_username=from_username,
                    to_username=displayed_to,
                )
            ])
        return None

    maybe_message = xml_to_message(parsed_xml)

    if not maybe_message:
        return None

    stanza_id = maybe_message.stanza_id

    to_username = maybe_message.to_username

    from_id = await fetch_id_from_username(from_username)

    if not from_id:
        return None

    to_id = await fetch_id_from_username(to_username)

    if not to_id:
        return None

    # Shadow-banned senders perceive the app as normal -- validation runs as
    # usual and their own client/storage behave normally -- but nothing they
    # send reaches the recipient: no real-time delivery, push notification, or
    # recipient-side storage. Their own copy (MAM + chats list) is still stored
    # so their conversation history persists when they navigate back to it.
    is_shadow_banned = await fetch_is_shadow_banned(from_id)

    if await verification_required(person_id=from_id):
        return await redis_publish_many(connection_uuid, [
            FMT_VERIFICATION_REQUIRED.format(stanza_id=stanza_id)
        ])

    if await fetch_is_skipped(from_id=from_id, to_id=to_id):
        return await redis_publish_many(connection_uuid, [
            f'<duo_message_blocked id="{stanza_id}"/>'
        ])

    if isinstance(maybe_message, TypingMessage):
        # A shadow-banned sender's typing indicator must not reach the recipient.
        if is_shadow_banned:
            return None

        return await redis_publish_many(to_username, [
            etree.tostring(
                message_string_to_etree(
                    to_username=to_username,
                    from_username=from_username,
                    id=maybe_message.stanza_id,
                    type='typing',
                ),
                encoding='unicode',
                pretty_print=False,
            )
        ])

    if is_text_too_long(maybe_message):
        return await redis_publish_many(connection_uuid, [
            f'<duo_message_too_long id="{stanza_id}"/>'
        ])

    is_intro = await fetch_is_intro(from_id=from_id, to_id=to_id)

    if \
            is_intro and \
            is_spam_message(maybe_message) and \
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

    used_count = await intro_use_count(maybe_message) if is_intro else 0
    if is_intro and used_count > 0:
        return await redis_publish_many(connection_uuid, [
            f'<duo_message_not_unique id="{stanza_id}" used_count="{estimated_used_count(used_count)}"/>'
        ])

    # The same instant is used to stamp the stored message and the delivery
    # receipt, so the sender's client can timestamp its own message in server
    # time (rather than its possibly-skewed local clock). This keeps read
    # receipts, which are compared against this timestamp, accurate.
    sent_at_microseconds = int(datetime.now().timestamp() * 1_000_000)
    sent_at_stamp = format_timestamp(sent_at_microseconds)

    async def store_audio_and_notify() -> None:
        if \
                isinstance(maybe_message, AudioMessage) and \
                not transcode_and_put(
                    uuid=maybe_message.audio_uuid,
                    audio_base64=maybe_message.audio_base64,
                ):
            await redis_publish_many(connection_uuid, [
                f'<duo_server_error id="{stanza_id}"/>'
            ])
            return None

        audio_uuid = (
                maybe_message.audio_uuid
                if isinstance(maybe_message, AudioMessage)
                else None)

        sanitized_xml = etree.tostring(
            message_string_to_etree(
                to_username=to_username,
                from_username=from_username,
                id=maybe_message.stanza_id,
                message_body=maybe_message.body,
                audio_uuid=audio_uuid,
            ),
            encoding='unicode',
            pretty_print=False)

        immediate_data = await fetch_immediate_data(
                from_id=from_id,
                to_id=to_id,
                is_intro=is_intro)

        if immediate_data is not None and not is_shadow_banned:
            await send_notification(
                from_name=_row_str_or_none(immediate_data, 'name'),
                to_username=to_username,
                message=maybe_message.body,
                is_intro=is_intro,
                data={
                    'screen': 'Conversation Screen',
                    'params': {
                        'personId': immediate_data['person_id'],
                        'personUuid': immediate_data['person_uuid'],
                        'name': immediate_data['name'],

                        'photoUuid': immediate_data['photo_uuid'],
                        'photoBlurhash': immediate_data['photo_blurhash'],

                        # TODO: Deprecate these fields
                        'imageUuid': immediate_data['photo_uuid'],
                        'imageBlurhash': immediate_data['photo_blurhash'],
                    },
                },
            )

        if isinstance(maybe_message, AudioMessage):
            response = (
                f'<duo_message_delivered '
                f'id="{stanza_id}" '
                f'audio_uuid="{maybe_message.audio_uuid}" '
                f'stamp="{sent_at_stamp}" '
            ).strip() + '/>'
        else:
            response = (
                f'<duo_message_delivered '
                f'id="{stanza_id}" '
                f'stamp="{sent_at_stamp}" '
            ).strip() + '/>'

        # Don't deliver to the recipient when the sender is shadow-banned; the
        # sender still gets their delivery receipt below.
        if not is_shadow_banned:
            await redis_publish_many(to_username, [sanitized_xml])

        await redis_publish_many(connection_uuid, [response])

    store_message(
        from_username=from_username,
        to_username=to_username,
        from_id=from_id,
        to_id=to_id,
        msg_id=stanza_id,
        message=maybe_message,
        deliver_to_recipient=not is_shadow_banned,
        callback=store_audio_and_notify,
        timestamp_microseconds=sent_at_microseconds)
    return None


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
    update_online_task = None

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

            if not update_online_task and session.username:
                update_online_task = asyncio.create_task(
                    update_online_forever(
                        redis_client=REDIS_WORKER_CLIENT,
                        session=session,
                        online=True
                    )
                )


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
        if update_online_task:
            update_online_task.cancel()

            try:
                await update_online_task
            except asyncio.CancelledError:
                pass

            try:
                await update_online_once(
                    redis_client=REDIS_WORKER_CLIENT,
                    session=session,
                    online=False,
                )
            except asyncio.CancelledError:
                pass

        if redis_forward_to_websocket_task:
            redis_forward_to_websocket_task.cancel()
            try:
                await redis_forward_to_websocket_task
            except asyncio.CancelledError:
                pass

        await pubsub.close()
        await redis_websocket_client.close()
