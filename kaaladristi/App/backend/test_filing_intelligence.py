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
    MATCH_BACK_DAYS, MATCH_FWD_DAYS, link_result_announcements,
    relink_result_announcements, upsert_meetings, _material_diff)

DSN = os.environ.get('KD_TEST_DSN')
MIGRATIONS = ('km_migration_212_filings_ingest.sql',
              'km_migration_214_board_meetings.sql',
              'km_migration_215_result_drift.sql',
              'km_migration_216_result_drift_dedup.sql')
DB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                      '..', 'DBscripts')
# Applied once per process. Two test classes share the fixture, and 215/216
# are a DROP/CREATE pair — re-running 215 cannot widen 216's return type,
# so a per-class apply fails on whichever class runs second.
_SCHEMA_READY = False


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
            global _SCHEMA_READY
            if not _SCHEMA_READY:
                # The test database survives between runs, so 215's
                # CREATE OR REPLACE would meet 216's WIDER return type from the
                # last run and refuse ("Row type defined by OUT parameters is
                # different"). Dropping the pair first makes re-applying the
                # real files reproducible. Nothing here holds data.
                c.execute('DROP VIEW IF EXISTS v_result_drift; '
                          'DROP FUNCTION IF EXISTS '
                          'kd_result_returns(DATE, DATE, INTEGER);')
                for name in MIGRATIONS:
                    with open(os.path.join(DB_DIR, name)) as fh:
                        c.execute(fh.read())
                _SCHEMA_READY = True
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
        # A single day of meeting coverage cannot judge anything while either
        # tolerance is non-zero. Expressed as a zero-width span rather than a
        # literal range, so tightening MATCH_BACK_DAYS does not turn this test
        # into a passing statement about a different situation.
        stats = link_result_announcements(self.conn, date(2026, 9, 20),
                                          date(2026, 9, 20))
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

    # ── the match tolerance, as measured ──────────────────────────────────
    def test_an_outcome_filed_the_next_day_still_matches(self):
        """A board meeting that ran into the next day. 14 of 2,733 on the
        first live backfill."""
        upsert_meetings(self.conn, [_bm('AAA', 'INE00A', '10-Sep-2026',
                                        '01-Sep-2026 10:00:00',
                                        'Financial Results', 'Q results')])
        self.conn.commit()
        self._event('INE00A', 'AAA', '2026-09-11 10:00:00')
        link_result_announcements(self.conn, date(2026, 9, 1), date(2026, 9, 20))
        self.conn.commit()
        self.assertTrue(self._verdicts()['AAA'][0])

    def test_an_outcome_two_days_later_is_not_matched(self):
        """SEBI LODR Reg 30 requires the outcome within 30 MINUTES of the
        meeting concluding, and 98.7% of them are filed on the meeting date
        itself. So +2 is a proximity mismatch, not a late filing — the original
        +4 tolerance was an unmeasured guess and admitted 16 of these."""
        upsert_meetings(self.conn, [_bm('AAA', 'INE00A', '10-Sep-2026',
                                        '01-Sep-2026 10:00:00',
                                        'Financial Results', 'Q results')])
        self.conn.commit()
        self._event('INE00A', 'AAA', '2026-09-12 10:00:00')
        link_result_announcements(self.conn, date(2026, 9, 1), date(2026, 9, 20))
        self.conn.commit()
        # NULL, not FALSE, and that asymmetry is deliberate. The coverage check
        # uses the SAME window as the match, so a meeting outside it is not
        # evidence of anything: we did not measure this announcement, we merely
        # failed to place it. FALSE would assert it is not a result, which is
        # the one verdict that never corrects itself.
        self.assertEqual(self._verdicts()['AAA'], (None, None))

    def test_a_meeting_dated_after_its_own_outcome_still_matches(self):
        """The -1 bucket, 5 events on the first backfill: a board that met and
        filed early against the date it had intimated. MATCH_FWD_DAYS exists
        for exactly this and nothing else tests it."""
        upsert_meetings(self.conn, [_bm('AAA', 'INE00A', '11-Sep-2026',
                                        '01-Sep-2026 10:00:00',
                                        'Financial Results', 'Q results')])
        self.conn.commit()
        self._event('INE00A', 'AAA', '2026-09-10 10:00:00')
        link_result_announcements(self.conn, date(2026, 9, 1), date(2026, 9, 20))
        self.conn.commit()
        self.assertTrue(self._verdicts()['AAA'][0])

    # ── re-judging history after a tolerance change ───────────────────────
    def _relink_fixture(self):
        upsert_meetings(self.conn, [
            # span-setters: no events, they only widen stored coverage
            _bm('SPAN1', 'INE0S1', '01-Sep-2026', '20-Aug-2026 10:00:00',
                'Financial Results', 'x'),
            _bm('SPAN2', 'INE0S2', '25-Sep-2026', '20-Aug-2026 10:00:00',
                'Financial Results', 'x'),
            _bm('AAA', 'INE00A', '10-Sep-2026', '01-Sep-2026 10:00:00',
                'Financial Results', 'Q results'),
            _bm('BBB', 'INE00B', '20-Sep-2026', '10-Sep-2026 10:00:00',
                'Financial Results', 'Q results')])
        self.conn.commit()
        self._event('INE00A', 'AAA', '2026-09-10 10:00:00')
        self._event('INE00B', 'BBB', '2026-09-20 10:00:00')
        # No meeting of any kind -> stays NULL. It sits INSIDE the relink
        # window, so it is what makes the cleared count discriminating.
        self._event('INE00Z', 'ZZZ', '2026-09-12 10:00:00')
        link_result_announcements(self.conn, date(2026, 9, 1), date(2026, 9, 25))
        self.conn.commit()
        self.assertTrue(self._verdicts()['AAA'][0])
        self.assertTrue(self._verdicts()['BBB'][0])
        self.assertIsNone(self._verdicts()['ZZZ'][0])

    def test_relink_rejudges_inside_its_window(self):
        self._relink_fixture()
        stats = relink_result_announcements(self.conn, date(2026, 9, 1),
                                            date(2026, 9, 20))
        self.conn.commit()
        # EXACTLY one: AAA, the only judged event inside [09-02, 09-19]. ZZZ is
        # in there too but was never judged, so clearing it would be a no-op
        # that still inflates the number an operator reads.
        self.assertEqual(stats['cleared'], 1)
        self.assertTrue(self._verdicts()['AAA'][0])

    def test_relink_never_demotes_a_verdict_it_will_not_rejudge(self):
        """Clearing [start, end] and then linking would NULL every event in the
        shrunk edges — losing verdicts a wider earlier run had made correctly.
        BBB sits at 2026-09-20, inside the cleared range but outside the
        [09-02, 09-19] this relink can actually judge.
        """
        self._relink_fixture()
        relink_result_announcements(self.conn, date(2026, 9, 1),
                                    date(2026, 9, 20))
        self.conn.commit()
        self.assertTrue(self._verdicts()['BBB'][0],
                        'BBB lost its verdict to a clear that did not re-judge it')

    def test_relink_survives_a_rollback(self):
        """THE SHAPE THAT CATCHES A MISSING COMMIT, and the only one that can.

        Every other test here calls the function and then commits ITSELF, so it
        passes whether or not the code committed — the test supplies what the
        caller forgot. On 2026-09-18 that blind spot shipped: relink committed
        its CLEAR and left the re-judgement to a caller that did not exist in
        the --relink path, so a live run turned 2,717 verdicts into 2. The
        destructive half was durable and the restoring half was not.

        Writing, rolling back, and then reading is what proves the write landed.
        """
        self._relink_fixture()
        relink_result_announcements(self.conn, date(2026, 9, 1),
                                    date(2026, 9, 20))
        self.conn.rollback()        # NOT commit — the caller does nothing
        self.assertTrue(self._verdicts()['AAA'][0],
                        'the re-judgement was rolled back: relink committed its '
                        'clear but not its restore')

    def test_relink_persists_a_CHANGED_verdict(self):
        """Proves the work is DURABLE, not merely computed.

        The two tests above cannot see a relink that commits NOTHING: the
        rollback undoes both halves and the verdicts read unchanged, which is
        what they assert. But that shape is its own failure — --relink prints a
        full report (2,717 results / 95 not / 205 no coverage) about a
        re-judgement the database never saw, because those counts are read
        inside the same transaction and look right either way.

        So make the relink CHANGE something, then roll back and demand the new
        answer. This catches both shapes at once: no commit leaves TRUE, a
        clear-only commit leaves NULL, and only a correct relink leaves FALSE.
        """
        self._relink_fixture()                       # AAA judged TRUE
        with self.conn.cursor() as c:
            # its meeting stops being a results meeting, so the only correct
            # verdict after re-judging is FALSE (the meeting still EXISTS, so
            # this is a measurement, not a coverage hole)
            c.execute("UPDATE km_board_meetings SET is_results = false, "
                      "results_basis = NULL WHERE symbol = 'AAA'")
        self.conn.commit()

        relink_result_announcements(self.conn, date(2026, 9, 1),
                                    date(2026, 9, 20))
        self.conn.rollback()
        self.assertIs(self._verdicts()['AAA'][0], False)

    def test_a_relink_never_leaves_the_population_cleared(self):
        """Clear and re-judge are ONE transaction. Any shape where the clear is
        durable and the restore is not wipes the result population with nothing
        to put back — and the re-judge cannot be replayed, because the linker
        only touches rows that are still NULL... which by then is all of them.
        """
        self._relink_fixture()
        before = sum(1 for v in self._verdicts().values() if v[0] is True)
        relink_result_announcements(self.conn, date(2026, 9, 1),
                                    date(2026, 9, 20))
        self.conn.rollback()
        after = sum(1 for v in self._verdicts().values() if v[0] is True)
        self.assertEqual(after, before)

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

    def test_a_revision_names_the_field_that_moved(self):
        """--explain-revisions. `payload` is overwritten in place, so the prior
        value exists only DURING the upsert — the diagnostic has to run inside
        the fetch, it cannot be asked afterwards. The upsert returns it through
        a CTE, which shares the statement's snapshot and so sees the row before
        the UPDATE lands.
        """
        row = _bm('AAA', 'INE00A', '10-Sep-2026', '01-Sep-2026 10:00:00',
                  'Fund Raising', 'AAA to raise funds')
        upsert_meetings(self.conn, [row])
        self.conn.commit()

        row['bm_desc'] = 'AAA to raise funds and approve Financial results'
        with self.assertLogs('scripts.ingest_nse_board_meetings',
                             level='INFO') as cm:
            upsert_meetings(self.conn, [row], explain=True)
        self.conn.commit()
        joined = '\n'.join(cm.output)
        self.assertIn('bm_desc', joined)
        self.assertIn('AAA to raise funds', joined)      # the WAS value
        # only the field that moved, not every hashed key
        self.assertNotIn('bm_purpose', joined)

    def test_explain_is_silent_when_nothing_is_revised(self):
        row = _bm('AAA', 'INE00A', '10-Sep-2026', '01-Sep-2026 10:00:00',
                  'Fund Raising', 'AAA to raise funds')
        upsert_meetings(self.conn, [row])
        self.conn.commit()
        with self.assertNoLogs('scripts.ingest_nse_board_meetings',
                               level='INFO'):
            upsert_meetings(self.conn, [row], explain=True)   # identical
        self.conn.commit()

    def test_explain_says_nothing_about_a_plain_insert(self):
        """A new row has no prior payload, so the diff finds nothing and the
        'hash changed but no field differs' warning would fire on EVERY insert
        — 11,183 false alarms on one backfill, which is exactly how a real one
        stops being read."""
        row = _bm('NEW', 'INE00N', '10-Sep-2026', '01-Sep-2026 10:00:00',
                  'Fund Raising', 'brand new row')
        with self.assertNoLogs('scripts.ingest_nse_board_meetings',
                               level='INFO'):
            ins, _, _ = upsert_meetings(self.conn, [row], explain=True)
        self.conn.commit()
        self.assertEqual(ins, 1)

    def test_the_diff_reads_the_same_keys_the_hash_does(self):
        """If the two lists diverge, a real hash change reports 'nothing
        differs' — a diagnostic that closes the question with a wrong answer,
        which is worse than having none. One declaration is what prevents it,
        and this asserts the hash actually consumes it.
        """
        from scripts.ingest_nse_board_meetings import _HASH_KEYS, _hash
        base = {k: 'x' for k in _HASH_KEYS}
        for k in _HASH_KEYS:
            moved = dict(base, **{k: 'y'})
            self.assertNotEqual(_hash(base), _hash(moved),
                                f'{k} is in _HASH_KEYS but does not move the hash')
            self.assertEqual([d[0] for d in _material_diff(base, moved)], [k])

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

    def _meeting(self, symbol, isin, mdate):
        """A stored intimation, so board_meeting_id has something to reference."""
        with self.conn.cursor() as c:
            c.execute("INSERT INTO km_board_meetings (isin, symbol, "
                      "meeting_date, intimated_at, purpose_raw, is_results, "
                      "results_basis, payload, content_hash) VALUES "
                      "(%s,%s,%s,%s,'Financial Results',true,'purpose',"
                      "'{}',%s) RETURNING id",
                      (isin, symbol, mdate, f'{mdate} 09:00', symbol + mdate))
            bm_id = c.fetchone()[0]
        self.conn.commit()
        return bm_id

    def _result(self, isin, name, day0, verdict=True, bm_id=None, hhmm='10:00'):
        with self.conn.cursor() as c:
            c.execute("INSERT INTO km_filings_raw (source, source_ann_id, isin,"
                      " disseminated_at, content_hash, payload) VALUES "
                      "('NSE',%s,%s,%s,'h','{}') RETURNING id",
                      (name + str(day0) + hhmm, isin, f'{day0} {hhmm}'))
            rid = c.fetchone()[0]
            c.execute("INSERT INTO km_corporate_events (isin, company_name, "
                      "disseminated_at, day_0_trade_date, family, desc_raw, "
                      "primary_raw_id, raw_ids, is_result_announcement, "
                      "board_meeting_id) VALUES "
                      "(%s,%s,%s,%s,'UNCLASSIFIED','Outcome of Board Meeting',"
                      "%s,ARRAY[%s],%s,%s)",
                      (isin, name, f'{day0} {hhmm}', day0, rid, rid, verdict,
                       bm_id))
        self.conn.commit()

    def _rows(self, *args, view=False):
        sql = ('SELECT symbol, base_trade_date, base_close, day_0_close, '
               'end_trade_date, end_close, sessions_elapsed, reaction_pct, '
               'drift_pct, suspect_corporate_action, board_meeting_id, '
               'sibling_announcements FROM ')
        with self.conn.cursor() as c:
            if view:
                c.execute(sql + 'v_result_drift ORDER BY symbol')
            else:
                c.execute(sql + 'kd_result_returns(%s,%s,%s) ORDER BY symbol',
                          args if args else (None, None, None))
            cols = ('symbol', 'base_date', 'base_close', 'd0_close', 'end_date',
                    'end_close', 'sessions', 'reaction', 'drift', 'suspect',
                    'bm_id', 'siblings')
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


    # ── one drift row per RESULT, not per announcement (migration 216) ────
    def test_siblings_of_one_meeting_collapse_to_one_row(self):
        """Measured 1.19 announcements per results meeting: one board meeting
        approves results, declares a dividend and appoints an auditor, and each
        outcome is filed separately. 427 of 2,733 rows were a second Day 0 for a
        result already counted."""
        self._stock(8, 'HHH', 'INE00H',
                    [('2026-09-07', 100), ('2026-09-08', 110),
                     ('2026-09-09', 121)])
        bm = self._meeting('HHH', 'INE00H', '2026-09-08')
        self._result('INE00H', 'HHH', '2026-09-08', bm_id=bm, hhmm='16:00')
        self._result('INE00H', 'HHH', '2026-09-08', bm_id=bm, hhmm='18:30')
        # ⚠ COUNT IN SQL. self._rows() keys a dict by symbol, so two rows for
        # one stock collapse inside the HELPER — an assertion on len(rows)
        # passes against a function that de-duplicates nothing.
        with self.conn.cursor() as c:
            c.execute('SELECT count(*) FROM kd_result_returns()')
            self.assertEqual(c.fetchone()[0], 1)
        self.assertEqual(self._rows()['HHH']['siblings'], 2)

    def test_the_earliest_announcement_is_the_one_kept(self):
        """It can never be later than the moment the market could first act on
        the meeting's outcome, which is the only thing Day 0 may mean."""
        self._stock(9, 'III', 'INE00I',
                    [('2026-09-07', 100), ('2026-09-08', 110)])
        bm = self._meeting('III', 'INE00I', '2026-09-08')
        self._result('INE00I', 'III', '2026-09-08', bm_id=bm, hhmm='18:30')
        self._result('INE00I', 'III', '2026-09-08', bm_id=bm, hhmm='16:00')
        with self.conn.cursor() as c:
            c.execute("SELECT id FROM km_corporate_events "
                      "ORDER BY disseminated_at LIMIT 1")
            earliest = c.fetchone()[0]
            c.execute('SELECT event_id FROM kd_result_returns()')
            self.assertEqual(c.fetchone()[0], earliest)

    def test_two_meetings_stay_two_rows(self):
        """Two quarters close together are two board meetings and must never
        merge — the de-duplication is per meeting, not per company."""
        self._stock(10, 'JJJ', 'INE00J',
                    [('2026-09-01', 100), ('2026-09-02', 105),
                     ('2026-09-08', 110), ('2026-09-09', 115)])
        b1 = self._meeting('JJJ', 'INE00J', '2026-09-02')
        b2 = self._meeting('JJJ', 'INE00J', '2026-09-08')
        self._result('INE00J', 'JJJ', '2026-09-02', bm_id=b1)
        self._result('INE00J', 'JJJ', '2026-09-08', bm_id=b2)
        with self.conn.cursor() as c:
            c.execute('SELECT count(*) FROM kd_result_returns()')
            self.assertEqual(c.fetchone()[0], 2)

    def test_events_without_a_meeting_id_do_not_collapse(self):
        """DISTINCT ON treats every NULL as one group, so an un-keyed event
        would swallow all the others. The linker cannot produce that today;
        the guard is what stops a future path from doing it silently."""
        self._stock(11, 'KKK', 'INE00K',
                    [('2026-09-07', 100), ('2026-09-08', 110)])
        self._stock(12, 'LLL', 'INE00L',
                    [('2026-09-07', 100), ('2026-09-08', 110)])
        self._result('INE00K', 'KKK', '2026-09-08', bm_id=None)
        self._result('INE00L', 'LLL', '2026-09-08', bm_id=None)
        with self.conn.cursor() as c:
            c.execute('SELECT count(*) FROM kd_result_returns()')
            self.assertEqual(c.fetchone()[0], 2)
        self.assertEqual(self._rows()['KKK']['siblings'], 1)


if __name__ == '__main__':
    unittest.main()
