"""
Seed BSE Equity Metadata
=========================
Populates industry for BSE equities that have EOD data but no industry.

Strategy:
  1. Try NSE quote API (for BSE stocks that have NSE vendor code)
  2. Fall back to Yahoo Finance for BSE-only stocks
  3. Writes to DB immediately per stock (crash-safe, re-runnable)

Usage:
  python seed_bse_metadata.py             # full run
  python seed_bse_metadata.py --dry-run   # preview
"""

import os
import sys
import time
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lib.db_client import get_db
from pipeline.utils.nse_session import NseSession

NSE_QUOTE_API = 'https://www.nseindia.com/api/quote-equity?symbol={}'


def fetch_from_nse(session, symbol):
    """Try NSE quote API for a symbol."""
    from urllib.parse import quote
    url = NSE_QUOTE_API.format(quote(symbol))
    try:
        resp = session.get(url)
        data = resp.json()
        info = data.get('info', {})
        if info and info.get('industry'):
            return {
                'company_name': info.get('companyName'),
                'industry': info.get('industry'),
                'is_fno': info.get('isFNOSec', False),
                'is_etf': info.get('isETFSec', False),
                'listing_date': info.get('listingDate'),
            }
    except Exception:
        pass
    return None


def fetch_from_yahoo(yahoo_ticker):
    """Try Yahoo Finance for sector/industry."""
    try:
        import yfinance as yf
        t = yf.Ticker(yahoo_ticker)
        info = t.info
        if info and info.get('industry'):
            return {
                'company_name': info.get('longName') or info.get('shortName'),
                'industry': info.get('industry'),
                'is_fno': False,
                'is_etf': info.get('quoteType', '') == 'ETF',
                'listing_date': None,
            }
    except Exception:
        pass
    return None


def save_to_db(db, eq_id, meta):
    """Write metadata to DB."""
    update_data = {
        'company_name': meta['company_name'],
        'industry': meta['industry'],
        'is_fno': meta['is_fno'],
        'is_etf': meta['is_etf'],
    }
    if meta.get('listing_date'):
        update_data['listing_date'] = meta['listing_date']
    db.patch('km_equity_symbols', {'id': eq_id}, update_data)


def run(dry_run=False):
    print('Seed BSE Equity Metadata')
    print('=' * 50)

    db = get_db()

    # Get BSE equities that have EOD data but no industry
    print('  Finding BSE equities with EOD data but no industry...')
    bse_equities = db.select('km_equity_symbols', 'id,symbol,vendor_codes,isin',
                             filters={'exchange': 'BSE'})

    # Get equity IDs that have EOD data
    eod_ids_raw = db.select('km_equity_eod', 'DISTINCT equity_id AS eid')
    eod_ids = {row['eid'] for row in eod_ids_raw}

    # Filter to: has EOD, no industry
    targets = []
    for eq in bse_equities:
        if eq['id'] in eod_ids:
            # Check if already has industry
            full = db.select('km_equity_symbols', 'industry', filters={'id': eq['id']})
            if full and not full[0].get('industry'):
                targets.append(eq)

    print(f'  {len(targets)} BSE equities need industry')

    if dry_run:
        for eq in targets[:10]:
            vc = eq.get('vendor_codes') or {}
            nse_sym = vc.get('nse', '')
            yahoo = vc.get('yahoo', '')
            print(f'    {eq["symbol"]}: nse={nse_sym} yahoo={yahoo}')
        print(f'    ... and {len(targets) - 10} more')
        print('\n[DRY RUN] No DB changes made.')
        return

    session = NseSession()
    nse_fetched = 0
    yahoo_fetched = 0
    failed = 0

    for i, eq in enumerate(targets):
        vc = eq.get('vendor_codes') or {}
        meta = None

        # Try NSE first (if stock has NSE vendor code)
        nse_sym = vc.get('nse')
        if nse_sym:
            meta = fetch_from_nse(session, nse_sym)
            if meta:
                nse_fetched += 1
            time.sleep(0.3)

        # Fall back to Yahoo
        if not meta:
            yahoo_ticker = vc.get('yahoo')
            if yahoo_ticker:
                meta = fetch_from_yahoo(yahoo_ticker)
                if meta:
                    yahoo_fetched += 1
                time.sleep(0.3)

        if meta:
            save_to_db(db, eq['id'], meta)
        else:
            failed += 1

        if (i + 1) % 100 == 0:
            print(f'    [{i+1}/{len(targets)}] nse={nse_fetched} yahoo={yahoo_fetched} failed={failed}')

    print(f'\n  Done: nse={nse_fetched}, yahoo={yahoo_fetched}, failed={failed}')
    print(f'  Total seeded: {nse_fetched + yahoo_fetched}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Seed BSE equity metadata')
    parser.add_argument('--dry-run', action='store_true', help='Preview without DB writes')
    args = parser.parse_args()
    run(dry_run=args.dry_run)
