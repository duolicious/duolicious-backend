import json
import unittest

import xmltodict

from service.chat.jid import LSERVER
from service.chat.message import (
    AudioMessage,
    ChatMessage,
    TypingMessage,
)
from service.chat.protocol import outbound
from service.chat.protocol.inbound import (
    InboxQuery,
    IqBind,
    IqSession,
    MamQuery,
    MarkDisplayed,
    Ping,
    RegisterPushToken,
    SaslAuth,
    StreamOpenReq,
    SubscribeOnline,
    UnsubscribeOnline,
    parse_incoming,
)
from service.chat.protocol.outbound import (
    AuthFailure,
    AuthSuccess,
    BindResult,
    InboxFin,
    InboxResult,
    IncomingChat,
    IncomingTyping,
    MamFin,
    MamResult,
    MessageBlocked,
    MessageDelivered,
    MessageNotUnique,
    MessageTooLong,
    OnlineEvent,
    Pong,
    ReadReceipt,
    RegistrationSuccessful,
    ServerError,
    SessionResult,
    StreamClose,
    StreamFeatures,
    StreamOpenResponse,
    SubscribeBad,
    SubscribeOk,
    UnsubscribeBad,
    UnsubscribeOk,
    from_bus,
    to_bus,
)

U1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
U2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

# One representative instance of every outbound stanza.
OUTBOUND_SAMPLES = [
    Pong(),
    RegistrationSuccessful(),
    SubscribeOk(username=U1),
    SubscribeBad(username=U1),
    UnsubscribeOk(username=U1),
    UnsubscribeBad(username=U1),
    OnlineEvent(username=U1, status='online'),
    MessageBlocked(stanza_id='id1'),
    MessageBlocked(stanza_id='id1', reason='spam'),
    MessageBlocked(stanza_id='id1', reason='rate-limited-1day', subreason='unverified-photos'),
    MessageTooLong(stanza_id='id1'),
    MessageNotUnique(stanza_id='id2', used_count=1),
    MessageDelivered(stanza_id='id1', stamp='2020-01-01T00:00:00.000000Z'),
    MessageDelivered(stanza_id='id1', stamp='2020-01-01T00:00:00.000000Z', audio_uuid='au'),
    ServerError(stanza_id='id1'),
    IncomingChat(from_username=U1, to_username=U2, stanza_id='id1', body='hi'),
    IncomingChat(from_username=U1, to_username=U2, stanza_id='id1', body='hi', audio_uuid='au'),
    IncomingTyping(from_username=U1, to_username=U2, stanza_id='id1'),
    ReadReceipt(from_username=U1, to_username=U2),
    ReadReceipt(from_username=U1, to_username=U2, stamp='2020-01-01T00:00:00.000000Z'),
    MamResult(
        viewer_username=U1, query_id='7', result_id='ABCD', forwarded_id='fwd',
        stamp='2020-01-01T00:00:00.000000Z', msg_from_username=U1,
        msg_to_username=U2, stanza_id='id1', body='hi'),
    MamResult(
        viewer_username=U1, query_id='7', result_id='ABCD', forwarded_id='fwd',
        stamp='2020-01-01T00:00:00.000000Z', msg_from_username=U1,
        msg_to_username=U2, stanza_id='id1', body='hi', audio_uuid='au'),
    MamFin(viewer_username=U1, query_id='7'),
    InboxResult(
        owner_username=U1, msg_id='123', inner_from_username=U1,
        inner_to_username=U2, body='hi', stamp='2020-01-01T00:00:00.000000Z',
        unread_count=0, box='chats', query_id='q1', muted_until=0),
    InboxResult(
        owner_username=U1, msg_id='123', inner_from_username=U2,
        inner_to_username=U1, body='hi', stamp='2020-01-01T00:00:00.000000Z',
        unread_count=2, box='inbox', query_id='q1', muted_until=0),
    InboxFin(query_id='q1'),
    StreamOpenResponse(version='1.0', id='oid', from_=LSERVER),
    StreamFeatures(authenticated=False),
    StreamFeatures(authenticated=True),
    AuthSuccess(),
    AuthFailure(),
    BindResult(iq_id='b1', jid=f'{U1}@{LSERVER}'),
    SessionResult(iq_id='s1'),
    StreamClose(),
]


class TestOutboundInvariant(unittest.TestCase):
    def test_json_matches_xmltodict_of_xml(self) -> None:
        for sample in OUTBOUND_SAMPLES:
            if isinstance(sample, StreamClose):
                # `</stream:stream>` is a control token, not parseable XML.
                self.assertEqual(sample.to_xml(), '</stream:stream>')
                self.assertEqual(sample.to_json(), '{"stream": null}')
                continue

            with self.subTest(stanza=type(sample).__name__):
                from_json = json.loads(sample.to_json())
                from_xml = json.loads(json.dumps(xmltodict.parse(sample.to_xml())))
                self.assertEqual(from_json, from_xml)

    def test_bus_round_trip(self) -> None:
        for sample in OUTBOUND_SAMPLES:
            with self.subTest(stanza=type(sample).__name__):
                self.assertEqual(from_bus(to_bus(sample)), sample)


class TestInboundParsing(unittest.TestCase):
    def _both(self, xml: str, js: str) -> tuple[object, object]:
        return parse_incoming(xml, 'xmpp'), parse_incoming(js, 'json')

    def test_ping(self) -> None:
        x, j = self._both('<duo_ping/>', '{"duo_ping": null}')
        self.assertEqual(x, Ping())
        self.assertEqual(j, Ping())

    def test_auth(self) -> None:
        xml = '<auth xmlns="urn:ietf:params:xml:ns:xmpp-sasl" mechanism="PLAIN">QUJD</auth>'
        js = '{"auth": {"@xmlns": "urn:ietf:params:xml:ns:xmpp-sasl", "@mechanism": "PLAIN", "#text": "QUJD"}}'
        x, j = self._both(xml, js)
        self.assertEqual(x, SaslAuth(payload_b64='QUJD'))
        self.assertEqual(j, SaslAuth(payload_b64='QUJD'))

    def test_subscribe(self) -> None:
        xml = f'<duo_subscribe_online uuid="{U2}"/>'
        js = f'{{"duo_subscribe_online": {{"@uuid": "{U2}"}}}}'
        x, j = self._both(xml, js)
        self.assertEqual(x, SubscribeOnline(uuid=U2))
        self.assertEqual(j, SubscribeOnline(uuid=U2))

    def test_unsubscribe(self) -> None:
        xml = f'<duo_unsubscribe_online uuid="{U2}"/>'
        js = f'{{"duo_unsubscribe_online": {{"@uuid": "{U2}"}}}}'
        x, j = self._both(xml, js)
        self.assertEqual(x, UnsubscribeOnline(uuid=U2))
        self.assertEqual(j, UnsubscribeOnline(uuid=U2))

    def test_register_push_token(self) -> None:
        x, j = self._both(
            '<duo_register_push_token token="t1"/>',
            '{"duo_register_push_token": {"@token": "t1"}}')
        self.assertEqual(x, RegisterPushToken(token='t1'))
        self.assertEqual(j, RegisterPushToken(token='t1'))

    def test_register_push_token_clear(self) -> None:
        x, j = self._both(
            '<duo_register_push_token/>',
            '{"duo_register_push_token": null}')
        self.assertEqual(x, RegisterPushToken(token=None))
        self.assertEqual(j, RegisterPushToken(token=None))

    def test_chat_message(self) -> None:
        xml = (
            f'<message type="chat" from="{U1}@{LSERVER}" to="{U2}@{LSERVER}" '
            f'id="id1" xmlns="jabber:client"><body>hello</body>'
            f'<request xmlns="urn:xmpp:receipts"/></message>')
        js = (
            f'{{"message": {{"@type": "chat", "@from": "{U1}@{LSERVER}", '
            f'"@to": "{U2}@{LSERVER}", "@id": "id1", "@xmlns": "jabber:client", '
            f'"body": "hello", "request": {{"@xmlns": "urn:xmpp:receipts"}}}}}}')
        x, j = self._both(xml, js)
        self.assertEqual(x, ChatMessage(stanza_id='id1', to_username=U2, body='hello'))
        self.assertEqual(j, ChatMessage(stanza_id='id1', to_username=U2, body='hello'))

    def test_typing_message(self) -> None:
        xml = (
            f'<message type="typing" from="{U1}@{LSERVER}" to="{U2}@{LSERVER}" '
            f'id="id1" xmlns="jabber:client"/>')
        js = (
            f'{{"message": {{"@type": "typing", "@from": "{U1}@{LSERVER}", '
            f'"@to": "{U2}@{LSERVER}", "@id": "id1", "@xmlns": "jabber:client"}}}}')
        x, j = self._both(xml, js)
        self.assertEqual(x, TypingMessage(stanza_id='id1', to_username=U2))
        self.assertEqual(j, TypingMessage(stanza_id='id1', to_username=U2))

    def test_audio_message_is_audio(self) -> None:
        xml = (
            f'<message type="chat" from="{U1}@{LSERVER}" to="{U2}@{LSERVER}" '
            f'id="id1" audio_base64="QQ==" xmlns="jabber:client"/>')
        msg = parse_incoming(xml, 'xmpp')
        assert isinstance(msg, AudioMessage)
        self.assertEqual(msg.audio_base64, 'QQ==')

    def test_mark_displayed(self) -> None:
        xml = (
            f'<message from="{U1}@{LSERVER}" to="{U2}@{LSERVER}" '
            f'xmlns="jabber:client"><displayed xmlns="urn:xmpp:chat-markers:0"/>'
            f'</message>')
        x = parse_incoming(xml, 'xmpp')
        self.assertEqual(x, MarkDisplayed(to_username=U2))

    def test_mam_query(self) -> None:
        xml = (
            f"<iq type='set' id='7'>"
            f"<query xmlns='urn:xmpp:mam:2' queryid='7'>"
            f"<x xmlns='jabber:x:data' type='submit'>"
            f"<field var='with'><value>{U2}@{LSERVER}</value></field></x>"
            f"<set xmlns='http://jabber.org/protocol/rsm'>"
            f"<max>3</max><before></before></set></query></iq>")
        x = parse_incoming(xml, 'xmpp')
        self.assertEqual(
            x, MamQuery(query_id='7', with_username=U2, before=None, max='3'))

    def test_inbox_query(self) -> None:
        xml = (
            "<iq type='set' id='5'>"
            "<inbox xmlns='erlang-solutions.com:xmpp:inbox:0' queryid='5'>"
            "<x xmlns='jabber:x:data' type='form'/></inbox></iq>")
        x = parse_incoming(xml, 'xmpp')
        self.assertEqual(x, InboxQuery(query_id='5'))

    def test_iq_bind(self) -> None:
        xml = (
            "<iq xmlns='jabber:client' type='set' id='b1'>"
            "<bind xmlns='urn:ietf:params:xml:ns:xmpp-bind'/></iq>")
        x = parse_incoming(xml, 'xmpp')
        self.assertEqual(x, IqBind(iq_id='b1'))

    def test_open(self) -> None:
        xml = (
            "<open xmlns='urn:ietf:params:xml:ns:xmpp-framing' "
            f"version='1.0' to='{LSERVER}'/>")
        x = parse_incoming(xml, 'xmpp')
        self.assertEqual(x, StreamOpenReq(version='1.0', to=LSERVER))


if __name__ == '__main__':
    unittest.main()
