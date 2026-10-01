"""Weekly / monthly bars close on the period's last TRADING day.

2026-10-01: Friday 2 Oct is a holiday and 31 Oct is a Saturday. A Friday-only
weekly trigger and a last-calendar-day monthly trigger would never build those
bars; the health grid also called this week 'missing' every night, so the gap
sweep queued a no-op fix whose stamp made wg_journeys read as stale. No DB.

    python -m unittest test_trading_period_bounds
"""
import unittest
from datetime import date
from unittest import mock

from pipeline.utils import trading_calendar as tc
import daily_pipeline as dp
from lib import integrity_checks as ic
from pipeline2 import health

GANDHI = date(2026, 10, 2)
H = frozenset({GANDHI})


class CalendarTests(unittest.TestCase):
    def test_holiday_friday_moves_the_week_end_to_thursday(self):
        self.assertTrue(dp.is_week_end(date(2026, 10, 1), H))
        self.assertFalse(dp.is_week_end(date(2026, 10, 1)))          # unknown holiday: still Friday
        self.assertTrue(dp.is_week_end(date(2026, 9, 25)))

    def test_month_ending_on_a_weekend_closes_on_the_friday(self):
        self.assertTrue(dp.is_month_end(date(2026, 10, 30)))
        self.assertTrue(dp.is_month_end(date(2026, 9, 30)))
        self.assertFalse(dp.is_month_end(date(2026, 9, 29)))

    def test_period_open(self):
        self.assertTrue(health._period_open(date(2026, 9, 29), True, frozenset(), date(2026, 10, 1)))
        self.assertFalse(health._period_open(date(2026, 9, 29), True, H, date(2026, 10, 1)))
        self.assertFalse(health._period_open(date(2026, 9, 25), True, H, date(2026, 10, 1)))


class HealthGridTests(unittest.TestCase):
    """This week's Mon-Thu are 'future' (not due), never 'missing' — a
    missing day makes the 19:30 gap sweep queue a no-op fix every night."""

    def test_open_week_is_not_missing(self):
        days = [date(2026, 9, 21), date(2026, 9, 22), date(2026, 9, 28), date(2026, 9, 29)]

        class Conn(FakeConn):
            def __init__(self):
                self.answers = [('FROM km_trading_calendar', []),
                                ('DISTINCT week_start', [(date(2026, 9, 21),)])]

        class D(date):
            @classmethod
            def today(cls):
                return date(2026, 9, 29)
        with mock.patch.object(health, 'date', D):
            row = health._health_row(Conn(), 'equity_weekly', days, {})
        st = {d.trade_date: d.status for d in row.days}
        self.assertEqual(st['2026-09-21'], 'ok')
        self.assertEqual(st['2026-09-29'], 'future')
        self.assertNotIn('missing', st.values())


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

    def fetchone(self):
        return self.result[0] if self.result else None


class FakeConn:
    def __init__(self, weekly, monthly, holidays=()):
        self.answers = [
            ('FROM km_trading_calendar', [(h,) for h in holidays]),
            ('MAX(trade_date) FROM km_equity_weekly', [(weekly,)]),
            ('MAX(trade_date) FROM km_equity_monthly', [(monthly,)]),
            ('COUNT(*), COUNT(DISTINCT trade_date)', [(3532, 18)]),
        ]

    def cursor(self, *a, **k):
        return FakeCursor(self.answers)

    def rollback(self):
        pass


def keys(findings):
    return {f.check_key for f in findings}


class IntegrityTests(unittest.TestCase):
    def test_thursday_bar_before_a_holiday_friday_is_not_flagged(self):
        conn = FakeConn(date(2026, 10, 1), date(2026, 9, 30), holidays=[GANDHI])
        self.assertNotIn('weekly_not_friday', keys(ic.check_period_bars(conn, date(2026, 10, 1))))

    def test_thursday_bar_in_a_normal_week_still_warns(self):
        conn = FakeConn(date(2026, 9, 24), date(2026, 9, 30))
        self.assertIn('weekly_not_friday', keys(ic.check_period_bars(conn, date(2026, 9, 24))))

    def test_october_bar_on_friday_30th_is_not_partial(self):
        conn = FakeConn(date(2026, 10, 30), date(2026, 10, 30))
        self.assertNotIn('monthly_partial_bar', keys(ic.check_period_bars(conn, date(2026, 10, 30))))


class FakeDb:
    def __init__(self):
        self.weeks = []

    def rpc(self, name, args):
        self.weeks.append(args['p_trade_date'])
        return [{name: 10}]


class AggregatorTests(unittest.TestCase):
    def _run(self, today, holidays):
        from pipeline.compute import weekly_bars

        class D(date):
            @classmethod
            def today(cls):
                return today
        db = FakeDb()
        with mock.patch.object(weekly_bars, 'date', D):
            weekly_bars.aggregate_weekly_bars(db, from_date=date(2026, 9, 28),
                                              run_indicators=False, holidays=holidays)
        return db.weeks

    def test_holiday_week_is_built_on_thursday(self):
        self.assertEqual(self._run(date(2026, 10, 1), H), ['2026-09-28'])

    def test_an_open_week_is_never_written(self):
        self.assertEqual(self._run(date(2026, 10, 1), frozenset()), [])


class HandlerCatchUpTests(unittest.TestCase):
    """Monday after an unlisted holiday Friday: last week's bar was never
    built, so the Monday run builds it (and only it)."""

    def test_missing_previous_week_is_built(self):
        from pipeline2 import handlers
        calls = []

        def agg(db, from_date, run_indicators, verbose, holidays):
            calls.append(from_date)
            return 5
        seq = iter([0.0, 0.0, 100.0])          # before, prev check, prev after
        with mock.patch.object(handlers, 'fill_rate', lambda c, d, t: next(seq)), \
             mock.patch('pipeline.utils.trading_calendar.load_holidays', lambda *a: frozenset()), \
             mock.patch('lib.db_client.get_db', lambda: object()):
            r = handlers._handle_period_aggregate(
                'equity_weekly', FakeConn(None, None), date(2026, 10, 5), False,
                lambda *a: None, dp.is_week_end, agg, 'weekly')
        self.assertEqual(calls, [date(2026, 9, 28)])
        self.assertEqual(r.status, 'completed')

    def test_nothing_to_do_mid_week(self):
        from pipeline2 import handlers
        seq = iter([100.0, 100.0])
        with mock.patch.object(handlers, 'fill_rate', lambda c, d, t: next(seq)), \
             mock.patch('pipeline.utils.trading_calendar.load_holidays', lambda *a: frozenset()):
            r = handlers._handle_period_aggregate(
                'equity_weekly', FakeConn(None, None), date(2026, 10, 6), False,
                lambda *a: None, dp.is_week_end, lambda *a, **k: 1 / 0, 'weekly')
        self.assertEqual((r.status, r.rows_affected), ('completed', 0))


class SchedulerHolidayTests(unittest.TestCase):
    """14 Sep 2026 (holiday): the 18:00 daily_run ran anyway and every step
    failed. A holiday in km_trading_calendar now enqueues nothing."""

    def _enqueue(self, holiday):
        from pipeline2 import scheduler as s
        sql = []

        class Cur:
            r = None
            def __enter__(self): return self
            def __exit__(self, *a): return False
            def execute(self, q, p=None):
                sql.append(q)
                self.r = (1,) if ('km_trading_calendar' in q and holiday) else None
            def fetchone(self): return self.r

        class Conn:
            c = Cur()
            def cursor(self): return self.c
            def commit(self): pass
            def close(self): pass
        with mock.patch.object(s.psycopg2, 'connect', lambda dsn: Conn()), \
             mock.patch.object(s, '_last_trading_day', lambda: GANDHI):
            s._enqueue_daily_run('dsn')
        return any('INSERT INTO km_jobs' in q for q in sql)

    def test_holiday_enqueues_nothing(self):
        self.assertFalse(self._enqueue(True))

    def test_trading_day_still_enqueues(self):
        self.assertTrue(self._enqueue(False))


if __name__ == '__main__':
    unittest.main()
