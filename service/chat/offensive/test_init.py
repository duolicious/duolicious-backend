import unittest
from service.chat.offensive import is_offensive

class TestIsOffensive(unittest.TestCase):

    def test_offensive_strings(self):
        self.assertTrue(
                is_offensive("fuk your as$"))

        self.assertTrue(
                is_offensive("go fk urself please"))

        self.assertTrue(
                is_offensive("GO FK URSELF PLEASE"))

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

        # whore is offensive even if followed by an emoji without space between
        self.assertTrue(
                is_offensive("you are a whore🙂"))

        self.assertTrue(
                is_offensive("you are a whore!"))

        # Homoglyph attacks. The letter "o" in "whоre" has been replaced with a
        # Cyrillic "о" (Unicode character U+043E), which looks identical to the
        # Latin "o" (Unicode character U+006F)
        self.assertTrue(
                is_offensive("you filthy degеnerate pоrn addicted whоre !"))

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

    # Using Cyrillic characters
    def test_cyrillic_substitution(self):
        # Substituting "a" with Cyrillic "а" (U+0430)
        self.assertTrue(is_offensive("gаg me"))
        # Substituting "e" with Cyrillic "е" (U+0435)
        self.assertTrue(is_offensive("gave mе head"))
        # Mixed Latin and Cyrillic characters
        self.assertTrue(is_offensive("fuckаblе"))

    # Using Greek characters
    def test_greek_substitution(self):
        # Substituting "o" with Greek "ο" (U+03BF)
        self.assertTrue(is_offensive("gοok"))
        # Substituting "i" with Greek "ι" (U+03B9)
        self.assertTrue(is_offensive("gιmme head"))


if __name__ == '__main__':
    unittest.main()
