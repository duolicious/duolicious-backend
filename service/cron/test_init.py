import unittest
from service.cron import do_send, join_lists_of_dicts

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
        self.assertFalse(do_send(dict(
            email='asdf@exaMPle.com',
            intros=True,
            chats=True,
            now_seconds=1,
            last_notification_seconds=0,
            intros_drift_seconds=0,
            chats_drift_seconds=0)))

        self.assertFalse(do_send(dict(
            email='asdf@notexample.com',
            intros=True,
            chats=True,
            now_seconds=1,
            last_notification_seconds=0,
            intros_drift_seconds=-1,
            chats_drift_seconds=-1)))

        self.assertFalse(do_send(dict(
            email='asdf@notexample.com',
            intros=False,
            chats=True,
            now_seconds=1,
            last_notification_seconds=0,
            intros_drift_seconds=0,
            chats_drift_seconds=-1)))

        self.assertFalse(do_send(dict(
            email='asdf@notexample.com',
            intros=True,
            chats=False,
            now_seconds=1,
            last_notification_seconds=0,
            intros_drift_seconds=-1,
            chats_drift_seconds=0)))

        self.assertTrue(do_send(dict(
            email='asdf@notexample.com',
            intros=True,
            chats=True,
            now_seconds=1,
            last_notification_seconds=0,
            intros_drift_seconds=0,
            chats_drift_seconds=0)))

        self.assertTrue(do_send(dict(
            email='asdf@notexample.com',
            intros=True,
            chats=False,
            now_seconds=100,
            last_notification_seconds=90,
            intros_drift_seconds=5,
            chats_drift_seconds=50)))

        self.assertTrue(do_send(dict(
            email='asdf@notexample.com',
            intros=False,
            chats=True,
            now_seconds=100,
            last_notification_seconds=90,
            intros_drift_seconds=50,
            chats_drift_seconds=5)))

        self.assertFalse(do_send(dict(
            email='asdf@notexample.com',
            intros=True,
            chats=False,
            now_seconds=100,
            last_notification_seconds=90,
            intros_drift_seconds=50,
            chats_drift_seconds=5)))

        self.assertFalse(do_send(dict(
            email='asdf@notexample.com',
            intros=False,
            chats=True,
            now_seconds=100,
            last_notification_seconds=90,
            intros_drift_seconds=5,
            chats_drift_seconds=50)))

if __name__ == '__main__':
    unittest.main()
