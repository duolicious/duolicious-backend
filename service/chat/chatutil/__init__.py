from async_lru_cache import AsyncLruCache
from database.asyncdatabase import api_tx
from lxml import etree
from typing import Literal
import datetime


LSERVER = 'duolicious.app'

FMT_ISO_8601_TIMESTAMP = '%Y-%m-%dT%H:%M:%S.%fZ'


Q_IS_SKIPPED = """
SELECT
    1
FROM
    skipped
WHERE
    subject_person_id = %(from_id)s AND object_person_id  = %(to_id)s
OR
    subject_person_id = %(to_id)s   AND object_person_id  = %(from_id)s
"""


Q_FETCH_PERSON_ID = """
SELECT id FROM person WHERE uuid = uuid_or_null(%(username)s)
"""


Q_FETCH_HAS_GOLD = """
SELECT has_gold FROM person WHERE uuid = uuid_or_null(%(username)s)
"""


Q_FETCH_IS_SHADOW_BANNED = """
SELECT shadow_banned_at FROM person WHERE id = %(person_id)s
"""


Q_FETCH_IS_PUBLIC = """
SELECT public_profile FROM person WHERE id = %(person_id)s
"""


def build_element(
    tag: str,
    text: str | None = None,
    attrib: dict | None = None,
    ns: str | None = None
) -> etree._Element:
    """
    Helper function to create an XML element.
    """
    element = etree.Element(tag)

    if ns is not None:
        element.set('xmlns', ns)

    for key, value in (attrib or {}).items():
        element.set(key, value)

    if text is not None:
        element.text = text

    return element


def format_timestamp(microseconds: int) -> str:
    """
    Converts a timestamp in microseconds to an ISO 8601 string.
    """
    timestamp_sec = microseconds / 1e6  # Convert microseconds to seconds
    dt = datetime.datetime.utcfromtimestamp(timestamp_sec)
    return dt.strftime(FMT_ISO_8601_TIMESTAMP)


def format_datetime(dt: datetime.datetime) -> str:
    """
    Converts a datetime to an ISO 8601 string in UTC. Naive datetimes (e.g. the
    `TIMESTAMP` columns, which store UTC) are assumed to be in UTC.
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=datetime.timezone.utc)
    return dt.astimezone(datetime.timezone.utc).strftime(FMT_ISO_8601_TIMESTAMP)


def to_bare_jid(jid: str | None):
    if jid is None:
        return None

    try:
        return jid.split('@')[0]
    except:
        return None


def message_string_to_etree(
    to_username: str,
    from_username: str,
    id: str,
    type: Literal['chat', 'typing'] = 'chat',
    message_body: str | None = None,
    audio_uuid: str | None = None,
) -> etree._Element:
    message_etree = build_element(
        'message',
        attrib={
            'from': f'{from_username}@{LSERVER}',
            'to': f'{to_username}@{LSERVER}',
            'id': id,
            'type': type,
        } | ({
            'audio_uuid': audio_uuid
        } if audio_uuid else {

        }),
        ns='jabber:client',
    )

    if message_body is not None:
        body = build_element('body', text=message_body)

        request = build_element(
            'request',
            ns='urn:xmpp:receipts'
        )

        message_etree.extend([body, request])

    return message_etree


@AsyncLruCache(ttl=5)  # 5 seconds
async def fetch_is_skipped(from_id: int, to_id: int) -> bool:
    async with api_tx('read committed') as tx:
        await tx.execute(Q_IS_SKIPPED, dict(from_id=from_id, to_id=to_id))
        row = await tx.fetchone()

    return bool(row)


@AsyncLruCache()
async def fetch_id_from_username(username: str) -> int | None:
    async with api_tx('read committed') as tx:
        await tx.execute(Q_FETCH_PERSON_ID, dict(username=username))
        row = await tx.fetchone()

    return row.get('id') if row else None


@AsyncLruCache(ttl=5)  # 5 seconds
async def fetch_is_shadow_banned(person_id: int) -> bool:
    async with api_tx('read committed') as tx:
        await tx.execute(Q_FETCH_IS_SHADOW_BANNED, dict(person_id=person_id))
        row = await tx.fetchone()

    return bool(row and row.get('shadow_banned_at'))


@AsyncLruCache(ttl=5)  # 5 seconds
async def fetch_is_public(person_id: int) -> bool:
    async with api_tx('read committed') as tx:
        await tx.execute(Q_FETCH_IS_PUBLIC, dict(person_id=person_id))
        row = await tx.fetchone()

    return bool(row and row.get('public_profile'))


@AsyncLruCache(ttl=60)  # 60 seconds
async def fetch_has_gold(username: str) -> bool:
    async with api_tx('read committed') as tx:
        await tx.execute(Q_FETCH_HAS_GOLD, dict(username=username))
        row = await tx.fetchone()

    return bool(row and row.get('has_gold'))


def read_receipt_stanza(
    from_username: str,
    to_username: str,
    stamp: str | None = None,
) -> str:
    message = build_element(
        'message',
        attrib={
            'from': f'{from_username}@{LSERVER}',
            'to': f'{to_username}@{LSERVER}',
            'type': 'read-receipt',
        },
        ns='jabber:client',
    )

    message.append(
        build_element(
            'displayed',
            attrib={'stamp': stamp} if stamp else {},
            ns='urn:xmpp:chat-markers:0',
        )
    )

    return etree.tostring(message, encoding='unicode', pretty_print=False)
