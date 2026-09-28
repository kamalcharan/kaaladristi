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
  * a pending row exists for every IN-SCOPE material event and nothing else
    (gate 0: never RECORD_DATE/ESOP/ALLOTMENT, an active NSE listing at or
    above the mcap floor), and the prune removes only PENDING rows
  * gate 1 (triage on the extracted text) refuses to pay for a routine
    management change or an auditor's term completing, records why, and
    never touches the model — and a CFO resigning still gets read
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
              'km_migration_229_filing_reads.sql',
              'km_migration_230_filing_reads_triage.sql')


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
        self.assertEqual(fr.DEFAULT_MODEL, 'claude-haiku-4-5')   # owner, 2026-09-28
        self.assertIn(fr.DEFAULT_MODEL, fr.PRICES)
        self.assertIn(fr.MODEL, fr.PRICES)
        self.assertAlmostEqual(fr._cost('claude-haiku-4-5', 1_000_000, 0), 1.0)
        self.assertAlmostEqual(fr._cost('claude-opus-5', 1_000_000, 0), 5.0)
        self.assertIsNone(fr._cost('some-other-model', 10, 10))

    def test_model_resolves_from_env_in_order(self):
        with mock.patch.dict(os.environ, {'FILING_READ_MODEL': 'claude-opus-5', 'CLAUDE_MODEL': 'claude-sonnet-5'}):
            self.assertEqual(fr._resolve_model(), 'claude-opus-5')
        with mock.patch.dict(os.environ, {'FILING_READ_MODEL': '', 'CLAUDE_MODEL': 'claude-sonnet-5'}):
            self.assertEqual(fr._resolve_model(), 'claude-sonnet-5')
        with mock.patch.dict(os.environ, {'FILING_READ_MODEL': '', 'CLAUDE_MODEL': ' '}):
            self.assertEqual(fr._resolve_model(), fr.DEFAULT_MODEL)
        # AI_MODEL is the VaNi layer's (local Qwen on the VPS) and must never leak in
        with mock.patch.dict(os.environ, {'FILING_READ_MODEL': '', 'CLAUDE_MODEL': '', 'AI_MODEL': 'Qwen3-4B'}):
            self.assertEqual(fr._resolve_model(), fr.DEFAULT_MODEL)

    def test_triage_is_pure_and_reads_the_role_next_to_the_action(self):
        def doc(text, scanned=False):
            return fr.DocumentText(text, 1, 1, len(text), scanned)
        mgmt = {'event_type': 'MGMT_EXIT'}
        # an independent director going, signed off by the MD: routine
        self.assertIsNotNone(fr.triage(mgmt, doc(Reads.ROUTINE_MGMT)))
        # "Non-Executive Director" must not pass as "Executive Director"
        self.assertIsNotNone(fr.triage(mgmt, doc('resignation of Mr X, Non-Executive Director, from the Board')))
        # role and action in ADJACENT sentences is a signature block, not an event
        self.assertIsNotNone(fr.triage(mgmt, doc('For ABC Limited, Managing Director. The resignation '
                                                 'letter of Mr X, Independent Director, is enclosed.')))
        # an honorific full stop must not end the sentence early
        self.assertIsNone(fr.triage(mgmt, doc('the resignation of Dr. Suresh Iyer, Chief Financial Officer, was accepted')))
        # the key roles, either order
        self.assertIsNone(fr.triage(mgmt, doc(Reads.KEY_MGMT)))
        self.assertIsNone(fr.triage(mgmt, doc('Mr Y, Whole-time Director, has resigned')))
        self.assertIsNone(fr.triage(mgmt, doc('appointment of Ms Z as Managing Director and CEO')))
        self.assertIsNone(fr.triage(mgmt, doc('the promoter, Mr P, steps down as Chairman')))
        # a scanned document on a routine-by-default type is not worth the PDF route
        self.assertIsNotNone(fr.triage(mgmt, doc('', scanned=True)))
        aud = {'event_type': 'AUDITOR_CHANGE'}
        self.assertIsNotNone(fr.triage(aud, doc(Reads.AUDITOR_TERM)))
        self.assertIsNone(fr.triage(aud, doc(Reads.AUDITOR_RESIGN)))
        self.assertIsNone(fr.triage(aud, doc('the auditors have issued a qualified opinion')))
        # everything else is read as-is, scanned or not
        for et in ('LARGE_ORDER', 'ACQUISITION', 'REGULATORY_ACTION', 'INSOLVENCY', 'SAST', 'QIP', None):
            self.assertIsNone(fr.triage({'event_type': et}, doc('', scanned=True)), et)
        # gate 0's never-list is exactly the procedural four
        self.assertEqual(set(fr.NEVER_READ_TYPES), {'RECORD_DATE', 'ESOP', 'ALLOTMENT', 'AUTHORISED_CAPITAL'})
        self.assertGreaterEqual(fr.MIN_MCAP_CR, 100)

    def test_api_key_accepts_the_ai_client_pair(self):
        with mock.patch.dict(os.environ, {'ANTHROPIC_API_KEY': 'sk-ant-a', 'AI_API_KEY': 'sk-ant-b'}):
            self.assertEqual(fr._api_key(), 'sk-ant-a')
        with mock.patch.dict(os.environ, {'ANTHROPIC_API_KEY': '', 'AI_API_KEY': 'sk-ant-b'}):
            self.assertEqual(fr._api_key(), 'sk-ant-b')
        # a local-LLM key in AI_API_KEY is never mistaken for an Anthropic key
        with mock.patch.dict(os.environ, {'ANTHROPIC_API_KEY': '', 'AI_API_KEY': 'local-qwen'}):
            self.assertEqual(fr._api_key(), '')
            self.assertFalse(fr.has_api_key())


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

    def _event(self, name, diss, family='SPARK', url='http://x/a.pdf', desc='Bagging/Receiving of orders/contracts',
               event_type='LARGE_ORDER', isin='INE00H'):
        with self.conn.cursor() as c:
            c.execute("INSERT INTO km_filings_raw (source, source_ann_id, isin, disseminated_at, "
                      "content_hash, payload, doc_url, summary_text) VALUES ('NSE',%s,%s,%s,'h','{}',%s,%s) RETURNING id",
                      (name, isin, diss, url, f'{name} has informed the Exchange about {desc}'))
            rid = c.fetchone()[0]
            c.execute("INSERT INTO km_corporate_events (isin, company_name, disseminated_at, day_0_trade_date, "
                      "family, event_type, desc_raw, primary_raw_id, raw_ids) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,ARRAY[%s]) RETURNING id",
                      (isin, name, diss, diss[:10], family, event_type, desc, rid, rid))
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
    def test_a_pending_row_for_every_in_scope_material_event_and_nothing_else(self):
        self._event('spark', '2026-09-28 10:00+05:30', 'SPARK', event_type='LARGE_ORDER')
        self._event('neg', '2026-09-28 10:01+05:30', 'NEGATIVE_SPARK', event_type='REGULATORY_ACTION')
        self._event('own', '2026-09-28 10:02+05:30', 'OWNERSHIP', event_type='SAST')
        self._event('mgmt', '2026-09-28 10:03+05:30', 'SPARK', event_type='MGMT_EXIT')   # gate 1 decides, not gate 0
        self._event('gen', '2026-09-28 10:04+05:30', 'GENERAL', event_type='FUND_UTILISATION')
        self._event('unc', '2026-09-28 10:05+05:30', 'UNCLASSIFIED', event_type=None)
        self.assertEqual(fr.enqueue_pending(self.conn), 4)
        self.assertEqual(fr.enqueue_pending(self.conn), 0, 'idempotent')
        self.assertEqual(sorted(self._rows()), ['mgmt', 'neg', 'own', 'spark'])

    def test_gate0_never_queues_the_procedural_types_or_a_tiny_listing(self):
        self._event('esop', '2026-09-28 10:00+05:30', 'OWNERSHIP', event_type='ESOP')
        self._event('ncd', '2026-09-28 10:01+05:30', 'OWNERSHIP', event_type='ALLOTMENT')
        self._event('rd', '2026-09-28 10:02+05:30', 'CORPORATE_ACTION', event_type='RECORD_DATE')
        self._event('untyped', '2026-09-28 10:03+05:30', 'SPARK', event_type=None)
        with self.conn.cursor() as c:
            c.execute("INSERT INTO km_equity_symbols (symbol, isin, exchange, is_active, industry, mcap_cr) "
                      "VALUES ('TINY','INE0TINY','NSE',true,'Misc',40), ('GONE','INE0GONE','NSE',false,'Misc',900)")
        self.conn.commit()
        self._event('tiny', '2026-09-28 10:04+05:30', 'SPARK', event_type='LARGE_ORDER', isin='INE0TINY')
        self._event('gone', '2026-09-28 10:05+05:30', 'SPARK', event_type='LARGE_ORDER', isin='INE0GONE')
        self._event('nolisting', '2026-09-28 10:06+05:30', 'SPARK', event_type='LARGE_ORDER', isin='INE0NONE')
        self._event('ok', '2026-09-28 10:07+05:30', 'SPARK', event_type='LARGE_ORDER')
        self.assertEqual(fr.enqueue_pending(self.conn), 1)
        self.assertEqual(sorted(self._rows()), ['ok'])

    def test_prune_removes_only_pending_rows_the_scope_no_longer_admits(self):
        # the 229 seed queued EVERY material event; a read already paid for stays
        esop = self._event('esop', '2026-09-28 10:00+05:30', 'OWNERSHIP', event_type='ESOP')
        done = self._event('done', '2026-09-28 10:01+05:30', 'OWNERSHIP', event_type='ESOP')
        keep = self._event('keep', '2026-09-28 10:02+05:30', 'SPARK', event_type='LARGE_ORDER')
        with self.conn.cursor() as c:
            c.execute("INSERT INTO km_filing_reads (event_id) VALUES (%s), (%s), (%s)", (esop, done, keep))
            c.execute("UPDATE km_filing_reads SET status='done', impact='neutral', magnitude='minor' WHERE event_id=%s", (done,))
        self.conn.commit()
        self.assertEqual(fr.prune_pending(self.conn), 1)
        self.assertEqual(fr.prune_pending(self.conn), 0, 'idempotent')
        rows = self._rows()
        self.assertEqual(sorted(rows), ['done', 'keep'])
        self.assertEqual(rows['done']['status'], 'done')

    # ── gate 1: the text decides, before the model ───────────────────────
    ROUTINE_MGMT = ('Sub: Intimation under Regulation 30. We wish to inform that Mr. Ramesh Kumar, '
                    'Independent Director, has tendered his resignation from the Board with effect from '
                    'September 30, 2026 due to personal reasons. For ABC Limited, Managing Director. ') * 2
    KEY_MGMT = ('Sub: Change in Key Managerial Personnel. The Board has accepted the resignation of '
                'Mr. Suresh Iyer, Chief Financial Officer of the Company, with effect from the close of '
                'business hours on September 30, 2026, to pursue opportunities outside the Company. ') * 2
    AUDITOR_TERM = ('M/s Dinesh Jain & Associates have completed their term as Statutory Auditors of the '
                    'Company as permissible under the Companies Act, 2013, at the conclusion of the AGM. ') * 2
    AUDITOR_RESIGN = ('M/s XYZ & Co, Statutory Auditors, have tendered their resignation with immediate effect '
                      'citing pre-occupation, resulting in a casual vacancy in the office of auditor. ') * 2

    def test_gate1_skips_a_routine_management_change_without_a_model_call(self):
        self._event('routine', '2026-09-28 10:00+05:30', 'SPARK', event_type='MGMT_EXIT')
        fr.enqueue_pending(self.conn)
        client = _Client()
        stats = fr.read_pending(self.conn, session=_Session({'http://x/a.pdf': _pdf([self.ROUTINE_MGMT])}), client=client)
        self.assertEqual((stats['read'], stats['triaged'], stats['done']), (1, 1, 0))
        self.assertEqual(client.messages.calls, [], 'the model was never called')
        r = self._rows()['routine']
        self.assertEqual(r['status'], 'skipped')
        self.assertIsNone(r['impact'])
        with self.conn.cursor() as c:
            c.execute("SELECT triage_reason FROM km_filing_reads")
            self.assertIn('no key person', c.fetchone()[0])
        self.assertEqual(self._raw('routine')[1], 'ok', 'the free extraction is still stored')
        self.assertEqual(fr.status_counts(self.conn)['skipped'], 1)

    def test_gate1_reads_a_key_person_change_and_an_auditor_resignation(self):
        self._event('cfo', '2026-09-28 10:00+05:30', 'SPARK', event_type='MGMT_EXIT', url='http://x/cfo.pdf')
        self._event('aud', '2026-09-28 10:01+05:30', 'NEGATIVE_SPARK', event_type='AUDITOR_CHANGE', url='http://x/aud.pdf')
        self._event('term', '2026-09-28 10:02+05:30', 'NEGATIVE_SPARK', event_type='AUDITOR_CHANGE', url='http://x/term.pdf')
        fr.enqueue_pending(self.conn)
        client = _Client()
        stats = fr.read_pending(self.conn, client=client, session=_Session({
            'http://x/cfo.pdf': _pdf([self.KEY_MGMT]),
            'http://x/aud.pdf': _pdf([self.AUDITOR_RESIGN]),
            'http://x/term.pdf': _pdf([self.AUDITOR_TERM]),
        }))
        self.assertEqual((stats['read'], stats['done'], stats['triaged']), (3, 2, 1))
        rows = self._rows()
        self.assertEqual((rows['cfo']['status'], rows['aud']['status'], rows['term']['status']),
                         ('done', 'done', 'skipped'))
        self.assertEqual(len(client.messages.calls), 2)

    def test_a_missing_migration_stops_the_pass_before_any_row_is_claimed(self):
        # the 2026-09-28 shape: backend deployed, migration 230 not yet applied
        self._event('routine', '2026-09-28 10:00+05:30', 'SPARK', event_type='MGMT_EXIT')
        fr.enqueue_pending(self.conn)
        with self.conn.cursor() as c:
            c.execute('ALTER TABLE km_filing_reads DROP COLUMN triage_reason')
        self.conn.commit()
        try:
            client = _Client()
            stats = fr.read_pending(self.conn, session=_Session({'http://x/a.pdf': _pdf([self.ROUTINE_MGMT])}), client=client)
            self.assertIn('migration 230', stats['skipped'])
            self.assertEqual(stats['read'], 0)
            self.assertEqual(client.messages.calls, [])
            r = self._rows()['routine']
            self.assertEqual((r['status'], r['attempts']), ('pending', 0), 'nothing was claimed')
        finally:
            with self.conn.cursor() as c:
                c.execute('ALTER TABLE km_filing_reads ADD COLUMN triage_reason TEXT')
            self.conn.commit()

    def test_a_reader_crash_fails_that_row_and_the_pass_goes_on(self):
        self._event('boom', '2026-09-28 10:00+05:30', url='http://x/boom.pdf')
        self._event('fine', '2026-09-28 09:00+05:30', url='http://x/fine.pdf')
        fr.enqueue_pending(self.conn)
        real = fr.build_messages

        def explode(row, doc, pdf):
            if row.get('company_name') == 'boom':
                raise RuntimeError('unexpected shape')
            return real(row, doc, pdf)
        with mock.patch.object(fr, 'build_messages', side_effect=explode):
            stats = fr.read_pending(self.conn, client=_Client(), session=_Session({
                'http://x/boom.pdf': _pdf([ORDER_TEXT]), 'http://x/fine.pdf': _pdf([ORDER_TEXT])}))
        rows = self._rows()
        self.assertEqual((stats['read'], stats['done'], stats['failed']), (2, 1, 1))
        self.assertEqual(rows['boom']['status'], 'failed')
        self.assertIn('unexpected shape', rows['boom']['error'])
        self.assertEqual(rows['fine']['status'], 'done')

    def test_gate1_never_gates_an_order_or_an_acquisition(self):
        self._event('order', '2026-09-28 10:00+05:30', 'SPARK', event_type='LARGE_ORDER')
        fr.enqueue_pending(self.conn)
        client = _Client()
        fr.read_pending(self.conn, session=_Session({'http://x/a.pdf': _pdf([ORDER_TEXT])}), client=client)
        self.assertEqual(self._rows()['order']['status'], 'done')
        self.assertEqual(len(client.messages.calls), 1)
        self.assertEqual(fr.status_counts(self.conn),
                         {'pending': 0, 'reading': 0, 'done': 1, 'failed': 0, 'unreadable': 0, 'skipped': 0})

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
        p_in, p_out = fr.PRICES[fr.MODEL]          # priced at the model that ran, not a remembered rate
        self.assertAlmostEqual(float(r['cost']), 1200 * p_in / 1e6 + 180 * p_out / 1e6, places=5)
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
        with mock.patch.dict(os.environ, {'ANTHROPIC_API_KEY': '', 'AI_API_KEY': ''}):
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
        # the first document alone overspends the budget — whatever the model's price
        one = fr._cost(fr.MODEL, 1200, 180)
        stats = fr.read_pending(self.conn, session=_Session({'http://x/a.pdf': _pdf([ORDER_TEXT])}),
                                client=_Client(), budget_usd=one * 0.5)
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
