"""rolling_metrics one-day mode gives the SAME numbers as the full scan.

The pipeline wrote one date by window functions over all 13M bars, ~11
minutes a night. One-day mode reads the last FAST_BARS bars per stock and
carries lifetime_high from the previous bar. This test builds a small
history (young listings, a suspension gap, a lifetime high 400 bars back),
computes each target date both ways, and compares all 27 columns.

    KD_TEST_DSN=postgresql://postgres@localhost:5499/rm_test python -m unittest test_rolling_metrics_fast
"""
import datetime as dt
import os
import random
import unittest

from scripts import backfill_rolling_metrics as rm

DSN = os.getenv('KD_TEST_DSN')
COLS = ['w52_high', 'w52_low', 'lifetime_high', 'avg_amt_5d', 'avg_amt_22d', 'avg_amt_66d',
        'd30_pct_chng', 'delivery_surge_x', 'pct_5d', 'pct_22d', 'pct_66d', 'surge_22d',
        'score_5d', 'score_22d', 'ret_5d', 'ret_22d', 'ret_66d', 'breakout_level',
        'pct_from_breakout', 'pct_below_52w_high', 'breakdown_level', 'pct_from_breakdown',
        'prev_week_close', 'pct_wtd', 'prev_month_close', 'pct_mtd', 'deliv_value_cr']


class SqlShape(unittest.TestCase):
    def test_modes_differ_only_where_intended(self):
        full, fast = rm.build_sql(False), rm.build_sql(True)
        self.assertNotIn('/*', full + fast)
        self.assertIn(f'LIMIT {rm.FAST_BARS}', fast)
        self.assertNotIn('LIMIT', full)
        self.assertIn('GREATEST(s.lth, s.prev_lth)', fast)
        self.assertGreaterEqual(rm.FAST_BARS, 252)          # the 52-week window

    def test_the_pipeline_runs_the_fast_mode(self):
        import inspect
        self.assertIn('fast=True', inspect.getsource(rm.compute_rolling_metrics_for_date))


@unittest.skipUnless(DSN, 'KD_TEST_DSN not set')
class SameNumbers(unittest.TestCase):
    def setUp(self):
        import psycopg2
        import psycopg2.extras
        if 'test' not in DSN.rsplit('/', 1)[-1]:
            self.skipTest("KD_TEST_DSN's database name must contain 'test'")
        self.conn = psycopg2.connect(DSN)
        self._orig = rm.get_conn
        rm.get_conn = lambda: psycopg2.connect(DSN)
        cur = self.conn.cursor()
        cur.execute('DROP TABLE IF EXISTS km_equity_eod CASCADE')
        cur.execute('CREATE TABLE km_equity_eod (id serial primary key, equity_id int, trade_date date, '
                    'close numeric, high numeric, low numeric, value_cr numeric, delivery_pct numeric, '
                    + ', '.join(f'{c} numeric' for c in COLS) + ')')
        cur.execute('CREATE INDEX ON km_equity_eod (equity_id, trade_date)')
        random.seed(7)
        days, d = [], dt.date(2025, 1, 1)
        while len(days) < 420:
            if d.weekday() < 5:
                days.append(d)
            d += dt.timedelta(1)
        rows = []
        for eq in range(1, 21):
            px, start = 100.0 + eq, (0 if eq % 3 else random.randint(100, 350))
            for i, day in enumerate(days[start:]):
                if eq == 5 and 200 < i < 300:
                    continue                                    # suspended
                px = max(1, px * (1 + random.gauss(0, 0.03)))
                hi = px * (5 if (eq == 7 and i == 10) else 1 + abs(random.gauss(0, .02)))
                lo = px * (1 - abs(random.gauss(0, .02)))
                rows.append((eq, day, round(px, 2), round(hi, 2), round(lo, 2),
                             round(random.uniform(1, 50), 2),
                             None if random.random() < .1 else round(random.uniform(10, 90), 2)))
        psycopg2.extras.execute_values(
            cur, 'INSERT INTO km_equity_eod (equity_id,trade_date,close,high,low,value_cr,delivery_pct) VALUES %s', rows)
        self.conn.commit()
        self.days = days

    def tearDown(self):
        rm.get_conn = self._orig
        self.conn.close()

    def test_fast_equals_full(self):
        cur = self.conn.cursor()
        sel = 'SELECT id,' + ','.join(COLS) + ' FROM km_equity_eod WHERE trade_date=%s ORDER BY id'
        for t in (self.days[-1], self.days[-60], self.days[300]):
            prev = self.days[self.days.index(t) - 1]
            rm.run_update(str(prev))                            # the carry reads the previous bar
            rm.run_update(str(t))
            cur.execute(sel, (t,))
            full = cur.fetchall()
            cur.execute('UPDATE km_equity_eod SET ' + ', '.join(f'{c}=NULL' for c in COLS)
                        + ' WHERE trade_date=%s', (t,))
            self.conn.commit()
            rm.run_update(str(t), fast=True)
            cur.execute(sel, (t,))
            fast = cur.fetchall()
            self.assertTrue(full)
            diff = [(a[0], COLS[i]) for a, b in zip(full, fast) for i in range(len(COLS)) if a[i + 1] != b[i + 1]]
            self.assertEqual(diff, [], t)


if __name__ == '__main__':
    unittest.main()
