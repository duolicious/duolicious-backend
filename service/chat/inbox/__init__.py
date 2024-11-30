from batcher import Batcher
from database import asyncdatabase
from dataclasses import dataclass
from lxml import etree
from typing import Optional, List
import database
import datetime

# TODO: Augment messages with /inbox-info stuff


LSERVER = 'duolicious.app'


Q_GET_INBOX = f"""
SELECT
    *
FROM
    inbox
WHERE
    lserver = '{LSERVER}'
AND
    luser = %(username)s
ORDER BY
    luser,
    lserver,
    remote_bare_jid
"""


Q_UPSERT_CONVERSATION = f"""
WITH upsert_sender AS (
    INSERT INTO inbox (
        luser,
        lserver,
        remote_bare_jid,
        msg_id,
        box,
        content,
        timestamp,
        muted_until,
        unread_count
    )
    VALUES (
        %(from_username)s,
        '{LSERVER}',
        %(recipient_jid)s,
        %(msg_id)s,
        'chats',
        %(content)s,
        EXTRACT(EPOCH FROM NOW()) * 1e6,
        0,
        0
    )
    ON CONFLICT (lserver, luser, remote_bare_jid)
    DO UPDATE SET
        msg_id = EXCLUDED.msg_id,
        box = 'chats',
        content = EXCLUDED.content,
        timestamp = EXCLUDED.timestamp,
        muted_until = EXCLUDED.muted_until,
        unread_count = 0
), upsert_recipient AS (
    INSERT INTO inbox (
        luser,
        lserver,
        remote_bare_jid,
        msg_id,
        box,
        content,
        timestamp,
        muted_until,
        unread_count
    )
    VALUES (
        %(to_username)s,
        '{LSERVER}',
        %(sender_jid)s,
        %(msg_id)s,
        'inbox',
        %(content)s,
        EXTRACT(EPOCH FROM NOW()) * 1e6,
        0,
        1
    )
    ON CONFLICT (lserver, luser, remote_bare_jid)
    DO UPDATE SET
        msg_id = EXCLUDED.msg_id,
        box = 'inbox',
        content = EXCLUDED.content,
        timestamp = EXCLUDED.timestamp,
        muted_until = EXCLUDED.muted_until,
        unread_count = COALESCE(inbox.unread_count, 0) + 1
)
SELECT 1
"""


Q_MARK_DISPLAYED = f"""
UPDATE
    inbox
SET
    unread_count = 0
WHERE
    lserver = '{LSERVER}'
AND
    luser = %(luser)s
AND
    remote_bare_jid = %(remote_bare_jid)s
"""


@dataclass(frozen=True)
class UpsertConversationJob:
    from_username: str
    to_username: str
    msg_id: str
    content: str


@dataclass(frozen=True)
class MarkDisplayedJob:
    from_username: str
    to_username: str


async def maybe_get_inbox(
    parsed_xml: Optional[etree._Element],
    username: str,
) -> List[str]:
    if parsed_xml is None:
        return []

    # XPath query to find the <inbox> element
    xpath_query = "/*[local-name()='iq']/*[local-name()='inbox'] | /*[local-name()='inbox']"
    inbox_element = parsed_xml.xpath(xpath_query)

    if not inbox_element:
        return None

    # Get the first <inbox> element and extract the `queryid` attribute
    inbox = inbox_element[0]
    query_id = inbox.get("queryid")
    if not query_id:
        return None

    # Return the inbox based on the query_id
    return await _get_inbox(query_id, username)


async def _get_inbox(query_id: str, username: str) -> List[str]:
    """
    Fetches the user's inbox using the query_id and constructs XML elements for each message.
    :param query_id: The ID of the query extracted from the XML.
    :param username: The username of the user.
    :return: A list of XML strings representing each message.
    """

    def build_element(tag: str, text: str = None, attrib: dict = None, ns: str = None) -> etree.Element:
        """
        Helper function to create an XML element.
        """
        element = etree.Element(tag, nsmap={None: ns} if ns else None)
        if attrib:
            element.attrib.update(attrib)
        if text is not None:
            element.text = text
        return element

    def format_timestamp(microseconds: int) -> str:
        """
        Converts a timestamp in microseconds to an ISO 8601 string.
        """
        timestamp_sec = microseconds / 1e6  # Convert microseconds to seconds
        dt = datetime.datetime.utcfromtimestamp(timestamp_sec)
        return dt.strftime('%Y-%m-%dT%H:%M:%S.%fZ')

    async with asyncdatabase.chat_tx('read committed') as tx:
        await tx.execute(Q_GET_INBOX, dict(username=username))
        rows = await tx.fetchall()

    messages = []
    for row in rows:
        try:
            # Parse the content
            content_xml = etree.fromstring(row['content'])

            # Build the 'delay' element
            delay_element = build_element(
                'delay',
                attrib={'stamp': format_timestamp(row['timestamp'])},
                ns='urn:xmpp:delay'
            )

            # Build the 'forwarded' element
            forwarded_element = build_element('forwarded', ns='urn:xmpp:forward:0')
            forwarded_element.extend([delay_element, content_xml])

            # Build the 'result' element
            result_element = build_element(
                'result',
                attrib={'unread': str(row['unread_count']), 'queryid': query_id},
                ns='erlang-solutions.com:xmpp:inbox:0'
            )
            result_element.extend([
                forwarded_element,
                build_element('read', text='true' if row['unread_count'] == 0 else 'false'),
                build_element('box', text=row['box']),
                build_element('archive', text='false'),  # Assuming not archived
                build_element('mute', text=str(row.get('muted_until', 0)))
            ])

            # Build the outer 'message' element
            user_jid = f"{row['luser']}@{LSERVER}"
            message_element = build_element(
                'message',
                attrib={
                    'from': user_jid,
                    'to': user_jid,
                    'id': f"{row['msg_id']}"
                },
                ns='jabber:client'
            )
            message_element.append(result_element)

            # Convert the message_element to string and append to messages list
            messages.append(
                etree.tostring(
                    message_element, encoding='unicode', pretty_print=False))

        except Exception as e:
            print(f"Error processing row: {e}")
            continue

    messages.append(f"<iq id='{query_id}' type='result'><fin/></iq>")

    return messages


def upsert_conversation(
    from_username: str,
    to_username: str,
    msg_id: str,
    content: str,
):
    """
    Inserts or updates a conversation in the inbox table for both sender and recipient.
    Sets the conversation's box appropriately ('chats' for sender, 'inbox' for recipient).
    :param from_username: The local username of the sender.
    :param to_username: The local username of the recipient.
    :param message_data: A dictionary containing 'msg_id', 'content'
    """

    job = UpsertConversationJob(
        from_username=from_username,
        to_username=to_username,
        msg_id=msg_id,
        content=content,
    )

    _upsert_conversation_batcher.enqueue(job)


def _process_upsert_conversation_batch(batch: List[UpsertConversationJob]):
    params_seq = [
        dict(
            from_username=job.from_username,
            to_username=job.to_username,
            sender_jid=f"{job.from_username}@{LSERVER}",
            recipient_jid=f"{job.to_username}@{LSERVER}",
            msg_id=job.msg_id,
            content=job.content,
        )
        for job in batch
    ]

    with database.chat_tx('read committed') as tx:
        tx.executemany(Q_UPSERT_CONVERSATION, params_seq)

def maybe_mark_displayed(
    parsed_xml: Optional[etree._Element],
    from_username: str,
) -> bool:
    if parsed_xml is None:
        return False

    xpath_query = "/*[local-name()='message'][*[local-name()='displayed']]"
    displayed_element = parsed_xml.xpath(xpath_query)

    if not displayed_element:
        return False

    try:
        to_username, *_ = displayed_element[0].get('to').split('@')
    except:
        return False

    _mark_displayed(from_username=from_username, to_username=to_username)

    return True


def _mark_displayed(from_username: str, to_username: str):
    job = MarkDisplayedJob(from_username=from_username, to_username=to_username)

    _mark_displayed_batcher.enqueue(job)


def _process_mark_displayed_batch(batch: List[MarkDisplayedJob]):
    params_seq = [
        dict(
            luser=job.from_username,
            remote_bare_jid=f'{job.to_username}@{LSERVER}',
        )
        for job in batch
    ]

    with database.chat_tx('read committed') as tx:
        tx.executemany(Q_MARK_DISPLAYED, params_seq)


_upsert_conversation_batcher = Batcher[UpsertConversationJob](
    process_fn=_process_upsert_conversation_batch,
    flush_interval=1.0,
    min_batch_size=1,
    max_batch_size=1000,
    retry=False,
)


_mark_displayed_batcher = Batcher[MarkDisplayedJob](
    process_fn=_process_mark_displayed_batch,
    flush_interval=1.0,
    min_batch_size=1,
    max_batch_size=1000,
    retry=False,
)


_upsert_conversation_batcher.start()


_mark_displayed_batcher.start()
