import unittest
from service.chat.ratelimit import (
    get_default_rate_limit,
    get_stanza,
    DefaultRateLimit,
    Row,
)

class TestRateLimit(unittest.TestCase):

    # get_default_rate_limit tests

    def test_photos_default_normal(self):
        # verification_level_id = 3 → DefaultRateLimit.PHOTOS, limit = 50//1 = 50
        # below the limit → NONE
        row = Row(verification_level_id=3, daily_message_count=49, weekly_report_count=0)
        self.assertEqual(get_default_rate_limit(row), DefaultRateLimit.NONE)
        # at the limit → PHOTOS
        row = Row(verification_level_id=3, daily_message_count=50, weekly_report_count=0)
        self.assertEqual(get_default_rate_limit(row), DefaultRateLimit.PHOTOS)
        # above the limit → still PHOTOS
        row = Row(verification_level_id=3, daily_message_count=100, weekly_report_count=0)
        self.assertEqual(get_default_rate_limit(row), DefaultRateLimit.PHOTOS)

    def test_basics_under_and_at_limit(self):
        # verification_level_id = 2 → DefaultRateLimit.BASICS
        # weekly_report_count = 1 → limit = 20 // (1+1)^2 = 5
        row = Row(verification_level_id=2, daily_message_count=4, weekly_report_count=1)
        self.assertEqual(get_default_rate_limit(row), DefaultRateLimit.NONE)
        row = Row(verification_level_id=2, daily_message_count=5, weekly_report_count=1)
        self.assertEqual(get_default_rate_limit(row), DefaultRateLimit.BASICS)
        row = Row(verification_level_id=2, daily_message_count=6, weekly_report_count=1)
        self.assertEqual(get_default_rate_limit(row), DefaultRateLimit.BASICS)

    def test_unverified_under_and_at_limit(self):
        # verification_level_id = 1 → DefaultRateLimit.UNVERIFIED, limit = 10 // 1 = 10
        row = Row(verification_level_id=1, daily_message_count=9, weekly_report_count=0)
        self.assertEqual(get_default_rate_limit(row), DefaultRateLimit.NONE)
        row = Row(verification_level_id=1, daily_message_count=10, weekly_report_count=0)
        self.assertEqual(get_default_rate_limit(row), DefaultRateLimit.UNVERIFIED)
        row = Row(verification_level_id=1, daily_message_count=15, weekly_report_count=0)
        self.assertEqual(get_default_rate_limit(row), DefaultRateLimit.UNVERIFIED)

    def test_limit_zero_branch_returns_max_enum(self):
        # when limit == 0 we should get max(DefaultRateLimit) == PHOTOS
        # UNVERIFIED: 10 // (1+3)^2 = 10//16 = 0
        row = Row(verification_level_id=1, daily_message_count=0, weekly_report_count=3)
        self.assertEqual(get_default_rate_limit(row), DefaultRateLimit.PHOTOS)
        # BASICS: 20 // (1+4)^2 = 20//25 = 0
        row = Row(verification_level_id=2, daily_message_count=100, weekly_report_count=4)
        self.assertEqual(get_default_rate_limit(row), DefaultRateLimit.PHOTOS)
        # PHOTOS: 50 // (1+7)^2 = 50//64 = 0
        row = Row(verification_level_id=3, daily_message_count=0, weekly_report_count=7)
        self.assertEqual(get_default_rate_limit(row), DefaultRateLimit.PHOTOS)

    def test_unhandled_verification_level(self):
        row = Row(verification_level_id=0, daily_message_count=0, weekly_report_count=0)
        with self.assertRaises(Exception) as cm:
            get_default_rate_limit(row)
        self.assertIn('Unhandled verification_level_id', str(cm.exception))


    # get_stanza tests

    def test_get_stanza_none(self):
        self.assertEqual(get_stanza(DefaultRateLimit.NONE, 'foo'), [])

    def test_get_stanza_unverified(self):
        self.assertEqual(
            get_stanza(DefaultRateLimit.UNVERIFIED, 'bar'),
            ['<duo_message_blocked id="bar" reason="rate-limited-1day" subreason="unverified-basics"/>']
        )

    def test_get_stanza_basics(self):
        self.assertEqual(
            get_stanza(DefaultRateLimit.BASICS, 'baz'),
            ['<duo_message_blocked id="baz" reason="rate-limited-1day" subreason="unverified-photos"/>']
        )

    def test_get_stanza_photos(self):
        self.assertEqual(
            get_stanza(DefaultRateLimit.PHOTOS, 'qux'),
            ['<duo_message_blocked id="qux" reason="rate-limited-1day"/>']
        )

    def test_get_stanza_unhandled_enum(self):
        class FakeLimit: pass
        with self.assertRaises(Exception) as cm:
            get_stanza(FakeLimit(), 'xyz')
        self.assertIn('Unhandled rate limit reason', str(cm.exception))


if __name__ == '__main__':
    unittest.main()
