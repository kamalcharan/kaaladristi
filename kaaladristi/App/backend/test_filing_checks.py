"""
The second opinion — lib/filing_checks.py + migration 233
=========================================================
    KD_TEST_DSN=postgresql://postgres@localhost:5499/kd_test python3 -m unittest test_filing_checks

Runs against a THROWAWAY cluster (the DSN's database name must contain
'test'); skipped without one. No network, no model — the client is a stub.
"""

import os
import unittest

from lib import filing_reader as fr
from lib import filing_checks as fc

fr.REQUEST_DELAY_SEC = 0

DSN = os.environ.get('KD_TEST_DSN')
DB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'DBscripts')
MIGRATIONS = ('km_migration_212_filings_ingest.sql',
              'km_migration_214_board_meetings.sql',
              'km_migration_215_result_drift.sql',
              'km_migration_216_result_drift_dedup.sql',
              'km_migration_217_bulk_deals.sql',
              'km_migration_228_day_zero_calendar.sql',
              'km_migration_229_filing_reads.sql',
              'km_migration_230_filing_reads_triage.sql',
              'km_migration_231_filing_reads_ocr_source.sql',
              'km_migration_233_filing_read_checks.sql')


class _Usage:
    input_tokens, output_tokens = 1200, 300


class _Resp:
    def __init__(self, verdict, model):
        self.parsed_output, self.usage, self.model = verdict, _Usage(), model


class StubClient:
    """Answers every parse with one verdict; records what it was sent."""
    def __init__(self, impact='positive', magnitude='notable', model='Qwen3-4B-Q4_K_M.gguf', fail=False):
        self.calls, self.fail = [], fail
        outer = self

        class _M:
            def parse(self, **kw):
                outer.calls.append(kw)
                if outer.fail:
                    raise RuntimeError('404 Client Error: Not Found')
                return _Resp(fr.FilingVerdict(impact=impact, magnitude=magnitude, headline='stub headline',
                                              reasoning='because', evidence_quote='quoted', confidence=0.8),
                             model)
        self.messages = _M()


@unittest.skipUnless(DSN, 'KD_TEST_DSN not set')
class Checks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import psycopg2
        if 'test' not in DSN.rsplit('/', 1)[-1]:
            raise unittest.SkipTest("KD_TEST_DSN's database name must contain 'test'")
        cls.conn = psycopg2.connect(DSN)
        with cls.conn.cursor() as c:
            c.execute("""
                DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
                DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
                DO $$ BEGIN CREATE ROLE kd_app; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
                DO $$ BEGIN CREATE ROLE kd_readonly; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
                CREATE TABLE IF NOT EXISTS km_equity_eod (equity_id int, trade_date date, close numeric, prev_close numeric);
                CREATE TABLE IF NOT EXISTS km_equity_symbols (id serial primary key, symbol text, isin text, exchange text, is_active bool);
                ALTER TABLE km_equity_symbols ADD COLUMN IF NOT EXISTS industry text;
                ALTER TABLE km_equity_symbols ADD COLUMN IF NOT EXISTS mcap_cr numeric;
                CREATE TABLE IF NOT EXISTS km_jobs (id serial primary key, job_type text, dimension text,
                    status text, started_at timestamptz);
                CREATE TABLE IF NOT EXISTS km_trading_calendar (trade_date date, exchange text, is_holiday bool DEFAULT false,
                    holiday_name text, status text, created_at timestamptz DEFAULT now(), PRIMARY KEY (trade_date, exchange));
                DROP VIEW IF EXISTS v_filing_read_agreement;
                DROP VIEW IF EXISTS v_result_drift; DROP FUNCTION IF EXISTS kd_result_returns(DATE, DATE, INTEGER);
            """)
            for name in MIGRATIONS:
                with open(os.path.join(DB_DIR, name)) as fh:
                    c.execute(fh.read())
        cls.conn.commit()

    @classmethod
    def tearDownClass(cls):
        cls.conn.close()

    def setUp(self):
        with self.conn.cursor() as c:
            c.execute('TRUNCATE km_filing_read_checks, km_filing_reads, km_corporate_events, km_filings_raw, '
                      'km_equity_symbols RESTART IDENTITY CASCADE')
            c.execute("INSERT INTO km_equity_symbols (symbol, isin, exchange, is_active, industry, mcap_cr) "
                      "VALUES ('HECINFRA','INE00H','NSE',true,'Construction',600)")
        self.conn.commit()
        fc._state.update(running=False, last=None, error=None)

    # a done primary read, by the model named, with stored text
    def _read(self, name, model='local:Qwen3-4B-Q4_K_M.gguf', impact='positive', magnitude='notable',
              text='Page one of the order.\n\nPage two: value INR 120 crore.', event_type='LARGE_ORDER'):
        with self.conn.cursor() as c:
            c.execute("INSERT INTO km_filings_raw (source, source_ann_id, isin, disseminated_at, content_hash, payload, "
                      "doc_url, summary_text, raw_text, page_count) VALUES ('NSE',%s,'INE00H','2026-09-20 10:00+05:30',"
                      "'h','{}','http://x/a.pdf','order received',%s,2) RETURNING id", (name, text))
            rid = c.fetchone()[0]
            c.execute("INSERT INTO km_corporate_events (primary_raw_id, isin, company_name, desc_raw, family, event_type, "
                      "disseminated_at, day_0_trade_date) VALUES (%s,'INE00H',%s,'Bagging/Receiving of orders/contracts',"
                      "'SPARK',%s,'2026-09-20 10:00+05:30','2026-09-21') RETURNING id", (rid, name, event_type))
            eid = c.fetchone()[0]
            c.execute("INSERT INTO km_filing_reads (event_id, status, model, impact, magnitude, headline, finished_at) "
                      "VALUES (%s,'done',%s,%s,%s,'primary headline', now())", (eid, model, impact, magnitude))
        self.conn.commit()
        return eid

    def _checks(self):
        with self.conn.cursor() as c:
            c.execute("SELECT event_id, backend, status, impact, model, cost_usd, last_error FROM km_filing_read_checks ORDER BY id")
            return c.fetchall()

    # ── requests ──────────────────────────────────────────────────────

    def test_the_check_is_always_the_other_backend(self):
        q = self._read('QWENREAD')                                  # local primary
        h = self._read('HAIKUREAD', model='claude-haiku-4-5')       # paid primary
        r = fc.request_checks(self.conn, [q, h], 'anthropic', None)
        self.assertEqual((r['queued'], r['same_backend']), (1, 1))
        r = fc.request_checks(self.conn, [q, h], 'local', None)
        self.assertEqual((r['queued'], r['same_backend']), (1, 1))
        rows = self._checks()
        self.assertEqual([(x[0], x[1]) for x in rows], [(q, 'anthropic'), (h, 'local')])

    def test_a_paid_request_is_capped_and_a_done_check_is_never_rerun(self):
        ids = [self._read(f'R{i}') for i in range(fc.PAID_PER_REQUEST + 3)]
        r = fc.request_checks(self.conn, ids, 'anthropic', None)
        self.assertEqual((r['queued'], r['capped']), (fc.PAID_PER_REQUEST, 3))
        with self.conn.cursor() as c:
            c.execute("UPDATE km_filing_read_checks SET status = 'done', impact = 'positive'")
        self.conn.commit()
        r = fc.request_checks(self.conn, ids[:2], 'anthropic', None)
        self.assertEqual((r['queued'], r['already']), (0, 2))

    def test_a_failed_check_is_reset_by_a_new_request(self):
        q = self._read('Q1')
        fc.request_checks(self.conn, [q], 'anthropic', None)
        with self.conn.cursor() as c:
            c.execute("UPDATE km_filing_read_checks SET status = 'failed', attempts = 3, last_error = 'x'")
        self.conn.commit()
        r = fc.request_checks(self.conn, [q], 'anthropic', None)
        self.assertEqual(r['queued'], 1)
        self.assertEqual(self._checks()[0][2], 'pending')

    def test_an_event_without_a_done_read_cannot_be_checked(self):
        q = self._read('Q1')
        with self.conn.cursor() as c:
            c.execute("UPDATE km_filing_reads SET status = 'pending', model = NULL")
        self.conn.commit()
        r = fc.request_checks(self.conn, [q, 999999], 'anthropic', None)
        self.assertEqual(r['no_read'], 2)
        self.assertEqual(self._checks(), [])

    def test_queue_local_checks_covers_every_paid_read_once(self):
        self._read('H1', model='claude-haiku-4-5')
        self._read('H2', model='claude-haiku-4-5')
        self._read('Q1')                                            # local primary: not queued
        self._read('H3', model='claude-haiku-4-5', text='')         # no text: not queued
        self.assertEqual(fc.queue_local_checks_for_paid_reads(self.conn, None), 2)
        self.assertEqual(fc.queue_local_checks_for_paid_reads(self.conn, None), 0)
        self.assertTrue(all(b == 'local' for _, b, *_ in self._checks()))

    # ── the runner ────────────────────────────────────────────────────

    def test_run_one_stores_the_verdict_with_the_served_model_and_zero_cost_for_local(self):
        h = self._read('H1', model='claude-haiku-4-5', impact='positive', magnitude='notable')
        fc.request_checks(self.conn, [h], 'local', None)
        stub = StubClient(impact='negative', magnitude='minor')
        stats = fc.run_pending(self.conn, clients={'local': stub})
        self.assertEqual(stats['done'], 1)
        eid, backend, status, impact, model, cost, _ = self._checks()[0]
        self.assertEqual((status, impact, model, float(cost)), ('done', 'negative', 'local:Qwen3-4B-Q4_K_M.gguf', 0.0))
        # the verdict was formed from the STORED text, never a download
        sent = stub.calls[0]['messages'][0]['content'][0]['text']
        self.assertIn('Page two: value INR 120 crore.', sent)
        self.assertEqual(stub.calls[0]['model'], f'local:{fr.LOCAL_MODEL}')

    def test_stop_parks_waiting_checks_and_ends_the_run(self):
        h1 = self._read('H1', model='claude-haiku-4-5')
        h2 = self._read('H2', model='claude-haiku-4-5')
        fc.request_checks(self.conn, [h1, h2], 'local', None)
        self.assertEqual(fc.stop_checks(self.conn), 2)
        self.assertTrue(all(st == 'failed' for _, _, st, *_ in self._checks()))
        self.assertEqual(fc.pending_count(self.conn), 0)       # nothing resumes at API start
        stats = fc.run_pending(self.conn, clients={'local': StubClient()})
        self.assertEqual((stats['done'], stats.get('stopped')), (0, 'stopped by admin'))
        fc._stop.clear()

    def test_running_now_says_where_each_item_runs(self):
        a = self._read('WORKER_CO')
        b = self._read('RUNNER_CO')
        with self.conn.cursor() as c:
            c.execute("UPDATE km_filing_reads SET status='reading', started_at=now() WHERE event_id IN (%s,%s) "
                      "RETURNING id, event_id", (a, b))
            ids = {eid: rid for rid, eid in c.fetchall()}
        self.conn.commit()
        fc._state['doing'] = {'kind': 'read', 'id': ids[b]}
        try:
            with self.conn.cursor() as cur:
                rows = {r['company']: r['where'] for r in fc._running_now(cur)}
        finally:
            fc._state['doing'] = None
        # No filings_ingest job is running, so the other row cannot be the worker's.
        self.assertEqual(rows['RUNNER_CO'], 'API runner')
        self.assertTrue(rows['WORKER_CO'].startswith('Interrupted'))
        self.assertIn('released when a reader next starts', rows['WORKER_CO'])

    def test_only_the_newest_read_since_the_ingest_job_is_the_workers(self):
        a, b = self._read('OLD_CUT_OFF'), self._read('WORKER_NOW')
        with self.conn.cursor() as c:
            c.execute("TRUNCATE km_jobs")
            c.execute("INSERT INTO km_jobs (job_type, dimension, status, started_at) "
                      "VALUES ('fix','filings_ingest','running', now() - interval '5 minutes')")
            c.execute("UPDATE km_filing_reads SET status='reading', started_at=now() - interval '50 minutes' "
                      "WHERE event_id=%s", (a,))
            c.execute("UPDATE km_filing_reads SET status='reading', started_at=now() - interval '2 minutes' "
                      "WHERE event_id=%s", (b,))
        self.conn.commit()
        with self.conn.cursor() as cur:
            rows = {r['company']: r['where'] for r in fc._running_now(cur)}
        self.assertEqual(rows['WORKER_NOW'], 'Pipeline worker')
        self.assertTrue(rows['OLD_CUT_OFF'].startswith('Interrupted'))
        with self.conn.cursor() as c:
            c.execute("TRUNCATE km_jobs")
        self.conn.commit()

    def test_current_filings_are_read_before_history_checks(self):
        # Owner 2026-10-01: "history is getting done, current is not analysed".
        h = self._read('H1', model='claude-haiku-4-5')
        fc.request_checks(self.conn, [h], 'local', None)
        order, waiting = [], ['done', 'done']

        def read_current(c):
            if not waiting:
                return None
            order.append('read')
            return waiting.pop(0)

        stub = StubClient()
        orig = stub.messages.parse

        def parse(**kw):
            order.append('check')
            return orig(**kw)
        stub.messages.parse = parse
        stats = fc.run_pending(self.conn, clients={'local': stub}, read_current=read_current)
        self.assertEqual(order, ['read', 'read', 'check'])
        self.assertEqual((stats['reads'], stats['done']), (2, 1))

    def test_the_runner_reads_current_first_then_the_backlog(self):
        # Owner 2026-10-01, "lets do A and B": the backlog drains in the API
        # thread too — but only after every current filing is read.
        from unittest import mock
        old = self._read('OLDFILING')
        new = self._read('NEWFILING')
        with self.conn.cursor() as c:
            c.execute("UPDATE km_filing_reads SET status='pending', finished_at=NULL")
            c.execute("UPDATE km_corporate_events SET disseminated_at = now() - interval '2 hours' WHERE id=%s", (new,))
        self.conn.commit()
        order = []

        def read_one(c, row, client, session):
            order.append(row['event_id'])
            fr._finish(c, row['read_id'], 'skipped', None)
            return 'done'
        with mock.patch.object(fr, 'read_one', read_one), \
             mock.patch.object(fr, 'client_for', lambda row: None), \
             mock.patch.object(fr, 'backend_missing', lambda *a: None), \
             mock.patch('pipeline.utils.nse_session.NseSession', lambda: None):
            reader = fc.current_reader(self.conn)
            for _ in range(3):
                reader(self.conn)
            self.assertEqual(order, [new, old])
            # switched off, the backlog is left to the worker
            with self.conn.cursor() as c:
                c.execute("UPDATE km_filing_reads SET status='pending', attempts=0")
            self.conn.commit()
            order.clear()
            with mock.patch.object(fc, 'BACKLOG_IN_API', False):
                reader = fc.current_reader(self.conn)
                while reader(self.conn):
                    pass
            self.assertEqual(order, [new])

    def test_a_paid_check_is_priced(self):
        q = self._read('Q1')
        fc.request_checks(self.conn, [q], 'anthropic', None)
        stub = StubClient(model='claude-haiku-4-5')
        fc.run_pending(self.conn, clients={'anthropic': stub})
        cost = float(self._checks()[0][5])
        self.assertAlmostEqual(cost, 1200 * 1.0 / 1e6 + 300 * 5.0 / 1e6, places=5)
        self.assertEqual(stub.calls[0]['model'], fr._resolve_model('anthropic'))

    def test_paid_checks_are_claimed_before_local_ones(self):
        h = self._read('H1', model='claude-haiku-4-5')
        q = self._read('Q1')
        fc.request_checks(self.conn, [h], 'local', None)         # queued first
        fc.request_checks(self.conn, [q], 'anthropic', None)     # queued second, claimed first
        first = fc.claim_next(self.conn)
        self.assertEqual(first['backend'], 'anthropic')

    def test_a_dead_backend_is_waited_for_and_the_run_resumes_on_its_own(self):
        # Owner, 2026-09-29: "it will run 3-4 and then stop, needs physical run
        # again". Five model errors in a row → the rows go back to pending,
        # the runner sleeps, and when the server answers again it finishes.
        ids = [self._read(f'H{i}', model='claude-haiku-4-5') for i in range(8)]
        fc.request_checks(self.conn, ids, 'local', None)
        stub = StubClient(fail=True)
        slept = []

        def fake_sleep(sec):
            slept.append(sec)
            stub.fail = False            # the server comes back while we wait
        fc._sleep = fake_sleep
        try:
            stats = fc.run_pending(self.conn, clients={'local': stub})
        finally:
            fc._sleep = __import__('time').sleep
        self.assertEqual(slept, [fc.BACKOFF_SEC])
        self.assertEqual((stats['done'], stats['backoffs']), (8, 1))
        self.assertNotIn('stopped', stats)
        rows = self._checks()
        self.assertTrue(all(r[2] == 'done' for r in rows))
        with self.conn.cursor() as c:
            c.execute("SELECT max(attempts) FROM km_filing_read_checks")
            self.assertEqual(c.fetchone()[0], 1)      # the dead-server attempt was not held against them

    def test_a_backend_that_never_returns_stops_after_the_rounds_with_rows_pending(self):
        ids = [self._read(f'H{i}', model='claude-haiku-4-5') for i in range(6)]
        fc.request_checks(self.conn, ids, 'local', None)
        slept = []
        fc._sleep = slept.append
        old_rounds, fc.BACKOFF_ROUNDS = fc.BACKOFF_ROUNDS, 2
        try:
            stats = fc.run_pending(self.conn, clients={'local': StubClient(fail=True)})
        finally:
            fc._sleep = __import__('time').sleep
            fc.BACKOFF_ROUNDS = old_rounds
        self.assertEqual(len(slept), 2)
        self.assertIn('did not answer', stats['stopped'])
        # nothing is lost: every row is pending, and no attempt was consumed
        self.assertTrue(all(r[2] == 'pending' for r in self._checks()))

    def test_a_document_failure_does_not_count_toward_the_streak(self):
        # six rows with no stored text fail one after another — that is the
        # documents, not the server, so no backoff and no requeue
        ids = [self._read(f'H{i}', model='claude-haiku-4-5', text='') for i in range(6)]
        with self.conn.cursor() as c:
            for eid in ids:
                c.execute("INSERT INTO km_filing_read_checks (event_id, backend) VALUES (%s, 'local')", (eid,))
        self.conn.commit()
        slept = []
        fc._sleep = slept.append
        try:
            stats = fc.run_pending(self.conn, clients={'local': StubClient()})
        finally:
            fc._sleep = __import__('time').sleep
        self.assertEqual((stats['failed'], stats['backoffs'], slept), (6, 0, []))

    def test_a_row_without_stored_text_fails_with_a_reason_and_never_fetches(self):
        h = self._read('H1', model='claude-haiku-4-5', text='')
        with self.conn.cursor() as c:
            c.execute("INSERT INTO km_filing_read_checks (event_id, backend) VALUES (%s, 'local')", (h,))
        self.conn.commit()
        stub = StubClient()
        fc.run_pending(self.conn, clients={'local': stub})
        row = self._checks()[0]
        self.assertEqual(row[2], 'failed')
        self.assertIn('no stored text', row[6])
        self.assertEqual(stub.calls, [])

    def test_the_agreement_view_labels_sides_by_model_not_by_table(self):
        h = self._read('H1', model='claude-haiku-4-5', impact='positive', magnitude='notable')
        q = self._read('Q1', model='local:Qwen3-4B-Q4_K_M.gguf', impact='negative', magnitude='minor')
        fc.request_checks(self.conn, [h], 'local', None)
        fc.request_checks(self.conn, [q], 'anthropic', None)
        fc.run_pending(self.conn, clients={'local': StubClient(impact='positive', magnitude='minor'),
                                           'anthropic': StubClient(impact='negative', magnitude='minor',
                                                                   model='claude-haiku-4-5')})
        with self.conn.cursor() as c:
            c.execute("SELECT event_id, haiku_impact, local_impact, agree_impact, agree_magnitude "
                      "FROM v_filing_read_agreement ORDER BY event_id")
            rows = c.fetchall()
        self.conn.rollback()
        # A check made after 2026-10-01 judges no size, so size is not compared (NULL), never "agrees".
        self.assertEqual(rows, [(h, 'positive', 'positive', True, None),
                                (q, 'negative', 'negative', True, None)])
        s = fc.summary(self.conn)
        self.assertEqual((s['compared'], s['agree_impact'], s['compared_magnitude']), (2, 2, 0))
        self.assertEqual(s['by_type'][0]['event_type'], 'LARGE_ORDER')

    def test_restart_resets_a_failed_read_but_never_a_done_one(self):
        q = self._read('Q1')
        self.assertFalse(fc.restart_read(self.conn, q))
        with self.conn.cursor() as c:
            c.execute("UPDATE km_filing_reads SET status = 'failed', attempts = 5, last_error = 'x'")
        self.conn.commit()
        self.assertTrue(fc.restart_read(self.conn, q))
        with self.conn.cursor() as c:
            c.execute("SELECT status, attempts, last_error FROM km_filing_reads")
            self.assertEqual(c.fetchone(), ('pending', 0, None))

    def test_the_runner_is_single_flight(self):
        q = self._read('Q1')
        fc.request_checks(self.conn, [q], 'anthropic', None)
        import psycopg2
        started = fc.ensure_runner(lambda: psycopg2.connect(DSN))
        self.assertTrue(started)
        self.assertFalse(fc.ensure_runner(lambda: psycopg2.connect(DSN)))
        for _ in range(200):
            if not fc.runner_state()['running']:
                break
            import time; time.sleep(0.05)
        self.assertFalse(fc.runner_state()['running'])


if __name__ == '__main__':
    unittest.main()
