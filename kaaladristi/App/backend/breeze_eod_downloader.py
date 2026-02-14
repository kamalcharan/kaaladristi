"""
ICICI Breeze EOD Data Downloader for Kāla-Drishti
===================================================
Downloads end-of-day (1-day) OHLC data from ICICI Breeze API
and inserts into Supabase km_index_eod / km_equity_eod tables.

Prerequisites
-------------
1. pip install breeze-connect requests python-dotenv
2. Create an app at https://api.icicidirect.com
3. Set env vars in App/frontend/.env:
     BREEZE_API_KEY=your_api_key
     BREEZE_API_SECRET=your_api_secret
4. Before each run, generate a session token:
     Visit: https://api.icicidirect.com/apiuser/login?api_key=<YOUR_KEY>
     Copy the session token from the redirect URL
     Pass it via --session-token flag or BREEZE_SESSION_TOKEN env var

Usage
-----
  # Download last 1 year of EOD data for all equities
  python breeze_eod_downloader.py --mode equity --days 365

  # Download last 30 days for indices
  python breeze_eod_downloader.py --mode index --days 30

  # Download specific date range for both
  python breeze_eod_downloader.py --mode both --from 2025-01-01 --to 2026-02-14

  # Download for a single stock
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
SUPABASE_KEY = os.getenv('VITE_SUPABASE_SERVICE_KEY')  # service role for writes
BREEZE_API_KEY = os.getenv('BREEZE_API_KEY', '')
BREEZE_API_SECRET = os.getenv('BREEZE_API_SECRET', '')
BREEZE_SESSION_TOKEN = os.getenv('BREEZE_SESSION_TOKEN', '')

# ─── Constants ────────────────────────────────────────────────────────────────
BATCH_SIZE = 500
REQUEST_DELAY = 0.5  # seconds between Breeze API calls to avoid rate limit
MAX_CANDLES_PER_REQUEST = 1000  # Breeze limit

# Breeze stock_code mapping for NSE indices
# Key = our km_index_symbols.name (uppercase), Value = Breeze stock_code
INDEX_BREEZE_MAP = {
    'NIFTY 50': 'NIFTY',
    'NIFTY BANK': 'CNXBAN',
    'NIFTY NEXT 50': 'NIFNX5',
    'NIFTY IT': 'CNXIT',
    'NIFTY AUTO': 'CNXAUT',
    'NIFTY FMCG': 'CNXFMC',
    'NIFTY METAL': 'CNXMET',
    'NIFTY PHARMA': 'CNXPHA',
    'NIFTY ENERGY': 'CNXENR',
    'NIFTY REALTY': 'CNXREA',
    'NIFTY INFRASTRUCTURE': 'CNXINF',
    'NIFTY PSE': 'CNXPSE',
    'NIFTY FINANCIAL SERVICES': 'CNXFIN',
    'NIFTY COMMODITIES': 'CNXCOM',
    'NIFTY MEDIA': 'CNXMED',
    'NIFTY PRIVATE BANK': 'CNXPVB',
    'NIFTY 100': 'CNX100',
    'NIFTY 200': 'CNX200',
    'NIFTY 500': 'CNX500',
    'NIFTY MIDCAP 50': 'CNXMC5',
    'NIFTY MIDCAP 100': 'CNXM10',
    'NIFTY SMLCAP 100': 'CNXSC1',
    'NIFTY CONSUMER DURABLES': 'CNXCDU',
    'NIFTY OIL AND GAS': 'CNXOIL',
    'NIFTY HEALTHCARE INDEX': 'CNXHLC',
    'NIFTY MNC': 'CNXMNC',
    'NIFTY PSU BANK': 'CNXPSU',
    'NIFTY CPSE': 'CNXCPS',
    'NIFTY GROWSECT 15': 'CNXGR1',
    'NIFTY MIDCAP 150': 'CNXM15',
    'NIFTY SMLCAP 250': 'CNXS25',
    'NIFTY SMLCAP 50': 'CNXS50',
    'NIFTY DIVIDEND OPPORTUNITIES 50': 'CNXDO5',
    'NIFTY100 QUALITY 30': 'CNXQ30',
    'NIFTY50 VALUE 20': 'CNXV20',
    'NIFTY GROWTH SECTORS 15': 'CNXGS1',
    'NIFTY HIGH BETA 50': 'CNXHB5',
    'NIFTY LOW VOLATILITY 50': 'CNXLV5',
    'NIFTY ALPHA 50': 'CNXAL5',
    'NIFTY100 EQUAL WEIGHT': 'CNXEQ1',
    'NIFTY100 LOW VOLATILITY 30': 'CNXLV3',
    'NIFTY50 EQUAL WEIGHT': 'CNXE50',
}


def iso_ts(dt: datetime) -> str:
    """Format datetime as Breeze-compatible ISO timestamp."""
    return dt.strftime('%Y-%m-%dT%H:%M:%S.000Z')


def parse_date(s: str) -> datetime:
    """Parse YYYY-MM-DD string to datetime."""
    return datetime.strptime(s, '%Y-%m-%d')


# ═════════════════════════════════════════════════════════════════════════════
# BREEZE CLIENT
# ═════════════════════════════════════════════════════════════════════════════

def init_breeze(session_token: str):
    """Initialize and authenticate the Breeze client."""
    try:
        from breeze_connect import BreezeConnect
    except ImportError:
        print('ERROR: breeze-connect not installed. Run: pip install breeze-connect')
        sys.exit(1)

    if not BREEZE_API_KEY or not BREEZE_API_SECRET:
        print('ERROR: BREEZE_API_KEY and BREEZE_API_SECRET must be set in .env')
        print(f'  .env path: {env_path}')
        sys.exit(1)

    token = session_token or BREEZE_SESSION_TOKEN
    if not token:
        login_url = (
            'https://api.icicidirect.com/apiuser/login?api_key='
            + urllib.parse.quote_plus(BREEZE_API_KEY)
        )
        print('ERROR: Session token required.')
        print(f'  1. Open this URL in your browser:\n     {login_url}')
        print('  2. Log in with your ICICI Direct credentials')
        print('  3. Copy the session token from the redirect URL')
        print('  4. Re-run with: --session-token <TOKEN>')
        print('     Or set BREEZE_SESSION_TOKEN in .env')
        sys.exit(1)

    print('Connecting to ICICI Breeze...')
    breeze = BreezeConnect(api_key=BREEZE_API_KEY)
    breeze.generate_session(api_secret=BREEZE_API_SECRET, session_token=token)
    print('  Connected successfully')
    return breeze


# ═════════════════════════════════════════════════════════════════════════════
# SUPABASE REST CLIENT (lightweight, no supabase-py dependency)
# ═════════════════════════════════════════════════════════════════════════════

class SupabaseREST:
    """Minimal Supabase PostgREST wrapper using requests."""

    def __init__(self, url: str, key: str):
        self.base = f'{url.rstrip("/")}/rest/v1'
        self.headers = {
            'apikey': key,
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json',
        }

    def select(self, table: str, columns: str = '*', filters: dict = None,
               order: str = None, ilike: tuple = None) -> list:
        """SELECT rows. Returns list of dicts."""
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
        """UPSERT rows (insert or update on conflict). Returns count."""
        url = f'{self.base}/{table}'
        headers = {
            **self.headers,
            'Prefer': f'resolution=merge-duplicates,return=minimal',
        }
        # PostgREST uses on_conflict as query param
        url += f'?on_conflict={on_conflict}'
        resp = requests.post(url, headers=headers, json=records)
        resp.raise_for_status()
        return len(records)

    def insert(self, table: str, record: dict) -> bool:
        """INSERT single row. Returns True on success."""
        url = f'{self.base}/{table}'
        headers = {**self.headers, 'Prefer': 'return=minimal'}
        resp = requests.post(url, headers=headers, json=record)
        return resp.status_code in (200, 201)

    def patch(self, table: str, filters: dict, data: dict) -> bool:
        """UPDATE rows matching filters. Returns True on success."""
        url = f'{self.base}/{table}'
        for k, v in filters.items():
            url += f'?{k}=eq.{v}' if '?' not in url else f'&{k}=eq.{v}'
        headers = {**self.headers, 'Prefer': 'return=minimal'}
        resp = requests.patch(url, headers=headers, json=data)
        return resp.status_code in (200, 204)


def init_supabase():
    """Initialize Supabase REST client."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print('ERROR: VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_KEY must be set')
        print(f'  .env path: {env_path}')
        sys.exit(1)

    print('Connecting to Supabase...')
    sb = SupabaseREST(SUPABASE_URL, SUPABASE_KEY)
    # Quick connectivity test
    try:
        sb.select('km_index_symbols', columns='id', filters=None)
        print('  Connected successfully')
    except Exception as e:
        print(f'  Connection failed: {e}')
        sys.exit(1)
    return sb


# ═════════════════════════════════════════════════════════════════════════════
# STOCK CODE RESOLUTION
# ═════════════════════════════════════════════════════════════════════════════

# ICICI Direct publishes NSE script master CSV at this URL
ISEC_MASTER_URL = 'https://directlink.icicidirect.com/NewSecMaster/NSEScripMaster.csv'

# Cache: NSE symbol -> Breeze ISEC stock code
_isec_map = {}
_isec_loaded = False


def load_isec_master():
    """
    Download ICICI's NSE script master CSV to build NSE symbol -> ISEC code mapping.
    The CSV has columns like: Token, ShortName, Series, CompanyName, ExchangeCode, etc.
    ShortName = ISEC code (what Breeze API expects)
    ExchangeCode = NSE trading symbol (what we store in km_equity_symbols)
    """
    global _isec_map, _isec_loaded
    if _isec_loaded:
        return

    cache_file = os.path.join(script_dir, '.breeze_isec_cache.json')

    # Try loading from today's cache first
    if os.path.exists(cache_file):
        try:
            with open(cache_file, 'r') as f:
                cached = json.load(f)
            if cached.get('date') == datetime.now().strftime('%Y-%m-%d'):
                _isec_map = cached.get('map', {})
                _isec_loaded = True
                print(f'  Loaded {len(_isec_map)} ISEC mappings from cache')
                return
        except Exception:
            pass

    print('  Downloading ISEC stock master from ICICI Direct...')
    try:
        resp = requests.get(ISEC_MASTER_URL, timeout=30)
        resp.raise_for_status()
        lines = resp.text.strip().split('\n')

        if len(lines) < 2:
            print('  WARNING: ISEC master CSV is empty')
            _isec_loaded = True
            return

        # Parse header to find column indices
        header = [h.strip().lower() for h in lines[0].split(',')]

        # Try common column name patterns
        short_name_idx = None
        exchange_code_idx = None
        series_idx = None

        for i, h in enumerate(header):
            if h in ('shortname', 'short_name', 'isec_code'):
                short_name_idx = i
            elif h in ('exchangecode', 'exchange_code', 'nse_code', 'symbol'):
                exchange_code_idx = i
            elif h in ('series',):
                series_idx = i

        if short_name_idx is None or exchange_code_idx is None:
            # Fallback: dump header for debugging
            print(f'  WARNING: Could not find expected columns in ISEC master')
            print(f'  Header columns: {header}')
            print('  Trying positional fallback (col 1=ShortName, col 4=ExchangeCode)...')
            short_name_idx = 1
            exchange_code_idx = 4
            series_idx = 2 if len(header) > 2 else None

        for line in lines[1:]:
            cols = line.split(',')
            if len(cols) <= max(short_name_idx, exchange_code_idx):
                continue

            isec_code = cols[short_name_idx].strip().upper()
            nse_sym = cols[exchange_code_idx].strip().upper()

            # Only map EQ series (skip futures, options, etc.)
            if series_idx is not None and len(cols) > series_idx:
                series = cols[series_idx].strip().upper()
                if series and series != 'EQ':
                    continue

            if nse_sym and isec_code:
                _isec_map[nse_sym] = isec_code

        print(f'  Loaded {len(_isec_map)} ISEC mappings')

        # Cache for today
        with open(cache_file, 'w') as f:
            json.dump({'date': datetime.now().strftime('%Y-%m-%d'), 'map': _isec_map}, f)

    except Exception as e:
        print(f'  WARNING: ISEC master download failed: {e}')
        print('  Will try NSE symbols directly (some may fail)')

    _isec_loaded = True


def resolve_breeze_code(nse_symbol: str) -> str:
    """
    Resolve NSE trading symbol to Breeze ISEC stock code.
    Falls back to NSE symbol if no mapping found.
    """
    if _isec_map:
        isec = _isec_map.get(nse_symbol.upper())
        if isec:
            return isec

    # Fallback: try NSE symbol as-is (works for many stocks)
    return nse_symbol


# ═════════════════════════════════════════════════════════════════════════════
# DATA FETCHERS
# ═════════════════════════════════════════════════════════════════════════════

def fetch_index_eod(breeze, stock_code: str, from_date: datetime, to_date: datetime) -> list:
    """
    Fetch EOD data for an index from Breeze.
    Returns list of dicts with OHLC fields, or empty list on failure.
    """
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
                print(f'    Breeze error for {stock_code}: {resp["Error"]}')
                break
        except Exception as e:
            print(f'    Exception fetching {stock_code}: {e}')
            break

        cursor = chunk_end + timedelta(days=1)
        time.sleep(REQUEST_DELAY)

    return records


def fetch_equity_eod(breeze, stock_code: str, from_date: datetime, to_date: datetime) -> list:
    """
    Fetch EOD data for an equity from Breeze.
    Returns list of dicts with OHLC fields, or empty list on failure.
    """
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
                print(f'    Breeze error for {stock_code}: {resp["Error"]}')
                break
            else:
                # Empty Success array — stock code likely incorrect
                print(f'    Empty response (stock_code "{stock_code}" may not exist in Breeze)')
                break
        except Exception as e:
            print(f'    Exception fetching {stock_code}: {e}')
            break

        cursor = chunk_end + timedelta(days=1)
        time.sleep(REQUEST_DELAY)

    return records


# ═════════════════════════════════════════════════════════════════════════════
# TRANSFORM & LOAD
# ═════════════════════════════════════════════════════════════════════════════

def safe_float(val):
    """Convert to float, return None on failure."""
    if val is None:
        return None
    try:
        return round(float(val), 2)
    except (ValueError, TypeError):
        return None


def safe_int(val):
    """Convert to int, return None on failure."""
    if val is None:
        return None
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return None


def transform_breeze_record(raw: dict, fk_field: str, fk_id: int) -> dict:
    """
    Transform a single Breeze API record into our km_*_eod schema.
    Breeze returns fields: datetime, open, high, low, close, volume, etc.
    """
    # Parse trade date from Breeze datetime field
    dt_str = raw.get('datetime', '') or raw.get('date', '')
    if isinstance(dt_str, str) and len(dt_str) >= 10:
        trade_date = dt_str[:10]  # YYYY-MM-DD
    else:
        trade_date = str(dt_str)[:10]

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


def upsert_eod_batch(sb: SupabaseREST, table: str, records: list) -> int:
    """
    Upsert EOD records into Supabase, merging on conflict.
    Returns number of successfully inserted records.
    """
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
            # Fallback: individual inserts to skip duplicates
            for rec in batch:
                if sb.insert(table, rec):
                    inserted += 1
    return inserted


# ═════════════════════════════════════════════════════════════════════════════
# DOWNLOAD ORCHESTRATORS
# ═════════════════════════════════════════════════════════════════════════════

def download_index_eod(breeze, sb, from_date: datetime, to_date: datetime, single_name: str = None):
    """Download EOD data for indices and insert into km_index_eod."""
    print('\n' + '=' * 60)
    print('DOWNLOADING INDEX EOD DATA')
    print('=' * 60)

    # Fetch index masters from Supabase
    if single_name:
        indices = sb.select('km_index_symbols', 'id,name,category',
                            ilike=('name', f'%{single_name}%'))
    else:
        indices = sb.select('km_index_symbols', 'id,name,category')

    if not indices:
        print('  No indices found in km_index_symbols')
        return

    print(f'  Found {len(indices)} indices in database')
    total_records = 0
    skipped = 0

    for idx in indices:
        name = idx['name']
        idx_id = idx['id']
        breeze_code = INDEX_BREEZE_MAP.get(name.upper())

        if not breeze_code:
            print(f'  SKIP {name} - no Breeze stock code mapping')
            skipped += 1
            continue

        print(f'\n  [{name}] -> Breeze code: {breeze_code}')
        raw_data = fetch_index_eod(breeze, breeze_code, from_date, to_date)

        if not raw_data:
            print(f'    No data returned')
            continue

        print(f'    Fetched {len(raw_data)} candles')

        # Transform
        eod_records = [transform_breeze_record(r, 'index_id', idx_id) for r in raw_data]

        # Insert
        inserted = upsert_eod_batch(sb, 'km_index_eod', eod_records)
        total_records += inserted
        print(f'    Inserted {inserted} records into km_index_eod')

    print(f'\n  INDEX SUMMARY: {total_records} records inserted, {skipped} indices skipped (no mapping)')


def download_equity_eod(breeze, sb, from_date: datetime, to_date: datetime, single_symbol: str = None):
    """Download EOD data for equities and insert into km_equity_eod."""
    print('\n' + '=' * 60)
    print('DOWNLOADING EQUITY EOD DATA')
    print('=' * 60)

    # Fetch equity masters from Supabase
    if single_symbol:
        equities = sb.select('km_equity_symbols', 'id,symbol,vendor_codes',
                             filters={'symbol': single_symbol.upper()},
                             order='symbol')
    else:
        equities = sb.select('km_equity_symbols', 'id,symbol,vendor_codes', order='symbol')

    if not equities:
        print('  No equities found in km_equity_symbols')
        return

    # Load ISEC master for stock code resolution
    load_isec_master()

    print(f'  Found {len(equities)} equities in database')
    total_records = 0
    failed = 0
    failed_symbols = []

    for i, eq in enumerate(equities, 1):
        symbol = eq['symbol']
        eq_id = eq['id']

        # Check if vendor_codes already has a breeze code saved
        existing_vc = eq.get('vendor_codes') or {}
        saved_breeze = existing_vc.get('breeze', '')

        # Resolve NSE symbol to Breeze ISEC stock code
        breeze_code = saved_breeze or resolve_breeze_code(symbol)
        suffix = f' (ISEC: {breeze_code})' if breeze_code != symbol else ''

        print(f'\n  [{i}/{len(equities)}] {symbol}{suffix}')
        raw_data = fetch_equity_eod(breeze, breeze_code, from_date, to_date)

        if not raw_data:
            print(f'    No data returned')
            failed += 1
            failed_symbols.append(symbol)
            continue

        print(f'    Fetched {len(raw_data)} candles')

        # Save resolved breeze code to vendor_codes if not already there
        if breeze_code != symbol and not saved_breeze:
            vc = {**existing_vc, 'breeze': breeze_code, 'nse': symbol}
            sb.patch('km_equity_symbols', {'id': eq_id}, {'vendor_codes': json.dumps(vc)})

        # Transform
        eod_records = [transform_breeze_record(r, 'equity_id', eq_id) for r in raw_data]

        # Insert
        inserted = upsert_eod_batch(sb, 'km_equity_eod', eod_records)
        total_records += inserted
        print(f'    Inserted {inserted} records')

    print(f'\n  EQUITY SUMMARY: {total_records} records inserted, {failed} equities failed')
    if failed_symbols and len(failed_symbols) <= 20:
        print(f'  Failed: {", ".join(failed_symbols)}')


# ═════════════════════════════════════════════════════════════════════════════
# CLI
# ═════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description='Download EOD data from ICICI Breeze API into Supabase'
    )
    parser.add_argument(
        '--mode', choices=['index', 'equity', 'both'], default='both',
        help='What to download: index, equity, or both (default: both)'
    )
    parser.add_argument(
        '--days', type=int, default=365,
        help='Number of days of history to download (default: 365)'
    )
    parser.add_argument(
        '--from', dest='from_date', type=str,
        help='Start date YYYY-MM-DD (overrides --days)'
    )
    parser.add_argument(
        '--to', dest='to_date', type=str,
        help='End date YYYY-MM-DD (default: today)'
    )
    parser.add_argument(
        '--symbol', type=str,
        help='Download only this specific symbol/index name'
    )
    parser.add_argument(
        '--session-token', type=str, default='',
        help='Breeze session token (or set BREEZE_SESSION_TOKEN in .env)'
    )
    parser.add_argument(
        '--dry-run', action='store_true',
        help='Connect and list what would be downloaded, but do not fetch data'
    )

    args = parser.parse_args()

    # Resolve date range
    if args.to_date:
        to_dt = parse_date(args.to_date)
    else:
        to_dt = datetime.now()

    if args.from_date:
        from_dt = parse_date(args.from_date)
    else:
        from_dt = to_dt - timedelta(days=args.days)

    print('=' * 60)
    print('KALA-DRISHTI EOD DOWNLOADER (ICICI Breeze)')
    print('=' * 60)
    print(f'  Mode     : {args.mode}')
    print(f'  Period   : {from_dt.strftime("%Y-%m-%d")} to {to_dt.strftime("%Y-%m-%d")}')
    print(f'  Symbol   : {args.symbol or "ALL"}')
    print()

    # Init clients
    session_token = args.session_token or BREEZE_SESSION_TOKEN
    breeze = init_breeze(session_token)
    sb = init_supabase()

    if args.dry_run:
        print('\n[DRY RUN] Would download the following:\n')
        if args.mode in ('index', 'both'):
            rows = sb.select('km_index_symbols', 'name')
            names = [r['name'] for r in rows]
            mapped = [n for n in names if n.upper() in INDEX_BREEZE_MAP]
            print(f'  Indices: {len(mapped)} with Breeze mapping out of {len(names)} total')
            for n in mapped:
                print(f'    {n} -> {INDEX_BREEZE_MAP[n.upper()]}')
        if args.mode in ('equity', 'both'):
            rows = sb.select('km_equity_symbols', 'symbol')
            print(f'  Equities: {len(rows)} symbols')
        return

    # Download
    if args.mode in ('index', 'both'):
        download_index_eod(breeze, sb, from_dt, to_dt, single_name=args.symbol)

    if args.mode in ('equity', 'both'):
        download_equity_eod(breeze, sb, from_dt, to_dt, single_symbol=args.symbol)

    print('\n' + '=' * 60)
    print('DOWNLOAD COMPLETE')
    print('=' * 60)


if __name__ == '__main__':
    main()
