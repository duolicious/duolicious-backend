from erlastic import Atom


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
