"""
Backfill ISINs from already-downloaded bhavcopy CSVs
=====================================================
Scans all nse_cm_*.csv files in data/bhav/**/ and extracts SYMBOL→ISIN
mappings, then bulk-updates km_equity_symbols for any rows still NULL.

No network calls. No pipeline run. Just reads local files.

Usage:
    cd App/backend
    python scripts/backfill_isin_from_bhav_files.py
    python scripts/backfill_isin_from_bhav_files.py --verify
"""

import sys
import os
import glob
import csv
import argparse

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL

import psycopg2
import psycopg2.extras


_NSE_BHAV_MAP = {
    'SYMBOL':    'symbol', 'TckrSymb': 'symbol', 'TCKRSYMB': 'symbol',
    'ISIN':      'isin',   'ISIN_CODE': 'isin',  'ISIN NUMBER': 'isin',
}


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(DATABASE_URL, connect_timeout=30)


def find_bhav_files(data_dir: str) -> list[str]:
    pattern = os.path.join(data_dir, '**', 'nse_cm_*.csv')
    files = glob.glob(pattern, recursive=True)
    files.sort()
    return files


def extract_isin_map(csv_files: list[str]) -> dict[str, str]:
    """Returns {SYMBOL: ISIN} from all bhav CSV files. Last file wins."""
    isin_map: dict[str, str] = {}
    for path in csv_files:
        try:
            with open(path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                # Normalize headers
                raw_headers = reader.fieldnames or []
                col_sym  = next((h for h in raw_headers if h.strip() in _NSE_BHAV_MAP and _NSE_BHAV_MAP[h.strip()] == 'symbol'), None)
                col_isin = next((h for h in raw_headers if h.strip() in _NSE_BHAV_MAP and _NSE_BHAV_MAP[h.strip()] == 'isin'), None)
                if not col_sym or not col_isin:
                    continue
                for row in reader:
                    sym  = (row.get(col_sym)  or '').strip().upper()
                    isin = (row.get(col_isin) or '').strip()
                    if sym and isin and isin.startswith('IN'):
                        isin_map[sym] = isin
        except Exception as e:
            print(f'  [warn] Skipping {os.path.basename(path)}: {e}')
    return isin_map


def apply_isin_map(conn, isin_map: dict[str, str], dry_run=False) -> int:
    """Update km_equity_symbols SET isin WHERE symbol matches and isin IS NULL."""
    if not isin_map:
        print('No ISIN data found in bhav files.')
        return 0

    updates = list(isin_map.items())  # [(symbol, isin), ...]
    # Flip to (isin, symbol) for the UPDATE
    pairs = [(isin, sym) for sym, isin in updates]

    if dry_run:
        symbols = list(isin_map.keys())
        with conn.cursor() as cur:
            cur.execute("""
                SELECT COUNT(*) FROM km_equity_symbols
                WHERE exchange = 'NSE' AND isin IS NULL
                  AND UPPER(symbol) = ANY(%s)
            """, [symbols])
            would = cur.fetchone()[0]
        print(f'[dry-run] Would update {would:,} NSE rows from {len(isin_map):,} bhav symbols')
        return would

    with conn.cursor() as cur:
        psycopg2.extras.execute_values(
            cur,
            """
            UPDATE km_equity_symbols s
            SET    isin = data.isin
            FROM   (VALUES %s) AS data(isin, symbol)
            WHERE  UPPER(s.symbol) = UPPER(data.symbol)
              AND  s.exchange       = 'NSE'
              AND  s.isin           IS NULL
            """,
            pairs,
            page_size=1000,
        )
        updated = cur.rowcount
    conn.commit()
    return updated


def report(conn):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT exchange, COUNT(*) total, COUNT(isin) with_isin,
                   COUNT(*) - COUNT(isin) missing,
                   ROUND(COUNT(isin)::numeric/NULLIF(COUNT(*),0)*100,1) pct
            FROM km_equity_symbols GROUP BY exchange ORDER BY exchange
        """)
        rows = cur.fetchall()
    print(f"\n  {'Exchange':<10} {'Total':>7} {'With ISIN':>10} {'Missing':>9} {'%':>6}")
    print(f"  {'-'*10} {'-'*7} {'-'*10} {'-'*9} {'-'*6}")
    for exch, total, with_isin, missing, pct in rows:
        print(f"  {exch:<10} {total:>7,} {with_isin:>10,} {missing:>9,} {pct:>5.1f}%")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data-dir', default=os.path.join(os.path.dirname(__file__), '..', 'data', 'bhav'),
                        help='Path to bhav data directory (default: App/backend/data/bhav)')
    parser.add_argument('--dry-run',  action='store_true', help='Report only, no writes')
    parser.add_argument('--verify',   action='store_true', help='Show fill rates only')
    args = parser.parse_args()

    conn = get_conn()
    try:
        if args.verify:
            report(conn)
            return

        report(conn)

        data_dir = os.path.abspath(args.data_dir)
        print(f'\n[scan] Looking for nse_cm_*.csv in {data_dir}')
        files = find_bhav_files(data_dir)
        print(f'       Found {len(files)} files')
        if not files:
            print('  No bhav files found. Check --data-dir path.')
            return

        print('[extract] Building SYMBOL→ISIN map from all files...')
        isin_map = extract_isin_map(files)
        print(f'          {len(isin_map):,} unique symbols with ISIN')

        print('[update] Writing to km_equity_symbols...')
        updated = apply_isin_map(conn, isin_map, dry_run=args.dry_run)
        print(f'         {updated:,} rows updated')

        if not args.dry_run:
            report(conn)
    finally:
        conn.close()


if __name__ == '__main__':
    main()
