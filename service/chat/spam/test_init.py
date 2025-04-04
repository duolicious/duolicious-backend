import unittest
from service.chat.spam import is_spam

class TestIsOffensive(unittest.TestCase):

    def test_spam_strings(self):
        self.assertFalse(
                is_spam("I am therapist"))

        self.assertFalse(
                is_spam("https://media.tenor.com/dxsHgu0_-QAAAAAMx/meganleigh-megaxn.gif"))

        # because it contains gibberish
        self.assertTrue(
                is_spam("look at this https://media.tenor.com/dxsHgu0_-QAAAAAMx/meganleigh-megaxn.gif"))

        # because it also contains gibberish
        self.assertTrue(
                is_spam("/dxsHgu0_-QAAAAAMx/"))

        # Because the domain isn't considered safe
        self.assertTrue(
                is_spam("look at this https://mycoolsite.com"))


if __name__ == '__main__':
    unittest.main()
