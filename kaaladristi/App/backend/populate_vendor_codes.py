"""
Vendor Code Mapper for Kāla-Drishti
=====================================
Populates the vendor_codes JSONB column in km_equity_symbols and km_index_symbols.

Each vendor (ICICI Breeze, NSE, BSE, Screener, etc.) uses different stock codes.
This script maps our NSE symbols to vendor-specific codes and saves them to the DB.

Currently supported vendors:
  - breeze: ICICI Breeze ISEC stock codes (via Breeze SDK master data)
  - nse:    NSE trading symbols (already our primary key, saved for completeness)

Future vendors:
  - bse:      BSE scrip codes
  - screener: Screener.in slugs
  - yahoo:    Yahoo Finance tickers

Usage
-----
  # Step 1: Diagnose — see what Breeze SDK exposes after session init
  python populate_vendor_codes.py --diagnose --session-token <TOKEN>

  # Step 2: Populate — map all equities and save to Supabase
  python populate_vendor_codes.py --session-token <TOKEN>

  # Only populate for a single symbol
  python populate_vendor_codes.py --symbol RELIANCE --session-token <TOKEN>

  # Show current vendor_codes for a symbol (no Breeze session needed)
  python populate_vendor_codes.py --show --symbol RELIANCE
"""

import os
import sys
import json
import argparse
import csv
import io
from datetime import datetime
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

CACHE_FILE = os.path.join(script_dir, '.breeze_isec_cache.json')


# ═════════════════════════════════════════════════════════════════════════════
# SUPABASE REST CLIENT
# ═════════════════════════════════════════════════════════════════════════════

class SupabaseREST:
    """Minimal Supabase PostgREST wrapper."""

    def __init__(self, url: str, key: str):
        self.base = f'{url.rstrip("/")}/rest/v1'
        self.headers = {
            'apikey': key,
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json',
        }

    def select(self, table: str, columns: str = '*', filters: dict = None,
               order: str = None) -> list:
        url = f'{self.base}/{table}?select={columns}'
        if filters:
            for k, v in filters.items():
                url += f'&{k}=eq.{v}'
        if order:
            url += f'&order={order}'
        resp = requests.get(url, headers=self.headers)
        resp.raise_for_status()
        return resp.json()

    def patch(self, table: str, filters: dict, data: dict) -> bool:
        url = f'{self.base}/{table}'
        for k, v in filters.items():
            url += f'?{k}=eq.{v}' if '?' not in url else f'&{k}=eq.{v}'
        headers = {**self.headers, 'Prefer': 'return=minimal'}
        resp = requests.patch(url, headers=headers, json=data)
        return resp.status_code in (200, 204)


# ═════════════════════════════════════════════════════════════════════════════
# BREEZE SDK INSPECTION
# ═════════════════════════════════════════════════════════════════════════════

def init_breeze(session_token: str):
    """Initialize Breeze client."""
    try:
        from breeze_connect import BreezeConnect
    except ImportError:
        print('ERROR: pip install breeze-connect')
        sys.exit(1)

    breeze = BreezeConnect(api_key=BREEZE_API_KEY)
    breeze.generate_session(api_secret=BREEZE_API_SECRET, session_token=session_token)
    return breeze


def diagnose_breeze(breeze):
    """Print all non-callable, non-private attributes of Breeze SDK after session init."""
    print('\n' + '=' * 60)
    print('BREEZE SDK INTERNAL ATTRIBUTES')
    print('=' * 60)

    for attr in sorted(dir(breeze)):
        if attr.startswith('_'):
            continue
        val = getattr(breeze, attr, None)
        if callable(val):
            continue
        type_name = type(val).__name__

        if isinstance(val, (dict, list)):
            print(f'\n  {attr}: {type_name} ({len(val)} entries)')
            if isinstance(val, dict):
                for k in list(val.keys())[:5]:
                    v = val[k]
                    if isinstance(v, str) and len(v) > 100:
                        v = v[:100] + '...'
                    print(f'    [{k}] = {v}')
            elif isinstance(val, list) and val:
                for item in val[:5]:
                    if isinstance(item, str) and len(item) > 100:
                        item = item[:100] + '...'
                    print(f'    {item}')
            if len(val) > 5:
                print(f'    ... and {len(val) - 5} more')
        elif isinstance(val, str):
            display = val if len(val) < 100 else val[:100] + '...'
            print(f'\n  {attr}: {type_name} = "{display}"')
        else:
            print(f'\n  {attr}: {type_name} = {val}')


def extract_isec_mapping(breeze) -> dict:
    """
    Extract NSE symbol -> ISEC code mapping from Breeze SDK's internal data.
    After generate_session(), the SDK downloads master files and stores them.
    This function tries to find and parse that data.

    Returns dict: {NSE_SYMBOL: ISEC_CODE}
    """
    mapping = {}

    # Strategy 1: Look for dict/list attributes containing stock data
    for attr_name in dir(breeze):
        if attr_name.startswith('_'):
            continue
        val = getattr(breeze, attr_name, None)
        if val is None or callable(val):
            continue

        # Look for dict of dicts (token -> stock info)
        if isinstance(val, dict) and len(val) > 100:
            sample = next(iter(val.values()), None)
            if isinstance(sample, dict):
                # Check if it has stock-related keys
                sample_keys = set(k.lower() for k in sample.keys())
                has_exchange = any(k in sample_keys for k in
                                  ['exchange_code', 'exchangecode', 'symbol', 'nse_code'])
                has_isec = any(k in sample_keys for k in
                               ['short_name', 'shortname', 'isec_code', 'stock_code'])
                if has_exchange and has_isec:
                    print(f'  Found mapping in {attr_name} ({len(val)} entries)')
                    for key, item in val.items():
                        nse = (item.get('exchange_code') or item.get('exchangecode')
                               or item.get('symbol') or '').strip().upper()
                        isec = (item.get('short_name') or item.get('shortname')
                                or item.get('isec_code') or item.get('stock_code')
                                or '').strip().upper()
                        series = (item.get('series') or '').strip().upper()
                        if series and series != 'EQ':
                            continue
                        if nse and isec:
                            mapping[nse] = isec
                    if mapping:
                        return mapping

        # Look for list of dicts
        if isinstance(val, list) and len(val) > 100:
            sample = val[0] if val else None
            if isinstance(sample, dict):
                sample_keys = set(k.lower() for k in sample.keys())
                has_exchange = any(k in sample_keys for k in
                                  ['exchange_code', 'exchangecode', 'symbol', 'nse_code'])
                has_isec = any(k in sample_keys for k in
                               ['short_name', 'shortname', 'isec_code', 'stock_code'])
                if has_exchange and has_isec:
                    print(f'  Found mapping in {attr_name} ({len(val)} entries)')
                    for item in val:
                        nse = (item.get('exchange_code') or item.get('exchangecode')
                               or item.get('symbol') or '').strip().upper()
                        isec = (item.get('short_name') or item.get('shortname')
                                or item.get('isec_code') or item.get('stock_code')
                                or '').strip().upper()
                        series = (item.get('series') or '').strip().upper()
                        if series and series != 'EQ':
                            continue
                        if nse and isec:
                            mapping[nse] = isec
                    if mapping:
                        return mapping

        # Look for CSV-like string (some SDKs store raw CSV)
        if isinstance(val, str) and len(val) > 1000 and ',' in val:
            lines = val.strip().split('\n')
            if len(lines) > 50:  # Likely a master file
                print(f'  Found CSV-like data in {attr_name} ({len(lines)} lines)')
                try:
                    reader = csv.DictReader(io.StringIO(val))
                    for row in reader:
                        # Normalize keys to lowercase
                        row_lower = {k.lower().strip(): v for k, v in row.items()}
                        nse = (row_lower.get('exchange_code') or row_lower.get('exchangecode')
                               or row_lower.get('symbol') or '').strip().upper()
                        isec = (row_lower.get('short_name') or row_lower.get('shortname')
                                or row_lower.get('isec_code') or row_lower.get('stock_code')
                                or '').strip().upper()
                        series = (row_lower.get('series') or '').strip().upper()
                        if series and series != 'EQ':
                            continue
                        if nse and isec:
                            mapping[nse] = isec
                    if mapping:
                        return mapping
                except Exception:
                    pass

    return mapping


# ═════════════════════════════════════════════════════════════════════════════
# INDEX BREEZE CODES (hardcoded — indices don't appear in script master)
# ═════════════════════════════════════════════════════════════════════════════

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


# ═════════════════════════════════════════════════════════════════════════════
# POPULATE FUNCTIONS
# ═════════════════════════════════════════════════════════════════════════════

def populate_equity_codes(sb, isec_map: dict, single_symbol: str = None):
    """Update vendor_codes for all equities using the ISEC mapping."""
    print('\n' + '=' * 60)
    print('POPULATING EQUITY VENDOR CODES')
    print('=' * 60)

    if single_symbol:
        equities = sb.select('km_equity_symbols', 'id,symbol,vendor_codes',
                             filters={'symbol': single_symbol.upper()})
    else:
        equities = sb.select('km_equity_symbols', 'id,symbol,vendor_codes', order='symbol')

    print(f'  Equities in DB: {len(equities)}')
    print(f'  ISEC mappings available: {len(isec_map)}')

    updated = 0
    skipped = 0
    not_found = []

    for eq in equities:
        symbol = eq['symbol']
        eq_id = eq['id']
        existing_vc = eq.get('vendor_codes') or {}

        # Look up ISEC code
        isec_code = isec_map.get(symbol.upper())

        if not isec_code:
            skipped += 1
            not_found.append(symbol)
            continue

        # Build vendor_codes
        new_vc = {
            **existing_vc,
            'nse': symbol,
            'breeze': isec_code,
        }

        # Skip if nothing changed
        if existing_vc.get('breeze') == isec_code and existing_vc.get('nse') == symbol:
            continue

        sb.patch('km_equity_symbols', {'id': eq_id}, {'vendor_codes': json.dumps(new_vc)})
        updated += 1

    print(f'\n  Updated: {updated}')
    print(f'  No ISEC mapping: {skipped}')
    if not_found and len(not_found) <= 30:
        print(f'  Unmapped symbols: {", ".join(not_found[:30])}')
    elif not_found:
        print(f'  Unmapped symbols: {", ".join(not_found[:20])}... and {len(not_found) - 20} more')


def populate_index_codes(sb):
    """Update vendor_codes for indices using the hardcoded INDEX_BREEZE_MAP."""
    print('\n' + '=' * 60)
    print('POPULATING INDEX VENDOR CODES')
    print('=' * 60)

    indices = sb.select('km_index_symbols', 'id,name,vendor_codes')
    print(f'  Indices in DB: {len(indices)}')

    updated = 0
    skipped = 0

    for idx in indices:
        name = idx['name']
        idx_id = idx['id']
        existing_vc = idx.get('vendor_codes') or {}

        breeze_code = INDEX_BREEZE_MAP.get(name.upper())
        if not breeze_code:
            skipped += 1
            continue

        new_vc = {
            **existing_vc,
            'nse_name': name,
            'breeze': breeze_code,
        }

        if existing_vc.get('breeze') == breeze_code:
            continue

        sb.patch('km_index_symbols', {'id': idx_id}, {'vendor_codes': json.dumps(new_vc)})
        updated += 1

    print(f'\n  Updated: {updated}')
    print(f'  No Breeze mapping: {skipped}')


def show_vendor_codes(sb, symbol: str):
    """Display current vendor_codes for a symbol."""
    equities = sb.select('km_equity_symbols', 'symbol,vendor_codes',
                         filters={'symbol': symbol.upper()})
    if equities:
        print(f'\n  Equity: {equities[0]["symbol"]}')
        print(f'  vendor_codes: {json.dumps(equities[0].get("vendor_codes") or {}, indent=4)}')
        return

    indices = sb.select('km_index_symbols', 'name,vendor_codes')
    for idx in indices:
        if symbol.upper() in idx['name'].upper():
            print(f'\n  Index: {idx["name"]}')
            print(f'  vendor_codes: {json.dumps(idx.get("vendor_codes") or {}, indent=4)}')
            return

    print(f'  Symbol "{symbol}" not found in equities or indices')


# ═════════════════════════════════════════════════════════════════════════════
# CLI
# ═════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description='Populate vendor_codes in km_equity_symbols and km_index_symbols'
    )
    parser.add_argument(
        '--session-token', type=str, default='',
        help='Breeze session token (required for --diagnose and populate modes)'
    )
    parser.add_argument(
        '--symbol', type=str,
        help='Only process this symbol'
    )
    parser.add_argument(
        '--diagnose', action='store_true',
        help='Print Breeze SDK internals to debug stock code resolution'
    )
    parser.add_argument(
        '--show', action='store_true',
        help='Show current vendor_codes for --symbol (no Breeze session needed)'
    )
    parser.add_argument(
        '--skip-equity', action='store_true',
        help='Skip equity vendor codes (only do indices)'
    )
    parser.add_argument(
        '--skip-index', action='store_true',
        help='Skip index vendor codes (only do equities)'
    )

    args = parser.parse_args()

    print('=' * 60)
    print('KALA-DRISHTI VENDOR CODE MAPPER')
    print('=' * 60)

    # Init Supabase (always needed)
    sb = SupabaseREST(SUPABASE_URL, SUPABASE_KEY)
    print('Supabase connected')

    # Show mode — no Breeze needed
    if args.show:
        if not args.symbol:
            print('ERROR: --show requires --symbol')
            sys.exit(1)
        show_vendor_codes(sb, args.symbol)
        return

    # All other modes need Breeze session
    token = args.session_token or os.getenv('BREEZE_SESSION_TOKEN', '')
    if not token:
        print('ERROR: --session-token is required (or set BREEZE_SESSION_TOKEN in .env)')
        sys.exit(1)

    print('Initializing Breeze...')
    breeze = init_breeze(token)
    print('  Breeze connected')

    # Diagnose mode
    if args.diagnose:
        diagnose_breeze(breeze)
        return

    # Extract ISEC mapping from SDK
    print('\nExtracting ISEC stock code mapping from Breeze SDK...')
    isec_map = extract_isec_mapping(breeze)

    if not isec_map:
        print('  WARNING: Could not extract ISEC mapping from SDK.')
        print('  Run with --diagnose first to inspect available data.')
        print('  Then we can update the extraction logic.')
        sys.exit(1)

    print(f'  Extracted {len(isec_map)} NSE -> ISEC mappings')

    # Cache for other tools
    with open(CACHE_FILE, 'w') as f:
        json.dump({'date': datetime.now().strftime('%Y-%m-%d'), 'map': isec_map}, f)
    print(f'  Cached to {CACHE_FILE}')

    # Populate
    if not args.skip_equity:
        populate_equity_codes(sb, isec_map, single_symbol=args.symbol)

    if not args.skip_index:
        populate_index_codes(sb)

    print('\n' + '=' * 60)
    print('VENDOR CODE MAPPING COMPLETE')
    print('=' * 60)


if __name__ == '__main__':
    main()
