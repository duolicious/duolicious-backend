import unittest
from serviceshared.antiabuse.lodgereport import (
    is_bot_report,
    is_underage_report,
    report_subject,
)

class TestIsOffensive(unittest.TestCase):

    def test_is_bot_report(self) -> None:
        self.assertTrue(is_bot_report("bot__"))
        self.assertTrue(is_bot_report("IT'S A DAMN BOT AGAIN"))
        self.assertTrue(is_bot_report("They asked for money (it's a bot)"))
        self.assertTrue(is_bot_report("cat fish"))
        self.assertTrue(is_bot_report("they're a catfish"))
        self.assertTrue(is_bot_report("catfishing"))

    def test_is_not_bot_report(self) -> None:
        self.assertFalse(is_bot_report("they were mean to me"))
        self.assertFalse(is_bot_report("racism"))
        self.assertFalse(is_bot_report("They asked for money"))

    def test_is_underage_report(self) -> None:
        self.assertTrue(is_underage_report("MINOR"))
        self.assertTrue(is_underage_report("they're underage"))
        self.assertTrue(is_underage_report("under-age"))
        self.assertTrue(is_underage_report("under 18"))
        self.assertTrue(is_underage_report("they're not 18"))
        self.assertTrue(is_underage_report("Not eighteen!!"))
        self.assertTrue(is_underage_report("said they're 16yo"))
        self.assertTrue(is_underage_report("15 y/o"))
        self.assertTrue(is_underage_report("17 years old"))
        self.assertTrue(is_underage_report("still in high school"))
        self.assertTrue(is_underage_report("literally a kid"))

    def test_is_not_underage_report(self) -> None:
        self.assertFalse(is_underage_report("they were mean to me"))
        self.assertFalse(is_underage_report("are you kidding me"))
        self.assertFalse(is_underage_report("18 years old and rude"))
        self.assertFalse(is_underage_report("117 years old"))

    def test_report_subject(self) -> None:
        report_obj = [
            dict(id=12, times_reported=0),
            dict(id=34, times_reported=5),
        ]

        self.assertEqual(
            report_subject("rude", report_obj, False, False),
            "Report: (5) 12 - 34",
        )
        self.assertEqual(
            report_subject("bot", report_obj, True, False),
            "Report: (5) 12 - 34 [automoded]",
        )
        self.assertEqual(
            report_subject("minor bot", report_obj, True, True),
            "Report: (5) 12 - 34 [automoded - shadow banned] [underage]",
        )
        self.assertEqual(
            report_subject("not 18", report_obj, False, False),
            "Report: (5) 12 - 34 [underage]",
        )
