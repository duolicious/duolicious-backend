import unittest
from antirude.profile import is_rude

class TestIsRude(unittest.TestCase):

    def test_rude_strings(self):
        self.assertTrue(
                is_rude("You're a nigg"))

        self.assertTrue(
                is_rude("ywnbaw is an acronym"))

    def test_inrude_strings(self):
        self.assertFalse(
                is_rude("go hug urself please"))

        self.assertFalse(
                is_rude("I respect you"))

        self.assertFalse(
                is_rude("What you're referring to as Linux is GNU/Linux"))

        self.assertFalse(
                is_rude("Who're you listening to?"))

        self.assertFalse(
                is_rude("Can u c my pfp?"))

        self.assertFalse(
                is_rude("I am therapist"))


if __name__ == '__main__':
    unittest.main()
