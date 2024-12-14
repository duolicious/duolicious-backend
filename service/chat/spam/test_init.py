import unittest
from service.chat.spam import is_spam

class TestIsSpam(unittest.TestCase):

    def test_spam_strings(self):
        self.assertTrue(
                is_spam("join discord.gg/example"))

        self.assertTrue(
                is_spam("join discord [dot] gg/example"))

        self.assertTrue(
                is_spam("join discord dot gg/example"))

        self.assertTrue(
                is_spam("join discord d0t gg/example"))

        self.assertTrue(
                is_spam("join discord d0t gg/example"))

        self.assertTrue(
            is_spam("𝓱𝓽𝓽𝓹𝓼://𝓮𝔁𝓪𝓶𝓹𝓵𝓮.𝓬𝓸𝓶/𝓮𝔁𝓪𝓶𝓹𝓵𝓮 ❤️"))


    def test_non_spam_strings(self):
        self.assertFalse(is_spam("I like your bio."))


if __name__ == '__main__':
    unittest.main()
