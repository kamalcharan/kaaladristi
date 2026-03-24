"""
Kāla-Drishti — Unified Breeze EOD Downloader
==============================================
Downloads end-of-day OHLCV data from ICICI Breeze API into Supabase.
Handles indices (including TRI) and equities (NSE + BSE).

Usage
-----
  # All indices, last 1 year
  python breeze_downloader.py --asset index --days 365

  # TRI indices only
  python breeze_downloader.py --asset index --tri-only --days 365

  # All NSE equities, last 1 year
  python breeze_downloader.py --asset equity --exchange NSE --days 365

  # BSE equities
  python breeze_downloader.py --asset equity --exchange BSE --days 365

  # Single symbol
  python breeze_downloader.py --asset equity --symbol RELIANCE --days 7300

  # Batch mode (symbols 1-100 by DB id order)
  python breeze_downloader.py --asset equity --batch 1-100 --days 365

  # Dry run — show what would be downloaded
  python breeze_downloader.py --asset equity --dry-run

  # Resume mode — only fetch data after last known trade_date per symbol
  python breeze_downloader.py --asset equity --resume
"""

import sys
import os
import json
import argparse
from datetime import datetime, timedelta

# Add parent to path for lib imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lib.config import BATCH_SIZE
from lib.supabase_client import get_supabase
from lib.breeze_client import init_breeze, fetch_historical
from lib.sync_logger import SyncLogger


# ═════════════════════════════════════════════════════════════════════════════
# HELPERS
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


def parse_date(s: str) -> datetime:
    return datetime.strptime(s, '%Y-%m-%d')


def transform_eod_record(raw: dict, fk_field: str, fk_id: int) -> dict:
    """Transform a Breeze candle dict into a Supabase EOD row."""
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


def batch_upsert(sb, table: str, records: list, on_conflict: str) -> int:
    """Upsert records to Supabase in batches. Returns count of upserted rows."""
    if not records:
        return 0
    total = 0
    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i:i + BATCH_SIZE]
        try:
            total += sb.upsert(table, batch, on_conflict)
        except Exception as e:
            print(f'    Batch upsert error: {e}')
            # Fall back to row-by-row for this batch
            for rec in batch:
                if sb.insert(table, rec):
                    total += 1
    return total


def get_last_trade_date(sb, table: str, fk_field: str, fk_id: int) -> str:
    """Get the most recent trade_date for a symbol from Supabase."""
    try:
        rows = sb.select(table, 'trade_date',
                         filters={fk_field: fk_id},
                         order='trade_date.desc', limit=1)
        if rows:
            return rows[0]['trade_date']
    except Exception:
        pass
    return None


# ═════════════════════════════════════════════════════════════════════════════
# INDEX DOWNLOADER
# ═════════════════════════════════════════════════════════════════════════════

def download_indices(breeze, sb, logger, from_dt, to_dt, args):
    print('\n' + '=' * 60)
    print('DOWNLOADING INDEX EOD DATA')
    print('=' * 60)

    # Fetch index masters
    if args.symbol:
        indices = sb.select('km_index_symbols', 'id,name,vendor_codes,is_tri',
                            ilike=('name', f'%{args.symbol}%'))
    else:
        indices = sb.select('km_index_symbols', 'id,name,vendor_codes,is_tri')

    if not indices:
        print('  No indices found')
        return

    # Filter TRI-only if requested
    if args.tri_only:
        indices = [i for i in indices if i.get('is_tri')]
        print(f'  TRI indices: {len(indices)}')
    else:
        print(f'  Total indices: {len(indices)}')

    total_upserted = 0
    skipped = 0
    failed = 0

    for i, idx in enumerate(indices, 1):
        name = idx['name']
        idx_id = idx['id']
        vc = idx.get('vendor_codes') or {}
        if isinstance(vc, str):
            vc = json.loads(vc)

        breeze_code = vc.get('breeze')
        if not breeze_code:
            skipped += 1
            continue

        # Resume mode: start from last known date + 1 day
        effective_from = from_dt
        if args.resume:
            last_date = get_last_trade_date(sb, 'km_index_eod', 'index_id', idx_id)
            if last_date:
                effective_from = max(from_dt, parse_date(last_date) + timedelta(days=1))
                if effective_from >= to_dt:
                    print(f'  [{i}/{len(indices)}] {name} — up to date')
                    continue

        print(f'  [{i}/{len(indices)}] {name} -> {breeze_code}', end='', flush=True)

        logger.start_timer()
        raw = fetch_historical(breeze, breeze_code, 'NSE', effective_from, to_dt, '1day')

        if not raw:
            print(f' — no data')
            logger.log('eod_index', name, 'NSE',
                        effective_from.strftime('%Y-%m-%d'), to_dt.strftime('%Y-%m-%d'),
                        0, 0, 'no_data', duration_ms=logger.elapsed_ms())
            failed += 1
            continue

        print(f' — {len(raw)} candles', end='', flush=True)

        records = [transform_eod_record(r, 'index_id', idx_id) for r in raw]
        # Filter out records with no trade_date
        records = [r for r in records if r['trade_date']]

        n = batch_upsert(sb, 'km_index_eod', records, 'index_id,trade_date')
        total_upserted += n
        print(f' — upserted {n}')

        logger.log('eod_index', name, 'NSE',
                    effective_from.strftime('%Y-%m-%d'), to_dt.strftime('%Y-%m-%d'),
                    len(raw), n, 'success', duration_ms=logger.elapsed_ms())

    print(f'\n  INDEX SUMMARY: {total_upserted} upserted, {skipped} skipped (no breeze code), {failed} no data')


# ═════════════════════════════════════════════════════════════════════════════
# EQUITY DOWNLOADER
# ═════════════════════════════════════════════════════════════════════════════

def download_equities(breeze, sb, logger, from_dt, to_dt, args):
    print('\n' + '=' * 60)
    print(f'DOWNLOADING EQUITY EOD DATA ({args.exchange})')
    print('=' * 60)

    # Fetch equity masters
    if args.symbol:
        equities = sb.select('km_equity_symbols', 'id,symbol,vendor_codes,exchange',
                             filters={'symbol': args.symbol.upper()}, order='symbol')
    else:
        equities = sb.select('km_equity_symbols', 'id,symbol,vendor_codes,exchange',
                             order='symbol')

    if not equities:
        print('  No equities found')
        return

    # Filter by exchange if specified
    if args.exchange and args.exchange != 'ALL':
        equities = [e for e in equities if (e.get('exchange') or 'NSE') == args.exchange.upper()]

    # Apply batch range if specified
    if args.batch:
        start, end = map(int, args.batch.split('-'))
        equities = equities[start - 1:end]  # 1-indexed
        print(f'  Batch {start}-{end}: {len(equities)} equities')
    else:
        print(f'  Total equities: {len(equities)}')

    # Count how many have breeze codes (check both breeze and breeze_bse)
    def has_breeze_code(e):
        vc = e.get('vendor_codes') or {}
        ex = (e.get('exchange') or 'NSE').upper()
        if ex == 'BSE':
            return bool(vc.get('breeze_bse') or vc.get('breeze'))
        return bool(vc.get('breeze'))

    with_code = sum(1 for e in equities if has_breeze_code(e))
    print(f'  With Breeze codes: {with_code}')

    if with_code == 0:
        print('  ERROR: No equities have Breeze codes set.')
        print('  Run: python populate_vendor_codes.py --session-token <TOKEN>')
        print('  For BSE: python populate_bse_symbols.py')
        return
    total_upserted = 0
    failed = 0
    skipped = 0
    failed_symbols = []

    for i, eq in enumerate(equities, 1):
        symbol = eq['symbol']
        eq_id = eq['id']
        vc = eq.get('vendor_codes') or {}
        if isinstance(vc, str):
            vc = json.loads(vc)

        # Pick the right Breeze code based on exchange
        eq_exchange = (eq.get('exchange') or 'NSE').upper()
        if eq_exchange == 'BSE':
            breeze_code = vc.get('breeze_bse') or vc.get('breeze')
            api_exchange = 'BSE'
        else:
            breeze_code = vc.get('breeze')
            api_exchange = 'NSE'

        if not breeze_code:
            skipped += 1
            continue

        # Resume mode
        effective_from = from_dt
        if args.resume:
            last_date = get_last_trade_date(sb, 'km_equity_eod', 'equity_id', eq_id)
            if last_date:
                effective_from = max(from_dt, parse_date(last_date) + timedelta(days=1))
                if effective_from >= to_dt:
                    continue  # up to date, skip silently

        suffix = f' (ISEC: {breeze_code})' if breeze_code != symbol else ''
        print(f'  [{i}/{len(equities)}] {symbol} [{eq_exchange}]{suffix}', end='', flush=True)

        logger.start_timer()
        raw = fetch_historical(breeze, breeze_code, api_exchange, effective_from, to_dt, '1day')

        if not raw:
            print(f' — no data')
            logger.log('eod_equity', symbol, api_exchange,
                        effective_from.strftime('%Y-%m-%d'), to_dt.strftime('%Y-%m-%d'),
                        0, 0, 'no_data', duration_ms=logger.elapsed_ms())
            failed += 1
            failed_symbols.append(symbol)
            continue

        print(f' — {len(raw)} candles', end='', flush=True)

        records = [transform_eod_record(r, 'equity_id', eq_id) for r in raw]
        records = [r for r in records if r['trade_date']]

        n = batch_upsert(sb, 'km_equity_eod', records, 'equity_id,trade_date')
        total_upserted += n
        print(f' — upserted {n}')

        logger.log('eod_equity', symbol, api_exchange,
                    effective_from.strftime('%Y-%m-%d'), to_dt.strftime('%Y-%m-%d'),
                    len(raw), n, 'success', duration_ms=logger.elapsed_ms())

    print(f'\n  EQUITY SUMMARY: {total_upserted} upserted, {failed} failed, {skipped} skipped (no breeze code)')
    if failed_symbols and len(failed_symbols) <= 20:
        print(f'  Failed: {", ".join(failed_symbols)}')


# ═════════════════════════════════════════════════════════════════════════════
# DRY RUN
# ═════════════════════════════════════════════════════════════════════════════

def dry_run(sb, args):
    print('\n[DRY RUN] Would download:\n')

    if args.asset in ('index', 'both'):
        rows = sb.select('km_index_symbols', 'name,vendor_codes,is_tri')
        mapped = [r for r in rows if (r.get('vendor_codes') or {}).get('breeze')]
        tri = [r for r in mapped if r.get('is_tri')]
        print(f'  Indices: {len(mapped)} with breeze code out of {len(rows)} total')
        if tri:
            print(f'    TRI: {len(tri)}')

    if args.asset in ('equity', 'both'):
        rows = sb.select('km_equity_symbols', 'symbol,vendor_codes,exchange')
        mapped = [r for r in rows if (r.get('vendor_codes') or {}).get('breeze')]
        if args.exchange and args.exchange != 'ALL':
            mapped = [r for r in mapped if (r.get('exchange') or 'NSE') == args.exchange.upper()]
        print(f'  Equities ({args.exchange or "ALL"}): {len(mapped)} with breeze code out of {len(rows)} total')


# ═════════════════════════════════════════════════════════════════════════════
# CLI
# ═════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description='Download EOD data from ICICI Breeze into Supabase'
    )
    parser.add_argument('--asset', choices=['index', 'equity', 'both'], default='both',
                        help='Asset type to download')
    parser.add_argument('--exchange', type=str, default='NSE',
                        help='Exchange: NSE, BSE, or ALL (equities only)')
    parser.add_argument('--days', type=int, default=365,
                        help='Number of days of history (default: 365)')
    parser.add_argument('--from', dest='from_date', type=str,
                        help='Start date YYYY-MM-DD (overrides --days)')
    parser.add_argument('--to', dest='to_date', type=str,
                        help='End date YYYY-MM-DD (default: today)')
    parser.add_argument('--symbol', type=str,
                        help='Single symbol or index name to download')
    parser.add_argument('--batch', type=str,
                        help='Batch range e.g. 1-100 (for parallel runs)')
    parser.add_argument('--tri-only', action='store_true',
                        help='Download only TRI indices')
    parser.add_argument('--resume', action='store_true',
                        help='Resume from last known trade_date per symbol')
    parser.add_argument('--session-token', type=str, default='',
                        help='Breeze session token (overrides .env)')
    parser.add_argument('--dry-run', action='store_true',
                        help='Show what would be downloaded without fetching')

    args = parser.parse_args()

    # Date range
    to_dt = parse_date(args.to_date) if args.to_date else datetime.now()
    if args.from_date:
        from_dt = parse_date(args.from_date)
    else:
        from_dt = to_dt - timedelta(days=args.days)

    print('=' * 60)
    print('KĀLA-DRISHTI EOD DOWNLOADER (ICICI Breeze)')
    print('=' * 60)
    print(f'  Asset    : {args.asset}')
    print(f'  Exchange : {args.exchange}')
    print(f'  Period   : {from_dt.strftime("%Y-%m-%d")} to {to_dt.strftime("%Y-%m-%d")}')
    print(f'  Symbol   : {args.symbol or "ALL"}')
    print(f'  Resume   : {args.resume}')
    if args.batch:
        print(f'  Batch    : {args.batch}')
    print()

    # Init Supabase
    sb = get_supabase()
    print('  Supabase connected')

    # Dry run mode
    if args.dry_run:
        dry_run(sb, args)
        return

    # Init Breeze
    breeze = init_breeze(args.session_token or None)

    # Init sync logger
    logger = SyncLogger(sb)

    # Download
    if args.asset in ('index', 'both'):
        download_indices(breeze, sb, logger, from_dt, to_dt, args)

    if args.asset in ('equity', 'both'):
        download_equities(breeze, sb, logger, from_dt, to_dt, args)

    print('\n' + '=' * 60)
    print('DOWNLOAD COMPLETE')
    print('=' * 60)


if __name__ == '__main__':
    main()
