"""
aggregate_monthly_bars — builds km_equity_monthly from km_equity_eod.

Each calendar month is collapsed to a single OHLCV bar:
  open   = first trading day's open
  high   = MAX(high) across the month
  low    = MIN(low) across the month
  close  = last trading day's close
  volume = SUM(volume)
  value  = SUM(traded_value)
  deliv  = SUM / AVG per spec in aggregate_equity_monthly SQL RPC

After aggregation the full indicator chain runs once at the end.

Standalone backfill:
    python -m pipeline.compute.monthly_bars --from 2020-01-01
"""

from __future__ import annotations

import sys
import os
import calendar as _cal
from datetime import date, timedelta

from ._indicator_chain import run_indicator_chain


def _month_starts(from_date: date, to_date: date) -> list[date]:
    """
    Return the first day of each calendar month between from_date and to_date
    (inclusive of the month containing each boundary).
    """
    months = []
    y, m = from_date.year, from_date.month
    end_y, end_m = to_date.year, to_date.month
    while (y, m) <= (end_y, end_m):
        months.append(date(y, m, 1))
        m += 1
        if m > 12:
            m = 1
            y += 1
    return months


def aggregate_monthly_bars(
    db,
    from_date: date | None = None,
    run_indicators: bool = True,
    verbose: bool = False,
) -> int:
    """
    Aggregate km_equity_eod into km_equity_monthly for all calendar months
    from from_date's month through the current month.

    For initial backfill pass from_date far in the past:
        aggregate_monthly_bars(db, from_date=date(2020, 1, 1))

    For the regular month-end trigger in the pipeline pass today or None:
        aggregate_monthly_bars(db)   # processes the current month only

    The indicator chain runs ONCE at the end of all iterations.

    Args:
        db:             Database client.
        from_date:      Process all calendar months from this date onwards.
                        None = current month only.
        run_indicators: Run indicator chain after aggregation.
        verbose:        Print per-month and chain progress.

    Returns:
        Total rows upserted into km_equity_monthly.
    """
    today = date.today()
    start = date((from_date or today).year, (from_date or today).month, 1)

    months = _month_starts(start, today)
    total = 0

    for month_start in months:
        result = db.rpc('aggregate_equity_monthly', {'p_trade_date': str(month_start)})
        n = result[0].get('aggregate_equity_monthly', 0) if result else 0
        total += n
        if verbose and n:
            print(f'    month {month_start.strftime("%Y-%m")}: {n} rows upserted')

    if verbose:
        print(f'  [monthly] {len(months)} months processed, {total:,} total rows upserted')

    if total > 0 and run_indicators:
        if verbose:
            print('  [monthly] running indicator chain...')
        chain = run_indicator_chain(
            db,
            table='km_equity_monthly',
            id_col='equity_id',
            from_date=from_date,
            verbose=verbose,
        )
        if verbose:
            print(
                f'  [monthly] chain done — '
                f'indicators={chain["indicators"]}, '
                f'magic_rs={chain["magic_rs"]}, '
                f'flow={chain["flow"]}'
            )

    return total


# ── Standalone entry point ────────────────────────────────────────────────────

if __name__ == '__main__':
    import argparse

    script_dir = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, os.path.join(script_dir, '..', '..'))

    from lib.db_client import get_db

    parser = argparse.ArgumentParser(description='Aggregate monthly equity bars')
    parser.add_argument('--from', dest='from_date', type=str, required=True,
                        help='Start date (YYYY-MM-DD). Use 2020-01-01 for full backfill.')
    parser.add_argument('--no-indicators', action='store_true',
                        help='Skip indicator chain after aggregation')
    args = parser.parse_args()

    from_dt = date.fromisoformat(args.from_date)

    print('Connecting to DB...')
    _db = get_db()

    print(f'Aggregating monthly bars from {from_dt}...')
    n = aggregate_monthly_bars(
        _db,
        from_date=from_dt,
        run_indicators=not args.no_indicators,
        verbose=True,
    )
    print(f'Done — {n:,} monthly rows upserted.')
