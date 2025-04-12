from lxml import etree
import uuid
from typing import List
from service.chat.chatutil import (
    LSERVER,
    build_element,
)
from database.asyncdatabase import api_tx
import base64
from duohash import sha512


Q_CHECK_AUTH = """
SELECT
    1
FROM
    duo_session
JOIN
    person
ON
    person.id = duo_session.person_id
WHERE
    duo_session.session_token_hash = %(session_token_hash)s
AND
    person.uuid = %(auth_username)s
"""


class Session:
    def __init__(self):
        self.connection_uuid = str(uuid.uuid4())
        self.username = None


async def is_authorized(parsed_xml: etree._Element, session: Session) -> bool:
    if session.username is not None:
        return False

    try:
        # Create a safe XML parser
        if parsed_xml.tag != '{urn:ietf:params:xml:ns:xmpp-sasl}auth':
            return False

        base64encoded = parsed_xml.text

        if base64encoded is None:
            return False

        decodedBytes = base64.b64decode(base64encoded)
        decodedString = decodedBytes.decode('utf-8')

        _, auth_username, auth_token = decodedString.split('\0')

        # Validates that `auth_username` is a valid UUID
        uuid.UUID(auth_username)

        auth_token_hash = sha512(auth_token)

        params = dict(
            auth_username=auth_username,
            session_token_hash=auth_token_hash,
        )

        async with api_tx('read committed') as tx:
            await tx.execute(Q_CHECK_AUTH, params)
            assert await tx.fetchone()

        session.username = auth_username

        return True
    except:
        pass

    return False


def handle_open(parsed_xml: etree._Element, session: Session) -> List[str]:
    """
    Handles an <open> stanza in the XMPP framing namespace.

    - If authenticated is False, returns an <open> element along with features
      offering STARTTLS and SASL (mechanism PLAIN).
    - If authenticated is True, returns an <open> element along with features
      offering session and bind.

    The connection id is generated randomly.
    """
    # Check for required attributes
    if "version" not in parsed_xml.attrib or "to" not in parsed_xml.attrib:
        return []

    # Build the server's <open> element.
    open_attrs = {
        "version": parsed_xml.attrib["version"],
        "id": str(uuid.uuid4()),
        "from": parsed_xml.attrib["to"]
    }
    open_elem = build_element(
        tag="open",
        attrib=open_attrs,
        ns="urn:ietf:params:xml:ns:xmpp-framing"
    )

    # Build the <features> element.
    features_elem = build_element(
            "features", ns="http://etherx.jabber.org/streams")
    if not session.username:
        # Pre‑authentication features: offer STARTTLS and SASL
        starttls_elem = build_element(
                "starttls", ns="urn:ietf:params:xml:ns:xmpp-tls")
        mechanisms_elem = build_element(
                "mechanisms", ns="urn:ietf:params:xml:ns:xmpp-sasl")
        mech_elem = build_element(
                "mechanism", text="PLAIN")

        mechanisms_elem.append(mech_elem)

        features_elem.append(starttls_elem)
        features_elem.append(mechanisms_elem)
    else:
        # Post‑authentication features: offer session and bind.
        session_elem = build_element(
                "session", ns="urn:ietf:params:xml:ns:xmpp-session")

        bind_elem = build_element(
                "bind", ns="urn:ietf:params:xml:ns:xmpp-bind")


        features_elem.append(session_elem)
        features_elem.append(bind_elem)

    return [
            etree.tostring(
                open_elem,
                encoding='unicode',
                pretty_print=False),

            etree.tostring(
                features_elem,
                encoding='unicode',
                pretty_print=False)]


async def handle_auth(parsed_xml: etree._Element, session: Session) -> List[str]:
    """
    Handles an <auth> stanza in the SASL namespace.

    If the mechanism is "PLAIN", returns a <success> element.
    Otherwise, returns a <failure> element (and a closing stream tag).
    """
    if await is_authorized(parsed_xml, session):
        success_elem = build_element(
                "success",
                ns="urn:ietf:params:xml:ns:xmpp-sasl")

        return [
            etree.tostring(
                success_elem,
                encoding='unicode',
                pretty_print=False)]
    else:
        failure_elem = build_element(
                "failure", ns="urn:ietf:params:xml:ns:xmpp-sasl")

        not_auth_elem = build_element(
                "not-authorized")

        failure_elem.append(not_auth_elem)

        # The closing stream tag is provided as a string.
        return [
            etree.tostring(
                failure_elem,
                encoding='unicode',
                pretty_print=False),
            "</stream:stream>"]


def handle_iq_bind(iq_id: str, session: Session) -> List[str]:
    """
    Handles a <bind> stanza inside an <iq> request.

    Since resources are ignored, the server will respond with a <jid>
    containing only the bare JID (without a resource).
    """
    if session.username is None:
        return []  # Ignore requests from unauthenticated clients

    # Construct the <iq> response with <bind> and <jid>
    iq_elem = build_element("iq", attrib={"type": "result", "id": iq_id})
    bind_elem = build_element("bind", ns="urn:ietf:params:xml:ns:xmpp-bind")

    # Construct the <jid> response (ignoring the requested resource)
    jid = f"{session.username}@{LSERVER}"  # Replace with actual domain
    jid_elem = build_element("jid", text=jid)
    bind_elem.append(jid_elem)
    iq_elem.append(bind_elem)

    return [
        etree.tostring(iq_elem, encoding="unicode", pretty_print=False)
    ]


def handle_iq_session(iq_id: str, session: Session) -> List[str]:
    if session.username is None:
        return []

    # Construct the <iq> response with <bind> and <jid>
    iq_elem = build_element("iq", attrib={"type": "result", "id": iq_id})

    return [
        etree.tostring(iq_elem, encoding="unicode", pretty_print=False)
    ]


def handle_iq(parsed_xml: etree._Element, session: Session) -> List[str]:
    """
    Handles an <iq> stanza, determining if it contains a <bind> request.
    """
    # Check if the <iq> stanza contains a <bind> element
    bind_elem = parsed_xml.find("{urn:ietf:params:xml:ns:xmpp-bind}bind")

    session_elem = parsed_xml.find("{urn:ietf:params:xml:ns:xmpp-session}session")

    # Extract <iq> ID to echo it back in the response
    iq_id = parsed_xml.attrib.get("id", "default")

    if bind_elem is not None:
        return handle_iq_bind(iq_id, session)
    elif session_elem is not None:
        return handle_iq_session(iq_id, session)
    else:
        return []


async def maybe_get_session_response(parsed_xml: etree._Element, session: Session) -> List[str]:
    """
    Determines the appropriate response stanzas for a given input XML element.
    Now includes support for <iq> stanzas containing <bind>.
    """
    qname = etree.QName(parsed_xml.tag)
    tag = qname.localname
    ns = qname.namespace

    if tag == "open" and ns == "urn:ietf:params:xml:ns:xmpp-framing":
        return handle_open(parsed_xml, session)
    elif tag == "auth" and ns == "urn:ietf:params:xml:ns:xmpp-sasl":
        return await handle_auth(parsed_xml, session)
    elif tag == "iq" and ns == "jabber:client":
        return handle_iq(parsed_xml, session)
    else:
        return []
