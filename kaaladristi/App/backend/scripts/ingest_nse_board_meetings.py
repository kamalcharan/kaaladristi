"""
NSE board-meeting ingest — Sprint 2, the anchor for returns_since_result
=========================================================================
Fetches /api/corporate-board-meetings into km_board_meetings (migration 214)
and uses it to mark which 'Outcome of Board Meeting' announcements are RESULTS.

    python3 scripts/ingest_nse_board_meetings.py                  # last 7 days
    python3 scripts/ingest_nse_board_meetings.py --days 120
    python3 scripts/ingest_nse_board_meetings.py --from 2026-06-01 --to 2026-09-16
    python3 scripts/ingest_nse_board_meetings.py --days 7 --dry-run
    python3 scripts/ingest_nse_board_meetings.py --reclassify     # no fetch
    python3 scripts/ingest_nse_board_meetings.py --relink \
            --from 2026-06-01 --to 2026-09-16                    # no fetch

WHY A SECOND FEED AT ALL. returns_since_result needs the date a company
announced results, and the announcements stream cannot supply it: a result is
filed as 'Outcome of Board Meeting' (3,013 rows in one season) alongside
dividends, fundraising and appointments, its attchmntText is boilerplate, and
all three candidate discriminators failed (filename 13%, 'fin' 16%, hasXbrl
3,013/3,013 — a defaulted flag). The prior INTIMATION does say why the board is
meeting, so the result date arrives as a metadata join: no PDF, no classifier,
no LLM.

⚠ A MEETING DATE IS NOT DAY 0 AND IS NEVER USED AS ONE. bm_date is when the
board WILL meet — a date the market cannot act on. Day 0 stays where migration
212 put it: the outcome announcement's exchdisstime, through
kd_day_zero_trade_date. This script only sets a BOOLEAN on events that already
have their own Day 0.

⚠ FALSE IS A MEASUREMENT, NOT A DEFAULT. km_corporate_events.
is_result_announcement is nullable: NULL means "no board-meeting coverage for
this period yet", FALSE means "we had the meetings and this was not results".
So an event is only ever evaluated inside the span the fetch actually returned,
shrunk by the match tolerance — see link_result_announcements. Marking an
un-covered period FALSE would make an un-ingested stretch indistinguishable
from a quiet one, which is the GENERAL-vs-UNCLASSIFIED mistake wearing a
different hat.

MEASURED (probe v3, live API, 2026-09-16): 481 meetings over 30 days, ~16/day,
~6,000/yr — two orders of magnitude smaller than the announcements stream, so
window size and request count are not a constraint here.
"""

import argparse
import hashlib
import json
import logging
import os
import sys
import time
from datetime import date, datetime, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from lib.config import DATABASE_URL                        # noqa: E402
from lib.filing_taxonomy import classify_board_meeting     # noqa: E402
from pipeline.utils.nse_session import NseSession          # noqa: E402

log = logging.getLogger(__name__)

BM_URL = 'https://www.nseindia.com/api/corporate-board-meetings'
BM_REFERER = ('https://www.nseindia.com/companies-listing/'
              'corporate-filings-board-meetings')

BACKFILL_WINDOW_DAYS = 90
PIPELINE_WINDOW_DAYS = 14      # trailing sweep for the scheduled runs
REQUEST_DELAY_SEC = 2.0

# ── The two tolerances that decide a match — NOW MEASURED ─────────────────
# Offsets of 2,733 matched outcome announcements against their meeting date,
# over 2026-06-01..09-16 (the first live backfill, and the full range the
# original ±4/+1 guess allowed):
#
#       -1 days     5
#        0 days 2,698   <- 98.7%
#       +1 days    14
#       +2 days     3
#       +3 days     8
#       +4 days     5
#
# SEBI LODR Reg 30 requires the outcome within 30 MINUTES of the board meeting
# concluding. So 0 is the rule, +1 is a meeting that ran into the next day, and
# +2..+4 CANNOT be that meeting's outcome — those 16 are proximity mismatches,
# not late filings. A reschedule does not need the slack either: it files its
# own intimation row (the natural key admits one), so the real date matches at 0.
#
# The guess was 4. The measurement says 1, and the 16 it removes were wrong.
MATCH_BACK_DAYS = 1
MATCH_FWD_DAYS = 1

# MEASURED: the feed filters on the MEETING date. Over the same backfill, 0 of
# 11,183 rows fell outside the requested window by bm_date against 2,149 by
# bm_timestamp — so a lead buffer is not needed for correctness at all, and 30
# days of it was fetching a month nobody asked for.
#
# Kept small rather than removed: it costs one call on a ~16-row-a-day feed, the
# coverage clip in `run` makes the extra rows free (they are stored, never
# treated as extending the judgeable span), and it is the one thing standing
# between us and a silent hole if NSE ever switches the filter to bm_timestamp.
INTIMATION_LEAD_DAYS = 7

# The one desc a result is filed under. Measured: 'Outcome of Board Meeting'.
# 'Clarification - Financial Results' is deliberately absent — it is a
# clarification ABOUT a result already announced, so admitting it would put a
# second Day 0 on the same event.
OUTCOME_DESCS = ['Outcome of Board Meeting']


def get_conn():
    import psycopg2
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(DATABASE_URL, connect_timeout=30)


def _ts(raw: str | None):
    """'10-Sep-2026 17:33:03' -> naive datetime, same convention as the
    announcements ingest (the VPS runs IST, which is what NSE publishes in)."""
    if not raw:
        return None
    try:
        return datetime.strptime(raw.strip(), '%d-%b-%Y %H:%M:%S')
    except ValueError:
        return None


def _d(raw: str | None):
    """'16-Sep-2026' -> date."""
    if not raw:
        return None
    try:
        return datetime.strptime(raw.strip(), '%d-%b-%Y').date()
    except ValueError:
        return None


def _hash(row: dict) -> str:
    """Excludes `diff` and `sysTime` — NSE recomputes both, so including them
    would make every re-fetch look like a revision."""
    material = {k: row.get(k) for k in
                ('bm_symbol', 'sm_isin', 'bm_date', 'bm_timestamp',
                 'bm_purpose', 'bm_desc', 'attachment', 'ixbrl',
                 'oriiginalMeetingDate', 'proposedMeetingDate')}
    return hashlib.sha256(
        json.dumps(material, sort_keys=True, default=str).encode()).hexdigest()


def fetch_window(session: NseSession, start: date, end: date) -> list[dict]:
    q = (f'index=equities&from_date={start.strftime("%d-%m-%Y")}'
         f'&to_date={end.strftime("%d-%m-%Y")}')
    resp = session.get(f'{BM_URL}?{q}', referer=BM_REFERER)
    time.sleep(REQUEST_DELAY_SEC)
    data = resp.json()
    return data if isinstance(data, list) else data.get('data', [])


def upsert_meetings(conn, rows: list[dict]) -> tuple[int, int, int]:
    """Returns (inserted, updated, skipped).

    Skipped = missing symbol, meeting date or intimation timestamp. All three
    are part of the natural key, and a NULL in a UNIQUE column does not dedup —
    admitting such a row would let every re-fetch insert it again. Counted and
    returned rather than dropped quietly.
    """
    inserted = updated = skipped = 0
    with conn.cursor() as cur:
        for r in rows:
            symbol = (r.get('bm_symbol') or '').strip() or None
            mdate = _d(r.get('bm_date'))
            intimated = _ts(r.get('bm_timestamp'))
            if not symbol or not mdate or not intimated:
                skipped += 1
                continue

            purpose = (r.get('bm_purpose') or '').strip() or None
            desc = (r.get('bm_desc') or '').strip() or None
            is_results, basis = classify_board_meeting(purpose, desc)

            cur.execute("""
                INSERT INTO km_board_meetings
                  (isin, symbol, company_name, meeting_date, intimated_at,
                   purpose_raw, desc_raw, is_results, results_basis,
                   attachment_url, ixbrl_url, payload, content_hash)
                VALUES (COALESCE(%s, (SELECT isin FROM km_equity_symbols
                                       WHERE symbol = %s AND exchange = 'NSE'
                                         AND is_active
                                       ORDER BY id LIMIT 1)),
                        %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (symbol, meeting_date, intimated_at) DO UPDATE
                   SET purpose_raw    = EXCLUDED.purpose_raw,
                       desc_raw       = EXCLUDED.desc_raw,
                       is_results     = EXCLUDED.is_results,
                       results_basis  = EXCLUDED.results_basis,
                       attachment_url = EXCLUDED.attachment_url,
                       ixbrl_url      = EXCLUDED.ixbrl_url,
                       payload        = EXCLUDED.payload,
                       content_hash   = EXCLUDED.content_hash,
                       -- never regress a resolved ISIN to NULL
                       isin           = COALESCE(km_board_meetings.isin,
                                                 EXCLUDED.isin),
                       fetched_at     = now()
                 WHERE km_board_meetings.content_hash
                       IS DISTINCT FROM EXCLUDED.content_hash
                RETURNING (xmax = 0) AS was_insert
            """, ((r.get('sm_isin') or '').strip() or None, symbol,
                  symbol, (r.get('sm_name') or '').strip() or None,
                  mdate, intimated, purpose, desc, is_results, basis,
                  (r.get('attachment') or '').strip() or None,
                  (r.get('ixbrl') or '').strip() or None,
                  json.dumps(r, default=str), _hash(r)))
            got = cur.fetchone()
            if got:                      # no row back = identical, a real no-op
                inserted += 1 if got[0] else 0
                updated += 0 if got[0] else 1
    return inserted, updated, skipped


def reclassify(conn) -> int:
    """Re-run the purpose/desc rule over stored text. No fetch.

    This is what makes the rule changeable: purpose_raw and desc_raw are kept
    verbatim, so sharpening a phrase never means re-scraping a season. Only
    rows whose verdict actually moves are written.
    """
    changed = 0
    with conn.cursor() as cur:
        cur.execute('SELECT id, purpose_raw, desc_raw, is_results, '
                    'results_basis FROM km_board_meetings ORDER BY id')
        rows = cur.fetchall()
    with conn.cursor() as cur:
        for bm_id, purpose, desc, was_results, was_basis in rows:
            is_results, basis = classify_board_meeting(purpose, desc)
            if is_results == was_results and basis == was_basis:
                continue
            cur.execute('UPDATE km_board_meetings SET is_results = %s, '
                        'results_basis = %s WHERE id = %s',
                        (is_results, basis, bm_id))
            changed += 1
    return changed


def relink_result_announcements(conn, start: date, end: date) -> dict:
    """Re-judge stored events against stored meetings. NO FETCH.

    The counterpart of --reclassify, and it exists for the same reason: the
    match tolerance is a calibrated number, and the first live backfill moved it
    from a guess of 4 days to a measured 1. Without this, every event judged
    under the old tolerance keeps its verdict forever — the linker only touches
    rows where is_result_announcement IS NULL, so a tightened rule would apply
    to future events and silently not to history.

    ⚠ It clears ONLY the window it is about to re-judge. Clearing [start, end]
    and then linking would demote every event in the shrunk edges from a verdict
    to NULL — losing judgements that a wider earlier run had made correctly.

    Coverage comes from the meetings ALREADY STORED, intersected with the range
    asked for. Pass a range you actually fetched: this cannot tell a contiguous
    fetch from two disjoint ones, and over-claiming coverage turns a hole into a
    confident FALSE.
    """
    with conn.cursor() as cur:
        cur.execute('SELECT min(meeting_date), max(meeting_date) '
                    'FROM km_board_meetings')
        first, last = cur.fetchone()
    if first is None:
        return {'cleared': 0, 'link': None}

    cov_start, cov_end = max(first, start), min(last, end)
    win = judge_window(cov_start, cov_end) if cov_start <= cov_end else None
    if win is None:
        return {'cleared': 0, 'link': None}

    # ⚠ NO COMMIT BETWEEN THE CLEAR AND THE RE-JUDGE. They are one transaction:
    # committing the clear on its own is how a crash, or a caller that forgets
    # to commit, leaves every verdict NULL with nothing to put back. That is
    # exactly what happened live on 2026-09-18 — see link_result_announcements.
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE km_corporate_events
               SET is_result_announcement = NULL,
                   board_meeting_id       = NULL,
                   updated_at             = now()
             WHERE desc_raw = ANY(%s)
               AND is_result_announcement IS NOT NULL
               AND (disseminated_at AT TIME ZONE 'Asia/Kolkata')::date
                     BETWEEN %s AND %s
        """, (OUTCOME_DESCS, win[0], win[1]))
        cleared = cur.rowcount
    link = link_result_announcements(conn, cov_start, cov_end)   # commits both
    return {'cleared': cleared, 'link': link}


def judge_window(cov_start: date, cov_end: date) -> tuple[date, date] | None:
    """Which events meeting coverage [cov_start, cov_end] can actually judge.

    ONE implementation with two callers — the linker and the re-linker. If the
    re-linker cleared a wider range than the linker re-judges, every event in
    the difference would be silently demoted from a verdict to NULL, and the
    two rules drifting apart is exactly how that happens.
    """
    lo = cov_start + timedelta(days=MATCH_BACK_DAYS)
    hi = cov_end - timedelta(days=MATCH_FWD_DAYS)
    return (lo, hi) if lo <= hi else None


def link_result_announcements(conn, cov_start: date, cov_end: date) -> dict:
    """Mark km_corporate_events rows as results / not results.

    ⚠ THE WINDOW IS SHRUNK, NOT THE ONE WE FETCHED. An event disseminated on D
    can only be judged if we hold the meetings for [D - MATCH_BACK,
    D + MATCH_FWD]. So with meetings covering [cov_start, cov_end], the
    evaluable events are [cov_start + MATCH_BACK, cov_end - MATCH_FWD]. Judging
    the edges would stamp FALSE on events whose meeting we simply never
    fetched — a wrong measurement, and one that never corrects itself because
    the row stops being NULL.

    Coverage is taken from the meeting dates that actually came BACK, never
    from the window we asked for.

    ⚠ AND A DATE WINDOW IS NOT COVERAGE FOR EVERY COMPANY IN IT. A company that
    filed an 'Outcome of Board Meeting' and has NO intimation of any kind in
    the tolerance window is NOT evidence that the meeting was not results —
    SEBI LODR requires prior intimation for results, so an outcome with no
    intimation on record is far more likely a hole in OUR fetch than a company
    meeting unannounced. Those rows are LEFT NULL and returned as `no_meeting`,
    so a coverage hole is a number on the run report. FALSE is reserved for the
    case we actually measured: the company DID intimate a meeting in the
    window, and it was not a results meeting.

    This is the starved-derivation rule again — a window too short to look must
    never read as a stock with nothing in it. It is also self-healing: a wider
    backfill lands the missing intimation and the NULL resolves on the next
    pass, which a wrong FALSE never would.
    """
    win = judge_window(cov_start, cov_end)
    if win is None:
        # Nothing judged, nothing written, nothing to commit. Unreachable from
        # relink, which computes the same window first and returns before it
        # clears anything.
        return {'evaluated': 0, 'results': 0, 'not_results': 0,
                'no_meeting': 0, 'window': None}
    lo, hi = win

    with conn.cursor() as cur:
        cur.execute("""
            UPDATE km_corporate_events e
               SET is_result_announcement = (m.result_id IS NOT NULL),
                   board_meeting_id       = m.result_id,
                   updated_at             = now()
              FROM (
                    SELECT id, isin,
                           (disseminated_at AT TIME ZONE 'Asia/Kolkata')::date
                             AS diss_date
                      FROM km_corporate_events
                     WHERE desc_raw = ANY(%s)
                       AND is_result_announcement IS NULL
                       AND (disseminated_at AT TIME ZONE 'Asia/Kolkata')::date
                             BETWEEN %s AND %s
                   ) c
              LEFT JOIN LATERAL (
                    SELECT
                      (SELECT b.id FROM km_board_meetings b
                        WHERE b.is_results AND b.isin = c.isin
                          AND b.meeting_date BETWEEN c.diss_date - %s
                                                 AND c.diss_date + %s
                        -- nearest meeting wins: a company reporting two
                        -- quarters inside one tolerance window must not
                        -- attach to the older
                        ORDER BY abs(c.diss_date - b.meeting_date), b.id
                        LIMIT 1) AS result_id,
                      -- The company intimated SOMETHING in the window, which
                      -- is what makes a FALSE a measurement rather than a hole.
                      --
                      -- ⚠ SAME WINDOW AS THE MATCH ABOVE, deliberately. Since
                      -- the tolerance tightened to +/-1 this decides real
                      -- cases: an outcome filed 2+ days after a results meeting
                      -- now reads NULL rather than FALSE. That is correct — we
                      -- failed to PLACE it, we did not measure it — and NULL is
                      -- recoverable where FALSE never corrects itself. Widening
                      -- only this window would buy tidier counts by asserting
                      -- something we did not check.
                      EXISTS (SELECT 1 FROM km_board_meetings b
                               WHERE b.isin = c.isin
                                 AND b.meeting_date BETWEEN c.diss_date - %s
                                                        AND c.diss_date + %s)
                        AS any_meeting
              ) m ON TRUE
             WHERE e.id = c.id
               AND (m.result_id IS NOT NULL OR m.any_meeting)
        """, (OUTCOME_DESCS, lo, hi, MATCH_BACK_DAYS, MATCH_FWD_DAYS,
              MATCH_BACK_DAYS, MATCH_FWD_DAYS))
        evaluated = cur.rowcount

        cur.execute("""
            SELECT count(*) FILTER (WHERE is_result_announcement),
                   count(*) FILTER (WHERE NOT is_result_announcement),
                   count(*) FILTER (WHERE is_result_announcement IS NULL)
              FROM km_corporate_events
             WHERE desc_raw = ANY(%s)
               AND (disseminated_at AT TIME ZONE 'Asia/Kolkata')::date
                     BETWEEN %s AND %s
        """, (OUTCOME_DESCS, lo, hi))
        results, not_results, no_meeting = cur.fetchone()

    # ⚠ THIS FUNCTION COMMITS ITS OWN WRITE, and that is not tidiness.
    #
    # It used to leave the commit to the caller. `run()` did commit; the
    # --relink path did NOT, and relink commits its CLEAR before calling this.
    # So on 2026-09-18 a live --relink committed 2,829 cleared verdicts and then
    # rolled back every re-judgement at conn.close(): 2,717 results became 2.
    # The destructive half was durable and the restoring half was not.
    #
    # The tests did not catch it because they call this and then commit
    # THEMSELVES — the test supplied the commit the CLI forgot. A durability
    # test (write, roll back, read) is the only shape that can see this, and
    # there is one now.
    conn.commit()

    return {'evaluated': evaluated, 'results': results,
            'not_results': not_results, 'no_meeting': no_meeting,
            'window': (lo, hi)}


def run(conn, session, start: date, end: date, dry_run=False) -> dict:
    stats = {'fetched': 0, 'calls': 0, 'inserted': 0, 'updated': 0,
             'skipped': 0, 'is_results': 0, 'by_purpose': 0, 'by_desc': 0,
             'cov_start': None, 'cov_end': None, 'link': None,
             'outside_by_meeting': 0, 'outside_by_intimation': 0}

    fetch_from = start - timedelta(days=INTIMATION_LEAD_DAYS)
    cur = fetch_from
    all_meeting_dates: list[date] = []

    while cur <= end:
        win_end = min(cur + timedelta(days=BACKFILL_WINDOW_DAYS - 1), end)
        rows = fetch_window(session, cur, win_end)
        stats['fetched'] += len(rows)
        stats['calls'] += 1
        log.info(f'  {cur}..{win_end}: {len(rows):,} board meetings')

        for r in rows:
            md, it = _d(r.get('bm_date')), _ts(r.get('bm_timestamp'))
            if md:
                all_meeting_dates.append(md)
                if not (cur <= md <= win_end):
                    stats['outside_by_meeting'] += 1
            if it and not (cur <= it.date() <= win_end):
                stats['outside_by_intimation'] += 1
            ok, basis = classify_board_meeting(r.get('bm_purpose'),
                                               r.get('bm_desc'))
            if ok:
                stats['is_results'] += 1
                stats['by_purpose' if basis == 'purpose' else 'by_desc'] += 1

        if not dry_run:
            ins, upd, skp = upsert_meetings(conn, rows)
            conn.commit()
            stats['inserted'] += ins
            stats['updated'] += upd
            stats['skipped'] += skp
            log.info(f'    -> {ins:,} new, {upd} revised, {skp} skipped')
        cur = win_end + timedelta(days=1)

    if stats['skipped']:
        log.warning(f'  ⚠ {stats["skipped"]} rows had no symbol / meeting date '
                    f'/ intimation timestamp and were not stored — all three '
                    f'are natural-key columns.')

    # Which date does the feed's window actually filter on? Stated rather than
    # assumed, so the lead buffer above can be tightened once it is known.
    if stats['fetched']:
        log.info(f'  window filter looks like: '
                 f'{stats["outside_by_meeting"]} rows outside by MEETING date, '
                 f'{stats["outside_by_intimation"]} outside by INTIMATION date '
                 f'(the smaller number names the field NSE filters on)')

    if all_meeting_dates:
        # Coverage from what came BACK, clipped to what was asked for: the lead
        # buffer fetches meetings before `start` that we must not treat as
        # extending the judgeable span backwards.
        stats['cov_start'] = max(min(all_meeting_dates), start)
        stats['cov_end'] = min(max(all_meeting_dates), end)

    if not dry_run and stats['cov_start']:
        stats['link'] = link_result_announcements(
            conn, stats['cov_start'], stats['cov_end'])
        conn.commit()
        lk = stats['link']
        if lk['window']:
            log.info(f'  events judged {lk["window"][0]}..{lk["window"][1]}: '
                     f'{lk["evaluated"]:,} newly evaluated  |  in-window totals '
                     f'{lk["results"]:,} results / {lk["not_results"]:,} not')
            if lk['no_meeting']:
                # Not a failure, and not "not results" — a coverage hole, named
                # so it can be closed with a wider --from instead of quietly
                # shrinking the result population.
                log.info(f'  {lk["no_meeting"]:,} outcome announcements left '
                         f'NULL: the company has no intimation of any kind in '
                         f'the tolerance window, so there is nothing to judge '
                         f'them against. Widen the fetch window to resolve.')
        else:
            log.info('  meeting coverage narrower than the match tolerance — '
                     'no event evaluated, all left NULL (correctly)')
    return stats


# ── pipeline2 entry point ────────────────────────────────────────────────

def ingest_board_meetings_for_pipeline(conn, trade_date,
                                       force: bool = False) -> tuple[int, str]:
    """(rows, status) — the bespoke-handler convention, same as filings_ingest.

    `trade_date` is ignored as a fetch key for the same reason it is there:
    intimations are a forward-looking stream keyed to a future meeting, not a
    fact about a past bar. A trailing window is swept instead, wider than the
    gap between runs because a re-fetch is a DB no-op and a missed intimation
    turns into an event stamped FALSE.
    """
    from datetime import date as _date, timedelta as _td
    end = _date.today()
    start = end - _td(days=PIPELINE_WINDOW_DAYS)
    stats = run(conn, NseSession(), start, end, dry_run=False)
    lk = stats['link'] or {}
    moved = stats['inserted'] + stats['updated'] + lk.get('evaluated', 0)
    return moved, ('completed' if moved else 'partial')


def main():
    ap = argparse.ArgumentParser(description='Ingest NSE board meetings')
    ap.add_argument('--days', type=int, default=7, help='last N days (default 7)')
    ap.add_argument('--from', dest='dfrom', default=None)
    ap.add_argument('--to', dest='dto', default=None)
    ap.add_argument('--dry-run', action='store_true',
                    help='fetch and report, write nothing')
    ap.add_argument('--reclassify', action='store_true',
                    help='re-run the results rule over stored text; no fetch')
    ap.add_argument('--relink', action='store_true',
                    help='re-judge stored events against stored meetings after '
                         'a tolerance change; needs --from/--to, no fetch')
    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format='%(message)s')

    if args.relink:
        if not (args.dfrom and args.dto):
            ap.error('--relink needs --from and --to: the range you actually '
                     'fetched meetings for. It cannot infer that, and claiming '
                     'coverage you do not have turns a hole into a confident '
                     'FALSE.')
        conn = get_conn()
        try:
            st = relink_result_announcements(
                conn, date.fromisoformat(args.dfrom), date.fromisoformat(args.dto))
            lk = st['link']
            if not lk or not lk['window']:
                print('no stored meeting coverage overlaps that range — '
                      'nothing re-judged')
            else:
                print(f'cleared {st["cleared"]:,} verdicts and re-judged '
                      f'{lk["window"][0]}..{lk["window"][1]}: '
                      f'{lk["results"]:,} results / {lk["not_results"]:,} not / '
                      f'{lk["no_meeting"]:,} no coverage')
        finally:
            conn.close()
        return

    if args.reclassify:
        conn = get_conn()
        try:
            n = reclassify(conn)
            conn.commit()
            print(f'reclassified {n:,} meetings from stored purpose/desc')
        finally:
            conn.close()
        return

    end = date.fromisoformat(args.dto) if args.dto else date.today()
    start = (date.fromisoformat(args.dfrom) if args.dfrom
             else end - timedelta(days=args.days))

    print(f'NSE board meetings  {start} .. {end}'
          f'{"  [DRY RUN]" if args.dry_run else ""}')
    conn = None if args.dry_run else get_conn()
    try:
        s = run(conn, NseSession(), start, end, args.dry_run)
        pct = 100 * s['is_results'] / max(s['fetched'], 1)
        print(f'\nfetched {s["fetched"]:,} in {s["calls"]} calls  |  '
              f'new {s["inserted"]:,}  revised {s["updated"]:,}  '
              f'skipped {s["skipped"]:,}')
        print(f'results meetings {s["is_results"]:,} ({pct:.1f}%)  '
              f'— by purpose {s["by_purpose"]:,}, by desc {s["by_desc"]:,}')
        if s['link']:
            lk = s['link']
            print(f'events evaluated {lk["evaluated"]:,}  |  in-window '
                  f'{lk["results"]:,} results / {lk["not_results"]:,} not / '
                  f'{lk["no_meeting"]:,} no coverage')
    finally:
        if conn:
            conn.close()


if __name__ == '__main__':
    main()

# ── Verification, after the first real run ────────────────────────────────
# Is the free-text rule load-bearing, or does bm_purpose carry it?
#   SELECT results_basis, count(*) FROM km_board_meetings
#    WHERE is_results GROUP BY 1;
#
# MEASURE THE TOLERANCES ABOVE instead of leaving them a guess. If nothing
# lands at the edges, MATCH_BACK_DAYS is too generous and can be tightened:
#   SELECT b.meeting_date - (e.disseminated_at AT TIME ZONE 'Asia/Kolkata')::date
#            AS offset_days, count(*)
#     FROM km_corporate_events e JOIN km_board_meetings b
#       ON b.id = e.board_meeting_id
#    GROUP BY 1 ORDER BY 1;
#
# What share of outcome announcements resolved either way (the rest are NULL,
# i.e. no coverage yet — not "not results"):
#   SELECT is_result_announcement, count(*) FROM km_corporate_events
#    WHERE desc_raw = 'Outcome of Board Meeting' GROUP BY 1;
