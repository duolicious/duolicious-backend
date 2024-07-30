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
from notify import send_mobile_notification
from sql import *

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

Q_API_MESSAGE = """
WITH from_id AS (
    SELECT id FROM person WHERE uuid = %(from_username)s
), to_id AS (
    SELECT id FROM person WHERE uuid = %(to_username)s
), participants_exist AS (
    SELECT
        EXISTS (SELECT 1 FROM from_id) AND
        EXISTS (SELECT 1 FROM to_id) AS participants_exist
), is_skipped AS (
    SELECT
        EXISTS (
            SELECT
                1
            FROM
                skipped
            WHERE
                (
                    subject_person_id = (SELECT id FROM from_id) AND
                    object_person_id  = (SELECT id FROM to_id)
                )
            OR
                (
                    subject_person_id = (SELECT id FROM to_id) AND
                    object_person_id  = (SELECT id FROM from_id)
                )
        ) AS is_skipped
), is_intro AS (
    SELECT
        NOT EXISTS (
            SELECT
                1
            FROM
                messaged
            WHERE
                object_person_id = (SELECT id FROM from_id) OR
                object_person_id = (SELECT id FROM to_id)
        ) AS is_intro
), set_messaged AS (
    INSERT INTO messaged (
        subject_person_id,
        object_person_id
    )
    SELECT
        (SELECT id FROM from_id),
        (SELECT id FROM to_id)
    WHERE
        (SELECT participants_exist FROM participants_exist)
    AND
        NOT (SELECT is_skipped FROM is_skipped)
    ON CONFLICT DO NOTHING
)
SELECT
    (
        SELECT name
        FROM person
        WHERE uuid = uuid_or_null(%(from_username)s::TEXT)
    ) AS from_name,

    CASE
    WHEN (SELECT is_intro FROM is_intro)
    THEN (
        SELECT intros_notification = 1
        FROM person WHERE uuid = uuid_or_null(%(to_username)s::TEXT))
    ELSE (
        SELECT chats_notification = 1
        FROM person WHERE uuid = uuid_or_null(%(to_username)s::TEXT))
    END AS is_immediate,

    (SELECT is_intro FROM is_intro) AS is_intro,

    (SELECT is_skipped FROM is_skipped) AS is_skipped
"""

Q_CHAT_MESSAGE = """
WITH select_duo_push_token AS (
    SELECT
        token
    FROM
        duo_push_token
    WHERE
        username = %(to_username)s::TEXT
), update_duo_last_notification AS (
    INSERT INTO
        duo_last_notification (username, chat_seconds)
    SELECT
        %(to_username)s,
        extract(epoch from now())::int
    WHERE
        EXISTS (SELECT 1 FROM select_duo_push_token)
    ON CONFLICT (username) DO UPDATE SET
        chat_seconds = EXCLUDED.chat_seconds
)
SELECT
    token
FROM
    select_duo_push_token
"""

MAX_MESSAGE_LEN = 5000

NON_ALPHANUMERIC_RE = regex.compile(r'[^\p{L}\p{N}]')
REPEATED_CHARACTERS_RE = regex.compile(r'(.)\1{1,}')

LAST_UPDATE_INTERVAL_SECONDS = 3 * 60

class Username:
    def __init__(self):
        self.username = None

def to_bare_jid(jid: str | None):
    try:
        return jid.split('@')[0]
    except:
        return None

async def update_last(username: Username):
    if username is None:
        return

    if username.username is None:
        return

    try:
        async with chat_tx('read committed') as tx:
            await tx.execute(Q_UPSERT_LAST, dict(person_uuid=username.username))
    except:
        print(traceback.format_exc())

async def update_last_forever(username: Username):
    while True:
        await update_last(username)
        await asyncio.sleep(LAST_UPDATE_INTERVAL_SECONDS)

async def send_notification(
    from_name: str | None,
    to_username: str | None,
    message: str | None
):
    if from_name is None:
        return

    if to_username is None:
        return

    if message is None:
        return

    params = dict(to_username=to_username)

    async with chat_tx('read committed') as tx:
        cursor = await tx.execute(Q_CHAT_MESSAGE, params)
        rows = await cursor.fetchone()
        to_token = rows['token'] if rows else None

    if to_token is None:
        return

    truncated_message = message[:1024]

    await asyncio.to_thread(
        send_mobile_notification,
        token=to_token,
        title=f"{from_name} sent you a message",
        body=truncated_message,
    )

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

async def is_message_unique(message_str):
    normalized = normalize_message(message_str)
    hashed = duohash.md5(normalized)

    params = dict(hash=hashed)

    try:
        async with chat_tx('read committed') as tx:
            cursor = await tx.execute(Q_UNIQUENESS, params)
            rows = await cursor.fetchall()
            return bool(rows)
    except:
        print(traceback.format_exc())
    return True

async def process_auth(message_str, username):
    if username.username is not None:
        return

    try:
        # Create a safe XML parser
        root = parse_xml(message_str)

        if root.tag != '{urn:ietf:params:xml:ns:xmpp-sasl}auth':
            raise Exception('Not an auth message')

        base64encoded = root.text
        decodedBytes = base64.b64decode(base64encoded)
        decodedString = decodedBytes.decode('utf-8')

        auth_parts = decodedString.split('\0')

        auth_username = auth_parts[1]

        username.username = auth_username
    except Exception as e:
        pass

    await update_last(username)

async def process_duo_message(message_xml, username):
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

    params = dict(
        from_username=from_username,
        to_username=to_username,
    )

    async with api_tx('read committed') as tx:
        await tx.execute(Q_API_MESSAGE, params)
        row = await tx.fetchone()

        from_name = row['from_name']
        is_immediate = row['is_immediate']
        is_intro = row['is_intro']
        is_skipped = row['is_skipped']

        params['is_intro'] = is_intro

    if is_skipped:
        return [f'<duo_message_blocked id="{id}"/>'], []

    if is_intro and not await is_message_unique(maybe_message_body):
        return [f'<duo_message_not_unique id="{id}"/>'], []

    if is_immediate:
        asyncio.create_task(
            send_notification(
                from_name=from_name,
                to_username=to_username,
                message=maybe_message_body,
            )
        )

    return  [f'<duo_message_delivered id="{id}"/>'], [message_xml]

async def process(src, dst, username):
    try:
        async for message in src:
            await process_auth(message, username)

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
