import unittest
from unittest.mock import patch, MagicMock
from notify import enqueue_mobile_notification, _batcher
import json
import time

_batcher.set_flush_interval(1e-2)
time.sleep(1.1) # Wait for the new flush interval to take effect

class TestSendMobileNotification(unittest.TestCase):

    def test_enqueue_mobile_notification_success(self):
        # Set up a sacrificial urlopen function to consume any retried
        # notifications
        with patch('urllib.request.urlopen') as mock_urlopen:
            mock_urlopen.return_value.__enter__.return_value.read.return_value = \
                json.dumps({'data': [{'status': 'ok'}]}).encode('utf-8')

            # Wait for retried notifications to be consumed
            time.sleep(1e-1)

        # Set up the mock response to simulate a successful notification
        with patch('urllib.request.urlopen') as mock_urlopen:
            mock_urlopen.return_value.__enter__.return_value.read.return_value = \
                json.dumps({'data': [{'status': 'ok'}]}).encode('utf-8')

            # Call the _enqueue_mobile_notification function
            enqueue_mobile_notification(
                token='my-token',
                title='My title',
                body='My body 1',
            )

            enqueue_mobile_notification(
                token='my-token',
                title='My title',
                body='My body 2',
            )

            enqueue_mobile_notification(
                token='my-token',
                title='My title',
                body='My body 3',
            )

            # Wait for notification be sent
            time.sleep(1e-1)

        expected_data_call_1 = json.dumps(
            [
                {
                    "to": "my-token",
                    "title": "My title",
                    "body": "My body 1",
                    "sound": "default",
                    "priority": "high",
                },
            ]
        ).encode('utf-8')

        expected_data_call_2 = json.dumps(
            [
                {
                    "to": "my-token",
                    "title": "My title",
                    "body": "My body 2",
                    "sound": "default",
                    "priority": "high",
                },
                {
                    "to": "my-token",
                    "title": "My title",
                    "body": "My body 3",
                    "sound": "default",
                    "priority": "high",
                },
            ]
        ).encode('utf-8')

        self.assertEqual(len(mock_urlopen.call_args_list), 2)

        request = mock_urlopen.call_args_list[0][0][0]
        self.assertEqual(request.full_url, 'http://localhost')
        self.assertEqual(request.data, expected_data_call_1)
        self.assertEqual(request.headers['Content-type'], 'application/json')

        request = mock_urlopen.call_args_list[1][0][0]
        self.assertEqual(request.full_url, 'http://localhost')
        self.assertEqual(request.data, expected_data_call_2)
        self.assertEqual(request.headers['Content-type'], 'application/json')


    def test_enqueue_mobile_notification_failure(self):
        # Set up a sacrificial urlopen function to consume any retried
        # notifications
        with patch('urllib.request.urlopen') as mock_urlopen:
            mock_urlopen.return_value.__enter__.return_value.read.return_value = \
                json.dumps({'data': [{'status': 'ok'}]}).encode('utf-8')

            # Wait for retried notifications to be consumed
            time.sleep(1e-1)

        # Set up the mock response to simulate a successful notification
        with patch('urllib.request.urlopen') as mock_urlopen:
            mock_urlopen.return_value.__enter__.return_value.read.return_value = \
                json.dumps({'data': [{'status': 'error'}]}).encode('utf-8')

            # Call the _enqueue_mobile_notification function
            enqueue_mobile_notification(
                token='my-token',
                title='My title',
                body='My body',
            )

            # Wait for notification be sent
            time.sleep(1e-1)

        # Assert that the URL and data sent are correct
        expected_data = json.dumps([{
            "to": "my-token",
            "title": "My title",
            "body": "My body",
            "sound": "default",
            "priority": "high",
        }]).encode('utf-8')

        request = mock_urlopen.call_args_list[0][0][0]
        self.assertEqual(request.full_url, 'http://localhost')
        self.assertEqual(request.data, expected_data)
        self.assertEqual(request.headers['Content-type'], 'application/json')


if __name__ == '__main__':
    unittest.main()
