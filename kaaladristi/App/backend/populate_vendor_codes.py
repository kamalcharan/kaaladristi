"""
Vendor Code Mapper for Kāla-Drishti
=====================================
Populates the vendor_codes JSONB column in km_equity_symbols and km_index_symbols.

Each vendor (ICICI Breeze, NSE, BSE, Screener, etc.) uses different stock codes.
This script maps our NSE symbols to vendor-specific codes and saves them to the DB.

Currently supported vendors:
  - breeze:     ICICI Breeze ISEC stock codes for NSE (via SecurityMaster.zip)
  - breeze_bse: ICICI Breeze ISEC stock codes for BSE
  - nse:        NSE trading symbols (already our primary key, saved for completeness)
  - has_fno:    Boolean flag if F&O contracts exist for this underlying

SecurityMaster files parsed:
  - NSEScripMaster.txt   — NSE equity symbol ↔ ISEC code mapping
  - BSEScripMaster.txt   — BSE equity symbol ↔ ISEC code mapping
  - FONSEScripMaster.txt — NSE F&O contracts (futures & options)
  - FOBSEScripMaster.txt — BSE F&O contracts
  - CDNSEScripMaster.txt — Currency derivatives (NSE)
  - MCXScripMaster.txt   — Commodity derivatives (MCX)

Future vendors:
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

sys.path.insert(0, script_dir)
from lib.db_client import PostgRESTClient, get_db  # noqa: E402

BREEZE_API_KEY = os.getenv('BREEZE_API_KEY', '')
BREEZE_API_SECRET = os.getenv('BREEZE_API_SECRET', '')

CACHE_FILE = os.path.join(script_dir, '.breeze_isec_cache.json')


# ═════════════════════════════════════════════════════════════════════════════
# DATABASE CLIENT (PostgREST via lib/db_client.py)
# ═════════════════════════════════════════════════════════════════════════════


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

# Map of master file keys to filename patterns and their type (equity vs derivative)
MASTER_FILES = {
    'nse':   {'pattern': lambda n: 'NSE' in n and 'FO' not in n and 'CD' not in n, 'type': 'equity'},
    'bse':   {'pattern': lambda n: 'BSE' in n and 'FO' not in n, 'type': 'equity'},
    'fonse': {'pattern': lambda n: 'FONSE' in n or ('FO' in n and 'NSE' in n and 'BSE' not in n), 'type': 'derivative'},
    'fobse': {'pattern': lambda n: 'FOBSE' in n or ('FO' in n and 'BSE' in n), 'type': 'derivative'},
    'cdnse': {'pattern': lambda n: 'CDNSE' in n or ('CD' in n and 'NSE' in n), 'type': 'derivative'},
    'mcx':   {'pattern': lambda n: 'MCX' in n, 'type': 'derivative'},
}


def _find_file_in_zip(zf, pattern_fn) -> str | None:
    """Find a .txt/.csv file in the ZIP matching the pattern function."""
    for name in zf.namelist():
        name_upper = name.upper()
        if (name_upper.endswith('.CSV') or name_upper.endswith('.TXT')) and pattern_fn(name_upper):
            return name
    return None


def _parse_equity_master(zf, filename: str) -> dict:
    """
    Parse an equity master file (NSEScripMaster.txt or BSEScripMaster.txt).

    ExchangeCode (the trading symbol) is always the LAST column:
      NSE (61 cols): [0]Token [1]ShortName [3]CompanyName ... [60]ExchangeCode
      BSE (34 cols): [0]Token [1]ShortName [3]CompanyName ... [33]ExchangeCode

    Returns dict with:
      'symbol_to_isec': {EXCHANGE_SYMBOL: ISEC_CODE}
      'isec_to_token':  {ISEC_CODE: TOKEN}
      'isec_to_company': {ISEC_CODE: COMPANY_NAME}
    """
    raw = zf.read(filename).decode('utf-8', errors='replace')
    lines = raw.strip().split('\n')

    if lines:
        first_cols = lines[0].split(',')
        last_col = first_cols[-1].strip().strip('"') if first_cols else '?'
        print(f'    Columns ({len(first_cols)}): {[c.strip().strip(chr(34))[:30] for c in first_cols[:8]]}'
              f' ... last={last_col}')

    symbol_to_isec = {}
    isec_to_token = {}
    isec_to_company = {}

    for line in lines:
        columns = line.split(',')
        if len(columns) < 4:
            continue
        token = columns[0].strip().strip('"')
        isec_code = columns[1].strip().strip('"')
        company = columns[3].strip().strip('"')

        # Skip header or empty
        if not token or not isec_code or not token[0].isdigit():
            continue

        isec_to_token[isec_code] = token
        if company:
            isec_to_company[isec_code] = company

        # ExchangeCode is always the last column (trading symbol on exchange)
        exchange_code = columns[-1].strip().strip('"')
        if exchange_code:
            symbol_to_isec[exchange_code.upper()] = isec_code

        # Also map ISEC code to itself (for direct matches)
        symbol_to_isec[isec_code.upper()] = isec_code

    return {
        'symbol_to_isec': symbol_to_isec,
        'isec_to_token': isec_to_token,
        'isec_to_company': isec_to_company,
    }


def _parse_derivative_master(zf, filename: str, master_key: str) -> list:
    """
    Parse a derivative master file (FONSEScripMaster, FOBSEScripMaster,
    CDNSEScripMaster, MCXScripMaster).

    FON/FOB/CDNSE (69 columns):
      [0]Token [1]InstrumentName [2]ShortName [3]Series
      [4]ExpiryDate [5]StrikePrice [6]OptionType
      [-1]ExchangeCode (underlying NSE symbol)

    MCX (27 columns) — different layout:
      [0]Token [1]InstrumentName [2]ShortName [3]Series
      [4]CompanyName [5]TickSize [6]LotSize
      [7]ExpiryDate [8]OptionType [9]StrikePrice
      [-1]ExchangeCode (underlying symbol)

    Returns list of contract dicts.
    """
    raw = zf.read(filename).decode('utf-8', errors='replace')
    lines = raw.strip().split('\n')

    is_mcx = (master_key == 'mcx')

    if lines:
        first_cols = lines[0].split(',')
        last_col = first_cols[-1].strip().strip('"') if first_cols else '?'
        print(f'    Columns ({len(first_cols)}): {[c.strip().strip(chr(34))[:30] for c in first_cols[:8]]}'
              f' ... last={last_col}')

    contracts = []

    for line in lines:
        columns = line.split(',')
        if len(columns) < 8 if is_mcx else len(columns) < 7:
            continue
        token = columns[0].strip().strip('"')
        if not token or not token[0].isdigit():
            continue

        instrument = columns[1].strip().strip('"')   # FUTSTK, OPTSTK, etc.
        isec_code = columns[2].strip().strip('"')     # ISEC derivative code
        underlying = columns[-1].strip().strip('"')   # Exchange trading symbol

        if is_mcx:
            expiry = columns[7].strip().strip('"')
            option_type = columns[8].strip().strip('"') if len(columns) > 8 else ''
            strike = columns[9].strip().strip('"') if len(columns) > 9 else ''
        else:
            expiry = columns[4].strip().strip('"')
            strike = columns[5].strip().strip('"')
            option_type = columns[6].strip().strip('"')   # XX, CE, PE

        contracts.append({
            'token': token,
            'instrument': instrument,
            'isec_code': isec_code,
            'underlying': underlying,
            'expiry': expiry,
            'strike': strike,
            'option_type': option_type,
        })

    return contracts


def download_all_security_masters() -> dict:
    """
    Download ICICI SecurityMaster.zip and parse all 6 master files:
      - NSEScripMaster.txt   (NSE equities)
      - BSEScripMaster.txt   (BSE equities)
      - FONSEScripMaster.txt (NSE F&O)
      - FOBSEScripMaster.txt (BSE F&O)
      - CDNSEScripMaster.txt (Currency derivatives)
      - MCXScripMaster.txt   (Commodity derivatives)

    Returns dict:
      {
        'nse':   {'symbol_to_isec': {...}, 'isec_to_token': {...}, 'isec_to_company': {...}},
        'bse':   {'symbol_to_isec': {...}, 'isec_to_token': {...}, 'isec_to_company': {...}},
        'fonse': {'contracts': [...], 'underlyings': set(...)},
        'fobse': {'contracts': [...], 'underlyings': set(...)},
        'cdnse': {'contracts': [...], 'underlyings': set(...)},
        'mcx':   {'contracts': [...], 'underlyings': set(...)},
      }
    """
    print('  Downloading SecurityMaster.zip from ICICI...')
    try:
        resp = urlopen(SECURITY_MASTER_URL)
        zf = zipfile.ZipFile(io.BytesIO(resp.read()))
    except Exception as e:
        print(f'  Could not download SecurityMaster.zip: {e}')
        return {}

    print(f'  ZIP contents: {zf.namelist()}')
    result = {}

    for key, spec in MASTER_FILES.items():
        filename = _find_file_in_zip(zf, spec['pattern'])
        if not filename:
            print(f'  WARNING: Could not find {key} master file in ZIP')
            continue

        print(f'  Parsing {filename} ({key})...')

        if spec['type'] == 'equity':
            parsed = _parse_equity_master(zf, filename)
            result[key] = parsed
            print(f'    {len(parsed["symbol_to_isec"])} symbol mappings, '
                  f'{len(parsed["isec_to_token"])} ISEC codes')
        else:
            contracts = _parse_derivative_master(zf, filename, key)
            underlyings = set(c['underlying'] for c in contracts if c['underlying'])
            result[key] = {'contracts': contracts, 'underlyings': underlyings}
            print(f'    {len(contracts)} contracts, {len(underlyings)} unique underlyings')

    return result


def download_security_master_mapping() -> tuple[dict, dict]:
    """
    Download and parse all security masters.

    Returns:
      (nse_to_isec, all_masters) where:
        nse_to_isec: {NSE_SYMBOL: ISEC_CODE} — backward-compatible flat mapping
        all_masters: full structured data from download_all_security_masters()
    """
    all_masters = download_all_security_masters()
    if not all_masters:
        return {}, {}

    # Build flat NSE symbol -> ISEC code mapping (backward-compatible)
    nse_to_isec = {}
    if 'nse' in all_masters:
        nse_to_isec = dict(all_masters['nse']['symbol_to_isec'])

    return nse_to_isec, all_masters


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

def populate_equity_codes(sb, isec_map: dict, all_masters: dict = None,
                          single_symbol: str = None):
    """Update vendor_codes for all equities using NSE and BSE ISEC mappings.

    The isec_map maps NSE trading symbol (ExchangeCode) -> ISEC code (ShortName).
    If all_masters is provided, also populates BSE codes and derivative availability.
    """
    print('\n' + '=' * 60)
    print('POPULATING EQUITY VENDOR CODES')
    print('=' * 60)

    if single_symbol:
        equities = sb.select('km_equity_symbols', 'id,symbol,exchange,vendor_codes',
                             filters={'symbol': single_symbol.upper()})
    else:
        equities = sb.select('km_equity_symbols', 'id,symbol,exchange,vendor_codes', order='symbol')

    # Only process NSE equities here — BSE equities get their codes from populate_bse_symbols.py
    equities = [e for e in equities if (e.get('exchange') or 'NSE') == 'NSE']

    # Build BSE mapping if available
    bse_map = {}
    if all_masters and 'bse' in all_masters:
        bse_map = all_masters['bse']['symbol_to_isec']

    # Build set of underlyings that have F&O contracts
    fno_underlyings = set()
    if all_masters:
        for key in ('fonse', 'fobse'):
            if key in all_masters:
                fno_underlyings |= all_masters[key].get('underlyings', set())

    print(f'  Equities in DB: {len(equities)}')
    print(f'  NSE ISEC mappings: {len(isec_map)}')
    print(f'  BSE ISEC mappings: {len(bse_map)}')
    print(f'  F&O underlyings: {len(fno_underlyings)}')

    updated = 0
    skipped = 0
    not_found = []

    for eq in equities:
        symbol = eq['symbol']
        eq_id = eq['id']
        existing_vc = eq.get('vendor_codes') or {}
        if isinstance(existing_vc, str):
            existing_vc = json.loads(existing_vc)

        sym_upper = symbol.upper()
        isec_code = isec_map.get(sym_upper)
        bse_isec_code = bse_map.get(sym_upper)

        if not isec_code and not bse_isec_code and existing_vc.get('breeze'):
            # Keep existing codes from prior run
            continue

        if not isec_code and not bse_isec_code:
            skipped += 1
            not_found.append(symbol)
            continue

        # Build vendor_codes
        new_vc = {**existing_vc, 'nse': symbol}

        if isec_code:
            new_vc['breeze'] = isec_code
        if bse_isec_code:
            new_vc['breeze_bse'] = bse_isec_code

        # Mark if F&O contracts exist for this underlying
        if sym_upper in fno_underlyings or (isec_code and isec_code in fno_underlyings):
            new_vc['has_fno'] = True

        # Skip if nothing changed
        if (existing_vc.get('breeze') == new_vc.get('breeze')
                and existing_vc.get('breeze_bse') == new_vc.get('breeze_bse')
                and existing_vc.get('nse') == symbol
                and existing_vc.get('has_fno') == new_vc.get('has_fno')):
            continue

        sb.patch('km_equity_symbols', {'id': eq_id}, {'vendor_codes': new_vc})
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
        if isinstance(existing_vc, str):
            existing_vc = json.loads(existing_vc)

        breeze_code = INDEX_BREEZE_MAP.get(name.upper())
        if not breeze_code:
            skipped += 1
            continue

        if existing_vc.get('breeze') == breeze_code:
            continue

        new_vc = {
            **existing_vc,
            'nse_name': name,
            'breeze': breeze_code,
        }

        sb.patch('km_index_symbols', {'id': idx_id}, {'vendor_codes': new_vc})
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

    # Init database
    sb = get_db()
    print('Database connected')

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

            # Strategy 1: Download all security master CSVs directly
            isec_map, all_masters = download_security_master_mapping()

            # Strategy 2: Extract from Breeze SDK internals (identity map only)
            if not isec_map:
                isec_map = extract_isec_mapping(breeze)
                all_masters = {}

            if not isec_map:
                print('  WARNING: Could not extract ISEC mapping.')
                print('  Run with --diagnose first to inspect available data.')
            else:
                print(f'  Extracted {len(isec_map)} NSE -> ISEC mappings')

                # Cache all master data for other tools
                cache_data = {
                    'date': datetime.now().strftime('%Y-%m-%d'),
                    'map': isec_map,  # backward-compatible flat NSE map
                }
                # Add per-exchange data (skip large contract lists, keep summaries)
                if all_masters:
                    masters_summary = {}
                    for key, data in all_masters.items():
                        if 'symbol_to_isec' in data:
                            # Equity master — cache full mapping
                            masters_summary[key] = {
                                'symbol_to_isec': data['symbol_to_isec'],
                                'isec_to_token': data['isec_to_token'],
                            }
                        else:
                            # Derivative master — cache summary only (contracts are large)
                            masters_summary[key] = {
                                'contract_count': len(data.get('contracts', [])),
                                'underlyings': sorted(data.get('underlyings', set())),
                            }
                    cache_data['masters'] = masters_summary

                with open(CACHE_FILE, 'w') as f:
                    json.dump(cache_data, f)
                print(f'  Cached to {CACHE_FILE}')

                populate_equity_codes(sb, isec_map, all_masters=all_masters,
                                      single_symbol=args.symbol)

    print('\n' + '=' * 60)
    print('VENDOR CODE MAPPING COMPLETE')
    print('=' * 60)


if __name__ == '__main__':
    main()
