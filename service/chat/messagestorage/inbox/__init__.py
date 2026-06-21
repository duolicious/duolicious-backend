from batcher import Batcher
from database import Tx, asyncdatabase
from dataclasses import dataclass
from lxml import etree
import database
from service.chat.chatutil import (
    LSERVER,
    build_element,
    format_timestamp,
)

INBOX_CONTENT_ENCODING = 'utf-8'

Q_GET_INBOX = f"""
SELECT
    *
FROM
    inbox
WHERE
    luser = %(username)s
ORDER BY
    timestamp
"""


Q_UPSERT_CONVERSATION = f"""
WITH upsert_sender AS (
    INSERT INTO inbox (
        luser,
        remote_bare_jid,
        msg_id,
        box,
        content,
        body,
        direction,
        timestamp,
        unread_count
    )
    VALUES (
        %(from_username)s,
        %(recipient_jid)s,
        %(msg_id)s,
        'chats',
        %(content)s,
        %(body)s,
        -- The sender's own copy: remote_bare_jid is the recipient (the To), so
        -- the message is outgoing.
        'O'::mam_direction,
        EXTRACT(EPOCH FROM NOW()) * 1e6,
        0
    )
    ON CONFLICT (luser, remote_bare_jid)
    DO UPDATE SET
        msg_id = EXCLUDED.msg_id,
        box = 'chats',
        content = EXCLUDED.content,
        body = EXCLUDED.body,
        direction = EXCLUDED.direction,
        timestamp = EXCLUDED.timestamp,
        unread_count = 0
), upsert_recipient AS (
    -- Skipped (the SELECT returns no rows) when %(deliver_to_recipient)s is
    -- false -- i.e. the sender is shadow-banned -- so the recipient's inbox
    -- never gains an entry or unread count, and the notification cron (which
    -- reads `inbox`) never sees it. The sender's own row above is still written.
    INSERT INTO inbox (
        luser,
        remote_bare_jid,
        msg_id,
        box,
        content,
        body,
        direction,
        timestamp,
        unread_count
    )
    SELECT
        %(to_username)s,
        %(sender_jid)s,
        %(msg_id)s,
        'inbox',
        %(content)s,
        %(body)s,
        -- The recipient's copy: remote_bare_jid is the sender (the From), so
        -- the message is incoming.
        'I'::mam_direction,
        EXTRACT(EPOCH FROM NOW()) * 1e6,
        1
    WHERE
        %(deliver_to_recipient)s::BOOLEAN
    ON CONFLICT (luser, remote_bare_jid)
    DO UPDATE SET
        msg_id = EXCLUDED.msg_id,
        box = 'chats',
        content = EXCLUDED.content,
        body = EXCLUDED.body,
        direction = EXCLUDED.direction,
        timestamp = EXCLUDED.timestamp,
        unread_count = COALESCE(inbox.unread_count, 0) + 1
)
SELECT 1
"""


Q_MARK_DISPLAYED = f"""
UPDATE
    inbox
SET
    displayed_at = NOW(),
    unread_count = 0
WHERE
    luser = %(luser)s
AND
    remote_bare_jid = %(remote_bare_jid)s
AND
    unread_count > 0
"""


@dataclass(frozen=True)
class UpsertConversationJob:
    from_username: str
    to_username: str
    msg_id: str
    content: bytes
    body: str
    deliver_to_recipient: bool = True


@dataclass(frozen=True)
class MarkDisplayedJob:
    from_username: str
    to_username: str


async def maybe_get_inbox(
    parsed_xml: etree._Element | None,
    username: str,
) -> list[str]:
    if parsed_xml is None:
        return []

    # XPath query to find the <inbox> element
    xpath_query = "/*[local-name()='iq']/*[local-name()='inbox'] | /*[local-name()='inbox']"
    inbox_element = parsed_xml.xpath(xpath_query)

    if not inbox_element or type(inbox_element) is not list:
        return []

    # Get the first <inbox> element and extract the `queryid` attribute
    inbox = inbox_element[0]
    if type(inbox) is not etree._Element:
        return []

    query_id = inbox.get("queryid")
    if not query_id:
        return []

    # Return the inbox based on the query_id
    return await _get_inbox(query_id, username)


async def _get_inbox(query_id: str, username: str) -> list[str]:
    """
    Fetches the user's inbox using the query_id and constructs XML elements for each message.
    :param query_id: The ID of the query extracted from the XML.
    :param username: The username of the user.
    :return: A list of XML strings representing each message.
    """
    async with asyncdatabase.api_tx('read committed') as tx:
        await tx.execute(Q_GET_INBOX, dict(username=username))
        rows = await tx.fetchall()

    messages: list[str] = []
    for row in rows:
        try:
            # Parse the content
            content_bytes = row['content']
            content_str = content_bytes.decode(INBOX_CONTENT_ENCODING)
            content_xml = etree.fromstring(content_str)

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
                    'id': f"{row['msg_id']}",
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

    iq_element = build_element('iq', attrib=dict(id=query_id, type='result'))
    iq_element.append(build_element('fin'))

    messages.append(
            etree.tostring(
                iq_element, encoding='unicode', pretty_print=False))

    return messages


def process_upsert_conversation_batch(tx: Tx, batch: list[UpsertConversationJob]) -> None:
    params_seq = [
        dict(
            from_username=job.from_username,
            to_username=job.to_username,
            sender_jid=f"{job.from_username}@{LSERVER}",
            recipient_jid=f"{job.to_username}@{LSERVER}",
            msg_id=job.msg_id,
            content=job.content,
            body=job.body,
            deliver_to_recipient=job.deliver_to_recipient,
        )
        for job in batch
    ]

    tx.executemany(Q_UPSERT_CONVERSATION, params_seq)


async def maybe_mark_displayed(
    parsed_xml: etree._Element | None,
    from_username: str,
) -> str | None:
    """
    Marks the conversation as read and returns the other person's username, or
    None if the stanza wasn't a read marker. Whether the read actually advances
    the stored read state is decided in the database: Q_MARK_DISPLAYED only
    touches the row (and bumps displayed_at) when there are unread messages, so
    re-opening an already-read conversation is a no-op.
    """
    if parsed_xml is None:
        return None

    xpath_query = "/*[local-name()='message'][*[local-name()='displayed']]"
    displayed_element = parsed_xml.xpath(xpath_query)

    if not displayed_element or type(displayed_element) is not list:
        return None

    first_displayed_element = displayed_element[0]
    if type(first_displayed_element) is not etree._Element:
        return None

    try:
        to_username, *_ = first_displayed_element.get('to', '').split('@')
    except:
        return None

    if not to_username:
        return None

    _mark_displayed(from_username=from_username, to_username=to_username)

    return to_username


def _mark_displayed(from_username: str, to_username: str) -> None:
    job = MarkDisplayedJob(from_username=from_username, to_username=to_username)

    _mark_displayed_batcher.enqueue(job)


def _process_mark_displayed_batch(batch: list[MarkDisplayedJob]) -> None:
    params_seq = [
        dict(
            luser=job.from_username,
            remote_bare_jid=f'{job.to_username}@{LSERVER}',
        )
        for job in batch
    ]

    with database.api_tx('read committed') as tx:
        tx.executemany(Q_MARK_DISPLAYED, params_seq)


_mark_displayed_batcher = Batcher[MarkDisplayedJob](
    process_fn=_process_mark_displayed_batch,
    flush_interval=1.0,
    min_batch_size=1,
    max_batch_size=1000,
    retry=False,
)


_mark_displayed_batcher.start()
