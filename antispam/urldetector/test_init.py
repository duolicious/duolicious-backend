import unittest
from antispam.urldetector import contains_url

class TestContainsUrl(unittest.TestCase):

    def test_url_strings(self):
        self.assertTrue(
                contains_url("join discord.gg/example"))

        self.assertTrue(
                contains_url("join discord   .    gg/example"))

        self.assertTrue(
                contains_url("join discord [dot] gg/example"))

        self.assertTrue(
                contains_url("join discord dot gg/example"))

        self.assertTrue(
                contains_url("join discord d0t gg/example"))

        self.assertTrue(
                contains_url("join discord d0t gg/example"))

        self.assertTrue(
                contains_url("join discord d0t gg"))

        self.assertTrue(
            contains_url("𝓱𝓽𝓽𝓹𝓼://𝓮𝔁𝓪𝓶𝓹𝓵𝓮.𝓬𝓸𝓶/𝓮𝔁𝓪𝓶𝓹𝓵𝓮 ❤️"))

        self.assertTrue(
            contains_url("Visit bio.you for more info"))

        self.assertTrue(
            contains_url("Visit example. com for all your exemplar needs"))

        self.assertTrue(
            contains_url("Visit example, com for all your exemplar needs"))

        self.assertTrue(
            contains_url("Visit example .com for all your exemplar needs"))

        self.assertTrue(
            contains_url("example. com has all your exemplar needs"))

        self.assertTrue(
            contains_url("mail me at 31c49caa5@gmail.com"))


    def test_non_url_strings(self):
        self.assertFalse(contains_url("I like your bio."))

        self.assertFalse(contains_url("I like your bio. Common bios are boring"))

        self.assertFalse(contains_url("I like your bio. You seem pretty cool."))

        self.assertFalse(contains_url("I like your bio. you seem pretty cool."))

        self.assertFalse(contains_url("I like your bio, you seem pretty cool."))

        self.assertFalse(contains_url("I like your bio; you seem pretty cool."))


if __name__ == '__main__':
    unittest.main()
