from database.asyncdatabase import api_tx, chat_tx, check_connections_forever
from lxml import etree
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
from typing import Any

notify.set_flush_interval(1.0)

PORT = sys.argv[1] if len(sys.argv) >= 2 else 5443

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

Q_UNIQUENESS = """
INSERT INTO intro_hash (hash)
VALUES (%(hash)s)
ON CONFLICT DO NOTHING
RETURNING hash
"""

Q_SET_TOKEN = """
INSERT INTO duo_push_token (username, token)
VALUES (
    %(username)s,
    %(token)s
)
ON CONFLICT (username)
DO UPDATE SET
    token = EXCLUDED.token
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
    subject_person_id
FROM
    messaged
WHERE
    subject_person_id = %(to_id)s AND object_person_id = %(from_id)s
LIMIT 1
"""

Q_SET_MESSAGED = """
INSERT INTO messaged (
    subject_person_id,
    object_person_id
) VALUES (
    %(from_id)s,
    %(to_id)s
) ON CONFLICT DO NOTHING
"""

Q_IMMEDIATE_DATA = """
WITH from_data AS (
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
    ORDER BY
        photo.position
    LIMIT 1
), to_notification AS (
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
    *
FROM
    from_data
WHERE
    EXISTS (SELECT 1 FROM to_notification)
LIMIT 1
"""

Q_IMMEDIATE_INTRO_DATA = Q_IMMEDIATE_DATA.replace('[[type]]', 'intros')

Q_IMMEDIATE_CHAT_DATA = Q_IMMEDIATE_DATA.replace('[[type]]', 'chats')

Q_UPSERT_LAST_NOTIFICATION = """
INSERT INTO duo_last_notification (
    username,
    [[type]]_seconds
) VALUES (
    %(username)s,
    extract(epoch from now())::int
)
ON CONFLICT (username) DO UPDATE SET
    [[type]]_seconds = EXCLUDED.[[type]]_seconds
"""

Q_UPSERT_LAST_INTRO_NOTIFICATION = Q_UPSERT_LAST_NOTIFICATION.replace('[[type]]', 'intro')

Q_UPSERT_LAST_CHAT_NOTIFICATION = Q_UPSERT_LAST_NOTIFICATION.replace('[[type]]', 'chat')

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

LAST_UPDATE_INTERVAL_SECONDS = 4 * 60

class Username:
    def __init__(self):
        self.username = None

def to_bare_jid(jid: str | None):
    try:
        return jid.split('@')[0]
    except:
        return None

async def update_last(
    username: Username,
    min_random_delay: int = 0,
    max_random_delay: int = 0,
):
    if username is None:
        return

    if username.username is None:
        return

    if min_random_delay and max_random_delay:
        await asyncio.sleep(random.randint(min_random_delay, max_random_delay))

    try:
        async with chat_tx('read committed') as tx:
            await tx.execute(Q_UPSERT_LAST, dict(person_uuid=username.username))
    except:
        print(traceback.format_exc())

async def update_last_forever(username: Username):
    while True:
        await asyncio.sleep(
                LAST_UPDATE_INTERVAL_SECONDS + random.randint(-10, 10))
        await update_last(username)

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

    await upsert_last_notification(username=to_username, is_intro=is_intro)

def parse_xml(s):
    parser = etree.XMLParser(resolve_entities=False, no_network=True)
    return etree.fromstring(s, parser=parser)

def get_message_attrs(message_xml):
    try:
        # Create a safe XML parser
        root = parse_xml(message_xml)

        if root.tag != '{jabber:client}message':
            raise Exception('Not a message')

        if root.attrib.get('type') != 'chat':
            raise Exception('type != chat')

        maybe_message_body = root.find('{jabber:client}body')

        maybe_message_body = None
        body = root.find('{jabber:client}body')
        if body is not None:
            maybe_message_body = body.text

        _id = root.attrib.get('id')
        assert _id is not None

        to = root.attrib.get('to')
        assert to is not None

        return (True, _id, to, maybe_message_body)
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

def is_message_too_long(message_str):
    # TODO: Enforce this limit on XMPP server
    return len(message_str) > MAX_MESSAGE_LEN

async def maybe_register(message_xml, username):
    if not username:
        return False

    try:
        # Create a safe XML parser
        root = parse_xml(message_xml)

        if root.tag != 'duo_register_push_token':
            raise Exception('Not a duo_register_push_token message')

        token = root.attrib.get('token')

        if not token:
            raise Exception('Token not set in duo_register_push_token')

        params = dict(
            username=username,
            token=token,
        )

        async with chat_tx('read committed') as tx:
            await tx.execute(Q_SET_TOKEN, params)

        return True
    except Exception as e:
        pass

    return False

def process_auth(message_str, username):
    if username.username is not None:
        return False

    try:
        # Create a safe XML parser
        root = parse_xml(message_str)

        if root.tag != '{urn:ietf:params:xml:ns:xmpp-sasl}auth':
            return False

        base64encoded = root.text
        decodedBytes = base64.b64decode(base64encoded)
        decodedString = decodedBytes.decode('utf-8')

        auth_parts = decodedString.split('\0')

        auth_username = auth_parts[1]

        username.username = auth_username

        return True
    except Exception as e:
        pass

    return False

@AsyncLruCache(maxsize=1024, ttl=60)  # 1 minute
async def upsert_last_notification(username: str, is_intro: bool) -> None:
    q = (
            Q_UPSERT_LAST_INTRO_NOTIFICATION
            if is_intro
            else Q_UPSERT_LAST_CHAT_NOTIFICATION)

    async with chat_tx('read committed') as tx:
        await tx.execute(q, dict(username=username))

@AsyncLruCache(maxsize=1024, cache_condition=lambda x: not x)
async def is_message_unique(message_str):
    normalized = normalize_message(message_str)
    hashed = duohash.md5(normalized)

    params = dict(hash=hashed)

    async with chat_tx('read committed') as tx:
        cursor = await tx.execute(Q_UNIQUENESS, params)
        rows = await cursor.fetchall()

    return bool(rows)

@AsyncLruCache(maxsize=1024)
async def fetch_id_from_username(username: str) -> str | None:
    async with api_tx('read committed') as tx:
        await tx.execute(Q_FETCH_PERSON_ID, dict(username=username))
        row = await tx.fetchone()

    return row.get('id')

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

@AsyncLruCache(maxsize=1024)
async def set_messaged(from_id: int, to_id: int) -> None:
    async with api_tx('read committed') as tx:
        await tx.execute(Q_SET_MESSAGED, dict(from_id=from_id, to_id=to_id))

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

async def process_duo_message(message_xml, username: str | None):
    if await maybe_register(message_xml, username):
        return ['<duo_registration_successful />'], []

    is_message, id, to_jid, maybe_message_body = get_message_attrs(message_xml)

    from_username = username
    to_username = to_bare_jid(to_jid)

    if not is_message:
        return [], [message_xml]

    if not maybe_message_body:
        return [], []

    if is_message_too_long(maybe_message_body):
        return [f'<duo_message_too_long id="{id}"/>'], []

    from_id = await fetch_id_from_username(from_username)

    if not from_id:
        return [], [message_xml]

    to_id = await fetch_id_from_username(to_username)

    if not to_id:
        return [], [message_xml]

    if await fetch_is_skipped(from_id=from_id, to_id=to_id):
        return [f'<duo_message_blocked id="{id}"/>'], []

    is_intro = await fetch_is_intro(from_id=from_id, to_id=to_id)
    if is_intro and not await is_message_unique(maybe_message_body):
        return [f'<duo_message_not_unique id="{id}"/>'], []

    immediate_data = await fetch_immediate_data(
            from_id=from_id,
            to_id=to_id,
            is_intro=is_intro)

    if immediate_data is not None:
        asyncio.create_task(
            send_notification(
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
        )

    await set_messaged(from_id=from_id, to_id=to_id)

    return  (
        [f'<duo_message_delivered id="{id}"/>'],
        [
            message_xml,
            f"<iq id='{duohash.duo_uuid()}' type='set'>"
            f"  <query"
            f"    xmlns='erlang-solutions.com:xmpp:inbox:0#conversation'"
            f"    jid='{to_jid}'"
            f"  >"
            f"    <box>chats</box>"
            f"  </query>"
            f"</iq>"
        ]
    )

async def process(src, dst, username):
    try:
        async for message in src:
            if process_auth(message, username):
                asyncio.create_task(update_last(username, 1, 10))

            to_src, to_dst = await process_duo_message(message, username.username)

            for m in to_dst:
                await dst.send(m)
            for m in to_src:
                await src.send(m)
    except ConnectionClosedError as e:
        print("Connection closed while processing:", e)
    except Exception as e:
        print("Error processing messages:", e)
    finally:
        await src.close()
        await dst.close()
        print("Connections closed in process()")

async def forward(src, dst):
    try:
        async for message in src:
            await dst.send(message)
    except ConnectionClosedError:
        print("Connection closed while forwarding")
    except Exception as e:
        print("Error forwarding messages:", e)
    finally:
        await src.close()
        await dst.close()
        print("Connections closed in forward()")

async def proxy(local_ws, path):
    username = Username()

    async with websockets.connect('ws://127.0.0.1:5442') as remote_ws:
        l2r_task = asyncio.create_task(process(local_ws, remote_ws, username))
        r2l_task = asyncio.create_task(forward(remote_ws, local_ws))
        last_task = asyncio.create_task(update_last_forever(username))

        done, pending = await asyncio.wait(
            [l2r_task, r2l_task, last_task],
            return_when=asyncio.FIRST_COMPLETED,
        )

        for task in pending:
            task.cancel()

async def serve():
    async with websockets.serve(proxy, '0.0.0.0', PORT, subprotocols=['xmpp']):
        await asyncio.Future()


async def main():
    await asyncio.gather(
        serve(),
        check_connections_forever(),
    )

asyncio.run(main())
