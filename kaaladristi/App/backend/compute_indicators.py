"""
Kāla-Drishti Technical Indicators — CLI Entry Point
=====================================================

Computes all technical indicators (SMA, RSI, MFI, ATR, SuperTrend, OBV,
MagicRS, Sniper Dragon, RSS, Pivots, Chartink, Dots, Swing) and writes
results back to km_index_eod / km_equity_eod tables.

Usage
-----
  # Incremental: compute only new/uncomputed rows
  python compute_indicators.py

  # Full backfill for all indices
  python compute_indicators.py --mode index --full

  # Full backfill for all equities
  python compute_indicators.py --mode equity --full

  # Both indices and equities (default)
  python compute_indicators.py --mode both --full

  # Single symbol
  python compute_indicators.py --mode index --symbol "NIFTY 50" --full

  # From a specific date
  python compute_indicators.py --mode equity --from 2020-01-01

  # Custom benchmark for MagicRS
  python compute_indicators.py --benchmark "NIFTY 500"
"""

import os
import sys
import argparse

# Add backend dir to path
script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, script_dir)

from lib.db_client import get_db
from indicators.compute_engine import IndicatorEngine


def main():
    parser = argparse.ArgumentParser(
        description='Compute technical indicators for KaalaDristi EOD data'
    )
    parser.add_argument('--mode', choices=['index', 'equity', 'both'],
                        default='both',
                        help='Asset type to compute (default: both)')
    parser.add_argument('--full', action='store_true',
                        help='Recompute entire history (default: incremental)')
    parser.add_argument('--symbol', type=str, default=None,
                        help='Single symbol name to compute')
    parser.add_argument('--from', dest='date_from', type=str, default=None,
                        help='Start date for backfill (YYYY-MM-DD)')
    parser.add_argument('--benchmark', type=str, default='NIFTY 500',
                        help='Benchmark symbol for MagicRS (default: NIFTY 500)')

    args = parser.parse_args()

    print('=' * 60)
    print('  KĀLA-DRISHTI TECHNICAL INDICATORS ENGINE')
    print('=' * 60)
    print(f'  Mode:      {args.mode}')
    print(f'  Full:      {args.full}')
    print(f'  Symbol:    {args.symbol or "(all)"}')
    print(f'  From:      {args.date_from or "(auto)"}')
    print(f'  Benchmark: {args.benchmark}')
    print()

    # Connect to database
    db = get_db()

    # Run engine
    engine = IndicatorEngine(db)
    total = engine.run(
        mode=args.mode,
        full=args.full,
        symbol_name=args.symbol,
        date_from=args.date_from,
        benchmark_symbol=args.benchmark,
    )

    if total == 0:
        print('\n  No rows computed. Check that EOD data exists.')
    else:
        print(f'\n  Successfully computed {total} indicator rows.')


if __name__ == '__main__':
    main()
