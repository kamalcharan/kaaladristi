"""Per-dimension compute handlers for pipeline v2.

Every handler follows the same contract:

    def handle_<dim>(conn, trade_date, force, exchange, on_progress) -> HandlerResult

  * `conn` is a psycopg2 connection; handlers commit explicitly.
  * `on_progress(text, pct)` updates the km_jobs row in real time.
  * Returns a HandlerResult carrying before/after fill-rate, affected
    row count, and terminal status ('completed' | 'partial' | 'failed').

Principles:
  * Commit every write path. Never leave a transaction open on the
    pooled connection (v1's silent-rollback bug is gone).
  * Never trust RPC return values. Ground-truth the outcome via a
    fill-rate query post-commit.
  * force=True erases (NULL or DELETE) the dimension's output before
    calling the compute RPC, so already-stamped rows get recomputed.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Callable, Optional

import psycopg2
import psycopg2.extras

from .health import (
    DIMENSION_HEALTH,
    DOWNLOAD_DIMENSIONS,
    fill_rate,
    ok_threshold_for,
)


# Download dims are now fixable too (handle_{index,nse,bse}_eod_download
# below). Kept as a frozenset so callers can check cheaply; the API layer
# uses it to decide whether a job is runnable at all.
FIXABLE_DIMENSIONS = frozenset({
    'index_eod_download', 'nse_eod_download', 'bse_eod_download',
    'index_indicators', 'nse_equity_indicators', 'bse_equity_indicators',
    'index_flow', 'nse_flow', 'bse_flow',
    'index_magic_rs', 'nse_magic_rs', 'bse_magic_rs', 'rs_percentile',
    'supertrend', 'rolling_metrics', 'd365', 'stage_classification', 'vani_flags',
    'index_returns', 'industry_composites', 'market_breadth', 'breadth_roc',
    'scan_refresh',
})


ProgressFn = Callable[[str, int], None]


@dataclass
class HandlerResult:
    status: str                        # 'completed' | 'partial' | 'failed'
    fill_rate_before: float
    fill_rate_after: float
    rows_affected: int
    error_msg: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            'status': self.status,
            'fill_rate_before': self.fill_rate_before,
            'fill_rate_after': self.fill_rate_after,
            'rows_affected': self.rows_affected,
            'error_msg': self.error_msg,
        }


# ── Helpers ───────────────────────────────────────────────────────────────

def _exchange_for_dim(dim: str) -> Optional[str]:
    if dim.startswith('nse_'):
        return 'NSE'
    if dim.startswith('bse_'):
        return 'BSE'
    return None


def _classify(before: float, after: float, ok_threshold_pct: float | None) -> str:
    """Decide terminal status.

    ok_threshold_pct is the healthy threshold as a percent (e.g. 95.0).
    None => row-presence dimension, treat >0 as healthy.
    """
    if ok_threshold_pct is None:
        return 'completed' if after > 0 else 'failed'
    if after >= ok_threshold_pct:
        return 'completed'
    if after > before:
        return 'partial'
    return 'failed' if after == 0 else 'partial'


def _nullify_columns(conn, dim: str, trade_date: date, exchange: Optional[str]) -> int:
    """UPDATE ... = NULL for the dimension's output columns on the target
    date. Used by force paths. Returns rows affected.
    """
    meta = DIMENSION_HEALTH[dim]
    table, _id_col, cols, _ok = meta

    # Magic RS has four derived columns beyond magic_rs_zone — zero them all.
    if dim.endswith('magic_rs'):
        cols = ['magic_rs', 'magic_rs_sma144', 'magic_ma', 'magic_rs_zone']
    # Flow has four as well.
    elif dim.endswith('flow'):
        cols = ['flow_type', 'vacuum_flag', 'accum_distrib', 'volume_divergence_flag']
    # Indicators: zero the stamp. Fill columns stay — but the IS-NULL stamp
    # filter on the RPC will recompute them row-by-row.
    elif 'indicators' in dim:
        cols = ['indicators_computed_at']

    set_clause = ', '.join(f'{c} = NULL' for c in cols)
    with conn.cursor() as cur:
        if table == 'km_equity_eod' and exchange:
            cur.execute(
                f"UPDATE km_equity_eod SET {set_clause} "
                f"WHERE trade_date = %s AND equity_id IN "
                f"(SELECT id FROM km_equity_symbols WHERE exchange = %s)",
                [str(trade_date), exchange],
            )
        else:
            cur.execute(
                f"UPDATE {table} SET {set_clause} WHERE trade_date = %s",
                [str(trade_date)],
            )
        affected = cur.rowcount
    conn.commit()
    return affected


def _delete_date(conn, table: str, trade_date: date) -> int:
    with conn.cursor() as cur:
        cur.execute(f"DELETE FROM {table} WHERE trade_date = %s", [str(trade_date)])
        affected = cur.rowcount
    conn.commit()
    return affected


def _nifty500_id(conn) -> Optional[int]:
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM km_index_symbols WHERE name = 'NIFTY 500' LIMIT 1")
        row = cur.fetchone()
        return row[0] if row else None


def _rpc(conn, fn_name: str, params: dict) -> list[dict]:
    """Call an RPC and commit on success. Always returns a list of dicts."""
    arg_list = ', '.join(f'%({k})s' for k in params.keys())
    sql = f'SELECT * FROM {fn_name}({arg_list})'
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()
    conn.commit()
    return [dict(r) for r in rows]


# ── Column-fill handlers (indicators / flow / magic_rs) ──────────────────

def _handle_columnfill(
    conn, dim: str, trade_date: date, force: bool,
    on_progress: ProgressFn,
) -> HandlerResult:
    exchange = _exchange_for_dim(dim)
    meta = DIMENSION_HEALTH[dim]
    table, id_col, _cols, ok = meta
    ok_pct = ok * 100.0 if ok is not None else None

    before = fill_rate(conn, dim, trade_date)
    on_progress(f'before fill_rate = {before:.1f}%', 5)

    if force:
        on_progress(f'force: nullifying {dim} for {trade_date}', 15)
        _nullify_columns(conn, dim, trade_date, exchange)

    on_progress(f'running compute RPC for {dim}', 30)
    try:
        if 'indicators' in dim:
            _rpc(conn, 'compute_all_pending_indicators', {
                'p_table': table, 'p_id_col': id_col,
                'p_from_date': str(trade_date), 'p_to_date': str(trade_date),
            })
        elif 'flow' in dim:
            _rpc(conn, 'compute_all_flow_intelligence', {
                'p_table': table, 'p_id_col': id_col,
                'p_from_date': str(trade_date), 'p_to_date': str(trade_date),
            })
        elif 'magic_rs' in dim:
            bench = _nifty500_id(conn)
            if bench is None:
                return HandlerResult('failed', before, before, 0,
                                     error_msg='NIFTY 500 not found in km_index_symbols')
            _rpc(conn, 'compute_all_magic_rs', {
                'p_table': table, 'p_id_col': id_col,
                'p_benchmark_id': bench, 'p_from_date': str(trade_date),
            })
        else:
            return HandlerResult('failed', before, before, 0,
                                 error_msg=f'Unknown column-fill dimension: {dim}')
    except Exception as e:
        conn.rollback()
        return HandlerResult('failed', before, before, 0, error_msg=str(e)[:500])

    on_progress('measuring post-run fill_rate', 85)
    after = fill_rate(conn, dim, trade_date)
    status = _classify(before, after, ok_pct)

    # rows_affected = ground-truth delta (not the RPC's inflated counter).
    # Convert percentage-of-total back into an absolute row delta.
    with conn.cursor() as cur:
        if exchange and table == 'km_equity_eod':
            cur.execute(
                "SELECT COUNT(*) FROM km_equity_eod e "
                "JOIN km_equity_symbols s ON s.id = e.equity_id "
                "WHERE e.trade_date = %s AND s.exchange = %s",
                [str(trade_date), exchange],
            )
        else:
            cur.execute(
                f"SELECT COUNT(*) FROM {table} WHERE trade_date = %s",
                [str(trade_date)],
            )
        total = cur.fetchone()[0] or 0
    delta_rows = int(round(total * (after - before) / 100.0))

    return HandlerResult(status, before, after, max(delta_rows, 0))


# ── Script-based compute handlers (supertrend / rolling_metrics / d365 / stage / vani) ──

def _handle_script(
    dim: str, conn, trade_date: date, force: bool, on_progress: ProgressFn,
    script_fn,
) -> HandlerResult:
    """Generic wrapper for backfill script entry points."""
    before = fill_rate(conn, dim, trade_date)
    on_progress(f'before fill_rate = {before:.1f}%', 5)

    if force:
        meta = DIMENSION_HEALTH[dim]
        table, _id_col, cols, _ok = meta
        set_clause = ', '.join(f'{c} = NULL' for c in (cols or []))
        if set_clause:
            on_progress(f'force: nullifying {dim} columns for {trade_date}', 15)
            with conn.cursor() as cur:
                cur.execute(f"UPDATE {table} SET {set_clause} WHERE trade_date = %s",
                            [str(trade_date)])
            conn.commit()

    on_progress(f'running {dim} for {trade_date}', 30)
    try:
        rows = script_fn(conn, trade_date, verbose=False)
    except Exception as e:
        try:
            conn.rollback()
        except Exception:
            pass
        return HandlerResult('failed', before, before, 0, error_msg=str(e)[:500])

    on_progress('measuring post-run fill_rate', 85)
    after = fill_rate(conn, dim, trade_date)
    ok_pct = (DIMENSION_HEALTH[dim][3] or 0) * 100.0
    status = _classify(before, after, ok_pct)
    return HandlerResult(status, before, after, rows or 0)


def handle_supertrend(conn, trade_date: date, force: bool,
                      exchange: Optional[str], on_progress: ProgressFn) -> HandlerResult:
    from scripts.backfill_supertrend import compute_supertrend_for_date
    return _handle_script('supertrend', conn, trade_date, force, on_progress,
                          compute_supertrend_for_date)


def handle_rolling_metrics(conn, trade_date: date, force: bool,
                           exchange: Optional[str], on_progress: ProgressFn) -> HandlerResult:
    from scripts.backfill_rolling_metrics import compute_rolling_metrics_for_date
    return _handle_script('rolling_metrics', conn, trade_date, force, on_progress,
                          compute_rolling_metrics_for_date)


def handle_rs_percentile(conn, trade_date: date, force: bool,
                         exchange: Optional[str], on_progress: ProgressFn) -> HandlerResult:
    # rs_percentile ranks each equity by magic_rs within the day's universe.
    # It lived only in the legacy daily_pipeline (gated by skip_indicators, which
    # pipeline2 sets True), so it silently stopped when prod moved to pipeline2 —
    # dead since 2026-06-19. Registered here so the nightly keeps it current.
    from scripts.backfill_rs_percentile import compute_rs_percentile_for_date
    return _handle_script('rs_percentile', conn, trade_date, force, on_progress,
                          compute_rs_percentile_for_date)


def handle_d365(conn, trade_date: date, force: bool,
                exchange: Optional[str], on_progress: ProgressFn) -> HandlerResult:
    from scripts.backfill_d365 import compute_d365_for_date
    return _handle_script('d365', conn, trade_date, force, on_progress,
                          compute_d365_for_date)


def handle_stage_classification(conn, trade_date: date, force: bool,
                                exchange: Optional[str], on_progress: ProgressFn) -> HandlerResult:
    from scripts.backfill_stage_classification import compute_stage_for_date
    return _handle_script('stage_classification', conn, trade_date, force, on_progress,
                          compute_stage_for_date)


def handle_vani_flags(conn, trade_date: date, force: bool,
                      exchange: Optional[str], on_progress: ProgressFn) -> HandlerResult:
    from scripts.backfill_vani_flags import compute_vani_flags_for_date
    return _handle_script('vani_flags', conn, trade_date, force, on_progress,
                          compute_vani_flags_for_date)


def compute_custom_index_indicators(
    conn,
    from_date: Optional[date] = None,
    index_ids: Optional[list[int]] = None,
    refresh: bool = False,
) -> int:
    """Fill the indicator layer for custom (category='custom') indices.

    Custom indices are synthesised (compute_custom_index_eod) as an equal-weight
    OHLC/returns basket AFTER the standard index_indicators/index_flow/
    index_magic_rs dimensions have already run for the date, so their rows never
    get ema_20/rsi_14/magic_rs/flow_type computed — every zone/flow/technical
    widget on the custom-index detail page reads blank. This runs the SAME
    generic per-symbol RPCs standard indices use, scoped to each custom index.

    Order matters: compute_flow_intelligence reads magic_rs + rsi_14 + sma_150,
    so it runs AFTER indicators (ema/sma/rsi/sniper) and magic_rs.

      from_date : NULL = full history (backfill); a date = incremental from there
                  (daily run passes the trade_date — cheap, one bar per index).
      refresh   : re-null indicators_computed_at first so an edited index
                  recomputes (compute_indicators_batch only fills NULL-stamped
                  rows). Not needed for the daily incremental path (new bar is
                  already NULL-stamped).
    """
    if index_ids is None:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM km_index_symbols "
                "WHERE category = 'custom' AND is_active = true ORDER BY id")
            index_ids = [r[0] for r in cur.fetchall()]
    if not index_ids:
        return 0

    bench = _nifty500_id(conn)
    p_from = str(from_date) if from_date else None
    total = 0
    for cid in index_ids:
        with conn.cursor() as cur:
            if refresh:
                if p_from:
                    cur.execute(
                        "UPDATE km_index_eod SET indicators_computed_at = NULL "
                        "WHERE index_id = %s AND trade_date >= %s", [cid, p_from])
                else:
                    cur.execute(
                        "UPDATE km_index_eod SET indicators_computed_at = NULL "
                        "WHERE index_id = %s", [cid])
            # 1. ema/sma/rsi/sniper/rvol — needed by magic_rs + flow below
            cur.execute(
                "SELECT compute_indicators_batch('km_index_eod','index_id',%s,%s)",
                [cid, p_from])
            total += cur.fetchone()[0] or 0
            # 2. magic_rs vs NIFTY 500 (same benchmark as standard indices).
            # MUST pass all 7 args (bench_table/col = NULL → same table): the
            # 5-arg form is ambiguous with the 7-arg overload's defaults and
            # errors "function is not unique". This mirrors compute_all_magic_rs,
            # which passes NULL/NULL for p_table='km_index_eod'.
            if bench is not None:
                cur.execute(
                    "SELECT compute_magic_rs_batch("
                    "'km_index_eod','index_id',%s,%s,%s,NULL,NULL)",
                    [cid, bench, p_from])
            # 3. flow_type / accum_distrib — reads magic_rs + rsi_14 + sma_150
            cur.execute(
                "SELECT compute_flow_intelligence('km_index_eod','index_id',%s,%s)",
                [cid, p_from])
        conn.commit()
    return total


def handle_index_returns(conn, trade_date: date, force: bool,
                         exchange: Optional[str], on_progress: ProgressFn) -> HandlerResult:
    """Index returns (ret_5d/22d/66d) + custom-index synthetic EOD + scores.

    Order matters:
      1. compute_all_index_returns — LAG over close for every index that has
         EOD rows (NSE-downloaded indices get their returns here).
      2. compute_custom_index_eod — upserts category='custom' rows as the
         equal-weight average of constituents (close + returns). Runs AFTER
         the LAG pass so a young custom index's newest bar is never
         NULL-clobbered when it has fewer bars than the return window.
      3. compute_all_index_scores — scores derive from returns, so last.
    """
    before = fill_rate(conn, 'index_returns', trade_date)
    on_progress(f'before fill_rate = {before:.1f}%', 5)

    if force:
        on_progress('force: nullifying return/score columns', 10)
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE km_index_eod SET ret_5d = NULL, ret_22d = NULL, "
                "ret_66d = NULL, score_5d = NULL, score_22d = NULL "
                "WHERE trade_date = %s",
                [str(trade_date)])
        conn.commit()

    rows = 0
    try:
        on_progress('running compute_all_index_returns', 25)
        res = _rpc(conn, 'compute_all_index_returns', {'p_from_date': str(trade_date)})
        rows += sum(r.get('rows_updated', 0) for r in res)

        on_progress('running compute_custom_index_eod', 55)
        res = _rpc(conn, 'compute_custom_index_eod', {
            'p_from_date': str(trade_date), 'p_to_date': str(trade_date)})
        rows += (res[0].get('compute_custom_index_eod', 0) or 0) if res else 0

        on_progress('running compute_all_index_scores', 75)
        _rpc(conn, 'compute_all_index_scores', {'p_from_date': str(trade_date)})

        # Custom indices are synthesised above, AFTER the standard
        # index_indicators/flow/magic_rs dimensions already ran for this date —
        # so fill their indicator layer here (ema/rsi/magic_rs/flow_type) for
        # the newly-synthesised bar. Incremental (from=trade_date), no refresh
        # needed: the new bar is NULL-stamped. Non-fatal — a failure here must
        # not fail the returns/scores that already committed.
        on_progress('running custom-index indicators', 88)
        try:
            compute_custom_index_indicators(conn, from_date=trade_date)
        except Exception as ie:
            conn.rollback()
            on_progress(f'custom-index indicators skipped: {str(ie)[:120]}', 89)
    except Exception as e:
        conn.rollback()
        return HandlerResult('failed', before, before, 0, error_msg=str(e)[:500])

    on_progress('measuring post-run fill_rate', 90)
    after = fill_rate(conn, 'index_returns', trade_date)
    ok_pct = (DIMENSION_HEALTH['index_returns'][3] or 0) * 100.0
    status = _classify(before, after, ok_pct)
    return HandlerResult(status, before, after, rows)


# ── Row-presence handlers (industry / breadth) ───────────────────────────

def handle_industry_composites(conn, trade_date: date, force: bool,
                               exchange: Optional[str], on_progress: ProgressFn) -> HandlerResult:
    before = fill_rate(conn, 'industry_composites', trade_date)
    on_progress(f'before fill_rate = {before:.1f}%', 5)

    if force:
        on_progress('force: deleting existing composites', 15)
        _delete_date(conn, 'km_industry_eod', trade_date)

    on_progress('running compute_all_industry_composites', 30)
    try:
        _rpc(conn, 'compute_all_industry_composites', {'p_trade_date': str(trade_date)})
    except Exception as e:
        conn.rollback()
        return HandlerResult('failed', before, before, 0, error_msg=str(e)[:500])

    after = fill_rate(conn, 'industry_composites', trade_date)
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM km_industry_eod WHERE trade_date = %s",
                    [str(trade_date)])
        rows = cur.fetchone()[0] or 0

    status = 'completed' if after >= 100.0 else ('partial' if rows > 0 else 'failed')
    return HandlerResult(status, before, after, rows)


def handle_market_breadth(conn, trade_date: date, force: bool,
                          exchange: Optional[str], on_progress: ProgressFn) -> HandlerResult:
    before = fill_rate(conn, 'market_breadth', trade_date)
    on_progress(f'before fill_rate = {before:.1f}%', 5)

    if force:
        _delete_date(conn, 'km_market_breadth', trade_date)

    on_progress('computing market breadth', 30)
    try:
        from compute_market_breadth import load_closes, compute_breadth, upsert
        closes = load_closes(conn)
        if closes.empty:
            return HandlerResult('failed', before, before, 0,
                                 error_msg='No close data available for breadth compute')
        df = compute_breadth(closes)
        df = df[df.index == trade_date]
        if df.empty:
            return HandlerResult('failed', before, before, 0,
                                 error_msg=f'No computed breadth row for {trade_date} (warmup?)')
        n = int(upsert(conn, df, dry_run=False))
        conn.commit()
    except Exception as e:
        conn.rollback()
        return HandlerResult('failed', before, before, 0, error_msg=str(e)[:500])

    after = fill_rate(conn, 'market_breadth', trade_date)
    status = 'completed' if after >= 100.0 else 'failed'
    return HandlerResult(status, before, after, n)


def handle_breadth_roc(conn, trade_date: date, force: bool,
                       exchange: Optional[str], on_progress: ProgressFn) -> HandlerResult:
    before = fill_rate(conn, 'breadth_roc', trade_date)
    on_progress(f'before fill_rate = {before:.1f}%', 5)

    if force:
        _delete_date(conn, 'km_breadth_roc', trade_date)

    on_progress('computing breadth ROC', 30)
    try:
        from compute_breadth_roc import load_closes, compute_roc, upsert
        closes = load_closes(conn)
        if closes.empty:
            return HandlerResult('failed', before, before, 0,
                                 error_msg='No close data available for breadth_roc compute')
        df = compute_roc(closes)
        df = df[df.index == trade_date]
        if df.empty:
            return HandlerResult('failed', before, before, 0,
                                 error_msg=f'No computed roc row for {trade_date} (warmup?)')
        n = int(upsert(conn, df, dry_run=False))
        conn.commit()
    except Exception as e:
        conn.rollback()
        return HandlerResult('failed', before, before, 0, error_msg=str(e)[:500])

    after = fill_rate(conn, 'breadth_roc', trade_date)
    status = 'completed' if after >= 100.0 else 'failed'
    return HandlerResult(status, before, after, n)


# ── Scanner materialized-view refresh (migration 147) ────────────────────

def _handle_period_aggregate(dim: str, conn, trade_date: date, force: bool,
                             on_progress: ProgressFn, is_boundary, aggregate_fn,
                             label: str) -> HandlerResult:
    """
    Shared body for the weekly / monthly equity aggregates.

    These ran only in daily_pipeline steps 6e/6f, both gated on
    `not skip_indicators` — and pipeline2 calls run_nse_pipeline with
    skip_indicators=True. So they silently stopped the day production moved to
    pipeline2: km_equity_weekly stale from 2026-05-18, km_equity_monthly from
    2026-05-01. Identical failure to rs_percentile and index_returns.

    Boundary semantics are preserved from the legacy steps: weekly runs on
    Fridays, monthly on the last calendar day. On any other date the step is a
    no-op and reports 'completed' rather than 'failed' — a Tuesday genuinely has
    no weekly bar to write, and marking it failed would have the 19:30 gap sweep
    re-enqueue it every single day.
    """
    before = fill_rate(conn, dim, trade_date)
    on_progress(f'before fill_rate = {before:.1f}%', 5)

    if not is_boundary(trade_date) and not force:
        on_progress(f'{trade_date} is not a {label} boundary — nothing to aggregate', 100)
        return HandlerResult('completed', before, before, 0)

    on_progress(f'aggregating {label} bars through {trade_date}', 30)
    try:
        # aggregate_*_bars takes the db_client (not a raw psycopg2 conn) and a
        # from_date, and rebuilds every period from that date forward. Passing the
        # period start keeps the run bounded to the current period.
        from lib.db_client import get_db
        db = get_db()
        if label == 'weekly':
            from_date = trade_date - timedelta(days=trade_date.isoweekday() - 1)
        else:
            from_date = trade_date.replace(day=1)
        rows = int(aggregate_fn(db, from_date=from_date, run_indicators=True, verbose=False) or 0)
    except Exception as e:
        conn.rollback()
        return HandlerResult('failed', before, before, 0, error_msg=str(e)[:500])

    after = fill_rate(conn, dim, trade_date)
    status = 'completed' if after >= 100.0 else 'failed'
    return HandlerResult(status, before, after, rows)


def handle_equity_weekly(conn, trade_date: date, force: bool,
                         exchange: Optional[str], on_progress: ProgressFn) -> HandlerResult:
    from daily_pipeline import is_week_end
    from pipeline.compute import aggregate_weekly_bars
    return _handle_period_aggregate('equity_weekly', conn, trade_date, force,
                                    on_progress, is_week_end, aggregate_weekly_bars, 'weekly')


def handle_equity_monthly(conn, trade_date: date, force: bool,
                          exchange: Optional[str], on_progress: ProgressFn) -> HandlerResult:
    from daily_pipeline import is_month_end
    from pipeline.compute import aggregate_monthly_bars
    return _handle_period_aggregate('equity_monthly', conn, trade_date, force,
                                    on_progress, is_month_end, aggregate_monthly_bars, 'monthly')


def handle_scan_refresh(conn, trade_date: date, force: bool,
                        exchange: Optional[str], on_progress: ProgressFn) -> HandlerResult:
    """Refresh the scanner materialized views (km_scan_results + companion
    km_scan_exclusion_counts, migration 147).

    This is the LAST daily step: the matview reads magic_rs, flows, rolling
    metrics, vani flags, and industry composites, so every one of those compute
    steps must finish first. It reads the same 'latest complete date' logic the
    live scan engine uses (>=4000 equity rows), so it always reflects the newest
    fully-loaded trade date — not `trade_date` per se.

    Uses REFRESH ... CONCURRENTLY so scanner reads never block during the rebuild
    (the unique indexes migration 147 creates make this legal). Falls back to a
    plain refresh the first time a matview is refreshed while still unpopulated
    (CONCURRENTLY requires pre-existing data). REFRESH cannot run inside a txn
    block, so we flip the connection to autocommit for the duration.

    Order matters: km_scan_results FIRST — km_scan_exclusion_counts.included_count
    reads from it.
    """
    on_progress('checking scan matviews exist', 5)
    with conn.cursor() as cur:
        cur.execute("SELECT to_regclass('public.km_scan_results')::text, "
                    "to_regclass('public.km_scan_exclusion_counts')::text")
        results_reg, excl_reg = cur.fetchone()
    conn.commit()

    if results_reg is None:
        # Migration 147 not applied in this environment — skip, don't fail the run.
        return HandlerResult('partial', 0.0, 0.0, 0,
                             error_msg='km_scan_results absent (migration 147 not applied)')

    views = [('km_scan_results', results_reg)]
    if excl_reg is not None:
        views.append(('km_scan_exclusion_counts', excl_reg))

    prev_autocommit = conn.autocommit
    conn.autocommit = True
    try:
        for i, (view, _reg) in enumerate(views):
            on_progress(f'refreshing {view}', 30 + i * 40)
            try:
                with conn.cursor() as cur:
                    cur.execute(f'REFRESH MATERIALIZED VIEW CONCURRENTLY {view}')
            except psycopg2.Error:
                # First-ever refresh of an unpopulated matview: CONCURRENTLY is
                # illegal, so do a plain (briefly-locking) refresh instead.
                with conn.cursor() as cur:
                    cur.execute(f'REFRESH MATERIALIZED VIEW {view}')
    except Exception as e:
        conn.autocommit = prev_autocommit
        return HandlerResult('failed', 0.0, 0.0, 0, error_msg=str(e)[:500])
    finally:
        conn.autocommit = prev_autocommit

    # Flower Pot Burst day-2 state: record today's releases + judge yesterday's.
    # Runs AFTER the matview refresh (it reads today's releases from it). Best-
    # effort — a missing function (migration 156 not applied) must not fail the
    # scan refresh.
    on_progress('maintaining fpb day-2 state', 85)
    try:
        with conn.cursor() as cur:
            cur.execute('SELECT maintain_fpb_active(CURRENT_DATE)')
        conn.commit()
    except psycopg2.Error:
        conn.rollback()  # km_fpb_active / maintain_fpb_active absent — skip silently

    on_progress('measuring refreshed row count', 90)
    with conn.cursor() as cur:
        cur.execute('SELECT count(*) FROM km_scan_results')
        n = cur.fetchone()[0] or 0
    conn.commit()

    status = 'completed' if n > 0 else 'partial'
    return HandlerResult(status, 0.0, 100.0 if n > 0 else 0.0, n)


# ── Download handlers ───────────────────────────────────────────────────
#
# These drive the legacy download code under pipeline/ (not touched by v2
# rebuild) with skip_indicators=True so only the fetch / parse / insert
# steps run — compute is handled by subsequent jobs in the backfill batch.
#
# The legacy runners expect a PgClient-style db, not a raw psycopg2
# connection. We open a PgClient via lib.db_client.get_db() — it uses its
# own pool, separate from the worker's single connection, so the two
# don't fight over locks.

def _eod_row_count(conn, table: str, trade_date: date,
                   exchange: Optional[str] = None) -> int:
    """Ground-truth row count for a download dimension on a single date."""
    with conn.cursor() as cur:
        if exchange and table == 'km_equity_eod':
            cur.execute(
                "SELECT COUNT(*) FROM km_equity_eod e "
                "JOIN km_equity_symbols s ON s.id = e.equity_id "
                "WHERE s.exchange = %s AND e.trade_date = %s",
                [exchange, str(trade_date)],
            )
        else:
            cur.execute(f"SELECT COUNT(*) FROM {table} WHERE trade_date = %s",
                        [str(trade_date)])
        n = cur.fetchone()[0] or 0
    conn.commit()
    return n


def handle_index_eod_download(conn, trade_date: date, force: bool,
                              exchange: Optional[str], on_progress: ProgressFn) -> HandlerResult:
    """Download NSE index bhav + TRI for `trade_date` and upsert into
    km_index_eod. No compute. force is currently a no-op (upserts are
    idempotent)."""
    from pipeline.downloaders.nse_index_bhav import (
        download_nse_index_bhav, download_nse_tri,
        parse_nse_index_bhav, parse_nse_tri,
        IndexMatcher, upsert_index_eod,
    )
    from pipeline.utils.nse_session import NseSession
    from lib.db_client import get_db

    before = fill_rate(conn, 'index_eod_download', trade_date)
    before_rows = _eod_row_count(conn, 'km_index_eod', trade_date)
    on_progress(f'before: {before_rows} rows ({before:.1f}%)', 5)

    db = get_db()
    nse = NseSession()

    idx_count = 0
    tri_count = 0

    try:
        on_progress(f'{trade_date}: downloading index bhav', 20)
        idx_csv = download_nse_index_bhav(trade_date, session=nse)
        if idx_csv is None:
            # No data for this date (likely holiday / not yet published).
            after = fill_rate(conn, 'index_eod_download', trade_date)
            return HandlerResult(
                'failed' if before_rows == 0 else 'partial',
                before, after, 0,
                error_msg='No index bhav available (holiday or not yet published)',
            )
        records = parse_nse_index_bhav(idx_csv, trade_date)
        matcher = IndexMatcher(db)
        matched, _unmatched = matcher.match_records(records)
        idx_count = upsert_index_eod(db, matched)
        on_progress(f'{trade_date}: {idx_count} index rows upserted', 55)
    except Exception as e:
        return HandlerResult('failed', before, before, 0, error_msg=str(e)[:500])

    # TRI is optional — its URL schema has been known to break. Don't fail
    # the whole download if TRI alone is unavailable.
    try:
        on_progress(f'{trade_date}: downloading TRI', 70)
        tri_csv = download_nse_tri(trade_date, session=nse)
        if tri_csv:
            tri_records = parse_nse_tri(tri_csv, trade_date)
            tri_matched, _tri_unmatched = matcher.match_records(tri_records, is_tri=True)
            tri_count = upsert_index_eod(db, tri_matched)
    except Exception as e:
        on_progress(f'{trade_date}: TRI skipped ({e})', 85)

    on_progress('measuring post-download fill_rate', 95)
    after = fill_rate(conn, 'index_eod_download', trade_date)
    after_rows = _eod_row_count(conn, 'km_index_eod', trade_date)
    rows_added = max(0, after_rows - before_rows)

    if after >= 100.0:
        status = 'completed'
    elif after_rows > 0:
        status = 'partial'
    else:
        status = 'failed'
    return HandlerResult(status, before, after, rows_added)


def _run_exchange_download(
    conn, trade_date: date, force: bool, on_progress: ProgressFn,
    exchange: str, dim: str,
) -> HandlerResult:
    """Shared NSE/BSE equity download driver. Calls the legacy
    run_{nse,bse}_pipeline with skip_indicators=True."""
    from lib.db_client import get_db
    if exchange == 'NSE':
        from daily_pipeline import run_nse_pipeline as run_pipeline
    else:
        from daily_pipeline import run_bse_pipeline as run_pipeline

    before = fill_rate(conn, dim, trade_date)
    before_rows = _eod_row_count(conn, 'km_equity_eod', trade_date, exchange)
    on_progress(f'before: {before_rows} rows ({before:.1f}%)', 5)

    db = get_db()
    on_progress(f'{trade_date}: downloading {exchange} bhav (skip_indicators=True)', 20)
    ok = False
    err: Optional[str] = None
    try:
        ok = run_pipeline(db, trade_date, skip_indicators=True, force=force)
    except Exception as e:
        err = str(e)[:500]

    on_progress('measuring post-download fill_rate', 90)
    after = fill_rate(conn, dim, trade_date)
    after_rows = _eod_row_count(conn, 'km_equity_eod', trade_date, exchange)
    rows_added = max(0, after_rows - before_rows)

    # Classify on ground truth row count, not the pipeline's True/False.
    # run_nse_pipeline can return False for "already completed" days while
    # the rows are in fact present — trust the row count.
    if after >= 100.0:
        status = 'completed'
    elif after_rows > 0:
        status = 'partial'
    else:
        status = 'failed'

    if status == 'failed' and err is None:
        err = 'No rows written (bhav may not be available for this date)'

    return HandlerResult(status, before, after, rows_added, error_msg=err if status != 'completed' else None)


def handle_nse_eod_download(conn, trade_date: date, force: bool,
                            exchange: Optional[str], on_progress: ProgressFn) -> HandlerResult:
    return _run_exchange_download(conn, trade_date, force, on_progress,
                                  exchange='NSE', dim='nse_eod_download')


def handle_bse_eod_download(conn, trade_date: date, force: bool,
                            exchange: Optional[str], on_progress: ProgressFn) -> HandlerResult:
    return _run_exchange_download(conn, trade_date, force, on_progress,
                                  exchange='BSE', dim='bse_eod_download')


# ── Handler registry ─────────────────────────────────────────────────────

def handle(dimension: str, conn, trade_date: date, force: bool,
           exchange: Optional[str], on_progress: ProgressFn) -> HandlerResult:
    """Dispatch a fix to the right per-dimension handler."""
    if dimension == 'index_eod_download':
        return handle_index_eod_download(conn, trade_date, force, exchange, on_progress)
    if dimension == 'nse_eod_download':
        return handle_nse_eod_download(conn, trade_date, force, exchange, on_progress)
    if dimension == 'bse_eod_download':
        return handle_bse_eod_download(conn, trade_date, force, exchange, on_progress)
    if dimension in (
        'index_indicators', 'nse_equity_indicators', 'bse_equity_indicators',
        'index_flow', 'nse_flow', 'bse_flow',
        'index_magic_rs', 'nse_magic_rs', 'bse_magic_rs',
    ):
        return _handle_columnfill(conn, dimension, trade_date, force, on_progress)
    if dimension == 'supertrend':
        return handle_supertrend(conn, trade_date, force, exchange, on_progress)
    if dimension == 'rolling_metrics':
        return handle_rolling_metrics(conn, trade_date, force, exchange, on_progress)
    if dimension == 'equity_weekly':
        return handle_equity_weekly(conn, trade_date, force, exchange, on_progress)
    if dimension == 'equity_monthly':
        return handle_equity_monthly(conn, trade_date, force, exchange, on_progress)
    if dimension == 'rs_percentile':
        return handle_rs_percentile(conn, trade_date, force, exchange, on_progress)
    if dimension == 'd365':
        return handle_d365(conn, trade_date, force, exchange, on_progress)
    if dimension == 'stage_classification':
        return handle_stage_classification(conn, trade_date, force, exchange, on_progress)
    if dimension == 'vani_flags':
        return handle_vani_flags(conn, trade_date, force, exchange, on_progress)
    if dimension == 'index_returns':
        return handle_index_returns(conn, trade_date, force, exchange, on_progress)
    if dimension == 'industry_composites':
        return handle_industry_composites(conn, trade_date, force, exchange, on_progress)
    if dimension == 'market_breadth':
        return handle_market_breadth(conn, trade_date, force, exchange, on_progress)
    if dimension == 'breadth_roc':
        return handle_breadth_roc(conn, trade_date, force, exchange, on_progress)
    if dimension == 'scan_refresh':
        return handle_scan_refresh(conn, trade_date, force, exchange, on_progress)
    raise ValueError(f'Unknown dimension: {dimension}')


# All dimensions the UI knows about — downloads + compute, in display order.
KNOWN_DIMENSIONS = [
    'index_eod_download',
    'nse_eod_download',
    'bse_eod_download',
    'index_indicators',
    'nse_equity_indicators',
    'bse_equity_indicators',
    'index_flow',
    'nse_flow',
    'bse_flow',
    'index_magic_rs',
    'nse_magic_rs',
    'bse_magic_rs',
    'rs_percentile',
    'supertrend',
    'rolling_metrics',
    'd365',
    'stage_classification',
    'vani_flags',
    'index_returns',
    'industry_composites',
    'market_breadth',
    'breadth_roc',
    'scan_refresh',
]
