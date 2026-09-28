"""
The read — lib/filing_reader.py + migration 229
===============================================
    createdb kd_test
    KD_TEST_DSN=postgresql://postgres@localhost:5499/kd_test python3 -m unittest test_filing_reader

No network, no model: the NSE session and the Anthropic client are stubs, and
the PDFs are built in the test. The SQL tests need a throwaway PostgreSQL and
SKIP without one (same rule as test_filing_intelligence: the DSN's database
name must contain 'test', because the tables are TRUNCATED).

What these pin, none of it visible in a type:
  * a pending row exists for every material event and for nothing else
  * newest first, capped per pass — the backlog never delays today's read
  * a thin text layer goes the PDF route (scanned pages) and says so
  * failure is retried by the next pass, then terminal; no document is terminal
  * no API key → rows stay pending and the pass still completes
  * a partial read (page cap) is recorded as partial
  * an off-vocabulary verdict from the model never reaches the CHECK constraint
  * the read is the LAST step of the ingest pass and cannot fail it
"""

from __future__ import annotations

import ast
import os
import unittest
from unittest import mock

from lib import filing_reader as fr

fr.REQUEST_DELAY_SEC = 0          # no pacing in tests

DSN = os.environ.get('KD_TEST_DSN')
DB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'DBscripts')
MIGRATIONS = ('km_migration_212_filings_ingest.sql',
              'km_migration_214_board_meetings.sql',
              'km_migration_215_result_drift.sql',
              'km_migration_216_result_drift_dedup.sql',
              'km_migration_217_bulk_deals.sql',
              'km_migration_228_day_zero_calendar.sql',
              'km_migration_229_filing_reads.sql')


# ── PDFs built by hand: pypdf reads them, no other library is needed ──────

def _pdf(pages: list[str]) -> bytes:
    """A minimal PDF. Each entry is one page's text ('' = a page with no
    text layer, i.e. a scanned image)."""
    objs = []                                     # (num, body)
    n_pages = len(pages)
    kids = ' '.join(f'{3 + 2 * i} 0 R' for i in range(n_pages))
    objs.append('<< /Type /Catalog /Pages 2 0 R >>')
    objs.append(f'<< /Type /Pages /Kids [{kids}] /Count {n_pages} >>')
    font_num = 3 + 2 * n_pages
    for i, text in enumerate(pages):
        content_num = 4 + 2 * i
        objs.append(f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] '
                    f'/Contents {content_num} 0 R /Resources << /Font << /F1 {font_num} 0 R >> >> >>')
        lines = []
        y = 740
        for chunk in [text[j:j + 80] for j in range(0, len(text), 80)]:
            esc = chunk.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')
            lines.append(f'BT /F1 10 Tf 40 {y} Td ({esc}) Tj ET')
            y -= 14
        stream = '\n'.join(lines)
        objs.append(f'<< /Length {len(stream)} >>\nstream\n{stream}\nendstream')
    objs.append('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
    out = b'%PDF-1.4\n'
    offsets = []
    for i, body in enumerate(objs, start=1):
        offsets.append(len(out))
        out += f'{i} 0 obj\n{body}\nendobj\n'.encode('latin-1')
    xref = len(out)
    out += f'xref\n0 {len(objs) + 1}\n0000000000 65535 f \n'.encode()
    for off in offsets:
        out += f'{off:010d} 00000 n \n'.encode()
    out += f'trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode()
    return out


ORDER_TEXT = ('Sub: Intimation under Regulation 30 of SEBI LODR. We are pleased to inform '
              'that the Company has received a purchase order worth Rs. 133.98 crore '
              '(inclusive of GST Rs. 140.68 crore) from a new client, Bharat Heavy '
              'Electricals Limited, for supply of transmission towers to be executed '
              'over 18 months. This is the largest single order received by the Company '
              'to date and will be executed from the Company existing capacity. ') * 2


class _Resp:
    def __init__(self, verdict, inp=1200, out=180):
        self.parsed_output = verdict
        self.usage = mock.Mock(input_tokens=inp, output_tokens=out)


class _Messages:
    def __init__(self, verdict=None, fail=None):
        self.calls = []
        self.verdict = verdict or fr.FilingVerdict(
            impact='positive', magnitude='major',
            headline='Rs 134 crore transmission-tower order from BHEL, the largest to date',
            reasoning='A new-client order equal to a large share of annual revenue.',
            evidence_quote='the Company has received a purchase order worth Rs. 133.98 crore',
            confidence=0.86, amount_value=133.98, amount_unit='INR_CR',
            amount_basis='order_value', relative_to='mcap', relative_pct=22.3,
            role='new_client')
        self.fail = fail

    def parse(self, **kw):
        self.calls.append(kw)
        if self.fail:
            raise self.fail
        return _Resp(self.verdict)


class _Client:
    def __init__(self, **kw):
        self.messages = _Messages(**kw)


class _Session:
    def __init__(self, docs: dict, fail: dict | None = None):
        self.docs, self.fail, self.calls = docs, fail or {}, []

    def get(self, url, retries=3, referer=None):
        self.calls.append(url)
        if url in self.fail:
            raise self.fail[url]
        return mock.Mock(content=self.docs[url])


# ── pure tests (no DB) ────────────────────────────────────────────────────

class Extraction(unittest.TestCase):
    def test_text_layer_is_read_and_gated(self):
        doc = fr.extract_text(_pdf([ORDER_TEXT]))
        self.assertIn('133.98 crore', doc.text)
        self.assertEqual((doc.page_count, doc.pages_read), (1, 1))
        self.assertFalse(doc.needs_pdf)

    def test_a_scanned_pdf_has_no_text_and_says_so(self):
        """pypdf reports SUCCESS on a page with no text layer. The chars-per-
        page gate is what turns that into 'send the PDF'."""
        doc = fr.extract_text(_pdf(['', '']))
        self.assertEqual(doc.text, '')
        self.assertTrue(doc.needs_pdf)

    def test_page_cap_is_recorded_not_hidden(self):
        doc = fr.extract_text(_pdf([ORDER_TEXT, ORDER_TEXT, ORDER_TEXT]), max_pages=2)
        self.assertEqual((doc.page_count, doc.pages_read), (3, 2))
        self.assertEqual(len(fr.extract_text(fr._pdf_first_pages(_pdf([ORDER_TEXT] * 3), 2)).text) > 0, True)

    def test_messages_text_route_carries_the_document(self):
        doc = fr.extract_text(_pdf([ORDER_TEXT]))
        msgs = fr.build_messages({'company_name': 'X', 'family': 'SPARK', 'mcap_cr': 600}, doc, None)
        body = msgs[0]['content'][0]['text']
        self.assertIn('133.98 crore', body)
        self.assertIn('Market capitalisation: INR 600 crore', body)
        self.assertEqual(len(msgs[0]['content']), 1)

    def test_messages_pdf_route_attaches_the_document(self):
        pdf = _pdf(['', ''])
        doc = fr.extract_text(pdf)
        msgs = fr.build_messages({'company_name': 'X', 'family': 'SPARK'}, doc, pdf)
        kinds = [c['type'] for c in msgs[0]['content']]
        self.assertEqual(kinds, ['text', 'document'])
        self.assertEqual(msgs[0]['content'][1]['source']['media_type'], 'application/pdf')

    def test_the_prompt_says_what_the_verdict_is_not(self):
        p = fr.SYSTEM_PROMPT
        self.assertIn('NOT a forecast of the share price', p)
        self.assertIn('NEVER advice to buy, sell, hold or trade', p)
        self.assertIn('VERBATIM', p)
        for word in ('bullish', 'bearish'):
            self.assertIn(word, p)          # named only to be forbidden

    def test_cost_table_covers_the_default_model(self):
        self.assertIn(fr.MODEL, fr.PRICES)
        self.assertAlmostEqual(fr._cost('claude-opus-5', 1_000_000, 0), 5.0)
        self.assertIsNone(fr._cost('some-other-model', 10, 10))


class Wiring(unittest.TestCase):
    def test_the_read_is_the_last_step_of_the_ingest_pass_and_cannot_fail_it(self):
        path = os.path.join(os.path.dirname(__file__), 'scripts', 'ingest_nse_filings.py')
        src = open(path, encoding='utf-8').read()
        run_src = src[src.index('def run(conn, session'):src.index('def ingest_filings_for_pipeline')]
        self.assertLess(run_src.index('reconcile_day_zero(conn)'), run_src.index('read_material_filings(conn, session)'))
        self.assertLess(run_src.index('derive_events(conn)'), run_src.index('read_material_filings(conn, session)'))
        fn = src[src.index('def read_material_filings'):src.index('def run(conn, session')]
        self.assertIn('except Exception', fn, 'a reader failure must never fail the ingest pass')
        self.assertIn('return None', fn)
        tree = ast.parse(src)
        names = {n.name for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)}
        self.assertIn('read_material_filings', names)

    def test_health_reports_read_status(self):
        path = os.path.join(os.path.dirname(__file__), 'pipeline2_api.py')
        src = open(path, encoding='utf-8').read()
        fn = src[src.index('def _health_body'):src.index("@app.get('/internal/health')")]
        self.assertIn("'filing_reads': filing_reads", fn)
        self.assertIn('status_counts', fn)


# ── SQL tests (throwaway cluster) ─────────────────────────────────────────

@unittest.skipUnless(DSN, 'KD_TEST_DSN not set')
class Reads(unittest.TestCase):
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
                CREATE TABLE IF NOT EXISTS km_trading_calendar (trade_date date, exchange text, is_holiday bool DEFAULT false,
                    holiday_name text, status text, created_at timestamptz DEFAULT now(), PRIMARY KEY (trade_date, exchange));
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
            c.execute('TRUNCATE km_filing_reads, km_corporate_events, km_filings_raw, '
                      'km_equity_symbols RESTART IDENTITY CASCADE')
            c.execute("INSERT INTO km_equity_symbols (symbol, isin, exchange, is_active, industry, mcap_cr) "
                      "VALUES ('HECINFRA','INE00H','NSE',true,'Construction',600)")
        self.conn.commit()

    def _event(self, name, diss, family='SPARK', url='http://x/a.pdf', desc='Bagging/Receiving of orders/contracts'):
        with self.conn.cursor() as c:
            c.execute("INSERT INTO km_filings_raw (source, source_ann_id, isin, disseminated_at, "
                      "content_hash, payload, doc_url, summary_text) VALUES ('NSE',%s,'INE00H',%s,'h','{}',%s,%s) RETURNING id",
                      (name, diss, url, f'{name} has informed the Exchange about {desc}'))
            rid = c.fetchone()[0]
            c.execute("INSERT INTO km_corporate_events (isin, company_name, disseminated_at, day_0_trade_date, "
                      "family, desc_raw, primary_raw_id, raw_ids) VALUES ('INE00H',%s,%s,%s,%s,%s,%s,ARRAY[%s]) RETURNING id",
                      (name, diss, diss[:10], family, desc, rid, rid))
            eid = c.fetchone()[0]
        self.conn.commit()
        return eid

    def _rows(self):
        with self.conn.cursor() as c:
            c.execute('SELECT e.company_name, r.status, r.attempts, r.impact, r.magnitude, r.read_source, '
                      'r.pages_read, r.page_count, r.evidence_quote, r.input_tokens, r.cost_usd, r.model, r.last_error '
                      'FROM km_filing_reads r JOIN km_corporate_events e ON e.id = r.event_id ORDER BY r.id')
            cols = ('name', 'status', 'attempts', 'impact', 'magnitude', 'source', 'pages_read',
                    'page_count', 'quote', 'input_tokens', 'cost', 'model', 'error')
            return {r[0]: dict(zip(cols, r)) for r in c.fetchall()}

    def _raw(self, name):
        with self.conn.cursor() as c:
            c.execute('SELECT raw_text, extract_status, page_count, char_count FROM km_filings_raw WHERE source_ann_id=%s', (name,))
            return c.fetchone()

    # ── the queue ────────────────────────────────────────────────────────
    def test_a_pending_row_for_every_material_event_and_nothing_else(self):
        self._event('spark', '2026-09-28 10:00+05:30', 'SPARK')
        self._event('neg', '2026-09-28 10:01+05:30', 'NEGATIVE_SPARK')
        self._event('own', '2026-09-28 10:02+05:30', 'OWNERSHIP')
        self._event('ca', '2026-09-28 10:03+05:30', 'CORPORATE_ACTION')
        self._event('gen', '2026-09-28 10:04+05:30', 'GENERAL')
        self._event('unc', '2026-09-28 10:05+05:30', 'UNCLASSIFIED')
        self.assertEqual(fr.enqueue_pending(self.conn), 4)
        self.assertEqual(fr.enqueue_pending(self.conn), 0, 'idempotent')
        self.assertEqual(sorted(self._rows()), ['ca', 'neg', 'own', 'spark'])
        self.assertEqual(fr.status_counts(self.conn),
                         {'pending': 4, 'reading': 0, 'done': 0, 'failed': 0, 'unreadable': 0})

    def test_since_bounds_the_enqueue(self):
        self._event('old', '2026-01-05 10:00+05:30')
        self._event('new', '2026-09-28 10:00+05:30')
        self.assertEqual(fr.enqueue_pending(self.conn, since='2026-03-28 00:00+05:30'), 1)
        self.assertEqual(list(self._rows()), ['new'])

    # ── the read ─────────────────────────────────────────────────────────
    def test_text_route_writes_the_verdict_and_stores_the_text(self):
        self._event('hec', '2026-09-28 10:00+05:30')
        fr.enqueue_pending(self.conn)
        client, session = _Client(), _Session({'http://x/a.pdf': _pdf([ORDER_TEXT])})
        stats = fr.read_pending(self.conn, session=session, client=client)
        self.assertEqual((stats['read'], stats['done']), (1, 1))
        r = self._rows()['hec']
        self.assertEqual((r['status'], r['impact'], r['magnitude'], r['source']), ('done', 'positive', 'major', 'text'))
        self.assertIn('133.98 crore', r['quote'])
        self.assertEqual(r['input_tokens'], 1200)
        self.assertAlmostEqual(float(r['cost']), 1200 * 5 / 1e6 + 180 * 25 / 1e6, places=5)
        self.assertEqual(r['model'], fr.MODEL)
        raw_text, ext, pc, cc = self._raw('hec')
        self.assertIn('133.98', raw_text); self.assertEqual(ext, 'ok'); self.assertEqual(pc, 1)
        call = client.messages.calls[0]
        self.assertEqual(call['model'], fr.MODEL)
        self.assertIs(call['output_format'], fr.FilingVerdict)
        self.assertEqual(call['system'], fr.SYSTEM_PROMPT)
        self.assertIn('Market capitalisation: INR 600 crore', call['messages'][0]['content'][0]['text'])
        self.assertEqual(fr.status_counts(self.conn)['done'], 1)

    def test_a_scanned_pdf_goes_the_pdf_route_and_says_so(self):
        self._event('scan', '2026-09-28 10:00+05:30')
        fr.enqueue_pending(self.conn)
        client, session = _Client(), _Session({'http://x/a.pdf': _pdf(['', ''])})
        fr.read_pending(self.conn, session=session, client=client)
        r = self._rows()['scan']
        self.assertEqual((r['status'], r['source']), ('done', 'pdf'))
        self.assertEqual(self._raw('scan')[1], 'needs_ocr')
        content = client.messages.calls[0]['messages'][0]['content']
        self.assertEqual([c['type'] for c in content], ['text', 'document'])

    def test_newest_first_and_capped_per_pass(self):
        self._event('old', '2026-09-26 10:00+05:30')
        self._event('mid', '2026-09-27 10:00+05:30')
        self._event('new', '2026-09-28 10:00+05:30')
        fr.enqueue_pending(self.conn)
        client, session = _Client(), _Session({'http://x/a.pdf': _pdf([ORDER_TEXT])})
        stats = fr.read_pending(self.conn, session=session, client=client, limit=2)
        self.assertEqual(stats['read'], 2)
        rows = self._rows()
        self.assertEqual({k: v['status'] for k, v in rows.items()},
                         {'old': 'pending', 'mid': 'done', 'new': 'done'})
        # the next pass picks up what is left, and re-reads nothing
        stats = fr.read_pending(self.conn, session=session, client=client, limit=5)
        self.assertEqual(stats['read'], 1)
        self.assertEqual(len(client.messages.calls), 3)

    def test_a_fetch_failure_is_retried_then_terminal(self):
        self._event('gone', '2026-09-28 10:00+05:30')
        fr.enqueue_pending(self.conn)
        session = _Session({}, fail={'http://x/a.pdf': RuntimeError('404 Not Found')})
        client = _Client()
        for attempt in range(1, fr.MAX_ATTEMPTS):
            fr.read_pending(self.conn, session=session, client=client)
            r = self._rows()['gone']
            self.assertEqual((r['status'], r['attempts']), ('failed', attempt))
            self.assertIn('404', r['error'])
        fr.read_pending(self.conn, session=session, client=client)
        r = self._rows()['gone']
        self.assertEqual((r['status'], r['attempts']), ('unreadable', fr.MAX_ATTEMPTS))
        # terminal: a further pass does not touch it
        self.assertEqual(fr.read_pending(self.conn, session=session, client=client)['read'], 0)
        self.assertEqual(client.messages.calls, [], 'the model is never called for a document that never arrived')

    def test_a_model_failure_is_failed_and_retried_next_pass(self):
        self._event('hec', '2026-09-28 10:00+05:30')
        fr.enqueue_pending(self.conn)
        session = _Session({'http://x/a.pdf': _pdf([ORDER_TEXT])})
        fr.read_pending(self.conn, session=session, client=_Client(fail=TimeoutError('read timed out')))
        r = self._rows()['hec']
        self.assertEqual((r['status'], r['attempts']), ('failed', 1))
        self.assertIn('model: read timed out', r['error'])
        stats = fr.read_pending(self.conn, session=session, client=_Client())
        self.assertEqual(stats['done'], 1)
        self.assertEqual(self._rows()['hec']['status'], 'done')

    def test_no_document_url_is_unreadable_at_once(self):
        self._event('nodoc', '2026-09-28 10:00+05:30', url='')
        fr.enqueue_pending(self.conn)
        client = _Client()
        fr.read_pending(self.conn, session=_Session({}), client=client)
        self.assertEqual(self._rows()['nodoc']['status'], 'unreadable')
        self.assertEqual(client.messages.calls, [])

    def test_not_a_pdf_is_unreadable(self):
        self._event('html', '2026-09-28 10:00+05:30')
        fr.enqueue_pending(self.conn)
        fr.read_pending(self.conn, session=_Session({'http://x/a.pdf': b'<html>login</html>'}), client=_Client())
        r = self._rows()['html']
        self.assertEqual(r['status'], 'unreadable'); self.assertIn('not a PDF', r['error'])

    def test_no_api_key_leaves_rows_pending(self):
        self._event('hec', '2026-09-28 10:00+05:30')
        fr.enqueue_pending(self.conn)
        with mock.patch.dict(os.environ, {'ANTHROPIC_API_KEY': ''}):
            stats = fr.read_pending(self.conn, session=_Session({}))
        self.assertEqual(stats['read'], 0)
        self.assertIn('ANTHROPIC_API_KEY', stats['skipped'])
        self.assertEqual(self._rows()['hec']['status'], 'pending')

    def test_page_cap_is_a_partial_read_on_the_row(self):
        self._event('long', '2026-09-28 10:00+05:30')
        fr.enqueue_pending(self.conn)
        with mock.patch.object(fr, 'MAX_PAGES', 2):
            fr.read_pending(self.conn, session=_Session({'http://x/a.pdf': _pdf([ORDER_TEXT] * 3)}), client=_Client())
        r = self._rows()['long']
        self.assertEqual((r['status'], r['pages_read'], r['page_count']), ('done', 2, 3))

    def test_an_off_vocabulary_verdict_never_reaches_the_check_constraint(self):
        self._event('hec', '2026-09-28 10:00+05:30')
        fr.enqueue_pending(self.conn)
        bad = fr.FilingVerdict(impact='bullish', magnitude='huge', headline='h', reasoning='r',
                               evidence_quote='q', confidence=1.7, relative_to='sales')
        fr.read_pending(self.conn, session=_Session({'http://x/a.pdf': _pdf([ORDER_TEXT])}), client=_Client(verdict=bad))
        r = self._rows()['hec']
        self.assertEqual((r['status'], r['impact'], r['magnitude']), ('done', 'unclear', 'unknown'))

    def test_budget_stops_the_run(self):
        for i in range(3):
            self._event(f'e{i}', f'2026-09-2{6 + i} 10:00+05:30')
        fr.enqueue_pending(self.conn)
        stats = fr.read_pending(self.conn, session=_Session({'http://x/a.pdf': _pdf([ORDER_TEXT])}),
                                client=_Client(), budget_usd=0.005)
        self.assertEqual(stats['read'], 1)
        self.assertIn('budget', stats['skipped'])
        self.assertEqual(fr.status_counts(self.conn)['pending'], 2)

    def test_a_row_left_reading_by_a_killed_process_is_released(self):
        self._event('hec', '2026-09-28 10:00+05:30')
        fr.enqueue_pending(self.conn)
        with self.conn.cursor() as c:
            c.execute("UPDATE km_filing_reads SET status='reading', started_at = now() - interval '2 hours'")
        self.conn.commit()
        self.assertEqual(fr.release_stale_reading(self.conn), 1)
        self.assertEqual(self._rows()['hec']['status'], 'failed')
        self.assertEqual(fr.read_pending(self.conn, session=_Session({'http://x/a.pdf': _pdf([ORDER_TEXT])}),
                                         client=_Client())['done'], 1)


if __name__ == '__main__':
    unittest.main()
