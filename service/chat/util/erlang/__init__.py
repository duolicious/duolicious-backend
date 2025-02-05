from lxml import etree
from erlastic import Atom

def decode(value):
    """Decode bytes to a UTF-8 string, if necessary."""
    return value.decode('utf8') if isinstance(value, bytes) else value

def process_attributes(attrs):
    """
    Process a list of (key, value) attribute tuples.

    Returns a tuple (nsmap, attrib) where nsmap is a namespace mapping (if any)
    and attrib is a dict of the remaining attributes.
    """
    nsmap = None
    attrib = {}
    for key, value in attrs:
        key, value = decode(key), decode(value)
        if key == 'xmlns':
            nsmap = {None: value}  # default namespace mapping
        else:
            attrib[key] = value
    return nsmap, attrib

def add_child_to_element(element, child, last_child):
    """
    Process a single child and add it to the element.

    Returns the updated last child element.
    """
    child_type = child[0]
    if child_type == Atom('xmlcdata'):
        text = decode(child[1])
        if last_child is None:
            element.text = (element.text or '') + text
        else:
            last_child.tail = (last_child.tail or '') + text
        return last_child
    if child_type == Atom('xmlel'):
        child_elem = term_to_etree(child)
        element.append(child_elem)
        return child_elem
    return last_child

def term_to_etree(node):
    """
    Recursively build an lxml.etree element from a tuple-based structure.

    The expected structures are:
      - Element node: (Atom('xmlel'), tag, attributes, children)
      - CDATA node:   (Atom('xmlcdata'), text)
    """
    if not isinstance(node, tuple):
        return None

    node_type = node[0]
    if node_type == Atom('xmlcdata'):
        return decode(node[1])
    if node_type != Atom('xmlel'):
        return None

    tag = decode(node[1])
    nsmap, attrib = process_attributes(node[2])
    element = etree.Element(tag, attrib=attrib, nsmap=nsmap)

    last_child = None
    for child in node[3]:
        last_child = add_child_to_element(element, child, last_child)
    return element

def term_to_xml_string(structure):
    """
    Convert the tuple-based structure into an lxml element and return its XML string.
    """
    root = term_to_etree(structure)
    return etree.tostring(root, encoding='unicode', pretty_print=False)
