"""
Indicator chain runner for derived timeframe tables (weekly / monthly).

Calls the three bulk RPCs in order:
  1. compute_indicators_batch (per-symbol loop from Python for backfills)
  2. compute_all_magic_rs
  3. compute_all_flow_intelligence

Per-symbol loop rationale
--------------------------
compute_all_pending_indicators runs 1,380 symbols in a single PL/pgSQL
call. For 334 weekly bars per symbol that takes 60-90 min as one
connection — too long for psycopg2 on a remote VPS. Worse, re-aggregation
always resets indicators_computed_at = NULL, so a dropped connection means
restarting from zero.

Instead, we fetch pending equity_ids in Python and call
compute_indicators_batch once per symbol. Each call commits immediately
(~1-3 sec). If the connection drops, the next run skips already-committed
symbols and resumes from where it stopped.

For the daily pipeline (from_date=None, only a handful of new rows),
compute_all_pending_indicators is used as-is — fast and fine.

Date scoping (migration 039):
  compute_all_magic_rs        — p_from_date required.
  compute_all_flow_intelligence — both dates or neither.
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

    For backfills (from_date provided): indicators are processed per-symbol
    so each commit is independent and the run is fully resumable.

    For daily use (from_date=None): bulk RPC handles the small number of
    pending rows quickly.

    Returns dict with row counts: {'indicators': n, 'magic_rs': n, 'flow': n}
    """
    today = date.today()
    results = {'indicators': 0, 'magic_rs': 0, 'flow': 0}

    # ── 1. Indicators ─────────────────────────────────────────
    if from_date is not None:
        # Per-symbol loop: each commit is independent — resumable on drop.
        pending = db.execute(
            f'SELECT DISTINCT {id_col} AS sid FROM {table} '
            f'WHERE indicators_computed_at IS NULL ORDER BY {id_col}'
        )
        symbol_ids = [r['sid'] for r in (pending or [])]

        if verbose:
            print(f'    [chain] indicators → {len(symbol_ids)} symbols pending in {table}')

        for i, sym_id in enumerate(symbol_ids):
            result = db.rpc('compute_indicators_batch', {
                'p_table':      table,
                'p_id_col':     id_col,
                'p_symbol_id':  sym_id,
                'p_from_date':  str(from_date),
            })
            n = result[0].get('compute_indicators_batch', 0) if result else 0
            results['indicators'] += n

            if verbose and (i + 1) % 100 == 0:
                done = i + 1
                left = len(symbol_ids) - done
                print(f'      {done}/{len(symbol_ids)} symbols  '
                      f'({left} remaining, {results["indicators"]:,} rows so far)')

        if verbose:
            print(f'      → {results["indicators"]:,} rows updated '
                  f'({len(symbol_ids)} symbols)')
    else:
        # Daily pipeline: bulk RPC (only a handful of pending rows).
        if verbose:
            print(f'    [chain] indicators (last 90 days) → {table}')
        ind_result = db.rpc('compute_all_pending_indicators', {
            'p_table':  table,
            'p_id_col': id_col,
        })
        results['indicators'] = sum(
            r.get('rows_updated', 0) for r in (ind_result or [])
        )

    # ── 2. MagicRS ────────────────────────────────────────────
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
    if verbose:
        print(f'      → {results["magic_rs"]:,} rows updated')

    # ── 3. Flow intelligence ──────────────────────────────────
    if verbose:
        print(f'    [chain] flow_intelligence → {table}')

    flow_kwargs: dict = {'p_table': table, 'p_id_col': id_col}
    if from_date is not None:
        flow_kwargs['p_from_date'] = str(from_date)
        flow_kwargs['p_to_date']   = str(today)

    flow_result = db.rpc('compute_all_flow_intelligence', flow_kwargs)
    results['flow'] = sum(r.get('rows_updated', 0) for r in (flow_result or []))
    if verbose:
        print(f'      → {results["flow"]:,} rows updated')

    return results
