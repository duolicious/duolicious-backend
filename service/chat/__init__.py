from lxml import etree
import asyncio
import database
import duohash
import re
import websockets
import base64

# TODO: Push notifications, yay
# TODO: async db ops
# TODO: Lock down the XMPP server by only allowing certain types of message

Q_UNIQUENESS = """
INSERT INTO intro_hash (hash)
VALUES (%(hash)s)
ON CONFLICT DO NOTHING
RETURNING hash
"""

Q_BLOCKED = """
SELECT
    1
FROM
    privacy_list
JOIN
    privacy_list_data
ON
    privacy_list_data.id = privacy_list.id
WHERE
    (server = 'duolicious.app' AND username = %(fromUsername)s AND value = %(toUsername)s   || '@duolicious.app')
OR
    (server = 'duolicious.app' AND username = %(toUsername)s   AND value = %(fromUsername)s || '@duolicious.app')
LIMIT
    1
"""

MAX_MESSAGE_LEN = 5000

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

        return (
            root.attrib.get('id'),
            root.attrib.get('to'),
            do_check_uniqueness,
            maybe_message_body)
    except Exception as e:
        pass

    return None, None, None, None

def normalize_message(message_str):
    message_str = message_str.lower()

    # Remove everything but non-alphanumeric characters
    message_str = re.sub(r'[^a-z0-9]', '', message_str)

    # Remove repeated characters
    message_str = re.sub(r'(.)\1{1,}', r'\1', message_str)

    return message_str

def is_message_too_long(message_str):
    return len(message_str) > MAX_MESSAGE_LEN

def is_message_unique(message_str):
    normalized = normalize_message(message_str)
    hashed = duohash.md5(normalized)

    params = dict(hash=hashed)

    with database.transaction('READ COMMITTED') as tx:
        if tx.execute(Q_UNIQUENESS, params).fetchall():
            return True
        else:
            return False

def is_message_blocked(username, toJid):
    try:
        fromUsername = username
        toUsername = toJid.split('@')[0]

        params = dict(
            fromUsername=fromUsername,
            toUsername=toUsername,
        )

        with database.transaction('READ COMMITTED') as tx:
            return bool(tx.execute(Q_BLOCKED, params).fetchall())
    except:
        return True

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

def process_duo_message(message_xml, username):
    id, toJid, do_check_uniqueness, maybe_message_body = get_message_attrs(
        message_xml)

    if id and maybe_message_body and is_message_too_long(maybe_message_body):
        return f'<duo_message_too_long id="{id}"/>', None

    if id and is_message_blocked(username, toJid):
        return f'<duo_message_blocked id="{id}"/>', None

    if id and maybe_message_body and do_check_uniqueness and \
            not is_message_unique(maybe_message_body):
        return f'<duo_message_not_unique id="{id}"/>', None

    if id:
        return f'<duo_message_delivered id="{id}"/>', message_xml

    return None, message_xml

async def process(src, dst, username):
    async for message in src:
        process_auth(message, username)

        undeliverable_message, deliverable_message = process_duo_message(
            message,
            username.username
        )

        if deliverable_message:
            await dst.send(deliverable_message)
        if undeliverable_message:
            await src.send(undeliverable_message)

async def forward(src, dst):
    async for message in src:
        await dst.send(message)

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

start_server = websockets.serve(proxy, '0.0.0.0', 5443, subprotocols=['xmpp'])

asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
