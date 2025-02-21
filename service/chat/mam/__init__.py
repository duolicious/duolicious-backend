import re
from dataclasses import dataclass
from lxml import etree
from typing import Optional, List
from batcher import Batcher
from database import asyncdatabase
import database
import erlastic
from service.chat.util import (
    LSERVER,
    build_element,
    message_string_to_etree,
    to_bare_jid,
)
from service.chat.util.erlang import (
    etree_to_term,
    term_to_etree,
)
import datetime
import uuid
from async_lru_cache import AsyncLruCache


Q_INSERT_SERVER_USER = f"""
INSERT INTO
    mam_server_user (server, user_name)
VALUES
    ('{LSERVER}', %(user_name)s)
ON CONFLICT (server, user_name) DO NOTHING
"""


Q_INSERT_MESSAGE = """
INSERT INTO
    mam_message (
        id,
        user_id,
        from_jid,
        remote_bare_jid,
        remote_resource,
        direction,
        message,
        search_body,
        origin_id
    )
VALUES
    (
        %(id)s,
        (SELECT id FROM mam_server_user WHERE user_name = %(from_username)s),
        '', -- from_jid is ignored
        %(to_username)s,
        '', -- remote_resource is ignored
        'O',
        %(message)s,
        %(search_body)s,
        NULL
    ),

    (
        %(id)s + 1,
        (SELECT id FROM mam_server_user WHERE user_name = %(to_username)s),
        '', -- from_jid is ignored
        %(from_username)s,
        '', -- remote_resource is ignored
        'I',
        %(message)s,
        %(search_body)s,
        NULL
    )
"""


Q_SELECT_MESSAGE = f"""
WITH page AS (
    SELECT
        mam_message.id,
        mam_message.message
    FROM
        mam_message
    JOIN
        mam_server_user
    ON
        mam_server_user.id = mam_message.user_id
    WHERE
        mam_server_user.server = '{LSERVER}'
    AND
        mam_server_user.user_name = %(from_username)s
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
class Message:
    message_body: str
    timestamp_microseconds: int
    from_username: str
    to_username: str
    id: str


def _process_query(
    parsed_xml: Optional[etree._Element],
    from_username: str
) -> Optional[Query]:
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
        query_id=query_id,
        from_username=to_bare_jid(from_username),
        to_username=to_bare_jid(to_username),
        before=before_value,
        max=max_value,
    )


def _forwarded_element(
    message: etree.Element,
    query: Query,
    row_id: int,
    forwarded_id: str,
) -> etree.Element:
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
    parsed_xml: Optional[etree._Element],
    from_username: str,
) -> List[str]:
    if parsed_xml is None:
        return []

    query = _process_query(parsed_xml, from_username=from_username)

    if not query:
        return None

    return await _get_conversation(
        query=query,
        from_username=from_username,
        to_username=to_bare_jid(query.to_username)
    )


def store_message(
    message_body: str,
    from_username: str,
    to_username: str,
    msg_id: str
):
    timestamp = datetime.datetime.now().timestamp()

    message = Message(
        message_body=message_body,
        timestamp_microseconds=int(timestamp * 1_000_000),
        from_username=from_username,
        to_username=to_username,
        id=msg_id,
    )

    _store_message_batcher.enqueue(message)


def _process_store_message_batch(batch: List[Message]):
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
            search_body=normalize_search_text(message.message_body),
        )
        for message in batch
    ]

    with database.api_tx('read committed') as tx:
        tx.executemany(Q_INSERT_MESSAGE, params_seq)


async def _get_conversation(
    query: Query,
    from_username: str,
    to_username: str
) -> List[str]:
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

        try:
            message_term = erlastic.decode(message_binary)
            message_etree = term_to_etree(message_term)
        except:
            continue

        forwarded_etree = _forwarded_element(
            message=message_etree,
            query=query,
            row_id=row_id,
            forwarded_id=str(uuid.uuid4()),
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


@AsyncLruCache(maxsize=1024)
async def insert_server_user(username: str):
    async with asyncdatabase.api_tx() as tx:
        await tx.execute(Q_INSERT_SERVER_USER, dict(user_name=username))


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
    re0 = re.sub(r"[, .:;\-?!]+", " ", lower_body, flags=re.UNICODE)

    # Step 2: Remove non-word characters at the start and end of the string, or
    # entirely non-word characters
    re1 = re.sub(r"([^\w ]+)|(^\s+)|(\s+$)", "", re0, flags=re.UNICODE)

    # Step 3: Replace multiple spaces with the word separator
    re2 = re.sub(r"\s+", ' ', re1, flags=re.UNICODE)

    return re2


_store_message_batcher = Batcher[Message](
    process_fn=_process_store_message_batch,
    flush_interval=1.0,
    min_batch_size=1,
    max_batch_size=1000,
    retry=False,
)


_store_message_batcher.start()
