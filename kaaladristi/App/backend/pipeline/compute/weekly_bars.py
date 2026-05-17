"""
aggregate_weekly_bars — builds km_equity_weekly from km_equity_eod.

Each ISO week (Monday–Friday) is collapsed to a single OHLCV bar:
  open   = first trading day's open
  high   = MAX(high) across the week
  low    = MIN(low) across the week
  close  = last trading day's close
  volume = SUM(volume)
  value  = SUM(traded_value)
  deliv  = SUM / AVG per spec in aggregate_equity_weekly SQL RPC

After aggregation the full indicator chain runs once at the end
(not per-week) so that backfills of years of data stay fast.

Standalone backfill:
    python -m pipeline.compute.weekly_bars --from 2020-01-01
"""

from __future__ import annotations

import sys
import os
from datetime import date, timedelta

from ._indicator_chain import run_indicator_chain


def _iso_week_start(d: date) -> date:
    """ISO Monday of d's week."""
    return d - timedelta(days=d.weekday())


def aggregate_weekly_bars(
    db,
    from_date: date | None = None,
    run_indicators: bool = True,
    verbose: bool = False,
) -> int:
    """
    Aggregate km_equity_eod into km_equity_weekly for all ISO weeks
    from from_date's week through the current week.

    For initial backfill pass from_date far in the past:
        aggregate_weekly_bars(db, from_date=date(2020, 1, 1))

    For the regular Friday trigger in the pipeline pass today or None:
        aggregate_weekly_bars(db)   # processes the current week only

    The indicator chain (indicators → magic_rs → flow) runs ONCE at the
    end of all aggregation iterations — not per-week — so backfill stays
    efficient regardless of how many weeks are processed.

    Args:
        db:             Database client.
        from_date:      Process all ISO weeks from this date onwards.
                        None = current week only.
        run_indicators: Run indicator chain after aggregation.
        verbose:        Print per-week and chain progress.

    Returns:
        Total rows upserted into km_equity_weekly.
    """
    today = date.today()
    start_week = _iso_week_start(from_date if from_date is not None else today)

    total = 0
    week = start_week
    week_count = 0

    while week <= today:
        result = db.rpc('aggregate_equity_weekly', {'p_trade_date': str(week)})
        n = result[0].get('aggregate_equity_weekly', 0) if result else 0
        total += n
        week_count += 1
        if verbose and n:
            print(f'    week {week}: {n} rows upserted')
        week += timedelta(weeks=1)

    if verbose:
        print(f'  [weekly] {week_count} weeks processed, {total:,} total rows upserted')

    if total > 0 and run_indicators:
        if verbose:
            print('  [weekly] running indicator chain...')
        chain = run_indicator_chain(
            db,
            table='km_equity_weekly',
            id_col='equity_id',
            from_date=from_date,
            verbose=verbose,
        )
        if verbose:
            print(
                f'  [weekly] chain done — '
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

    parser = argparse.ArgumentParser(description='Aggregate weekly equity bars')
    parser.add_argument('--from', dest='from_date', type=str, required=True,
                        help='Start date (YYYY-MM-DD). Use 2020-01-01 for full backfill.')
    parser.add_argument('--no-indicators', action='store_true',
                        help='Skip indicator chain after aggregation')
    args = parser.parse_args()

    from_dt = date.fromisoformat(args.from_date)

    print('Connecting to DB...')
    _db = get_db()

    print(f'Aggregating weekly bars from {from_dt}...')
    n = aggregate_weekly_bars(
        _db,
        from_date=from_dt,
        run_indicators=not args.no_indicators,
        verbose=True,
    )
    print(f'Done — {n:,} weekly rows upserted.')
