"""
Yahoo Finance Historical Downloader for Kala-Drishti
=====================================================
Downloads long-term historical OHLC data (20-30 years) using yfinance
and inserts into Supabase km_index_eod / km_equity_eod tables.

No API key needed. Works immediately.

Vendor codes:
  - Equities: NSE symbol + ".NS" (e.g. RELIANCE -> RELIANCE.NS)
  - Indices:  Yahoo tickers (e.g. NIFTY 50 -> ^NSEI)

Usage
-----
  # Backfill all equities with max history
  python yfinance_historical.py --mode equity

  # Backfill indices
  python yfinance_historical.py --mode index

  # Single stock, custom date range
  python yfinance_historical.py --mode equity --symbol RELIANCE --from 1996-01-01

  # Both indices and equities
  python yfinance_historical.py --mode both
"""

import os
import sys
import json
import time
import argparse
from datetime import datetime, timedelta
from dotenv import load_dotenv
import requests

try:
    import yfinance as yf
except ImportError:
    print('ERROR: pip install yfinance')
    sys.exit(1)

# ─── Load environment ────────────────────────────────────────────────────────
script_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(script_dir, '..', 'frontend', '.env')
load_dotenv(env_path)

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('VITE_SUPABASE_SERVICE_KEY')

# ─── Constants ────────────────────────────────────────────────────────────────
BATCH_SIZE = 500
REQUEST_DELAY = 2  # seconds between Yahoo requests (avoid rate limiting)

# Yahoo Finance tickers for NSE indices
INDEX_YAHOO_MAP = {
    'NIFTY 50': '^NSEI',
    'NIFTY BANK': '^NSEBANK',
    'NIFTY IT': '^CNXIT',
    'NIFTY NEXT 50': '^NSMIDCP',
    'NIFTY FINANCIAL SERVICES': '^CNXFIN',
    'NIFTY AUTO': '^CNXAUTO',
    'NIFTY PHARMA': '^CNXPHARMA',
    'NIFTY FMCG': '^CNXFMCG',
    'NIFTY METAL': '^CNXMETAL',
    'NIFTY REALTY': '^CNXREALTY',
    'NIFTY ENERGY': '^CNXENERGY',
    'NIFTY INFRASTRUCTURE': '^CNXINFRA',
    'NIFTY PSE': '^CNXPSE',
    'NIFTY MEDIA': '^CNXMEDIA',
    'NIFTY PRIVATE BANK': '^NIFTYPVTBANK',
    'NIFTY COMMODITIES': '^CNXCOMMODITY',
    'NIFTY CONSUMPTION': '^CNXCONSUMPTION',
    'NIFTY CPSE': '^CNXCPSE',
    'NIFTY PSU BANK': '^CNXPSUBANK',
    'NIFTY 100': '^CNX100',
    'NIFTY 200': '^CNX200',
    'NIFTY 500': '^CNX500',
    'NIFTY MIDCAP 50': '^CNXMIDCAP',
    'NIFTY MIDCAP 100': '^CNXMIDCAP100',
    'NIFTY SMLCAP 100': '^CNXSMLCAP100',
    'NIFTY MNC': '^CNXMNC',
}


# ═════════════════════════════════════════════════════════════════════════════
# SUPABASE REST CLIENT
# ═════════════════════════════════════════════════════════════════════════════

class SupabaseREST:
    def __init__(self, url: str, key: str):
        self.base = f'{url.rstrip("/")}/rest/v1'
        self.headers = {
            'apikey': key,
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json',
        }

    def select(self, table, columns='*', filters=None, order=None, ilike=None):
        url = f'{self.base}/{table}?select={columns}'
        if filters:
            for k, v in filters.items():
                url += f'&{k}=eq.{v}'
        if ilike:
            col, val = ilike
            url += f'&{col}=ilike.{val}'
        if order:
            url += f'&order={order}'
        resp = requests.get(url, headers=self.headers)
        resp.raise_for_status()
        return resp.json()

    def upsert(self, table, records, on_conflict):
        url = f'{self.base}/{table}?on_conflict={on_conflict}'
        headers = {**self.headers, 'Prefer': 'resolution=merge-duplicates,return=minimal'}
        resp = requests.post(url, headers=headers, json=records)
        resp.raise_for_status()
        return len(records)

    def insert(self, table, record):
        url = f'{self.base}/{table}'
        headers = {**self.headers, 'Prefer': 'return=minimal'}
        resp = requests.post(url, headers=headers, json=record)
        return resp.status_code in (200, 201)

    def patch(self, table, filters, data):
        url = f'{self.base}/{table}'
        for k, v in filters.items():
            url += f'?{k}=eq.{v}' if '?' not in url else f'&{k}=eq.{v}'
        headers = {**self.headers, 'Prefer': 'return=minimal'}
        resp = requests.patch(url, headers=headers, json=data)
        return resp.status_code in (200, 204)


def init_supabase():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print('ERROR: VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_KEY must be set')
        sys.exit(1)
    sb = SupabaseREST(SUPABASE_URL, SUPABASE_KEY)
    try:
        sb.select('km_index_symbols', columns='id', filters=None)
    except Exception as e:
        print(f'  Supabase connection failed: {e}')
        sys.exit(1)
    return sb


# ═════════════════════════════════════════════════════════════════════════════
# YAHOO FINANCE FETCHER
# ═════════════════════════════════════════════════════════════════════════════

def fetch_yahoo_history(ticker: str, start: str, end: str, max_retries: int = 4) -> list:
    """
    Fetch OHLC history from Yahoo Finance with retry + backoff.
    Uses yf.download() which handles sessions/cookies better than Ticker.history().
    Returns list of dicts with trade_date, open, high, low, close, volume.
    """
    for attempt in range(max_retries):
        try:
            # yf.download() is more reliable than Ticker.history() for rate limits
            if start <= '2000-01-01':
                df = yf.download(ticker, period='max', auto_adjust=False,
                                 progress=False, timeout=30)
                if df is not None and not df.empty:
                    df = df[(df.index >= start) & (df.index <= end)]
            else:
                df = yf.download(ticker, start=start, end=end, auto_adjust=False,
                                 progress=False, timeout=30)

            if df is None or df.empty:
                if attempt < max_retries - 1:
                    wait = (attempt + 1) * 10
                    print(f' [empty, retry in {wait}s]', end='', flush=True)
                    time.sleep(wait)
                    continue
                return []

            # Handle both single and multi-level column headers
            if isinstance(df.columns, __import__('pandas').MultiIndex):
                df.columns = df.columns.get_level_values(0)

            records = []
            for dt, row in df.iterrows():
                records.append({
                    'trade_date': dt.strftime('%Y-%m-%d'),
                    'open': round(float(row['Open']), 2) if row['Open'] == row['Open'] else None,
                    'high': round(float(row['High']), 2) if row['High'] == row['High'] else None,
                    'low': round(float(row['Low']), 2) if row['Low'] == row['Low'] else None,
                    'close': round(float(row['Close']), 2) if row['Close'] == row['Close'] else None,
                    'volume': int(row['Volume']) if row['Volume'] == row['Volume'] else None,
                })
            return records

        except Exception as e:
            err_msg = str(e)
            if 'Rate' in err_msg or 'Too Many' in err_msg or '429' in err_msg:
                wait = (attempt + 1) * 15  # 15s, 30s, 45s, 60s
                print(f' [rate limited, waiting {wait}s]', end='', flush=True)
                time.sleep(wait)
                continue
            print(f'    yfinance error for {ticker}: {e}')
            return []

    print(f' [max retries exceeded]', end='', flush=True)
    return []


# ═════════════════════════════════════════════════════════════════════════════
# UPSERT
# ═════════════════════════════════════════════════════════════════════════════

def upsert_eod(sb, table, records, fk_field, fk_id):
    """Add FK field to records and upsert to Supabase."""
    if not records:
        return 0
    rows = [{fk_field: fk_id, **r} for r in records]
    on_conflict = f'{fk_field},trade_date'
    inserted = 0
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i:i + BATCH_SIZE]
        try:
            inserted += sb.upsert(table, batch, on_conflict)
        except Exception as e:
            print(f'    Batch error: {e}')
            for rec in batch:
                if sb.insert(table, rec):
                    inserted += 1
    return inserted


# ═════════════════════════════════════════════════════════════════════════════
# DOWNLOAD ORCHESTRATORS
# ═════════════════════════════════════════════════════════════════════════════

def download_index_history(sb, from_date, to_date, single_name=None):
    print('\n' + '=' * 60)
    print('DOWNLOADING INDEX HISTORY (Yahoo Finance)')
    print('=' * 60)

    if single_name:
        indices = sb.select('km_index_symbols', 'id,name,vendor_codes',
                            ilike=('name', f'%{single_name}%'))
    else:
        indices = sb.select('km_index_symbols', 'id,name,vendor_codes')

    if not indices:
        print('  No indices found')
        return

    print(f'  Found {len(indices)} indices')
    total = 0
    skipped = 0

    for idx in indices:
        name = idx['name']
        idx_id = idx['id']
        vc = idx.get('vendor_codes') or {}

        # Get Yahoo ticker: from vendor_codes or hardcoded map
        yahoo_ticker = vc.get('yahoo') or INDEX_YAHOO_MAP.get(name.upper())

        if not yahoo_ticker:
            skipped += 1
            continue

        print(f'\n  [{name}] -> {yahoo_ticker}')
        records = fetch_yahoo_history(yahoo_ticker, from_date, to_date)

        if not records:
            print(f'    No data')
            continue

        print(f'    Fetched {len(records)} days')
        n = upsert_eod(sb, 'km_index_eod', records, 'index_id', idx_id)
        total += n
        print(f'    Inserted {n} records')

        # Save yahoo ticker to vendor_codes
        if not vc.get('yahoo'):
            new_vc = {**vc, 'yahoo': yahoo_ticker}
            sb.patch('km_index_symbols', {'id': idx_id}, {'vendor_codes': json.dumps(new_vc)})

        time.sleep(REQUEST_DELAY)

    print(f'\n  INDEX SUMMARY: {total} inserted, {skipped} skipped (no Yahoo ticker)')


def download_equity_history(sb, from_date, to_date, single_symbol=None):
    print('\n' + '=' * 60)
    print('DOWNLOADING EQUITY HISTORY (Yahoo Finance)')
    print('=' * 60)

    if single_symbol:
        equities = sb.select('km_equity_symbols', 'id,symbol,vendor_codes',
                             filters={'symbol': single_symbol.upper()}, order='symbol')
    else:
        equities = sb.select('km_equity_symbols', 'id,symbol,vendor_codes', order='symbol')

    if not equities:
        print('  No equities found')
        return

    print(f'  Found {len(equities)} equities')
    total = 0
    failed = 0
    failed_symbols = []

    for i, eq in enumerate(equities, 1):
        symbol = eq['symbol']
        eq_id = eq['id']
        vc = eq.get('vendor_codes') or {}

        # Yahoo ticker: vendor_codes.yahoo or symbol + ".NS"
        yahoo_ticker = vc.get('yahoo') or f'{symbol}.NS'

        print(f'  [{i}/{len(equities)}] {symbol} -> {yahoo_ticker}', end='', flush=True)
        records = fetch_yahoo_history(yahoo_ticker, from_date, to_date)

        if not records:
            print(' — no data')
            failed += 1
            failed_symbols.append(symbol)
            time.sleep(REQUEST_DELAY)
            continue

        print(f' — {len(records)} days', end='', flush=True)
        n = upsert_eod(sb, 'km_equity_eod', records, 'equity_id', eq_id)
        total += n
        print(f' — inserted {n}')

        # Save yahoo ticker to vendor_codes
        if not vc.get('yahoo'):
            new_vc = {**vc, 'yahoo': yahoo_ticker, 'nse': symbol}
            sb.patch('km_equity_symbols', {'id': eq_id}, {'vendor_codes': json.dumps(new_vc)})

        time.sleep(REQUEST_DELAY)

    print(f'\n  EQUITY SUMMARY: {total} inserted, {failed} failed out of {len(equities)}')
    if failed_symbols and len(failed_symbols) <= 30:
        print(f'  Failed: {", ".join(failed_symbols)}')


# ═════════════════════════════════════════════════════════════════════════════
# CLI
# ═════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description='Download historical OHLC data from Yahoo Finance into Supabase'
    )
    parser.add_argument('--mode', choices=['index', 'equity', 'both'], default='both')
    parser.add_argument('--from', dest='from_date', type=str, default='1996-01-01',
                        help='Start date YYYY-MM-DD (default: 1996-01-01)')
    parser.add_argument('--to', dest='to_date', type=str,
                        help='End date YYYY-MM-DD (default: today)')
    parser.add_argument('--symbol', type=str, help='Single symbol to download')

    args = parser.parse_args()

    to_date = args.to_date or datetime.now().strftime('%Y-%m-%d')
    from_date = args.from_date

    print('=' * 60)
    print('KALA-DRISHTI HISTORICAL DOWNLOADER (Yahoo Finance)')
    print('=' * 60)
    print(f'  Mode   : {args.mode}')
    print(f'  Period : {from_date} to {to_date}')
    print(f'  Symbol : {args.symbol or "ALL"}')
    print()

    sb = init_supabase()
    print('  Supabase connected')

    if args.mode in ('index', 'both'):
        download_index_history(sb, from_date, to_date, single_name=args.symbol)
    if args.mode in ('equity', 'both'):
        download_equity_history(sb, from_date, to_date, single_symbol=args.symbol)

    print('\n' + '=' * 60)
    print('DOWNLOAD COMPLETE')
    print('=' * 60)


if __name__ == '__main__':
    main()
