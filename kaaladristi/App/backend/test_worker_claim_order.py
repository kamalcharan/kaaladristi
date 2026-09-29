"""Job claim order and lease-connection keepalives (no DB).

2026-09-28: a cascade enqueues its whole closure in one pass with ONE
created_at, so `ORDER BY created_at` alone let big_money run 22 minutes
before rolling_metrics (its input) and supertrend before nse_equity_indicators;
both ended 'failed' at 0% on a bar that was fine. The closure is inserted in
DAILY_STEPS order, so the id tie-break restores the dependency order.

Same day: the scheduler fired nothing from 12:10 to 21:30 IST across a run of
redeploys — each new process found the scheduler lease held by its
predecessor's lingering idle session. Keepalives on the lease connections let
the server reap a dead peer in about a minute instead of hours.
"""
import inspect
import unittest

from pipeline2 import lease, worker, scheduler


class ClaimOrder(unittest.TestCase):
    def test_claim_breaks_created_at_ties_on_id(self):
        sql = inspect.getsource(worker._claim_job)
        self.assertRegex(sql, r"ORDER BY created_at, id\s+LIMIT 1")


class LeaseKeepalives(unittest.TestCase):
    def test_keepalive_parameters(self):
        k = lease.KEEPALIVES
        self.assertEqual(k['keepalives'], 1)
        self.assertLessEqual(k['keepalives_idle'] + k['keepalives_interval'] * k['keepalives_count'], 120,
                             'a dead peer must be reaped within two minutes')

    def test_worker_and_scheduler_connect_with_keepalives(self):
        self.assertIn('**lease.KEEPALIVES', inspect.getsource(worker._connect))
        src = inspect.getsource(scheduler.start_scheduler)
        self.assertRegex(src, r"psycopg2\.connect\(dsn, \*\*lease\.KEEPALIVES\)")

    def test_refused_lease_names_the_holder(self):
        self.assertIn('holder_note', inspect.getsource(lease.try_acquire))


if __name__ == '__main__':
    unittest.main()
