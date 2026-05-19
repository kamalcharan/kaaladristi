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

  # Skip NSE pass, just copy BSE via ISIN:
  python scripts/populate_mcap.py --bse-only

  # Print actual field values on every extraction failure:
  python scripts/populate_mcap.py --debug

  # Full BSE diagnostics (isin coverage on both sides, join count):
  python scripts/populate_mcap.py --bse-diag

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
        return
    for candidate in [
        os.path.join(_APP_DIR, '.env'),
        os.path.join(_APP_DIR, 'frontend', '.env'),
        os.path.join(_BACKEND_DIR, '.env'),
    ]:
        if os.path.isfile(candidate):
            load_dotenv(candidate, override=False)

_load_env()

# ── Config ────────────────────────────────────────────────────────────────────

NSE_QUOTE_BASE   = 'https://www.nseindia.com/api/quote-equity'

RATE_LIMIT_MIN   = 1.2
RATE_LIMIT_MAX   = 2.0
COMMIT_EVERY     = 50
COOLDOWN_AFTER   = 3
COOLDOWN_SECONDS = 45


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
from requests.exceptions import Timeout, ConnectionError as ReqConnError

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
                print(f'  [nse] Session ready ({len(_session.cookies)} cookies)')
                return
        except Exception:
            continue
    print('  [nse] WARNING: no cookies obtained')


def _reset_session(wait: float = 0):
    global _session
    _session = None
    if wait:
        print(f'  [nse] Cooling down {wait:.0f}s...', flush=True)
        time.sleep(wait)
    _init_session()
    time.sleep(3)


def fetch_quote(symbol: str):
    """
    Returns:
      dict   — valid quote response
      None   — symbol not found / NSE server error (skip, don't penalise)
      'FAIL' — network/session failure (counts toward consecutive_fails)
    """
    global _session
    if _session is None:
        _init_session()

    url = NSE_QUOTE_BASE
    params = {'symbol': symbol}

    for attempt in range(4):
        try:
            r = _session.get(url, params=params, timeout=25)

            if r.status_code == 404:
                return None

            if r.status_code in (403, 429):
                wait = 15 + attempt * 10
                print(f' {r.status_code} — refreshing session (wait {wait}s)', end='', flush=True)
                _reset_session(wait=wait)
                continue

            r.raise_for_status()
            data = r.json()

            if 'error' in data and 'message' in data and 'priceInfo' not in data:
                return None

            return data

        except (Timeout, ReqConnError):
            wait = 20 + attempt * 15
            print(f' timeout — refreshing session (wait {wait}s)', end='', flush=True)
            _reset_session(wait=wait)

        except requests.RequestException as e:
            if attempt < 3:
                time.sleep(5 * (attempt + 1))
            else:
                print(f'    FAIL: {e}')
                return 'FAIL'

    print(f'    FAIL after 4 attempts')
    return 'FAIL'


# ── Parser ────────────────────────────────────────────────────────────────────

def _val(d: dict, *keys):
    for k in keys:
        if not isinstance(d, dict):
            return None
        d = d.get(k)
    return d


def _to_float(v) -> float | None:
    if v is None:
        return None
    try:
        f = float(str(v).replace(',', ''))
        return f if f > 0 else None
    except (ValueError, TypeError):
        return None


def extract_mcap(data: dict, symbol: str = '', debug: bool = False) -> float | None:
    price = (
        _to_float(_val(data, 'priceInfo', 'lastPrice')) or
        _to_float(_val(data, 'priceInfo', 'previousClose')) or
        _to_float(_val(data, 'priceInfo', 'close'))
    )
    issued = (
        _to_float(_val(data, 'securityInfo', 'issuedSize')) or
        _to_float(_val(data, 'securityInfo', 'issuedCap'))
    )

    if price and issued:
        return round(price * issued / 1e7, 2)

    if debug:
        lp  = _val(data, 'priceInfo', 'lastPrice')
        pc  = _val(data, 'priceInfo', 'previousClose')
        iss = _val(data, 'securityInfo', 'issuedSize')
        print(f'\n  [DEBUG] {symbol}: lastPrice={lp!r}  previousClose={pc!r}  issuedSize={iss!r}')

    return None


# ── Pass 1: NSE ───────────────────────────────────────────────────────────────

def run_nse_pass(conn, dry_run: bool, force: bool, debug: bool):
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
    not_found = 0
    suspended = 0
    net_fails = 0
    pending = []
    consecutive_fails = 0

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

        if consecutive_fails >= COOLDOWN_AFTER:
            print(f'\n  [{consecutive_fails} network failures] Pausing {COOLDOWN_SECONDS}s...', flush=True)
            _reset_session(wait=COOLDOWN_SECONDS)
            consecutive_fails = 0

        result = fetch_quote(symbol)

        if result is None:
            print(' — skipped (NSE error/delisted)')
            not_found += 1
        elif result == 'FAIL':
            print(' — network failure')
            net_fails += 1
            consecutive_fails += 1
        else:
            mcap = extract_mcap(result, symbol=symbol, debug=debug)
            if mcap is None:
                print(' — suspended (price or shares = 0)')
                suspended += 1
            else:
                print(f' — ₹{mcap:,.1f} Cr')
                done += 1
                consecutive_fails = 0
                pending.append((mcap, sym_id))

        if len(pending) >= COMMIT_EVERY:
            flush()
            print(f'  [db] committed {COMMIT_EVERY} rows')

        time.sleep(random.uniform(RATE_LIMIT_MIN, RATE_LIMIT_MAX))

    flush()
    print(f'\nNSE done: {done} updated, {not_found} skipped (NSE error), '
          f'{suspended} suspended (zero price/shares), {net_fails} network failures')


# ── Pass 2: BSE via ISIN ──────────────────────────────────────────────────────

def run_bse_diag(conn):
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # NSE side
    cur.execute("""
        SELECT
          count(*)                                                          AS nse_total,
          count(*) FILTER (WHERE mcap_cr IS NOT NULL)                      AS nse_with_mcap,
          count(*) FILTER (WHERE isin    IS NOT NULL)                      AS nse_with_isin,
          count(*) FILTER (WHERE mcap_cr IS NOT NULL AND isin IS NOT NULL) AS nse_both
        FROM km_equity_symbols
        WHERE exchange = 'NSE' AND is_active = true
    """)
    r = cur.fetchone()
    print(f'\n  NSE: {r["nse_total"]} total | '
          f'{r["nse_with_mcap"]} have mcap_cr | '
          f'{r["nse_with_isin"]} have isin | '
          f'{r["nse_both"]} have both')

    # BSE side
    cur.execute("""
        SELECT
          count(*)                                         AS bse_total,
          count(*) FILTER (WHERE isin IS NOT NULL)        AS bse_with_isin,
          count(*) FILTER (WHERE mcap_cr IS NOT NULL)     AS bse_with_mcap
        FROM km_equity_symbols
        WHERE exchange = 'BSE' AND is_active = true
    """)
    r = cur.fetchone()
    print(f'  BSE: {r["bse_total"]} total | '
          f'{r["bse_with_isin"]} have isin | '
          f'{r["bse_with_mcap"]} already have mcap_cr')

    # Actual join count (what the UPDATE would touch)
    cur.execute("""
        SELECT count(*) AS n
        FROM   km_equity_symbols bse
        JOIN   km_equity_symbols nse ON nse.isin = bse.isin
        WHERE  bse.exchange = 'BSE' AND bse.is_active = true AND bse.mcap_cr IS NULL
          AND  nse.exchange = 'NSE'
          AND  nse.isin     IS NOT NULL
          AND  nse.mcap_cr  IS NOT NULL
    """)
    join_count = cur.fetchone()['n']
    print(f'  Join matches (would be copied): {join_count}')

    # Sample 3 BSE rows to check their isin values
    cur.execute("""
        SELECT symbol, isin, mcap_cr
        FROM   km_equity_symbols
        WHERE  exchange = 'BSE' AND is_active = true
        ORDER BY id
        LIMIT 5
    """)
    rows = cur.fetchall()
    print(f'  Sample BSE rows:')
    for row in rows:
        print(f'    symbol={row["symbol"]}  isin={row["isin"]!r}  mcap_cr={row["mcap_cr"]}')


def run_bse_pass(conn, dry_run: bool, force: bool):
    print('\n=== Pass 2: BSE (copy from NSE via ISIN) ===')

    run_bse_diag(conn)

    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    where_bse = "mcap_cr IS NULL" if not force else "TRUE"

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
        print('  [dry-run] Skipping actual UPDATE (see join count above).')
    else:
        cur2 = conn.cursor()
        cur2.execute(sql_update)
        updated = cur2.rowcount
        conn.commit()
        print(f'  Copied mcap_cr to {updated} BSE rows via ISIN match.')

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
        print(f'  {remaining} BSE stocks still have no mcap_cr (no NSE ISIN match).')
    else:
        print('  All active BSE stocks covered.')


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Populate mcap_cr in km_equity_symbols')
    parser.add_argument('--dry-run',  action='store_true', help='Fetch but do not write to DB')
    parser.add_argument('--force',    action='store_true', help='Re-fetch even if mcap_cr already set')
    parser.add_argument('--bse-only', action='store_true', help='Skip NSE fetch, run BSE ISIN copy only')
    parser.add_argument('--bse-diag', action='store_true', help='Show BSE/NSE isin coverage and join count, then exit')
    parser.add_argument('--debug',    action='store_true', help='Print actual field values on extraction failure')
    args = parser.parse_args()

    conn = get_conn()

    if args.bse_diag:
        run_bse_diag(conn)
        conn.close()
        return

    if not args.bse_only:
        run_nse_pass(conn, dry_run=args.dry_run, force=args.force, debug=args.debug)

    run_bse_pass(conn, dry_run=args.dry_run, force=args.force)

    conn.close()
    print('\nAll done.')


if __name__ == '__main__':
    main()
