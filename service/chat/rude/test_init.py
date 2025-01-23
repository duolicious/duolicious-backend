import unittest
from service.chat.rude import is_rude

class TestIsOffensive(unittest.TestCase):

    def test_rude_strings(self):
        self.assertTrue(
                is_rude("fuk your as$"))

        self.assertTrue(
                is_rude("go fk urself please"))

        self.assertTrue(
                is_rude("GO FK URSELF PLEASE"))

        self.assertTrue(
                is_rude("I want to cvm on u"))

        self.assertTrue(
                is_rude("I'm cumming"))

        self.assertTrue(
                is_rude("I want to ccccuuummmm on u"))

        self.assertTrue(
                is_rude("You're a whore. Respectfully."))

        self.assertTrue(
                is_rude("Small dick energy"))

        self.assertTrue(
                is_rude("Would you like to purchase viagra?"))

        # whore is rude even if followed by an emoji without space between
        self.assertTrue(
                is_rude("you are a whore🙂"))

        self.assertTrue(
                is_rude("you are a whore!"))

        # Homoglyph attacks. The letter "o" in "whоre" has been replaced with a
        # Cyrillic "о" (Unicode character U+043E), which looks identical to the
        # Latin "o" (Unicode character U+006F)
        self.assertTrue(
                is_rude("you filthy degеnerate pоrn addicted whоre !"))

        self.assertTrue(
                is_rude("I am the rapist"))

        self.assertTrue(
                is_rude("I am a p3d0"))

        self.assertTrue(
                is_rude("Wanna get piped down?"))

    def test_non_rude_strings(self):
        self.assertFalse(
                is_rude("She piped up after realizing that"))

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

    # Using Cyrillic characters
    def test_cyrillic_substitution(self):
        # Substituting "a" with Cyrillic "а" (U+0430)
        self.assertTrue(is_rude("gаg me"))
        # Substituting "e" with Cyrillic "е" (U+0435)
        self.assertTrue(is_rude("gave mе head"))
        # Mixed Latin and Cyrillic characters
        self.assertTrue(is_rude("fuckаblе"))

    # Using Greek characters
    def test_greek_substitution(self):
        # Substituting "o" with Greek "ο" (U+03BF)
        self.assertTrue(is_rude("gοok"))
        # Substituting "i" with Greek "ι" (U+03B9)
        self.assertTrue(is_rude("gιmme head"))


if __name__ == '__main__':
    unittest.main()
