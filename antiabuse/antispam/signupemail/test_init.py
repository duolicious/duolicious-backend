import unittest
from antiabuse.antispam.signupemail import normalize_email_domain

class TestNormalizeEmailDomain(unittest.TestCase):

    def test_gmail(self):
        self.assertEqual(
            normalize_email_domain('asdf@gmail.com'),
            'asdf@gmail.com',
        )

    def test_googlemail(self):
        self.assertEqual(
            normalize_email_domain('asdf@googlemail.com'),
            'asdf@gmail.com',
        )

    def test_other(self):
        self.assertEqual(
            normalize_email_domain('asdf@example.com'),
            'asdf@example.com',
        )


if __name__ == '__main__':
    unittest.main()
