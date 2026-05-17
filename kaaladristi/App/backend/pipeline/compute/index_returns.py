"""
compute_index_returns — fills ret_5d / ret_22d / ret_66d in km_index_eod.

Delegates to the SQL RPC compute_all_index_returns which uses LAG window
functions for efficiency (single pass per index, no Python row iteration).

Standalone backfill:
    python -m pipeline.compute.index_returns --from 2020-01-01
"""

from __future__ import annotations

import sys
import os
from datetime import date


def compute_index_returns(db, from_date: date | None = None, verbose: bool = False) -> int:
    """
    Fills ret_5d / ret_22d / ret_66d in km_index_eod for all indices.

    Args:
        db:        Database client (lib.db_client).
        from_date: Only update rows on/after this date.
                   Pass None to update all rows where ret_5d IS NULL.
        verbose:   Print per-index row counts.

    Returns:
        Total rows updated across all indices.
    """
    kwargs: dict = {}
    if from_date is not None:
        kwargs['p_from_date'] = str(from_date)

    result = db.rpc('compute_all_index_returns', kwargs)
    total = sum(r.get('rows_updated', 0) for r in (result or []))

    if verbose:
        for r in (result or []):
            idx = r.get('index_id', '?')
            cnt = r.get('rows_updated', 0)
            if cnt:
                print(f'    index {idx}: {cnt} rows updated')

    return total


# ── Standalone entry point ────────────────────────────────────────────────────

if __name__ == '__main__':
    import argparse

    script_dir = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, os.path.join(script_dir, '..', '..'))

    from lib.db_client import get_db

    parser = argparse.ArgumentParser(description='Compute index returns (ret_5d/22d/66d)')
    parser.add_argument('--from', dest='from_date', type=str, default=None,
                        help='Start date (YYYY-MM-DD). Omit to fill all NULL rows.')
    args = parser.parse_args()

    from_dt = date.fromisoformat(args.from_date) if args.from_date else None

    print('Connecting to DB...')
    _db = get_db()

    print(f'Computing index returns{f" from {from_dt}" if from_dt else " (all NULL rows)"}...')
    n = compute_index_returns(_db, from_date=from_dt, verbose=True)
    print(f'Done — {n:,} rows updated.')
