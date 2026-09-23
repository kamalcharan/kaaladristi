"""
Stage Classification Backfill
==============================
Computes sma200_rising, stage, is_vani_s2 for km_equity_eod rows.

Stage logic (Weinstein):
  S2           — close > sma_50 > sma_200, sma200_rising, w52 gates, close > 30
  S2_CANDIDATE — close > sma_50 > sma_200, close > 30  (missing S2 gates)
  S1           — close within 5% of sma_200, MA flat (not rising)
  S3           — close > sma_200, sma_50 converging toward sma_200 (<15% gap)
  S4           — close < sma_200
  NULL         — insufficient data (sma_200 not yet available)

is_vani_s2 (S2 only):
  magic_rs > 40 AND rvol > 1.5 AND rsi_14 BETWEEN 50 AND 80
  AND close / lifetime_high >= 0.75 AND close / w52_high >= 0.85

Strategy:
  Single-pass pure SQL UPDATE using window functions + CASE — one query over the
  full table (or a date range for --date mode). PostgreSQL handles all the work;
  no per-row Python loops.

Usage:
    cd App/backend

    # Default: reprocess rows where stage IS NULL (fast re-run safe)
    python scripts/backfill_stage_classification.py

    # Force reprocess everything (full history)
    python scripts/backfill_stage_classification.py --full

    # Single date only (e.g. after nightly pipeline)
    python scripts/backfill_stage_classification.py --date 2026-06-03

    # Verify counts, no writes
    python scripts/backfill_stage_classification.py --verify
"""

import sys
import os
import time
import psycopg2
import argparse
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL

# ── SQL ────────────────────────────────────────────────────────────────────

_BASE_CTE = """
WITH computed AS (
    SELECT
        id,
        -- sma200_rising: sma_200 > its value 20 bars ago
        CASE
            WHEN sma_200 IS NOT NULL
             AND LAG(sma_200, 20) OVER w > 0
            THEN sma_200 > LAG(sma_200, 20) OVER w
            ELSE NULL
        END AS rising,

        -- w52_high / w52_low / lifetime_high — READ, not recomputed.
        -- rolling_metrics (an earlier DAILY_STEPS step, always run first for
        -- this same trade_date) already computes these exact 252-bar/
        -- unbounded window aggregates and writes them to these columns.
        -- Recomputing them here via a second set of window functions over
        -- full history was pure redundant work — the single biggest cost
        -- in this query, since the UNBOUNDED lifetime-high window in
        -- particular forces a full-partition scan per symbol on every run.
        w52_high      AS w52h,
        w52_low       AS w52l,
        lifetime_high AS lth,

        -- raw columns needed for CASE logic below
        close, sma_50, sma_200,
        magic_rs, rvol, rsi_14

    FROM km_equity_eod
    {where_clause}
    WINDOW w AS (PARTITION BY equity_id ORDER BY trade_date)
),
classified AS (
    SELECT
        id,
        rising,

        CASE
            WHEN sma_200 IS NULL THEN NULL

            -- S4: below 200 MA
            WHEN close < sma_200 THEN 'S4'

            -- S2: full uptrend with SMA confirmation + w52 gates
            WHEN close > sma_50
             AND sma_50  > sma_200
             AND close   > 30
             AND rising  = TRUE
             AND w52l    IS NOT NULL
             AND w52h    IS NOT NULL
             AND close   >= w52l * 1.25
             AND close   >= w52h * 0.75
            THEN 'S2'

            -- S2_CANDIDATE: uptrend alignment but missing gates
            WHEN close > sma_50
             AND sma_50 > sma_200
             AND close  > 30
            THEN 'S2_CANDIDATE'

            -- S1: base — close hugging 200 MA, MA not rising
            WHEN ABS(close - sma_200) / NULLIF(sma_200, 0) <= 0.05
             AND (rising IS NULL OR rising = FALSE)
            THEN 'S1'

            -- S3: top — above 200 but sma_50 converging toward sma_200
            WHEN close > sma_200
             AND sma_50 IS NOT NULL
             AND ABS(sma_50 - sma_200) / NULLIF(sma_200, 0) < 0.15
            THEN 'S3'

            -- fallback above 200
            ELSE 'S3'
        END AS stage,

        -- is_vani_s2
        CASE
            WHEN close > sma_50
             AND sma_50  > sma_200
             AND close   > 30
             AND rising  = TRUE
             AND w52l    IS NOT NULL
             AND w52h    IS NOT NULL
             AND close   >= w52l * 1.25
             AND close   >= w52h * 0.75
             AND magic_rs > 40
             AND rvol     > 1.5
             AND rsi_14  BETWEEN 50 AND 80
             AND lth     IS NOT NULL AND lth > 0
             AND close / lth  >= 0.75
             AND close / w52h >= 0.85
            THEN TRUE
            ELSE FALSE
        END AS is_vani
    FROM computed
)
UPDATE km_equity_eod e
SET
    sma200_rising = c.rising,
    stage         = c.stage,
    is_vani_s2    = c.is_vani
FROM classified c
WHERE e.id = c.id
{update_filter}
"""


def _apply_unknown_stage(conn, target_date: str = None) -> int:
    """Set stage = 'UNKNOWN' for rows where sma_200 IS NULL (insufficient history).
    If target_date is given, scoped to that date only; otherwise all-history."""
    if target_date:
        sql = """
            UPDATE km_equity_eod
            SET stage = 'UNKNOWN'
            WHERE trade_date = %s
              AND stage IS NULL
              AND sma_200 IS NULL
        """
        params = [target_date]
    else:
        sql = """
            UPDATE km_equity_eod
            SET stage = 'UNKNOWN'
            WHERE stage IS NULL
              AND sma_200 IS NULL
        """
        params = []
    with conn.cursor() as cur:
        cur.execute(sql, params)
        updated = cur.rowcount
    conn.commit()
    if updated:
        scope = f"date={target_date}" if target_date else "all history"
        print(f"  [unknown-stage] {updated:,} rows → 'UNKNOWN' ({scope})")
    return updated


def _run_sql(conn, where_clause: str, update_filter: str, label: str, timeout_ms: int = 600_000):
    sql = _BASE_CTE.format(where_clause=where_clause, update_filter=update_filter)
    t0 = time.time()
    print(f"\n[{label}] Running single-pass SQL UPDATE...")
    print("  (scans full history via window functions — may take several minutes)")
    with conn.cursor() as cur:
        cur.execute(f"SET statement_timeout = {timeout_ms}")
        cur.execute(sql)
        updated = cur.rowcount
    conn.commit()
    elapsed = time.time() - t0
    print(f"  Done — {updated:,} rows updated in {elapsed:.0f}s")
    return updated


def run_missing(conn):
    """Update only rows where stage IS NULL (default mode)."""
    where = """
        WHERE equity_id IN (
            SELECT DISTINCT equity_id FROM km_equity_eod WHERE stage IS NULL
        )
    """
    update_filter = "AND e.stage IS NULL"
    n = _run_sql(conn, where, update_filter, "missing", timeout_ms=1_800_000)
    _apply_unknown_stage(conn)
    return n


def run_full(conn):
    """Reprocess all rows."""
    n = _run_sql(conn, "", "", "full", timeout_ms=1_800_000)
    _apply_unknown_stage(conn)
    return n


def run_date(conn, target_date: str):
    """Reprocess a single trade date (e.g. after nightly pipeline).

    ⚠ History: this used to scan the FULL km_equity_eod table (every symbol,
    entire history — years of data, ~5M+ rows) on EVERY daily run, per the
    old comment "we must still pass all history for the window functions".
    That was true only for the w52/lifetime-high windows, which are now read
    directly from rolling_metrics's output instead of recomputed (see
    _BASE_CTE) — the only window function left is LAG(sma_200, 20), which
    needs at most ~20 TRADING days of lookback per symbol. A 120-CALENDAR-day
    bound comfortably covers that (even through holiday clusters) while
    cutting the scan from the entire table down to a small recent slice —
    this was the dominant cost of the daily stage_classification step.
    """
    # bound is computed IN SQL (target_date - 120 days), not passed as a
    # separate param — avoids relying on target_date's Python type (str vs
    # date) for arithmetic.
    where = "WHERE trade_date >= %(dt)s::date - INTERVAL '120 days' AND trade_date <= %(dt)s"
    sql = _BASE_CTE.format(
        where_clause=where,
        update_filter="AND e.trade_date = %(dt)s"
    )
    t0 = time.time()
    print(f"\n[date={target_date}] Single-pass SQL UPDATE for one date (120-day bounded scan)...")
    with conn.cursor() as cur:
        cur.execute("SET statement_timeout = 600000")
        cur.execute(sql, {'dt': target_date})
        updated = cur.rowcount
    conn.commit()
    elapsed = time.time() - t0
    print(f"  Done — {updated:,} rows updated in {elapsed:.0f}s")
    _apply_unknown_stage(conn, target_date)
    return updated


def verify(conn):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                trade_date,
                COUNT(*) FILTER (WHERE stage = 'S2')           AS s2,
                COUNT(*) FILTER (WHERE stage = 'S2_CANDIDATE') AS s2c,
                COUNT(*) FILTER (WHERE stage = 'S1')           AS s1,
                COUNT(*) FILTER (WHERE stage = 'S3')           AS s3,
                COUNT(*) FILTER (WHERE stage = 'S4')           AS s4,
                COUNT(*) FILTER (WHERE stage = 'UNKNOWN')      AS unknown,
                COUNT(*) FILTER (WHERE stage IS NULL)          AS unclassified,
                COUNT(*) FILTER (WHERE is_vani_s2 = TRUE)      AS vani_s2
            FROM km_equity_eod
            WHERE trade_date = (SELECT MAX(trade_date) FROM km_equity_eod)
            GROUP BY trade_date
        """)
        row = cur.fetchone()
        if row:
            dt, s2, s2c, s1, s3, s4, unk, null_, vani = row
            print(f"\n[verify] Latest trade_date = {dt}")
            print(f"  S2            = {s2:>6,}")
            print(f"  S2_CANDIDATE  = {s2c:>6,}")
            print(f"  S1            = {s1:>6,}")
            print(f"  S3            = {s3:>6,}")
            print(f"  S4            = {s4:>6,}")
            print(f"  UNKNOWN       = {unk:>6,}")
            print(f"  unclassified  = {null_:>6,}  ← should be 0")
            print(f"  VaNi S2       = {vani:>6,}")
        # Total null check across all dates
        cur.execute("SELECT COUNT(*) FROM km_equity_eod WHERE stage IS NULL AND sma_200 IS NOT NULL")
        classifiable_nulls = cur.fetchone()[0]
        if classifiable_nulls:
            print(f"\n  ⚠ {classifiable_nulls:,} rows have sma_200 but stage IS NULL across all dates")
        else:
            print("\n  ✓ All classifiable rows have a stage.")


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(DATABASE_URL, connect_timeout=30)


# ── Pipeline entry point ───────────────────────────────────────────────────

def compute_stage_for_date(db_conn, trade_date, verbose=False):
    """Called from daily_pipeline.py step 6h for a single trade date.
    Opens its own psycopg2 connection — db_conn is accepted but unused
    (PgClient from daily_pipeline doesn't support cursor()/commit()).
    """
    conn = get_conn()
    try:
        return run_date(conn, str(trade_date))
    finally:
        conn.close()


# ── CLI ───────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--full',   action='store_true', help='Reprocess all rows (default: missing only)')
    parser.add_argument('--date',   default='',          help='Single trade date YYYY-MM-DD')
    parser.add_argument('--verify', action='store_true', help='Show counts only, no writes')
    args = parser.parse_args()

    conn = get_conn()
    try:
        if args.verify:
            verify(conn)
            return

        if args.date:
            run_date(conn, args.date)
        elif args.full:
            print("[stage] Full mode — reprocessing all rows.")
            run_full(conn)
        else:
            print("[stage] Missing mode — only rows where stage IS NULL.")
            run_missing(conn)

        verify(conn)
    finally:
        conn.close()


if __name__ == '__main__':
    main()
