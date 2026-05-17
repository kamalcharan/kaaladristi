"""
Shared indicator chain runner for derived timeframe tables (weekly / monthly).

The standard compute_all_magic_rs RPC (migration 038) cannot do cross-table
benchmark lookups — it assumes the benchmark lives in the same table as the
symbol. For weekly/monthly tables the benchmark (NIFTY 500) is in km_index_eod.

This module provides _run_indicator_chain() which:
  1. Calls compute_all_pending_indicators  (table-agnostic, works fine)
  2. Iterates per-symbol magic_rs via compute_magic_rs_batch with explicit
     bench_table='km_index_eod', bench_id_col='index_id'
  3. Calls compute_all_flow_intelligence   (table-agnostic, works fine)
"""

from __future__ import annotations

from datetime import date


def _get_nifty500_id(db) -> int | None:
    """Return the index_id of NIFTY 500 from km_index_symbols."""
    rows = db.select(
        'km_index_symbols', 'id',
        filters={'name': 'NIFTY 500'},
        limit=1,
    )
    return rows[0]['id'] if rows else None


def _pending_symbol_ids(db, table: str, id_col: str, from_date: date | None) -> list[int]:
    """Return distinct symbol IDs that still have magic_rs_zone IS NULL."""
    sql = f'SELECT DISTINCT {id_col} FROM {table} WHERE magic_rs_zone IS NULL'
    params: list = []
    if from_date:
        sql += ' AND trade_date >= %s'
        params.append(from_date)
    rows = db.execute(sql, params or None)
    return [r[id_col] for r in (rows or []) if r.get(id_col) is not None]


def run_indicator_chain(
    db,
    table: str,
    id_col: str,
    from_date: date | None = None,
    verbose: bool = False,
) -> dict:
    """
    Run the full indicator chain on a derived timeframe table.

    Sequence:
      1. compute_all_pending_indicators — SMAs, RSI, ATR, OBV, pivot, sniper, RSS, EMA
      2. compute_magic_rs_batch (per symbol) — cross-table benchmark from km_index_eod
      3. compute_all_flow_intelligence — flow_type, vacuum_flag, accum_distrib

    Args:
        db:        Database client.
        table:     Target table, e.g. 'km_equity_weekly'.
        id_col:    Symbol ID column, e.g. 'equity_id'.
        from_date: Pass to magic_rs_batch to limit history window.
                   None = process all pending rows.
        verbose:   Print progress.

    Returns:
        Dict with counts: {'indicators': n, 'magic_rs': n, 'flow': n}
    """
    results = {'indicators': 0, 'magic_rs': 0, 'flow': 0}

    # ── 1. Standard indicators ────────────────────────────────
    if verbose:
        print(f'    [chain] indicators → {table}')
    ind_result = db.rpc('compute_all_pending_indicators', {
        'p_table': table, 'p_id_col': id_col,
    })
    results['indicators'] = sum(r.get('rows_updated', 0) for r in (ind_result or []))

    # ── 2. MagicRS (cross-table: symbol in table, NIFTY 500 in km_index_eod) ──
    nifty500_id = _get_nifty500_id(db)
    if nifty500_id is None:
        if verbose:
            print(f'    [chain] magic_rs skipped — NIFTY 500 not found in km_index_symbols')
    else:
        symbol_ids = _pending_symbol_ids(db, table, id_col, from_date)
        if verbose:
            print(f'    [chain] magic_rs → {len(symbol_ids)} symbols pending in {table}')
        for sym_id in symbol_ids:
            kwargs = {
                'p_table':        table,
                'p_id_col':       id_col,
                'p_symbol_id':    sym_id,
                'p_benchmark_id': nifty500_id,
                'p_bench_table':  'km_index_eod',
                'p_bench_id_col': 'index_id',
            }
            if from_date:
                kwargs['p_from_date'] = str(from_date)
            r = db.rpc('compute_magic_rs_batch', kwargs)
            # scalar RPC returns [{'compute_magic_rs_batch': n}]
            n = r[0].get('compute_magic_rs_batch', 0) if r else 0
            results['magic_rs'] += n

    # ── 3. Flow intelligence ──────────────────────────────────
    if verbose:
        print(f'    [chain] flow_intelligence → {table}')
    flow_result = db.rpc('compute_all_flow_intelligence', {
        'p_table': table, 'p_id_col': id_col,
    })
    results['flow'] = sum(r.get('rows_updated', 0) for r in (flow_result or []))

    return results
