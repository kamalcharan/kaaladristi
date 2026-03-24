"""
BSE Equity Symbol Seeder for Kāla-Drishti
==========================================
Downloads the BSE equity list and populates km_equity_symbols with exchange='BSE'.
Uses the ICICI SecurityMaster BSEScripMaster.txt for BSE-listed equities.

Each BSE equity gets its own row in km_equity_symbols with:
  - symbol:   BSE scrip code (e.g. '500325' for Reliance)
  - exchange: 'BSE'
  - isin:     ISIN code (cross-reference with NSE)
  - bse_code: same as symbol for BSE rows
  - vendor_codes: {"breeze_bse": ISEC_CODE}

ISIN is the universal key linking BSE and NSE listings of the same company.

Usage
-----
  # Populate all BSE equities from SecurityMaster
  python populate_bse_symbols.py

  # Dry run — show counts without inserting
  python populate_bse_symbols.py --dry-run

  # Also seed MCX commodity symbols
  python populate_bse_symbols.py --mcx
"""

import os
import sys
import io
import json
import argparse
import zipfile
from urllib.request import urlopen

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lib.config import SUPABASE_URL, SUPABASE_SERVICE_KEY
from lib.supabase_client import SupabaseREST, get_supabase

SECURITY_MASTER_URL = 'https://directlink.icicidirect.com/MotherAppMaster/SecurityMaster.zip'


# ═════════════════════════════════════════════════════════════════════════════
# BSE MASTER PARSER
# ═════════════════════════════════════════════════════════════════════════════

def download_and_parse_masters():
    """
    Download SecurityMaster.zip and parse BSE equity + MCX commodity masters.

    BSEScripMaster.txt layout (34 columns):
      [0]  Token (BSE scrip code, e.g. 500325)
      [1]  ShortName (ISEC code)
      [2]  Series
      [3]  CompanyName
      ...
      [33] ExchangeCode (BSE trading symbol)

    MCXScripMaster.txt layout (27 columns):
      [0]  Token
      [1]  InstrumentName (FUTSTK, OPTSTK, etc.)
      [2]  ShortName (ISEC code)
      [3]  Series
      [4]  CompanyName (underlying description)
      [5]  TickSize
      [6]  LotSize
      [7]  ExpiryDate
      ...
      [-1] ExchangeCode (underlying symbol)

    Returns: (bse_equities, mcx_underlyings)
      bse_equities: list of {token, isec_code, company, exchange_code}
      mcx_underlyings: list of {symbol, name, lot_size, tick_size, isec_code}
    """
    print('  Downloading SecurityMaster.zip...')
    try:
        resp = urlopen(SECURITY_MASTER_URL)
        zf = zipfile.ZipFile(io.BytesIO(resp.read()))
    except Exception as e:
        print(f'  ERROR: Could not download SecurityMaster.zip: {e}')
        return [], []

    print(f'  ZIP contents: {zf.namelist()}')

    # Find BSE and MCX master files
    bse_file = None
    mcx_file = None
    for name in zf.namelist():
        upper = name.upper()
        if upper.endswith('.TXT') or upper.endswith('.CSV'):
            if 'BSE' in upper and 'FO' not in upper:
                bse_file = name
            elif 'MCX' in upper:
                mcx_file = name

    bse_equities = []
    mcx_underlyings = []

    # ── Parse BSE ──
    if bse_file:
        print(f'  Parsing {bse_file}...')
        raw = zf.read(bse_file).decode('utf-8', errors='replace')
        lines = raw.strip().split('\n')

        seen_tokens = set()
        for line in lines:
            cols = line.split(',')
            if len(cols) < 4:
                continue

            token = cols[0].strip().strip('"')
            isec_code = cols[1].strip().strip('"')
            company = cols[3].strip().strip('"')
            exchange_code = cols[-1].strip().strip('"')

            # Skip header or non-numeric tokens
            if not token or not token[0].isdigit():
                continue

            # Deduplicate by token (BSE scrip code)
            if token in seen_tokens:
                continue
            seen_tokens.add(token)

            # Try to extract ISIN if available (varies by file version)
            isin = None
            for col in cols:
                val = col.strip().strip('"')
                if len(val) == 12 and val.startswith('INE'):
                    isin = val
                    break

            bse_equities.append({
                'token': token,           # BSE scrip code (e.g. 500325)
                'isec_code': isec_code,   # ICICI ISEC code
                'company': company,
                'exchange_code': exchange_code,  # BSE trading symbol
                'isin': isin,
            })

        print(f'    {len(bse_equities)} BSE equities found')
    else:
        print('  WARNING: BSEScripMaster.txt not found in ZIP')

    # ── Parse MCX ──
    if mcx_file:
        print(f'  Parsing {mcx_file}...')
        raw = zf.read(mcx_file).decode('utf-8', errors='replace')
        lines = raw.strip().split('\n')

        seen_underlyings = {}
        for line in lines:
            cols = line.split(',')
            if len(cols) < 10:
                continue

            token = cols[0].strip().strip('"')
            if not token or not token[0].isdigit():
                continue

            isec_code = cols[2].strip().strip('"')
            company = cols[4].strip().strip('"') if len(cols) > 4 else ''
            tick_size = cols[5].strip().strip('"') if len(cols) > 5 else ''
            lot_size = cols[6].strip().strip('"') if len(cols) > 6 else ''
            underlying = cols[-1].strip().strip('"')

            if not underlying:
                continue

            # Keep first occurrence per underlying (futures contract)
            if underlying not in seen_underlyings:
                seen_underlyings[underlying] = {
                    'symbol': underlying,
                    'name': company,
                    'lot_size': int(float(lot_size)) if lot_size and lot_size[0].isdigit() else None,
                    'tick_size': float(tick_size) if tick_size and tick_size[0].isdigit() else None,
                    'isec_code': isec_code,
                }

        mcx_underlyings = list(seen_underlyings.values())
        print(f'    {len(mcx_underlyings)} MCX underlyings found')
    else:
        print('  WARNING: MCXScripMaster.txt not found in ZIP')

    return bse_equities, mcx_underlyings


# ═════════════════════════════════════════════════════════════════════════════
# BSE SEEDER
# ═════════════════════════════════════════════════════════════════════════════

def seed_bse_equities(sb, bse_equities, dry_run=False):
    """
    Insert BSE equities into km_equity_symbols with exchange='BSE'.
    Uses the BSE scrip code as the symbol (e.g. '500325').
    """
    print('\n' + '=' * 60)
    print(f'SEEDING BSE EQUITIES ({len(bse_equities)} companies)')
    print('=' * 60)

    if dry_run:
        print('  [DRY RUN] Would insert:')
        for eq in bse_equities[:10]:
            print(f'    {eq["token"]} ({eq["exchange_code"]}) — {eq["company"]}')
        if len(bse_equities) > 10:
            print(f'    ... and {len(bse_equities) - 10} more')
        return

    # Fetch existing BSE symbols to avoid duplicates
    existing = sb.select('km_equity_symbols', 'symbol,exchange',
                         filters={'exchange': 'BSE'})
    existing_symbols = {r['symbol'] for r in existing}
    print(f'  Existing BSE symbols in DB: {len(existing_symbols)}')

    inserted = 0
    skipped = 0
    failed = 0
    batch = []
    BATCH_SIZE = 200

    for eq in bse_equities:
        # Use BSE scrip code as symbol
        symbol = eq['token']

        if symbol in existing_symbols:
            skipped += 1
            continue

        record = {
            'symbol': symbol,
            'exchange': 'BSE',
            'bse_code': symbol,
            'isin': eq.get('isin'),
            'index_names': [],
            'vendor_codes': {
                'breeze_bse': eq['isec_code'],
                'bse_name': eq['exchange_code'],
                'company': eq['company'],
            },
        }
        batch.append(record)

        if len(batch) >= BATCH_SIZE:
            try:
                sb.upsert('km_equity_symbols', batch, 'symbol,exchange')
                inserted += len(batch)
            except Exception as e:
                print(f'    Batch error: {e}')
                # Row-by-row fallback
                for rec in batch:
                    try:
                        if sb.insert('km_equity_symbols', rec):
                            inserted += 1
                        else:
                            failed += 1
                    except Exception:
                        failed += 1
            batch = []

    # Final batch
    if batch:
        try:
            sb.upsert('km_equity_symbols', batch, 'symbol,exchange')
            inserted += len(batch)
        except Exception as e:
            print(f'    Final batch error: {e}')
            for rec in batch:
                try:
                    if sb.insert('km_equity_symbols', rec):
                        inserted += 1
                    else:
                        failed += 1
                except Exception:
                    failed += 1

    print(f'\n  Inserted: {inserted}')
    print(f'  Skipped (already exist): {skipped}')
    if failed:
        print(f'  Failed: {failed}')


# ═════════════════════════════════════════════════════════════════════════════
# MCX SEEDER
# ═════════════════════════════════════════════════════════════════════════════

def seed_mcx_commodities(sb, mcx_underlyings, dry_run=False):
    """
    Insert MCX commodity underlyings into km_commodity_symbols.
    """
    print('\n' + '=' * 60)
    print(f'SEEDING MCX COMMODITIES ({len(mcx_underlyings)} underlyings)')
    print('=' * 60)

    if dry_run:
        print('  [DRY RUN] Would insert:')
        for c in mcx_underlyings[:15]:
            print(f'    {c["symbol"]} — {c["name"]} (lot={c["lot_size"]}, tick={c["tick_size"]})')
        if len(mcx_underlyings) > 15:
            print(f'    ... and {len(mcx_underlyings) - 15} more')
        return

    # Fetch existing MCX symbols
    existing = sb.select('km_commodity_symbols', 'symbol,exchange',
                         filters={'exchange': 'MCX'})
    existing_symbols = {r['symbol'] for r in existing}
    print(f'  Existing MCX symbols in DB: {len(existing_symbols)}')

    # Categorize MCX commodities
    MCX_CATEGORIES = {
        'CRUDEOIL': 'energy', 'NATURALGAS': 'energy', 'CRUDE': 'energy',
        'GOLD': 'metals', 'SILVER': 'metals', 'COPPER': 'metals',
        'ZINC': 'metals', 'LEAD': 'metals', 'NICKEL': 'metals',
        'ALUMINIUM': 'metals', 'ALUMINUM': 'metals',
        'GOLDM': 'metals', 'SILVERM': 'metals', 'GOLDGUINEA': 'metals',
        'GOLDPETAL': 'metals', 'SILVERMIC': 'metals',
        'MENTHAOIL': 'agriculture', 'COTTON': 'agriculture',
        'CPO': 'agriculture', 'CASTORSEED': 'agriculture',
    }

    inserted = 0
    skipped = 0

    for c in mcx_underlyings:
        if c['symbol'] in existing_symbols:
            skipped += 1
            continue

        category = MCX_CATEGORIES.get(c['symbol'].upper(), 'other')

        record = {
            'symbol': c['symbol'],
            'name': c['name'],
            'exchange': 'MCX',
            'category': category,
            'lot_size': c['lot_size'],
            'tick_size': c['tick_size'],
            'vendor_codes': {
                'breeze': c['isec_code'],
            },
        }

        try:
            sb.upsert('km_commodity_symbols', [record], 'symbol,exchange')
            inserted += 1
        except Exception as e:
            print(f'    Error inserting {c["symbol"]}: {e}')

    print(f'\n  Inserted: {inserted}')
    print(f'  Skipped (already exist): {skipped}')


# ═════════════════════════════════════════════════════════════════════════════
# ISIN CROSS-REFERENCE
# ═════════════════════════════════════════════════════════════════════════════

def backfill_isin_from_bse(sb, bse_equities):
    """
    For NSE equities that don't have an ISIN, try to match via BSE trading symbol
    and fill in the ISIN from BSE data. Also updates BSE rows with ISIN.
    """
    print('\n' + '=' * 60)
    print('BACKFILLING ISIN CROSS-REFERENCES')
    print('=' * 60)

    # Build BSE exchange_code -> ISIN map
    bse_isin_map = {}
    for eq in bse_equities:
        if eq.get('isin') and eq.get('exchange_code'):
            bse_isin_map[eq['exchange_code'].upper()] = eq['isin']

    if not bse_isin_map:
        print('  No ISIN data available from BSE master')
        return

    print(f'  BSE entries with ISIN: {len(bse_isin_map)}')

    # Fetch NSE equities missing ISIN
    nse_equities = sb.select('km_equity_symbols', 'id,symbol,isin',
                             filters={'exchange': 'NSE'})

    updated = 0
    for eq in nse_equities:
        if eq.get('isin'):
            continue  # already has ISIN

        isin = bse_isin_map.get(eq['symbol'].upper())
        if isin:
            sb.patch('km_equity_symbols', {'id': eq['id']}, {'isin': isin})
            updated += 1

    print(f'  NSE equities updated with ISIN: {updated}')


# ═════════════════════════════════════════════════════════════════════════════
# CLI
# ═════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description='Seed BSE equities and MCX commodities into Kāla-Drishti'
    )
    parser.add_argument('--dry-run', action='store_true',
                        help='Show what would be inserted without writing to DB')
    parser.add_argument('--mcx', action='store_true',
                        help='Also seed MCX commodity symbols')
    parser.add_argument('--isin', action='store_true',
                        help='Backfill ISIN cross-references from BSE to NSE')

    args = parser.parse_args()

    print('=' * 60)
    print('KĀLA-DRISHTI BSE/MCX SYMBOL SEEDER')
    print('=' * 60)

    # Download and parse
    bse_equities, mcx_underlyings = download_and_parse_masters()

    if not bse_equities and not mcx_underlyings:
        print('ERROR: No data parsed from SecurityMaster.zip')
        sys.exit(1)

    # Connect to Supabase
    sb = get_supabase()
    print('  Supabase connected')

    # Seed BSE equities
    if bse_equities:
        seed_bse_equities(sb, bse_equities, dry_run=args.dry_run)

    # Seed MCX commodities
    if args.mcx and mcx_underlyings:
        seed_mcx_commodities(sb, mcx_underlyings, dry_run=args.dry_run)

    # ISIN backfill
    if args.isin and bse_equities:
        backfill_isin_from_bse(sb, bse_equities)

    print('\n' + '=' * 60)
    print('SEEDING COMPLETE')
    print('=' * 60)


if __name__ == '__main__':
    main()
