import unittest

from service.api.trials import club_card_by_distance, sent_messages_in_chats


class TestSentMessagesInChats(unittest.TestCase):
    def test_arms(self) -> None:
        for person_id, expected in [
            (4, False),
            (389200, False),
            (390248, False),
            (390249, False),
            (390250, True),
            (390251, False),
            (390252, True),
            (390253, False),
            (391398, True),
            (391399, False),
            (391400, True),
            (391548, True),
            (391549, False),
            (391550, False),
            (391551, False),
            (391552, False),
        ]:
            with self.subTest(person_id=person_id):
                self.assertEqual(sent_messages_in_chats(person_id), expected)


class TestClubCardByDistance(unittest.TestCase):
    def test_arms(self) -> None:
        for person_id, expected in [
            (4, False),
            (391550, False),
            (393448, False),
            (393449, False),
            (393450, True),
            (393451, False),
            (393452, True),
            (393453, False),
        ]:
            with self.subTest(person_id=person_id):
                self.assertEqual(club_card_by_distance(person_id), expected)


if __name__ == '__main__':
    unittest.main()
