from lxml import etree
import asyncio
import database
import duohash
import re
import websockets

# TODO: Push notifications, yay

Q_UNIQUENESS = """
INSERT INTO intro_hash (hash)
VALUES (%(hash)s)
ON CONFLICT DO NOTHING
RETURNING hash;
"""

# TODO: Delete
def log(*s):
    with open("/tmp/out", "a") as f:
        f.write(' '.join(map(str, s)) + '\n')

def get_message_attrs(message_str):
    try:
        # Create a safe XML parser
        parser = etree.XMLParser(resolve_entities=False, no_network=True)

        root = etree.fromstring(message_str, parser=parser)

        if root.tag != '{jabber:client}message':
            raise Exception('Not a message')

        if root.attrib.get('type') != 'chat':
            raise Exception('type != chat')

        check_uniqueness = root.attrib.get('check_uniqueness') == 'true'

        maybe_unique_text = None
        if check_uniqueness:
            body = root.find('{jabber:client}body')
            if body is not None and check_uniqueness:
                maybe_unique_text = body.text

        return (
            root.attrib.get('id'),
            maybe_unique_text,
            message_str)
    except Exception as e:
        pass

    return None, None, message_str

def normalize_message(message_str):
    message_str = message_str.lower()

    # Remove consecutive, trailing, and preceding whitespace
    message_str = ' '.join(message_str.split())

    # Remove everything but non-alphanumeric characters and spaces
    message_str = re.sub(r'[^a-z0-9 ]', '', message_str)

    # Remove characters 3 or more times. e.g. "Heeyyyyy :)" -> "Heeyy :)"
    message_str = re.sub(r'(.)\1{2,}', r'\1\1', message_str)

    return message_str

def is_message_unique(message_str):
    normalized = normalize_message(message_str)
    hashed = duohash.md5(normalized)

    params = dict(hash=hashed)

    with database.transaction('READ COMMITTED') as tx:
        if tx.execute(Q_UNIQUENESS, params).fetchall():
            return True
        else:
            return False

def process_duo_message(message_str):
    id, maybe_unique_text, to_dst = get_message_attrs(message_str)

    if id and maybe_unique_text and not is_message_unique(maybe_unique_text):
        return f'<duo_message_not_unique id="{id}"/>', None

    if id:
        return f'<duo_message_delivered id="{id}"/>', to_dst

    return None, to_dst

async def forward(src, dst):
    async for message in src:
        await dst.send(message)

async def process(src, dst):
    async for message in src:
        to_src, to_dst = process_duo_message(message)
        if to_dst:
            await dst.send(to_dst)
        if to_src:
            await src.send(to_src)

async def proxy(local_ws, path):
    async with websockets.connect('ws://127.0.0.1:5442') as remote_ws:
        l2r_task = asyncio.ensure_future(process(local_ws, remote_ws))
        r2l_task = asyncio.ensure_future(forward(remote_ws, local_ws))

        done, pending = await asyncio.wait(
            [l2r_task, r2l_task],
            return_when=asyncio.FIRST_COMPLETED,
        )

        for task in pending:
            task.cancel()

start_server = websockets.serve(proxy, '0.0.0.0', 5443)

asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
