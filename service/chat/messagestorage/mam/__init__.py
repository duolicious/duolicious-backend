import re
from dataclasses import dataclass
from lxml import etree
from typing import Callable
from database import asyncdatabase
import database
import erlastic
from service.chat.chatutil import (
    LSERVER,
    build_element,
    message_string_to_etree,
    to_bare_jid,
)
from service.chat.chatutil.erlang import (
    etree_to_term,
    term_to_etree,
)
import datetime
import uuid
from async_lru_cache import AsyncLruCache
from service.chat.message import (
    ChatMessage,
    AudioMessage,
)


Q_INSERT_MESSAGE = """
INSERT INTO
    mam_message (
        id,
        from_jid,
        remote_bare_jid,
        direction,
        message,
        audio_uuid,
        search_body,
        person_id
    )
VALUES
    (
        %(id)s,
        '', -- from_jid is ignored
        %(to_username)s,
        'O',
        %(message)s,
        %(audio_uuid)s,
        %(search_body)s,
        (SELECT id FROM person WHERE uuid = uuid_or_null(%(from_username)s))
    ),

    (
        %(id)s + 1,
        '', -- from_jid is ignored
        %(from_username)s,
        'I',
        %(message)s,
        %(audio_uuid)s,
        %(search_body)s,
        (SELECT id FROM person WHERE uuid = uuid_or_null(%(to_username)s))
    )
"""


Q_SELECT_MESSAGE = f"""
WITH page AS (
    SELECT
        mam_message.id,
        mam_message.message,
        mam_message.audio_uuid
    FROM
        mam_message
    JOIN
        person
    ON
        person.id = mam_message.person_id
    WHERE
        person.uuid = %(from_username)s
    AND
        mam_message.remote_bare_jid = %(to_username)s
    AND (
        mam_message.id < %(before_id)s OR %(before_id)s IS NULL
    )
    ORDER BY
        mam_message.id DESC
    LIMIT
        LEAST(50, COALESCE(%(max)s, 50))
)
SELECT
    *
FROM
    page
ORDER BY
    id
"""


@dataclass(frozen=True)
class Query:
    query_id: str
    from_username: str
    to_username: str
    before: str | None
    max: str | None


@dataclass(frozen=True)
class StoreMamMessageJob:
    timestamp_microseconds: int
    from_username: str
    to_username: str
    id: str
    message_body: str
    audio_uuid: str | None


def _process_query(
    parsed_xml: etree._Element | None,
    from_username: str
) -> Query | None:
    if parsed_xml is None:
        return None

    query_id = parsed_xml.xpath(
        "string(.//*[local-name()='query']/@queryid)"
    )

    to_username = parsed_xml.xpath(
        "string(.//*[local-name()='field'][@var='with']/*[local-name()='value'])"
    )

    before_value = parsed_xml.xpath(
        "string(.//*[local-name()='before'])"
    )

    max_value = parsed_xml.xpath(
        "string(.//*[local-name()='max'])"
    )

    if not query_id or not to_username:
        return None

    return Query(
        query_id=str(query_id),
        from_username=to_bare_jid(from_username),
        to_username=to_bare_jid(str(to_username)),
        before=str(before_value) if before_value else None,
        max=str(max_value) if max_value else None,
    )


def _forwarded_element(
    query: Query,
    row_id: int,
    forwarded_id: str,
    message: etree._Element,
) -> etree._Element:
    delay = build_element(
        'delay',
        attrib={
            'stamp': mam_message_id_to_timestamp(row_id),
        },
        ns='urn:xmpp:delay',
    )

    forwarded = build_element(
        'forwarded',
        ns='urn:xmpp:forward:0'
    )

    forwarded.extend([delay, message])

    result = build_element(
        'result',
        attrib=dict(
            queryid=query.query_id,
            id=integer_to_binary(row_id, 32),
        ),
        ns='urn:xmpp:mam:2'
    )

    result.extend([forwarded])

    forwarded_message = build_element(
        'message',
        attrib={
            # From and to are the same because the iq query was made by
            # `from_username`, and the result is being sent back to them
            'from': f'{query.from_username}@{LSERVER}',
            'to': f'{query.from_username}@{LSERVER}',
            'id': forwarded_id,
        },
        ns='jabber:client',
    )

    forwarded_message.extend([result])

    return forwarded_message


async def maybe_get_conversation(
    parsed_xml: etree._Element | None,
    from_username: str,
) -> list[str]:
    if parsed_xml is None:
        return []

    query = _process_query(parsed_xml, from_username=from_username)

    if not query:
        return []

    return await _get_conversation(
        query=query,
        from_username=from_username,
        to_username=to_bare_jid(query.to_username)
    )


def process_store_mam_message_batch(tx, batch: list[StoreMamMessageJob]):
    params_seq = [
        dict(
            id=microseconds_to_mam_message_id(message.timestamp_microseconds),
            to_username=message.to_username,
            from_username=message.from_username,
            message=erlastic.encode(
                etree_to_term(
                    message_string_to_etree(
                        message_body=message.message_body,
                        to_username=message.to_username,
                        from_username=message.from_username,
                        id=message.id,
                    )
                )
            ),
            audio_uuid=message.audio_uuid,
            search_body=normalize_search_text(message.message_body),
        )
        for message in batch
    ]

    tx.executemany(Q_INSERT_MESSAGE, params_seq)


async def _get_conversation(
    query: Query,
    from_username: str,
    to_username: str
) -> list[str]:
    before_id = (
            binary_to_integer(bytes(query.before, 'utf-8'), 32)
            if query.before
            else None)

    params = dict(
        from_username=from_username,
        to_username=to_username,
        before_id=before_id,
        max=query.max,
    )

    async with asyncdatabase.api_tx('read committed') as tx:
        await tx.execute(Q_SELECT_MESSAGE, params)
        rows = await tx.fetchall()

    messages = []
    for row in rows:
        row_id = row['id']
        message_binary = row['message']
        audio_uuid = row['audio_uuid']

        try:
            message_term = erlastic.decode(message_binary)
            message_etree = term_to_etree(message_term)
            if audio_uuid:
                message_etree.set('audio_uuid', audio_uuid)
        except Exception as e:
            continue

        forwarded_etree = _forwarded_element(
            query=query,
            row_id=row_id,
            forwarded_id=str(uuid.uuid4()),
            message=message_etree,
        )

        messages.append(
                etree.tostring(
                    forwarded_etree, encoding='unicode', pretty_print=False))


    iq_element = build_element(
            'iq',
            attrib={
                # From and to are the same because the iq query was made by
                # `from_username`, and the result is being sent back to them
                'from': f'{query.from_username}@{LSERVER}',
                'to': f'{query.from_username}@{LSERVER}',
                'id': query.query_id,
                'type': 'result'
            },
            ns='jabber:client')

    iq_element.append(
            build_element(
                'fin',
                ns='urn:xmpp:mam:2'))

    messages.append(
            etree.tostring(
                iq_element, encoding='unicode', pretty_print=False))

    return messages


def microseconds_to_mam_message_id(microseconds: int):
    return microseconds << 8


def mam_message_id_to_microseconds(mam_message_id: int):
    return mam_message_id >> 8


def microseconds_to_timestamp(microseconds):
    # Convert microseconds to seconds.
    seconds = microseconds / 1_000_000
    # Create a UTC datetime object.
    dt = datetime.datetime.utcfromtimestamp(seconds)
    # Format the datetime to the desired ISO 8601 format with microseconds and a
    # trailing 'Z'.
    return dt.strftime('%Y-%m-%dT%H:%M:%S.%fZ')


def mam_message_id_to_timestamp(id: int):
    return microseconds_to_timestamp(mam_message_id_to_microseconds(id))


def integer_to_binary(number: int, base: int) -> bytes:
    if not (2 <= base <= 36):
        raise ValueError("Base must be between 2 and 36")

    # Special case for 0
    if number == 0:
        return b"0"

    digits = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    sign = "-" if number < 0 else ""
    number = abs(number)

    result = []
    while number:
        number, rem = divmod(number, base)
        result.append(digits[rem])

    return (sign + "".join(reversed(result))).encode("ascii")


def binary_to_integer(binary: bytes, base: int) -> int:
    """
    Converts a binary (bytes) representation to an integer in the given base.
    Equivalent to Erlang's `binary_to_integer/2`.
    """
    if not (2 <= base <= 36):
        raise ValueError("Base must be between 2 and 36")
    return int(binary.decode(), base)


def normalize_search_text(text: str | None) -> str | None:
    if text is None:
        return None

    # Convert to lowercase
    lower_body = text.lower()

    # Step 1: Replace certain punctuations with a single space
    re0 = re.sub(r"[,.:;\-?!]+", " ", lower_body, flags=re.UNICODE)

    # Step 2: Remove non-word characters except whitespace
    # (allowing tabs, newlines, carriage returns, etc.)
    re1 = re.sub(r"[^\w\s]+", "", re0, flags=re.UNICODE)

    # Step 3: Replace multiple whitespace characters (spaces, tabs, newlines, etc.)
    # with a single space and trim any leading/trailing spaces.
    re2 = re.sub(r"\s+", " ", re1, flags=re.UNICODE).strip()

    return re2
