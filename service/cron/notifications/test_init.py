import os
os.environ['DUO_CRON_NOTIFICATIONS_DRY_RUN'] = 'false'

import unittest
from unittest.mock import patch, MagicMock
from service.cron.notifications import (
    PersonNotification,
    send_mobile_notification, # TODO: New implementation
    send_notification,
)
import asyncio
import json

person_notification = PersonNotification(
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
    token='asdf',
)

class TestSendNotification(unittest.TestCase):

    @patch('service.cron.notifications.delete_mobile_token')
    @patch('service.cron.notifications.send_mobile_notification')
    @patch('service.cron.notifications.send_email_notification')
    def test_mobile_send_when_token_present(
        self,
        mock_delete_mobile_token,
        mock_send_mobile_notification,
        mock_send_email_notification,
    ):

        # Call the send_notification function
        asyncio.run(send_notification(person_notification))

        # Assert that send_mobile_notification was called
        mock_send_mobile_notification.assert_called_once_with(person_notification)

        # Assert that send_email_notification was not called
        mock_send_email_notification.assert_not_called()

        mock_delete_mobile_token.assert_not_called()


class TestSendMobileNotification(unittest.TestCase):

    @patch('urllib.request.urlopen')
    def test_send_mobile_notification_success(self, mock_urlopen):
        # Set up the mock response to simulate a successful notification
        mock_urlopen.return_value.__enter__.return_value.read.return_value = \
            json.dumps({'data': {'status': 'ok'}}).encode('utf-8')

        # Call the send_mobile_notification function
        result = send_mobile_notification(person_notification)

        # Assert that the function returned True
        self.assertTrue(result)

    @patch('urllib.request.urlopen')
    def test_send_mobile_notification_failure(self, mock_urlopen):
        # Set up the mock response to simulate a failed notification
        mock_urlopen.return_value.__enter__.return_value.read.return_value = \
            json.dumps({'data': {'status': 'error'}}).encode('utf-8')

        # Call the send_mobile_notification function
        result = send_mobile_notification(person_notification)

        # Assert that the function returned False
        self.assertFalse(result)


if __name__ == '__main__':
    unittest.main()
