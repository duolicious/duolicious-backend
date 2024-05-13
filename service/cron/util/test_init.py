import unittest
from service.cron.notifications import (
    PersonNotification,
    do_send_email_notification,
    join_lists_of_dicts,
)

class TestJoinListsOfDicts(unittest.TestCase):

    def test_basic_join(self):
        l1 = [
            {'id': 3, 'name': 'Joe'},
            {'id': 1, 'name': 'Alice'},
            {'id': 2, 'name': 'Bob'},
        ]
        l2 = [
            {'id': 2, 'age': 30},
            {'id': 1, 'age': 25},
            {'id': 3, 'age': 35},
        ]

        result = join_lists_of_dicts(l1, l2, 'id')

        expected = [
            {'id': 1, 'name': 'Alice', 'age': 25},
            {'id': 2, 'name': 'Bob', 'age': 30},
            {'id': 3, 'name': 'Joe', 'age': 35},
        ]

        self.assertEqual(result, expected)

    def test_mismatched_keys(self):
        l1 = [
            {'id': 1, 'name': 'Alice'},
            {'id': 3, 'name': 'Charlie'},
        ]
        l2 = [
            {'id': 2, 'age': 30},
            {'id': 1, 'age': 25},
        ]

        result = join_lists_of_dicts(l1, l2, 'id')

        expected = [
            {'id': 1, 'name': 'Alice', 'age': 25},
        ]

        self.assertEqual(result, expected)

class TestDoSend(unittest.TestCase):

    def test_stuff(self):
        dont_care = dict(
            person_uuid='0',
            name='user0',
            token=None,
        )

        self.assertFalse(do_send_email_notification(PersonNotification(
            **dont_care,
            email='asdf@exaMPle.com',
            has_intro=True,
            has_chat=True,
            last_intro_seconds=1,
            last_chat_seconds=1,
            last_intro_notification_seconds=0,
            last_chat_notification_seconds=0,
            intros_drift_seconds=0,
            chats_drift_seconds=0)))

        self.assertFalse(do_send_email_notification(PersonNotification(
            **dont_care,
            email='asdf@notexample.com',
            has_intro=True,
            has_chat=True,
            last_intro_seconds=1,
            last_chat_seconds=1,
            last_intro_notification_seconds=0,
            last_chat_notification_seconds=0,
            intros_drift_seconds=-1,
            chats_drift_seconds=-1)))

        self.assertFalse(do_send_email_notification(PersonNotification(
            **dont_care,
            email='asdf@notexample.com',
            has_intro=False,
            has_chat=True,
            last_intro_seconds=1,
            last_chat_seconds=1,
            last_intro_notification_seconds=0,
            last_chat_notification_seconds=0,
            intros_drift_seconds=0,
            chats_drift_seconds=-1)))

        self.assertFalse(do_send_email_notification(PersonNotification(
            **dont_care,
            email='asdf@notexample.com',
            has_intro=True,
            has_chat=False,
            last_intro_seconds=1,
            last_chat_seconds=1,
            last_intro_notification_seconds=0,
            last_chat_notification_seconds=0,
            intros_drift_seconds=-1,
            chats_drift_seconds=0)))

        self.assertTrue(do_send_email_notification(PersonNotification(
            **dont_care,
            email='asdf@notexample.com',
            has_intro=True,
            has_chat=True,
            last_intro_seconds=1,
            last_chat_seconds=1,
            last_intro_notification_seconds=0,
            last_chat_notification_seconds=0,
            intros_drift_seconds=0,
            chats_drift_seconds=0)))

        self.assertTrue(do_send_email_notification(PersonNotification(
            **dont_care,
            email='asdf@notexample.com',
            has_intro=True,
            has_chat=False,
            last_intro_seconds=100,
            last_chat_seconds=100,
            last_intro_notification_seconds=90,
            last_chat_notification_seconds=90,
            intros_drift_seconds=5,
            chats_drift_seconds=50)))

        self.assertTrue(do_send_email_notification(PersonNotification(
            **dont_care,
            email='asdf@notexample.com',
            has_intro=False,
            has_chat=True,
            last_intro_seconds=100,
            last_chat_seconds=100,
            last_intro_notification_seconds=90,
            last_chat_notification_seconds=90,
            intros_drift_seconds=50,
            chats_drift_seconds=5)))

        self.assertFalse(do_send_email_notification(PersonNotification(
            **dont_care,
            email='asdf@notexample.com',
            has_intro=True,
            has_chat=False,
            last_intro_seconds=100,
            last_chat_seconds=100,
            last_intro_notification_seconds=90,
            last_chat_notification_seconds=99,
            intros_drift_seconds=50,
            chats_drift_seconds=5)))

        self.assertFalse(do_send_email_notification(PersonNotification(
            **dont_care,
            email='asdf@notexample.com',
            has_intro=False,
            has_chat=True,
            last_intro_seconds=100,
            last_chat_seconds=100,
            last_intro_notification_seconds=99,
            last_chat_notification_seconds=90,
            intros_drift_seconds=5,
            chats_drift_seconds=50)))

        real_notification = PersonNotification(
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
            token=None,
        )

        self.assertFalse(do_send_email_notification(real_notification))

if __name__ == '__main__':
    unittest.main()
