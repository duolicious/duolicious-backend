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
    for key, value in sorted(attrs):
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
    element = etree.Element(tag)

    if nsmap is not None and None in nsmap:
        element.set('xmlns', nsmap[None])

    for key, value in (attrib or {}).items():
        element.set(key, value)

    last_child = None
    for child in node[3]:
        last_child = add_child_to_element(element, child, last_child)
    return element


def etree_to_term(element):
    """
    Convert an lxml.etree.Element into an erlastic/Erlang term.

    The term is structured as:
      (Atom('xmlel'), tag, attributes, children)

    Where:
      - tag is a string,
      - attributes is a list of (key, value) tuples. 
        If a default namespace is present, an attribute ('xmlns', value)
        is added.
      - children is a list of nodes; each node is either an element term 
        (as above) or a text node represented as (Atom('xmlcdata'), text).

    The children list is built by interleaving the element’s .text,
    each child element (converted recursively), and each child’s .tail.
    """
    # Build the attributes list.
    attrs = []

    # If a default namespace is defined in nsmap, include it as 'xmlns'
    if element.nsmap and None in element.nsmap:
        attrs.append(('xmlns', element.nsmap[None]))

    # Add all regular attributes.
    for key, value in element.attrib.items():
        attrs.append((key, value))

    attrs.sort()

    # Build the children list.
    children = []
    # Add the element's text (if any) as a CDATA node.
    if element.text:
        children.append((Atom('xmlcdata'), element.text))

    # Process each child element.
    for child in element:
        # Add the child element (recursively converted).
        children.append(etree_to_term(child))
        # If the child element has a tail text, add that as a CDATA node.
        if child.tail:
            children.append((Atom('xmlcdata'), child.tail))

    return (Atom('xmlel'), element.tag, attrs, children)
