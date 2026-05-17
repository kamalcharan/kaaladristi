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

Chunking:
  For backfills spanning years, compute_all_pending_indicators is split into
  annual chunks so each DB call stays under ~15 minutes. magic_rs and
  flow_intelligence run once at the end (they have their own NULL filtering).
"""

from __future__ import annotations

from datetime import date, timedelta


def _year_chunks(from_date: date, to_date: date) -> list[tuple[date, date]]:
    """Split [from_date, to_date] into calendar-year slices."""
    chunks = []
    y = from_date.year
    while True:
        chunk_start = max(from_date, date(y, 1, 1))
        chunk_end   = min(to_date,   date(y, 12, 31))
        if chunk_start > to_date:
            break
        chunks.append((chunk_start, chunk_end))
        y += 1
        if chunk_start > chunk_end:
            break
    return chunks


def run_indicator_chain(
    db,
    table: str,
    id_col: str,
    from_date: date | None = None,
    verbose: bool = False,
) -> dict:
    """
    Run the full indicator chain on a derived timeframe table.

    For backfills spanning multiple years, compute_all_pending_indicators
    is chunked by calendar year so each call stays under ~15 minutes and
    progress is visible between chunks.

    Args:
        db:        Database client.
        table:     Target table, e.g. 'km_equity_weekly'.
        id_col:    Symbol ID column, e.g. 'equity_id'.
        from_date: Earliest date to process. None = last 90 days.
        verbose:   Print progress.

    Returns:
        Dict with row counts: {'indicators': n, 'magic_rs': n, 'flow': n}
    """
    today = date.today()
    results = {'indicators': 0, 'magic_rs': 0, 'flow': 0}

    # ── 1. Standard indicators — chunked by year ──────────────
    if from_date is not None:
        chunks = _year_chunks(from_date, today)
        for chunk_start, chunk_end in chunks:
            if verbose:
                print(f'    [chain] indicators {chunk_start} → {chunk_end} → {table}')
            ind_result = db.rpc('compute_all_pending_indicators', {
                'p_table':      table,
                'p_id_col':     id_col,
                'p_from_date':  str(chunk_start),
                'p_to_date':    str(chunk_end),
            })
            n = sum(r.get('rows_updated', 0) for r in (ind_result or []))
            results['indicators'] += n
            if verbose:
                print(f'      → {n:,} rows updated')
    else:
        if verbose:
            print(f'    [chain] indicators (last 90 days) → {table}')
        ind_result = db.rpc('compute_all_pending_indicators', {
            'p_table':  table,
            'p_id_col': id_col,
        })
        results['indicators'] = sum(r.get('rows_updated', 0) for r in (ind_result or []))

    # ── 2. MagicRS ────────────────────────────────────────────
    # p_from_date is required; auto-detects NIFTY 500 benchmark
    # and routes cross-table lookup (migration 039).
    mrs_from = from_date if from_date is not None else (today - timedelta(days=90))
    if verbose:
        print(f'    [chain] magic_rs (from {mrs_from}) → {table}')

    mrs_result = db.rpc('compute_all_magic_rs', {
        'p_table':        table,
        'p_id_col':       id_col,
        'p_benchmark_id': None,
        'p_from_date':    str(mrs_from),
    })
    results['magic_rs'] = sum(r.get('rows_updated', 0) for r in (mrs_result or []))

    # ── 3. Flow intelligence ──────────────────────────────────
    if verbose:
        print(f'    [chain] flow_intelligence → {table}')

    flow_kwargs: dict = {'p_table': table, 'p_id_col': id_col}
    if from_date is not None:
        flow_kwargs['p_from_date'] = str(from_date)
        flow_kwargs['p_to_date']   = str(today)

    flow_result = db.rpc('compute_all_flow_intelligence', flow_kwargs)
    results['flow'] = sum(r.get('rows_updated', 0) for r in (flow_result or []))

    return results

