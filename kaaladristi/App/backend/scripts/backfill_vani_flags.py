"""
VaNi Flag Backfill
==================
Computes all is_vani_* columns in km_equity_eod for a given date
(or full history) using pure SQL SET expressions — one UPDATE per flag,
no Python row iteration.

Columns updated (is_vani_s2 is skipped — already managed by
backfill_stage_classification.py):

  is_vani_strength   is_vani_breakout   is_vani_surge
  is_vani_flow       is_vani_rs         is_vani_52wh
  is_vani_ath        is_vani_delivery   is_vani_ema20
  is_vani_overbought is_vani_oversold   is_vani_distrib
  is_vani_weakness   is_vani_score5d    is_vani_score22d
  is_vani_hightrade  is_vani_52wl       is_vani_smart

Usage:
    cd App/backend

    # Today only (default)
    python scripts/backfill_vani_flags.py

    # Single date
    python scripts/backfill_vani_flags.py --date 2026-06-03

    # Full history
    python scripts/backfill_vani_flags.py --full

    # Verify counts only (no writes)
    python scripts/backfill_vani_flags.py --verify
"""

import sys
import os
import time
import argparse
from datetime import date

import psycopg2
import psycopg2.extras

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL

# ── Flag definitions ───────────────────────────────────────────────────────
# Each value is a SQL boolean expression referencing km_equity_eod columns.
# All columns referenced must exist in km_equity_eod.
# NULL-safe: use COALESCE or IS NOT NULL guards where a NULL would silently
# evaluate to FALSE (which is acceptable — NULL data → flag stays false).

_FLAG_EXPRS: dict[str, str] = {

    # Strength Confluence — strong RS zone + fresh buying flow + volume + momentum
    'is_vani_strength': """
        magic_rs_zone = 'Strong Bull'
        AND flow_type IN ('FRESH_LONGS', 'SHORT_COVERING')
        AND rvol > 1.5
        AND rsi_14 BETWEEN 50 AND 75
        AND magic_rs > 30
        AND close > sma_150
    """,

    # Fresh Breakout — near 52w high + volume surge + RS positive + not overheated
    'is_vani_breakout': """
        rvol > 3.0
        AND close > sma_150
        AND rsi_14 BETWEEN 50 AND 78
        AND magic_rs > 20
        AND w52_high IS NOT NULL
        AND close >= w52_high * 0.95
    """,

    # Breakout Surge — AT the 52w high + extreme volume + not parabolic
    'is_vani_surge': """
        rvol > 5.0
        AND w52_high IS NOT NULL
        AND close >= w52_high * 0.95
        AND rsi_14 < 78
        AND magic_rs > 0
        AND close > sma_50
    """,

    # Conviction Flow — delivery surge above 22d norm + consolidating near EMA20
    'is_vani_flow': """
        delivery_surge_x > 2.0
        AND avg_amt_22d > 1.5
        AND ema_20 IS NOT NULL
        AND close >= ema_20 * 0.97
        AND close <= ema_20 * 1.08
        AND close > 100
        AND magic_rs > 0
    """,

    # RS Leaders — top RS + strong zone + supertrend confirmed
    'is_vani_rs': """
        magic_rs > 80
        AND rvol > 1.5
        AND rsi_14 BETWEEN 50 AND 80
        AND supertrend_dir = 1
        AND magic_rs_zone = 'Strong Bull'
    """,

    # 52-Week High — AT or within 2% of 52w high + volume
    'is_vani_52wh': """
        w52_high IS NOT NULL
        AND close >= w52_high * 0.98
        AND rvol > 1.5
        AND magic_rs > 20
        AND close > sma_50
    """,

    # Multi-Year / All-Time High — within 1% of lifetime high + volume
    'is_vani_ath': """
        lifetime_high IS NOT NULL
        AND lifetime_high > 0
        AND close >= lifetime_high * 0.99
        AND rvol > 1.5
        AND magic_rs > 20
        AND rsi_14 BETWEEN 45 AND 80
    """,

    # High Delivery — delivery surge + delivery % high + near EMA20
    'is_vani_delivery': """
        delivery_surge_x > 2.5
        AND delivery_pct > 50
        AND ema_20 IS NOT NULL
        AND close >= ema_20 * 0.97
        AND close <= ema_20 * 1.08
        AND magic_rs > 0
    """,

    # EMA20 Accumulation — hugging EMA20 + rising delivery + uptrend structure
    'is_vani_ema20': """
        ema_20 IS NOT NULL
        AND close >= ema_20 * 0.98
        AND close <= ema_20 * 1.05
        AND avg_amt_5d > avg_amt_22d * 1.5
        AND close > sma_150
        AND magic_rs > 0
        AND supertrend_dir = 1
    """,

    # Overbought + Volume — RSI hot + volume spike + distribution signal
    'is_vani_overbought': """
        rsi_14 > 78
        AND rvol > 2.5
        AND dot_syd = true
        AND magic_rs_zone IN ('Strong Bull', 'Mild Bull')
    """,

    # Oversold + Volume — RSI washed out + volume spike + still above 200
    'is_vani_oversold': """
        rsi_14 < 28
        AND rvol > 2.0
        AND (dot_svd = true OR dot_sbd = true)
        AND close > sma_200
    """,

    # Distribution Warning — SYD signal + volume divergence + negative RS
    'is_vani_distrib': """
        dot_syd = true
        AND volume_divergence_flag = 'VOLUME_DIV_DOWN'
        AND magic_rs < 0
        AND rvol > 1.5
    """,

    # Weakness Confluence — bear zone + short flow + volume
    'is_vani_weakness': """
        magic_rs_zone IN ('Strong Bear', 'Mild Bear')
        AND flow_type IN ('FRESH_SHORTS', 'LONG_LIQUIDATION')
        AND rvol > 1.5
        AND magic_rs < -10
    """,

    # Score 5D — composite momentum: RS + volume + RSI + smart money
    'is_vani_score5d': """
        (magic_rs * 0.35 + rvol * 10 * 0.25 + rsi_14 * 0.20 + sniper_inst * 0.20) > 70
        AND close > sma_50
        AND supertrend_dir = 1
    """,

    # Score 22D — medium-term momentum: RS + RSS + price vs MA + d30 return
    'is_vani_score22d': """
        magic_rs > 20
        AND rss_value > 60
        AND close > sma_150
        AND d30_pct_chng > 5
        AND supertrend_dir = 1
    """,

    # High Trade Value — extreme volume in value terms + uptrend
    'is_vani_hightrade': """
        rvol > 3.0
        AND value_cr > 50
        AND magic_rs > 0
        AND supertrend_dir = 1
    """,

    # 52-Week Low — at the low + volume spike + potential reversal signal
    'is_vani_52wl': """
        w52_low IS NOT NULL
        AND close <= w52_low * 1.05
        AND rvol > 2.0
        AND (dot_svd = true OR dot_sbd = true)
    """,

    # Smart Money Loading — high institutional proxy + RSS momentum
    'is_vani_smart': """
        sniper_inst > 40
        AND rss_value > 70
        AND magic_rs > 20
        AND rvol > 1.5
    """,
}


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(DATABASE_URL, connect_timeout=30)


# ── Core update ────────────────────────────────────────────────────────────

def _update_flags_for_date(conn, target_date: str, verbose: bool = False) -> int:
    """Run one UPDATE per flag for a single trade_date. Returns total rows updated."""
    total_updated = 0

    with conn.cursor() as cur:
        for col, expr in _FLAG_EXPRS.items():
            sql = f"""
                UPDATE km_equity_eod
                SET {col} = (
                    {expr.strip()}
                )
                WHERE trade_date = %s
            """
            cur.execute(sql, [target_date])
            n = cur.rowcount
            total_updated = max(total_updated, n)   # all flags update same rows
            if verbose:
                # Count how many were set to TRUE
                cur.execute(
                    f"SELECT COUNT(*) FROM km_equity_eod "
                    f"WHERE trade_date = %s AND {col} = true",
                    [target_date],
                )
                true_count = cur.fetchone()[0]
                print(f"    {col:<22} → {true_count:>5} true / {n:>5} rows")

    conn.commit()
    return total_updated


# ── Date-range helpers ─────────────────────────────────────────────────────

def _get_all_trade_dates(conn) -> list[str]:
    with conn.cursor() as cur:
        cur.execute("""
            SELECT DISTINCT trade_date FROM km_equity_eod
            ORDER BY trade_date
        """)
        return [str(r[0]) for r in cur.fetchall()]


def _get_latest_date(conn) -> str:
    with conn.cursor() as cur:
        cur.execute("SELECT MAX(trade_date) FROM km_equity_eod")
        return str(cur.fetchone()[0])


# ── Verification ──────────────────────────────────────────────────────────

def verify(conn, target_date: str = None):
    if not target_date:
        target_date = _get_latest_date(conn)

    print(f"\n[verify] trade_date = {target_date}")
    with conn.cursor() as cur:
        cols = ', '.join(
            f"SUM(CASE WHEN {col} THEN 1 ELSE 0 END) AS {col}" for col in _FLAG_EXPRS
        )
        # is_vani_s2 is owned by backfill_stage_classification.py — shown here
        # for reference only, never written by this script.
        cur.execute(f"""
            SELECT
                COUNT(*) AS total_rows,
                SUM(CASE WHEN is_vani_s2 THEN 1 ELSE 0 END) AS is_vani_s2__readonly,
                {cols}
            FROM km_equity_eod
            WHERE trade_date = %s
        """, [target_date])
        row = cur.fetchone()
        desc = [d[0] for d in cur.description]

    total = row[0]
    print(f"  total_rows : {total:,}")
    for col, val in zip(desc[1:], row[1:]):
        bar = '█' * min(int((val or 0) / max(total, 1) * 50), 50)
        print(f"  {col:<25} {val or 0:>5}  {bar}")


# ── NULL column diagnostic ────────────────────────────────────────────────

def diagnose_nulls(conn, target_date: str):
    """Report fill rates for columns that VaNi flags depend on."""
    print(f"\n[diagnose] NULL check for trade_date = {target_date}")
    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                COUNT(*)               AS total,
                COUNT(w52_high)        AS w52_high,
                COUNT(w52_low)         AS w52_low,
                COUNT(lifetime_high)   AS lifetime_high,
                COUNT(ema_20)          AS ema_20,
                COUNT(sma_50)          AS sma_50,
                COUNT(sma_150)         AS sma_150,
                COUNT(sma_200)         AS sma_200,
                COUNT(supertrend_dir)  AS supertrend_dir,
                COUNT(delivery_surge_x) AS delivery_surge_x,
                COUNT(delivery_pct)    AS delivery_pct,
                COUNT(magic_rs)        AS magic_rs,
                COUNT(magic_rs_zone)   AS magic_rs_zone,
                COUNT(rss_value)       AS rss_value,
                COUNT(sniper_inst)     AS sniper_inst,
                COUNT(rvol)            AS rvol,
                COUNT(rsi_14)          AS rsi_14,
                COUNT(flow_type)       AS flow_type,
                COUNT(dot_svd)         AS dot_svd,
                COUNT(dot_sbd)         AS dot_sbd,
                COUNT(dot_syd)         AS dot_syd,
                COUNT(volume_divergence_flag) AS volume_div_flag,
                COUNT(value_cr)        AS value_cr
            FROM km_equity_eod
            WHERE trade_date = %s
        """, [target_date])
        row = cur.fetchone()
        desc = [d[0] for d in cur.description]

    total = row[0]
    print(f"  total rows : {total:,}")
    print(f"\n  {'Column':<25} {'Filled':>7}  {'Null':>7}  {'%':>6}")
    print(f"  {'-'*25} {'-'*7}  {'-'*7}  {'-'*6}")
    for col, filled in zip(desc[1:], row[1:]):
        filled = filled or 0
        null   = total - filled
        pct    = filled / total * 100 if total else 0
        flag   = '' if filled == total else '  ← NULL'
        print(f"  {col:<25} {filled:>7,}  {null:>7,}  {pct:>5.1f}%{flag}")


# ── Pipeline entry point ──────────────────────────────────────────────────

def compute_vani_flags_for_date(db_conn, trade_date, verbose=False) -> int:
    """Called from daily_pipeline.py step 6j.
    Opens its own psycopg2 connection — db_conn is accepted but unused
    (PgClient from daily_pipeline doesn't support cursor()/commit()).
    """
    conn = get_conn()
    try:
        return _update_flags_for_date(conn, str(trade_date), verbose=verbose)
    finally:
        conn.close()


# ── CLI ───────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--date',     default='', help='Single date YYYY-MM-DD')
    parser.add_argument('--full',     action='store_true', help='All history')
    parser.add_argument('--verify',   action='store_true', help='Counts only, no writes')
    parser.add_argument('--diagnose', action='store_true', help='NULL column fill-rate report')
    args = parser.parse_args()

    conn = get_conn()
    try:
        if args.diagnose:
            target = args.date or _get_latest_date(conn)
            diagnose_nulls(conn, target)
            return

        if args.verify:
            verify(conn, args.date or None)
            return

        if args.full:
            dates = _get_all_trade_dates(conn)
            print(f"[full] Processing {len(dates)} trade dates...")
            t0 = time.time()
            for i, dt in enumerate(dates):
                _update_flags_for_date(conn, dt, verbose=False)
                if (i + 1) % 50 == 0 or (i + 1) == len(dates):
                    pct = (i + 1) / len(dates) * 100
                    elapsed = time.time() - t0
                    eta = elapsed / (i + 1) * (len(dates) - i - 1)
                    print(f"  {i+1}/{len(dates)} ({pct:.0f}%) — {elapsed:.0f}s elapsed, ~{eta:.0f}s remaining")
            print(f"\n[full] Done in {time.time() - t0:.0f}s")
        else:
            target = args.date or str(date.today())
            # Resolve 'today' to actual latest trade date if no rows for today
            conn2 = get_conn()
            try:
                latest = _get_latest_date(conn2)
            finally:
                conn2.close()
            if not args.date:
                target = latest
                print(f"[today] Using latest trade date: {target}")
            else:
                print(f"[date] Processing {target}")

            print(f"  Updating {len(_FLAG_EXPRS)} VaNi flags...")
            n = _update_flags_for_date(conn, target, verbose=True)
            print(f"\n  Updated {n:,} rows")

        # Always verify the latest date after a run
        if not args.full:
            verify(conn, args.date or None)
        else:
            verify(conn, None)  # latest date only

    finally:
        conn.close()


if __name__ == '__main__':
    main()
