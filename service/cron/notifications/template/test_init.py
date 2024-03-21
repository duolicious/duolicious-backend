import unittest
from service.cron.notifications.template import emailtemplate

class TestEmailTemplate(unittest.TestCase):

    def test_stuff(self):
        e1 = emailtemplate('mail@example.com', has_intro=True, has_chat=True)
        e2 = emailtemplate('mail@example.com', has_intro=True, has_chat=False)
        e3 = emailtemplate('mail@example.com', has_intro=False, has_chat=True)
        e4 = emailtemplate('mail@example.com', has_intro=False, has_chat=False)

        self.assertIn('new messages', e1)
        self.assertIn('a new message', e2)
        self.assertIn('a new message', e3)
        self.assertIn('support@duolicious.app', e4)

if __name__ == '__main__':
    unittest.main()
