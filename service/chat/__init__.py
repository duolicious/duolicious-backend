# TODO: Conversations need to be migrated
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


PORT = sys.argv[1] if len(sys.argv) >= 2 else 5443

# TODO: Lock down the XMPP server by only allowing certain types of message

Q_UNIQUENESS = """
INSERT INTO intro_hash (hash)
VALUES (%(hash)s)
ON CONFLICT DO NOTHING
RETURNING hash
"""

Q_IS_SKIPPED = """
WITH from_username AS (
    SELECT id FROM person WHERE uuid = %(from_username)s
), to_username AS (
    SELECT id FROM person WHERE uuid = %(to_username)s
)
SELECT
    1
FROM
    skipped
WHERE
    (
        subject_person_id = (SELECT id FROM from_username) AND
        object_person_id  = (SELECT id FROM to_username)
    )
OR
    (
        subject_person_id = (SELECT id FROM to_username) AND
        object_person_id  = (SELECT id FROM from_username)
    )
LIMIT 1
"""

Q_SET_MESSAGED = """
WITH subject_person_id AS (
    SELECT
        id
    FROM
        person
    WHERE
        uuid = %(subject_person_id)s
), object_person_id AS (
    SELECT
        id
    FROM
        person
    WHERE
        uuid = %(object_person_id)s
), can_insert AS (
    SELECT
        1
    WHERE
        EXISTS (SELECT 1 FROM subject_person_id)
    AND EXISTS (SELECT 1 FROM object_person_id)
), insertion AS (
    INSERT INTO messaged (
        subject_person_id,
        object_person_id
    )
    SELECT
        (SELECT id FROM subject_person_id),
        (SELECT id FROM object_person_id)
    WHERE EXISTS (
        SELECT
            1
        FROM
            can_insert
    )
    ON CONFLICT DO NOTHING
)
SELECT
    1
FROM
    can_insert
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

MAX_MESSAGE_LEN = 5000

NON_ALPHANUMERIC_RE = regex.compile(r'[^\p{L}\p{N}]')
REPEATED_CHARACTERS_RE = regex.compile(r'(.)\1{1,}')

class Username:
    def __init__(self):
        self.username = None

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

        do_check_uniqueness = root.attrib.get('check_uniqueness') == 'true'

        maybe_message_body = root.find('{jabber:client}body')

        maybe_message_body = None
        body = root.find('{jabber:client}body')
        if body is not None:
            maybe_message_body = body.text

        _id = root.attrib.get('id')
        assert _id is not None

        to = root.attrib.get('to')
        assert to is not None

        return (True, _id, to, do_check_uniqueness, maybe_message_body)
    except Exception as e:
        pass

    return False, None, None, None, None

def normalize_message(message_str):
    message_str = message_str.lower()

    # Remove everything but non-alphanumeric characters
    message_str = NON_ALPHANUMERIC_RE.sub('', message_str)

    # Remove repeated characters
    message_str = REPEATED_CHARACTERS_RE.sub(r'\1', message_str)

    return message_str

def is_message_too_long(message_str):
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

        async with chat_tx() as tx:
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
        async with chat_tx() as tx:
            cursor = await tx.execute(Q_UNIQUENESS, params)
            rows = await cursor.fetchall()
            return bool(rows)
    except:
        print(traceback.format_exc())
    return True

async def is_message_blocked(username, to_jid):
    try:
        from_username = username
        to_username = to_jid.split('@')[0]

        params = dict(
            from_username=from_username,
            to_username=to_username,
        )

        async with api_tx() as tx:
            cursor = await tx.execute(Q_IS_SKIPPED, params)
            fetched = await cursor.fetchall()
            return bool(fetched)
    except:
        print(traceback.format_exc())
        return True

    return False

async def set_messaged(username, to_jid):
    from_username = username
    to_username = to_jid.split('@')[0]

    params = dict(
        subject_person_id=from_username,
        object_person_id=to_username,
    )

    try:
        async with api_tx() as tx:
            cursor = await tx.execute(Q_SET_MESSAGED, params)
            rows = await cursor.fetchall()
            return bool(rows)
    except:
        pass

    return False

def process_auth(message_str, username):
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

async def process_duo_message(message_xml, username):
    if await maybe_register(message_xml, username):
        return ['<duo_registration_successful />'], []

    (
        is_message,
        id,
        to_jid,
        do_check_uniqueness,
        maybe_message_body,
    ) = get_message_attrs(message_xml)

    if not is_message:
        return [], [message_xml]

    if maybe_message_body and is_message_too_long(maybe_message_body):
        return [f'<duo_message_too_long id="{id}"/>'], []

    if await is_message_blocked(username, to_jid):
        return [f'<duo_message_blocked id="{id}"/>'], []

    if maybe_message_body and do_check_uniqueness and \
            not await is_message_unique(maybe_message_body):
        return [f'<duo_message_not_unique id="{id}"/>'], []

    if await set_messaged(username, to_jid):
        return (
            [
                f'<duo_message_delivered id="{id}"/>'
            ],
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

    return [], []

async def process(src, dst, username):
    try:
        async for message in src:
            process_auth(message, username)
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
        l2r_task = asyncio.ensure_future(process(local_ws, remote_ws, username))
        r2l_task = asyncio.ensure_future(forward(remote_ws, local_ws))

        done, pending = await asyncio.wait(
            [l2r_task, r2l_task],
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
