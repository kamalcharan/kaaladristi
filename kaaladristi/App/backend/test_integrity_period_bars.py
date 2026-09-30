"""check_period_bars must not call the month-end monthly bar a partial one.

On 2026-09-30 (the last day of September) the writer built the correct
September bar, 3,532 rows, and integrity_checks raised `monthly_partial_bar`
CRITICAL on it — failing the step and marking the whole nightly run partial.
The writer runs on daily_pipeline.is_month_end; the check now asks the same
function. No DB: a fake connection answers the three queries.

    python -m unittest test_integrity_period_bars
"""
import unittest
from datetime import date

from lib import integrity_checks as ic


class FakeCursor:
    def __init__(self, answers):
        self.answers, self.result = answers, []

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def execute(self, sql, params=None):
        for needle, rows in self.answers:
            if needle in sql:
                self.result = rows
                return
        self.result = []

    def fetchall(self):
        return self.result


class FakeConn:
    def __init__(self, weekly, monthly):
        self.answers = [
            ('MAX(trade_date) FROM km_equity_weekly', [(weekly,)]),
            ('MAX(trade_date) FROM km_equity_monthly', [(monthly,)]),
            ('COUNT(*), COUNT(DISTINCT trade_date)', [(3532, 18)]),
        ]

    def cursor(self, *a, **k):
        return FakeCursor(self.answers)


def keys(findings):
    return {f.check_key for f in findings}


class MonthlyPartialBarTest(unittest.TestCase):
    def test_month_end_bar_is_not_partial(self):
        conn = FakeConn(weekly=date(2026, 9, 25), monthly=date(2026, 9, 30))
        self.assertNotIn('monthly_partial_bar', keys(ic.check_period_bars(conn, date(2026, 9, 30))))

    def test_mid_month_bar_is_still_critical(self):
        # The 2026-08-05 bug: a month-to-date bar written mid-month.
        conn = FakeConn(weekly=date(2026, 9, 25), monthly=date(2026, 9, 29))
        found = [f for f in ic.check_period_bars(conn, date(2026, 9, 29)) if f.check_key == 'monthly_partial_bar']
        self.assertEqual(len(found), 1)
        self.assertEqual(found[0].severity, 'critical')

    def test_next_day_still_sees_a_prior_month_bar_as_fine(self):
        conn = FakeConn(weekly=date(2026, 9, 25), monthly=date(2026, 9, 30))
        self.assertNotIn('monthly_partial_bar', keys(ic.check_period_bars(conn, date(2026, 10, 1))))


if __name__ == '__main__':
    unittest.main()
