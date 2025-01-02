from lxml import etree
import datetime

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


def to_bare_jid(jid: str | None):
    try:
        return jid.split('@')[0]
    except:
        return None
