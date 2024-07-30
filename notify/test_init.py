import unittest
from unittest.mock import patch, MagicMock
from notify import send_mobile_notification
import json

class TestSendMobileNotification(unittest.TestCase):

    @patch('urllib.request.urlopen')
    def test_send_mobile_notification_success(self, mock_urlopen):
        # Set up the mock response to simulate a successful notification
        mock_urlopen.return_value.__enter__.return_value.read.return_value = \
            json.dumps({'data': {'status': 'ok'}}).encode('utf-8')

        # Call the _send_mobile_notification function
        result = send_mobile_notification(
            token='my-token',
            title='My title',
            body='My body',
        )

        # Assert that the function returned True
        self.assertTrue(result)

    @patch('urllib.request.urlopen')
    def test_send_mobile_notification_failure(self, mock_urlopen):
        # Set up the mock response to simulate a failed notification
        mock_urlopen.return_value.__enter__.return_value.read.return_value = \
            json.dumps({'data': {'status': 'error'}}).encode('utf-8')

        # Call the _send_mobile_notification function
        result = send_mobile_notification(
            token='my-token',
            title='My title',
            body='My body',
        )

        # Assert that the function returned False
        self.assertFalse(result)

if __name__ == '__main__':
    unittest.main()
