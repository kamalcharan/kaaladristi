"""
Rolling Metrics Backfill — pure SQL, no Python import chain
=============================================================
Computes all rolling/score columns for km_equity_eod via PostgreSQL
window functions. No dependency on compute_engine.py or indicators package.

Columns written:
  w52_high, w52_low, lifetime_high
  avg_amt_5d, avg_amt_22d, avg_amt_66d  (delivery value in Crores)
  d30_pct_chng, delivery_surge_x
  pct_5d, pct_22d, pct_66d
  surge_22d, score_5d, score_22d
  ret_5d, ret_22d, ret_66d
  breakout_level, pct_from_breakout, pct_below_52w_high
  deliv_value_cr

Usage:
    cd App/backend
    python scripts/backfill_rolling_metrics.py --date 2026-06-03
    python scripts/backfill_rolling_metrics.py --date 2026-06-03 --verify
"""

import sys
import os
import argparse
import psycopg2
import psycopg2.extras
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(DATABASE_URL, connect_timeout=30)


def verify(target_date: str):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    COUNT(*)                    AS total_rows,
                    COUNT(w52_high)             AS w52_high_count,
                    COUNT(avg_amt_5d)           AS avg_amt_5d_count,
                    COUNT(avg_amt_22d)          AS avg_amt_22d_count,
                    COUNT(avg_amt_66d)          AS avg_amt_66d_count,
                    COUNT(d30_pct_chng)         AS d30_count,
                    COUNT(delivery_surge_x)     AS surge_x_count,
                    COUNT(pct_5d)               AS pct_5d_count,
                    COUNT(pct_22d)              AS pct_22d_count,
                    COUNT(pct_66d)              AS pct_66d_count,
                    COUNT(surge_22d)            AS surge_22d_count,
                    COUNT(score_5d)             AS score_5d_count,
                    COUNT(score_22d)            AS score_22d_count,
                    COUNT(ret_5d)               AS ret_5d_count,
                    COUNT(ret_22d)              AS ret_22d_count,
                    COUNT(ret_66d)              AS ret_66d_count,
                    COUNT(breakout_level)       AS breakout_level_count,
                    COUNT(pct_from_breakout)    AS pct_from_breakout_count,
                    COUNT(pct_below_52w_high)   AS pct_below_52w_high_count,
                    COUNT(deliv_value_cr)       AS deliv_value_cr_count
                FROM km_equity_eod
                WHERE trade_date = %s
            """, [target_date])
            row = cur.fetchone()
            (total, w52h, amt5, amt22, amt66, d30, surge_x,
             p5d, p22d, p66d, s22d, sc5d, sc22d,
             r5d, r22d, r66d, bklvl, pct_bk, pct_b52, deliv_cr) = row
            print(f"\n[verify] trade_date = {target_date}")
            print(f"  total_rows          = {total}")
            print(f"  w52_high            = {w52h}")
            print(f"  avg_amt_5d          = {amt5}")
            print(f"  avg_amt_22d         = {amt22}")
            print(f"  avg_amt_66d         = {amt66}")
            print(f"  d30_pct_chng        = {d30}")
            print(f"  delivery_surge_x    = {surge_x}")
            print(f"  pct_5d              = {p5d}")
            print(f"  pct_22d             = {p22d}")
            print(f"  pct_66d             = {p66d}")
            print(f"  surge_22d           = {s22d}")
            print(f"  score_5d            = {sc5d}")
            print(f"  score_22d           = {sc22d}")
            print(f"  ret_5d              = {r5d}")
            print(f"  ret_22d             = {r22d}")
            print(f"  ret_66d             = {r66d}")
            print(f"  breakout_level      = {bklvl}")
            print(f"  pct_from_breakout   = {pct_bk}")
            print(f"  pct_below_52w_high  = {pct_b52}")
            print(f"  deliv_value_cr      = {deliv_cr}")
            if total and w52h and total == w52h:
                print(f"\n✓ All {total} rows populated correctly.")
            else:
                print(f"\n⚠ {(total or 0) - (w52h or 0)} rows still have NULL w52_high.")
    finally:
        conn.close()


def run_update(target_date: str):
    """
    UPDATE km_equity_eod for target_date using window functions over full history.

    avg_amt formula: delivery value in Crores = value_cr (Rs) / 1e7 * delivery_pct / 100
    Matches the nightly pipeline in compute_engine.py (compute_rolling_range).

    score_5d/22d logic mirrors migration 111 SQL exactly.
    """
    sql = """
WITH base AS (
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
        -- value_cr (Rs) / 1e7 * delivery_pct / 100 = delivery Cr per bar
        ROUND(AVG(ROUND(
            (COALESCE(value_cr, 0) / 10000000.0 * COALESCE(delivery_pct, 0) / 100.0)::numeric
        , 4)) OVER (
            PARTITION BY equity_id ORDER BY trade_date
            ROWS BETWEEN 4 PRECEDING AND CURRENT ROW
        ), 4) AS amt5,
        ROUND(AVG(ROUND(
            (COALESCE(value_cr, 0) / 10000000.0 * COALESCE(delivery_pct, 0) / 100.0)::numeric
        , 4)) OVER (
            PARTITION BY equity_id ORDER BY trade_date
            ROWS BETWEEN 21 PRECEDING AND CURRENT ROW
        ), 4) AS amt22,
        ROUND(AVG(ROUND(
            (COALESCE(value_cr, 0) / 10000000.0 * COALESCE(delivery_pct, 0) / 100.0)::numeric
        , 4)) OVER (
            PARTITION BY equity_id ORDER BY trade_date
            ROWS BETWEEN 65 PRECEDING AND CURRENT ROW
        ), 4) AS amt66,
        -- d30_pct_chng: % change vs 22 trading days ago
        ROUND(
            (close - LAG(close, 22) OVER (PARTITION BY equity_id ORDER BY trade_date))
            / NULLIF(LAG(close, 22) OVER (PARTITION BY equity_id ORDER BY trade_date), 0)
            * 100.0
        , 2) AS d30,
        -- price returns (pct_change(N) = change from N bars ago)
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
        -- ret_5d / ret_22d / ret_66d (same formula, separate columns for scanner display)
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
        -- deliv_value_cr = delivery value in Crores for this bar
        ROUND(
            (COALESCE(value_cr, 0) / 10000000.0 * COALESCE(delivery_pct, 0) / 100.0)::numeric
        , 4) AS deliv_cr_bar
    FROM km_equity_eod
), scored AS (
    SELECT
        id,
        trade_date,
        close,
        w52h, w52l, lth,
        amt5, amt22, amt66,
        d30, p5d, p22d, p66d,
        ret5d, ret22d, ret66d,
        bklevel,
        deliv_cr_bar,
        -- delivery_surge_x = avg_amt_5d / avg_amt_22d
        CASE WHEN amt22 > 0 THEN ROUND(amt5 / amt22, 4) ELSE NULL END AS surge_x,
        -- surge_22d = avg_amt_22d / avg_amt_66d
        CASE WHEN amt66 > 0 THEN ROUND(amt22 / amt66, 4) ELSE NULL END AS s22d,
        -- score_5d
        CASE
            WHEN amt5  IS NULL OR amt22 IS NULL OR amt22 = 0 THEN NULL
            WHEN p5d   IS NULL OR p5d  <= 0                  THEN 0
            WHEN amt5 / amt22 < 1.0                          THEN ROUND(p5d, 2)
            ELSE ROUND(POWER(amt5 / amt22, 2) * 25, 2)
        END AS sc5d,
        -- score_22d
        CASE
            WHEN amt22 IS NULL OR amt66 IS NULL OR amt66 = 0 THEN NULL
            WHEN p22d  IS NULL OR p22d <= 0                  THEN 0
            WHEN amt22 / amt66 < 1.0                         THEN ROUND(p22d, 2)
            ELSE ROUND(POWER(amt22 / amt66, 2) * 25, 2)
        END AS sc22d,
        -- pct_from_breakout = (close - breakout_level) / breakout_level * 100
        CASE WHEN bklevel > 0 THEN ROUND((close - bklevel) / bklevel * 100.0, 2) ELSE NULL END AS pct_from_bk,
        -- pct_below_52w_high = (w52h - close) / w52h * 100
        CASE WHEN w52h > 0 THEN ROUND((w52h - close) / w52h * 100.0, 2) ELSE NULL END AS pct_b52
    FROM base
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
    ret_5d              = s.ret5d,
    ret_22d             = s.ret22d,
    ret_66d             = s.ret66d,
    breakout_level      = s.bklevel,
    pct_from_breakout   = s.pct_from_bk,
    pct_below_52w_high  = s.pct_b52,
    deliv_value_cr      = s.deliv_cr_bar
FROM scored s
WHERE e.id = s.id
  AND s.trade_date = %s
"""
    print(f"\n[update] Running window-function UPDATE for {target_date}...")
    print("  (scans full history — may take 30-90 seconds)")
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, [target_date])
            updated = cur.rowcount
        conn.commit()
        print(f"  Updated {updated} rows.")
        return updated
    finally:
        conn.close()


def compute_rolling_metrics_for_date(db_conn, trade_date, verbose=False) -> int:
    """Pipeline entry point. Pure SQL — no indicators.calculators dependency.
    db_conn is accepted but unused (opens its own psycopg2 connection).
    """
    n = run_update(str(trade_date))
    if verbose:
        print(f"  [rolling_metrics] {n} rows updated for {trade_date}")
    return n


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--date', default=str(date.today()), help='Trade date YYYY-MM-DD (default: today)')
    parser.add_argument('--verify', action='store_true', help='Only verify, no update')
    args = parser.parse_args()

    target_date = args.date

    if args.verify:
        verify(target_date)
        return

    verify(target_date)   # before
    run_update(target_date)
    verify(target_date)   # after


if __name__ == '__main__':
    main()
