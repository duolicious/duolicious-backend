from lxml import etree
from typing import Optional

def parse_xml(s: str) -> etree.Element:
    parser = etree.XMLParser(resolve_entities=False, no_network=True)
    return etree.fromstring(s, parser=parser)

def parse_xml_or_none(s: str) -> Optional[etree.Element]:
    try:
        return parse_xml(s)
    except:
        return None

