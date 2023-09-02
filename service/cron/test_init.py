import unittest
from service.cron import join_lists_of_dicts

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

if __name__ == '__main__':
    unittest.main()
