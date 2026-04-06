"""
Kāla-Drishti Daily Pipeline — CLI Entry Point
===============================================

Downloads EOD data from NSE/BSE, parses, inserts into DB,
computes indicators, refreshes materialized views.

Usage
-----
  # Run for today (or last trading day if weekend)
  python daily_pipeline.py

  # Specific date
  python daily_pipeline.py --date 2026-04-04

  # Backfill date range
  python daily_pipeline.py --from 2026-03-01 --to 2026-04-04

  # Specific exchange only
  python daily_pipeline.py --exchange NSE

  # Skip indicator computation
  python daily_pipeline.py --skip-indicators

  # Dry run — show what would be downloaded
  python daily_pipeline.py --dry-run

  # Status check — show pipeline status for recent days
  python daily_pipeline.py --status
"""

import os
import sys
import argparse
from datetime import date, datetime, timedelta

# Add backend dir to path
script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, script_dir)

from lib.db_client import get_db
from pipeline.utils.trading_calendar import (
    is_weekend, is_trading_day, is_already_completed,
    mark_day_status, get_missing_dates, last_trading_day,
)
from pipeline.utils.step_tracker import StepTracker
from pipeline.utils.nse_session import NseSession
from pipeline.downloaders.nse_bhav import download_nse_bhav, download_nse_delivery
from pipeline.processors.parser import parse_nse_bhav, parse_nse_delivery
from pipeline.processors.symbol_matcher import SymbolMatcher
from pipeline.processors.inserter import upsert_equity_eod, update_delivery


def run_nse_pipeline(db, trade_date: date, dry_run: bool = False,
                     skip_indicators: bool = False):
    """Run the full NSE pipeline for a single date."""
    tracker = StepTracker(db, trade_date, exchange='NSE')

    print(f'\n{"=" * 60}')
    print(f'  NSE Pipeline — {trade_date.strftime("%d-%b-%Y")} ({trade_date.strftime("%A")})')
    print(f'{"=" * 60}')

    # ── Pre-checks ──
    if is_weekend(trade_date):
        print(f'  Weekend — skipping')
        mark_day_status(db, trade_date, 'NSE', 'weekend')
        return False

    if is_already_completed(db, trade_date, 'NSE'):
        print(f'  Already completed — skipping')
        return True

    if dry_run:
        print(f'  [DRY RUN] Would download NSE bhav copy for {trade_date}')
        matcher = SymbolMatcher(db, exchange='NSE')
        print(f'  {matcher.total_symbols} NSE symbols in master table')
        return True

    # ── Step 1: Download bhav copy ──
    nse = NseSession()

    tracker.start('download')
    try:
        csv_path = download_nse_bhav(trade_date, session=nse)
        if csv_path is None:
            tracker.fail('download', 'No bhav copy available (holiday or not yet published)')
            mark_day_status(db, trade_date, 'NSE', 'no_data')
            return False
        tracker.complete('download', metadata={'file': csv_path})
    except Exception as e:
        tracker.fail('download', str(e))
        mark_day_status(db, trade_date, 'NSE', 'failed')
        return False

    # ── Step 2: Parse CSV ──
    tracker.start('parse')
    try:
        records = parse_nse_bhav(csv_path, trade_date)
        tracker.complete('parse', rows=len(records))
    except Exception as e:
        tracker.fail('parse', str(e))
        mark_day_status(db, trade_date, 'NSE', 'failed')
        return False

    if not records:
        print('  No equity records found in bhav copy')
        mark_day_status(db, trade_date, 'NSE', 'no_data')
        return False

    # ── Step 3: Match symbols ──
    matcher = SymbolMatcher(db, exchange='NSE')
    matched, unmatched = matcher.match_records(records)
    print(f'  [match] {len(matched)} matched, {len(unmatched)} unmatched of {len(records)} parsed')

    # ── Step 4: Insert into DB ──
    tracker.start('insert')
    try:
        count = upsert_equity_eod(db, matched)
        tracker.complete('insert', rows=count, metadata={
            'unmatched_count': len(unmatched),
            'unmatched_sample': unmatched[:20],
        })
    except Exception as e:
        tracker.fail('insert', str(e))
        mark_day_status(db, trade_date, 'NSE', 'failed')
        return False

    # ── Step 5: Download + apply delivery data ──
    tracker.start('delivery')
    try:
        deliv_path = download_nse_delivery(trade_date, session=nse)
        if deliv_path:
            deliv_map = parse_nse_delivery(deliv_path)
            deliv_count = update_delivery(db, str(trade_date), deliv_map, matcher)
            tracker.complete('delivery', rows=deliv_count)
        else:
            tracker.skip('delivery', 'No delivery data available')
    except Exception as e:
        tracker.fail('delivery', str(e))
        # Non-critical — don't fail the whole pipeline

    # ── Step 6: Indicators (optional) ──
    if not skip_indicators:
        tracker.start('indicators')
        try:
            from indicators.compute_engine import IndicatorEngine
            engine = IndicatorEngine(db)
            ind_count = engine.run(mode='equity', full=False)
            tracker.complete('indicators', rows=ind_count)
        except ImportError:
            tracker.skip('indicators', 'Indicator engine not available')
        except Exception as e:
            tracker.fail('indicators', str(e))
            # Non-critical

    # ── Step 7: Refresh views ──
    tracker.start('views')
    try:
        db.rpc('refresh_index_catalog')
        tracker.complete('views')
    except Exception as e:
        tracker.skip('views', str(e))

    # ── Mark day complete ──
    mark_day_status(db, trade_date, 'NSE', 'completed')
    print(f'\n  ✓ NSE pipeline completed for {trade_date}')
    return True


def show_status(db, days: int = 14):
    """Show pipeline status for recent days."""
    print(f'\n{"=" * 60}')
    print(f'  Pipeline Status — Last {days} Days')
    print(f'{"=" * 60}\n')

    today = date.today()
    for i in range(days):
        d = today - timedelta(days=i)
        day_name = d.strftime('%a')

        if is_weekend(d):
            print(f'  {d}  {day_name:3}  ·  Weekend')
            continue

        rows = db.select(
            'km_trading_calendar',
            'status,exchange',
            filters={'trade_date': str(d)},
        )
        if not rows:
            print(f'  {d}  {day_name:3}  ○  Not attempted')
            continue

        for row in rows:
            status = row.get('status', 'unknown')
            exchange = row.get('exchange', 'NSE')
            icon = {'completed': '●', 'failed': '✗', 'no_data': '○',
                    'holiday': '○', 'pending': '◌'}.get(status, '?')
            print(f'  {d}  {day_name:3}  {icon}  {exchange}: {status}')

    # Show step details for today
    steps = db.select(
        'km_pipeline_runs',
        '*',
        filters={'trade_date': str(today)},
        order='id',
    )
    if steps:
        print(f'\n  Today\'s steps:')
        for s in steps:
            icon = {'completed': '✓', 'failed': '✗', 'running': '…',
                    'skipped': '–'}.get(s['status'], '?')
            duration = f"{s.get('duration_ms', 0)}ms" if s.get('duration_ms') else ''
            rows_info = f"({s.get('rows_count', 0)} rows)" if s.get('rows_count') else ''
            print(f'    {icon} {s["step"]:12} {s["status"]:10} {rows_info:15} {duration}')


def main():
    parser = argparse.ArgumentParser(
        description='Kāla-Drishti Daily Data Pipeline'
    )
    parser.add_argument('--date', type=str, default=None,
                        help='Trade date (YYYY-MM-DD). Default: last trading day')
    parser.add_argument('--from', dest='date_from', type=str, default=None,
                        help='Start date for backfill (YYYY-MM-DD)')
    parser.add_argument('--to', dest='date_to', type=str, default=None,
                        help='End date for backfill (YYYY-MM-DD)')
    parser.add_argument('--exchange', type=str, default='NSE',
                        choices=['NSE', 'BSE', 'ALL'],
                        help='Exchange to process (default: NSE)')
    parser.add_argument('--skip-indicators', action='store_true',
                        help='Skip indicator computation')
    parser.add_argument('--dry-run', action='store_true',
                        help='Show what would be downloaded without executing')
    parser.add_argument('--status', action='store_true',
                        help='Show pipeline status for recent days')
    parser.add_argument('--force', action='store_true',
                        help='Force re-run even if already completed')

    args = parser.parse_args()

    print('=' * 60)
    print('  KĀLA-DRISHTI DAILY DATA PIPELINE')
    print('=' * 60)

    # Connect to DB
    db = get_db()

    # Status mode
    if args.status:
        show_status(db)
        return

    # Determine date(s) to process
    if args.date_from and args.date_to:
        # Backfill mode
        from_dt = date.fromisoformat(args.date_from)
        to_dt = date.fromisoformat(args.date_to)
        dates = get_missing_dates(db, from_dt, to_dt, args.exchange)
        if not dates:
            print(f'\n  No missing dates between {from_dt} and {to_dt}')
            return
        print(f'\n  Backfill: {len(dates)} missing date(s) from {from_dt} to {to_dt}')
    elif args.date:
        target = date.fromisoformat(args.date)
        dates = [target]
    else:
        target = last_trading_day()
        dates = [target]

    # Process each date
    success_count = 0
    fail_count = 0

    for d in dates:
        if args.force:
            # Clear existing status to force re-run
            mark_day_status(db, d, args.exchange, 'pending')

        if args.exchange in ('NSE', 'ALL'):
            ok = run_nse_pipeline(db, d, dry_run=args.dry_run,
                                  skip_indicators=args.skip_indicators)
            if ok:
                success_count += 1
            else:
                fail_count += 1

        # BSE pipeline — placeholder for Phase 5
        if args.exchange in ('BSE', 'ALL'):
            print(f'\n  BSE pipeline not yet implemented')

    # Summary
    print(f'\n{"=" * 60}')
    print(f'  Pipeline Summary')
    print(f'{"=" * 60}')
    print(f'  Dates processed: {len(dates)}')
    print(f'  Success: {success_count}')
    print(f'  Failed:  {fail_count}')
    if args.dry_run:
        print(f'  (DRY RUN — no data was downloaded or inserted)')
    print()


if __name__ == '__main__':
    main()
