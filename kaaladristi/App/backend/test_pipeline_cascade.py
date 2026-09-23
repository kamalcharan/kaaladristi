"""Recompute-cascade contract — no DB, no network, no pytest.

    cd App/backend && python -m unittest test_pipeline_cascade -v

Guards the Phase 0 fix from docs/claude/thesis-events-poa.md: a `fix` job used
to repair one column and stop, leaving every dimension derived from it holding
a value computed from superseded data. Measured over six weeks to 2026-09-14,
vani_flags took 162 fix jobs and gl_events took zero.

The graph itself is asserted structurally (names, acyclicity, order). The
enqueue behaviour is asserted ON THE WIRE against a stub cursor, because the
three things most likely to go wrong are invisible to a shape test:

  * enqueueing without force -- `_handle_script` only nullifies a dimension's
    columns when force is set, so an unforced re-run can look at its own
    populated column and skip exactly the rows that went stale. That is the
    original bug wearing a different hat.
  * cascading from a cascade -- self-feeding chain of fix jobs.
  * losing the de-dupe -- a burst of gap_sweep fixes for one date each
    re-enqueueing the same downstream dimension.
"""

import unittest

from pipeline2 import orchestrator, worker


class FakeCursor:
    """Records every statement; answers SELECTs from a caller-set queue."""

    def __init__(self, select_results):
        self.statements = []
        self._select_results = list(select_results)
        self._last = None

    def execute(self, sql, params=None):
        self.statements.append((' '.join(sql.split()), list(params or [])))
        self._last = self._select_results.pop(0) if self._select_results else None

    def fetchone(self):
        return self._last

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class FakeConn:
    def __init__(self, select_results=()):
        self.cursor_obj = FakeCursor(select_results)
        self.commits = 0
        self.rollbacks = 0

    def cursor(self):
        return self.cursor_obj

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


def inserts(conn):
    return [(sql, p) for sql, p in conn.cursor_obj.statements if sql.startswith('INSERT')]


def inserted_dims(conn):
    return [p[0] for _, p in inserts(conn)]


class GraphShape(unittest.TestCase):
    def test_validates_at_import(self):
        # Runs at module import too; asserted here so a regression names itself.
        orchestrator.validate_dependents()

    def test_every_name_is_a_real_dimension(self):
        known = set(orchestrator.handlers.KNOWN_DIMENSIONS)
        for dim, deps in orchestrator.DIMENSION_DEPENDENTS.items():
            self.assertIn(dim, known, f'{dim} is not a known dimension')
            for d in deps:
                self.assertIn(d, known, f'{dim} -> {d}: {d} is not a known dimension')

    def test_cycle_is_rejected(self):
        original = orchestrator.DIMENSION_DEPENDENTS.copy()
        try:
            orchestrator.DIMENSION_DEPENDENTS['scan_refresh'] = ['vani_flags']
            with self.assertRaises(ValueError) as ctx:
                orchestrator.validate_dependents()
            self.assertIn('cycle', str(ctx.exception))
        finally:
            orchestrator.DIMENSION_DEPENDENTS.clear()
            orchestrator.DIMENSION_DEPENDENTS.update(original)

    def test_closure_is_transitive_and_excludes_self(self):
        # dots -> gl_events -> scan_membership_snapshot is two hops.
        closure = orchestrator.dependents_closure('dots')
        self.assertIn('gl_events', closure)
        self.assertIn('scan_membership_snapshot', closure)
        self.assertNotIn('dots', closure)

    def test_closure_is_in_daily_step_order(self):
        order = {d: i for i, (d, _) in enumerate(orchestrator.DAILY_STEPS)}
        closure = orchestrator.dependents_closure('nse_equity_indicators')
        ranks = [order[d] for d in closure if d in order]
        self.assertEqual(ranks, sorted(ranks),
                         'cascade must be enqueued in nightly execution order')

    def test_the_regression_this_was_written_for(self):
        # The five dimensions with ZERO fix jobs in six weeks must now be
        # reachable from the inputs that were fixed 100+ times.
        reach = set(orchestrator.dependents_closure('vani_flags'))
        self.assertIn('scan_refresh', reach)
        self.assertIn('scan_membership_snapshot', reach)

        reach = set(orchestrator.dependents_closure('nse_magic_rs'))
        for dim in ('dots', 'gl_events', 'scan_refresh', 'wg_journeys'):
            self.assertIn(dim, reach, f'nse_magic_rs must reach {dim}')

        reach = set(orchestrator.dependents_closure('nse_equity_indicators'))
        for dim in ('big_money', 'gl_events', 'scan_refresh', 'wg_journeys'):
            self.assertIn(dim, reach, f'nse_equity_indicators must reach {dim}')

    def test_integrity_checks_is_never_cascaded_into(self):
        # A nightly whole-day sweep, not a per-dimension derivative.
        for dim in orchestrator.handlers.KNOWN_DIMENSIONS:
            self.assertNotIn('integrity_checks', orchestrator.dependents_closure(dim))


class EnqueueBehaviour(unittest.TestCase):
    def setUp(self):
        self.job = {'id': 1, 'created_by': 'gap_sweep'}
        self._enabled = worker.CASCADE_ENABLED
        worker.CASCADE_ENABLED = True

    def tearDown(self):
        worker.CASCADE_ENABLED = self._enabled

    def test_enqueues_the_closure_forced(self):
        conn = FakeConn(select_results=[])          # nothing pending, nothing recent
        worker._cascade_dependents(conn, 'vani_flags', '2026-09-11', self.job)

        dims = inserted_dims(conn)
        self.assertIn('scan_refresh', dims)
        self.assertIn('scan_membership_snapshot', dims)
        self.assertEqual(conn.commits, 1)

        for sql, params in inserts(conn):
            self.assertIn('force', sql.lower(),
                          'cascade must set force — an unforced re-run can skip '
                          'the rows that went stale')
            self.assertIn('TRUE', sql, 'force must be TRUE, not defaulted')
            self.assertIn("'cascade'", sql, 'created_by must mark the row as a cascade')
            self.assertEqual(params[1], '2026-09-11', 'must target the parent trade_date')

    def test_a_cascade_does_not_cascade_again(self):
        conn = FakeConn(select_results=[])
        worker._cascade_dependents(conn, 'vani_flags', '2026-09-11',
                                   {'id': 2, 'created_by': 'cascade'})
        self.assertEqual(inserts(conn), [], 'a cascade job must not expand further')

    def test_skips_a_dimension_already_queued(self):
        # First SELECT (pending?) answers truthy for the first dependent.
        conn = FakeConn(select_results=[(1,)])
        worker._cascade_dependents(conn, 'vani_flags', '2026-09-11', self.job)
        first = orchestrator.dependents_closure('vani_flags')[0]
        self.assertNotIn(first, inserted_dims(conn))

    def test_kill_switch_writes_nothing(self):
        worker.CASCADE_ENABLED = False
        conn = FakeConn(select_results=[])
        worker._cascade_dependents(conn, 'vani_flags', '2026-09-11', self.job)
        self.assertEqual(conn.cursor_obj.statements, [])

    def test_leaf_dimension_is_a_no_op(self):
        conn = FakeConn(select_results=[])
        worker._cascade_dependents(conn, 'scan_refresh', '2026-09-11', self.job)
        self.assertEqual(inserts(conn), [])

    def test_a_cascade_error_never_fails_the_parent(self):
        class Boom(FakeConn):
            def cursor(self):
                raise RuntimeError('db gone')
        # Must not raise — the fix that just succeeded stays succeeded.
        worker._cascade_dependents(Boom(), 'vani_flags', '2026-09-11', self.job)

    def test_cap_bounds_one_parent(self):
        original = worker.CASCADE_MAX
        try:
            worker.CASCADE_MAX = 2
            conn = FakeConn(select_results=[])
            worker._cascade_dependents(conn, 'nse_equity_indicators', '2026-09-11', self.job)
            self.assertLessEqual(len(inserts(conn)), 2)
        finally:
            worker.CASCADE_MAX = original


if __name__ == '__main__':
    unittest.main(verbosity=2)


# ── The 2026-09-22 Stage 2 Leaders outage ────────────────────────────────────
#
# Both defects below produced ONE user-visible symptom: Stage 2 Leaders served
# an empty list while the admin dashboard stayed green.
#
#   rolling_metrics and stage_classification were enqueued as SIBLINGS in one
#   cascade batch, ran concurrently, both UPDATE km_equity_eod, and DEADLOCKED.
#   rolling_metrics lost — but its forced nullify had already COMMITTED, so
#   w52_high / w52_low / lifetime_high were NULL for the whole bar.
#   stage_classification then COMPLETED against those NULLs, and the Weinstein
#   S2 gate requires both to be non-NULL, so all 7,520 rows fell through to
#   S2_CANDIDATE: 0 S2 against ~1,030 the day before.
#
#   Nobody was told, because integrity_checks is the LAST step of the daily run
#   (~19:07) while the gap sweep fires at 19:30 and its cascade at 19:31+ — so
#   the failure is created after that day's sweep has finished and is invisible
#   until the next day's. The same shape on 2026-09-16 was duly reported... on
#   2026-09-17.

class ParentFailureGuardTest(unittest.TestCase):
    """A dependent must not run when its parent's fix just FAILED."""

    def test_parent_failure_is_detected_and_named(self):
        # The guard asks one question; the stub answers with the failed parent.
        conn = FakeConn(select_results=[('rolling_metrics',)])
        blocked = worker._parent_failed_recently(conn, 'stage_classification', '2026-09-22')
        self.assertEqual(blocked, 'rolling_metrics')

        sql, params = conn.cursor_obj.statements[-1]
        self.assertIn("status = 'failed'", sql)
        self.assertIn('km_jobs', sql)
        # It must be scoped to the SAME BAR — a failure on another date says
        # nothing about this one.
        self.assertIn('2026-09-22', [str(p) for p in params])

    def test_parents_are_read_from_the_declared_graph(self):
        # rolling_metrics -> stage_classification is the edge the outage needed;
        # if it is ever removed, this guard silently stops protecting stage.
        from pipeline2 import watermarks
        self.assertIn('rolling_metrics',
                      watermarks.parents_of().get('stage_classification', []))

    def test_no_parents_means_no_query_and_no_block(self):
        # A root dimension must not be blocked by an empty ANY() match.
        conn = FakeConn(select_results=[])
        roots = [d for d, p in __import__('pipeline2.watermarks', fromlist=['x'])
                 .parents_of().items() if not p]
        if roots:
            self.assertIsNone(worker._parent_failed_recently(conn, roots[0], '2026-09-22'))

    def test_healthy_parent_does_not_block(self):
        conn = FakeConn(select_results=[None])
        self.assertIsNone(
            worker._parent_failed_recently(conn, 'stage_classification', '2026-09-22'))


class FailureIsReportedImmediatelyTest(unittest.TestCase):
    """A failed fix writes its own CRITICAL finding — it does not wait a day."""

    def test_finding_is_written_with_the_sweep_s_own_key(self):
        conn = FakeConn()
        worker._record_failure_finding(
            conn, 'rolling_metrics', '2026-09-22', 'deadlock detected', 3842)

        sql, params = conn.cursor_obj.statements[-1]
        self.assertIn('km_integrity_findings', sql)
        flat = ' '.join(str(p) for p in params)
        # critical, or the dashboard stays green
        self.assertIn('critical', sql + flat)
        self.assertIn('step_failure', sql + flat)
        # Same check_key the nightly sweep uses, so the two agree instead of
        # filing the same outage under two different names.
        self.assertIn('step_rolling_metrics_2026-09-22', flat)
        self.assertIn('deadlock detected', flat)
        self.assertEqual(conn.commits, 1, 'the finding must be committed, not left open')

    def test_reporting_never_raises(self):
        # A reporting failure must not become a second job failure.
        class Exploding(FakeConn):
            def cursor(self):
                raise RuntimeError('findings table is gone')

        worker._record_failure_finding(
            Exploding(), 'rolling_metrics', '2026-09-22', 'boom', 1)


class OutageWiringTest(unittest.TestCase):
    """The helpers exist AND _run_fix actually calls them."""

    def test_run_fix_guards_and_reports(self):
        import inspect
        src = inspect.getsource(worker._run_fix)
        self.assertIn('_parent_failed_recently', src,
                      'the parent guard is not wired into _run_fix')
        self.assertIn('_record_failure_finding', src,
                      'failures are not reported from _run_fix')
        # The deferral must be TERMINAL. _claim_job orders by created_at, which
        # a deferral does not change, so re-queueing hands the same job back on
        # the next poll — a hot loop that also starves everything behind it.
        # Assert on the CALL, not the prose — the comment above it explains
        # why status='queued' is wrong and would otherwise trip this.
        calls = [ln for ln in src.splitlines()
                 if '_update_job(' in ln and 'status=' in ln]
        self.assertTrue(any("status='deferred'" in ln for ln in calls),
                        'the deferral does not end the job — that spins')
        self.assertFalse(any("status='queued'" in ln for ln in calls),
                         'a re-queued deferral is re-claimed immediately by _claim_job')
        # Three failure paths: RuntimeError, generic Exception, and a handler
        # that RETURNS status='failed' without raising.
        self.assertGreaterEqual(
            src.count('_record_failure_finding'), 3,
            'a failure path still reports nothing')
