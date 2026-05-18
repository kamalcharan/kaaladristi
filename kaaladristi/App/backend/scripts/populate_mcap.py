"""
populate_mcap.py — One-time script to fill km_equity_symbols.mcap_cr

Source: NSE quote-equity API
  GET https://www.nseindia.com/api/quote-equity?symbol={SYMBOL}
  → securityInfo.issuedSize (shares) × priceInfo.lastPrice / 1e7 = mcap in ₹ Cr

Resumable: skips symbols where mcap_cr IS NOT NULL.
Rate-limited to ~1 req/sec (NSE anti-bot).

Usage:
  cd App/backend
  KD_DB_PASSWORD=... python scripts/populate_mcap.py

  # Dry run (no DB writes):
  KD_DB_PASSWORD=... python scripts/populate_mcap.py --dry-run

  # Force re-fetch even if already populated:
  KD_DB_PASSWORD=... python scripts/populate_mcap.py --force
"""

import os
import sys
import time
import random
import argparse
import psycopg2
import psycopg2.extras

# ── Config ────────────────────────────────────────────────────────────────────

DB_HOST = '187.127.136.65'
DB_PORT = 5432
DB_NAME = 'kaala_dristi_db'
DB_USER = 'postgres'

NSE_QUOTE_URL = 'https://www.nseindia.com/api/quote-equity?symbol={symbol}'

RATE_LIMIT_MIN = 0.8   # seconds between requests
RATE_LIMIT_MAX = 1.4
COMMIT_EVERY   = 50    # batch commit size


# ── DB connection ─────────────────────────────────────────────────────────────

def get_conn():
    return psycopg2.connect(
        host=DB_HOST, port=DB_PORT,
        dbname=DB_NAME, user=DB_USER,
        password=os.environ['KD_DB_PASSWORD'],
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
                return None  # symbol not on NSE
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
    """
    Extract market cap in Crores from NSE quote-equity response.
    mcap_cr = lastPrice × issuedSize / 1e7
    """
    try:
        price = data.get('priceInfo', {}).get('lastPrice')
        issued = data.get('securityInfo', {}).get('issuedSize')
        if price and issued and float(price) > 0 and int(issued) > 0:
            return round(float(price) * int(issued) / 1e7, 2)
    except (TypeError, ValueError, KeyError):
        pass
    return None


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Populate mcap_cr in km_equity_symbols')
    parser.add_argument('--dry-run', action='store_true', help='Fetch but do not write to DB')
    parser.add_argument('--force', action='store_true', help='Re-fetch even if mcap_cr already set')
    args = parser.parse_args()

    if 'KD_DB_PASSWORD' not in os.environ:
        print('ERROR: KD_DB_PASSWORD not set')
        sys.exit(1)

    conn = get_conn()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Load symbols
    where = "exchange = 'NSE' AND is_active = true"
    if not args.force:
        where += ' AND mcap_cr IS NULL'

    cur.execute(f'SELECT id, symbol FROM km_equity_symbols WHERE {where} ORDER BY symbol')
    symbols = cur.fetchall()
    total = len(symbols)
    print(f'Symbols to process: {total}  (dry_run={args.dry_run}, force={args.force})')

    if total == 0:
        print('Nothing to do.')
        conn.close()
        return

    done = 0
    skipped = 0
    failed = []
    pending_updates = []  # list of (mcap_cr, symbol_id)

    def flush_updates():
        if args.dry_run or not pending_updates:
            return
        update_cur = conn.cursor()
        psycopg2.extras.execute_batch(
            update_cur,
            'UPDATE km_equity_symbols SET mcap_cr = %s WHERE id = %s',
            pending_updates,
            page_size=200,
        )
        conn.commit()
        pending_updates.clear()

    for i, row in enumerate(symbols, 1):
        sym_id = row['id']
        symbol = row['symbol']

        print(f'  [{i}/{total}] {symbol}', end='', flush=True)

        data = fetch_quote(symbol)
        if data is None:
            print(' — not found')
            skipped += 1
        else:
            mcap = extract_mcap(data)
            if mcap is None:
                print(' — mcap extract failed')
                failed.append(symbol)
            else:
                print(f' — ₹{mcap:,.1f} Cr')
                done += 1
                pending_updates.append((mcap, sym_id))

        if len(pending_updates) >= COMMIT_EVERY:
            flush_updates()
            print(f'  [db] committed {COMMIT_EVERY} rows')

        # Rate limit with jitter
        time.sleep(random.uniform(RATE_LIMIT_MIN, RATE_LIMIT_MAX))

    flush_updates()

    print(f'\nDone: {done} updated, {skipped} not on NSE, {len(failed)} failed')
    if failed:
        print(f'Failed symbols: {", ".join(failed)}')

    conn.close()


if __name__ == '__main__':
    main()
