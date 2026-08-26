"""
Rolling Metrics Backfill — FAST single-pass version
=====================================================
Replaces the slow per-date loop in backfill_rolling_metrics.py.

Original: loops over every date, runs a full-table window-function CTE
          each time → O(N_dates × table_size) → 3+ days for full history.

This version: one UPDATE covers the entire date range in a single pass.
          The window CTE scans the table ONCE and PostgreSQL resolves all
          window frames in one sort+scan sweep → typically 10-30 minutes
          for full history, seconds for a small date range.

Columns written (same as original):
  w52_high, w52_low, lifetime_high
  avg_amt_5d, avg_amt_22d, avg_amt_66d
  d30_pct_chng, delivery_surge_x
  pct_5d, pct_22d, pct_66d
  surge_22d, score_5d, score_22d
  ret_5d, ret_22d, ret_66d
  breakout_level, pct_from_breakout, pct_below_52w_high
  breakdown_level, pct_from_breakdown
  deliv_value_cr

Usage:
    # Full history (all dates in km_equity_eod)
    KD_DB_PASSWORD=<pw> python3 backfill_rolling_metrics_fast.py

    # Date range
    KD_DB_PASSWORD=<pw> python3 backfill_rolling_metrics_fast.py --from 2024-01-01 --to 2026-06-24

    # Verify only (no update)
    KD_DB_PASSWORD=<pw> python3 backfill_rolling_metrics_fast.py --verify

    # Verify specific date
    KD_DB_PASSWORD=<pw> python3 backfill_rolling_metrics_fast.py --verify --date 2026-06-24
"""

import os
import sys
import argparse
import time
import psycopg2
import psycopg2.extras

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL

# PostgreSQL statement timeout — single UPDATE can take ~20 min for full history.
# Set to 60 minutes. Adjust down for small ranges.
STATEMENT_TIMEOUT_MS = 60 * 60 * 1000


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(
        DATABASE_URL,
        connect_timeout=30,
        options=f"-c statement_timeout={STATEMENT_TIMEOUT_MS}",
    )


# ── Core SQL ───────────────────────────────────────────────────────────────────
# The WHERE on `s.trade_date` is injected only when a range is given.
# The window functions must still see ALL history (no inner WHERE) so that
# ROWS BETWEEN N PRECEDING look-back is correct for the earliest target dates.
# We filter in the outer UPDATE join, not inside the CTE.

_SQL_TEMPLATE = """
WITH eod AS (
    -- value_cr is true Crores on both exchanges (normalised in parser.py), so the
    -- delivery-value formula needs no exchange-aware rescaling and no join.
    -- Run only against data already rescaled by the value_cr backfill migration.
    SELECT e.*
    FROM km_equity_eod e
),
base AS (
    SELECT
        id,
        equity_id,
        trade_date,
        close,
        high,
        low,
        -- 52-week rolling high/low (252 bars) and lifetime high
        MAX(high) OVER (
            PARTITION BY equity_id ORDER BY trade_date
            ROWS BETWEEN 251 PRECEDING AND CURRENT ROW
        ) AS w52h,
        MIN(low) OVER (
            PARTITION BY equity_id ORDER BY trade_date
            ROWS BETWEEN 251 PRECEDING AND CURRENT ROW
        ) AS w52l,
        MAX(high) OVER (
            PARTITION BY equity_id ORDER BY trade_date
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS lth,
        -- delivery value rolling averages in Crores
        ROUND(AVG(ROUND(
            (COALESCE(value_cr, 0) * COALESCE(delivery_pct, 0) / 100.0)::numeric
        , 4)) OVER (
            PARTITION BY equity_id ORDER BY trade_date
            ROWS BETWEEN 4 PRECEDING AND CURRENT ROW
        ), 4) AS amt5,
        ROUND(AVG(ROUND(
            (COALESCE(value_cr, 0) * COALESCE(delivery_pct, 0) / 100.0)::numeric
        , 4)) OVER (
            PARTITION BY equity_id ORDER BY trade_date
            ROWS BETWEEN 21 PRECEDING AND CURRENT ROW
        ), 4) AS amt22,
        ROUND(AVG(ROUND(
            (COALESCE(value_cr, 0) * COALESCE(delivery_pct, 0) / 100.0)::numeric
        , 4)) OVER (
            PARTITION BY equity_id ORDER BY trade_date
            ROWS BETWEEN 65 PRECEDING AND CURRENT ROW
        ), 4) AS amt66,
        -- d30_pct_chng: pct change vs 22 trading days ago
        ROUND(
            (close - LAG(close, 22) OVER (PARTITION BY equity_id ORDER BY trade_date))
            / NULLIF(LAG(close, 22) OVER (PARTITION BY equity_id ORDER BY trade_date), 0)
            * 100.0
        , 2) AS d30,
        -- price returns
        ROUND(
            (close - LAG(close, 5) OVER (PARTITION BY equity_id ORDER BY trade_date))
            / NULLIF(LAG(close, 5) OVER (PARTITION BY equity_id ORDER BY trade_date), 0)
            * 100.0
        , 2) AS p5d,
        ROUND(
            (close - LAG(close, 22) OVER (PARTITION BY equity_id ORDER BY trade_date))
            / NULLIF(LAG(close, 22) OVER (PARTITION BY equity_id ORDER BY trade_date), 0)
            * 100.0
        , 2) AS p22d,
        ROUND(
            (close - LAG(close, 66) OVER (PARTITION BY equity_id ORDER BY trade_date))
            / NULLIF(LAG(close, 66) OVER (PARTITION BY equity_id ORDER BY trade_date), 0)
            * 100.0
        , 2) AS p66d,
        -- ret columns (same formula, separate alias for scanner display)
        ROUND(
            (close - LAG(close, 5) OVER (PARTITION BY equity_id ORDER BY trade_date))
            / NULLIF(LAG(close, 5) OVER (PARTITION BY equity_id ORDER BY trade_date), 0)
            * 100.0
        , 2) AS ret5d,
        ROUND(
            (close - LAG(close, 22) OVER (PARTITION BY equity_id ORDER BY trade_date))
            / NULLIF(LAG(close, 22) OVER (PARTITION BY equity_id ORDER BY trade_date), 0)
            * 100.0
        , 2) AS ret22d,
        ROUND(
            (close - LAG(close, 66) OVER (PARTITION BY equity_id ORDER BY trade_date))
            / NULLIF(LAG(close, 66) OVER (PARTITION BY equity_id ORDER BY trade_date), 0)
            * 100.0
        , 2) AS ret66d,
        -- breakout_level = rolling 20-bar high of prior close (excluding current bar)
        ROUND(
            MAX(close) OVER (
                PARTITION BY equity_id ORDER BY trade_date
                ROWS BETWEEN 20 PRECEDING AND 1 PRECEDING
            )
        , 2) AS bklevel,
        -- breakdown_level = rolling 20-bar LOW of prior close (mirror of bklevel)
        ROUND(
            MIN(close) OVER (
                PARTITION BY equity_id ORDER BY trade_date
                ROWS BETWEEN 20 PRECEDING AND 1 PRECEDING
            )
        , 2) AS bdlevel,
        -- delivery value in Crores for this bar
        ROUND(
            (COALESCE(value_cr, 0) * COALESCE(delivery_pct, 0) / 100.0)::numeric
        , 4) AS deliv_cr_bar
    FROM eod
), scored AS (
    SELECT
        id,
        trade_date,
        close,
        w52h, w52l, lth,
        amt5, amt22, amt66,
        d30, p5d, p22d, p66d,
        ret5d, ret22d, ret66d,
        bdlevel,
        bklevel,
        deliv_cr_bar,
        CASE WHEN amt22 > 0 THEN ROUND(amt5  / amt22, 4) ELSE NULL END AS surge_x,
        CASE WHEN amt66 > 0 THEN ROUND(amt22 / amt66, 4) ELSE NULL END AS s22d,
        -- score_N = ret_N + max(0, (avg_amt_Nd / baseline - 1) × 100)  if ret_N > 0, else 0
        -- Sectoral family: 5D baseline = avg_amt_22d, 22D baseline = avg_amt_66d
        -- Per Index_Score_Spec_v1.0
        CASE
            WHEN p5d IS NULL OR p5d <= 0 THEN 0
            ELSE ROUND(p5d + GREATEST(0, (amt5 / NULLIF(amt22, 0) - 1) * 100), 2)
        END AS sc5d,
        CASE
            WHEN p22d IS NULL OR p22d <= 0 THEN 0
            ELSE ROUND(p22d + GREATEST(0, (amt22 / NULLIF(amt66, 0) - 1) * 100), 2)
        END AS sc22d,
        CASE WHEN bklevel > 0 THEN ROUND((close - bklevel) / bklevel * 100.0, 2) ELSE NULL END AS pct_from_bk,
        CASE WHEN w52h   > 0 THEN ROUND((w52h  - close)  / w52h   * 100.0, 2) ELSE NULL END AS pct_b52
    FROM base
    {date_filter}
)
UPDATE km_equity_eod e
SET
    w52_high            = s.w52h,
    w52_low             = s.w52l,
    lifetime_high       = s.lth,
    avg_amt_5d          = s.amt5,
    avg_amt_22d         = s.amt22,
    avg_amt_66d         = s.amt66,
    d30_pct_chng        = s.d30,
    delivery_surge_x    = s.surge_x,
    pct_5d              = s.p5d,
    pct_22d             = s.p22d,
    pct_66d             = s.p66d,
    surge_22d           = s.s22d,
    score_5d            = s.sc5d,
    score_22d           = s.sc22d,
    -- Same representability guard, precautionary rather than corrective: these
    -- divide by LAG(close, N), which junk 0.01 bars can make tiny. Max observed
    -- magnitude across the known-bad symbols is 1.48e6 against the column's 1e8
    -- ceiling, so this nulls nothing that exists today and simply removes a
    -- latent UPSERT failure. NUMERIC(10,2), like pct_from_breakdown.
    ret_5d              = CASE WHEN abs(s.ret5d)  < 100000000 THEN s.ret5d  ELSE NULL END,
    ret_22d             = CASE WHEN abs(s.ret22d) < 100000000 THEN s.ret22d ELSE NULL END,
    ret_66d             = CASE WHEN abs(s.ret66d) < 100000000 THEN s.ret66d ELSE NULL END,
    breakout_level      = s.bklevel,
    breakdown_level     = s.bdlevel,
    -- Representability guard: the column is NUMERIC(10,2), so the absolute
    -- value must stay under 1e8. bdlevel is the rolling MIN and therefore the
    -- denominator that can go tiny -- junk BSE bars put a 0.01 close inside the
    -- window while price is orders of magnitude higher, giving ratios past 1e9.
    -- The breakout mirror needs no such guard: its denominator is a MAX.
    pct_from_breakdown  = CASE
                            WHEN s.bdlevel > 0
                             AND abs((s.close - s.bdlevel) / s.bdlevel * 100.0) < 100000000
                            THEN ROUND((s.close - s.bdlevel) / s.bdlevel * 100.0, 2)
                            ELSE NULL END,
    pct_from_breakout   = CASE WHEN abs(s.pct_from_bk) < 100000000 THEN s.pct_from_bk ELSE NULL END,
    pct_below_52w_high  = s.pct_b52,
    deliv_value_cr      = s.deliv_cr_bar
FROM scored s
WHERE e.id = s.id;
"""


def build_sql(from_date: str | None, to_date: str | None):
    """Inject a WHERE clause into the scored CTE when a date range is given."""
    clauses = []
    params = []
    if from_date:
        clauses.append("trade_date >= %s")
        params.append(from_date)
    if to_date:
        clauses.append("trade_date <= %s")
        params.append(to_date)

    if clauses:
        date_filter = "WHERE " + " AND ".join(clauses)
    else:
        date_filter = ""   # full history

    sql = _SQL_TEMPLATE.replace("{date_filter}", date_filter)
    return sql, params


def run_update(from_date: str | None, to_date: str | None):
    sql, params = build_sql(from_date, to_date)

    range_desc = "full history"
    if from_date and to_date:
        range_desc = f"{from_date} → {to_date}"
    elif from_date:
        range_desc = f"{from_date} → latest"
    elif to_date:
        range_desc = f"earliest → {to_date}"

    print(f"\n[update] Single-pass window-function UPDATE — {range_desc}")
    print("  PostgreSQL will sort all equity history once, then sweep all windows.")
    print("  Expected: 10-30 min for full history, <2 min for a tight date range.")
    print("  Progress not printed during the query — please wait...\n")

    t0 = time.time()
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            updated = cur.rowcount
        conn.commit()
        elapsed = time.time() - t0
        print(f"  Done in {elapsed:.0f}s — {updated:,} rows updated.")
        return updated
    except Exception as e:
        conn.rollback()
        raise
    finally:
        conn.close()


def run_verify(target_date: str | None):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            where = "WHERE trade_date = %s" if target_date else ""
            params = [target_date] if target_date else []
            label = target_date or "all dates"

            cur.execute(f"""
                SELECT
                    COUNT(*)                        AS total_rows,
                    COUNT(w52_high)                 AS w52_high,
                    COUNT(avg_amt_5d)               AS avg_amt_5d,
                    COUNT(avg_amt_22d)              AS avg_amt_22d,
                    COUNT(avg_amt_66d)              AS avg_amt_66d,
                    COUNT(score_5d)                 AS score_5d,
                    COUNT(score_22d)                AS score_22d,
                    COUNT(ret_5d)                   AS ret_5d,
                    COUNT(delivery_surge_x)         AS delivery_surge_x
                FROM km_equity_eod {where}
            """, params)
            r = cur.fetchone()

        print(f"\n[verify] {label}")
        print(f"  total_rows       = {r['total_rows']:,}")
        print(f"  w52_high         = {r['w52_high']:,}")
        print(f"  avg_amt_5d       = {r['avg_amt_5d']:,}")
        print(f"  avg_amt_22d      = {r['avg_amt_22d']:,}")
        print(f"  avg_amt_66d      = {r['avg_amt_66d']:,}")
        print(f"  score_5d         = {r['score_5d']:,}")
        print(f"  score_22d        = {r['score_22d']:,}")
        print(f"  ret_5d           = {r['ret_5d']:,}")
        print(f"  delivery_surge_x = {r['delivery_surge_x']:,}")

        total = r['total_rows'] or 1
        null_w52 = total - (r['w52_high'] or 0)
        if null_w52 == 0:
            print(f"\n  ✓ All {total:,} rows have w52_high populated.")
        else:
            pct = null_w52 / total * 100
            print(f"\n  ⚠ {null_w52:,} rows ({pct:.1f}%) still have NULL w52_high.")
            print("    (NULLs expected only on the earliest bars per equity — insufficient look-back)")
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="Fast single-pass rolling metrics backfill for km_equity_eod.",
    )
    parser.add_argument("--from", dest="from_date", metavar="YYYY-MM-DD",
                        help="Start of date range to update")
    parser.add_argument("--to", dest="to_date", metavar="YYYY-MM-DD",
                        help="End of date range to update")
    parser.add_argument("--date", metavar="YYYY-MM-DD",
                        help="Single date (verify only)")
    parser.add_argument("--verify", action="store_true",
                        help="Only verify coverage — no update")
    args = parser.parse_args()

    if args.verify:
        run_verify(args.date or args.from_date)
        return

    run_update(args.from_date, args.to_date)

    # Auto-verify after update using the to_date (or 'all') as sample
    run_verify(args.to_date or args.from_date)


if __name__ == "__main__":
    main()
