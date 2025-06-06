import unittest
from antiabuse.antirude.displayname import is_rude

class TestIsRude(unittest.TestCase):

    def test_rude_strings(self):
        self.assertTrue(
                is_rude("You're a nigg"))

        self.assertTrue(
                is_rude("You're a 𝖓𝖎𝖌𝖌𝖊𝖗"))

        self.assertTrue(
                is_rude("ywnbaw is an acronym"))

    def test_non_rude_strings(self):
        self.assertFalse(
                is_rude("bot-reporter-of-sender-11"))

        self.assertFalse(
                is_rude("go hug urself please"))

        self.assertFalse(
                is_rude("I respect you"))

        self.assertFalse(
                is_rude("Who're you listening to?"))

        self.assertFalse(
                is_rude("Can u c my pfp?"))

        self.assertFalse(
                is_rude("I am therapist"))


if __name__ == '__main__':
    unittest.main()
