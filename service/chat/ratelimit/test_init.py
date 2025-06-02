import unittest
from service.chat.ratelimit import (
    get_default_rate_limit,
    get_stanza,
    DefaultRateLimit,
    Row,
)

class TestRateLimit(unittest.TestCase):
    def test_photos_default_normal(self):
        """
        verification_level_id = 3 → DefaultRateLimit.PHOTOS (value 50)
        weekly_manual_report_count = 0 ⇒ limit = 50 // 2**0 = 50
        """
        row = Row(verification_level_id=3, daily_message_count=49, weekly_manual_report_count=0)
        self.assertEqual(get_default_rate_limit(row), DefaultRateLimit.NONE)

        row = Row(verification_level_id=3, daily_message_count=50, weekly_manual_report_count=0)
        self.assertEqual(get_default_rate_limit(row), DefaultRateLimit.PHOTOS)

        row = Row(verification_level_id=3, daily_message_count=100, weekly_manual_report_count=0)
        self.assertEqual(get_default_rate_limit(row), DefaultRateLimit.PHOTOS)

    def test_basics_halved_limit(self):
        """
        verification_level_id = 2 → DefaultRateLimit.BASICS (value 20)
        weekly_manual_report_count = 1 halves the limit: 20 // 2**1 = 10
        """
        row = Row(verification_level_id=2, daily_message_count=9, weekly_manual_report_count=1)
        self.assertEqual(get_default_rate_limit(row), DefaultRateLimit.NONE)

        row = Row(verification_level_id=2, daily_message_count=10, weekly_manual_report_count=1)
        self.assertEqual(get_default_rate_limit(row), DefaultRateLimit.BASICS)

        row = Row(verification_level_id=2, daily_message_count=11, weekly_manual_report_count=1)
        self.assertEqual(get_default_rate_limit(row), DefaultRateLimit.BASICS)

    def test_unverified_baseline_limit(self):
        """
        verification_level_id = 1 → DefaultRateLimit.UNVERIFIED (value 10)
        weekly_manual_report_count = 0 ⇒ limit = 10 // 2**0 = 10
        """
        row = Row(verification_level_id=1, daily_message_count=9, weekly_manual_report_count=0)
        self.assertEqual(get_default_rate_limit(row), DefaultRateLimit.NONE)

        row = Row(verification_level_id=1, daily_message_count=10, weekly_manual_report_count=0)
        self.assertEqual(get_default_rate_limit(row), DefaultRateLimit.UNVERIFIED)

        row = Row(verification_level_id=1, daily_message_count=15, weekly_manual_report_count=0)
        self.assertEqual(get_default_rate_limit(row), DefaultRateLimit.UNVERIFIED)

    def test_unverified_quarter_limit(self):
        """
        weekly_manual_report_count = 2 quarters the limit: 10 // 2**2 = 2
        """
        row = Row(verification_level_id=1, daily_message_count=1, weekly_manual_report_count=2)
        self.assertEqual(get_default_rate_limit(row), DefaultRateLimit.NONE)

        row = Row(verification_level_id=1, daily_message_count=2, weekly_manual_report_count=2)
        self.assertEqual(get_default_rate_limit(row), DefaultRateLimit.UNVERIFIED)

        row = Row(verification_level_id=1, daily_message_count=3, weekly_manual_report_count=2)
        self.assertEqual(get_default_rate_limit(row), DefaultRateLimit.UNVERIFIED)

    def test_limit_zero_branch_returns_max_enum(self):
        """
        limit becomes zero when 2**weekly_manual_report_count > default_limit.value
        Expect fallback to max(DefaultRateLimit) → PHOTOS.
        """
        # UNVERIFIED: 10 // 2**4 = 0
        row = Row(verification_level_id=1, daily_message_count=0, weekly_manual_report_count=4)
        self.assertEqual(get_default_rate_limit(row), DefaultRateLimit.PHOTOS)

        # BASICS: 20 // 2**5 = 0
        row = Row(verification_level_id=2, daily_message_count=0, weekly_manual_report_count=5)
        self.assertEqual(get_default_rate_limit(row), DefaultRateLimit.PHOTOS)

        # PHOTOS: 50 // 2**6 = 0
        row = Row(verification_level_id=3, daily_message_count=0, weekly_manual_report_count=6)
        self.assertEqual(get_default_rate_limit(row), DefaultRateLimit.PHOTOS)

    def test_unhandled_verification_level(self):
        row = Row(verification_level_id=0, daily_message_count=0, weekly_manual_report_count=0)
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
