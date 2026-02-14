"""
ICICI Breeze EOD Data Downloader for Kala-Drishti
===================================================
Downloads end-of-day (1-day) OHLC data from ICICI Breeze API
and inserts into Supabase km_index_eod / km_equity_eod tables.

Prerequisite: Run populate_vendor_codes.py first to map NSE symbols
              to Breeze ISEC codes in the vendor_codes JSONB column.
              Symbols without vendor_codes.breeze will be skipped.

Usage
-----
  python breeze_eod_downloader.py --mode equity --days 365
  python breeze_eod_downloader.py --mode index --days 30
  python breeze_eod_downloader.py --mode both --from 2025-01-01 --to 2026-02-14
  python breeze_eod_downloader.py --mode equity --symbol RELIANCE --days 365
"""

import os
import sys
import json
import time
import argparse
import urllib.parse
from datetime import datetime, timedelta
from dotenv import load_dotenv
import requests

# ─── Load environment ────────────────────────────────────────────────────────
script_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(script_dir, '..', 'frontend', '.env')
load_dotenv(env_path)

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('VITE_SUPABASE_SERVICE_KEY')
BREEZE_API_KEY = os.getenv('BREEZE_API_KEY', '')
BREEZE_API_SECRET = os.getenv('BREEZE_API_SECRET', '')
BREEZE_SESSION_TOKEN = os.getenv('BREEZE_SESSION_TOKEN', '')

# ─── Constants ────────────────────────────────────────────────────────────────
BATCH_SIZE = 500
REQUEST_DELAY = 0.5  # seconds between Breeze API calls
MAX_CANDLES_PER_REQUEST = 1000  # Breeze limit


def iso_ts(dt: datetime) -> str:
    return dt.strftime('%Y-%m-%dT%H:%M:%S.000Z')


def parse_date(s: str) -> datetime:
    return datetime.strptime(s, '%Y-%m-%d')


# ═════════════════════════════════════════════════════════════════════════════
# BREEZE CLIENT
# ═════════════════════════════════════════════════════════════════════════════

def init_breeze(session_token: str):
    try:
        from breeze_connect import BreezeConnect
    except ImportError:
        print('ERROR: pip install breeze-connect')
        sys.exit(1)

    if not BREEZE_API_KEY or not BREEZE_API_SECRET:
        print('ERROR: BREEZE_API_KEY and BREEZE_API_SECRET must be set in .env')
        sys.exit(1)

    token = session_token or BREEZE_SESSION_TOKEN
    if not token:
        login_url = ('https://api.icicidirect.com/apiuser/login?api_key='
                     + urllib.parse.quote_plus(BREEZE_API_KEY))
        print('ERROR: Session token required.')
        print(f'  Visit: {login_url}')
        print('  Then: --session-token <TOKEN>')
        sys.exit(1)

    print('Connecting to ICICI Breeze...')
    breeze = BreezeConnect(api_key=BREEZE_API_KEY)
    breeze.generate_session(api_secret=BREEZE_API_SECRET, session_token=token)
    print('  Connected successfully')
    return breeze


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

    def select(self, table: str, columns: str = '*', filters: dict = None,
               order: str = None, ilike: tuple = None) -> list:
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

    def upsert(self, table: str, records: list, on_conflict: str) -> int:
        url = f'{self.base}/{table}?on_conflict={on_conflict}'
        headers = {**self.headers, 'Prefer': 'resolution=merge-duplicates,return=minimal'}
        resp = requests.post(url, headers=headers, json=records)
        resp.raise_for_status()
        return len(records)

    def insert(self, table: str, record: dict) -> bool:
        url = f'{self.base}/{table}'
        headers = {**self.headers, 'Prefer': 'return=minimal'}
        resp = requests.post(url, headers=headers, json=record)
        return resp.status_code in (200, 201)


def init_supabase():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print('ERROR: VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_KEY must be set')
        sys.exit(1)
    print('Connecting to Supabase...')
    sb = SupabaseREST(SUPABASE_URL, SUPABASE_KEY)
    try:
        sb.select('km_index_symbols', columns='id', filters=None)
        print('  Connected successfully')
    except Exception as e:
        print(f'  Connection failed: {e}')
        sys.exit(1)
    return sb


# ═════════════════════════════════════════════════════════════════════════════
# DATA FETCHERS
# ═════════════════════════════════════════════════════════════════════════════

def fetch_eod(breeze, stock_code: str, from_date: datetime, to_date: datetime) -> list:
    """Fetch 1-day OHLC candles from Breeze. Handles chunking for >1000 days."""
    records = []
    cursor = from_date

    while cursor < to_date:
        chunk_end = min(cursor + timedelta(days=MAX_CANDLES_PER_REQUEST - 1), to_date)
        try:
            resp = breeze.get_historical_data_v2(
                interval='1day',
                from_date=iso_ts(cursor),
                to_date=iso_ts(chunk_end),
                stock_code=stock_code,
                exchange_code='NSE',
                product_type='cash',
            )
            if resp and resp.get('Success'):
                records.extend(resp['Success'])
            elif resp and resp.get('Error'):
                print(f'    Breeze error: {resp["Error"]}')
                break
            else:
                print(f'    Empty response for stock_code "{stock_code}"')
                break
        except Exception as e:
            print(f'    Exception: {e}')
            break

        cursor = chunk_end + timedelta(days=1)
        time.sleep(REQUEST_DELAY)

    return records


# ═════════════════════════════════════════════════════════════════════════════
# TRANSFORM & LOAD
# ═════════════════════════════════════════════════════════════════════════════

def safe_float(val):
    if val is None:
        return None
    try:
        return round(float(val), 2)
    except (ValueError, TypeError):
        return None


def safe_int(val):
    if val is None:
        return None
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return None


def transform_record(raw: dict, fk_field: str, fk_id: int) -> dict:
    dt_str = raw.get('datetime', '') or raw.get('date', '')
    trade_date = str(dt_str)[:10] if dt_str else None

    return {
        fk_field: fk_id,
        'trade_date': trade_date,
        'open': safe_float(raw.get('open')),
        'high': safe_float(raw.get('high')),
        'low': safe_float(raw.get('low')),
        'close': safe_float(raw.get('close')),
        'prev_close': safe_float(raw.get('previous_close')),
        'volume': safe_int(raw.get('volume')),
    }


def upsert_eod(sb, table: str, records: list) -> int:
    if not records:
        return 0
    on_conflict = 'index_id,trade_date' if 'index_id' in records[0] else 'equity_id,trade_date'
    inserted = 0
    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i:i + BATCH_SIZE]
        try:
            inserted += sb.upsert(table, batch, on_conflict)
        except Exception as e:
            print(f'    Batch upsert error: {e}')
            for rec in batch:
                if sb.insert(table, rec):
                    inserted += 1
    return inserted


# ═════════════════════════════════════════════════════════════════════════════
# DOWNLOAD ORCHESTRATORS
# ═════════════════════════════════════════════════════════════════════════════

def download_index_eod(breeze, sb, from_date, to_date, single_name=None):
    print('\n' + '=' * 60)
    print('DOWNLOADING INDEX EOD DATA')
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
        vc = idx.get('vendor_codes') or {}
        breeze_code = vc.get('breeze')

        if not breeze_code:
            print(f'  SKIP {name} — no vendor_codes.breeze (run populate_vendor_codes.py)')
            skipped += 1
            continue

        print(f'\n  [{name}] -> {breeze_code}')
        raw = fetch_eod(breeze, breeze_code, from_date, to_date)
        if not raw:
            print(f'    No data returned')
            continue

        print(f'    Fetched {len(raw)} candles')
        records = [transform_record(r, 'index_id', idx['id']) for r in raw]
        n = upsert_eod(sb, 'km_index_eod', records)
        total += n
        print(f'    Inserted {n} records')

    print(f'\n  INDEX SUMMARY: {total} inserted, {skipped} skipped (no breeze code)')


def download_equity_eod(breeze, sb, from_date, to_date, single_symbol=None):
    print('\n' + '=' * 60)
    print('DOWNLOADING EQUITY EOD DATA')
    print('=' * 60)

    if single_symbol:
        equities = sb.select('km_equity_symbols', 'id,symbol,vendor_codes',
                             filters={'symbol': single_symbol.upper()}, order='symbol')
    else:
        equities = sb.select('km_equity_symbols', 'id,symbol,vendor_codes', order='symbol')

    if not equities:
        print('  No equities found')
        return

    # Count how many have breeze codes
    with_code = sum(1 for e in equities if (e.get('vendor_codes') or {}).get('breeze'))
    print(f'  Found {len(equities)} equities ({with_code} with breeze codes)')

    if with_code == 0:
        print('  ERROR: No equities have vendor_codes.breeze set.')
        print('  Run: python populate_vendor_codes.py --session-token <TOKEN>')
        return

    total = 0
    failed = 0
    skipped = 0
    failed_symbols = []

    for i, eq in enumerate(equities, 1):
        symbol = eq['symbol']
        vc = eq.get('vendor_codes') or {}
        breeze_code = vc.get('breeze')

        if not breeze_code:
            skipped += 1
            continue

        suffix = f' (ISEC: {breeze_code})' if breeze_code != symbol else ''
        print(f'\n  [{i}/{len(equities)}] {symbol}{suffix}')

        raw = fetch_eod(breeze, breeze_code, from_date, to_date)
        if not raw:
            print(f'    No data returned')
            failed += 1
            failed_symbols.append(symbol)
            continue

        print(f'    Fetched {len(raw)} candles')
        records = [transform_record(r, 'equity_id', eq['id']) for r in raw]
        n = upsert_eod(sb, 'km_equity_eod', records)
        total += n
        print(f'    Inserted {n} records')

    print(f'\n  EQUITY SUMMARY: {total} inserted, {failed} failed, {skipped} skipped (no breeze code)')
    if failed_symbols and len(failed_symbols) <= 20:
        print(f'  Failed: {", ".join(failed_symbols)}')


# ═════════════════════════════════════════════════════════════════════════════
# CLI
# ═════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description='Download EOD data from ICICI Breeze into Supabase'
    )
    parser.add_argument('--mode', choices=['index', 'equity', 'both'], default='both')
    parser.add_argument('--days', type=int, default=365)
    parser.add_argument('--from', dest='from_date', type=str)
    parser.add_argument('--to', dest='to_date', type=str)
    parser.add_argument('--symbol', type=str, help='Single symbol to download')
    parser.add_argument('--session-token', type=str, default='')
    parser.add_argument('--dry-run', action='store_true')

    args = parser.parse_args()

    to_dt = parse_date(args.to_date) if args.to_date else datetime.now()
    from_dt = parse_date(args.from_date) if args.from_date else to_dt - timedelta(days=args.days)

    print('=' * 60)
    print('KALA-DRISHTI EOD DOWNLOADER (ICICI Breeze)')
    print('=' * 60)
    print(f'  Mode   : {args.mode}')
    print(f'  Period : {from_dt.strftime("%Y-%m-%d")} to {to_dt.strftime("%Y-%m-%d")}')
    print(f'  Symbol : {args.symbol or "ALL"}')
    print()

    session_token = args.session_token or BREEZE_SESSION_TOKEN
    breeze = init_breeze(session_token)
    sb = init_supabase()

    if args.dry_run:
        print('\n[DRY RUN] Would download:\n')
        if args.mode in ('index', 'both'):
            rows = sb.select('km_index_symbols', 'name,vendor_codes')
            mapped = [r for r in rows if (r.get('vendor_codes') or {}).get('breeze')]
            print(f'  Indices: {len(mapped)} with breeze code out of {len(rows)} total')
        if args.mode in ('equity', 'both'):
            rows = sb.select('km_equity_symbols', 'symbol,vendor_codes')
            mapped = [r for r in rows if (r.get('vendor_codes') or {}).get('breeze')]
            print(f'  Equities: {len(mapped)} with breeze code out of {len(rows)} total')
        return

    if args.mode in ('index', 'both'):
        download_index_eod(breeze, sb, from_dt, to_dt, single_name=args.symbol)
    if args.mode in ('equity', 'both'):
        download_equity_eod(breeze, sb, from_dt, to_dt, single_symbol=args.symbol)

    print('\n' + '=' * 60)
    print('DOWNLOAD COMPLETE')
    print('=' * 60)


if __name__ == '__main__':
    main()
