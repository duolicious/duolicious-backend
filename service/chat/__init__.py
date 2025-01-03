from database.asyncdatabase import api_tx, chat_tx, check_connections_forever
import asyncio
import base64
import duohash
import regex
import traceback
import websockets
import sys
from websockets.exceptions import ConnectionClosedError
import notify
from sql import *
from async_lru_cache import AsyncLruCache
import random
from typing import Any, Optional
from datetime import datetime
from service.chat.insertintrohash import insert_intro_hash
from service.chat.mayberegister import maybe_register
from service.chat.rude import is_rude
from service.chat.setmessaged import set_messaged
from service.chat.spam import is_spam
from service.chat.updatelast import update_last_forever
from service.chat.upsertlastnotification import upsert_last_notification
from service.chat.username import Username
from service.chat.xmlparse import parse_xml_or_none
from service.chat.inbox import (
    maybe_get_inbox,
    maybe_mark_displayed,
    upsert_conversation,
)
from duohash import sha512
from lxml import etree
from enum import Enum


PORT = sys.argv[1] if len(sys.argv) >= 2 else 5443

class IntroRateLimit(Enum):
    NONE = 0
    UNVERIFIED = 20
    BASICS = 40
    PHOTOS = 100

# TODO: Tables to migrate to monolithic DB:
#
#  public.last
#  public.mam_message
#  public.mam_server_user
#  public.inbox
#  public.mongoose_cluster_id
#  public.intro_hash
#  public.duo_last_notification
#  public.duo_push_token

Q_CHECK_AUTH = """
SELECT
    1
FROM
    duo_session
WHERE
    session_token_hash = %(session_token_hash)s
"""

Q_SELECT_INTRO_HASH = """
SELECT
    1
FROM
    intro_hash
WHERE
    hash = %(hash)s
"""

Q_FETCH_PERSON_ID = """
SELECT id FROM person WHERE uuid = %(username)s
"""

Q_IS_SKIPPED = """
SELECT
    1
FROM
    skipped
WHERE
    subject_person_id = %(from_id)s AND object_person_id  = %(to_id)s
OR
    subject_person_id = %(to_id)s   AND object_person_id  = %(from_id)s
LIMIT 1
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

Q_RATE_LIMIT_REASON = f"""
WITH truncated_daily_message AS (
    SELECT
        1
    FROM
        messaged AS m1
    WHERE
        m1.subject_person_id = %(from_id)s
    AND
        m1.created_at >= NOW() - INTERVAL '24 HOURS'
    AND
        NOT EXISTS (
            SELECT
                1
            FROM
                messaged AS m2
            WHERE
                m2.subject_person_id = m1.object_person_id
            AND
                m2.object_person_id = m1.subject_person_id
            AND
                m2.created_at < m1.created_at
        )
    LIMIT
        {max(x.value for x in IntroRateLimit)}
), truncated_daily_message_count AS (
    SELECT COUNT(*) AS x FROM truncated_daily_message
)
SELECT
    CASE

    WHEN verification_level_id = 3 AND x >= {IntroRateLimit.PHOTOS.value}
    THEN                                    {IntroRateLimit.PHOTOS.value}

    WHEN verification_level_id = 2 AND x >= {IntroRateLimit.BASICS.value}
    THEN                                    {IntroRateLimit.BASICS.value}

    WHEN verification_level_id = 1 AND x >= {IntroRateLimit.UNVERIFIED.value}
    THEN                                    {IntroRateLimit.UNVERIFIED.value}

    ELSE                                    {IntroRateLimit.NONE.value}

    END AS rate_limit_reason
FROM
    person,
    truncated_daily_message_count
WHERE
    id = %(from_id)s
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

def to_bare_jid(jid: str | None):
    try:
        return jid.split('@')[0]
    except:
        return None

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

        if parsed_xml.attrib.get('type') != 'chat':
            raise Exception('type != chat')

        maybe_message_body = parsed_xml.find('{jabber:client}body')

        maybe_message_body = None
        body = parsed_xml.find('{jabber:client}body')
        if body is not None:
            maybe_message_body = body.text.strip()

        _id = parsed_xml.attrib.get('id')
        assert _id is not None
        assert len(_id) <= 250

        to = parsed_xml.attrib.get('to')
        assert to is not None

        return True, _id, to, maybe_message_body
    except Exception as e:
        pass

    return False, None, None, None

def normalize_message(message_str):
    message_str = message_str.lower()

    # Remove everything but non-alphanumeric characters
    message_str = NON_ALPHANUMERIC_RE.sub('', message_str)

    # Remove repeated characters
    message_str = REPEATED_CHARACTERS_RE.sub(r'\1', message_str)

    return message_str

def is_xml_too_long(xml_str):
    return len(xml_str) > MAX_MESSAGE_LEN + 1000

def is_message_too_long(message_str):
    return len(message_str) > MAX_MESSAGE_LEN

def is_ping(parsed_xml):
    try:
        return parsed_xml.tag == 'duo_ping'
    except:
        return False

async def process_auth(parsed_xml, username):
    if username.username is not None:
        return False

    try:
        # Create a safe XML parser
        if parsed_xml.tag != '{urn:ietf:params:xml:ns:xmpp-sasl}auth':
            return False

        base64encoded = parsed_xml.text
        decodedBytes = base64.b64decode(base64encoded)
        decodedString = decodedBytes.decode('utf-8')

        _, auth_username, auth_token = decodedString.split('\0')

        auth_token_hash = sha512(auth_token)

        params = dict(session_token_hash=auth_token_hash)
        async with api_tx('read committed') as tx:
            await tx.execute(Q_CHECK_AUTH, params)
            assert await tx.fetchone()

        username.username = auth_username

        return True
    except Exception as e:
        pass

    return False

@AsyncLruCache(maxsize=1024, cache_condition=lambda x: not x)
async def is_message_unique(message_str):
    normalized = normalize_message(message_str)
    hashed = duohash.md5(normalized)

    params = dict(hash=hashed)

    async with chat_tx('read committed') as tx:
        cursor = await tx.execute(Q_SELECT_INTRO_HASH, params)
        rows = await cursor.fetchall()

    is_unique = not bool(rows)

    if is_unique:
        insert_intro_hash(hashed)

    return is_unique

@AsyncLruCache(maxsize=1024)
async def fetch_id_from_username(username: str) -> str | None:
    async with api_tx('read committed') as tx:
        await tx.execute(Q_FETCH_PERSON_ID, dict(username=username))
        row = await tx.fetchone()

    return row.get('id') if row else None

@AsyncLruCache(maxsize=1024, ttl=5)  # 5 seconds
async def fetch_is_skipped(from_id: int, to_id: int) -> bool:
    async with api_tx('read committed') as tx:
        await tx.execute(Q_IS_SKIPPED, dict(from_id=from_id, to_id=to_id))
        row = await tx.fetchone()

    return bool(row)

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

@AsyncLruCache(maxsize=1024, ttl=5)  # 5 seconds
async def fetch_rate_limit_reason(from_id: int) -> IntroRateLimit:
    async with api_tx('read committed') as tx:
        await tx.execute(Q_RATE_LIMIT_REASON, dict(from_id=from_id))
        row = await tx.fetchone()

    return IntroRateLimit(row['rate_limit_reason'])

@AsyncLruCache(ttl=2 * 60)  # 2 minutes
async def fetch_push_token(username: str) -> str | None:
    async with chat_tx('read committed') as tx:
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

async def process_duo_message(
    xml_str: str,
    parsed_xml: etree._Element,
    username: Optional[str],
):
    if is_xml_too_long(xml_str):
        return [], []

    if is_ping(parsed_xml):
        return [
            '<duo_pong preferred_interval="10000" preferred_timeout="5000" />',
        ], []

    if maybe_register(parsed_xml, username):
        return ['<duo_registration_successful />'], []

    if not username:
        return [], [xml_str]

    maybe_inbox = await maybe_get_inbox(parsed_xml, username)
    if maybe_inbox:
        return maybe_inbox, []

    if maybe_mark_displayed(parsed_xml, username):
        return [], []

    is_message, id, to_jid, maybe_message_body = get_message_attrs(parsed_xml)

    from_username = username
    to_username = to_bare_jid(to_jid)

    if not is_message:
        return [], [xml_str]

    if not maybe_message_body:
        return [], [xml_str]

    if is_message_too_long(maybe_message_body):
        return [f'<duo_message_too_long id="{id}"/>'], []

    from_id = await fetch_id_from_username(from_username)

    if not from_id:
        return [], [xml_str]

    to_id = await fetch_id_from_username(to_username)

    if not to_id:
        return [], [xml_str]

    if await fetch_is_skipped(from_id=from_id, to_id=to_id):
        return [f'<duo_message_blocked id="{id}"/>'], []

    is_intro = await fetch_is_intro(from_id=from_id, to_id=to_id)

    if is_intro and not await is_message_unique(maybe_message_body):
        return [f'<duo_message_not_unique id="{id}"/>'], []

    if is_intro and is_rude(maybe_message_body):
        return [f'<duo_message_blocked id="{id}" reason="offensive"/>'], []

    if \
            is_intro and \
            is_spam(maybe_message_body) and \
            not await fetch_is_trusted_account(from_id=from_id):
        return [f'<duo_message_blocked id="{id}" reason="spam"/>'], []

    if is_intro:
        rate_limit_reason = await fetch_rate_limit_reason(from_id=from_id)

        if rate_limit_reason == IntroRateLimit.NONE:
            pass
        elif rate_limit_reason == IntroRateLimit.UNVERIFIED:
            return [
                    f'<duo_message_blocked id="{id}" '
                    f'reason="rate-limited-1day" '
                    f'subreason="unverified-basics"/>'], []
        elif rate_limit_reason == IntroRateLimit.BASICS:
            return [
                    f'<duo_message_blocked id="{id}" '
                    f'reason="rate-limited-1day" '
                    f'subreason="unverified-photos"/>'], []
        elif rate_limit_reason == IntroRateLimit.PHOTOS:
            return [
                    f'<duo_message_blocked id="{id}" '
                    f'reason="rate-limited-1day"/>'], []
        else:
            raise Exception(f'Unhandled rate limit reason {rate_limit_reason}')

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

    set_messaged(from_id=from_id, to_id=to_id)

    upsert_conversation(
        from_username=from_username,
        to_username=to_username,
        msg_id=id,
        content=xml_str)

    return [f'<duo_message_delivered id="{id}"/>'], [xml_str]


async def process(src, dst, username):
    # asyncio.create_task requires some manual memory management!
    # https://docs.python.org/3/library/asyncio-task.html#asyncio.create_task
    # https://github.com/python/cpython/issues/91887
    update_last_task = None

    try:
        async for message in src:
            parsed_xml = parse_xml_or_none(message)

            if await process_auth(parsed_xml, username):
                update_last_task = asyncio.create_task(
                        update_last_forever(username))

            to_src, to_dst = await process_duo_message(
                    message,
                    parsed_xml,
                    username.username)

            for m in to_dst:
                await dst.send(m)
            for m in to_src:
                await src.send(m)
    except:
        print(
            datetime.utcnow(),
            f"Exception while processing for username: {username.username}"
        )
        print(traceback.format_exc())
    finally:
        await src.close()
        await dst.close()
        if update_last_task:
            update_last_task.cancel()
        print("Connections closed in process()")


async def forward(src, dst, username):
    try:
        async for message in src:
            await dst.send(message)
    except:
        print(
            datetime.utcnow(),
            f"Exception while forwarding for user {username.username}:"
        )
        print(traceback.format_exc())
    finally:
        await src.close()
        await dst.close()
        print("Connections closed in forward()")

async def proxy(local_ws):
    username = Username()

    async with websockets.connect(
            'ws://127.0.0.1:5442',
            ping_timeout=60 * 3, # 3 minutes
            ) as remote_ws:
        l2r_task = asyncio.create_task(process(local_ws, remote_ws, username))
        r2l_task = asyncio.create_task(forward(remote_ws, local_ws, username))

        done, pending = await asyncio.wait(
            [l2r_task, r2l_task],
            return_when=asyncio.FIRST_COMPLETED,
        )

        for task in pending:
            task.cancel()

async def serve():
    async with websockets.serve(
            proxy,
            '0.0.0.0',
            PORT,
            subprotocols=['xmpp'],
            ping_timeout=60 * 3, # 3 minutes
            ):
        await asyncio.Future()


async def main():
    await asyncio.gather(
        serve(),
        check_connections_forever(),
    )

if __name__ == '__main__':
    asyncio.run(main())
