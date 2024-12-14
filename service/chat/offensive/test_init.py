import unittest
from service.chat.offensive import is_offensive

class TestIsOffensive(unittest.TestCase):

    def test_offensive_strings(self):
        self.assertTrue(
                is_offensive("go fk urself please"))

        self.assertTrue(
                is_offensive("I want to cvm on u"))

        self.assertTrue(
                is_offensive("I'm cumming"))

        self.assertTrue(
                is_offensive("I want to ccccuuummmm on u"))

        self.assertTrue(
                is_offensive("You're a whore. Respectfully."))

        self.assertTrue(
                is_offensive("Small dick energy"))

        self.assertTrue(
                is_offensive("Would you like to purchase viagra?"))

        self.assertTrue(
                is_offensive("I am the rapist"))

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
