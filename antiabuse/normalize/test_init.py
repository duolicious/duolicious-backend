import unittest
from antiabuse.normalize import normalize_string

class TestNormalizeString(unittest.TestCase):

    def test_normalize_string(self):
        self.assertEqual(normalize_string("fuk"), "fuck")

        self.assertEqual(normalize_string("ccvvvmmm"), "cum")

        self.assertEqual(normalize_string("r4p3"), "rape")

        self.assertEqual(normalize_string("a55"), "ass")

        self.assertEqual(normalize_string("𝖓𝖎𝖌𝖌𝖊𝖗"), "nigger")

        self.assertEqual(normalize_string("𝖓𝖎𝖌𝖌𝖊"), "nigger")

        self.assertEqual(normalize_string("unr4pe-able"), "unrapeable")


if __name__ == '__main__':
    unittest.main()
