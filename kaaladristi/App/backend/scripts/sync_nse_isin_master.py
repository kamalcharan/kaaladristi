"""
NSE ISIN Master Sync
====================
Downloads NSE EQUITY_L.csv and populates missing ISINs in km_equity_symbols.
Also cross-patches NSE ↔ BSE rows that share the same company_name.

Steps (all reported):
  1. Diagnostic — current ISIN fill rates by exchange
  2. Cross-exchange patch — BSE isin → NSE row (or NSE isin → BSE row)
     where company_name matches exactly
  3. NSE master download — EQUITY_L.csv from NSE archives
  4. Symbol-based update — any NSE row with a matching SYMBOL in the master
  5. Final diagnostic — fill rates after all fixes

Usage:
    cd App/backend

    # Full run (patch + download + update + report)
    python scripts/sync_nse_isin_master.py

    # Dry-run — report what would change, no writes
    python scripts/sync_nse_isin_master.py --dry-run

    # Diagnostics only, no writes
    python scripts/sync_nse_isin_master.py --diagnose

    # Skip the NSE master download (cross-exchange patch only)
    python scripts/sync_nse_isin_master.py --no-download
"""

import sys
import os
import argparse
import io
import time

import psycopg2
import psycopg2.extras
import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL

NSE_EQUITY_L_URL = (
    'https://archives.nseindia.com/content/equities/EQUITY_L.csv'
)
_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/124.0.0.0 Safari/537.36'
    ),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Referer': 'https://www.nseindia.com/',
}


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(DATABASE_URL, connect_timeout=30)


# ── Step 1: Diagnostics ────────────────────────────────────────────────────

def report_fill_rates(conn, label='current'):
    print(f'\n[{label}] ISIN fill rates by exchange:')
    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                exchange,
                COUNT(*)                              AS total,
                COUNT(isin)                           AS with_isin,
                COUNT(*) - COUNT(isin)                AS missing_isin,
                ROUND(
                    COUNT(isin)::numeric /
                    NULLIF(COUNT(*), 0)::numeric * 100, 1
                )                                     AS pct_filled
            FROM km_equity_symbols
            GROUP BY exchange
            ORDER BY exchange
        """)
        rows = cur.fetchall()
        print(f"  {'Exchange':<10} {'Total':>7} {'With ISIN':>10} "
              f"{'Missing':>9} {'% Filled':>10}")
        print(f"  {'-'*10} {'-'*7} {'-'*10} {'-'*9} {'-'*10}")
        for exchange, total, with_isin, missing, pct in rows:
            print(f"  {exchange:<10} {total:>7,} {with_isin:>10,} "
                  f"{missing:>9,} {pct:>9.1f}%")
    return rows


def report_sample_null_nse(conn, limit=20):
    print(f'\n[diagnose] Sample NSE stocks with NULL ISIN (up to {limit}):')
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, symbol, company_name, exchange, isin
            FROM km_equity_symbols
            WHERE exchange = 'NSE' AND isin IS NULL
            ORDER BY symbol
            LIMIT %s
        """, [limit])
        rows = cur.fetchall()
        if not rows:
            print('  ✓ No NSE stocks with NULL ISIN.')
        for row in rows:
            print(f"  id={row[0]}  {row[1]:<20}  {row[2][:40]}")
    return rows


def report_cross_match_sample(conn, limit=20):
    """NSE rows with null isin that can be matched via BSE company_name."""
    print(f'\n[diagnose] NSE nulls matchable via BSE company_name (up to {limit}):')
    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                n.symbol  AS nse_symbol,
                n.company_name,
                n.isin    AS nse_isin,
                b.symbol  AS bse_symbol,
                b.isin    AS bse_isin
            FROM km_equity_symbols n
            JOIN km_equity_symbols b
                ON LOWER(TRIM(n.company_name)) = LOWER(TRIM(b.company_name))
               AND n.exchange = 'NSE'
               AND b.exchange = 'BSE'
            WHERE n.isin IS NULL
              AND b.isin IS NOT NULL
            LIMIT %s
        """, [limit])
        rows = cur.fetchall()
        if not rows:
            print('  (none found)')
        for r in rows:
            print(f"  NSE {r[0]:<20} ← BSE {r[1]:<10}  isin={r[4]}")
    return rows


# ── Step 2: Cross-exchange patch ───────────────────────────────────────────

def patch_cross_exchange(conn, dry_run=False):
    """
    Two-way patch using exact company_name match:
      A. NSE row has NULL isin → copy from BSE peer
      B. BSE row has NULL isin → copy from NSE peer
    """
    results = {}

    # A: NSE ← BSE
    sql_nse_from_bse = """
        UPDATE km_equity_symbols n
        SET    isin = b.isin
        FROM   km_equity_symbols b
        WHERE  n.exchange = 'NSE'
          AND  n.isin     IS NULL
          AND  b.exchange = 'BSE'
          AND  b.isin     IS NOT NULL
          AND  LOWER(TRIM(n.company_name)) = LOWER(TRIM(b.company_name))
    """
    # B: BSE ← NSE
    sql_bse_from_nse = """
        UPDATE km_equity_symbols b
        SET    isin = n.isin
        FROM   km_equity_symbols n
        WHERE  b.exchange = 'BSE'
          AND  b.isin     IS NULL
          AND  n.exchange = 'NSE'
          AND  n.isin     IS NOT NULL
          AND  LOWER(TRIM(n.company_name)) = LOWER(TRIM(b.company_name))
    """

    with conn.cursor() as cur:
        if dry_run:
            cur.execute("""
                SELECT COUNT(*) FROM km_equity_symbols n
                JOIN km_equity_symbols b
                    ON LOWER(TRIM(n.company_name)) = LOWER(TRIM(b.company_name))
                   AND n.exchange = 'NSE' AND b.exchange = 'BSE'
                WHERE n.isin IS NULL AND b.isin IS NOT NULL
            """)
            results['nse_from_bse'] = cur.fetchone()[0]
            cur.execute("""
                SELECT COUNT(*) FROM km_equity_symbols b
                JOIN km_equity_symbols n
                    ON LOWER(TRIM(n.company_name)) = LOWER(TRIM(b.company_name))
                   AND n.exchange = 'NSE' AND b.exchange = 'BSE'
                WHERE b.isin IS NULL AND n.isin IS NOT NULL
            """)
            results['bse_from_nse'] = cur.fetchone()[0]
            print(f'\n[cross-patch DRY-RUN]')
            print(f"  Would update {results['nse_from_bse']:,} NSE rows from BSE")
            print(f"  Would update {results['bse_from_nse']:,} BSE rows from NSE")
        else:
            cur.execute(sql_nse_from_bse)
            results['nse_from_bse'] = cur.rowcount
            cur.execute(sql_bse_from_nse)
            results['bse_from_nse'] = cur.rowcount
        conn.commit()
        print(f'\n[cross-patch]')
        print(f"  NSE rows updated from BSE: {results['nse_from_bse']:,}")
        print(f"  BSE rows updated from NSE: {results['bse_from_nse']:,}")
    return results


# ── Step 3+4: NSE master download + symbol update ─────────────────────────

def download_equity_l():
    """Download NSE EQUITY_L.csv. Returns list of dicts with symbol/isin/company_name."""
    print(f'\n[nse-master] Downloading {NSE_EQUITY_L_URL} ...')
    t0 = time.time()

    # Use a session with NSE-friendly headers
    session = requests.Session()
    # Hit the NSE homepage first to get a valid cookie
    try:
        session.get('https://www.nseindia.com/', headers=_HEADERS, timeout=15)
    except Exception:
        pass  # non-fatal — proceed without cookie

    r = session.get(NSE_EQUITY_L_URL, headers=_HEADERS, timeout=30)
    r.raise_for_status()
    elapsed = time.time() - t0

    # Parse CSV — handle BOM and strip whitespace from headers
    text = r.content.decode('utf-8-sig')
    lines = text.strip().splitlines()
    raw_headers = [h.strip() for h in lines[0].split(',')]

    # Locate required columns (NSE header varies slightly over time)
    col_map = {}
    for i, h in enumerate(raw_headers):
        hu = h.upper()
        if hu == 'SYMBOL':
            col_map['symbol'] = i
        elif 'ISIN' in hu:
            col_map['isin'] = i
        elif 'NAME' in hu or 'COMPANY' in hu:
            col_map['company_name'] = i

    missing_cols = [c for c in ('symbol', 'isin') if c not in col_map]
    if missing_cols:
        raise ValueError(
            f'EQUITY_L.csv missing expected columns: {missing_cols}. '
            f'Got headers: {raw_headers}'
        )

    records = []
    for line in lines[1:]:
        parts = [p.strip() for p in line.split(',')]
        if len(parts) <= max(col_map.values()):
            continue
        symbol = parts[col_map['symbol']].strip()
        isin   = parts[col_map['isin']].strip()
        cname  = parts[col_map.get('company_name', 0)].strip() if 'company_name' in col_map else ''
        if symbol and isin and isin.startswith('IN'):
            records.append({'symbol': symbol, 'isin': isin, 'company_name': cname})

    print(f'  Downloaded {len(records):,} records in {elapsed:.1f}s')
    return records


def apply_nse_master(conn, records, dry_run=False):
    """
    For each record in EQUITY_L:
      UPDATE km_equity_symbols SET isin = %s WHERE symbol = %s
        AND exchange = 'NSE' AND (isin IS NULL OR isin != %s)
    """
    if not records:
        print('\n[nse-master] No records to apply.')
        return 0

    if dry_run:
        with conn.cursor() as cur:
            symbols = [r['symbol'] for r in records]
            cur.execute("""
                SELECT COUNT(*) FROM km_equity_symbols
                WHERE exchange = 'NSE'
                  AND symbol = ANY(%s)
                  AND isin IS NULL
            """, [symbols])
            would_update = cur.fetchone()[0]
        print(f'\n[nse-master DRY-RUN] Would update {would_update:,} NSE rows from master')
        return would_update

    # Build update list
    updates = [(r['isin'], r['symbol']) for r in records]
    updated_total = 0

    with conn.cursor() as cur:
        # Update isin where NULL
        psycopg2.extras.execute_values(
            cur,
            """
            UPDATE km_equity_symbols s
            SET isin = data.isin
            FROM (VALUES %s) AS data(isin, symbol)
            WHERE s.symbol   = data.symbol
              AND s.exchange  = 'NSE'
              AND s.isin      IS NULL
            """,
            updates,
            page_size=500,
        )
        updated_null = cur.rowcount

        # Update isin where it differs (data correction)
        psycopg2.extras.execute_values(
            cur,
            """
            UPDATE km_equity_symbols s
            SET isin = data.isin
            FROM (VALUES %s) AS data(isin, symbol)
            WHERE s.symbol   = data.symbol
              AND s.exchange  = 'NSE'
              AND s.isin      IS NOT NULL
              AND s.isin      != data.isin
            """,
            updates,
            page_size=500,
        )
        updated_changed = cur.rowcount

    conn.commit()
    updated_total = updated_null + updated_changed
    print(f'\n[nse-master]')
    print(f'  Rows updated (was NULL):    {updated_null:,}')
    print(f'  Rows updated (isin changed): {updated_changed:,}')
    print(f'  Total:                       {updated_total:,}')
    return updated_total


# ── Step 5: Stage 2 dedup check ───────────────────────────────────────────

def report_stage2_dedup(conn):
    print('\n[verify] Stage 2 dedup — distinct companies:')
    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                MAX(e.trade_date) AS latest_date,
                COUNT(*)                                     AS raw_s2_rows,
                COUNT(DISTINCT COALESCE(s.isin, s.symbol))  AS deduped_companies,
                COUNT(*) FILTER (WHERE s.isin IS NOT NULL)  AS rows_with_isin,
                COUNT(*) FILTER (WHERE s.isin IS NULL)      AS rows_null_isin
            FROM km_equity_eod e
            JOIN km_equity_symbols s ON e.equity_id = s.id
            WHERE e.trade_date = (SELECT MAX(trade_date) FROM km_equity_eod)
              AND e.stage = 'S2'
        """)
        row = cur.fetchone()
        if row:
            dt, raw, deduped, with_isin, null_isin = row
            print(f'  Latest trade_date : {dt}')
            print(f'  Raw S2 rows       : {raw:,}')
            print(f'  Deduped companies : {deduped:,}')
            print(f'  Rows with ISIN    : {with_isin:,}')
            print(f'  Rows null ISIN    : {null_isin:,}')
            if null_isin:
                # Show samples
                cur.execute("""
                    SELECT s.symbol, s.exchange, s.company_name
                    FROM km_equity_eod e
                    JOIN km_equity_symbols s ON e.equity_id = s.id
                    WHERE e.trade_date = (SELECT MAX(trade_date) FROM km_equity_eod)
                      AND e.stage = 'S2'
                      AND s.isin IS NULL
                    ORDER BY s.exchange, s.symbol
                    LIMIT 10
                """)
                leftovers = cur.fetchall()
                print(f'\n  Still null-isin S2 samples (up to 10):')
                for sym, exch, cname in leftovers:
                    print(f'    {exch:<4} {sym:<20} {cname[:40]}')


# ── Pipeline entry point ───────────────────────────────────────────────────

def sync_nse_isin_master(verbose=False):
    """
    Called from daily_pipeline.py.
    Downloads EQUITY_L.csv and updates any changed/missing ISINs.
    Returns count of rows updated.
    """
    conn = get_conn()
    try:
        # Cross-patch first (fast, no network)
        cross = patch_cross_exchange(conn, dry_run=False)
        cross_total = cross['nse_from_bse'] + cross['bse_from_nse']

        # Then NSE master
        try:
            records = download_equity_l()
            master_total = apply_nse_master(conn, records, dry_run=False)
        except Exception as e:
            print(f'  [nse-master] Download failed: {e} — skipping master sync')
            master_total = 0

        return cross_total + master_total
    finally:
        conn.close()


# ── CLI ───────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run',    action='store_true', help='Report what would change, no writes')
    parser.add_argument('--diagnose',   action='store_true', help='Diagnostics only, no writes')
    parser.add_argument('--no-download', action='store_true', help='Skip NSE master download')
    args = parser.parse_args()

    conn = get_conn()
    try:
        # ── Step 1: Current state ──
        report_fill_rates(conn, label='before')
        report_sample_null_nse(conn)
        report_cross_match_sample(conn)

        if args.diagnose:
            return

        # ── Step 2: Cross-exchange patch ──
        patch_cross_exchange(conn, dry_run=args.dry_run)

        # ── Step 3+4: NSE master ──
        if not args.no_download:
            try:
                records = download_equity_l()
                apply_nse_master(conn, records, dry_run=args.dry_run)
            except Exception as e:
                print(f'\n[nse-master] ERROR: {e}')
                print('  Continuing without master download.')

        # ── Step 5: Final state ──
        if not args.dry_run:
            report_fill_rates(conn, label='after')
            report_stage2_dedup(conn)

    finally:
        conn.close()


if __name__ == '__main__':
    main()
