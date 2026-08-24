"""
Dormancy Metrics Compute (Waking Giants / First Ascent — step 2)
=================================================================
Populates km_equity_symbols dormancy columns (migration 173) from
CLIFF-ADJUSTED closes:

    high_3y_adj · low_3y_adj · pct_from_3y_high · days_since_3y_high
    · dormancy_updated_at

Why cliff-adjusted: km_corporate_actions is empty, so raw bhavcopy
closes carry split/bonus cliffs. A 1:1 bonus halves the price overnight
— unadjusted, the stock reads "−50% from its 3-yr high" forever, faking
exactly the dormancy signature this gate looks for. We reuse
lib/breadth_common.adjust_close_cliffs (the D44 breadth fix): any 1-day
move <0.55× or >1.80× is a corporate action (NSE price bands cap real
moves at ±20%), and history is back-adjusted onto the current price
scale.

The dormancy DECISION (which thresholds make a stock "dormant") is NOT
made here — it belongs in the step-4 matview as named constants. This
script measures the facts and ends with a calibration report: the
Giants / First Ascent gate funnel at candidate thresholds, so the
constants are set from live distributions (house rule: calibrate before
shipping).

Usage:
    cd App/backend
    python scripts/compute_dormancy.py             # compute + write + report
    python scripts/compute_dormancy.py --dry-run   # compute + report only

Cadence: Waking Giants is a weekly-cadence scanner; re-run weekly (or
wire compute_dormancy_for_pipeline into pipeline2 at step 4).
"""

import argparse
import os
import sys
from datetime import date

import pandas as pd
import psycopg2
import psycopg2.extras

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL
from lib.breadth_common import adjust_close_cliffs

# 3 trading years ≈ 756 sessions; load a hair over 3 calendar years so
# the window genuinely spans 3y of sessions after holidays.
WINDOW_CALENDAR_DAYS = 1130

# Below this many bars in the window the 3-yr stats are not meaningful
# (recently relisted / long-suspended names). They get NULLs and fall
# out of the dormancy gate — correct: we can't call a stock "dormant
# for years" without years of prints.
MIN_BARS = 150


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(DATABASE_URL, connect_timeout=30)


def load_window_closes(conn) -> pd.DataFrame:
    """NSE closes for the trailing window, pivoted date × equity_id.
    (lib.breadth_common.load_closes loads ALL history — 26 years — which
    is needless weight here; this is the same shape, windowed.)"""
    sql = """
        SELECT e.trade_date, e.equity_id, e.close
        FROM   km_equity_eod e
        JOIN   km_equity_symbols s ON s.id = e.equity_id
        WHERE  s.exchange = 'NSE'
          AND  s.is_active = TRUE
          AND  e.close IS NOT NULL AND e.close > 0
          AND  e.trade_date >= CURRENT_DATE - INTERVAL '%s days'
        ORDER  BY e.trade_date
    """ % WINDOW_CALENDAR_DAYS
    with conn.cursor() as cur:
        cur.execute(sql)
        rows = cur.fetchall()
    if not rows:
        raise RuntimeError('No NSE EOD rows in the dormancy window.')
    df = pd.DataFrame(rows, columns=['trade_date', 'equity_id', 'close'])
    df['trade_date'] = pd.to_datetime(df['trade_date'])
    df['close'] = df['close'].astype(float)
    pivot = df.pivot(index='trade_date', columns='equity_id', values='close').sort_index()
    print(f'  Loaded {len(pivot.columns):,} active NSE stocks × {len(pivot):,} sessions')
    return pivot


def compute_metrics(closes: pd.DataFrame) -> list[tuple]:
    """Per stock: (high_3y, low_3y, pct_from_high, days_since_high, id).
    Tuple order matches the UPDATE statement."""
    today = date.today()
    out = []
    skipped_thin = 0
    for equity_id in closes.columns:
        s = closes[equity_id].dropna()
        if len(s) < MIN_BARS:
            skipped_thin += 1
            continue
        high = float(s.max())
        low = float(s.min())
        last = float(s.iloc[-1])
        if high <= 0:
            skipped_thin += 1
            continue
        pct_from_high = (last / high - 1.0) * 100.0
        pct_from_high = max(-999.99, min(999.99, pct_from_high))
        days_since_high = (s.index[-1] - s.idxmax()).days
        out.append((
            round(high, 2), round(low, 2), round(pct_from_high, 2),
            int(days_since_high), today, int(equity_id),
        ))
    if skipped_thin:
        print(f'  Skipped {skipped_thin} stocks with < {MIN_BARS} bars in window (stay NULL)')
    return out


CALIBRATION_SQL = """
WITH pool AS (
  SELECT s.id, s.pct_from_3y_high, s.days_since_3y_high,
         s.high_3y_adj / NULLIF(s.low_3y_adj, 0) AS range_ratio,
         EXTRACT(YEAR FROM AGE(CURRENT_DATE, s.listing_date)) AS age_yr
  FROM km_equity_symbols s
  WHERE s.is_active AND s.exchange = 'NSE' AND s.listing_date IS NOT NULL
    AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, s.listing_date)) >= 6
    AND s.mcap_cr >= 200
    AND s.pct_from_3y_high IS NOT NULL
),
adv AS (
  SELECT equity_id, AVG(close * volume) / 1e7 AS adv_cr
  FROM (
    SELECT equity_id, close, volume,
           ROW_NUMBER() OVER (PARTITION BY equity_id ORDER BY trade_date DESC) AS rn
    FROM km_equity_eod
    WHERE trade_date >= CURRENT_DATE - INTERVAL '60 days'
  ) t WHERE rn <= 22 GROUP BY equity_id
),
m AS (
  SELECT p.*,
         CASE WHEN p.age_yr >= 10 THEN 'Giants 10y+' ELSE 'First Ascent 6-10y' END AS band
  FROM pool p JOIN adv a ON a.equity_id = p.id AND a.adv_cr >= 1
)
SELECT band,
  COUNT(*) AS pool_after_adv,
  COUNT(*) FILTER (WHERE pct_from_3y_high <= -40) AS deep40,
  COUNT(*) FILTER (WHERE pct_from_3y_high <= -50) AS deep50,
  COUNT(*) FILTER (WHERE pct_from_3y_high <= -60) AS deep60,
  COUNT(*) FILTER (WHERE pct_from_3y_high <= -50 AND days_since_3y_high >= 365) AS deep50_oldhigh,
  COUNT(*) FILTER (WHERE pct_from_3y_high <= -60 AND days_since_3y_high >= 365) AS deep60_oldhigh,
  COUNT(*) FILTER (WHERE pct_from_3y_high > -40 AND range_ratio <= 1.8) AS flat_not_deep,
  COUNT(*) FILTER (WHERE (pct_from_3y_high <= -50 AND days_since_3y_high >= 365)
                      OR (pct_from_3y_high > -40 AND range_ratio <= 1.8)) AS candidate_gate
FROM m GROUP BY band ORDER BY band
"""


def print_calibration(conn):
    """The step-4 constants get set from this table, not from guesses.
    candidate_gate = (≤ −50% from an ≥1-yr-old 3-yr high) OR (3-yr
    range ratio ≤ 1.8 — long flat range that never crashed)."""
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(CALIBRATION_SQL)
        rows = cur.fetchall()
    print('\nDormancy calibration (age + mcap ≥ ₹200 Cr + ADV ≥ ₹1 Cr pool, cliff-adjusted):')
    if not rows:
        print('  (no rows — run the compute first)')
        return
    cols = list(rows[0].keys())
    print('  ' + '  '.join(f'{c:>16}' for c in cols))
    for r in rows:
        print('  ' + '  '.join(f'{str(r[c]):>16}' for c in cols))
    print('  candidate_gate = deep50_oldhigh OR flat_not_deep — target ~100-150 Giants (audit §6b)')


def run(dry_run: bool):
    conn = get_conn()
    print('Compute Dormancy Metrics (3-yr, cliff-adjusted)')
    print('=' * 50)
    closes = load_window_closes(conn)
    closes = adjust_close_cliffs(closes)
    updates = compute_metrics(closes)
    print(f'  Computed metrics for {len(updates):,} stocks')

    if dry_run:
        print('  (dry run — nothing written)')
    else:
        with conn.cursor() as cur:
            psycopg2.extras.execute_batch(
                cur,
                """UPDATE km_equity_symbols
                   SET high_3y_adj = %s, low_3y_adj = %s,
                       pct_from_3y_high = %s, days_since_3y_high = %s,
                       dormancy_updated_at = %s
                   WHERE id = %s""",
                updates, page_size=1000,
            )
        conn.commit()
        print(f'  ✓ {len(updates):,} rows updated')
        print_calibration(conn)
    conn.close()


# ── pipeline2 entry point (wire into orchestrator at step 4) ─────────────

def compute_dormancy_for_pipeline(conn_unused, trade_date, force: bool = False) -> tuple[int, str]:
    conn = get_conn()
    try:
        closes = adjust_close_cliffs(load_window_closes(conn))
        updates = compute_metrics(closes)
        with conn.cursor() as cur:
            psycopg2.extras.execute_batch(
                cur,
                """UPDATE km_equity_symbols
                   SET high_3y_adj = %s, low_3y_adj = %s,
                       pct_from_3y_high = %s, days_since_3y_high = %s,
                       dormancy_updated_at = %s
                   WHERE id = %s""",
                updates, page_size=1000,
            )
        conn.commit()
        return len(updates), 'completed'
    finally:
        conn.close()


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description='Compute cliff-adjusted 3-yr dormancy metrics (NSE).')
    ap.add_argument('--dry-run', action='store_true', help='Compute and report, no DB writes.')
    args = ap.parse_args()
    run(dry_run=args.dry_run)
