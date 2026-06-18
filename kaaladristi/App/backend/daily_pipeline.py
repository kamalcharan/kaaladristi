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
import calendar
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
from pipeline.compute import compute_index_returns, aggregate_weekly_bars, aggregate_monthly_bars
from pipeline.utils.nse_session import NseSession
from pipeline.downloaders.nse_bhav import download_nse_bhav, download_nse_delivery
from pipeline.downloaders.bse_bhav import download_bse_bhav
from pipeline.downloaders.nse_index_bhav import (
    download_nse_index_bhav, download_nse_tri,
    parse_nse_index_bhav, parse_nse_tri,
    IndexMatcher, upsert_index_eod,
)
from pipeline.downloaders.nse_fiidii import download_nse_fiidii, upsert_fii_dii
from pipeline.processors.parser import parse_nse_bhav, parse_nse_delivery, parse_bse_bhav
from pipeline.processors.symbol_matcher import SymbolMatcher
from pipeline.processors.inserter import upsert_equity_eod, update_delivery, sync_isin_from_bhav
from pipeline.utils.coverage import get_step_coverage, count_active_symbols
from scripts.backfill_supertrend import compute_supertrend_for_date
from scripts.backfill_d365 import compute_d365_for_date
from scripts.backfill_rolling_metrics import compute_rolling_metrics_for_date
from scripts.backfill_stage_classification import compute_stage_for_date
from scripts.backfill_rs_percentile import compute_rs_percentile_for_date
from scripts.backfill_vani_flags import compute_vani_flags_for_date
from scripts.sync_nse_isin_master import sync_nse_isin_master


def is_week_end(d: date) -> bool:
    """True if d is a Friday (ISO weekday 5).

    The weekly aggregate is triggered on Fridays regardless of whether
    tomorrow is a trading day — the pipeline always runs on trading days,
    and Friday is the natural ISO week boundary.
    """
    return d.isoweekday() == 5


def is_month_end(d: date) -> bool:
    """True if d is the last calendar day of its month."""
    return d.day == calendar.monthrange(d.year, d.month)[1]


def run_nse_pipeline(db, trade_date: date, dry_run: bool = False,
                     skip_indicators: bool = False, force: bool = False):
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

    if force:
        print(f'  [FORCE] Resetting completed status — re-running all steps')
        mark_day_status(db, trade_date, 'NSE', 'pending')
    elif is_already_completed(db, trade_date, 'NSE'):
        print(f'  Already completed — skipping (use --force to re-run)')
        return True

    if dry_run:
        print(f'  [DRY RUN] Would download NSE bhav copy for {trade_date}')
        matcher = SymbolMatcher(db, exchange='NSE')
        print(f'  {matcher.total_symbols} NSE symbols in master table')
        return True

    nse = NseSession()

    # ── Step 0: Download + insert index bhav ──
    market_holiday = False
    tracker.start('index_download')
    try:
        idx_csv = download_nse_index_bhav(trade_date, session=nse)
        if idx_csv:
            idx_records = parse_nse_index_bhav(idx_csv, trade_date)
            idx_matcher = IndexMatcher(db)
            idx_matched, idx_unmatched = idx_matcher.match_records(idx_records)
            idx_count = upsert_index_eod(db, idx_matched)
            tracker.complete('index_download', rows=idx_count, metadata={
                'parsed': len(idx_records), 'matched': len(idx_matched),
                'unmatched': len(idx_unmatched),
            })
            print(f'  [index] {idx_count} indexes upserted, {len(idx_unmatched)} unmatched')
        else:
            market_holiday = True
            tracker.skip('index_download', 'No index data available')
    except Exception as e:
        tracker.fail('index_download', str(e))

    # If index data is missing on a weekday, it's almost certainly a market holiday.
    # Skip TRI + FII/DII immediately — no retries needed for a holiday.
    if market_holiday:
        tracker.skip('tri_download', 'Skipped — likely market holiday')
        tracker.skip('fii_dii', 'Skipped — likely market holiday')
        mark_day_status(db, trade_date, 'NSE', 'holiday')
        print(f'  [pipeline] {trade_date} appears to be a market holiday — skipping')
        print(f'  ✓ NSE pipeline skipped for {trade_date} (holiday)')
        return True

    # ── Step 0b: Download + insert TRI data ──
    tracker.start('tri_download')
    try:
        tri_csv = download_nse_tri(trade_date, session=nse)
        if tri_csv:
            tri_records = parse_nse_tri(tri_csv, trade_date)
            if not hasattr(idx_matcher, '_loaded'):
                idx_matcher = IndexMatcher(db)
            tri_matched, tri_unmatched = idx_matcher.match_records(tri_records, is_tri=True)
            tri_count = upsert_index_eod(db, tri_matched)
            tracker.complete('tri_download', rows=tri_count)
        else:
            tracker.skip('tri_download', 'No TRI data available (URL may have changed)')
    except Exception as e:
        tracker.fail('tri_download', str(e))

    # ── Step 0c: FII/DII activity ──
    tracker.start('fii_dii')
    try:
        fiidii_records = download_nse_fiidii(trade_date, session=nse)
        if fiidii_records:
            fiidii_count = upsert_fii_dii(db, fiidii_records)
            tracker.complete('fii_dii', rows=fiidii_count, metadata={
                'categories': [r['category'] for r in fiidii_records],
            })
            print(f'  [fii_dii] {fiidii_count} records upserted '
                  f'({", ".join(r["category"] + "=" + str(r["net_value"]) for r in fiidii_records)})')
        else:
            tracker.skip('fii_dii', 'No FII/DII data for this date')
    except Exception as e:
        tracker.fail('fii_dii', str(e))
        # Non-critical — do not abort the pipeline

    # ── Step 0d: Index indicators (RPC) ──
    if not skip_indicators:
        tracker.start('index_indicators')
        try:
            result = db.rpc('compute_all_pending_indicators', {
                'p_table': 'km_index_eod',
                'p_id_col': 'index_id',
            })
            ind_count = sum(r.get('rows_updated', 0) for r in (result or []))
            actual, expected = get_step_coverage(db, 'index_indicators', trade_date)
            tracker.complete('index_indicators', rows=actual or ind_count, rows_expected=expected)
        except Exception as e:
            tracker.fail('index_indicators', str(e))

    # ── Step 0e: Index flow intelligence ──
    # Previously ran without StepTracker — any failure surfaced only in stdout,
    # leaving km_pipeline_runs empty and the health grid's Index Flow row
    # permanently showing "no error logged" on red squares. Wrap it now.
    if not skip_indicators:
        tracker.start('index_flow_intelligence')
        try:
            result = db.rpc('compute_all_flow_intelligence', {
                'p_table':     'km_index_eod',
                'p_id_col':    'index_id',
                'p_from_date': str(trade_date),
                'p_to_date':   str(trade_date),
            })
            fi_count = sum(r.get('rows_updated', 0) for r in (result or []))
            tracker.complete('index_flow_intelligence', rows=fi_count)
            if fi_count > 0:
                print(f'  [flow-intel] Index: updated {fi_count} rows')
        except Exception as e:
            tracker.fail('index_flow_intelligence', str(e))

    # ── Step 1: Download equity bhav copy ──
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
        expected_symbols = count_active_symbols(db, 'NSE') if hasattr(db, '_conn') else len(matched)
        tracker.complete('insert', rows=count, rows_expected=expected_symbols, metadata={
            'unmatched_count': len(unmatched),
            'unmatched_sample': unmatched[:20],
        })
    except Exception as e:
        tracker.fail('insert', str(e))
        mark_day_status(db, trade_date, 'NSE', 'failed')
        return False

    # ── Step 4b: Sync ISINs from bhavcopy → km_equity_symbols ──
    # Bhavcopy already contains ISIN per symbol; use equity_id resolved by
    # SymbolMatcher to update any NULL isin rows without symbol-format ambiguity.
    try:
        isin_updated = sync_isin_from_bhav(db, matched)
        if isin_updated:
            print(f'  [isin-sync] {isin_updated} NULL ISINs populated from bhavcopy')
    except Exception as e:
        print(f'  [isin-sync] Non-critical error: {e}')

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

    # ── Step 6: Indicators (PostgreSQL RPC — fast) ──
    if not skip_indicators:
        tracker.start('indicators')
        try:
            result = db.rpc('compute_all_pending_indicators', {
                'p_table': 'km_equity_eod',
                'p_id_col': 'equity_id',
            })
            ind_count = sum(r.get('rows_updated', 0) for r in (result or []))
            actual, expected = get_step_coverage(db, 'indicators', trade_date, 'NSE')
            tracker.complete('indicators', rows=actual or ind_count, rows_expected=expected)
        except Exception as e:
            tracker.fail('indicators', str(e))

    # ── Step 6_super: SuperTrend (needs atr_10 from step 6) ──
    if not skip_indicators:
        tracker.start('supertrend')
        try:
            st_count = compute_supertrend_for_date(db, trade_date, verbose=True)
            tracker.complete('supertrend', rows=st_count)
        except Exception as e:
            tracker.fail('supertrend', str(e))

    # ── Step 6g: Rolling metrics (w52_high, w52_low, lifetime_high) ──
    # Pure SQL window function — no compiled package dependency.
    # Must run BEFORE magic_rs and flow_intelligence.
    if not skip_indicators:
        tracker.start('rolling_metrics')
        try:
            rm_count = compute_rolling_metrics_for_date(db, trade_date, verbose=True)
            tracker.complete('rolling_metrics', rows=rm_count)
        except Exception as e:
            tracker.fail('rolling_metrics', str(e))

    # ── Step 6_d365: d365_pct_chng (calendar 365-day lookback) ──
    if not skip_indicators:
        tracker.start('d365')
        try:
            d365_count = compute_d365_for_date(db, trade_date, verbose=True)
            tracker.complete('d365', rows=d365_count)
        except Exception as e:
            tracker.fail('d365', str(e))

    # ── Step 6a: MagicRS for equities ──
    # Direct psycopg2 call with explicit ::text/::date casts — the generic
    # rpc() helper passes string literals as 'unknown' type which causes
    # PostgreSQL to fail overload resolution for this function.
    if not skip_indicators:
        tracker.start('magic_rs')
        try:
            import psycopg2 as _pg2
            import psycopg2.extras as _pg2x
            from lib.config import DATABASE_URL as _DBURL
            _conn = _pg2.connect(_DBURL, connect_timeout=30)
            try:
                with _conn.cursor(cursor_factory=_pg2x.RealDictCursor) as _cur:
                    _cur.execute(
                        "SELECT * FROM compute_all_magic_rs"
                        "(%s::text, %s::text, %s::date)",
                        ['km_equity_eod', 'equity_id', str(trade_date)],
                    )
                    _rows = _cur.fetchall()
                _conn.commit()
                mrs_count = sum(r.get('rows_updated', 0) for r in _rows)
            finally:
                _conn.close()
            actual, expected = get_step_coverage(db, 'magic_rs', trade_date, 'NSE')
            tracker.complete('magic_rs', rows=actual or mrs_count, rows_expected=expected)
        except Exception as e:
            tracker.fail('magic_rs', str(e))

    # ── Step 6b: Flow Intelligence ──
    if not skip_indicators:
        tracker.start('flow_intelligence')
        try:
            result = db.rpc('compute_all_flow_intelligence', {
                'p_table':     'km_equity_eod',
                'p_id_col':    'equity_id',
                'p_from_date': str(trade_date),
                'p_to_date':   str(trade_date),
            })
            fi_count = sum(r.get('rows_updated', 0) for r in (result or []))
            actual, expected = get_step_coverage(db, 'flow_intelligence', trade_date, 'NSE')
            tracker.complete('flow_intelligence', rows=actual or fi_count, rows_expected=expected)
        except Exception as e:
            tracker.fail('flow_intelligence', str(e))

    # ── Step 6c: Industry Composites ──
    if not skip_indicators:
        tracker.start('industry_composites')
        try:
            result = db.rpc('compute_all_industry_composites', {
                'p_trade_date': str(trade_date),
            })
            ic_count = result[0].get('compute_all_industry_composites', 0) if result else 0
            tracker.complete('industry_composites', rows=ic_count, rows_expected=max(ic_count, 40))
        except Exception as e:
            tracker.fail('industry_composites', str(e))

    # ── Step 6d: Index returns (ret_5d / ret_22d / ret_66d) ──
    if not skip_indicators:
        tracker.start('index_returns')
        try:
            ir_count = compute_index_returns(
                db, from_date=trade_date - timedelta(days=5),
            )
            tracker.complete('index_returns', rows=ir_count)
        except Exception as e:
            tracker.fail('index_returns', str(e))

    # ── Step 6e: Weekly equity aggregate (Fridays only) ──
    if not skip_indicators and is_week_end(trade_date):
        tracker.start('equity_weekly')
        try:
            ew_count = aggregate_weekly_bars(
                db, from_date=trade_date, run_indicators=True, verbose=True,
            )
            tracker.complete('equity_weekly', rows=ew_count)
        except Exception as e:
            tracker.fail('equity_weekly', str(e))

    # ── Step 6f: Monthly equity aggregate (last calendar day only) ──
    if not skip_indicators and is_month_end(trade_date):
        tracker.start('equity_monthly')
        try:
            em_count = aggregate_monthly_bars(
                db, from_date=trade_date, run_indicators=True, verbose=True,
            )
            tracker.complete('equity_monthly', rows=em_count)
        except Exception as e:
            tracker.fail('equity_monthly', str(e))

    # ── Step 6h: Stage classification (sma200_rising, stage, is_vani_s2) ──
    # Depends on w52_high/w52_low/lifetime_high from step 6g — must run after.
    if not skip_indicators:
        tracker.start('stage_classification')
        try:
            sc_count = compute_stage_for_date(db, trade_date, verbose=True)
            tracker.complete('stage_classification', rows=sc_count)
        except Exception as e:
            tracker.fail('stage_classification', str(e))

    # ── Step 6k: RS Percentile ──
    # Ranks each equity by magic_rs within the day's universe (PERCENT_RANK).
    # Depends on magic_rs from step 6a — must run after.
    if not skip_indicators:
        tracker.start('rs_percentile')
        try:
            rsp_count = compute_rs_percentile_for_date(db, trade_date, verbose=True)
            tracker.complete('rs_percentile', rows=rsp_count)
        except Exception as e:
            tracker.fail('rs_percentile', str(e))

    # ── Step 6j: VaNi screener flags (all is_vani_* columns except is_vani_s2) ──
    # Depends on magic_rs/flow_type/rsi/rvol/w52/ema_20/supertrend from all prior steps.
    if not skip_indicators:
        tracker.start('vani_flags')
        try:
            vf_count = compute_vani_flags_for_date(db, trade_date, verbose=False)
            tracker.complete('vani_flags', rows=vf_count)
        except Exception as e:
            tracker.fail('vani_flags', str(e))

    # ── Step 6i: ISIN master sync (weekly — Mondays only) ──
    # Downloads NSE EQUITY_L.csv and backfills any missing/changed ISINs in
    # km_equity_symbols. Runs weekly to avoid a daily network call.
    if not skip_indicators and trade_date.weekday() == 0:  # Monday
        tracker.start('isin_sync')
        try:
            isin_count = sync_nse_isin_master(verbose=True)
            tracker.complete('isin_sync', rows=isin_count)
        except Exception as e:
            tracker.fail('isin_sync', str(e))

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


def run_bse_pipeline(db, trade_date: date, dry_run: bool = False,
                     skip_indicators: bool = False, force: bool = False):
    """Run the full BSE pipeline for a single date."""
    tracker = StepTracker(db, trade_date, exchange='BSE')

    print(f'\n{"=" * 60}')
    print(f'  BSE Pipeline — {trade_date.strftime("%d-%b-%Y")} ({trade_date.strftime("%A")})')
    print(f'{"=" * 60}')

    if is_weekend(trade_date):
        print(f'  Weekend — skipping')
        mark_day_status(db, trade_date, 'BSE', 'weekend')
        return False

    if force:
        print(f'  [FORCE] Resetting completed status — re-running all steps')
        mark_day_status(db, trade_date, 'BSE', 'pending')
    elif is_already_completed(db, trade_date, 'BSE'):
        print(f'  Already completed — skipping (use --force to re-run)')
        return True

    if dry_run:
        matcher = SymbolMatcher(db, exchange='BSE')
        print(f'  [DRY RUN] Would download BSE bhav copy for {trade_date}')
        print(f'  {matcher.total_symbols} BSE symbols in master table')
        return True

    # ── Step 1: Download ──
    tracker.start('download')
    try:
        csv_path = download_bse_bhav(trade_date)
        if csv_path is None:
            tracker.fail('download', 'No BSE bhav copy available')
            mark_day_status(db, trade_date, 'BSE', 'no_data')
            return False
        tracker.complete('download', metadata={'file': csv_path})
    except Exception as e:
        tracker.fail('download', str(e))
        mark_day_status(db, trade_date, 'BSE', 'failed')
        return False

    # ── Step 2: Parse ──
    tracker.start('parse')
    try:
        records = parse_bse_bhav(csv_path, trade_date)
        tracker.complete('parse', rows=len(records))
    except Exception as e:
        tracker.fail('parse', str(e))
        mark_day_status(db, trade_date, 'BSE', 'failed')
        return False

    if not records:
        print('  No equity records found in BSE bhav copy')
        mark_day_status(db, trade_date, 'BSE', 'no_data')
        return False

    # ── Step 3: Match symbols ──
    matcher = SymbolMatcher(db, exchange='BSE')
    matched, unmatched = matcher.match_records(records)
    print(f'  [match] {len(matched)} matched, {len(unmatched)} unmatched of {len(records)} parsed')

    # ── Step 4: Insert ──
    tracker.start('insert')
    try:
        count = upsert_equity_eod(db, matched)
        tracker.complete('insert', rows=count, metadata={
            'unmatched_count': len(unmatched),
        })
    except Exception as e:
        tracker.fail('insert', str(e))
        mark_day_status(db, trade_date, 'BSE', 'failed')
        return False

    # ── Step 5: Indicators (PostgreSQL RPC — fast) ──
    if not skip_indicators:
        tracker.start('indicators')
        try:
            result = db.rpc('compute_all_pending_indicators', {
                'p_table': 'km_equity_eod',
                'p_id_col': 'equity_id',
            })
            ind_count = sum(r.get('rows_updated', 0) for r in (result or []))
            tracker.complete('indicators', rows=ind_count)
        except Exception as e:
            tracker.fail('indicators', str(e))

    # ── Step 5b: Flow Intelligence ──
    if not skip_indicators:
        try:
            print(f'  [flow-intel] Computing flow intelligence...')
            result = db.rpc('compute_all_flow_intelligence', {
                'p_table':     'km_equity_eod',
                'p_id_col':    'equity_id',
                'p_from_date': str(trade_date),
                'p_to_date':   str(trade_date),
            })
            fi_count = sum(r.get('rows_updated', 0) for r in (result or []))
            print(f'  [flow-intel] Updated {fi_count} rows')
        except Exception as e:
            print(f'  [flow-intel] Skipped ({e})')

    # ── Mark complete ──
    mark_day_status(db, trade_date, 'BSE', 'completed')
    print(f'\n  ✓ BSE pipeline completed for {trade_date}')
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

    # ── Standalone compute / backfill modes ──
    parser.add_argument('--compute-returns', action='store_true',
                        help='Standalone: fill ret_5d/22d/66d in km_index_eod and exit')
    parser.add_argument('--backfill-weekly', action='store_true',
                        help='Standalone: backfill km_equity_weekly from --from date and exit')
    parser.add_argument('--backfill-monthly', action='store_true',
                        help='Standalone: backfill km_equity_monthly from --from date and exit')
    parser.add_argument('--no-indicators', action='store_true',
                        help='Skip indicator chain in backfill modes')

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

    # ── Standalone compute / backfill modes ──────────────────────────────────
    # These bypass the download pipeline and are safe to run at any time.

    if args.compute_returns:
        from_dt = date.fromisoformat(args.date_from) if args.date_from else None
        print(f'\n  Computing index returns{f" from {from_dt}" if from_dt else " (all NULL rows)"}...')
        n = compute_index_returns(db, from_date=from_dt, verbose=True)
        print(f'  Done — {n:,} rows updated.\n')
        return

    if args.backfill_weekly:
        if not args.date_from:
            print('  --backfill-weekly requires --from YYYY-MM-DD')
            sys.exit(1)
        from_dt = date.fromisoformat(args.date_from)
        print(f'\n  Backfilling km_equity_weekly from {from_dt}...')
        n = aggregate_weekly_bars(
            db, from_date=from_dt,
            run_indicators=not args.no_indicators,
            verbose=True,
        )
        print(f'  Done — {n:,} weekly rows upserted.\n')
        return

    if args.backfill_monthly:
        if not args.date_from:
            print('  --backfill-monthly requires --from YYYY-MM-DD')
            sys.exit(1)
        from_dt = date.fromisoformat(args.date_from)
        print(f'\n  Backfilling km_equity_monthly from {from_dt}...')
        n = aggregate_monthly_bars(
            db, from_date=from_dt,
            run_indicators=not args.no_indicators,
            verbose=True,
        )
        print(f'  Done — {n:,} monthly rows upserted.\n')
        return

    # Determine date(s) to process
    if args.date_from and args.date_to:
        # Backfill mode
        from_dt = date.fromisoformat(args.date_from)
        to_dt = date.fromisoformat(args.date_to)
        if args.force:
            # --force: iterate all calendar dates in range, skip weekends
            dates = []
            d = from_dt
            while d <= to_dt:
                if not is_weekend(d):
                    dates.append(d)
                d += timedelta(days=1)
        else:
            dates = get_missing_dates(db, from_dt, to_dt, args.exchange)
        if not dates:
            print(f'\n  No dates to process between {from_dt} and {to_dt}')
            return
        print(f'\n  Backfill: {len(dates)} date(s) from {from_dt} to {to_dt}{" (forced)" if args.force else ""}')
    elif args.date:
        target = date.fromisoformat(args.date)
        dates = [target]
    else:
        target = last_trading_day()
        dates = [target]

    # Process each date — collect detailed results
    results = []

    for d in dates:
        if args.force:
            mark_day_status(db, d, args.exchange, 'pending')

        if args.exchange in ('NSE', 'ALL'):
            ok = run_nse_pipeline(db, d, dry_run=args.dry_run,
                                  skip_indicators=args.skip_indicators)
            results.append({'date': d, 'exchange': 'NSE', 'ok': ok})

        if args.exchange in ('BSE', 'ALL'):
            ok = run_bse_pipeline(db, d, dry_run=args.dry_run,
                                  skip_indicators=args.skip_indicators)
            results.append({'date': d, 'exchange': 'BSE', 'ok': ok})

    # Detailed summary from km_pipeline_runs
    print(f'\n{"=" * 60}')
    print(f'  Pipeline Summary')
    print(f'{"=" * 60}')
    print(f'  Dates processed: {len(dates)}')

    for d in dates:
        steps = db.select('km_pipeline_runs', '*',
                          filters={'trade_date': str(d)}, order='id')
        if not steps:
            continue

        for exch in (['NSE', 'BSE'] if args.exchange == 'ALL' else [args.exchange]):
            exch_steps = [s for s in steps if s.get('exchange') == exch]
            if not exch_steps:
                continue

            completed = sum(1 for s in exch_steps if s['status'] == 'completed')
            failed = sum(1 for s in exch_steps if s['status'] == 'failed')
            skipped = sum(1 for s in exch_steps if s['status'] == 'skipped')
            total_rows = sum(s.get('rows_count', 0) for s in exch_steps)
            total_ms = sum(s.get('duration_ms', 0) or 0 for s in exch_steps)

            print(f'\n  {d} — {exch}:')
            for s in exch_steps:
                icon = {'completed': '✓', 'failed': '✗', 'skipped': '–',
                        'running': '…'}.get(s['status'], '?')
                rows = f"{s.get('rows_count', 0):,} rows" if s.get('rows_count') else ''
                dur = f"{s.get('duration_ms', 0)}ms" if s.get('duration_ms') else ''
                err = f" — {s.get('error_msg', '')}" if s.get('error_msg') else ''
                print(f'    {icon} {s["step"]:12} {rows:>12}  {dur:>8}{err}')

            print(f'    {"-" * 40}')
            print(f'    Steps: {completed} done, {failed} failed, {skipped} skipped')
            print(f'    Total: {total_rows:,} rows in {total_ms:,}ms')

    success_count = sum(1 for r in results if r['ok'])
    fail_count = sum(1 for r in results if not r['ok'])
    print(f'\n  Overall: {success_count} succeeded, {fail_count} failed')
    if args.dry_run:
        print(f'  (DRY RUN — no data was downloaded or inserted)')
    print()


if __name__ == '__main__':
    main()
