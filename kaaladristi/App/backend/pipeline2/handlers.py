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
from datetime import date
from typing import Callable, Optional

import psycopg2
import psycopg2.extras

from .health import (
    DIMENSION_HEALTH,
    DOWNLOAD_DIMENSIONS,
    fill_rate,
    ok_threshold_for,
)


# Download dims are surfaced in the grid / dimensions list but have no
# fix handler yet (no RPC equivalent of re-running a bhav download).
# The API layer returns 400 before enqueuing; this set is the canonical
# "is this dimension fixable?" check used by both API and worker.
FIXABLE_DIMENSIONS = frozenset({
    'index_indicators', 'nse_equity_indicators', 'bse_equity_indicators',
    'index_flow', 'nse_flow', 'bse_flow',
    'nse_magic_rs', 'bse_magic_rs',
    'industry_composites', 'market_breadth', 'breadth_roc',
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


# ── Handler registry ─────────────────────────────────────────────────────

def handle(dimension: str, conn, trade_date: date, force: bool,
           exchange: Optional[str], on_progress: ProgressFn) -> HandlerResult:
    """Dispatch a fix to the right per-dimension handler."""
    if dimension in DOWNLOAD_DIMENSIONS:
        # The API layer rejects these with 400 before enqueuing, but guard
        # here too in case a job leaks through (e.g. manually inserted row).
        raise ValueError(
            f'Download fix not yet implemented for {dimension!r} — '
            'run daily pipeline manually.'
        )
    if dimension in (
        'index_indicators', 'nse_equity_indicators', 'bse_equity_indicators',
        'index_flow', 'nse_flow', 'bse_flow',
        'nse_magic_rs', 'bse_magic_rs',
    ):
        return _handle_columnfill(conn, dimension, trade_date, force, on_progress)
    if dimension == 'industry_composites':
        return handle_industry_composites(conn, trade_date, force, exchange, on_progress)
    if dimension == 'market_breadth':
        return handle_market_breadth(conn, trade_date, force, exchange, on_progress)
    if dimension == 'breadth_roc':
        return handle_breadth_roc(conn, trade_date, force, exchange, on_progress)
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
    'nse_magic_rs',
    'bse_magic_rs',
    'industry_composites',
    'market_breadth',
    'breadth_roc',
]
