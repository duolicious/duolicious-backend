import unittest
from xml.sax.saxutils import escape

from backfill.inbox_body import extract_body, extract_direction


# The placeholder body that the chat service stores for voice messages (see
# `service.chat.message.AUDIO_MESSAGE_BODY`). Replicated here so the test stays
# free of the `service.chat` import, which requires DB env vars at import time.
_NON_BREAKING_SPACES = '\xa0' * 1024
AUDIO_MESSAGE_BODY = (
    f'Voice message\n{_NON_BREAKING_SPACES}\n'
    'Upgrade to the latest version of Duolicious to hear this message'
)


def _content(message_body: str) -> bytes:
    # Mirrors the shape produced by `service.chat.chatutil.message_string_to_etree`
    # and stored by `store_message`: a `jabber:client` <message> with a <body>
    # and a <request> child.
    return (
        '<message xmlns="jabber:client" from="a@duolicious.app" '
        'to="b@duolicious.app" id="STANZA123" type="chat">'
        f'<body>{escape(message_body)}</body>'
        '<request xmlns="urn:xmpp:receipts"/>'
        '</message>'
    ).encode('utf-8')


class TestExtractBody(unittest.TestCase):

    def test_forward_fill_roundtrip(self) -> None:
        # The body extracted from `content` must match what the forward-fill
        # writes into `body` (`message.body`) for the same message.
        self.assertEqual(extract_body(_content('Who is that')), 'Who is that')

    def test_unicode_and_emoji(self) -> None:
        body = 'Hey 🙂 do you like rap ‼️'
        self.assertEqual(extract_body(_content(body)), body)

    def test_multiline_audio_placeholder(self) -> None:
        # Voice messages forward-fill a multi-line placeholder body; the
        # extractor must return it intact so the two columns agree.
        self.assertEqual(
            extract_body(_content(AUDIO_MESSAGE_BODY)), AUDIO_MESSAGE_BODY)

    def test_accepts_memoryview(self) -> None:
        self.assertEqual(
            extract_body(memoryview(_content('memoryview body'))),
            'memoryview body',
        )

    def test_accepts_str(self) -> None:
        self.assertEqual(
            extract_body(_content('str body').decode('utf-8')), 'str body')

    # The historical MongooseIM-generated rows differ from what the Python
    # forward-fill produces: single-quoted attributes, a trailing `xmlns`, extra
    # attributes (`check_uniqueness`), extra children (`<stanza-id>`), and HTML
    # entities. The extractor must handle all of them.

    def test_legacy_single_quotes_and_entities(self) -> None:
        content = (
            "<message type='chat' from='a@duolicious.app' "
            "to='b@duolicious.app' id='abc' check_uniqueness='true' "
            "xmlns='jabber:client'>"
            "<body>Are you a &apos;leftist&apos; &amp; proud?</body>"
            "<request xmlns='urn:xmpp:receipts'/>"
            "<stanza-id by='a@duolicious.app' id='C9TK' xmlns='urn:xmpp:sid:0'/>"
            "</message>"
        ).encode('utf-8')
        self.assertEqual(extract_body(content), "Are you a 'leftist' & proud?")

    def test_legacy_pretty_printed_with_leading_whitespace(self) -> None:
        content = (
            "\n        "
            '<message type="chat" from="a@duolicious.app" '
            'to="b@duolicious.app" id="abc" xmlns="jabber:client">\n'
            '          <body>ur pfp looks so awesome do u like rap</body>\n'
            '          <request xmlns="urn:xmpp:receipts"/>\n'
            '        </message>\n        '
        ).encode('utf-8')
        self.assertEqual(
            extract_body(content), 'ur pfp looks so awesome do u like rap')

    def test_body_containing_xml_like_text(self) -> None:
        body = '<body>not real markup</body> & "quotes"'
        self.assertEqual(extract_body(_content(body)), body)

    def test_no_body_child(self) -> None:
        content = (
            '<message xmlns="jabber:client" type="typing" id="x" '
            'to="b@duolicious.app"/>'
        ).encode('utf-8')
        self.assertIsNone(extract_body(content))

    def test_empty_body(self) -> None:
        content = (
            '<message xmlns="jabber:client" type="chat" id="x" '
            'to="b@duolicious.app"><body>   </body></message>'
        ).encode('utf-8')
        self.assertIsNone(extract_body(content))

    def test_none(self) -> None:
        self.assertIsNone(extract_body(None))

    def test_undecodable(self) -> None:
        self.assertIsNone(extract_body(b'\xff\xfe not xml'))


class TestExtractDirection(unittest.TestCase):
    # `_content` builds a message from "a@duolicious.app" to "b@duolicious.app".
    # Direction is relative to the row's owner (`luser`): the owner who received
    # the message ("b") sees it incoming ('I'); the owner who sent it ("a") sees
    # it outgoing ('O') -- matching the forward-fill in
    # `service.chat.messagestorage.inbox`.

    def test_incoming_for_recipient(self) -> None:
        self.assertEqual(
            extract_direction(
                _content('hi'), 'b@duolicious.app', 'a@duolicious.app'),
            'I',
        )

    def test_outgoing_for_sender(self) -> None:
        self.assertEqual(
            extract_direction(
                _content('hi'), 'a@duolicious.app', 'b@duolicious.app'),
            'O',
        )

    def test_luser_has_no_domain(self) -> None:
        # Real `inbox.luser` values are bare uuids with no `@domain`.
        self.assertEqual(
            extract_direction(_content('hi'), 'b', 'a@duolicious.app'), 'I')

    def test_legacy_single_quote_attributes(self) -> None:
        content = (
            "<message type='chat' from='a@duolicious.app' "
            "to='b@duolicious.app' id='abc' xmlns='jabber:client'>"
            "<body>hi</body></message>"
        ).encode('utf-8')
        self.assertEqual(
            extract_direction(content, 'b@duolicious.app', 'a@duolicious.app'),
            'I')
        self.assertEqual(
            extract_direction(content, 'a@duolicious.app', 'b@duolicious.app'),
            'O')

    def test_ignores_resource_in_jid(self) -> None:
        content = (
            '<message xmlns="jabber:client" from="a@duolicious.app/phone" '
            'to="b@duolicious.app/web" id="x" type="chat">'
            '<body>hi</body></message>'
        ).encode('utf-8')
        self.assertEqual(
            extract_direction(content, 'b@duolicious.app', 'a@duolicious.app'),
            'I')
        self.assertEqual(
            extract_direction(content, 'a@duolicious.app', 'b@duolicious.app'),
            'O')

    def test_no_match_returns_none(self) -> None:
        # Neither participant is the owner or the remote party.
        self.assertIsNone(
            extract_direction(
                _content('hi'), 'c@duolicious.app', 'd@duolicious.app'))

    def test_none_content(self) -> None:
        self.assertIsNone(
            extract_direction(None, 'a@duolicious.app', 'b@duolicious.app'))

    def test_undecodable(self) -> None:
        self.assertIsNone(
            extract_direction(
                b'\xff\xfe not xml', 'a@duolicious.app', 'b@duolicious.app'))


class TestExtractDirectionLegacyNumericJids(unittest.TestCase):
    # Legacy `content` from before JIDs became UUIDs stores numeric person-id
    # JIDs that don't match the row's UUID `luser`/`remote_bare_jid`. The
    # id->uuid map (built per batch from a `person` lookup) bridges them. Here
    # person 107514 is the sender (U1) and 96557 the recipient (U2).
    U1 = '3b17f9da-b7ed-4ead-997a-dfa082780001'
    U2 = '464deae1-cd2f-47a4-9648-9c5a7087e200'
    ID_TO_UUID = {'107514': U1, '96557': U2}

    def _numeric_content(self) -> bytes:
        return (
            "<message type='chat' from='107514@duolicious.app' "
            "to='96557@duolicious.app' id='x' xmlns='jabber:client'>"
            "<body>hi</body></message>"
        ).encode('utf-8')

    def test_incoming_for_recipient(self) -> None:
        self.assertEqual(
            extract_direction(
                self._numeric_content(), self.U2,
                f'{self.U1}@duolicious.app', self.ID_TO_UUID),
            'I')

    def test_outgoing_for_sender(self) -> None:
        self.assertEqual(
            extract_direction(
                self._numeric_content(), self.U1,
                f'{self.U2}@duolicious.app', self.ID_TO_UUID),
            'O')

    def test_resolves_via_owner_when_remote_deleted(self) -> None:
        # The remote party (sender, 107514) was deleted, so its id has no
        # mapping; direction is still recovered from the owner (recipient) side.
        self.assertEqual(
            extract_direction(
                self._numeric_content(), self.U2,
                f'{self.U1}@duolicious.app', {'96557': self.U2}),
            'I')

    def test_unresolved_when_both_deleted(self) -> None:
        # Neither participant maps to a UUID, so direction can't be determined.
        self.assertIsNone(
            extract_direction(
                self._numeric_content(), self.U2,
                f'{self.U1}@duolicious.app', {}))


if __name__ == '__main__':
    unittest.main()
