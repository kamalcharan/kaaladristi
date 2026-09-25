"""km_jobs.completed_at is stamped by the DATABASE clock — no DB, no pytest.

    cd App/backend && python -m unittest test_job_timestamps -v

The defect this pins, measured on the live DB 2026-09-25:

    4,273 of 4,296 km_jobs rows carried `completed_at` EARLIER than their own
    `started_at`, by 4h03m to 5h30m.

Cause: `_update_job(..., completed_at=datetime.utcnow())` passes a NAIVE UTC
datetime. psycopg2 sends a naive value as a bare timestamp literal, and
PostgreSQL resolves a bare literal against the SESSION TimeZone — Asia/Kolkata
on this deployment — so every completion instant landed 5h30m before it
happened. `started_at` was always right because `_claim_job` writes SQL `now()`.

Why it mattered beyond cosmetics: two guards compare `completed_at` against
`now()` — `_parent_fix_failed` (120 min), the deferral added after the
2026-09-22 Stage 2 outage, and the cascade debounce (30 min). A row stamped
5.5 hours early can never fall inside either window, so both were structurally
inert. Zero jobs have ever reached status 'deferred'. The guard existed, its
own tests passed (they build their own rows), and it could not fire.
"""

import re
import unittest
from datetime import datetime, timezone
from pathlib import Path

from pipeline2 import worker

_WORKER_SRC = Path(worker.__file__).read_text()


class FakeCursor:
    def __init__(self):
        self.statements = []

    def execute(self, sql, params=None):
        self.statements.append((' '.join(sql.split()), list(params or [])))

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class FakeConn:
    def __init__(self):
        self.cursor_obj = FakeCursor()

    def cursor(self):
        return self.cursor_obj

    def commit(self):
        pass


class UpdateJobEmitsSqlNow(unittest.TestCase):
    def test_sentinel_becomes_a_sql_call_not_a_bound_value(self):
        conn = FakeConn()
        worker._update_job(conn, 42, status='completed', completed_at=worker.SQL_NOW)
        sql, params = conn.cursor_obj.statements[0]
        self.assertIn('completed_at = now()', sql)
        self.assertNotIn('completed_at = %s', sql)
        self.assertEqual(params, ['completed', 42],
                         'the sentinel must NOT occupy a parameter slot')
        for p in params:
            self.assertNotIsInstance(p, datetime,
                                     'no Python clock may reach km_jobs.completed_at')

    def test_parameter_order_survives_a_sentinel_in_the_middle(self):
        # The real hazard in the implementation: it appends a SET part and then
        # `continue`s past the params.append. A sentinel sitting BETWEEN two
        # ordinary fields is where a misalignment would show — every value
        # after it would bind to the wrong placeholder, which is silent.
        conn = FakeConn()
        worker._update_job(conn, 7, status='failed', completed_at=worker.SQL_NOW,
                           error_msg='boom', rows_affected=3)
        sql, params = conn.cursor_obj.statements[0]
        placeholders = sql.count('%s')
        self.assertEqual(placeholders, len(params))
        order = re.findall(r'(\w+) = (?:%s|now\(\))', sql)
        # the trailing 'id' is the WHERE binding; it must stay LAST, which is
        # exactly what a dropped params.append would disturb.
        self.assertEqual(order, ['status', 'completed_at', 'error_msg',
                                 'rows_affected', 'id'])
        self.assertEqual(params, ['failed', 'boom', 3, 7])

    def test_an_ordinary_value_still_binds(self):
        conn = FakeConn()
        worker._update_job(conn, 1, progress_pct=50)
        sql, params = conn.cursor_obj.statements[0]
        self.assertIn('progress_pct = %s', sql)
        self.assertEqual(params, [50, 1])

    def test_no_fields_is_a_no_op(self):
        conn = FakeConn()
        worker._update_job(conn, 1)
        self.assertEqual(conn.cursor_obj.statements, [])


class NoPythonClockReachesTheJobsTable(unittest.TestCase):
    def test_every_completed_at_call_site_uses_the_sentinel(self):
        sites = re.findall(r'completed_at=([A-Za-z_][\w.]*)', _WORKER_SRC)
        self.assertTrue(sites, 'expected completed_at call sites in the worker')
        self.assertEqual(set(sites), {'SQL_NOW'},
                         f'completed_at must only ever be SQL_NOW; found {sorted(set(sites))}')

    def test_the_naive_call_is_gone_from_the_worker(self):
        code = re.sub(r'"""[\s\S]*?"""', '', _WORKER_SRC)
        self.assertNotIn('utcnow(', code,
                         'datetime.utcnow() is naive; PostgreSQL reads a naive literal '
                         'in the session TimeZone, which is what shifted every row 5h30m')

    def test_started_at_is_also_the_database_clock(self):
        self.assertIn("started_at = now()", _WORKER_SRC,
                      'claim must stamp started_at in SQL — it is the reference the '
                      'repair migration and this suite both compare against')


class TheGuardsThisUnblocks(unittest.TestCase):
    """Pin WHY the stamp has to be the DB clock, so a later change that moves
    `completed_at` back to a Python value fails here with the reason attached."""

    def test_parent_failure_guard_compares_completed_at_to_now(self):
        self.assertRegex(
            ' '.join(_WORKER_SRC.split()),
            r"status = 'failed'.{0,200}completed_at > now\(\)",
            'the parent-failure deferral windows on completed_at vs now()')

    def test_cascade_debounce_compares_completed_at_to_now(self):
        self.assertRegex(
            ' '.join(_WORKER_SRC.split()),
            r"created_by = 'cascade'.{0,120}completed_at > now\(\)",
            'the cascade debounce windows on completed_at vs now()')

    def test_a_naive_utc_stamp_would_miss_both_windows(self):
        # Not a test of our code — a test of the arithmetic that made the bug
        # invisible, so the number in the docstring is checked rather than
        # remembered. IST is UTC+5:30 with no DST, so the shift is constant.
        naive_utc_as_ist = datetime(2026, 9, 24, 18, 13, tzinfo=timezone.utc)
        real = datetime(2026, 9, 24, 23, 43, tzinfo=timezone.utc)
        skew_minutes = (real - naive_utc_as_ist).total_seconds() / 60
        self.assertEqual(skew_minutes, 330)
        self.assertGreater(skew_minutes, worker.PARENT_FAILURE_WINDOW_MIN)
        self.assertGreater(skew_minutes, worker.CASCADE_DEBOUNCE_MIN)


if __name__ == '__main__':
    unittest.main(verbosity=2)
