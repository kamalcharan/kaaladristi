"""
NSE filings ingest — Sprint 2
==============================
Fetches NSE corporate announcements into km_filings_raw (migration 212) and
derives km_corporate_events from them. No LLM, no PDF fetch, no extraction —
this is the structured spine and it must not be able to fail on document
quality.

    python3 scripts/ingest_nse_filings.py                 # last 2 days
    python3 scripts/ingest_nse_filings.py --days 7
    python3 scripts/ingest_nse_filings.py --from 2025-09-15 --to 2026-09-15
    python3 scripts/ingest_nse_filings.py --days 2 --dry-run

MEASURED BEHAVIOUR THIS RELIES ON (probe, live API, 2026-09-15):
  * ~551-762 announcements/calendar-day, ~201,000/year.
  * A single 180-day call returns 99,162 rows and is NOT truncated — the two
    90-day halves covering the same span return exactly the same total. So
    BACKFILL_WINDOW_DAYS can be large and five years is ~10 calls.
  * sm_isin is supplied, so no ISIN resolution step exists here.
  * seq_id is the natural key; UNIQUE (source, source_ann_id) makes a re-run a
    no-op in the DB rather than a correctness argument in Python.

⚠ NOT AN EOD STEP. Announcements arrive all day and cluster AFTER the close, so
an 18:00 daily_run would miss them every night, silently, while the row count
still looked healthy. This runs on its own schedule — 06:00/09:00/12:00/20:00/
23:00 IST, outside the 12:30-19:30 VPS scheduler window.
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
from lib.config import DATABASE_URL                      # noqa: E402
from lib.filing_taxonomy import (classify_desc, DESC_MAP,  # noqa: E402
                                 TAXONOMY_VERSION, UNCLASSIFIED)
from pipeline.utils.nse_session import NseSession        # noqa: E402

log = logging.getLogger(__name__)

ANN_URL = 'https://www.nseindia.com/api/corporate-announcements'
ANN_REFERER = ('https://www.nseindia.com/companies-listing/'
               'corporate-filings-announcements')
BACKFILL_WINDOW_DAYS = 90      # measured safe to 180; 90 keeps each call ~5s
# Trailing sweep for the scheduled runs. Wider than the ~3h gap between slots on
# purpose: a repeat fetch is free (UNIQUE makes it a DB no-op), a missed filing
# is not. Also covers a weekend or a holiday with no run in between.
PIPELINE_WINDOW_DAYS = 5
REQUEST_DELAY_SEC = 2.0


def get_conn():
    import psycopg2
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(DATABASE_URL, connect_timeout=30)


def _ts(raw: str | None):
    """NSE serves '14-Sep-2026 23:50:09'. Returned NAIVE and written to a
    TIMESTAMPTZ column with the session TZ — the VPS runs IST, which is also
    what NSE publishes in."""
    if not raw:
        return None
    try:
        return datetime.strptime(raw.strip(), '%d-%b-%Y %H:%M:%S')
    except ValueError:
        return None


def _hash(row: dict) -> str:
    """Content hash over the fields that define the filing. Deliberately EXCLUDES
    `difference` (a derived lag NSE recomputes) so a cosmetic change does not
    read as a revision — while a real edit to the text, the document or the
    timestamps does."""
    material = {k: row.get(k) for k in
                ('seq_id', 'symbol', 'sm_isin', 'desc', 'attchmntText',
                 'attchmntFile', 'an_dt', 'exchdisstime')}
    return hashlib.sha256(
        json.dumps(material, sort_keys=True, default=str).encode()).hexdigest()


def fetch_window(session: NseSession, start: date, end: date) -> list[dict]:
    q = (f'index=equities&from_date={start.strftime("%d-%m-%Y")}'
         f'&to_date={end.strftime("%d-%m-%Y")}')
    resp = session.get(f'{ANN_URL}?{q}', referer=ANN_REFERER)
    time.sleep(REQUEST_DELAY_SEC)
    data = resp.json()
    return data if isinstance(data, list) else data.get('data', [])


def upsert_raw(conn, rows: list[dict]) -> tuple[int, int]:
    """Returns (inserted, revisions). ON CONFLICT DO NOTHING on the natural key
    makes re-runs free; a changed content_hash on an existing seq_id is a
    REVISION and gets its own row pointing at the original, because the first
    version may already have been classified and already moved the price."""
    inserted = revisions = 0
    with conn.cursor() as cur:
        for r in rows:
            seq = str(r.get('seq_id') or '').strip()
            diss = _ts(r.get('exchdisstime')) or _ts(r.get('an_dt'))
            if not seq or not diss:
                continue                      # cannot key it or cannot date it
            h = _hash(r)

            cur.execute('SELECT id, content_hash FROM km_filings_raw '
                        'WHERE source=%s AND source_ann_id=%s', ('NSE', seq))
            existing = cur.fetchone()
            supersedes = None
            if existing:
                if existing[1] == h:
                    continue                  # already have this exact filing
                supersedes = existing[0]
                revisions += 1

            cur.execute("""
                INSERT INTO km_filings_raw
                  (source, source_ann_id, source_symbol, isin, company_name,
                   announced_at, disseminated_at, desc_raw, summary_text,
                   doc_url, doc_size_label, has_xbrl, payload, content_hash,
                   supersedes_id, extract_status)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (source, source_ann_id) DO NOTHING
                RETURNING id
            """, ('NSE',
                  seq if not supersedes else f'{seq}#r{revisions}',
                  (r.get('symbol') or '').strip() or None,
                  (r.get('sm_isin') or '').strip() or None,
                  (r.get('sm_name') or '').strip() or None,
                  _ts(r.get('an_dt')), diss,
                  (r.get('desc') or '').strip() or None,
                  (r.get('attchmntText') or '').strip() or None,
                  (r.get('attchmntFile') or '').strip() or None,
                  (r.get('attFileSize') or '').strip() or None,
                  bool(r.get('hasXbrl')),
                  json.dumps(r, default=str), h, supersedes,
                  'pending' if r.get('attchmntFile') else 'skipped'))
            if cur.fetchone():
                inserted += 1
    return inserted, revisions


def derive_events(conn) -> tuple[int, int, int]:
    """Classify every raw row that has no event yet, using NSE's own `desc`.
    Returns (events_written, deferred_rows, unresolvable_rows).

    ⚠ DEFERRED IS NOT AN ERROR, AND MUST NOT BE COUNTED AS ONE — but since
    migration 228 it should also be RARE. Under migration 212 the Day 0 rule
    read sessions out of km_equity_eod, so everything filed after 15:30 (the
    larger half of the stream) had no Day 0 until the next bar landed: 287 of
    582 rows on the first live run, and from Friday 15:30 to Monday ~20:10 the
    Filings page went dark for ~53 hours (2026-09-28). Day 0 is now PLANNED
    from km_trading_calendar when the session has not happened yet and
    RECONCILED by reconcile_day_zero() once the bar lands, so a deferral only
    remains for a gap inside recorded history or a span longer than 15 days —
    a number worth reading, no longer a number to expect.

    ⚠ ISIN IS RESOLVED, NOT REQUIRED. The first live run ingested 571 rows and
    produced only 295 events: 276 carried an empty `sm_isin` and were skipped
    SILENTLY — no count, no log, no queue. Half the stream disappearing with
    nothing to show for it is the exact failure class this repo keeps
    re-learning, so:

      1. A missing ISIN now falls back to source_symbol -> km_equity_symbols,
         which holds an ISIN for all 3,825 active NSE rows. Most of the gap
         should close here.
      2. Whatever still cannot be resolved is COUNTED AND RETURNED, so an
         unresolvable tail is a number on the run report rather than an
         absence nobody can see. (Measured 0 on live NSE data — every row
         carried sm_isin. The fallback stays as the safety net for BSE and for
         newly listed symbols.)

    A row that resolves later (a new listing reaching km_equity_symbols on the
    next master sync) is picked up on the next pass, because this selects on
    'has no event yet' rather than marking rows as done.
    """
    written = deferred = 0
    with conn.cursor() as cur:
        # COALESCE(raw, symbol-lookup): the payload's ISIN wins where present.
        cur.execute("""
            SELECT r.id, COALESCE(r.isin, s.isin) AS resolved_isin,
                   r.company_name, r.desc_raw, r.disseminated_at, s.id
            FROM km_filings_raw r
            LEFT JOIN km_corporate_events e ON e.primary_raw_id = r.id
            LEFT JOIN LATERAL (
                SELECT id, isin FROM km_equity_symbols
                 WHERE symbol = r.source_symbol AND exchange = 'NSE' AND is_active
                 ORDER BY id LIMIT 1
            ) s ON TRUE
            WHERE e.id IS NULL
              AND COALESCE(r.isin, s.isin) IS NOT NULL
            ORDER BY r.id
        """)
        rows = cur.fetchall()

    for raw_id, isin, name, desc_raw, diss, equity_id in rows:
        family, event_type, polarity, conf = classify_desc(desc_raw)
        with conn.cursor() as c2:
            # day_0 via the shared SQL function -- one implementation of the
            # after-the-close rule, never repeated per caller.
            c2.execute('SELECT kd_day_zero_trade_date(%s)', (diss,))
            day0 = c2.fetchone()[0]
            if day0 is None:
                deferred += 1     # after the close on the newest bar: the
                                  # session it belongs to has not happened yet.
                                  # Retried, and resolved, on the next pass.
                continue
            c2.execute("""
                INSERT INTO km_corporate_events
                  (isin, equity_id, company_name, disseminated_at,
                   day_0_trade_date, family, event_type, polarity, desc_raw,
                   classified_by, classifier_version, confidence,
                   primary_raw_id, raw_ids)
                VALUES (%s,
                        COALESCE(%s, (SELECT id FROM km_equity_symbols
                                       WHERE isin=%s AND exchange='NSE' AND is_active
                                       ORDER BY id LIMIT 1)),
                        %s,%s,%s,%s,%s,%s,%s,'desc_map',%s,%s,%s,ARRAY[%s])
                ON CONFLICT (primary_raw_id) DO NOTHING
            """, (isin, equity_id, isin, name, diss, day0, family, event_type,
                  polarity, desc_raw, TAXONOMY_VERSION, conf, raw_id, raw_id))
            written += c2.rowcount

    # What is STILL unresolvable, so it is a number rather than an absence.
    with conn.cursor() as cur:
        cur.execute("""
            SELECT count(*) FROM km_filings_raw r
            LEFT JOIN km_corporate_events e ON e.primary_raw_id = r.id
            LEFT JOIN LATERAL (
                SELECT isin FROM km_equity_symbols
                 WHERE symbol = r.source_symbol AND exchange = 'NSE' AND is_active
                 ORDER BY id LIMIT 1
            ) s ON TRUE
            WHERE e.id IS NULL AND COALESCE(r.isin, s.isin) IS NULL
        """)
        unresolvable = cur.fetchone()[0]
    return written, deferred, unresolvable


# Sessions back from the latest bar inside which a stored Day 0 may still be
# provisional. A planned date can sit at most a long weekend plus a holiday
# past the bar that existed when it was planned; ten sessions is several times
# that and still a few thousand rows.
RECONCILE_SESSIONS = 10


def reconcile_day_zero(conn) -> int:
    """Re-derive Day 0 on recent events and rewrite the ones that moved.

    Migration 228 lets kd_day_zero_trade_date PLAN a Day 0 from the trading
    calendar before the session's bar exists — that is what puts a Friday-
    evening filing on the page as "actionable Monday" on Friday night. A plan
    can be wrong in exactly one way: the calendar did not know a holiday, so
    no bar lands on the planned day and the market's first chance to act was
    the day after. Once the bar exists the function's traded-bar rule takes
    over and gives the right answer; this pass copies that answer back onto
    the stored rows.

    Bounded to Day 0s inside the last RECONCILE_SESSIONS bars: a Day 0 older
    than that was confirmed by a bar long ago and re-deriving 31,000 rows on
    every pass buys nothing. Rows whose re-derivation is NULL are left alone —
    a filing dated once is never un-dated.

    Runs on every ingest pass, like reclassify_events, so it needs no operator.
    """
    with conn.cursor() as cur:
        cur.execute("""
            WITH recent AS (
                SELECT trade_date FROM public.km_equity_eod
                 WHERE trade_date IS NOT NULL
                 GROUP BY trade_date ORDER BY trade_date DESC
                 LIMIT %s
            ), floor_d AS (
                SELECT COALESCE(min(trade_date), DATE '1900-01-01') AS d FROM recent
            ), moved AS (
                SELECT e.id, kd_day_zero_trade_date(e.disseminated_at) AS new_d0
                  FROM public.km_corporate_events e
                 WHERE e.day_0_trade_date >= (SELECT d FROM floor_d)
            )
            UPDATE public.km_corporate_events e
               SET day_0_trade_date = m.new_d0,
                   updated_at = now()
              FROM moved m
             WHERE m.id = e.id
               AND m.new_d0 IS NOT NULL
               AND m.new_d0 <> e.day_0_trade_date
        """, (RECONCILE_SESSIONS,))
        return cur.rowcount


def reclassify_events(conn) -> int:
    """Re-label stored events that DESC_MAP can now place but could not before.

    ⚠ WITHOUT THIS, EXTENDING DESC_MAP FIXES NOTHING THAT IS ALREADY STORED.
    `derive_events` selects `WHERE e.id IS NULL` — rows with no event yet — so a
    new map entry reaches only future filings while every historical row keeps
    `family='UNCLASSIFIED'` and `event_type=NULL`. Measured when the
    fund-raising cluster was added on 2026-09-24: **14,522 of 31,962 events**
    were UNCLASSIFIED, so a scanner built on the new event types would have seen
    almost nothing and the change would have looked applied. Exactly the shape
    of the stage/stage_since repair: fixing the RULE is not fixing the DATA.

    It runs on every pass, which makes the map self-healing — a future DESC_MAP
    addition needs no manual backfill.

    Four properties are load-bearing:

    1. **Only `classified_by='desc_map'` rows are touched.** An `llm` or `human`
       label is a judgement this deterministic lookup must never stomp. No such
       rows exist yet (all 31,962 are `desc_map`), which is precisely when the
       guard is easy to leave out and impossible to notice missing.
    2. **Only rows that are still UNCLASSIFIED.** This re-labels an absence; it
       never revises an answer the map already gave. A changed mapping is a
       deliberate migration, not a side effect of an ingest run.
    3. **Only where the map now has an entry**, so a quiet run writes 0 rows.
    4. **The DATING is never touched** — not `day_0_trade_date`, not
       `disseminated_at`, not `is_result_announcement`, not `board_meeting_id`.
       A reclassification is about the label. Day 0 carries lookahead risk and
       has exactly one implementation (`kd_day_zero_trade_date`); re-deriving it
       here would be a second.
    """
    known = sorted(DESC_MAP.keys())
    if not known:
        return 0
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE km_corporate_events e SET
              family            = m.family,
              event_type        = m.event_type,
              polarity          = m.polarity,
              confidence        = 1.0,
              classifier_version = %s,
              updated_at        = now()
            FROM (SELECT * FROM unnest(%s::text[], %s::text[], %s::text[], %s::text[])
                         AS t(desc_raw, family, event_type, polarity)) m
            WHERE e.desc_raw = m.desc_raw
              AND e.classified_by = 'desc_map'
              AND e.family = %s
        """, (TAXONOMY_VERSION,
              known,
              [DESC_MAP[d][0] for d in known],
              [DESC_MAP[d][1] for d in known],
              [DESC_MAP[d][2] for d in known],
              UNCLASSIFIED))
        return cur.rowcount


def read_material_filings(conn, session) -> dict | None:
    """Queue a read row for every new material event, then read newest-first
    up to the per-pass cap. Returns the reader's counts, or None when the
    reader could not run at all (its rows stay pending — the honest state)."""
    try:
        from lib import filing_reader
        queued = filing_reader.enqueue_pending(conn)
        pruned = filing_reader.prune_pending(conn)
        filing_reader.release_stale_reading(conn)
        stats = filing_reader.read_pending(conn, session=session)
        stats['queued'], stats['pruned'] = queued, pruned
        if stats.get('skipped'):
            log.warning(f'  read: {stats["skipped"]} — {queued} queued, {pruned} pruned, none read')
        else:
            log.info(f'  read: {queued} queued, {pruned} pruned, {stats["read"]} read '
                     f'({stats["done"]} done, {stats["triaged"]} triaged out, '
                     f'{stats["failed"]} failed, {stats["unreadable"]} unreadable, '
                     f'${stats["cost_usd"]:.2f})')
        return stats
    except Exception as e:
        try:
            conn.rollback()
        except Exception:
            pass
        log.error(f'  read step failed (rows stay pending): {e}')
        return None


def run(conn, session, start: date, end: date, dry_run=False) -> dict:
    stats = {'fetched': 0, 'inserted': 0, 'revisions': 0, 'events': 0,
             'calls': 0, 'deferred': 0, 'unresolvable': 0, 'reclassified': 0,
             'reconciled': 0, 'read': None}
    cur = start
    while cur <= end:
        win_end = min(cur + timedelta(days=BACKFILL_WINDOW_DAYS - 1), end)
        rows = fetch_window(session, cur, win_end)
        stats['fetched'] += len(rows)
        stats['calls'] += 1
        log.info(f'  {cur}..{win_end}: {len(rows):,} announcements')
        if not dry_run:
            ins, rev = upsert_raw(conn, rows)
            conn.commit()
            stats['inserted'] += ins
            stats['revisions'] += rev
            log.info(f'    -> {ins:,} new, {rev} revisions')
        cur = win_end + timedelta(days=1)

    if not dry_run:
        (stats['events'], stats['deferred'],
         stats['unresolvable']) = derive_events(conn)
        conn.commit()
        log.info(f'  events derived: {stats["events"]:,}')
        # Self-healing: picks up whatever DESC_MAP learned since these rows were
        # first written. 0 on a run where the map has not changed.
        stats['reclassified'] = reclassify_events(conn)
        conn.commit()
        if stats['reclassified']:
            log.info(f'  {stats["reclassified"]:,} stored events re-labelled '
                     f'from UNCLASSIFIED by taxonomy {TAXONOMY_VERSION}')
        # A PLANNED Day 0 (migration 228) is provisional until its bar lands;
        # this is the pass that makes it right when the calendar was wrong.
        stats['reconciled'] = reconcile_day_zero(conn)
        conn.commit()
        if stats['reconciled']:
            log.info(f'  {stats["reconciled"]:,} event(s) re-dated: the planned '
                     f'Day 0 did not trade, the first bar after it did')
        # THE READ — last step of every pass (owner, 2026-09-28: "extraction +
        # analysis should happen after every data pull"). Newest first, capped
        # per pass, one request in flight; a failure here never fails the
        # ingest, and with no API key the rows simply stay `pending`.
        stats['read'] = read_material_filings(conn, session)
        if stats['deferred']:
            # Normal, and expected to be large on an evening run. Stated plainly
            # so nobody reads a healthy result as a half-failure.
            log.info(f'  {stats["deferred"]:,} deferred — no session could be '
                     f'assigned (a gap inside recorded history, or >15 days '
                     f'without a bar). They are retried on every run.')
        if stats['unresolvable']:
            # Loud on purpose. A silent skip here is how half a stream goes
            # missing without anyone noticing.
            log.warning(f'  ⚠ {stats["unresolvable"]:,} raw rows have NO '
                        f'resolvable ISIN (neither sm_isin nor a symbol match '
                        f'in km_equity_symbols) and produced no event. '
                        f'Inspect: SELECT source_symbol, company_name, desc_raw '
                        f'FROM km_filings_raw WHERE isin IS NULL LIMIT 20;')
    return stats


# ── pipeline2 entry point ────────────────────────────────────────────────
# (rows, status) shape — the bespoke-handler convention compute_dots_for_pipeline
# and compute_wg_for_pipeline use. Bypasses _handle_script entirely: there is no
# single fill-rate column to probe here, and nothing to nullify on force.

def ingest_filings_for_pipeline(conn, trade_date, force: bool = False) -> tuple[int, str]:
    """Fetch recent announcements and derive their events.

    ⚠ `trade_date` IS DELIBERATELY IGNORED as a fetch key. Announcements are a
    continuous stream, not a per-bar fact: a filing disseminated at 22:55 on a
    Monday belongs to Tuesday's session, and several arrive on days that never
    traded at all. So this always sweeps a small trailing WINDOW rather than
    "the announcements for date X", which is not a thing NSE serves.

    The window is deliberately wider than the gap between runs. Re-fetching is
    free — UNIQUE (source, source_ann_id) makes a repeat a no-op in the DB — and
    the cost of a too-narrow window is a filing lost for good.

    Status is 'completed' when anything moved and 'partial' on a quiet sweep, so
    a run that fetched and found nothing new does not read as a failure. A row
    that cannot be dated (a gap inside recorded history) is DEFERRED, not
    failed — it is retried on every pass. Since migration 228 a filing after
    the close is dated to the next PLANNED session at once, and re-dated by
    reconcile_day_zero() if that session turns out not to trade.
    """
    from datetime import date as _date, timedelta as _td
    end = _date.today()
    start = end - _td(days=PIPELINE_WINDOW_DAYS)
    stats = run(conn, NseSession(), start, end, dry_run=False)
    moved = (stats['inserted'] + stats['events'] + stats['reclassified']
             + stats['reconciled'] + ((stats.get('read') or {}).get('done', 0)))
    if stats['deferred']:
        log.info(f'[filings_ingest] {stats["deferred"]} deferred '
                 f'(after the close; awaiting the next session)')
    if stats['unresolvable']:
        log.warning(f'[filings_ingest] {stats["unresolvable"]} rows have no '
                    f'resolvable ISIN and produced no event')
    return moved, ('completed' if moved else 'partial')


def main():
    ap = argparse.ArgumentParser(description='Ingest NSE corporate announcements')
    ap.add_argument('--days', type=int, default=2, help='last N days (default 2)')
    ap.add_argument('--from', dest='dfrom', default=None)
    ap.add_argument('--to', dest='dto', default=None)
    ap.add_argument('--dry-run', action='store_true',
                    help='fetch and report, write nothing')
    ap.add_argument('--reconcile-day0', action='store_true',
                    help='re-derive Day 0 on recent events against the bars '
                         'that now exist and exit — no NSE fetch. The '
                         'scheduled ingest also does it on every pass.')
    ap.add_argument('--reclassify', action='store_true',
                    help='re-label stored UNCLASSIFIED events against the '
                         'current DESC_MAP and exit — no NSE fetch. Run this '
                         'after extending the map; the scheduled ingest also '
                         'does it on every pass.')
    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format='%(message)s')

    if args.reconcile_day0:
        conn = get_conn()
        try:
            n = reconcile_day_zero(conn)
            conn.commit()
            print(f're-dated {n:,} recent event(s) whose planned Day 0 did not trade')
        finally:
            conn.close()
        return

    if args.reclassify:
        conn = get_conn()
        try:
            n = reclassify_events(conn)
            conn.commit()
            print(f're-labelled {n:,} stored events against taxonomy '
                  f'{TAXONOMY_VERSION}')
        finally:
            conn.close()
        return

    end = date.fromisoformat(args.dto) if args.dto else date.today()
    start = (date.fromisoformat(args.dfrom) if args.dfrom
             else end - timedelta(days=args.days))

    print(f'NSE filings ingest  {start} .. {end}'
          f'{"  [DRY RUN]" if args.dry_run else ""}')
    conn = None if args.dry_run else get_conn()
    try:
        stats = run(conn, NseSession(), start, end, args.dry_run)
        print(f'\nfetched {stats["fetched"]:,} in {stats["calls"]} calls  |  '
              f'new {stats["inserted"]:,}  revisions {stats["revisions"]}  '
              f'events {stats["events"]:,}  '
              f'deferred {stats["deferred"]:,}  '
              f'reclassified {stats["reclassified"]:,}  '
              f'reconciled {stats["reconciled"]:,}  '
              f'read {(stats.get("read") or {}).get("done", "-")}  '
              f'unresolvable {stats["unresolvable"]:,}')
    finally:
        if conn:
            conn.close()


if __name__ == '__main__':
    main()
