import struct
import unittest
import zlib

import erlastic
from erlastic import Atom

from backfill.mam_message_body import extract_body_and_stanza_id


def _message_term(attrs, children):
    return (Atom('xmlel'), 'message', attrs, children)


def _body_child(text):
    return (Atom('xmlel'), 'body', [], [(Atom('xmlcdata'), text)])


def _request_child():
    return (Atom('xmlel'), 'request', [('xmlns', 'urn:xmpp:receipts')], [])


def _chat_term(stanza_id, body_text):
    return _message_term(
        [
            ('from', 'a@duolicious.app'),
            ('id', stanza_id),
            ('to', 'b@duolicious.app'),
            ('type', 'chat'),
            ('xmlns', 'jabber:client'),
        ],
        [_body_child(body_text), _request_child()],
    )


def _encode(term):
    return erlastic.encode(term)


def _encode_compressed(term):
    # ETF COMPRESSED format: 0x83 0x50 <4-byte uncompressed size> <zlib(body)>,
    # matching the ~1/3 of production rows that are stored compressed.
    body = erlastic.encode(term)[1:]
    return b'\x83\x50' + struct.pack('>I', len(body)) + zlib.compress(body)


class TestExtractBodyAndStanzaId(unittest.TestCase):

    def test_basic(self):
        term = _chat_term('STANZA123', 'Who is that')
        self.assertEqual(
            extract_body_and_stanza_id(_encode(term)),
            ('Who is that', 'STANZA123'),
        )

    def test_compressed_matches_uncompressed(self):
        term = _chat_term('abc', 'hello there')
        self.assertEqual(
            extract_body_and_stanza_id(_encode_compressed(term)),
            extract_body_and_stanza_id(_encode(term)),
        )
        self.assertEqual(
            extract_body_and_stanza_id(_encode_compressed(term)),
            ('hello there', 'abc'),
        )

    def test_unicode_and_emoji(self):
        body = 'someday ill have to plan a trip 😌 ლ(◉‿◉ ლ'
        term = _chat_term('s1', body)
        self.assertEqual(
            extract_body_and_stanza_id(_encode(term)), (body, 's1'))
        self.assertEqual(
            extract_body_and_stanza_id(_encode_compressed(term)), (body, 's1'))

    def test_body_containing_xml_like_text(self):
        body = '<body>not real markup</body> & "quotes"'
        term = _chat_term('s2', body)
        self.assertEqual(
            extract_body_and_stanza_id(_encode(term)), (body, 's2'))

    def test_extra_attribute_is_ignored(self):
        # Older rows carry a `check_uniqueness` attribute.
        term = _message_term(
            [
                ('check_uniqueness', 'false'),
                ('id', 'withextra'),
                ('to', 'b@duolicious.app'),
                ('type', 'chat'),
                ('xmlns', 'jabber:client'),
            ],
            [_body_child('hi'), _request_child()],
        )
        self.assertEqual(
            extract_body_and_stanza_id(_encode(term)), ('hi', 'withextra'))

    def test_missing_from_attribute(self):
        term = _message_term(
            [
                ('id', 'nofrom'),
                ('to', '139@duolicious.app'),
                ('type', 'chat'),
                ('xmlns', 'jabber:client'),
            ],
            [_body_child('text'), _request_child()],
        )
        self.assertEqual(
            extract_body_and_stanza_id(_encode(term)), ('text', 'nofrom'))

    def test_no_body_child(self):
        term = _message_term(
            [('id', 'typing'), ('type', 'typing'), ('xmlns', 'jabber:client')],
            [],
        )
        self.assertEqual(extract_body_and_stanza_id(_encode(term)), (None, 'typing'))

    def test_undecodable(self):
        self.assertEqual(extract_body_and_stanza_id(b'not etf'), (None, None))

    def test_accepts_memoryview(self):
        term = _chat_term('mv', 'memoryview body')
        self.assertEqual(
            extract_body_and_stanza_id(memoryview(_encode(term))),
            ('memoryview body', 'mv'),
        )


if __name__ == '__main__':
    unittest.main()
