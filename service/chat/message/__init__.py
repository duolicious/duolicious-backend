import secrets
from dataclasses import dataclass
import uuid
from lxml import etree
from service.chat.chatutil import (
    to_bare_jid,
)
from constants import (
    MAX_NOTIFICATION_LENGTH,
)

# Non-breaking spaces are inserted so that only the first line shows on old
# clients, in inboxes, and in notifications
NON_BREAKING_SPACES = '\xa0' * MAX_NOTIFICATION_LENGTH

AUDIO_MESSAGE_BODY = f"""
Voice message
{NON_BREAKING_SPACES}
Upgrade to the latest version of Duolicious to hear this message
""".strip()

@dataclass(frozen=True)
class BaseMessage:
    stanza_id: str
    to_username: str


@dataclass(frozen=True)
class ChatMessage(BaseMessage):
    body: str


@dataclass(frozen=True)
class TypingMessage(BaseMessage):
    pass


@dataclass(frozen=True)
class AudioMessage(BaseMessage):
    body: str
    audio_base64: str
    audio_uuid: str


Message = ChatMessage | TypingMessage | AudioMessage


def xml_to_message(parsed_xml: etree._Element) -> Message | None:
    if parsed_xml.tag != '{jabber:client}message':
        return None

    message_type = parsed_xml.attrib.get('type')

    stanza_id = parsed_xml.attrib.get('id')
    stanza_id = stanza_id if stanza_id and len(stanza_id) <= 250 else None

    audio_base64 = parsed_xml.attrib.get('audio_base64')

    body_element = parsed_xml.find('{jabber:client}body')
    body = (
        body_element.text.strip()
        if
        body_element is not None
        and body_element.text
        and body_element.text.strip()
        else None
    )

    to_jid = parsed_xml.attrib.get('to')
    to_bare_jid_ = to_bare_jid(parsed_xml.attrib.get('to'))
    to_username = str(uuid.UUID(to_bare_jid_))

    if not stanza_id:
        return None
    elif not to_username:
        return None
    elif message_type == 'typing':
        return TypingMessage(
                stanza_id=stanza_id,
                to_username=to_username)
    elif message_type == 'chat':
        if audio_base64:
            return AudioMessage(
                    stanza_id=stanza_id,
                    to_username=to_username,
                    body=AUDIO_MESSAGE_BODY,
                    audio_base64=audio_base64,
                    audio_uuid=secrets.token_hex(32))
        elif body:
            return ChatMessage(
                    stanza_id=stanza_id,
                    to_username=to_username,
                    body=body)

    return None
