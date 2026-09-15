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
from lib.filing_taxonomy import classify_desc            # noqa: E402
from pipeline.utils.nse_session import NseSession        # noqa: E402

log = logging.getLogger(__name__)

ANN_URL = 'https://www.nseindia.com/api/corporate-announcements'
ANN_REFERER = ('https://www.nseindia.com/companies-listing/'
               'corporate-filings-announcements')
BACKFILL_WINDOW_DAYS = 90      # measured safe to 180; 90 keeps each call ~5s
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

    ⚠ DEFERRED IS NOT AN ERROR, AND MUST NOT BE COUNTED AS ONE. Measured on the
    first two live runs: 287 of 582 rows produced no event, every one of them
    disseminated between 15:30:11 and 22:55 on the latest bar in km_equity_eod.
    kd_day_zero_trade_date returns NULL for those because the NEXT session does
    not exist yet — you cannot assign a Day 0 that has not happened. That is the
    lookahead guard working, not a failure, and those rows classify themselves
    on the next pass once tomorrow's bar lands.

    Roughly half of every evening run will be deferred, because filings cluster
    after the close. A report that does not distinguish deferred from broken
    makes a healthy run look like a half-failed one — and would train whoever
    reads it to ignore the number.

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
                        %s,%s,%s,%s,%s,%s,%s,'desc_map','v1',%s,%s,ARRAY[%s])
                ON CONFLICT (primary_raw_id) DO NOTHING
            """, (isin, equity_id, isin, name, diss, day0, family, event_type,
                  polarity, desc_raw, conf, raw_id, raw_id))
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


def run(conn, session, start: date, end: date, dry_run=False) -> dict:
    stats = {'fetched': 0, 'inserted': 0, 'revisions': 0, 'events': 0,
             'calls': 0, 'deferred': 0, 'unresolvable': 0}
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
        if stats['deferred']:
            # Normal, and expected to be large on an evening run. Stated plainly
            # so nobody reads a healthy result as a half-failure.
            log.info(f'  {stats["deferred"]:,} deferred — disseminated after '
                     f'the close, waiting on the next session to exist. They '
                     f'classify on the next run; nothing is lost.')
        if stats['unresolvable']:
            # Loud on purpose. A silent skip here is how half a stream goes
            # missing without anyone noticing.
            log.warning(f'  ⚠ {stats["unresolvable"]:,} raw rows have NO '
                        f'resolvable ISIN (neither sm_isin nor a symbol match '
                        f'in km_equity_symbols) and produced no event. '
                        f'Inspect: SELECT source_symbol, company_name, desc_raw '
                        f'FROM km_filings_raw WHERE isin IS NULL LIMIT 20;')
    return stats


def main():
    ap = argparse.ArgumentParser(description='Ingest NSE corporate announcements')
    ap.add_argument('--days', type=int, default=2, help='last N days (default 2)')
    ap.add_argument('--from', dest='dfrom', default=None)
    ap.add_argument('--to', dest='dto', default=None)
    ap.add_argument('--dry-run', action='store_true',
                    help='fetch and report, write nothing')
    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format='%(message)s')

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
              f'unresolvable {stats["unresolvable"]:,}')
    finally:
        if conn:
            conn.close()


if __name__ == '__main__':
    main()
