import unittest
from antiabuse.antispam.urldetector import has_url, UrlType

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

        self.assertTrue(has_url(
            """buy me gifts at throne.com/anakido"""))


    def test_non_url_strings(self):
        self.assertFalse(has_url("I like your bio."))

        self.assertFalse(has_url("I like your bio. Common bios are boring"))

        self.assertFalse(has_url("I like your bio. You seem pretty cool."))

        self.assertFalse(has_url("I like your bio. you seem pretty cool."))

        self.assertFalse(has_url("I like your bio, you seem pretty cool."))

        self.assertFalse(has_url("I like your bio; you seem pretty cool."))

        self.assertFalse(has_url("""
Currently living in Timbuktu! (Near Los Alamos) :3

Shy, very bubbly, and enjoys getting hugs, head pats, cuddling, and receiving lots of love in general. Bonus points if you can recognize my cosplays! 

My discord is a better place to reach me :3  @redacted

P.S: I kinda just want to be loved, like fall asleep on the phone with each other while pretending to cuddle each other 🙂

Also some clubs are just there to find people who might like me; I’m hetero unfortunately but I'm down to make guy friends too!
                                 """.strip()))

        self.assertFalse(has_url(
            """listen to my voice @ https://vocaroo.com/4ZZmAF81Pf"""))

        self.assertFalse(has_url(
            """I'm on discord, like all the time"""))

        self.assertFalse(has_url(
            """Check out my stats.fm @example"""))

    def test_tenor_match_1(self):
        haystack = "https://media.tenor.com/dxsHgu0_-QAAAAAMx/meganleigh-megaxn.gif"

        actual = has_url(haystack, include_safe=True, do_normalize=False)

        expected = [(UrlType.VERY_SAFE, haystack)]

        self.assertEqual(actual, expected)

    def test_tenor_match_2(self):
        needle = "https://media.tenor.com/dxsHgu0_-QAAAAAMx/meganleigh-megaxn.gif"

        haystack = "look at this https://media.tenor.com/dxsHgu0_-QAAAAAMx/meganleigh-megaxn.gif url"

        actual = has_url(haystack, include_safe=True, do_normalize=False)

        expected = [(UrlType.VERY_SAFE, needle)]

        self.assertEqual(actual, expected)



if __name__ == '__main__':
    unittest.main()
