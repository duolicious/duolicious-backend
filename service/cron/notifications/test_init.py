import unittest
from unittest.mock import patch, MagicMock
from service.cron.notifications import (
    PersonNotification,
    send_mobile_notification,
    send_notification,
)
import asyncio
import json

def make_person_notification(**overrides) -> PersonNotification:
    kwargs = dict(
        person_uuid='2',
        last_intro_notification_seconds=1693786048,
        last_chat_notification_seconds=1693786048,
        has_intro=True,
        has_chat=True,
        last_intro_seconds=1693786124,
        last_chat_seconds=100,
        name='jk',
        email='user.1@gmail.com',
        chats_drift_seconds=0,
        intros_drift_seconds=86400,
        tokens=['asdf'],
    )
    kwargs.update(overrides)
    return PersonNotification(**kwargs)


person_notification = make_person_notification()

class TestSendNotification(unittest.TestCase):

    @patch('service.cron.notifications.send_email_notification')
    @patch('service.cron.notifications.send_mobile_notification')
    def test_mobile_send_when_token_present(
        self,
        mock_send_mobile_notification,
        mock_send_email_notification,
    ):

        # Call the send_notification function
        asyncio.run(send_notification(person_notification))

        # Assert that send_mobile_notification was called
        mock_send_mobile_notification.assert_called_once_with(person_notification)

        # Assert that send_email_notification was not called
        mock_send_email_notification.assert_not_called()

    @patch('service.cron.notifications.send_email_notification')
    @patch('service.cron.notifications.send_mobile_notification')
    def test_email_only_when_no_tokens(
        self,
        mock_send_mobile_notification,
        mock_send_email_notification,
    ):
        row = make_person_notification(tokens=[])

        asyncio.run(send_notification(row))

        # No reachable push device: email only, no push.
        mock_send_mobile_notification.assert_not_called()
        mock_send_email_notification.assert_called_once_with(row)

    @patch('service.cron.notifications.send_email_notification')
    @patch('service.cron.notifications.send_mobile_notification')
    def test_email_only_when_web_only(
        self,
        mock_send_mobile_notification,
        mock_send_email_notification,
    ):
        # Web-only user: the sole (web) session contributes a None token.
        row = make_person_notification(tokens=[None])

        asyncio.run(send_notification(row))

        mock_send_mobile_notification.assert_not_called()
        mock_send_email_notification.assert_called_once_with(row)

    @patch('service.cron.notifications.send_email_notification')
    @patch('service.cron.notifications.send_mobile_notification')
    def test_mobile_and_email_when_web_most_recent(
        self,
        mock_send_mobile_notification,
        mock_send_email_notification,
    ):
        # Has a push token but the most recent session is a web client (None).
        row = make_person_notification(tokens=['asdf', None])

        asyncio.run(send_notification(row))

        # User has push tokens but was last seen on a web client: send both.
        mock_send_mobile_notification.assert_called_once_with(row)
        mock_send_email_notification.assert_called_once_with(row)

    @patch('service.cron.notifications.send_email_notification')
    @patch('service.cron.notifications.send_mobile_notification')
    def test_mobile_only_when_mobile_most_recent(
        self,
        mock_send_mobile_notification,
        mock_send_email_notification,
    ):
        # No None entry: the most recent session is a (reachable) mobile one.
        row = make_person_notification(tokens=['asdf'])

        asyncio.run(send_notification(row))

        # A mobile session was more recent than any web session: push only.
        mock_send_mobile_notification.assert_called_once_with(row)
        mock_send_email_notification.assert_not_called()


if __name__ == '__main__':
    unittest.main()
