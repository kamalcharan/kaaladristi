"""
PIPELINE2_ROLE + single-executor leases — unit tests (no DB, no network).

    cd App/backend && python -m unittest test_pipeline_role

Guards the 2026-09-27 fix for the nightly deadlocks: a second pipeline2
instance (a dev machine's `uvicorn pipeline2_api` against production) must
not run a worker, a scheduler or the stale-job reset. Covers:

  * config: PIPELINE2_ROLE parses, defaults to 'full', falls back on junk
  * lease: try_acquire returns the lock result and commits; holders() reads
    pg_locks with the lease namespace and never the step-lock namespace
  * worker.main(): exits 0 without polling when the lease is refused; polls
    when it is granted; re-takes the lease after a reconnect and stops if
    it is lost
  * scheduler.start_scheduler(): returns None and starts nothing when the
    lease is refused
  * pipeline2_api (AST, no import — the module needs pandas + a DB):
    lifespan skips Popen/start_scheduler/_reset_stale_jobs in api-only,
    _reset_stale_jobs is guarded by the worker lease, /internal/health
    carries role + both leases
"""

from __future__ import annotations

import ast
import importlib
import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DATABASE_URL', 'postgresql://kd_app:x@localhost/unit_test_never_connected')


class _Cursor:
    def __init__(self, conn, lock_result=True, rows=()):
        self.conn, self.lock_result, self.rows = conn, lock_result, list(rows)
        self.last_sql = None
        self.last_params = None

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def execute(self, sql, params=None):
        self.last_sql, self.last_params = sql, params
        self.conn.executed.append((sql, params))

    def fetchone(self):
        return (self.lock_result,)

    def fetchall(self):
        return self.rows


class _Conn:
    def __init__(self, lock_result=True, rows=()):
        self.lock_result, self.rows = lock_result, rows
        self.executed, self.commits, self.rollbacks, self.closed = [], 0, 0, False

    def cursor(self, **_):
        return _Cursor(self, self.lock_result, self.rows)

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1

    def close(self):
        self.closed = True


class ConfigRole(unittest.TestCase):
    def _load(self, value):
        if value is None:
            os.environ.pop('PIPELINE2_ROLE', None)
        else:
            os.environ['PIPELINE2_ROLE'] = value
        import lib.config as cfg
        return importlib.reload(cfg)

    def test_default_is_full(self):
        self.assertEqual(self._load(None).PIPELINE2_ROLE, 'full')

    def test_api_only_parses_and_is_case_insensitive(self):
        self.assertEqual(self._load('api-only').PIPELINE2_ROLE, 'api-only')
        self.assertEqual(self._load(' API-Only ').PIPELINE2_ROLE, 'api-only')

    def test_junk_falls_back_to_full(self):
        self.assertEqual(self._load('worker').PIPELINE2_ROLE, 'full')

    def tearDown(self):
        os.environ.pop('PIPELINE2_ROLE', None)
        import lib.config as cfg
        importlib.reload(cfg)


class Lease(unittest.TestCase):
    def setUp(self):
        from pipeline2 import lease
        self.lease = lease

    def test_namespace_is_not_the_step_lock_namespace(self):
        from pipeline2 import handlers
        self.assertNotEqual(self.lease.LEASE_NAMESPACE, handlers._STEP_LOCK_NAMESPACE)
        self.assertNotEqual(self.lease.WORKER_LEASE, self.lease.SCHEDULER_LEASE)

    def test_try_acquire_granted(self):
        c = _Conn(lock_result=True)
        self.assertTrue(self.lease.try_acquire(c, self.lease.WORKER_LEASE))
        sql, params = c.executed[-1]
        self.assertIn('pg_try_advisory_lock', sql)
        self.assertEqual(params, (self.lease.LEASE_NAMESPACE, self.lease.WORKER_LEASE))
        self.assertEqual(c.commits, 1, 'the lock call must be committed so it is not undone by a later rollback')

    def test_try_acquire_refused(self):
        c = _Conn(lock_result=False)
        self.assertFalse(self.lease.try_acquire(c, self.lease.SCHEDULER_LEASE))

    def test_holders_reads_pg_locks_for_both_keys(self):
        c = _Conn(rows=[(self.lease.WORKER_LEASE,)])
        self.assertEqual(self.lease.holders(c), {'worker': True, 'scheduler': False})
        sql, params = c.executed[-1]
        self.assertIn('pg_locks', sql)
        self.assertIn('granted', sql)
        self.assertEqual(params[0], self.lease.LEASE_NAMESPACE)
        c2 = _Conn(rows=[(self.lease.WORKER_LEASE,), (self.lease.SCHEDULER_LEASE,)])
        self.assertEqual(self.lease.holders(c2), {'worker': True, 'scheduler': True})
        self.assertEqual(self.lease.holders(_Conn(rows=[])), {'worker': False, 'scheduler': False})


class WorkerLease(unittest.TestCase):
    def setUp(self):
        from pipeline2 import worker
        self.worker = worker

    def test_refused_lease_exits_zero_without_polling(self):
        conn = _Conn(lock_result=False)
        # SystemExit is a BaseException: the worker loop's `except Exception`
        # cannot swallow it, so a poll without a lease ends the test instead
        # of spinning forever (a plain mock here would loop on a truthy return).
        with mock.patch.object(self.worker, '_connect', return_value=conn), \
             mock.patch.object(self.worker, 'process_one',
                               side_effect=SystemExit('polled without a lease')) as poll, \
             mock.patch.object(sys, 'argv', ['worker', '--watch', '1']):
            rc = self.worker.main()
        self.assertEqual(rc, 0)
        poll.assert_not_called()
        self.assertTrue(conn.closed)

    def test_granted_lease_polls(self):
        conn = _Conn(lock_result=True)
        with mock.patch.object(self.worker, '_connect', return_value=conn), \
             mock.patch.object(self.worker, 'process_one', return_value=False) as poll, \
             mock.patch.object(sys, 'argv', ['worker']):        # one-shot mode
            self.worker.main()
        poll.assert_called_once()

    def test_lease_retaken_after_reconnect_and_exit_when_lost(self):
        import psycopg2
        first, second = _Conn(lock_result=True), _Conn(lock_result=False)
        calls = {'n': 0}

        def poll(conn):
            calls['n'] += 1
            if calls['n'] == 1:
                raise psycopg2.OperationalError('server closed the connection')
            return False

        with mock.patch.object(self.worker, '_connect', return_value=first), \
             mock.patch.object(self.worker, '_reconnect', return_value=second), \
             mock.patch.object(self.worker, 'process_one', side_effect=poll), \
             mock.patch.object(self.worker.time, 'sleep'), \
             mock.patch.object(sys, 'argv', ['worker', '--watch', '1']):
            with self.assertRaises(SystemExit) as cm:
                self.worker.main()
        self.assertEqual(cm.exception.code, 0, 'losing the lease to another worker is a clean stop')
        self.assertEqual(calls['n'], 1, 'must not poll again on a session that holds no lease')
        self.assertTrue(any('pg_try_advisory_lock' in s for s, _ in second.executed),
                        'the new session must re-take the lease')


class SchedulerLease(unittest.TestCase):
    def test_refused_lease_starts_nothing(self):
        from pipeline2 import scheduler
        conn = _Conn(lock_result=False)
        with mock.patch.object(scheduler.psycopg2, 'connect', return_value=conn), \
             mock.patch.object(scheduler, 'BackgroundScheduler') as bs:
            self.assertIsNone(scheduler.start_scheduler('postgresql://x'))
        bs.assert_not_called()
        self.assertTrue(conn.closed)
        self.assertIsNone(scheduler._lease_conn)

    def test_granted_lease_starts_and_keeps_the_connection(self):
        from pipeline2 import scheduler
        conn = _Conn(lock_result=True)
        with mock.patch.object(scheduler.psycopg2, 'connect', return_value=conn), \
             mock.patch.object(scheduler, 'BackgroundScheduler') as bs:
            sched = scheduler.start_scheduler('postgresql://x')
        self.assertIsNotNone(sched)
        bs.return_value.start.assert_called_once()
        self.assertIs(scheduler._lease_conn, conn, 'the lease lives on this connection; dropping it drops the lease')
        self.assertFalse(conn.closed)
        scheduler._lease_conn = None


class ApiWiring(unittest.TestCase):
    """pipeline2_api.py imports pandas and opens a DB at import; check the
    source by AST instead."""

    @classmethod
    def setUpClass(cls):
        path = os.path.join(os.path.dirname(__file__), 'pipeline2_api.py')
        with open(path, encoding='utf-8') as fh:
            cls.src = fh.read()
        cls.tree = ast.parse(cls.src)

    def _func(self, name, is_async=None):
        for node in ast.walk(self.tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == name:
                return node
        self.fail(f'{name} not found')

    def test_lifespan_gates_worker_scheduler_and_reset_on_role(self):
        lifespan = self._func('lifespan')
        # Every Popen / start_scheduler / _reset_stale_jobs call sits inside an
        # `if` that tests the role — none at the top level of the function body.
        top_level_calls = {
            n.func.attr if isinstance(n.func, ast.Attribute) else getattr(n.func, 'id', None)
            for stmt in lifespan.body
            for n in ast.walk(stmt)
            if isinstance(n, ast.Call) and not isinstance(stmt, ast.If)
        }
        for forbidden in ('Popen', 'start_scheduler', '_reset_stale_jobs'):
            self.assertNotIn(forbidden, top_level_calls, f'{forbidden} runs regardless of PIPELINE2_ROLE')
        gate = [s for s in lifespan.body if isinstance(s, ast.If) and '_PIPELINE2_ROLE' in ast.dump(s.test)]
        self.assertTrue(gate, 'lifespan has no `if _PIPELINE2_ROLE == ...` gate')
        guarded = ast.dump(gate[0])
        for required in ('Popen', 'start_scheduler', '_reset_stale_jobs'):
            self.assertIn(required, guarded, f'{required} is not inside the role gate')
        # and the api-only branch is the one WITHOUT them
        api_only_branch = gate[0].body if "'api-only'" in ast.dump(gate[0].test) else gate[0].orelse
        self.assertNotIn('Popen', ast.dump(ast.Module(body=api_only_branch, type_ignores=[])))

    def test_reset_stale_jobs_is_guarded_by_worker_lease(self):
        fn = self._func('_reset_stale_jobs')
        src = ast.get_source_segment(self.src, fn)
        self.assertIn("_lease.holders(conn)['worker']", src)
        self.assertLess(src.index("_lease.holders"), src.index("UPDATE km_jobs"),
                        'the lease check must come before the UPDATE')

    def test_health_reports_role_and_leases(self):
        fn = self._func('_health_body')
        src = ast.get_source_segment(self.src, fn)
        for key in ("'role'", "'worker_lease'", "'scheduler_lease'", '_lease.holders'):
            self.assertIn(key, src)

    def test_deploy_and_smoke_assert_the_vps_holds_both_leases(self):
        root = os.path.join(os.path.dirname(__file__), '..', '..')
        for rel in ('deploy.sh', os.path.join('scripts', 'smoke_after_deploy.sh')):
            with open(os.path.join(root, rel), encoding='utf-8') as fh:
                text = fh.read()
            # FastAPI emits compact JSON — the patterns must not expect a space
            self.assertIn('"role":"full"', text, rel)
            self.assertIn('"worker_lease":true', text, rel)
            self.assertIn('"scheduler_lease":true', text, rel)
            self.assertNotIn('"role": "full"', text, rel)


if __name__ == '__main__':
    unittest.main()
