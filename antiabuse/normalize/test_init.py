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

        self.assertEqual(normalize_string("𝖓𝖎𝖌𝖌𝖊"), "nigga")

        self.assertEqual(normalize_string("unr4pe-able"), "unrapeable")

        self.assertEqual(normalize_string("s3lf h4rm"), "self harm")

        self.assertEqual(normalize_string("tr@nnies"), "trannies")

        self.assertEqual(normalize_string("tr@nny"), "tranny")

        self.assertEqual(normalize_string("niggreess"), "negress")

        self.assertEqual(normalize_string("slūt"), "slut")

        self.assertEqual(normalize_string("dyck"), "dick")

        self.assertEqual(normalize_string("niga"), "nigga")

        self.assertEqual(normalize_string("wh0r3$"), "whores")

        self.assertEqual(normalize_string("fo0tj0b$"), "footjobs")

        self.assertEqual(normalize_string("fo0tj0b"), "footjob")

        self.assertEqual(normalize_string("tr00nz"), "troons")

        self.assertEqual(normalize_string("r4p3d"), "raped")

        self.assertEqual(normalize_string("b4ck sh0tz"), "backshots")

        self.assertEqual(normalize_string("fk"), "fuck")

        self.assertEqual(normalize_string("sht"), "shit")

        self.assertEqual(normalize_string("bytch"), "bitch")

        self.assertEqual(normalize_string("su1cide"), "suicide")

        self.assertEqual(normalize_string("pyss"), "piss")

        self.assertEqual(normalize_string("b00bies"), "boobies")

        self.assertEqual(normalize_string("nigguhh"), "nigga")

        self.assertEqual(normalize_string("neggers"), "niggers")

        self.assertEqual(normalize_string("dike"), "dyke")

        self.assertEqual(normalize_string("d1k3"), "dyke")

        self.assertEqual(normalize_string("nyigger"), "nigger")

        self.assertEqual(normalize_string("nigguh"), "nigga")

        self.assertEqual(normalize_string("nyggr"), "nigger")

        self.assertEqual(normalize_string("urself"), "yourself")

        self.assertEqual(normalize_string("nigg"), "nigger")

        self.assertEqual(normalize_string("fag0t"), "faggot")

        self.assertEqual(normalize_string("r@ping"), "raping")


if __name__ == '__main__':
    unittest.main()
