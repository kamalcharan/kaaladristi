"""
NSE bulk / block deals ingest — Sprint 2, the last item
========================================================
    python3 scripts/ingest_nse_bulk_deals.py            # today's published day
    python3 scripts/ingest_nse_bulk_deals.py --dry-run
    python3 scripts/ingest_nse_bulk_deals.py --backfill-day0   # no fetch

`client_name` is the point: the only field in this plan that names the buyer,
which is what makes "a documented institutional buy on a Waking Giants name" a
join rather than a phrase.

⚠ THE CSV IS THE SOURCE AND THE JSON API IS NOT, on measurement rather than
taste. /api/historicalOR/bulk-block-short-deals answers 200 and returned
EXACTLY 70 rows for a 30-day window, a 1-year window, block_deals, and every
single trading day probed. bulk.csv for that same 17-SEP session holds 212.
70 is a page cap that bites on one day, so the API cannot deliver a complete
session and would silently drop two rows in three — a 200 with a plausible
short payload, which is worse than an error.

⚠ NO NATURAL KEY, SO NO UPSERT. The probe found HDFC MUTUAL FUND buying
ASTERDM twice on 19-AUG (two schemes under one AMC name), so (date, symbol,
client, side) collapses real deals; adding qty and price only turns a
correction into a duplicate instead. These are an exchange-published COMPLETE
DAILY REPORT, so idempotency is REPLACE THE DAY inside one transaction. Nothing
is de-duplicated, so an identical pair survives as a pair.

⚠ NO BACKFILL EXISTS. The CSV holds ONE day and the API caps at 70 even for
one. Collection starts from the first run. km_bulk_deal_days records which days
were actually fetched so an un-collected past reads as absent rather than as a
quiet market.
"""

import argparse
import csv
import io
import json
import logging
import os
import sys
from datetime import date, datetime

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from lib.config import DATABASE_URL                        # noqa: E402
from pipeline.utils.nse_session import NseSession          # noqa: E402

log = logging.getLogger(__name__)

REFERER = 'https://www.nseindia.com/report-detail/display-bulk-and-block-deals'
FEEDS = {
    'BULK': 'https://nsearchives.nseindia.com/content/equities/bulk.csv',
    'BLOCK': 'https://nsearchives.nseindia.com/content/equities/block.csv',
}

# The JSON API's page size. Kept as the RECORDED REASON this ingest reads the
# CSV at all — not as a threshold.
#
# ⚠ It was briefly used as one, and that was wrong in both directions. A 212-row
# BULK session is a COMPLETE day; comparing it against a different source's
# limit fired "returned exactly 212 rows — the API page cap" on the first live
# run, which is both a false alarm and self-contradicting (it prints the real
# count as though it were the cap). A warning that fires on every healthy day
# stops being read by the second week, which is how the real one gets missed.
API_PAGE_CAP = 70

# What a cap on the CSV would actually look like: the same count, day after day.
# A real session varies — 212 BULK deals one day, some other number the next —
# so three identical counts in a row is effectively impossible by chance and is
# the one shape worth alarming on. km_bulk_deal_days exists to make it visible.
CAP_SUSPECT_RUN = 3
# ...but only for counts big enough to BE a page size. BLOCK sessions hold
# single digits (4 on 17-SEP), and 4, 4, 4 across three days is ordinary.
CAP_SUSPECT_MIN = 50

# CSV header -> our column. Kept as a map because NSE's headers carry spaces,
# a slash and a full stop ("Trade Price / Wght. Avg. Price") that no amount of
# normalising makes pleasant to match on inline.
COLS = {
    'date': 'Date',
    'symbol': 'Symbol',
    'security_name': 'Security Name',
    'client_name': 'Client Name',
    'buy_sell': 'Buy/Sell',
    'quantity': 'Quantity Traded',
    'price': 'Trade Price / Wght. Avg. Price',
    'remarks': 'Remarks',          # BLOCK has no Remarks column
}


def get_conn():
    import psycopg2
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(DATABASE_URL, connect_timeout=30)


def _d(raw):
    """'17-SEP-2026' or '17-Sep-2026' -> date."""
    for fmt in ('%d-%b-%Y', '%d-%B-%Y'):
        try:
            return datetime.strptime((raw or '').strip(), fmt).date()
        except ValueError:
            continue
    return None


def _num(raw, cast):
    try:
        return cast(str(raw).replace(',', '').strip())
    except (TypeError, ValueError):
        return None


def fetch_feed(session, deal_type: str) -> list[dict]:
    resp = session.get(FEEDS[deal_type], referer=REFERER)
    return list(csv.DictReader(io.StringIO(resp.text or '')))


def parse_rows(raw_rows: list[dict], deal_type: str) -> tuple[list[dict], int]:
    """(rows, unparsable). A row without a date, symbol, client or side cannot
    be stored meaningfully — counted rather than dropped in silence."""
    out, bad = [], 0
    for r in raw_rows:
        d = _d(r.get(COLS['date']))
        sym = (r.get(COLS['symbol']) or '').strip()
        client = (r.get(COLS['client_name']) or '').strip()
        side = (r.get(COLS['buy_sell']) or '').strip().upper()
        # NSE writes BUY/SELL; be liberal about a stray 'B'/'S'.
        side = {'B': 'BUY', 'S': 'SELL'}.get(side, side)
        if not d or not sym or not client or side not in ('BUY', 'SELL'):
            bad += 1
            continue
        out.append({
            'deal_date': d, 'symbol': sym, 'client_name': client,
            'buy_sell': side, 'deal_type': deal_type,
            'security_name': (r.get(COLS['security_name']) or '').strip() or None,
            'quantity': _num(r.get(COLS['quantity']), int),
            'price': _num(r.get(COLS['price']), float),
            'remarks': (r.get(COLS['remarks']) or '').strip() or None,
            'payload': r,
        })
    return out, bad


def replace_day(conn, deal_type: str, deal_date: date, rows: list[dict]) -> int:
    """Swap one session's rows wholesale, in ONE transaction.

    ⚠ The DELETE and the INSERT must not be separated by a commit. Committing
    the delete alone leaves the day empty with nothing to put back, which is
    the failure this repo has already paid for once — see relink in
    ingest_nse_board_meetings.py, where a durable clear and a rolled-back
    restore turned 2,717 verdicts into 2.
    """
    with conn.cursor() as cur:
        cur.execute('DELETE FROM km_bulk_deals WHERE source = %s '
                    'AND deal_type = %s AND deal_date = %s',
                    ('NSE', deal_type, deal_date))
        for r in rows:
            cur.execute("""
                INSERT INTO km_bulk_deals
                  (source, deal_type, deal_date, day_0_trade_date, symbol,
                   security_name, isin, equity_id, client_name, buy_sell,
                   quantity, price, remarks, payload)
                VALUES ('NSE', %s, %s,
                        -- 18:00 IST: after the close, so this resolves to the
                        -- NEXT session. One implementation of that rule,
                        -- shared with the filings ingest.
                        kd_day_zero_trade_date((%s::date + TIME '18:00')
                                                AT TIME ZONE 'Asia/Kolkata'),
                        %s, %s,
                        (SELECT isin FROM km_equity_symbols
                          WHERE symbol = %s AND exchange = 'NSE' AND is_active
                          ORDER BY id LIMIT 1),
                        (SELECT id FROM km_equity_symbols
                          WHERE symbol = %s AND exchange = 'NSE' AND is_active
                          ORDER BY id LIMIT 1),
                        %s, %s, %s, %s, %s, %s)
            """, (deal_type, r['deal_date'], r['deal_date'], r['symbol'],
                  r['security_name'], r['symbol'], r['symbol'],
                  r['client_name'], r['buy_sell'], r['quantity'], r['price'],
                  r['remarks'], json.dumps(r['payload'], default=str)))

        cur.execute("""
            INSERT INTO km_bulk_deal_days
                   (source, deal_type, deal_date, row_count, fetched_at)
            VALUES ('NSE', %s, %s, %s, now())
            ON CONFLICT (source, deal_type, deal_date) DO UPDATE
               SET row_count = EXCLUDED.row_count, fetched_at = now()
        """, (deal_type, deal_date, len(rows)))
    conn.commit()
    return len(rows)


def backfill_day0(conn) -> int:
    """Fill day_0 for rows ingested before their next session existed.

    Same deferral as the filings ingest: a deal published after Friday's close
    has no Day 0 until Monday's bar lands. Selecting on 'still NULL' means a
    later run picks them up with no bookkeeping.
    """
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE km_bulk_deals
               SET day_0_trade_date =
                   kd_day_zero_trade_date((deal_date + TIME '18:00')
                                           AT TIME ZONE 'Asia/Kolkata')
             WHERE day_0_trade_date IS NULL
        """)
        n = cur.rowcount
    conn.commit()
    return n


def unresolved_count(conn) -> int:
    with conn.cursor() as cur:
        cur.execute('SELECT count(*) FROM km_bulk_deals WHERE isin IS NULL')
        return cur.fetchone()[0]


def run(conn, session, dry_run=False) -> dict:
    stats = {'fetched': 0, 'stored': 0, 'unparsable': 0, 'days': [],
             'deferred': 0, 'unresolvable': 0, 'at_cap': []}
    for deal_type in FEEDS:
        raw = fetch_feed(session, deal_type)
        rows, bad = parse_rows(raw, deal_type)
        stats['fetched'] += len(raw)
        stats['unparsable'] += bad
        if bad:
            log.warning(f'  ⚠ {deal_type}: {bad} rows missing a date, symbol, '
                        f'client or side — not stored')
        if not rows:
            log.info(f'  {deal_type}: no parsable rows')
            continue

        by_day: dict[date, list[dict]] = {}
        for r in rows:
            by_day.setdefault(r['deal_date'], []).append(r)
        for d, drows in sorted(by_day.items()):
            log.info(f'  {deal_type} {d}: {len(drows)} deals')
            stats['days'].append((deal_type, str(d), len(drows)))
            if not dry_run:
                stats['stored'] += replace_day(conn, deal_type, d, drows)

    if not dry_run:
        for deal_type in FEEDS:
            flat = paging_suspected(conn, deal_type)
            if flat:
                stats['at_cap'].append((deal_type, flat[0], flat[1]))
        stats['deferred'] = backfill_day0(conn)
        stats['unresolvable'] = unresolved_count(conn)
        if stats['unresolvable']:
            # Loud on purpose. A silently skipped symbol is how half a stream
            # goes missing with nothing to show for it.
            log.warning(f'  ⚠ {stats["unresolvable"]:,} rows have no ISIN '
                        f'(symbol not in km_equity_symbols). Inspect: SELECT '
                        f'DISTINCT symbol FROM km_bulk_deals WHERE isin IS NULL;')
    for dt, since, n in stats['at_cap']:
        log.warning(f'  ⚠ {dt}: the last {CAP_SUSPECT_RUN} sessions each hold '
                    f'EXACTLY {n} rows (since {since}). Real sessions vary, so '
                    f'this is what a page limit looks like — treat those days '
                    f'as possibly truncated and check the raw CSV.')
    return stats


def paging_suspected(conn, deal_type: str):
    """(since_date, count) when the last CAP_SUSPECT_RUN sessions share one
    row_count, else None.

    This is the check the first version got wrong by measuring the CSV against
    the JSON API's 70. A source that has started paging does not announce it —
    it just returns the same number every day, which only the stored history
    can show. Hence km_bulk_deal_days.
    """
    with conn.cursor() as cur:
        cur.execute("""
            SELECT deal_date, row_count FROM km_bulk_deal_days
             WHERE source = 'NSE' AND deal_type = %s
             ORDER BY deal_date DESC LIMIT %s
        """, (deal_type, CAP_SUSPECT_RUN))
        rows = cur.fetchall()
    if len(rows) < CAP_SUSPECT_RUN:
        return None                       # not enough history to say anything
    counts = {r[1] for r in rows}
    if len(counts) == 1 and rows[0][1] >= CAP_SUSPECT_MIN:
        return str(rows[-1][0]), rows[0][1]
    return None


# ── pipeline2 entry point ────────────────────────────────────────────────

def ingest_bulk_deals_for_pipeline(conn, trade_date, force: bool = False):
    """(rows, status). `trade_date` is ignored: the archive serves whatever
    session it currently publishes, not a session we choose."""
    stats = run(conn, NseSession(), dry_run=False)
    return stats['stored'], ('completed' if stats['stored'] else 'partial')


def main():
    ap = argparse.ArgumentParser(description='Ingest NSE bulk/block deals')
    ap.add_argument('--dry-run', action='store_true',
                    help='fetch and report, write nothing')
    ap.add_argument('--backfill-day0', action='store_true',
                    help='fill Day 0 on rows whose next session now exists; '
                         'no fetch')
    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format='%(message)s')

    if args.backfill_day0:
        conn = get_conn()
        try:
            print(f'day_0 filled on {backfill_day0(conn):,} rows')
        finally:
            conn.close()
        return

    print('NSE bulk / block deals' + ('  [DRY RUN]' if args.dry_run else ''))
    conn = None if args.dry_run else get_conn()
    try:
        s = run(conn, NseSession(), args.dry_run)
        print(f'\nfetched {s["fetched"]:,}  stored {s["stored"]:,}  '
              f'unparsable {s["unparsable"]:,}')
        for dt, d, n in s['days']:
            print(f'  {dt:<6} {d}  {n:,}')
        if not args.dry_run:
            print(f'day_0 filled {s["deferred"]:,}  |  '
                  f'no ISIN {s["unresolvable"]:,}')
    finally:
        if conn:
            conn.close()


if __name__ == '__main__':
    main()
