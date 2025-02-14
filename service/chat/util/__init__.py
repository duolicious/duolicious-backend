from lxml import etree
import datetime


LSERVER = 'duolicious.app'


def build_element(tag: str, text: str = None, attrib: dict = None, ns: str = None) -> etree.Element:
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
    return dt.strftime('%Y-%m-%dT%H:%M:%S.%fZ')


def to_bare_jid(jid: str | None):
    try:
        return jid.split('@')[0]
    except:
        return None


def message_string_to_etree(
    message_body: str,
    to_username: str,
    from_username: str,
    id: str,
) -> str:
    message_etree = build_element(
        'message',
        attrib={
            'from': f'{from_username}@{LSERVER}',
            'to': f'{to_username}@{LSERVER}',
            'id': id,
            'type': 'chat',
        },
        ns='jabber:client',
    )

    body = build_element('body', text=message_body)

    request = build_element(
        'request',
        ns='urn:xmpp:receipts'
    )

    message_etree.extend([body, request])

    return message_etree
