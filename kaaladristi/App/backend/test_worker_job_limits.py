"""A job may not hold the pipeline worker forever.

On 2026-10-01 one nse_flow fix held the worker from 00:00 to 09:58 IST.
The worker now puts statement and lock limits into PGOPTIONS before it
connects. No DB.

    python -m unittest test_worker_job_limits
"""
import unittest

from pipeline2 import worker


class JobLimitTests(unittest.TestCase):
    def test_both_limits_are_set(self):
        opts = worker.job_time_limits('')
        self.assertIn(f'statement_timeout={worker.STATEMENT_TIMEOUT_MIN * 60000}', opts)
        self.assertIn(f'lock_timeout={worker.LOCK_TIMEOUT_MIN * 60000}', opts)

    def test_an_operator_value_wins(self):
        opts = worker.job_time_limits('-c lock_timeout=5000')
        self.assertIn('lock_timeout=5000', opts)
        self.assertEqual(opts.count('lock_timeout'), 1)
        self.assertIn('statement_timeout=', opts)

    def test_main_sets_pgoptions_before_connecting(self):
        import inspect
        src = inspect.getsource(worker.main)
        self.assertLess(src.index("os.environ['PGOPTIONS']"), src.index('_connect()'))


if __name__ == '__main__':
    unittest.main()
