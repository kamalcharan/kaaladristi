"""
listing_date Backfill Script (Waking Giants / First Ascent Layer 0)
====================================================================
Fills km_equity_symbols.listing_date from NSE's official securities
master EQUITY_L.csv (" DATE OF LISTING" column). Only NULL rows are
touched — existing dates are never overwritten.

Match order per CSV row:
  1. ISIN  (authoritative — survives symbol changes)
  2. symbol + exchange='NSE'  (fallback for rows without ISIN in our DB)

BSE-only listings are NOT covered by EQUITY_L.csv; their listing_date
stays NULL and both age-gated scanners are NSE-only anyway (audit §7).

After updating, prints the active-NSE age-band distribution — the
ground truth for the Waking Giants (10y+) and First Ascent (6–10y)
universes.

Usage:
    cd App/backend
    python scripts/backfill_listing_dates.py             # download + update
    python scripts/backfill_listing_dates.py --dry-run   # report only, no writes
    python scripts/backfill_listing_dates.py --csv path  # use a local EQUITY_L.csv
"""

import csv
import io
import os
import sys
from datetime import datetime

import psycopg2
import psycopg2.extras
import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL

EQUITY_L_URL = 'https://archives.nseindia.com/content/equities/EQUITY_L.csv'
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/csv,*/*',
}


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(DATABASE_URL, connect_timeout=30)


def fetch_csv(local_path: str | None) -> str:
    if local_path:
        with open(local_path, 'r', encoding='utf-8-sig') as f:
            return f.read()
    # archives.nseindia.com serves static files without the anti-bot
    # cookie dance the API endpoints need. If this ever starts 403ing,
    # download EQUITY_L.csv in a browser and re-run with --csv <path>.
    resp = requests.get(EQUITY_L_URL, headers=HEADERS, timeout=60)
    resp.raise_for_status()
    return resp.content.decode('utf-8-sig')


def parse_rows(text: str) -> list[dict]:
    """Yield {symbol, isin, listing_date} from EQUITY_L.csv.

    NSE's header names carry stray spaces (' DATE OF LISTING'); match
    by normalized name. Date format: DD-MON-YYYY (e.g. 08-JUL-2002).
    """
    reader = csv.reader(io.StringIO(text))
    header = next(reader)
    norm = [h.strip().upper() for h in header]

    def col(name: str) -> int:
        return norm.index(name)

    i_sym = col('SYMBOL')
    i_isin = col('ISIN NUMBER')
    i_date = col('DATE OF LISTING')
    i_series = col('SERIES') if 'SERIES' in norm else None

    out = []
    for row in reader:
        if not row or len(row) <= max(i_sym, i_isin, i_date):
            continue
        # EQ/BE/BZ are the cash-equity series; skip GB/GS bonds etc.
        if i_series is not None and row[i_series].strip() not in ('EQ', 'BE', 'BZ', 'SM', 'ST'):
            continue
        raw = row[i_date].strip()
        try:
            dt = datetime.strptime(raw, '%d-%b-%Y').date()
        except ValueError:
            continue
        out.append({
            'symbol': row[i_sym].strip(),
            'isin': row[i_isin].strip(),
            'listing_date': dt,
        })
    return out


def run(dry_run: bool, local_csv: str | None):
    print(f'Fetching EQUITY_L.csv{" (local)" if local_csv else ""}…')
    rows = parse_rows(fetch_csv(local_csv))
    print(f'  {len(rows)} listing rows parsed')

    conn = get_conn()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur.execute("""
        SELECT id, symbol, isin, exchange
        FROM km_equity_symbols
        WHERE listing_date IS NULL
    """)
    missing = cur.fetchall()
    print(f'  {len(missing)} km_equity_symbols rows missing listing_date')

    by_isin = {r['isin']: r['listing_date'] for r in rows if r['isin']}
    by_symbol = {r['symbol']: r['listing_date'] for r in rows}

    updates = []          # (listing_date, id)
    matched_isin = matched_symbol = 0
    for m in missing:
        dt = by_isin.get(m['isin']) if m['isin'] else None
        if dt is not None:
            matched_isin += 1
        elif m['exchange'] == 'NSE':
            dt = by_symbol.get(m['symbol'])
            if dt is not None:
                matched_symbol += 1
        if dt is not None:
            updates.append((dt, m['id']))

    print(f'  matches: {matched_isin} by ISIN + {matched_symbol} by NSE symbol '
          f'= {len(updates)} rows to fill '
          f'({len(missing) - len(updates)} unmatched — mostly BSE-only)')

    if not dry_run and updates:
        psycopg2.extras.execute_batch(
            cur,
            'UPDATE km_equity_symbols SET listing_date = %s WHERE id = %s AND listing_date IS NULL',
            updates,
            page_size=1000,
        )
        conn.commit()
        print(f'  ✓ {len(updates)} rows updated')
    elif dry_run:
        print('  (dry run — nothing written)')

    # ── Age-band distribution: the WG / First Ascent universe truth ──
    cur.execute("""
        SELECT
          CASE
            WHEN age_yr >= 20 THEN '20y+          (Waking Giants · veteran)'
            WHEN age_yr >= 10 THEN '10-20y        (Waking Giants)'
            WHEN age_yr >= 6  THEN '6-10y         (First Ascent)'
            WHEN age_yr >= 3  THEN '3-6y'
            ELSE '<3y'
          END AS band,
          COUNT(*) AS stocks,
          MIN(age_yr)::int AS sort_key
        FROM (
          SELECT EXTRACT(YEAR FROM AGE(CURRENT_DATE, listing_date)) AS age_yr
          FROM km_equity_symbols
          WHERE is_active AND exchange = 'NSE' AND listing_date IS NOT NULL
        ) t
        GROUP BY 1 ORDER BY 3 DESC
    """)
    print(f"\nActive NSE age-band distribution ({'UNCHANGED — dry run' if dry_run else 'post-backfill'}):")
    for r in cur.fetchall():
        print(f"  {r['band']:<42} {r['stocks']:>5}")

    cur.execute("""
        SELECT COUNT(*) AS still_null
        FROM km_equity_symbols
        WHERE is_active AND exchange = 'NSE' AND listing_date IS NULL
    """)
    print(f"\nActive NSE still missing listing_date: {cur.fetchone()['still_null']}")
    conn.close()


if __name__ == '__main__':
    dry = '--dry-run' in sys.argv
    local = None
    if '--csv' in sys.argv:
        local = sys.argv[sys.argv.index('--csv') + 1]
    run(dry, local)
