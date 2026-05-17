"""
Indicator chain runner for derived timeframe tables (weekly / monthly).

Calls the three bulk RPCs in order:
  1. compute_all_pending_indicators  — SMAs, RSI, ATR, OBV, pivot, sniper, RSS, EMA
  2. compute_all_magic_rs            — magic_rs / magic_ma / magic_rs_zone
  3. compute_all_flow_intelligence   — flow_type, vacuum_flag, accum_distrib

All three RPCs are table-parameterised and handle cross-table benchmark
routing internally (migration 039 restored NIFTY 500 lookup in km_index_eod
for non-index tables). No per-symbol Python loops needed.

Date scoping (migration 039):
  compute_all_pending_indicators  — defaults to 90-day window when no dates
                                    provided; pass both for full backfill.
  compute_all_flow_intelligence   — pass both or neither.
  compute_all_magic_rs            — p_from_date required (migration 038).
"""

from __future__ import annotations

from datetime import date, timedelta


def run_indicator_chain(
    db,
    table: str,
    id_col: str,
    from_date: date | None = None,
    verbose: bool = False,
) -> dict:
    """
    Run the full indicator chain on a derived timeframe table.

    Args:
        db:        Database client.
        table:     Target table, e.g. 'km_equity_weekly'.
        id_col:    Symbol ID column, e.g. 'equity_id'.
        from_date: Earliest date to process. Pass the backfill start date
                   (e.g. date(2020, 1, 1)) for full coverage; None defaults
                   to the last 90 days.
        verbose:   Print progress.

    Returns:
        Dict with row counts: {'indicators': n, 'magic_rs': n, 'flow': n}
    """
    today = date.today()
    results = {'indicators': 0, 'magic_rs': 0, 'flow': 0}

    # ── 1. Standard indicators ────────────────────────────────
    if verbose:
        window = f'{from_date} → {today}' if from_date else 'last 90 days'
        print(f'    [chain] indicators ({window}) → {table}')

    ind_kwargs: dict = {'p_table': table, 'p_id_col': id_col}
    if from_date is not None:
        ind_kwargs['p_from_date'] = str(from_date)
        ind_kwargs['p_to_date']   = str(today)

    ind_result = db.rpc('compute_all_pending_indicators', ind_kwargs)
    results['indicators'] = sum(r.get('rows_updated', 0) for r in (ind_result or []))

    # ── 2. MagicRS ────────────────────────────────────────────
    # Migration 039 restored cross-table routing: for non-index tables
    # compute_all_magic_rs automatically uses km_index_eod for NIFTY 500.
    # p_from_date is required (migration 038 removed the NULL fallback).
    mrs_from = from_date if from_date is not None else (today - timedelta(days=90))
    if verbose:
        print(f'    [chain] magic_rs (from {mrs_from}) → {table}')

    mrs_result = db.rpc('compute_all_magic_rs', {
        'p_table':      table,
        'p_id_col':     id_col,
        'p_from_date':  str(mrs_from),
    })
    results['magic_rs'] = sum(r.get('rows_updated', 0) for r in (mrs_result or []))

    # ── 3. Flow intelligence ──────────────────────────────────
    # Requires both dates or neither (migration 039).
    if verbose:
        print(f'    [chain] flow_intelligence → {table}')

    flow_kwargs: dict = {'p_table': table, 'p_id_col': id_col}
    if from_date is not None:
        flow_kwargs['p_from_date'] = str(from_date)
        flow_kwargs['p_to_date']   = str(today)

    flow_result = db.rpc('compute_all_flow_intelligence', flow_kwargs)
    results['flow'] = sum(r.get('rows_updated', 0) for r in (flow_result or []))

    return results
