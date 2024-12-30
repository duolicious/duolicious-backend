import unittest
from antispam.urldetector import has_url

class TestContainsUrl(unittest.TestCase):

    def test_url_strings(self):
        self.assertTrue(
                has_url("join discord.gg/example"))

        self.assertTrue(
                has_url("join discord   .    gg/example"))

        self.assertTrue(
                has_url("join discord [dot] gg/example"))

        self.assertTrue(
                has_url("join discord dot gg/example"))

        self.assertTrue(
                has_url("join discord d0t gg/example"))

        self.assertTrue(
                has_url("join discord d0t gg/example"))

        self.assertTrue(
                has_url("join discord d0t gg"))

        self.assertTrue(
            has_url("𝓱𝓽𝓽𝓹𝓼://𝓮𝔁𝓪𝓶𝓹𝓵𝓮.𝓬𝓸𝓶/𝓮𝔁𝓪𝓶𝓹𝓵𝓮 ❤️"))

        self.assertTrue(
            has_url("Visit bio.you for more info"))

        self.assertTrue(
            has_url("Visit example. com for all your exemplar needs"))

        self.assertTrue(
            has_url("Visit example, com for all your exemplar needs"))

        self.assertTrue(
            has_url("Visit example .com for all your exemplar needs"))

        self.assertTrue(
            has_url("example. com has all your exemplar needs"))

        self.assertTrue(
            has_url("mail me at 31c49caa5@gmail.com"))


    def test_non_url_strings(self):
        self.assertFalse(has_url("I like your bio."))

        self.assertFalse(has_url("I like your bio. Common bios are boring"))

        self.assertFalse(has_url("I like your bio. You seem pretty cool."))

        self.assertFalse(has_url("I like your bio. you seem pretty cool."))

        self.assertFalse(has_url("I like your bio, you seem pretty cool."))

        self.assertFalse(has_url("I like your bio; you seem pretty cool."))


if __name__ == '__main__':
    unittest.main()
