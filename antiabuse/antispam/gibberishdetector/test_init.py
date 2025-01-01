import unittest
from antiabuse.antispam.gibberishdetector import has_gibberish

class TestContainsGibberish(unittest.TestCase):

    def test_gibberish_strings(self):
        self.assertTrue(
                has_gibberish(
                    "a"))

        self.assertTrue(
                has_gibberish(
                    "Boyden please join discord.gg/redacted and join vc :3 🚤🛸🟅💈41050046"))

        self.assertTrue(
                has_gibberish(
                    "Luca please join discord.gg/redacted and join voice chat 41050046"))

        self.assertTrue(
                has_gibberish(
                    "3e181e273d1a406b8173135c1393b024"))

        self.assertTrue(
                has_gibberish(
                    "1817481104444041323937"))

        self.assertTrue(
                has_gibberish(
                    "𝓮𝔁𝓪𝓶𝓹𝓵𝓮.𝓬𝓸𝓶/𝓯𝓻𝓮𝓪𝓴𝔂"))

        self.assertTrue(
                has_gibberish(
                    "What does 👅🍆🍑 🌮💦 mean?"))

        self.assertTrue(
                has_gibberish(
                    "Hello how are you doing Text me on telegram,, @laura_rosaline_klein   or. add my Zangi private number 1061353927"))

        self.assertTrue(
                has_gibberish(
                    """EPSSVSMMKVIPGFJR

Alex meow """))

        self.assertTrue(
                has_gibberish(
                    """WIGLXVAQTLRIIKQT

Takakura ken meow """))

        self.assertTrue(
                has_gibberish(
                    """KUNBJDRUBDKRSWUY

Morgan meow """))

        self.assertTrue(
                has_gibberish(
                    "Welcome to online dating 4328"))

        self.assertTrue(
                has_gibberish(
                    "Welcome to online dating 🤙🕼🨤😁🝬🚠🛔🛅🤆🦣🤂🍫🎀🥃🥮🌍🚋💡🜴"))


    def test_non_gibberish_strings(self):
        self.assertFalse(
                has_gibberish(
                    ""))

        self.assertFalse(
                has_gibberish(
                    "hey"))

        self.assertFalse(
                has_gibberish(
                    "hi"))

        self.assertFalse(
                has_gibberish(
                    "i love ur pfp 😂😂😂"))

        self.assertFalse(
                has_gibberish(
                    "bruh 💀💀💀\n\nclowns freak me out too"))

        self.assertFalse(
                has_gibberish(
                    "How are you? 🙂\n\nI've been meaning to write but I've just been busy."))

        self.assertFalse(
                has_gibberish(
                    "Welcome to online dating 101"))

        self.assertFalse(
                has_gibberish(
                    "Online dating, but based and true love-pilled 💕"))

        self.assertFalse(
                has_gibberish(
                    "Sometimes people spam links to discord servers. It'd be nice to filter those out."))

        self.assertFalse(
                has_gibberish(
                    "I think ur cute :3"))

        self.assertFalse(
                has_gibberish(
                    """
I'd just like to interject for a moment. What you're refering to as Linux, is in fact, GNU/Linux, or as I've recently taken to calling it, GNU plus Linux. Linux is not an operating system unto itself, but rather another free component of a fully functioning GNU system made useful by the GNU corelibs, shell utilities and vital system components comprising a full OS as defined by POSIX.

Many computer users run a modified version of the GNU system every day, without realizing it. Through a peculiar turn of events, the version of GNU which is widely used today is often called Linux, and many of its users are not aware that it is basically the GNU system, developed by the GNU Project.

There really is a Linux, and these people are using it, but it is just a part of the system they use. Linux is the kernel: the program in the system that allocates the machine's resources to the other programs that you run. The kernel is an essential part of an operating system, but useless by itself; it can only function in the context of a complete operating system. Linux is normally used in combination with the GNU operating system: the whole system is basically GNU with Linux added, or GNU/Linux. All the so-called Linux distributions are really distributions of GNU/Linux!
                    """.strip()))

        self.assertFalse(
                has_gibberish("在一个阳光明媚的早晨。"))

        self.assertFalse(
                has_gibberish("Ich finde dich süß. Hast du einen Freund?"))

        self.assertFalse(
                has_gibberish("Я думаю, что ты милый. У тебя есть парень?"))

        self.assertFalse(
                has_gibberish("初めまして。お元気ですか？お名前は何ですか？"))

        self.assertFalse(
                has_gibberish("you\nwon't\nbelieve it"))


if __name__ == '__main__':
    unittest.main()
