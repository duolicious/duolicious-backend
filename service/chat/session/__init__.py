from lxml import etree
import uuid
from typing import List
from service.chat.util import (
    build_element,
)
from service.chat.username import Username
from database.asyncdatabase import api_tx
import base64
from duohash import sha512

# TODO: Delete auth.py
# TODO: Use python as the base docker container instead of Mongoose
# TODO: Broadcast messages


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


async def is_authorized(parsed_xml: etree.Element, username: Username) -> bool:
    if username.username is not None:
        return False

    try:
        # Create a safe XML parser
        if parsed_xml.tag != '{urn:ietf:params:xml:ns:xmpp-sasl}auth':
            return False

        base64encoded = parsed_xml.text
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

        username.username = auth_username

        return True
    except Exception as e:
        pass

    return False


def handle_open(parsed_xml: etree.Element, username: Username) -> List[str]:
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
        "xml:lang": "en",
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
    if not username.username:
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


async def handle_auth(parsed_xml: etree.Element, username: Username) -> List[str]:
    """
    Handles an <auth> stanza in the SASL namespace.

    If the mechanism is "PLAIN", returns a <success> element.
    Otherwise, returns a <failure> element (and a closing stream tag).
    """
    if await is_authorized(parsed_xml, username):
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


async def maybe_get_session_response(parsed_xml: etree.Element, username: Username) -> List[str]:
    """
    Determines the appropriate response stanzas for a given input XML element.

    The input is an lxml.etree.Element representing either:
      - An <open> element in the XMPP framing namespace, or
      - An <auth> element in the SASL namespace.

    The username parameter indicates whether the session is already authenticated:
      - If username.username is None, then pre-authentication features are offered.
      - If username.username is set, then post-authentication features (session and bind) are offered.

    If the input does not match any expected element, returns an empty list.
    """
    qname = etree.QName(parsed_xml.tag)
    tag = qname.localname
    ns = qname.namespace

    if tag == "open" and ns == "urn:ietf:params:xml:ns:xmpp-framing":
        return handle_open(parsed_xml, username)
    elif tag == "auth" and ns == "urn:ietf:params:xml:ns:xmpp-sasl":
        return await handle_auth(parsed_xml, username)
    else:
        return []
