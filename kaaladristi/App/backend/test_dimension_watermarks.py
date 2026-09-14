"""Per-dimension watermarks + the derivation-staleness check (migration 210).

    python -m unittest test_dimension_watermarks

No DB, no network. A stub connection records the SQL and serves canned rows.

The three properties under test are the ones that decide whether this check is
useful or gets muted, and none of them is visible in a type:

  1. ABSENT IS UNKNOWN, NEVER STALE. The table starts empty and fills forward.
     A check that read the empty state as a finding would emit thousands on its
     first night and be ignored by its second.
  2. 'partial' STAMPS, 'failed' DOES NOT. A partial compute ran against the
     inputs as they stood — that is the only question a watermark answers, and
     2,184 partial fix jobs are on record. A failure must never make a
     dimension look current.
  3. STRICTLY GREATER, WITH A FLOOR. Parents run before children inside one
     daily run, seconds apart; `>=` or a zero floor would report every clean
     nightly run as stale.
"""

import unittest
from datetime import date

from pipeline2 import watermarks
from pipeline2.orchestrator import DIMENSION_DEPENDENTS, DAILY_STEPS
from lib import integrity_checks as ic


class StubCursor:
    def __init__(self, conn):
        self.conn = conn
        self.description = conn.description

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def execute(self, sql, params=None):
        if self.conn.raise_on_execute:
            raise RuntimeError(self.conn.raise_on_execute)
        self.conn.statements.append((' '.join(sql.split()), list(params or [])))

    def fetchall(self):
        return self.conn.rows


class StubConn:
    def __init__(self, rows=None, description=None, raise_on_execute=None):
        self.statements = []
        self.rows = rows or []
        self.description = description or []
        self.raise_on_execute = raise_on_execute
        self.commits = 0
        self.rollbacks = 0

    def cursor(self):
        return StubCursor(self)

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


DESC = [(c,) for c in ('dimension', 'trade_date', 'parent', 'child_computed_at',
                       'parent_computed_at', 'lag_seconds', 'child_status',
                       'parent_source')]


class TestGraph(unittest.TestCase):
    def test_parents_invert_dependents(self):
        """One declaration, two directions — the cascade walks it down, the
        check walks it up. A second hand-written graph would drift."""
        parents = watermarks.parents_of()
        for parent, children in DIMENSION_DEPENDENTS.items():
            for child in children:
                self.assertIn(parent, parents[child],
                              f'{child} must record {parent} as an input')
        # And nothing invented: every parent edge exists in the forward graph.
        for child, ps in parents.items():
            for p in ps:
                self.assertIn(child, DIMENSION_DEPENDENTS[p])

    def test_known_edges(self):
        p = watermarks.parents_of()
        self.assertIn('nse_equity_indicators', p['nse_magic_rs'])
        self.assertIn('rs_percentile', p['vani_flags'])
        self.assertIn('vani_flags', p['scan_refresh'])
        self.assertIn('nse_magic_rs', p['wg_journeys'])
        # A download is nobody's dependent — it is where the chain starts.
        self.assertNotIn('nse_eod_download', p)

    def test_validate_rejects_unknown_dimension(self):
        """Runs at import for the real graph. A parent naming a dimension
        nobody computes yields a watermark that is never stamped, and therefore
        a check silently blind on that edge — a startup error is cheaper."""
        with self.assertRaises(ValueError):
            watermarks.validate_parents({'nse_magic_rs'})   # missing the rest
        # The real graph passes against the real step list.
        watermarks.validate_parents({d for d, _ in DAILY_STEPS})


class TestWiring(unittest.TestCase):
    """The pipeline must actually stamp. Every property tested above is worth
    nothing if nobody calls stamp() — and removing the call breaks no other
    test, because a watermark that is never written simply leaves the table
    empty, which the check reads as UNKNOWN and reports as silence."""

    SRC = open('pipeline2/orchestrator.py', encoding='utf-8').read()
    WORKER = open('pipeline2/worker.py', encoding='utf-8').read()

    def test_run_daily_stamps_every_step(self):
        body = self.SRC[self.SRC.index('def run_daily('):]
        self.assertIn('watermarks.stamp(', body,
                      'run_daily must record each dimension it computes')

    def test_run_daily_import_is_absolute(self):
        """`from . import watermarks` inside run_daily raises
        KeyError("'__name__' not in globals") under test_leadership_pipeline,
        which compiles this function on its own via ast/exec. Absolute resolves
        from sys.path and works in both."""
        body = self.SRC[self.SRC.index('def run_daily('):]
        self.assertIn('from pipeline2 import watermarks', body)
        self.assertNotIn('from . import watermarks', body)

    def test_fix_path_stamps(self):
        body = self.WORKER[self.WORKER.index('def _run_fix('):]
        self.assertIn('watermarks.stamp(', body,
                      'the fix path is the whole point — a fix rewrites a column, '
                      'so its dependents are now older than their own input')

    def test_fix_stamps_before_cascading(self):
        """Order matters for readability of the record: the repair is dated,
        then its dependents are enqueued."""
        body = self.WORKER[self.WORKER.index('def _run_fix('):]
        self.assertLess(body.index('watermarks.stamp('), body.index('_cascade_dependents('))

    def test_cascade_jobs_are_distinguishable(self):
        """A cascade job is still a fix, but recording WHICH is the evidence the
        chain actually fired."""
        body = self.WORKER[self.WORKER.index('def _run_fix('):]
        self.assertIn("'cascade' if job.get('created_by') == 'cascade' else 'fix'", body)


class TestStamp(unittest.TestCase):
    def test_partial_stamps_and_failed_does_not(self):
        for status, expected in (('completed', True), ('partial', True),
                                 ('failed', False), ('skipped', False)):
            conn = StubConn()
            ok = watermarks.stamp(conn, 'nse_magic_rs', date(2026, 9, 11),
                                  status, source='fix', job_id=7, rows_affected=12)
            self.assertEqual(ok, expected, f'{status} should stamp={expected}')
            self.assertEqual(len(conn.statements), 1 if expected else 0)

    def test_partial_is_deliberate(self):
        """Guard against a future 'tidy-up' restricting this to completed:
        2,184 partial fix jobs are on record and refusing them would make most
        dimensions read permanently stale within a week."""
        self.assertIn('partial', watermarks.STAMPABLE)

    def test_upsert_not_insert(self):
        """A dimension is recomputed many times for one date — the watermark is
        the LATEST derivation, so the write must replace, not accumulate."""
        conn = StubConn()
        watermarks.stamp(conn, 'dots', '2026-09-11', 'completed', source='cascade')
        sql, params = conn.statements[0]
        self.assertIn('ON CONFLICT (dimension, trade_date) DO UPDATE', sql)
        self.assertIn('computed_at = now()', sql)
        self.assertIn('cascade', params)

    def test_unknown_source_raises(self):
        """A bad source is a Python error at the call site, not a CHECK
        violation at 2 a.m. inside a pipeline run."""
        with self.assertRaises(ValueError):
            watermarks.stamp(StubConn(), 'dots', '2026-09-11', 'completed', source='oops')

    def test_write_failure_never_raises(self):
        """Instrumentation must not fail a compute that succeeded — including
        when migration 210 has not been applied to this database yet."""
        conn = StubConn(raise_on_execute='relation "km_dimension_watermarks" does not exist')
        self.assertFalse(watermarks.stamp(conn, 'dots', '2026-09-11', 'completed', source='fix'))
        self.assertEqual(conn.rollbacks, 1)


class TestStaleDerivations(unittest.TestCase):
    def test_query_requires_both_rows(self):
        """INNER joins on both watermarks: absent is unknown, not stale."""
        conn = StubConn(rows=[], description=DESC)
        self.assertEqual(watermarks.stale_derivations(conn, '2026-09-11'), [])
        sql, _ = conn.statements[0]
        self.assertIn('JOIN km_dimension_watermarks c', sql)
        self.assertIn('JOIN km_dimension_watermarks p', sql)
        self.assertNotIn('LEFT JOIN', sql,
                         'a LEFT JOIN would turn every un-stamped dimension into a finding')

    def test_strictly_greater(self):
        conn = StubConn(rows=[], description=DESC)
        watermarks.stale_derivations(conn, '2026-09-11')
        sql, _ = conn.statements[0]
        self.assertIn('p.computed_at > c.computed_at', sql)
        self.assertNotIn('>=', sql,
                         'parents finish seconds before children in one run; >= reports '
                         'every clean nightly run as stale')

    def test_missing_table_returns_empty(self):
        conn = StubConn(raise_on_execute='no such table', description=DESC)
        self.assertEqual(watermarks.stale_derivations(conn, '2026-09-11'), [])


class TestCheck(unittest.TestCase):
    @staticmethod
    def _row(dim, parent, lag, trade_date='2026-09-11'):
        return {'dimension': dim, 'trade_date': trade_date, 'parent': parent,
                'child_computed_at': None, 'parent_computed_at': None,
                'lag_seconds': lag, 'child_status': 'completed',
                'parent_source': 'fix'}

    def _run(self, rows):
        real = watermarks.stale_derivations
        watermarks.stale_derivations = lambda *a, **k: rows
        try:
            return ic.check_derivation_staleness(StubConn(), date(2026, 9, 11))
        finally:
            watermarks.stale_derivations = real

    def test_empty_is_silent(self):
        self.assertEqual(self._run([]), [])

    def test_real_lag_reports(self):
        f = self._run([self._row('scan_refresh', 'vani_flags', 4 * 86400)])
        self.assertEqual(len(f), 1)
        self.assertEqual(f[0].check_class, 'derivation')
        self.assertEqual(f[0].severity, 'warning')
        self.assertIn('4 days', f[0].summary)
        self.assertIn('vani_flags', f[0].summary)
        self.assertEqual(f[0].detail['parent'], 'vani_flags')

    def test_same_run_ordering_is_suppressed(self):
        """A parent finishing a few seconds after its child inside one run is
        clock ordering. Real staleness was measured at 1-6 DAYS."""
        self.assertEqual(self._run([self._row('dots', 'nse_magic_rs', 5)]), [])
        self.assertEqual(self._run([self._row('dots', 'nse_magic_rs', 59)]), [])
        self.assertEqual(len(self._run([self._row('dots', 'nse_magic_rs', 60)])), 1)

    def test_severity_is_warning_not_critical(self):
        """Critical would turn the dashboard red after every mid-day fix — the
        state the cascade then corrects on the next run — and the check would
        be muted. Same calibration reasoning as CASH_EQUITY_SERIES."""
        f = self._run([self._row('scan_refresh', 'dots', 90000)])
        self.assertEqual(f[0].severity, 'warning')

    def test_registered_in_all_checks(self):
        self.assertIn(ic.check_derivation_staleness, ic.ALL_CHECKS)

    def test_human_lag(self):
        self.assertEqual(ic._human_lag(30), '1 minute')
        self.assertEqual(ic._human_lag(7200), '2 hours')
        self.assertEqual(ic._human_lag(86400), '1 day')
        self.assertEqual(ic._human_lag(3 * 86400), '3 days')


if __name__ == '__main__':
    unittest.main(verbosity=2)
