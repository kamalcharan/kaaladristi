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
import zipfile
from datetime import datetime
from urllib.request import urlopen
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


SECURITY_MASTER_URL = 'https://directlink.icicidirect.com/MotherAppMaster/SecurityMaster.zip'


def download_security_master_mapping() -> dict:
    """
    Download the ICICI SecurityMaster.zip directly and parse the NSE CSV
    to build an ISEC stock_code mapping.

    The ZIP contains CSV files per exchange; the NSE file has columns:
      Token, ShortName(ISEC), Series(?), CompanyName, ...

    Returns dict: {ISEC_CODE: ISEC_CODE} — keyed by the stock_code which
    is what the Breeze API expects for get_historical_data_v2().
    """
    print('  Downloading SecurityMaster.zip from ICICI...')
    try:
        resp = urlopen(SECURITY_MASTER_URL)
        zf = zipfile.ZipFile(io.BytesIO(resp.read()))
    except Exception as e:
        print(f'  Could not download SecurityMaster.zip: {e}')
        return {}

    # Find the NSE CSV file in the ZIP
    nse_file = None
    for name in zf.namelist():
        name_upper = name.upper()
        if 'NSE' in name_upper and 'FO' not in name_upper and name_upper.endswith('.CSV'):
            nse_file = name
            break

    if not nse_file:
        # Fall back: list all files for debugging
        print(f'  ZIP contents: {zf.namelist()[:10]}')
        print('  Could not find NSE CSV in SecurityMaster.zip')
        return {}

    print(f'  Parsing {nse_file}...')
    raw = zf.read(nse_file).decode('utf-8', errors='replace')
    lines = raw.strip().split('\n')

    # Log first line structure for diagnostics
    if lines:
        first_cols = lines[0].split(',')
        print(f'  CSV columns ({len(first_cols)}): {[c.strip().strip(chr(34))[:30] for c in first_cols[:8]]}')

    mapping = {}
    for line in lines:
        columns = line.split(',')
        if len(columns) < 4:
            continue
        token = columns[0].strip().strip('"')
        stock_code = columns[1].strip().strip('"')

        # Skip header or empty
        if not token or not stock_code or not token[0].isdigit():
            continue

        # The stock_code IS the ISEC code that Breeze API expects
        # Map it to itself — our DB symbols will be matched separately
        mapping[stock_code.upper()] = stock_code

    if mapping:
        print(f'  Found {len(mapping)} NSE stock codes in security master')

    return mapping


def extract_isec_mapping(breeze) -> dict:
    """
    Extract ISEC stock codes from Breeze SDK's internal data.
    After generate_session(), the SDK stores master data in:
      - stock_script_dict_list: list of 6 dicts [BSE, NSE, NDX, MCX, NFO, BFO]
        where each dict maps stock_code -> token
      - token_script_dict_list: list of 6 dicts
        where each dict maps token -> [stock_code, company_name]

    Returns dict: {ISEC_CODE: ISEC_CODE}
    """
    mapping = {}

    # Strategy 1: Use stock_script_dict_list[1] (NSE) directly
    sdk_list = getattr(breeze, 'stock_script_dict_list', None)
    if isinstance(sdk_list, list) and len(sdk_list) > 1:
        nse_dict = sdk_list[1]  # Index 1 = NSE
        if isinstance(nse_dict, dict) and len(nse_dict) > 10:
            print(f'  Found stock_script_dict_list[1] (NSE): {len(nse_dict)} entries')
            for stock_code in nse_dict:
                code = str(stock_code).strip().upper()
                if code:
                    mapping[code] = code
            if mapping:
                return mapping

    # Strategy 2: Use token_script_dict_list[1] (NSE)
    token_list = getattr(breeze, 'token_script_dict_list', None)
    if isinstance(token_list, list) and len(token_list) > 1:
        nse_tokens = token_list[1]
        if isinstance(nse_tokens, dict) and len(nse_tokens) > 10:
            print(f'  Found token_script_dict_list[1] (NSE): {len(nse_tokens)} entries')
            for token, info in nse_tokens.items():
                if isinstance(info, (list, tuple)) and len(info) >= 1:
                    code = str(info[0]).strip().upper()
                    if code:
                        mapping[code] = code
            if mapping:
                return mapping

    # Strategy 3: Generic search for dict/list attributes with stock data
    for attr_name in dir(breeze):
        if attr_name.startswith('_'):
            continue
        val = getattr(breeze, attr_name, None)
        if val is None or callable(val):
            continue

        # Look for large dicts with dict values (token -> stock info)
        if isinstance(val, dict) and len(val) > 100:
            sample = next(iter(val.values()), None)
            if isinstance(sample, dict):
                sample_keys = set(k.lower() for k in sample.keys())
                has_exchange = any(k in sample_keys for k in
                                  ['exchange_code', 'exchangecode', 'symbol', 'nse_code'])
                has_isec = any(k in sample_keys for k in
                               ['short_name', 'shortname', 'isec_code', 'stock_code'])
                if has_exchange and has_isec:
                    print(f'  Found mapping in {attr_name} ({len(val)} entries)')
                    for key, item in val.items():
                        isec = (item.get('short_name') or item.get('shortname')
                                or item.get('isec_code') or item.get('stock_code')
                                or '').strip().upper()
                        if isec:
                            mapping[isec] = isec
                    if mapping:
                        return mapping

        # Look for CSV-like strings
        if isinstance(val, str) and len(val) > 1000 and ',' in val:
            lines = val.strip().split('\n')
            if len(lines) > 50:
                print(f'  Found CSV-like data in {attr_name} ({len(lines)} lines)')
                try:
                    reader = csv.DictReader(io.StringIO(val))
                    for row in reader:
                        row_lower = {k.lower().strip(): v for k, v in row.items()}
                        isec = (row_lower.get('short_name') or row_lower.get('shortname')
                                or row_lower.get('isec_code') or row_lower.get('stock_code')
                                or '').strip().upper()
                        if isec:
                            mapping[isec] = isec
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
    """Update vendor_codes for all equities using the ISEC mapping.

    The isec_map can be keyed by either:
      - NSE trading symbol -> ISEC code  (old format, direct match)
      - ISEC code -> ISEC code            (from security master download)

    For the second format, we check if the NSE symbol exists as an ISEC code
    (many are identical, e.g. WIPRO, INFY, TCS), and if the symbol already
    has a breeze code from a prior run, we keep it.
    """
    print('\n' + '=' * 60)
    print('POPULATING EQUITY VENDOR CODES')
    print('=' * 60)

    if single_symbol:
        equities = sb.select('km_equity_symbols', 'id,symbol,vendor_codes',
                             filters={'symbol': single_symbol.upper()})
    else:
        equities = sb.select('km_equity_symbols', 'id,symbol,vendor_codes', order='symbol')

    print(f'  Equities in DB: {len(equities)}')
    print(f'  ISEC codes available: {len(isec_map)}')

    # Build a set of known ISEC codes for quick lookup
    isec_codes = set(isec_map.keys())

    updated = 0
    skipped = 0
    not_found = []

    for eq in equities:
        symbol = eq['symbol']
        eq_id = eq['id']
        existing_vc = eq.get('vendor_codes') or {}

        # Try to resolve ISEC code:
        # 1. Direct match: NSE symbol is the same as ISEC code (common case)
        # 2. Explicit mapping (if isec_map has NSE->ISEC entries)
        # 3. Keep existing breeze code if already populated
        isec_code = None
        sym_upper = symbol.upper()

        if sym_upper in isec_codes:
            # NSE symbol matches an ISEC code directly
            isec_code = sym_upper
        elif isec_map.get(sym_upper) and isec_map[sym_upper] != sym_upper:
            # Explicit NSE -> ISEC mapping
            isec_code = isec_map[sym_upper]
        elif existing_vc.get('breeze'):
            # Already has a breeze code from a prior run
            continue

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

    # Populate indices (uses hardcoded map, no Breeze session needed)
    if not args.skip_index:
        populate_index_codes(sb)

    # Everything below needs Breeze session
    needs_breeze = args.diagnose or not args.skip_equity

    if not needs_breeze:
        # Only doing indices, we're done
        pass
    else:
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

        # Extract ISEC mapping from SDK for equities
        if not args.skip_equity:
            print('\nExtracting ISEC stock code mapping...')

            # Strategy 1: Download security master CSV directly
            isec_map = download_security_master_mapping()

            # Strategy 2: Extract from Breeze SDK internals
            if not isec_map:
                isec_map = extract_isec_mapping(breeze)

            if not isec_map:
                print('  WARNING: Could not extract ISEC mapping.')
                print('  Run with --diagnose first to inspect available data.')
            else:
                print(f'  Extracted {len(isec_map)} NSE -> ISEC mappings')

                # Cache for other tools
                with open(CACHE_FILE, 'w') as f:
                    json.dump({'date': datetime.now().strftime('%Y-%m-%d'), 'map': isec_map}, f)
                print(f'  Cached to {CACHE_FILE}')

                populate_equity_codes(sb, isec_map, single_symbol=args.symbol)

    print('\n' + '=' * 60)
    print('VENDOR CODE MAPPING COMPLETE')
    print('=' * 60)


if __name__ == '__main__':
    main()
