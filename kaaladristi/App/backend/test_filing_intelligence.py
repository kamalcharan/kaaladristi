"""
Filing intelligence — the results rule, the link semantics and post-result drift
===============================================================================
    python3 -m unittest test_filing_intelligence

The classifier tests need nothing: no DB, no network, no model, same as the
rest of the suites in this directory.

The SQL tests need a throwaway PostgreSQL and SKIP without one. They are not
optional decoration — the three properties they pin (NULL vs FALSE, the shrunk
window, nearest-meeting wins) are invisible in any type signature and each one
reads like a redundancy to anyone tidying the query later:

    createdb kd_test
    KD_TEST_DSN=postgresql:///kd_test python3 -m unittest test_filing_intelligence

⚠ THE TEST DATABASE IS TRUNCATED, so KD_TEST_DSN must never point at anything
real. It refuses any DSN whose database name does not contain 'test'.
"""

import os
import unittest
from datetime import date

from lib.filing_taxonomy import classify_board_meeting
from scripts.ingest_nse_board_meetings import (
    MATCH_BACK_DAYS, MATCH_FWD_DAYS, link_result_announcements, upsert_meetings)

DSN = os.environ.get('KD_TEST_DSN')
MIGRATIONS = ('km_migration_212_filings_ingest.sql',
              'km_migration_214_board_meetings.sql',
              'km_migration_215_result_drift.sql')
DB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                      '..', 'DBscripts')


class ResultsRule(unittest.TestCase):
    """bm_purpose / bm_desc -> is this a results meeting."""

    def test_purpose_names_results(self):
        self.assertEqual(classify_board_meeting('Financial Results', None),
                         (True, 'purpose'))

    def test_purpose_is_slash_joined_not_an_exact_value(self):
        # Measured: 'Financial Results/Other business matters' (8),
        # 'Financial Results/Fund Raising' (4). An exact-value map misses both.
        for p in ('Financial Results/Other business matters',
                  'Financial Results/Fund Raising'):
            self.assertEqual(classify_board_meeting(p, None), (True, 'purpose'), p)

    def test_generic_purpose_falls_through_to_the_free_text(self):
        # 262 of 481 meetings carry the generic purpose, so this branch is most
        # of the coverage rather than an edge case.
        ok, basis = classify_board_meeting(
            'Board Meeting Intimation',
            'CMI LIMITED has informed the Exchange about Board Meeting to be '
            'held on 16-Sep-2026 to inter-alia consider and approve the '
            'Audited Financial results of the Company for the Yearly ended '
            'March 2026 .')
        self.assertTrue(ok)
        self.assertEqual(basis, 'desc')

    def test_financial_statements_is_not_a_result(self):
        # An AGM notice adopting audited financial STATEMENTS is common, and
        # admitting it would inflate the population every drift number is
        # measured over.
        self.assertEqual(
            classify_board_meeting(
                'Other business matters',
                'to consider the Notice of the AGM including adoption of the '
                'Audited Financial Statements for the year'),
            (False, None))

    def test_non_results_purposes(self):
        for p in ('Fund Raising', 'Dividend', 'Buyback',
                  'Other business matters'):
            self.assertEqual(classify_board_meeting(p, 'routine business'),
                             (False, None), p)

    def test_nothing_at_all(self):
        self.assertEqual(classify_board_meeting(None, None), (False, None))

    def test_basis_is_none_when_not_results(self):
        # results_basis exists to measure the purpose/desc split AMONG results.
        # A basis on a False row would corrupt that count.
        ok, basis = classify_board_meeting('Dividend', None)
        self.assertFalse(ok)
        self.assertIsNone(basis)


def _bm(sym, isin, mdate, ts, purpose, desc):
    return {'bm_symbol': sym, 'sm_isin': isin, 'sm_name': f'{sym} Ltd',
            'bm_date': mdate, 'bm_timestamp': ts, 'bm_purpose': purpose,
            'bm_desc': desc, 'attachment': None, 'ixbrl': None}


@unittest.skipUnless(DSN, 'set KD_TEST_DSN to a throwaway database')
class LinkSemantics(unittest.TestCase):
    """What is written on km_corporate_events, and — more importantly — what is
    deliberately NOT written."""

    @classmethod
    def setUpClass(cls):
        import psycopg2
        if 'test' not in DSN.rsplit('/', 1)[-1]:
            raise unittest.SkipTest("KD_TEST_DSN's database name must contain "
                                    "'test' — this class TRUNCATES it")
        cls.conn = psycopg2.connect(DSN)
        with cls.conn.cursor() as c:
            c.execute("""
                DO $$ BEGIN
                  CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object
                  THEN NULL; END $$;
                DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object
                  THEN NULL; END $$;
                DO $$ BEGIN CREATE ROLE kd_app; EXCEPTION WHEN duplicate_object
                  THEN NULL; END $$;
                DO $$ BEGIN CREATE ROLE kd_readonly; EXCEPTION WHEN
                  duplicate_object THEN NULL; END $$;
                CREATE TABLE IF NOT EXISTS km_equity_eod
                  (equity_id int, trade_date date, close numeric,
                   prev_close numeric);
                CREATE TABLE IF NOT EXISTS km_equity_symbols
                  (id serial primary key, symbol text, isin text,
                   exchange text, is_active bool);
            """)
            # Running the real migration files is itself the point: a schema
            # the tests invent cannot catch a migration that does not apply.
            for name in MIGRATIONS:
                with open(os.path.join(DB_DIR, name)) as fh:
                    c.execute(fh.read())
        cls.conn.commit()

    @classmethod
    def tearDownClass(cls):
        cls.conn.close()

    def setUp(self):
        with self.conn.cursor() as c:
            c.execute('TRUNCATE km_corporate_events, km_filings_raw, '
                      'km_board_meetings, km_equity_symbols, km_equity_eod '
                      'RESTART IDENTITY CASCADE')
        self.conn.commit()

    def _event(self, isin, name, diss, desc='Outcome of Board Meeting'):
        with self.conn.cursor() as c:
            c.execute("INSERT INTO km_filings_raw (source, source_ann_id, isin,"
                      " disseminated_at, content_hash, payload) VALUES "
                      "('NSE', %s, %s, %s, 'h', '{}') RETURNING id",
                      (name + diss, isin, diss))
            rid = c.fetchone()[0]
            c.execute("INSERT INTO km_corporate_events (isin, company_name, "
                      "disseminated_at, day_0_trade_date, family, desc_raw, "
                      "primary_raw_id, raw_ids) VALUES (%s,%s,%s,%s,"
                      "'UNCLASSIFIED',%s,%s,ARRAY[%s])",
                      (isin, name, diss, diss[:10], desc, rid, rid))
        self.conn.commit()

    def _verdicts(self):
        with self.conn.cursor() as c:
            c.execute('SELECT company_name, is_result_announcement, '
                      'board_meeting_id FROM km_corporate_events ORDER BY id')
            return {r[0]: (r[1], r[2]) for r in c.fetchall()}

    # ── the reason this table exists ──────────────────────────────────────
    def test_results_meeting_marks_its_outcome(self):
        upsert_meetings(self.conn, [_bm('AAA', 'INE00A', '10-Sep-2026',
                                        '01-Sep-2026 10:00:00',
                                        'Financial Results', 'Q results')])
        self.conn.commit()
        self._event('INE00A', 'AAA', '2026-09-10 10:00:00')
        link_result_announcements(self.conn, date(2026, 9, 1), date(2026, 9, 20))
        self.conn.commit()
        verdict, bm_id = self._verdicts()['AAA']
        self.assertTrue(verdict)
        self.assertIsNotNone(bm_id)

    def test_a_non_results_meeting_is_a_measured_false(self):
        upsert_meetings(self.conn, [_bm('HHH', 'INE00H', '12-Sep-2026',
                                        '01-Sep-2026 10:00:00', 'Fund Raising',
                                        'HHH to consider raising of funds')])
        self.conn.commit()
        self._event('INE00H', 'HHH', '2026-09-12 10:00:00')
        link_result_announcements(self.conn, date(2026, 9, 1), date(2026, 9, 20))
        self.conn.commit()
        self.assertEqual(self._verdicts()['HHH'], (False, None))

    # ── the three properties that look like redundancies ──────────────────
    def test_no_intimation_at_all_stays_NULL_not_FALSE(self):
        """A coverage hole must never read as 'this was not a result'.

        SEBI LODR requires prior intimation for results, so an outcome with no
        intimation on record is far more likely a gap in OUR fetch. FALSE would
        never correct itself — the row stops being NULL and leaves the queue.
        """
        upsert_meetings(self.conn, [_bm('AAA', 'INE00A', '10-Sep-2026',
                                        '01-Sep-2026 10:00:00',
                                        'Financial Results', 'Q results')])
        self.conn.commit()
        self._event('INE00Z', 'ZZZ', '2026-09-11 10:00:00')
        stats = link_result_announcements(self.conn, date(2026, 9, 1),
                                          date(2026, 9, 20))
        self.conn.commit()
        self.assertIsNone(self._verdicts()['ZZZ'][0])
        self.assertEqual(stats['no_meeting'], 1)

    def test_events_at_the_coverage_edge_are_not_judged(self):
        """[cov_start, cov_end] shrinks by the match tolerance before anything
        is judged, because an event at cov_start needs meetings we never
        fetched."""
        upsert_meetings(self.conn, [_bm('EEE', 'INE00E', '01-Sep-2026',
                                        '20-Aug-2026 09:00:00',
                                        'Financial Results', 'EEE results')])
        self.conn.commit()
        self._event('INE00E', 'EEE', '2026-09-01 10:00:00')
        stats = link_result_announcements(self.conn, date(2026, 9, 1),
                                          date(2026, 9, 15))
        self.conn.commit()
        self.assertEqual(stats['window'],
                         (date(2026, 9, 1) + __import__('datetime').timedelta(
                              days=MATCH_BACK_DAYS),
                          date(2026, 9, 15) - __import__('datetime').timedelta(
                              days=MATCH_FWD_DAYS)))
        self.assertIsNone(self._verdicts()['EEE'][0])

    def test_coverage_narrower_than_the_tolerance_judges_nothing(self):
        stats = link_result_announcements(self.conn, date(2026, 9, 20),
                                          date(2026, 9, 22))
        self.assertIsNone(stats['window'])
        self.assertEqual(stats['evaluated'], 0)

    def test_nearest_meeting_wins(self):
        """Two quarters inside one tolerance window: the outcome must attach to
        the meeting it came from, not merely to one that qualifies."""
        upsert_meetings(self.conn, [
            _bm('III', 'INE00I', '08-Sep-2026', '20-Aug-2026 10:00:00',
                'Financial Results', 'Q1'),
            _bm('III', 'INE00I', '11-Sep-2026', '01-Sep-2026 10:00:00',
                'Financial Results', 'Q2')])
        self.conn.commit()
        self._event('INE00I', 'III', '2026-09-11 10:00:00')
        link_result_announcements(self.conn, date(2026, 9, 1), date(2026, 9, 20))
        self.conn.commit()
        with self.conn.cursor() as c:
            c.execute('SELECT b.desc_raw FROM km_corporate_events e JOIN '
                      'km_board_meetings b ON b.id = e.board_meeting_id')
            self.assertEqual(c.fetchone()[0], 'Q2')

    def test_only_board_meeting_outcomes_are_touched(self):
        upsert_meetings(self.conn, [_bm('AAA', 'INE00A', '10-Sep-2026',
                                        '01-Sep-2026 10:00:00',
                                        'Financial Results', 'Q results')])
        self.conn.commit()
        self._event('INE00A', 'AAA', '2026-09-10 10:00:00', 'General Updates')
        link_result_announcements(self.conn, date(2026, 9, 1), date(2026, 9, 20))
        self.conn.commit()
        self.assertEqual(self._verdicts()['AAA'], (None, None))

    # ── ingest hygiene ────────────────────────────────────────────────────
    def test_refetch_is_a_no_op_and_an_edit_is_a_revision(self):
        row = _bm('AAA', 'INE00A', '10-Sep-2026', '01-Sep-2026 10:00:00',
                  'Fund Raising', 'AAA to raise funds')
        self.assertEqual(upsert_meetings(self.conn, [row])[:2], (1, 0))
        self.conn.commit()
        self.assertEqual(upsert_meetings(self.conn, [row])[:2], (0, 0))
        self.conn.commit()
        row['bm_desc'] = 'AAA to raise funds and approve Financial results'
        self.assertEqual(upsert_meetings(self.conn, [row])[:2], (0, 1))
        self.conn.commit()
        with self.conn.cursor() as c:
            c.execute('SELECT is_results, results_basis FROM km_board_meetings')
            self.assertEqual(c.fetchone(), (True, 'desc'))

    def test_unkeyable_rows_are_counted_not_dropped(self):
        """symbol / meeting_date / intimated_at are all natural-key columns, and
        a NULL in a UNIQUE column does not dedup — so such a row would be
        re-inserted on every single fetch."""
        _, _, skipped = upsert_meetings(self.conn, [
            _bm(None, 'INE00F', '14-Sep-2026', '05-Sep-2026 09:00:00',
                'Financial Results', 'no symbol'),
            _bm('JJJ', 'INE00J', None, '05-Sep-2026 09:00:00',
                'Financial Results', 'no meeting date'),
            _bm('KKK', 'INE00K', '14-Sep-2026', None,
                'Financial Results', 'no intimation time')])
        self.conn.commit()
        self.assertEqual(skipped, 3)
        with self.conn.cursor() as c:
            c.execute('SELECT count(*) FROM km_board_meetings')
            self.assertEqual(c.fetchone()[0], 0)

    def test_missing_isin_resolves_from_the_symbol_master(self):
        with self.conn.cursor() as c:
            c.execute("INSERT INTO km_equity_symbols (symbol, isin, exchange, "
                      "is_active) VALUES ('GGG','INE00G','NSE',true)")
        self.conn.commit()
        upsert_meetings(self.conn, [_bm('GGG', None, '15-Sep-2026',
                                        '06-Sep-2026 09:00:00',
                                        'Financial Results', 'GGG results')])
        self.conn.commit()
        with self.conn.cursor() as c:
            c.execute('SELECT isin FROM km_board_meetings')
            self.assertEqual(c.fetchone()[0], 'INE00G')


@unittest.skipUnless(DSN, 'set KD_TEST_DSN to a throwaway database')
class ResultDrift(unittest.TestCase):
    """kd_result_returns / v_result_drift (migration 215).

    Everything here is derived — no table, no nightly job — so the only thing
    standing between a wrong number and a published PEAD figure is this file.
    """

    setUpClass = LinkSemantics.__dict__['setUpClass']
    tearDownClass = LinkSemantics.__dict__['tearDownClass']
    setUp = LinkSemantics.__dict__['setUp']

    def _stock(self, eid, symbol, isin, bars):
        with self.conn.cursor() as c:
            c.execute("INSERT INTO km_equity_symbols (id, symbol, isin, "
                      "exchange, is_active) VALUES (%s,%s,%s,'NSE',true)",
                      (eid, symbol, isin))
            for d, close in bars:
                c.execute('INSERT INTO km_equity_eod (equity_id, trade_date, '
                          'close) VALUES (%s,%s,%s)', (eid, d, close))
        self.conn.commit()

    def _result(self, isin, name, day0, verdict=True):
        with self.conn.cursor() as c:
            c.execute("INSERT INTO km_filings_raw (source, source_ann_id, isin,"
                      " disseminated_at, content_hash, payload) VALUES "
                      "('NSE',%s,%s,%s,'h','{}') RETURNING id",
                      (name + str(day0), isin, f'{day0} 10:00'))
            rid = c.fetchone()[0]
            c.execute("INSERT INTO km_corporate_events (isin, company_name, "
                      "disseminated_at, day_0_trade_date, family, desc_raw, "
                      "primary_raw_id, raw_ids, is_result_announcement) VALUES "
                      "(%s,%s,%s,%s,'UNCLASSIFIED','Outcome of Board Meeting',"
                      "%s,ARRAY[%s],%s)",
                      (isin, name, f'{day0} 10:00', day0, rid, rid, verdict))
        self.conn.commit()

    def _rows(self, *args, view=False):
        sql = ('SELECT symbol, base_trade_date, base_close, day_0_close, '
               'end_trade_date, end_close, sessions_elapsed, reaction_pct, '
               'drift_pct, suspect_corporate_action FROM ')
        with self.conn.cursor() as c:
            if view:
                c.execute(sql + 'v_result_drift ORDER BY symbol')
            else:
                c.execute(sql + 'kd_result_returns(%s,%s,%s) ORDER BY symbol',
                          args if args else (None, None, None))
            cols = ('symbol', 'base_date', 'base_close', 'd0_close', 'end_date',
                    'end_close', 'sessions', 'reaction', 'drift', 'suspect')
            return {r[0]: dict(zip(cols, r)) for r in c.fetchall()}

    def _clean_stock(self):
        # Day -1 = 09-07 @100, Day 0 = 09-08 @110, latest 09-11 @121
        self._stock(1, 'AAA', 'INE00A',
                    [('2026-09-04', 98), ('2026-09-07', 100),
                     ('2026-09-08', 110), ('2026-09-09', 112),
                     ('2026-09-10', 115), ('2026-09-11', 121)])
        self._result('INE00A', 'AAA', '2026-09-08')

    # ── the property the whole metric turns on ────────────────────────────
    def test_reaction_and_drift_have_different_bases(self):
        """reaction is Day -1 -> Day 0; drift is Day 0 -> end.

        Measuring drift from Day -1 folds the announcement jump into it and is
        how a PEAD study reports an effect it never measured. The fixture is
        built so a merged version cannot coincidentally pass: +10% jump then
        +10% drift would read +33.1% off the wrong base.
        """
        self._clean_stock()
        r = self._rows()['AAA']
        self.assertEqual(float(r['reaction']), 10.00)   # 100 -> 110
        self.assertEqual(float(r['drift']), 10.00)      # 110 -> 121
        self.assertEqual(float(r['base_close']), 100)
        self.assertEqual(float(r['d0_close']), 110)

    def test_drift_is_never_measured_from_the_pre_announcement_close(self):
        self._clean_stock()
        r = self._rows()['AAA']
        self.assertNotAlmostEqual(float(r['drift']), 21.00, places=1)

    # ── unadjusted closes ─────────────────────────────────────────────────
    def test_a_split_inside_the_span_is_flagged(self):
        """km_corporate_actions is EMPTY, so a 1:2 split reads as a genuine
        -50% drift. Results season is exactly when boards declare bonuses."""
        self._stock(2, 'BBB', 'INE00B',
                    [('2026-09-07', 200), ('2026-09-08', 210),
                     ('2026-09-09', 220), ('2026-09-10', 105)])
        self._result('INE00B', 'BBB', '2026-09-08')
        r = self._rows()['BBB']
        self.assertTrue(r['suspect'])
        self.assertEqual(float(r['drift']), -50.00)

    def test_an_ordinary_large_move_is_not_flagged(self):
        """The gate is 0.55x / 1.80x — impossible under NSE's +/-20% bands. A
        real 19% fall must stay usable, or the flag eats the population it was
        meant to protect."""
        self._stock(3, 'CCC', 'INE00C',
                    [('2026-09-07', 100), ('2026-09-08', 100),
                     ('2026-09-09', 81)])
        self._result('INE00C', 'CCC', '2026-09-08')
        self.assertFalse(self._rows()['CCC']['suspect'])

    # ── bar selection ─────────────────────────────────────────────────────
    def test_day_minus_one_is_the_stocks_own_last_traded_bar(self):
        """A stock suspended into its result must compare against the last
        price that actually existed, not a market-calendar date it did not
        trade on."""
        self._stock(4, 'DDD', 'INE00D',
                    [('2026-08-28', 50), ('2026-09-08', 60),
                     ('2026-09-09', 63)])
        self._result('INE00D', 'DDD', '2026-09-08')
        r = self._rows()['DDD']
        self.assertEqual(str(r['base_date']), '2026-08-28')
        self.assertEqual(float(r['reaction']), 20.00)

    def test_a_horizon_the_stock_has_not_lived_returns_NULL(self):
        """Not a shorter window silently labelled N. A 22-session drift column
        quietly holding 3-session numbers is unfalsifiable once it is in a
        study."""
        self._clean_stock()
        r = self._rows(None, None, 22)['AAA']
        self.assertIsNone(r['end_date'])
        self.assertIsNone(r['sessions'])
        self.assertIsNone(r['drift'])

    def test_a_horizon_picks_that_exact_session(self):
        self._clean_stock()
        r = self._rows(None, None, 2)['AAA']
        self.assertEqual(str(r['end_date']), '2026-09-10')   # n=0,1,2
        self.assertEqual(r['sessions'], 2)
        self.assertEqual(float(r['drift']), 4.55)            # 110 -> 115

    # ── which events count ────────────────────────────────────────────────
    def test_unjudged_and_non_result_events_are_both_excluded(self):
        """NULL is excluded because it is unknown, FALSE because it is not a
        result. Admitting NULL would put every un-linked board-meeting outcome
        into a results population."""
        self._stock(5, 'EEE', 'INE00E',
                    [('2026-09-07', 10), ('2026-09-08', 11)])
        self._stock(6, 'FFF', 'INE00F',
                    [('2026-09-07', 10), ('2026-09-08', 11)])
        self._result('INE00E', 'EEE', '2026-09-08', verdict=None)
        self._result('INE00F', 'FFF', '2026-09-08', verdict=False)
        self.assertEqual(self._rows(), {})

    def test_the_view_is_capped_but_the_function_is_not(self):
        """A read path must not be able to walk every bar since every result
        ever recorded. History stays reachable through the function, which is
        a research call rather than a render."""
        self._stock(7, 'GGG', 'INE00G',
                    [('2026-01-05', 10), ('2026-01-06', 11),
                     ('2026-09-11', 20)])
        self._result('INE00G', 'GGG', '2026-01-06')
        self.assertIn('GGG', self._rows())              # function sees it
        self.assertNotIn('GGG', self._rows(view=True))  # view does not


if __name__ == '__main__':
    unittest.main()
