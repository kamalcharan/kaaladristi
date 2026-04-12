"""
Seed Equity Metadata from NSE API
=================================
Fetches industry, company_name, listing_date, is_fno, is_etf, and ffmc
from the NSE stock indices API and updates km_equity_symbols + km_equity_eod.

Strategy:
  1. Fetch NIFTY TOTAL MARKET (750 stocks) — biggest single-call coverage
  2. Fetch NIFTY 500 — catches any missing
  3. Fetch remaining sectoral/thematic indices for stragglers
  4. Update km_equity_symbols with static metadata
  5. Update km_equity_eod (latest date) with ffmc

Usage:
  python seed_equity_metadata.py             # full run
  python seed_equity_metadata.py --dry-run   # preview without DB writes
"""

import os
import sys
import json
import time
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lib.db_client import get_db
from pipeline.utils.nse_session import NseSession

NSE_INDEX_API = 'https://www.nseindia.com/api/equity-stockIndices?index={}'
NSE_QUOTE_API = 'https://www.nseindia.com/api/quote-equity?symbol={}'

# Indices to fetch, in order of coverage (largest first)
FETCH_INDICES = [
    'NIFTY TOTAL MARKET',
    'NIFTY 500',
    'NIFTY MICROCAP 250',
    'NIFTY IPO',
]


def fetch_index_stocks(session: NseSession, index_name: str) -> list[dict]:
    """Fetch all stocks for an index from NSE API."""
    url = NSE_INDEX_API.format(index_name.replace(' ', '%20').replace('&', '%26'))
    print(f'  Fetching {index_name}...')

    try:
        resp = session.get(url)
        data = resp.json()
        stocks = data.get('data', [])
        # Filter out index summary row (no meta)
        stocks = [s for s in stocks if s.get('meta')]
        print(f'    {len(stocks)} stocks with metadata')
        return stocks
    except Exception as e:
        print(f'    ERROR: {e}')
        return []


def extract_metadata(stock: dict) -> dict:
    """Extract metadata fields from NSE API stock entry."""
    meta = stock.get('meta', {})
    return {
        'symbol': meta.get('symbol', stock.get('symbol', '')).strip().upper(),
        'company_name': meta.get('companyName'),
        'industry': meta.get('industry'),
        'listing_date': meta.get('listingDate'),
        'is_fno': meta.get('isFNOSec', False),
        'is_etf': meta.get('isETFSec', False),
        'ffmc': stock.get('ffmc'),
    }


def fetch_single_stock(session: NseSession, symbol: str) -> dict | None:
    """Fetch metadata for a single stock via NSE quote API."""
    from urllib.parse import quote
    url = NSE_QUOTE_API.format(quote(symbol))
    try:
        resp = session.get(url)
        data = resp.json()
        info = data.get('info', {})
        if not info:
            return None
        return {
            'symbol': symbol,
            'company_name': info.get('companyName'),
            'industry': info.get('industry'),
            'listing_date': info.get('listingDate'),
            'is_fno': info.get('isFNOSec', False),
            'is_etf': info.get('isETFSec', False),
            'ffmc': None,  # Not available in quote API
        }
    except Exception:
        return None


def run(dry_run=False):
    print('Seed Equity Metadata from NSE API')
    print('=' * 50)

    session = NseSession()
    db = get_db()

    # Collect metadata for all stocks (dedup by symbol)
    all_stocks = {}

    for index_name in FETCH_INDICES:
        stocks = fetch_index_stocks(session, index_name)
        new_count = 0
        for s in stocks:
            meta = extract_metadata(s)
            symbol = meta['symbol']
            if symbol and symbol not in all_stocks:
                all_stocks[symbol] = meta
                new_count += 1
        print(f'    {new_count} new (total: {len(all_stocks)})')
        time.sleep(2)  # Be nice to NSE

    print(f'\nPhase 1 complete: {len(all_stocks)} stocks from index API')

    # ── Phase 2: Fetch remaining NSE equities individually ──
    equities = db.select('km_equity_symbols', 'id,symbol', filters={'exchange': 'NSE'})
    missing_symbols = [eq['symbol'] for eq in equities if eq['symbol'] not in all_stocks]
    print(f'\nPhase 2: {len(missing_symbols)} NSE equities not covered by index API')

    if missing_symbols:
        fetched = 0
        failed = 0
        for i, symbol in enumerate(missing_symbols):
            meta = fetch_single_stock(session, symbol)
            if meta and meta.get('industry'):
                all_stocks[symbol] = meta
                fetched += 1
            else:
                failed += 1

            # Progress every 50
            if (i + 1) % 50 == 0:
                print(f'    [{i+1}/{len(missing_symbols)}] fetched={fetched} failed={failed}')

            # Rate limit — NSE blocks aggressive requests
            time.sleep(0.5)

        print(f'  Phase 2 done: fetched={fetched}, failed={failed}')

    print(f'\nTotal unique stocks with metadata: {len(all_stocks)}')

    if dry_run:
        # Show sample
        for symbol, meta in list(all_stocks.items())[:5]:
            print(f'  {symbol}: {meta["industry"]} | {meta["company_name"]}')
        print(f'  ... and {len(all_stocks) - 5} more')
        print('\n[DRY RUN] No DB changes made.')
        return

    # ── Update km_equity_symbols ──
    print('\nUpdating km_equity_symbols...')
    updated = 0
    skipped = 0

    # Get all NSE equity IDs
    equities = db.select('km_equity_symbols', 'id,symbol', filters={'exchange': 'NSE'})
    symbol_to_id = {eq['symbol']: eq['id'] for eq in equities}

    for symbol, meta in all_stocks.items():
        eq_id = symbol_to_id.get(symbol)
        if not eq_id:
            skipped += 1
            continue

        update_data = {
            'company_name': meta['company_name'],
            'industry': meta['industry'],
            'is_fno': meta['is_fno'],
            'is_etf': meta['is_etf'],
        }
        if meta['listing_date']:
            update_data['listing_date'] = meta['listing_date']

        db.patch('km_equity_symbols', {'id': eq_id}, update_data)
        updated += 1

    print(f'  Updated: {updated}, Skipped (not in DB): {skipped}')

    # ── Update km_equity_eod with ffmc (latest date only) ──
    print('\nUpdating km_equity_eod with ffmc (latest date)...')
    ffmc_updated = 0

    for symbol, meta in all_stocks.items():
        if not meta['ffmc']:
            continue
        eq_id = symbol_to_id.get(symbol)
        if not eq_id:
            continue

        # Get latest trade_date for this equity
        rows = db.select(
            'km_equity_eod', 'trade_date',
            filters={'equity_id': eq_id},
            order='trade_date.desc',
            limit=1
        )
        if not rows:
            continue

        trade_date = str(rows[0]['trade_date'])
        db.patch(
            'km_equity_eod',
            {'equity_id': eq_id, 'trade_date': trade_date},
            {'ffmc': meta['ffmc']}
        )
        ffmc_updated += 1

    print(f'  ffmc updated: {ffmc_updated}')

    # ── Summary ──
    remaining = db.select(
        'km_equity_symbols',
        "COUNT(*) AS cnt",
        filters={'exchange': 'NSE'}
    )
    total_nse = remaining[0]['cnt'] if remaining else '?'

    has_industry = db.select(
        'km_equity_symbols',
        "COUNT(*) AS cnt",
    )
    # Use raw SQL for NOT NULL check
    print(f'\n  Total NSE equities: {total_nse}')
    print(f'  Metadata seeded: {updated}')
    print(f'  Remaining without industry: check with SQL')
    print('\nDone!')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Seed equity metadata from NSE API')
    parser.add_argument('--dry-run', action='store_true', help='Preview without DB writes')
    args = parser.parse_args()
    run(dry_run=args.dry_run)
