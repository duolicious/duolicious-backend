import unittest
from antirude.profile import is_offensive

class TestIsOffensive(unittest.TestCase):

    def test_offensive_strings(self):
        self.assertTrue(
                is_offensive("You're a nigg"))

        self.assertTrue(
                is_offensive("ywnbaw is an acronym"))

    def test_inoffensive_strings(self):
        self.assertFalse(
                is_offensive("go hug urself please"))

        self.assertFalse(
                is_offensive("I respect you"))

        self.assertFalse(
                is_offensive("What you're referring to as Linux is GNU/Linux"))

        self.assertFalse(
                is_offensive("Who're you listening to?"))

        self.assertFalse(
                is_offensive("Can u c my pfp?"))

        self.assertFalse(
                is_offensive("I am therapist"))


if __name__ == '__main__':
    unittest.main()
