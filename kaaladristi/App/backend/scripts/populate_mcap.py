"""
populate_mcap.py — One-time script to fill km_equity_symbols.mcap_cr

Pass 1 — NSE: hits NSE quote-equity API per symbol.
  GET https://www.nseindia.com/api/quote-equity?symbol={SYMBOL}
  mcap_cr = securityInfo.issuedSize × priceInfo.lastPrice / 1e7

Pass 2 — BSE: copies mcap_cr from the matching NSE row via ISIN.
  Most BSE stocks are dual-listed, so this covers ~95% instantly.
  BSE-only stocks (no NSE ISIN match) are logged as remaining.

Resumable: skips symbols where mcap_cr IS NOT NULL.
Rate-limited to ~1 req/sec (NSE anti-bot).

Usage (from App/backend/):
  python scripts/populate_mcap.py

  # Dry run (no DB writes):
  python scripts/populate_mcap.py --dry-run

  # Force re-fetch even if already populated:
  python scripts/populate_mcap.py --force

DB connection is read from App/.env (DB_PRIMARY) or App/frontend/.env automatically.
"""

import os
import sys
import time
import random
import argparse
import psycopg2
import psycopg2.extras

# ── Auto-load .env ────────────────────────────────────────────────────────────

_HERE = os.path.dirname(os.path.abspath(__file__))
_BACKEND_DIR = os.path.dirname(_HERE)
_APP_DIR = os.path.dirname(_BACKEND_DIR)

def _load_env():
    try:
        from dotenv import load_dotenv
    except ImportError:
        return  # dotenv not installed — rely on env vars already set
    for candidate in [
        os.path.join(_APP_DIR, '.env'),
        os.path.join(_APP_DIR, 'frontend', '.env'),
        os.path.join(_BACKEND_DIR, '.env'),
    ]:
        if os.path.isfile(candidate):
            load_dotenv(candidate, override=False)

_load_env()

# ── Config ────────────────────────────────────────────────────────────────────

NSE_QUOTE_URL = 'https://www.nseindia.com/api/quote-equity?symbol={symbol}'

RATE_LIMIT_MIN = 0.8   # seconds between requests
RATE_LIMIT_MAX = 1.4
COMMIT_EVERY   = 50    # batch commit size


# ── DB connection ─────────────────────────────────────────────────────────────

def get_conn():
    dsn = (
        os.getenv('DB_PRIMARY', '').strip() or
        os.getenv('DATABASE_URL', '').strip()
    )
    if dsn:
        return psycopg2.connect(dsn)

    password = os.getenv('KD_DB_PASSWORD', '').strip()
    if not password:
        print('ERROR: No DB connection found.')
        print('  Set DB_PRIMARY in App/.env  (e.g. postgresql://postgres:pass@host/dbname)')
        print('  or set KD_DB_PASSWORD env var for the legacy direct-connect mode.')
        sys.exit(1)
    return psycopg2.connect(
        host='187.127.136.65', port=5432,
        dbname='kaala_dristi_db', user='postgres',
        password=password,
    )


# ── NSE Session ───────────────────────────────────────────────────────────────

import requests

_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/131.0.0.0 Safari/537.36'
    ),
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive',
    'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'Referer': 'https://www.nseindia.com/',
}

_session = None


def _init_session():
    global _session
    _session = requests.Session()
    _session.headers.update(_HEADERS)
    for url in [
        'https://www.nseindia.com/api/option-chain-indices?symbol=NIFTY',
        'https://www.nseindia.com/api/marketStatus',
        'https://www.nseindia.com/',
    ]:
        try:
            r = _session.get(url, timeout=30)
            if len(_session.cookies) > 0:
                print(f'  [nse] Session ready ({len(_session.cookies)} cookies from {url})')
                return
        except Exception:
            continue
    print('  [nse] WARNING: no cookies — NSE may block requests')


def fetch_quote(symbol: str) -> dict | None:
    global _session
    if _session is None:
        _init_session()

    url = NSE_QUOTE_URL.format(symbol=symbol)
    for attempt in range(3):
        try:
            r = _session.get(url, timeout=20)
            if r.status_code == 404:
                return None
            if r.status_code == 403:
                print(f'    403 — refreshing session (attempt {attempt+1})')
                _session = None
                _init_session()
                time.sleep(5)
                continue
            r.raise_for_status()
            return r.json()
        except requests.RequestException as e:
            if attempt < 2:
                time.sleep(3 * (attempt + 1))
            else:
                print(f'    FAIL after 3 attempts: {e}')
                return None
    return None


# ── Parser ────────────────────────────────────────────────────────────────────

def extract_mcap(data: dict) -> float | None:
    try:
        price = data.get('priceInfo', {}).get('lastPrice')
        issued = data.get('securityInfo', {}).get('issuedSize')
        if price and issued and float(price) > 0 and int(issued) > 0:
            return round(float(price) * int(issued) / 1e7, 2)
    except (TypeError, ValueError, KeyError):
        pass
    return None


# ── Pass 1: NSE ───────────────────────────────────────────────────────────────

def run_nse_pass(conn, dry_run: bool, force: bool):
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    where = "exchange = 'NSE' AND is_active = true"
    if not force:
        where += ' AND mcap_cr IS NULL'

    cur.execute(f'SELECT id, symbol FROM km_equity_symbols WHERE {where} ORDER BY symbol')
    symbols = cur.fetchall()
    total = len(symbols)
    print(f'\n=== Pass 1: NSE ({total} symbols) ===')

    if total == 0:
        print('  Nothing to do — all NSE symbols already have mcap_cr.')
        return

    done = 0
    skipped = 0
    failed = []
    pending = []

    def flush():
        if dry_run or not pending:
            return
        uc = conn.cursor()
        psycopg2.extras.execute_batch(
            uc,
            'UPDATE km_equity_symbols SET mcap_cr = %s WHERE id = %s',
            pending,
            page_size=200,
        )
        conn.commit()
        pending.clear()

    for i, row in enumerate(symbols, 1):
        sym_id = row['id']
        symbol = row['symbol']
        print(f'  [{i}/{total}] {symbol}', end='', flush=True)

        data = fetch_quote(symbol)
        if data is None:
            print(' — not found on NSE')
            skipped += 1
        else:
            mcap = extract_mcap(data)
            if mcap is None:
                print(' — mcap extract failed')
                failed.append(symbol)
            else:
                print(f' — ₹{mcap:,.1f} Cr')
                done += 1
                pending.append((mcap, sym_id))

        if len(pending) >= COMMIT_EVERY:
            flush()
            print(f'  [db] committed {COMMIT_EVERY} rows')

        time.sleep(random.uniform(RATE_LIMIT_MIN, RATE_LIMIT_MAX))

    flush()
    print(f'\nNSE done: {done} updated, {skipped} not on NSE, {len(failed)} failed')
    if failed:
        print(f'  Failed: {", ".join(failed)}')


# ── Pass 2: BSE via ISIN ──────────────────────────────────────────────────────

def run_bse_pass(conn, dry_run: bool, force: bool):
    """
    Copy mcap_cr from the NSE row to the BSE row for dual-listed stocks.
    Matching key: isin (same company listed on both exchanges).
    BSE-only stocks (no NSE counterpart) are reported as remaining.
    """
    print('\n=== Pass 2: BSE (copy from NSE via ISIN) ===')

    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    where_bse = "mcap_cr IS NULL" if not force else "TRUE"

    # One UPDATE: join BSE rows to NSE rows on ISIN, copy mcap_cr
    sql_update = f"""
        UPDATE km_equity_symbols bse
        SET    mcap_cr = nse.mcap_cr
        FROM   km_equity_symbols nse
        WHERE  bse.exchange = 'BSE'
          AND  bse.is_active = true
          AND  bse.{where_bse}
          AND  nse.exchange  = 'NSE'
          AND  nse.isin      = bse.isin
          AND  nse.isin      IS NOT NULL
          AND  nse.mcap_cr   IS NOT NULL
    """

    if dry_run:
        # Count what would be updated
        sql_count = f"""
            SELECT count(*) AS n
            FROM   km_equity_symbols bse
            JOIN   km_equity_symbols nse ON nse.isin = bse.isin
            WHERE  bse.exchange = 'BSE' AND bse.is_active = true AND bse.{where_bse}
              AND  nse.exchange = 'NSE' AND nse.isin IS NOT NULL AND nse.mcap_cr IS NOT NULL
        """
        cur.execute(sql_count)
        n = cur.fetchone()['n']
        print(f'  [dry-run] Would copy mcap_cr to {n} BSE rows via ISIN match.')
    else:
        cur2 = conn.cursor()
        cur2.execute(sql_update)
        updated = cur2.rowcount
        conn.commit()
        print(f'  Copied mcap_cr to {updated} BSE rows via ISIN match.')

    # Report BSE-only stocks with no ISIN match (truly BSE-only, not dual-listed)
    cur.execute("""
        SELECT count(*) AS n
        FROM   km_equity_symbols bse
        WHERE  bse.exchange  = 'BSE'
          AND  bse.is_active = true
          AND  bse.mcap_cr   IS NULL
          AND  NOT EXISTS (
              SELECT 1 FROM km_equity_symbols nse
              WHERE  nse.exchange = 'NSE'
                AND  nse.isin     = bse.isin
                AND  nse.isin     IS NOT NULL
          )
    """)
    remaining = cur.fetchone()['n']
    if remaining:
        print(f'  {remaining} BSE-only stocks still have no mcap_cr (no NSE ISIN match).')
    else:
        print('  All BSE stocks covered.')


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Populate mcap_cr in km_equity_symbols')
    parser.add_argument('--dry-run', action='store_true', help='Fetch but do not write to DB')
    parser.add_argument('--force', action='store_true', help='Re-fetch even if mcap_cr already set')
    parser.add_argument('--bse-only', action='store_true', help='Skip NSE fetch, run BSE ISIN copy only')
    args = parser.parse_args()

    conn = get_conn()

    if not args.bse_only:
        run_nse_pass(conn, dry_run=args.dry_run, force=args.force)

    run_bse_pass(conn, dry_run=args.dry_run, force=args.force)

    conn.close()
    print('\nAll done.')


if __name__ == '__main__':
    main()
