"""Fill rate counts only the rows that CAN carry a dimension's columns.

Before 2026-09-30 every row on the date sat in the denominator, so listings too
young to carry sma_50 / magic_rs_zone pulled nse_magic_rs to 83.6% against a
95% bar, every daily_run ended 'partial', and the leadership snapshot (gated on
a clean run) was never published. No DB: a fake cursor records the SQL. The
generated SQL was also run against the live database on 2026-09-30.

    python -m unittest test_health_eligibility
"""
import unittest
from datetime import date

from pipeline2 import health


class FakeCursor:
    def __init__(self, conn):
        self.conn = conn

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def execute(self, sql, args=None):
        self.conn.calls.append((sql, list(args or [])))
        self._last = sql

    def fetchone(self):  # information_schema column check: all present
        return (99,)

    def fetchall(self):
        return self.conn.rows


class FakeConn:
    def __init__(self, rows):
        self.rows, self.calls = rows, []

    def cursor(self, *a, **k):
        return FakeCursor(self)

    def commit(self):
        pass


class EligibilityTests(unittest.TestCase):
    def test_history_rule_requires_n_sessions_from_the_index_calendar(self):
        sql, params, has_cal = health.column_fill_sql('nse_magic_rs')
        self.assertTrue(has_cal)
        self.assertEqual(params, ['NSE'])
        self.assertIn('lag(trade_date, 203)', sql)          # 204 bars: 144 RS + 60 magic_ma
        self.assertIn('FROM km_index_eod', sql)              # sessions, not calendar days
        self.assertIn('p.trade_date <= cal.cutoff', sql)
        self.assertIn('e.magic_rs_zone IS NOT NULL', sql)

    def test_indicators_need_fifty_sessions(self):
        sql, _p, _c = health.column_fill_sql('bse_equity_indicators')
        self.assertIn('lag(trade_date, 49)', sql)

    def test_predicate_rules(self):
        sql, params, has_cal = health.column_fill_sql('vani_flags')
        self.assertFalse(has_cal)
        self.assertEqual(params, [])
        self.assertIn('e.magic_rs IS NOT NULL', sql)
        for dim in ('index_indicators', 'index_flow'):
            self.assertIn('e.volume IS NOT NULL', health.column_fill_sql(dim)[0])

    def test_unlisted_dimension_counts_every_row(self):
        sql, _p, has_cal = health.column_fill_sql('supertrend')
        self.assertFalse(has_cal)
        self.assertNotIn('EXISTS', sql)
        self.assertNotIn('cal', sql)

    def test_argument_order_matches_placeholders(self):
        conn = FakeConn([(date(2026, 9, 30), 100, 97)])
        out = health._column_fill_counts(conn, 'nse_equity_indicators',
                                         date(2026, 9, 24), date(2026, 9, 30))
        sql, args = conn.calls[-1]
        self.assertEqual(sql.count('%s'), len(args))
        self.assertEqual(args, ['2026-09-24', '2026-09-30', 'NSE', '2026-09-24', '2026-09-30'])
        self.assertEqual(out, {'2026-09-30': (100, 97)})

    def test_fill_rate_uses_the_eligible_denominator(self):
        conn = FakeConn([(date(2026, 9, 30), 2866, 2807)])
        self.assertEqual(health.fill_rate(conn, 'nse_magic_rs', date(2026, 9, 30)), 97.94)

    def test_zero_eligible_rows_is_not_healthy(self):
        conn = FakeConn([])
        self.assertEqual(health.fill_rate(conn, 'vani_flags', date(2026, 9, 30)), 0.0)

    def test_every_rule_names_a_column_fill_dimension(self):
        for dim, (kind, _v) in health.DIMENSION_ELIGIBILITY.items():
            self.assertIn(dim, health.DIMENSION_HEALTH)
            self.assertIsNotNone(health.DIMENSION_HEALTH[dim][2], dim)
            self.assertIn(kind, ('history', 'predicate'))


if __name__ == '__main__':
    unittest.main()
