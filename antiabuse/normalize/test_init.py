import unittest
from antiabuse.normalize import normalize_string

class TestNormalizeString(unittest.TestCase):

    def test_normalize_string(self):
        self.assertEqual(normalize_string("fuk"), "fuck")

        self.assertEqual(normalize_string("ccvvvmmm"), "cum")

        self.assertEqual(normalize_string("r4p3"), "rape")

        self.assertEqual(normalize_string("raype"), "rape")

        self.assertEqual(normalize_string("a55"), "ass")

        self.assertEqual(normalize_string("𝖓𝖎𝖌𝖌𝖊𝖗"), "nigger")

        self.assertEqual(normalize_string("𝖓𝖎𝖌𝖌𝖊"), "nigger")

        self.assertEqual(normalize_string("unr4pe-able"), "unrapeable")

        self.assertEqual(normalize_string("s3lf h4rm"), "self harm")

        self.assertEqual(normalize_string("tr@nnies"), "trannies")

        self.assertEqual(normalize_string("tr@nny"), "tranny")

        self.assertEqual(normalize_string("niggreess"), "negress")

        self.assertEqual(normalize_string("slūt"), "slut")

        self.assertEqual(normalize_string("dyck"), "dick")

        self.assertEqual(normalize_string("niga"), "nigga")


if __name__ == '__main__':
    unittest.main()
