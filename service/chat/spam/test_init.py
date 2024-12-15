import unittest
from service.chat.spam import is_spam

class TestIsSpam(unittest.TestCase):

    def test_spam_strings(self):
        self.assertTrue(
                is_spam("join discord.gg/example"))

        self.assertTrue(
                is_spam("join discord   .    gg/example"))

        self.assertTrue(
                is_spam("join discord [dot] gg/example"))

        self.assertTrue(
                is_spam("join discord dot gg/example"))

        self.assertTrue(
                is_spam("join discord d0t gg/example"))

        self.assertTrue(
                is_spam("join discord d0t gg/example"))

        self.assertTrue(
                is_spam("join discord d0t gg"))

        self.assertTrue(
            is_spam("𝓱𝓽𝓽𝓹𝓼://𝓮𝔁𝓪𝓶𝓹𝓵𝓮.𝓬𝓸𝓶/𝓮𝔁𝓪𝓶𝓹𝓵𝓮 ❤️"))

        self.assertTrue(
            is_spam("Visit bio.you for more info"))

        self.assertTrue(
            is_spam("Visit example. com for all your exemplar needs"))

        self.assertTrue(
            is_spam("Visit example, com for all your exemplar needs"))

        self.assertTrue(
            is_spam("Visit example .com for all your exemplar needs"))

        self.assertTrue(
            is_spam("example. com has all your exemplar needs"))


    def test_non_spam_strings(self):
        self.assertFalse(is_spam("I like your bio."))

        self.assertFalse(is_spam("I like your bio. Common bios are boring"))

        self.assertFalse(is_spam("I like your bio. You seem pretty cool."))

        self.assertFalse(is_spam("I like your bio. you seem pretty cool."))

        self.assertFalse(is_spam("I like your bio, you seem pretty cool."))

        self.assertFalse(is_spam("I like your bio; you seem pretty cool."))


if __name__ == '__main__':
    unittest.main()
