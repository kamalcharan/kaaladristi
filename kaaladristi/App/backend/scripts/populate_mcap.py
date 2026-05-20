"""
populate_mcap.py — One-time script to fill km_equity_symbols.mcap_cr

Pass 1 — NSE  : hits NSE quote-equity API per symbol.
  mcap_cr = securityInfo.issuedSize × priceInfo.lastPrice / 1e7

Pass 2 — BSE  : copies mcap_cr from matching NSE row via ISIN (dual-listed stocks).

Pass 3 — BSE-only: hits BSE scrip-header API for stocks with no NSE ISIN match.
  GET https://api.bseindia.com/BseIndiaAPI/api/getScripHeaderData/w?Debtflag=&scripcode={CODE}&seriesid=
  Response shape: {CurrRate:{LTP,..}, Cmpname:{..}, Header:{..}, CompResp:{..}}

All passes are resumable (skip symbols where mcap_cr IS NOT NULL).

Usage (from App/backend/):
  python scripts/populate_mcap.py            # full run: pass 1 + 2 + 3
  python scripts/populate_mcap.py --nse-only # pass 1 only
  python scripts/populate_mcap.py --bse-only # pass 2 + 3 only (after NSE done)
  python scripts/populate_mcap.py --bse3-only# pass 3 only
  python scripts/populate_mcap.py --dry-run  # no DB writes
  python scripts/populate_mcap.py --force    # re-fetch even if already set
  python scripts/populate_mcap.py --bse-diag # show coverage stats and exit
  python scripts/populate_mcap.py --debug    # print FULL JSON for first 3 valid BSE stocks

DB connection: reads DB_PRIMARY from App/.env automatically.
"""

import os
import sys
import time
import random
import argparse
import json
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

NSE_QUOTE_BASE  = 'https://www.nseindia.com/api/quote-equity'
BSE_SCRIP_BASE  = 'https://api.bseindia.com/BseIndiaAPI/api/getScripHeaderData/w'
BSE_MKTSUM_BASE = 'https://api.bseindia.com/BseIndiaAPI/api/getEQMktSummary/w'

NSE_RATE_MIN    = 1.2
NSE_RATE_MAX    = 2.0
BSE_RATE_MIN    = 0.4
BSE_RATE_MAX    = 0.8
COMMIT_EVERY    = 50
COOLDOWN_AFTER  = 5     # BSE: more tolerance before cooldown (many inactive codes)
NSE_COOLDOWN    = 45
BSE_COOLDOWN    = 15


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
        print('  Set DB_PRIMARY in App/.env')
        sys.exit(1)
    return psycopg2.connect(
        host='187.127.136.65', port=5432,
        dbname='kaala_dristi_db', user='postgres',
        password=password,
    )


# ── Shared helpers ────────────────────────────────────────────────────────────

import requests
from requests.exceptions import Timeout, ConnectionError as ReqConnError

def _val(d, *keys):
    for k in keys:
        if not isinstance(d, dict):
            return None
        d = d.get(k)
    return d

def _to_float(v) -> float | None:
    if v is None or v == '-' or v == '':
        return None
    try:
        f = float(str(v).replace(',', '').strip())
        return f if f > 0 else None
    except (ValueError, TypeError):
        return None

def _flush(conn, pending, dry_run):
    if dry_run or not pending:
        return
    uc = conn.cursor()
    psycopg2.extras.execute_batch(
        uc,
        'UPDATE km_equity_symbols SET mcap_cr = %s WHERE id = %s',
        pending, page_size=200,
    )
    conn.commit()
    pending.clear()


# ── NSE Session ───────────────────────────────────────────────────────────────

_NSE_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    ),
    'Accept': '*/*', 'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate', 'Connection': 'keep-alive',
    'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'sec-ch-ua-mobile': '?0', 'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty', 'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin', 'Referer': 'https://www.nseindia.com/',
}
_nse_session = None

def _nse_init():
    global _nse_session
    _nse_session = requests.Session()
    _nse_session.headers.update(_NSE_HEADERS)
    for url in [
        'https://www.nseindia.com/api/option-chain-indices?symbol=NIFTY',
        'https://www.nseindia.com/api/marketStatus',
        'https://www.nseindia.com/',
    ]:
        try:
            _nse_session.get(url, timeout=30)
            if len(_nse_session.cookies) > 0:
                print(f'  [nse] Session ready ({len(_nse_session.cookies)} cookies)')
                return
        except Exception:
            continue
    print('  [nse] WARNING: no cookies')

def _nse_reset(wait=0):
    global _nse_session
    _nse_session = None
    if wait:
        print(f'  [nse] Cooling {wait:.0f}s...', flush=True)
        time.sleep(wait)
    _nse_init()
    time.sleep(3)

def fetch_nse_quote(symbol: str):
    global _nse_session
    if _nse_session is None:
        _nse_init()
    for attempt in range(4):
        try:
            r = _nse_session.get(NSE_QUOTE_BASE, params={'symbol': symbol}, timeout=25)
            if r.status_code == 404:
                return None
            if r.status_code in (403, 429):
                _nse_reset(wait=15 + attempt * 10)
                continue
            r.raise_for_status()
            data = r.json()
            if 'error' in data and 'priceInfo' not in data:
                return None
            return data
        except (Timeout, ReqConnError):
            _nse_reset(wait=20 + attempt * 15)
        except requests.RequestException as e:
            if attempt < 3:
                time.sleep(5 * (attempt + 1))
            else:
                return 'FAIL'
    return 'FAIL'

def extract_nse_mcap(data, symbol='', debug=False):
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
        print(f'\n  [DEBUG] {symbol}: lastPrice={_val(data,"priceInfo","lastPrice")!r} '
              f'issuedSize={_val(data,"securityInfo","issuedSize")!r}')
    return None


# ── BSE Session ───────────────────────────────────────────────────────────────

_BSE_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    ),
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate',
    'Origin': 'https://www.bseindia.com',
    'Referer': 'https://www.bseindia.com/',
}
_bse_session = None
_bse_valid_printed = 0    # how many getScripHeaderData responses printed in debug mode
_bse_mktsum_printed = 0   # how many getEQMktSummary responses printed in debug mode

def _bse_init():
    global _bse_session
    _bse_session = requests.Session()
    _bse_session.headers.update(_BSE_HEADERS)

def _bse_reset(wait=0):
    global _bse_session, _bse_valid_printed, _bse_mktsum_printed
    _bse_session = None
    if wait:
        print(f'  [bse] Cooling {wait:.0f}s...', flush=True)
        time.sleep(wait)
    _bse_init()
    time.sleep(1)

# Sentinel returned when LTP is "-" / stock has no trading data (not a network error)
_BSE_NO_DATA = 'NO_DATA'

def fetch_bse_quote(scrip_code: str, debug: bool = False):
    """
    Returns:
      dict      — valid response with trading data
      NO_DATA   — BSE knows the scrip but LTP is '-' (inactive/delisted)
      None      — scrip not found / empty response
      'FAIL'    — network failure
    """
    global _bse_session, _bse_valid_printed
    if _bse_session is None:
        _bse_init()

    params = {'Debtflag': '', 'scripcode': scrip_code, 'seriesid': ''}
    for attempt in range(3):
        try:
            r = _bse_session.get(BSE_SCRIP_BASE, params=params, timeout=20)

            if r.status_code == 404:
                return None
            if r.status_code in (403, 429):
                _bse_reset(wait=10 + attempt * 10)
                continue
            r.raise_for_status()

            try:
                data = r.json()
            except Exception:
                return None

            if not data or not isinstance(data, dict):
                return None

            # BSE response shape: {CurrRate:{LTP,..}, Cmpname:{..}, Header:{..}, CompResp:{..}}
            ltp = _val(data, 'CurrRate', 'LTP')

            # Print full JSON for first 3 valid (non-dash) responses in debug mode
            if debug and ltp not in (None, '-', '') and _bse_valid_printed < 3:
                _bse_valid_printed += 1
                print(f'\n  [BSE FULL JSON] {scrip_code} (valid stock):')
                print(json.dumps(data, indent=2)[:3000])

            if ltp in (None, '-', ''):
                # Scrip exists in BSE but no trading data (inactive/warrant/index)
                return _BSE_NO_DATA

            return data

        except (Timeout, ReqConnError):
            _bse_reset(wait=10 + attempt * 10)
        except requests.RequestException:
            if attempt < 2:
                time.sleep(3)
            else:
                return 'FAIL'

    return 'FAIL'


def fetch_bse_mktsum(scrip_code: str, debug: bool = False) -> dict | None:
    """
    GET getEQMktSummary — BSE market summary (market cap, P/E, P/B, shares outstanding).
    Returns dict or None. Never raises.
    """
    global _bse_session, _bse_mktsum_printed
    if _bse_session is None:
        _bse_init()
    try:
        r = _bse_session.get(
            BSE_MKTSUM_BASE,
            params={'scripcode': scrip_code, 'seriesid': 'EQ', 'flag': '0'},
            timeout=15,
        )
        if not r.ok:
            return None
        data = r.json()
        # Normalise: some BSE APIs return a list
        if isinstance(data, list):
            data = data[0] if data else None
        if not isinstance(data, dict) or not data:
            return None
        if debug and _bse_mktsum_printed < 3:
            _bse_mktsum_printed += 1
            print(f'\n  [BSE MKTSUM JSON] {scrip_code}:')
            print(json.dumps(data, indent=2)[:2000])
        return data
    except Exception:
        return None


def extract_bse_mcap(header_data, mktsum=None, scrip='', debug=False) -> float | None:
    """
    Extract mcap (₹ Cr) from BSE API responses.
    header_data — getScripHeaderData response (has CurrRate.LTP but no shares)
    mktsum      — getEQMktSummary response (may have Mktcap / NoOfShares)
    """
    # ── Try direct mcap from mktsum ───────────────────────────────────────────
    if isinstance(mktsum, dict):
        for key in ('Mktcap', 'MktCap', 'MarketCap', 'mktcap', 'Mkt_Cap',
                    'MarketCapitalization', 'Mcap'):
            mcap = _to_float(mktsum.get(key))
            if mcap:
                return round(mcap, 2)

    # ── Fallback: LTP × shares ────────────────────────────────────────────────
    price = _to_float(_val(header_data, 'CurrRate', 'LTP'))

    # Shares can come from mktsum or (unlikely) Header
    share_sources = []
    if isinstance(mktsum, dict):
        share_sources.append(mktsum)
    share_sources.append(header_data.get('Header', {}))

    share_keys = (
        'NoOfShares', 'Noofshares', 'IssuedShares', 'IssuedCap',
        'TotalSharesIssued', 'OutstandingShares', 'FreeFloat',
    )
    for src in share_sources:
        if not isinstance(src, dict):
            continue
        for key in share_keys:
            shares = _to_float(src.get(key))
            if price and shares:
                return round(price * shares / 1e7, 2)

    # ── Debug dump ────────────────────────────────────────────────────────────
    if debug:
        if isinstance(mktsum, dict):
            non_empty = {k: v for k, v in mktsum.items() if v not in (None, '-', '', 0)}
            print(f'\n  [MKTSUM FAIL] {scrip}: {non_empty}')
        for section in ('Header', 'CompResp'):
            sec = header_data.get(section)
            if isinstance(sec, dict):
                non_empty = {k: v for k, v in sec.items() if v not in (None, '-', '')}
                if non_empty:
                    print(f'\n  [HEADER FAIL] {scrip} → {section}: {list(non_empty.keys())}')

    return None


# ── Pass 1: NSE ───────────────────────────────────────────────────────────────

def run_nse_pass(conn, dry_run, force, debug):
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    where = "exchange = 'NSE' AND is_active = true"
    if not force:
        where += ' AND mcap_cr IS NULL'
    cur.execute(f'SELECT id, symbol FROM km_equity_symbols WHERE {where} ORDER BY symbol')
    symbols = cur.fetchall()
    total = len(symbols)
    print(f'\n=== Pass 1: NSE ({total} symbols) ===')
    if total == 0:
        print('  Nothing to do.')
        return

    done = not_found = suspended = net_fails = 0
    pending = []
    consec = 0

    for i, row in enumerate(symbols, 1):
        print(f'  [{i}/{total}] {row["symbol"]}', end='', flush=True)
        if consec >= COOLDOWN_AFTER:
            print(f'\n  Pausing {NSE_COOLDOWN}s after {consec} failures...', flush=True)
            _nse_reset(wait=NSE_COOLDOWN)
            consec = 0

        result = fetch_nse_quote(row['symbol'])
        if result is None:
            print(' — skipped'); not_found += 1
        elif result == 'FAIL':
            print(' — network fail'); net_fails += 1; consec += 1
        else:
            mcap = extract_nse_mcap(result, row['symbol'], debug)
            if mcap is None:
                print(' — suspended'); suspended += 1
            else:
                print(f' — ₹{mcap:,.1f} Cr'); done += 1; consec = 0
                pending.append((mcap, row['id']))

        if len(pending) >= COMMIT_EVERY:
            _flush(conn, pending, dry_run)
            print(f'  [db] committed {COMMIT_EVERY} rows')
        time.sleep(random.uniform(NSE_RATE_MIN, NSE_RATE_MAX))

    _flush(conn, pending, dry_run)
    print(f'\nNSE done: {done} updated | {not_found} skipped | {suspended} suspended | {net_fails} net-fail')


# ── Pass 2: BSE dual-listed via ISIN ─────────────────────────────────────────

def run_bse_isin_pass(conn, dry_run, force):
    print('\n=== Pass 2: BSE dual-listed (ISIN copy from NSE) ===')
    where_bse = 'TRUE' if force else 'mcap_cr IS NULL'
    if not dry_run:
        uc = conn.cursor()
        uc.execute(f"""
            UPDATE km_equity_symbols bse
            SET    mcap_cr = nse.mcap_cr
            FROM   km_equity_symbols nse
            WHERE  bse.exchange = 'BSE' AND bse.is_active = true AND bse.{where_bse}
              AND  nse.exchange = 'NSE'
              AND  nse.isin = bse.isin AND nse.isin IS NOT NULL AND nse.mcap_cr IS NOT NULL
        """)
        updated = uc.rowcount
        conn.commit()
        print(f'  Copied mcap_cr to {updated} BSE rows.')
    else:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(f"""
            SELECT count(*) AS n FROM km_equity_symbols bse
            JOIN km_equity_symbols nse ON nse.isin = bse.isin
            WHERE bse.exchange='BSE' AND bse.is_active=true AND bse.{where_bse}
              AND nse.exchange='NSE' AND nse.isin IS NOT NULL AND nse.mcap_cr IS NOT NULL
        """)
        print(f'  [dry-run] Would copy to {cur.fetchone()["n"]} BSE rows.')


# ── Pass 3: BSE-only via BSE scrip API ────────────────────────────────────────

def run_bse3_pass(conn, dry_run, force, debug):
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    where = "b.exchange = 'BSE' AND b.is_active = true"
    if not force:
        where += ' AND b.mcap_cr IS NULL'
    cur.execute(f"""
        SELECT b.id, b.symbol
        FROM   km_equity_symbols b
        WHERE  {where}
          AND  NOT EXISTS (
              SELECT 1 FROM km_equity_symbols n
              WHERE  n.exchange = 'NSE' AND n.isin = b.isin AND n.isin IS NOT NULL
          )
        ORDER BY b.symbol
    """)
    symbols = cur.fetchall()
    total = len(symbols)
    print(f'\n=== Pass 3: BSE-only ({total} symbols via BSE API) ===')
    if total == 0:
        print('  Nothing to do.')
        return

    done = no_data = no_mcap = net_fails = 0
    pending = []
    consec = 0

    for i, row in enumerate(symbols, 1):
        scrip = row['symbol']
        print(f'  [{i}/{total}] {scrip}', end='', flush=True)

        if consec >= COOLDOWN_AFTER:
            print(f'\n  Pausing {BSE_COOLDOWN}s after {consec} failures...', flush=True)
            _bse_reset(wait=BSE_COOLDOWN)
            consec = 0

        result = fetch_bse_quote(scrip, debug=debug)

        if result is _BSE_NO_DATA:
            # Inactive/warrant/non-equity — silent skip, don't penalise
            print(' — inactive'); no_data += 1

        elif result is None:
            # Scrip not found — also silent skip
            print(' — not found'); no_data += 1

        elif result == 'FAIL':
            print(' — network fail'); net_fails += 1; consec += 1

        else:
            consec = 0
            mktsum = fetch_bse_mktsum(scrip, debug=debug)
            mcap = extract_bse_mcap(result, mktsum, scrip, debug)
            if mcap is None:
                print(' — no mcap fields'); no_mcap += 1
            else:
                print(f' — ₹{mcap:,.1f} Cr'); done += 1
                pending.append((mcap, row['id']))

        if len(pending) >= COMMIT_EVERY:
            _flush(conn, pending, dry_run)
            print(f'  [db] committed {COMMIT_EVERY} rows')
        time.sleep(random.uniform(BSE_RATE_MIN, BSE_RATE_MAX))

    _flush(conn, pending, dry_run)
    print(f'\nBSE-only done: {done} updated | {no_data} inactive/not-found | '
          f'{no_mcap} no mcap fields | {net_fails} net-fail')


# ── Diagnostics ───────────────────────────────────────────────────────────────

def run_bse_diag(conn):
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("""
        SELECT count(*) AS t,
               count(*) FILTER (WHERE mcap_cr IS NOT NULL) AS m,
               count(*) FILTER (WHERE isin    IS NOT NULL) AS i,
               count(*) FILTER (WHERE mcap_cr IS NOT NULL AND isin IS NOT NULL) AS both
        FROM km_equity_symbols WHERE exchange='NSE' AND is_active=true
    """)
    r = cur.fetchone()
    print(f'\n  NSE: {r["t"]} total | {r["m"]} mcap_cr | {r["i"]} isin | {r["both"]} both')
    cur.execute("""
        SELECT count(*) AS t,
               count(*) FILTER (WHERE isin    IS NOT NULL) AS i,
               count(*) FILTER (WHERE mcap_cr IS NOT NULL) AS m
        FROM km_equity_symbols WHERE exchange='BSE' AND is_active=true
    """)
    r = cur.fetchone()
    print(f'  BSE: {r["t"]} total | {r["i"]} isin | {r["m"]} mcap_cr')
    cur.execute("""
        SELECT count(*) AS n FROM km_equity_symbols b
        WHERE b.exchange='BSE' AND b.is_active=true AND b.mcap_cr IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM km_equity_symbols n
              WHERE n.exchange='NSE' AND n.isin=b.isin AND n.isin IS NOT NULL
          )
    """)
    print(f'  BSE-only (no NSE ISIN match, no mcap_cr): {cur.fetchone()["n"]}')
    cur.execute("""
        SELECT symbol, isin, mcap_cr FROM km_equity_symbols
        WHERE exchange='BSE' AND is_active=true ORDER BY id LIMIT 5
    """)
    print('  Sample BSE rows:')
    for row in cur.fetchall():
        print(f'    {row["symbol"]}  isin={row["isin"]!r}  mcap_cr={row["mcap_cr"]}')


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description='Populate mcap_cr in km_equity_symbols')
    p.add_argument('--dry-run',   action='store_true')
    p.add_argument('--force',     action='store_true')
    p.add_argument('--nse-only',  action='store_true', help='Pass 1 only')
    p.add_argument('--bse-only',  action='store_true', help='Pass 2+3 only')
    p.add_argument('--bse3-only', action='store_true', help='Pass 3 only (BSE-only stocks)')
    p.add_argument('--bse-diag',  action='store_true', help='Show coverage stats and exit')
    p.add_argument('--debug',     action='store_true',
                   help='Print full JSON for first 3 BSE stocks with valid LTP')
    args = p.parse_args()

    conn = get_conn()

    if args.bse_diag:
        run_bse_diag(conn)
        conn.close()
        return

    if not (args.bse_only or args.bse3_only):
        run_nse_pass(conn, args.dry_run, args.force, args.debug)

    if not (args.nse_only or args.bse3_only):
        run_bse_isin_pass(conn, args.dry_run, args.force)

    if not args.nse_only:
        run_bse3_pass(conn, args.dry_run, args.force, args.debug)

    conn.close()
    print('\nAll done.')


if __name__ == '__main__':
    main()
