"""
Stage Classification Backfill
==============================
Computes sma200_rising, stage, is_vani_s2 for every row in km_equity_eod.

Stage logic (Weinstein):
  S2           — close > sma_50 > sma_200, sma200_rising, w52 gates, close > 30
  S2_CANDIDATE — close > sma_50 > sma_200, close > 30  (but missing S2 extras)
  S1           — close near sma_200 (within 5%), sma200 NOT rising
  S3           — close > sma_200 but sma_50 converging toward sma_200
  S4           — close < sma_200
  NULL         — insufficient data (sma_200 not yet computed)

is_vani_s2 (only when stage='S2'):
  magic_rs > 40 AND rvol > 1.5 AND rsi_14 BETWEEN 50 AND 80
  AND close / lifetime_high >= 0.75 AND close / w52_high >= 0.85

Usage:
    cd App/backend
    python scripts/backfill_stage_classification.py           # full history
    python scripts/backfill_stage_classification.py --verify  # just verify, no write
    python scripts/backfill_stage_classification.py --date 2026-06-03  # single date only

For nightly pipeline use compute_stage_for_date() directly.
"""

import sys
import os
import time
import psycopg2
import psycopg2.extras
from collections import defaultdict

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL

BATCH_SIZE = 5000
SMA200_SLOPE_BARS = 20          # bars back to compare sma_200 for rising check
STAGE1_PROXIMITY_PCT = 0.05     # within 5% of sma_200 → Stage 1 candidate
S3_SMA50_CONVERGENCE_PCT = 0.15 # sma_50 within 15% of sma_200 → converging


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(DATABASE_URL, connect_timeout=30)


# ── Classification logic ───────────────────────────────────────────────────

def _to_f(v):
    """Safe float conversion — returns None on NULL/NaN."""
    if v is None:
        return None
    try:
        f = float(v)
        return None if (f != f) else f  # NaN check
    except (TypeError, ValueError):
        return None


def classify_bar(close, sma_50, sma_200, sma200_rising,
                 w52_high, w52_low, lifetime_high,
                 magic_rs, rvol, rsi_14):
    """
    Returns (stage: str|None, is_vani_s2: bool).
    All inputs already float or None.
    """
    if sma_200 is None or close is None:
        return None, False

    # ── S2 ──
    s2_core = (
        sma_50 is not None
        and close > sma_50
        and sma_50 > sma_200
        and close > sma_200
        and close > 30
    )
    s2_gates = (
        sma200_rising is True
        and w52_low is not None and w52_low > 0
        and w52_high is not None and w52_high > 0
        and w52_low * 1.25 <= close
        and w52_high * 0.75 <= close
    )
    if s2_core and s2_gates:
        # is_vani_s2
        is_vani = (
            magic_rs is not None and magic_rs > 40
            and rvol is not None and rvol > 1.5
            and rsi_14 is not None and 50 <= rsi_14 <= 80
            and lifetime_high is not None and lifetime_high > 0
            and close / lifetime_high >= 0.75
            and w52_high is not None and w52_high > 0
            and close / w52_high >= 0.85
        )
        return 'S2', is_vani

    # ── S2_CANDIDATE ──
    if s2_core:
        return 'S2_CANDIDATE', False

    # ── S4 ──
    if close < sma_200:
        return 'S4', False

    # close >= sma_200 from here down

    # ── S1 — price hugging sma_200, MA flat ──
    if sma200_rising is False:
        proximity = abs(close - sma_200) / sma_200
        if proximity <= STAGE1_PROXIMITY_PCT:
            return 'S1', False

    # ── S3 — sma_50 converging toward sma_200 ──
    if sma_50 is not None and sma_200 > 0:
        gap_pct = (sma_50 - sma_200) / sma_200
        if gap_pct < S3_SMA50_CONVERGENCE_PCT:
            return 'S3', False

    # ── default above sma_200 but unclassified → S3 ──
    return 'S3', False


def process_equity(rows):
    """
    rows: list of dicts sorted ASC by trade_date for one equity_id.
    Returns list of (id, sma200_rising, stage, is_vani_s2).
    """
    sma200_history = []
    results = []

    for row in rows:
        close       = _to_f(row['close'])
        sma_50      = _to_f(row['sma_50'])
        sma_200     = _to_f(row['sma_200'])
        w52_high    = _to_f(row['w52_high'])
        w52_low     = _to_f(row['w52_low'])
        lifetime_h  = _to_f(row['lifetime_high'])
        magic_rs    = _to_f(row['magic_rs'])
        rvol        = _to_f(row['rvol'])
        rsi_14      = _to_f(row['rsi_14'])

        sma200_history.append(sma_200)

        # Compute sma200_rising
        rising = None
        if len(sma200_history) > SMA200_SLOPE_BARS:
            past = sma200_history[-(SMA200_SLOPE_BARS + 1)]
            if sma_200 is not None and past is not None:
                rising = sma_200 > past

        stage, is_vani = classify_bar(
            close, sma_50, sma_200, rising,
            w52_high, w52_low, lifetime_h,
            magic_rs, rvol, rsi_14,
        )

        results.append((row['id'], rising, stage, is_vani))

    return results


def flush_batch(conn, batch):
    sql = """
        UPDATE km_equity_eod
        SET sma200_rising = data.rising::boolean,
            stage         = data.stage,
            is_vani_s2    = data.is_vani::boolean
        FROM (VALUES %s) AS data(row_id, rising, stage, is_vani)
        WHERE km_equity_eod.id = data.row_id::int
    """
    with conn.cursor() as cur:
        psycopg2.extras.execute_values(cur, sql, batch, template="(%s, %s, %s, %s)")
    conn.commit()


# ── Full backfill ─────────────────────────────────────────────────────────

def run_full_backfill(verbose=True):
    conn = get_conn()
    t0 = time.time()

    if verbose:
        print('Fetching all equity_ids...')

    with conn.cursor() as cur:
        cur.execute('SELECT DISTINCT equity_id FROM km_equity_eod ORDER BY equity_id')
        equity_ids = [r[0] for r in cur.fetchall()]

    total_equities = len(equity_ids)
    if verbose:
        print(f'Processing {total_equities} equities...')

    batch = []
    total_rows = 0
    processed_equities = 0

    for eid in equity_ids:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT id, trade_date, close, sma_50, sma_200,
                       w52_high, w52_low, lifetime_high,
                       magic_rs, rvol, rsi_14
                FROM km_equity_eod
                WHERE equity_id = %s
                ORDER BY trade_date ASC
            """, [eid])
            rows = cur.fetchall()

        results = process_equity(rows)
        for row_id, rising, stage, is_vani in results:
            batch.append((row_id, rising, stage, is_vani))

        if len(batch) >= BATCH_SIZE:
            flush_batch(conn, batch)
            total_rows += len(batch)
            batch = []

        processed_equities += 1
        if verbose and processed_equities % 500 == 0:
            elapsed = time.time() - t0
            pct = processed_equities / total_equities * 100
            print(f'  {processed_equities}/{total_equities} equities ({pct:.0f}%) '
                  f'— {total_rows:,} rows — {elapsed:.0f}s')

    if batch:
        flush_batch(conn, batch)
        total_rows += len(batch)

    conn.close()
    elapsed = time.time() - t0
    if verbose:
        print(f'\nDone. {total_rows:,} rows updated in {elapsed:.0f}s.')
    return total_rows


# ── Single-date update (for nightly pipeline) ─────────────────────────────

def compute_stage_for_date(db, trade_date, verbose=False):
    """
    Compute sma200_rising, stage, is_vani_s2 for all equity rows on trade_date.
    Uses pre-computed sma_200 history (requires sma_200 already populated).

    db: PgClient (as used by daily_pipeline.py)
    trade_date: date or str YYYY-MM-DD
    Returns number of rows updated.
    """
    import psycopg2
    import psycopg2.extras

    conn = db._conn()
    total = 0
    batch = []

    try:
        with conn.cursor() as cur:
            cur.execute(
                'SELECT DISTINCT equity_id FROM km_equity_eod WHERE trade_date = %s',
                [str(trade_date)],
            )
            equity_ids = [r[0] for r in cur.fetchall()]

        if verbose:
            print(f'    [stage_classification] {len(equity_ids)} symbols for {trade_date}')

        for eid in equity_ids:
            # Fetch recent history — enough for SMA_200 slope (20 bars back)
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("""
                    SELECT id, trade_date, close, sma_50, sma_200,
                           w52_high, w52_low, lifetime_high,
                           magic_rs, rvol, rsi_14
                    FROM km_equity_eod
                    WHERE equity_id = %s
                    ORDER BY trade_date ASC
                """, [eid])
                rows = cur.fetchall()

            if not rows:
                continue

            results = process_equity(rows)

            # Only update the row matching trade_date
            trade_date_str = str(trade_date)
            for row_id, rising, stage, is_vani in results:
                # Find the matching row
                matching = [r for r in rows if str(r['trade_date']) == trade_date_str]
                if matching and matching[0]['id'] == row_id:
                    batch.append((row_id, rising, stage, is_vani))
                    break
            else:
                # Fallback: just take the last result (today's bar)
                if results:
                    batch.append(results[-1])

            if len(batch) >= BATCH_SIZE:
                flush_batch(conn, batch)
                total += len(batch)
                batch = []

        if batch:
            flush_batch(conn, batch)
            total += len(batch)

    finally:
        conn.close()

    if verbose:
        print(f'    [stage_classification] {total} rows updated for {trade_date}')
    return total


# ── Verification ──────────────────────────────────────────────────────────

def verify(target_date=None):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if target_date:
                date_clause = "WHERE trade_date = %s"
                params = [target_date]
                print(f'\n[verify] Stage distribution for trade_date = {target_date}')
            else:
                date_clause = "WHERE trade_date = (SELECT MAX(trade_date) FROM km_equity_eod)"
                params = []
                print('\n[verify] Stage distribution for latest trade_date')

            cur.execute(f"""
                SELECT
                    COALESCE(stage, 'NULL') AS stage,
                    COUNT(*) AS count,
                    SUM(CASE WHEN is_vani_s2 THEN 1 ELSE 0 END) AS vani_count
                FROM km_equity_eod
                {date_clause}
                GROUP BY stage
                ORDER BY stage
            """, params)
            rows = cur.fetchall()

            print(f"  {'Stage':<16} {'Count':>8}  {'VaNi':>6}")
            print(f"  {'-'*16} {'-'*8}  {'-'*6}")
            for r in rows:
                print(f"  {r['stage']:<16} {r['count']:>8}  {r['vani_count']:>6}")
    finally:
        conn.close()


# ── CLI ───────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument('--verify', action='store_true', help='Verify only, no write')
    parser.add_argument('--date',   help='Only process rows for this date YYYY-MM-DD')
    args = parser.parse_args()

    if args.verify:
        verify(args.date)
        sys.exit(0)

    if args.date:
        print(f'Single-date mode: {args.date}')
        conn = get_conn()
        batch = []
        total = 0
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                'SELECT DISTINCT equity_id FROM km_equity_eod WHERE trade_date = %s',
                [args.date],
            )
            equity_ids = [r[0] for r in cur.fetchall()]

        print(f'{len(equity_ids)} equities on {args.date}')
        for eid in equity_ids:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("""
                    SELECT id, trade_date, close, sma_50, sma_200,
                           w52_high, w52_low, lifetime_high,
                           magic_rs, rvol, rsi_14
                    FROM km_equity_eod
                    WHERE equity_id = %s
                    ORDER BY trade_date ASC
                """, [eid])
                rows = cur.fetchall()
            results = process_equity(rows)
            # Only today's bar
            for row_id, rising, stage, is_vani in results[-1:]:
                batch.append((row_id, rising, stage, is_vani))
            if len(batch) >= BATCH_SIZE:
                flush_batch(conn, batch)
                total += len(batch)
                batch = []

        if batch:
            flush_batch(conn, batch)
            total += len(batch)
        conn.close()
        print(f'Updated {total} rows.')
        verify(args.date)
    else:
        print('Full backfill — this will take 5-15 minutes for full history.')
        print('Press Ctrl+C to abort, or wait 5 seconds to continue...')
        time.sleep(5)
        run_full_backfill(verbose=True)
        verify()
