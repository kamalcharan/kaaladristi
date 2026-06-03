"""
Indicator chain runner for derived timeframe tables (weekly / monthly).

All three steps use per-symbol Python loops for backfills (from_date
provided) so each commit is independent and the run is fully resumable
if the connection drops.

Per-symbol loop rationale
--------------------------
The bulk RPCs (compute_all_pending_indicators, compute_all_magic_rs,
compute_all_flow_intelligence) loop internally in PL/pgSQL over all
symbols. For 334 weekly bars × 1,380 symbols each bulk call runs
60-90 min as one connection — too long for psycopg2 on a remote VPS.

Instead, Python fetches pending symbol IDs and calls the per-symbol
batch function once per symbol. Each call commits immediately (~1-3 sec).
If the connection drops, already-committed symbols are skipped on restart.

For the daily pipeline (from_date=None, only a handful of new rows),
the bulk RPCs are used as-is — fast and fine.

Resumability:
  indicators — skips symbols where indicators_computed_at IS NOT NULL
  magic_rs   — reprocesses all symbols (idempotent, no resume marker)
  flow       — reprocesses all symbols (idempotent, no resume marker)

Date scoping (migration 039):
  compute_all_magic_rs          — p_from_date required.
  compute_all_flow_intelligence — both dates or neither.
"""

from __future__ import annotations

import sys
import os
from datetime import date, timedelta

import pandas as pd
import numpy as np


def _compute_rolling_range_for_table(
    db,
    table: str,
    id_col: str,
    from_date: date | None,
    w52_window: int,
    verbose: bool = False,
) -> int:
    """
    Compute w52_high, w52_low, lifetime_high for weekly or monthly tables.

    w52_window: number of bars in one year
      - weekly:  52
      - monthly: 12

    Loads full history per symbol (needed for lifetime_high expanding max),
    computes via pandas, batch-upserts only rows >= from_date.
    Returns total rows updated.
    """
    import psycopg2
    import psycopg2.extras

    conn = db._conn()
    total = 0
    batch_size = 500

    try:
        # Get all equity_ids that have data in this table
        with conn.cursor() as cur:
            cur.execute(f'SELECT DISTINCT {id_col} FROM {table} ORDER BY {id_col}')
            equity_ids = [r[0] for r in cur.fetchall()]

        if verbose:
            print(f'    [rolling_range] {table}: {len(equity_ids)} symbols')

        pending_batch = []

        for i, eid in enumerate(equity_ids):
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    f'SELECT id, trade_date, high, low FROM {table} '
                    f'WHERE {id_col} = %s ORDER BY trade_date ASC',
                    [eid],
                )
                rows = cur.fetchall()

            if not rows:
                continue

            df = pd.DataFrame([dict(r) for r in rows])
            df['high'] = pd.to_numeric(df['high'], errors='coerce')
            df['low']  = pd.to_numeric(df['low'],  errors='coerce')

            df['w52_high']      = df['high'].rolling(window=w52_window, min_periods=1).max()
            df['w52_low']       = df['low'].rolling(window=w52_window,  min_periods=1).min()
            df['lifetime_high'] = df['high'].expanding(min_periods=1).max()

            # Only update rows >= from_date (or all if from_date is None)
            if from_date is not None:
                df = df[df['trade_date'] >= pd.Timestamp(from_date)]

            for _, row in df.iterrows():
                w52h = round(float(row['w52_high']),      4) if pd.notna(row['w52_high'])      else None
                w52l = round(float(row['w52_low']),       4) if pd.notna(row['w52_low'])       else None
                lth  = round(float(row['lifetime_high']), 4) if pd.notna(row['lifetime_high']) else None
                if w52h is None and w52l is None and lth is None:
                    continue
                pending_batch.append((w52h, w52l, lth, int(row['id'])))

            if len(pending_batch) >= batch_size:
                sql = f"""
                    UPDATE {table} AS t
                    SET w52_high = v.w52h, w52_low = v.w52l, lifetime_high = v.lth
                    FROM (VALUES %s) AS v(w52h, w52l, lth, id)
                    WHERE t.id = v.id
                """
                with conn.cursor() as cur:
                    psycopg2.extras.execute_values(cur, sql, pending_batch, page_size=batch_size)
                conn.commit()
                total += len(pending_batch)
                pending_batch = []

            if verbose and (i + 1) % 200 == 0:
                print(f'      {i + 1}/{len(equity_ids)} symbols, {total:,} rows so far')

        # Flush remainder
        if pending_batch:
            sql = f"""
                UPDATE {table} AS t
                SET w52_high = v.w52h, w52_low = v.w52l, lifetime_high = v.lth
                FROM (VALUES %s) AS v(w52h, w52l, lth, id)
                WHERE t.id = v.id
            """
            with conn.cursor() as cur:
                psycopg2.extras.execute_values(cur, sql, pending_batch, page_size=batch_size)
            conn.commit()
            total += len(pending_batch)

    finally:
        conn.close()

    if verbose:
        print(f'    [rolling_range] {table}: {total:,} rows updated')

    return total


def _all_symbol_ids(db, table: str, id_col: str) -> list[int]:
    rows = db.execute(
        f'SELECT DISTINCT {id_col} AS sid FROM {table} ORDER BY {id_col}'
    )
    return [r['sid'] for r in (rows or [])]


def _nifty500_benchmark(db) -> int | None:
    rows = db.execute(
        "SELECT id FROM km_index_symbols WHERE name = 'NIFTY 500' LIMIT 1"
    )
    return rows[0]['id'] if rows else None


def run_indicator_chain(
    db,
    table: str,
    id_col: str,
    from_date: date | None = None,
    verbose: bool = False,
) -> dict:
    """
    Run the full indicator chain on a derived timeframe table.

    For backfills (from_date provided): all three steps loop per-symbol
    so each commit is independent and the run is fully resumable.

    For daily use (from_date=None): bulk RPCs handle the small number of
    pending rows quickly.

    Returns dict with row counts: {'indicators': n, 'magic_rs': n, 'flow': n}
    """
    today = date.today()
    results = {'indicators': 0, 'magic_rs': 0, 'flow': 0}

    # ── 1. Indicators ─────────────────────────────────────────
    if from_date is not None:
        # Per-symbol loop: resumable — skips symbols already committed.
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

    if from_date is not None:
        # Per-symbol loop for backfill.
        benchmark_id = _nifty500_benchmark(db)
        is_index_table = (table == 'km_index_eod')
        bench_table    = None if is_index_table else 'km_index_eod'
        bench_id_col   = None if is_index_table else 'index_id'

        sym_ids = _all_symbol_ids(db, table, id_col)
        if verbose:
            print(f'    [chain] magic_rs (from {mrs_from}) → {len(sym_ids)} symbols in {table}')

        for i, sym_id in enumerate(sym_ids):
            result = db.rpc('compute_magic_rs_batch', {
                'p_table':        table,
                'p_id_col':       id_col,
                'p_symbol_id':    sym_id,
                'p_benchmark_id': benchmark_id,
                'p_from_date':    str(mrs_from),
                'p_bench_table':  bench_table,
                'p_bench_id_col': bench_id_col,
            })
            n = result[0].get('compute_magic_rs_batch', 0) if result else 0
            results['magic_rs'] += n

            if verbose and (i + 1) % 100 == 0:
                done = i + 1
                left = len(sym_ids) - done
                print(f'      {done}/{len(sym_ids)} symbols  '
                      f'({left} remaining, {results["magic_rs"]:,} rows so far)')

        if verbose:
            print(f'      → {results["magic_rs"]:,} rows updated '
                  f'({len(sym_ids)} symbols)')
    else:
        # Daily pipeline: bulk RPC.
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
    if from_date is not None:
        # Per-symbol loop for backfill.
        sym_ids = _all_symbol_ids(db, table, id_col)
        if verbose:
            print(f'    [chain] flow_intelligence → {len(sym_ids)} symbols in {table}')

        for i, sym_id in enumerate(sym_ids):
            result = db.rpc('compute_flow_intelligence', {
                'p_table':     table,
                'p_id_col':    id_col,
                'p_symbol_id': sym_id,
                'p_from_date': str(from_date),
            })
            n = result[0].get('compute_flow_intelligence', 0) if result else 0
            results['flow'] += n

            if verbose and (i + 1) % 100 == 0:
                done = i + 1
                left = len(sym_ids) - done
                print(f'      {done}/{len(sym_ids)} symbols  '
                      f'({left} remaining, {results["flow"]:,} rows so far)')

        if verbose:
            print(f'      → {results["flow"]:,} rows updated '
                  f'({len(sym_ids)} symbols)')
    else:
        # Daily pipeline: bulk RPC.
        if verbose:
            print(f'    [chain] flow_intelligence → {table}')
        flow_result = db.rpc('compute_all_flow_intelligence', {
            'p_table':  table,
            'p_id_col': id_col,
        })
        results['flow'] = sum(r.get('rows_updated', 0) for r in (flow_result or []))
        if verbose:
            print(f'      → {results["flow"]:,} rows updated')

    # ── 4. Rolling range (w52_high, w52_low, lifetime_high) ───────────────
    # weekly = 52 bars per year, monthly = 12 bars per year
    w52_window = 12 if 'monthly' in table else 52
    try:
        range_rows = _compute_rolling_range_for_table(
            db, table, id_col, from_date, w52_window, verbose=verbose,
        )
        results['rolling_range'] = range_rows
    except Exception as e:
        if verbose:
            print(f'    [chain] rolling_range error: {e}')
        results['rolling_range'] = 0

    return results
