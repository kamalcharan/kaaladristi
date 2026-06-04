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

Usage:
    cd App/backend

    # Default: skip equities already fully classified (fast, safe to re-run)
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
import psycopg2.extras
import argparse

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL

BATCH_SIZE         = 5000   # rows per UPDATE
CHUNK_SIZE         = 100    # equity_ids fetched per DB round-trip
SMA200_SLOPE_BARS  = 20
STAGE1_PROXIMITY   = 0.05   # 5%  — close within this of sma_200 → S1
S3_CONVERGENCE     = 0.15   # 15% — sma_50 within this of sma_200 → S3


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(DATABASE_URL, connect_timeout=30)


# ── Classification ─────────────────────────────────────────────────────────

def _f(v):
    if v is None:
        return None
    try:
        f = float(v)
        return None if f != f else f  # drop NaN
    except (TypeError, ValueError):
        return None


def classify_bar(close, sma_50, sma_200, sma200_rising,
                 w52_high, w52_low, lifetime_high,
                 magic_rs, rvol, rsi_14):
    """Returns (stage: str|None, is_vani_s2: bool)."""
    if sma_200 is None or close is None:
        return None, False

    s2_core = (
        sma_50 is not None
        and close > sma_50
        and sma_50 > sma_200
        and close > sma_200
        and close > 30
    )
    s2_gates = (
        sma200_rising is True
        and w52_low  is not None and w52_low  > 0
        and w52_high is not None and w52_high > 0
        and w52_low  * 1.25 <= close
        and w52_high * 0.75 <= close
    )

    if s2_core and s2_gates:
        is_vani = (
            magic_rs     is not None and magic_rs > 40
            and rvol     is not None and rvol > 1.5
            and rsi_14   is not None and 50 <= rsi_14 <= 80
            and lifetime_high is not None and lifetime_high > 0
            and close / lifetime_high >= 0.75
            and w52_high > 0
            and close / w52_high >= 0.85
        )
        return 'S2', is_vani

    if s2_core:
        return 'S2_CANDIDATE', False

    if close < sma_200:
        return 'S4', False

    # close >= sma_200 beyond here
    if sma200_rising is False:
        if abs(close - sma_200) / sma_200 <= STAGE1_PROXIMITY:
            return 'S1', False

    if sma_50 is not None and sma_200 > 0:
        if (sma_50 - sma_200) / sma_200 < S3_CONVERGENCE:
            return 'S3', False

    return 'S3', False


def process_equity(rows):
    """
    rows: list of dicts sorted ASC by trade_date for one equity_id.
    Returns list of (id, sma200_rising, stage, is_vani_s2).
    """
    sma200_hist = []
    out = []
    for row in rows:
        sma_200 = _f(row['sma_200'])
        sma200_hist.append(sma_200)

        rising = None
        if len(sma200_hist) > SMA200_SLOPE_BARS:
            past = sma200_hist[-(SMA200_SLOPE_BARS + 1)]
            if sma_200 is not None and past is not None:
                rising = sma_200 > past

        stage, is_vani = classify_bar(
            _f(row['close']),  _f(row['sma_50']),   sma_200, rising,
            _f(row['w52_high']),  _f(row['w52_low']),
            _f(row['lifetime_high']),
            _f(row['magic_rs']),  _f(row['rvol']),   _f(row['rsi_14']),
        )
        out.append((row['id'], rising, stage, is_vani))
    return out


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
        psycopg2.extras.execute_values(cur, sql, batch)
    conn.commit()


# ── Equity-id helpers ──────────────────────────────────────────────────────

def get_all_equity_ids(conn):
    with conn.cursor() as cur:
        cur.execute('SELECT DISTINCT equity_id FROM km_equity_eod ORDER BY equity_id')
        return [r[0] for r in cur.fetchall()]


def get_missing_equity_ids(conn):
    """Return equity_ids that have ANY row where stage IS NULL (need classification)."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT DISTINCT equity_id
            FROM km_equity_eod
            WHERE stage IS NULL
            ORDER BY equity_id
        """)
        return [r[0] for r in cur.fetchall()]


def fetch_chunk(conn, equity_ids_chunk):
    """Fetch full history for a list of equity_ids in one round-trip."""
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT id, equity_id, trade_date, close, sma_50, sma_200,
                   w52_high, w52_low, lifetime_high,
                   magic_rs, rvol, rsi_14
            FROM km_equity_eod
            WHERE equity_id = ANY(%s)
            ORDER BY equity_id, trade_date ASC
        """, [equity_ids_chunk])
        return cur.fetchall()


# ── Main backfill ─────────────────────────────────────────────────────────

def run_backfill(equity_ids, label='', verbose=True):
    """
    Process a list of equity_ids in chunks of CHUNK_SIZE.
    Fetches full history per chunk, classifies bar-by-bar, writes in batches.
    Memory footprint: at most CHUNK_SIZE equities × ~1500 rows in RAM at once.
    """
    conn = get_conn()
    t0 = time.time()
    total_equities = len(equity_ids)
    total_rows = 0
    processed = 0
    write_batch = []

    if verbose:
        print(f'  {label}{total_equities} equities to process '
              f'(chunks of {CHUNK_SIZE}, write batch {BATCH_SIZE})')

    for chunk_start in range(0, total_equities, CHUNK_SIZE):
        chunk = equity_ids[chunk_start: chunk_start + CHUNK_SIZE]
        rows = fetch_chunk(conn, chunk)

        # Group rows by equity_id
        by_equity = {}
        for row in rows:
            eid = row['equity_id']
            by_equity.setdefault(eid, []).append(row)

        for eid in chunk:
            equity_rows = by_equity.get(eid, [])
            if not equity_rows:
                continue
            for rec in process_equity(equity_rows):
                write_batch.append(rec)

            if len(write_batch) >= BATCH_SIZE:
                flush_batch(conn, write_batch)
                total_rows += len(write_batch)
                write_batch = []

        processed += len(chunk)
        if verbose and (processed % 1000 == 0 or processed == total_equities):
            elapsed = time.time() - t0
            pct = processed / total_equities * 100
            print(f'  {processed}/{total_equities} ({pct:.0f}%) '
                  f'— {total_rows:,} rows written — {elapsed:.0f}s')

    if write_batch:
        flush_batch(conn, write_batch)
        total_rows += len(write_batch)

    conn.close()
    elapsed = time.time() - t0
    if verbose:
        print(f'\n  Done. {total_rows:,} rows updated in {elapsed:.0f}s.')
    return total_rows


# ── Single-date update (nightly pipeline) ─────────────────────────────────

def compute_stage_for_date(db, trade_date, verbose=False):
    """
    Called by daily_pipeline.py step 6h.
    Processes only equity_ids that have a row on trade_date.
    Fetches full history per equity (needed for SMA slope).

    db: PgClient from lib.db_client.get_db()
    Returns number of rows updated.
    """
    conn = db._conn()
    total = 0
    write_batch = []

    try:
        with conn.cursor() as cur:
            cur.execute(
                'SELECT DISTINCT equity_id FROM km_equity_eod WHERE trade_date = %s',
                [str(trade_date)],
            )
            equity_ids = [r[0] for r in cur.fetchall()]

        if verbose:
            print(f'    [stage_classification] {len(equity_ids)} symbols for {trade_date}')

        trade_date_str = str(trade_date)

        for chunk_start in range(0, len(equity_ids), CHUNK_SIZE):
            chunk = equity_ids[chunk_start: chunk_start + CHUNK_SIZE]

            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("""
                    SELECT id, equity_id, trade_date, close, sma_50, sma_200,
                           w52_high, w52_low, lifetime_high,
                           magic_rs, rvol, rsi_14
                    FROM km_equity_eod
                    WHERE equity_id = ANY(%s)
                    ORDER BY equity_id, trade_date ASC
                """, [chunk])
                rows = cur.fetchall()

            by_equity = {}
            for row in rows:
                by_equity.setdefault(row['equity_id'], []).append(row)

            for eid in chunk:
                equity_rows = by_equity.get(eid, [])
                if not equity_rows:
                    continue
                results = process_equity(equity_rows)
                # Only emit the row matching trade_date
                for row_id, rising, stage, is_vani in results:
                    if str(equity_rows[results.index((row_id, rising, stage, is_vani))
                                       ]['trade_date']) == trade_date_str:
                        write_batch.append((row_id, rising, stage, is_vani))
                        break
                else:
                    # Fallback: last result is today's bar
                    if results:
                        write_batch.append(results[-1])

            if len(write_batch) >= BATCH_SIZE:
                flush_batch(conn, write_batch)
                total += len(write_batch)
                write_batch = []

        if write_batch:
            flush_batch(conn, write_batch)
            total += len(write_batch)

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
                cur.execute("""
                    SELECT COALESCE(stage,'NULL') AS stage,
                           COUNT(*) AS count,
                           SUM(CASE WHEN is_vani_s2 THEN 1 ELSE 0 END) AS vani_count
                    FROM km_equity_eod WHERE trade_date = %s
                    GROUP BY stage ORDER BY stage
                """, [target_date])
                print(f'\n[verify] trade_date = {target_date}')
            else:
                cur.execute("""
                    SELECT COALESCE(stage,'NULL') AS stage,
                           COUNT(*) AS count,
                           SUM(CASE WHEN is_vani_s2 THEN 1 ELSE 0 END) AS vani_count
                    FROM km_equity_eod
                    WHERE trade_date = (SELECT MAX(trade_date) FROM km_equity_eod)
                    GROUP BY stage ORDER BY stage
                """)
                print('\n[verify] latest trade_date')

            rows = cur.fetchall()
            print(f"  {'Stage':<16} {'Count':>8}  {'VaNi':>6}")
            print(f"  {'-'*16} {'-'*8}  {'-'*6}")
            for r in rows:
                print(f"  {r['stage']:<16} {r['count']:>8}  {r['vani_count']:>6}")

        # Also show total NULL count across all dates
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM km_equity_eod WHERE stage IS NULL")
            null_total = cur.fetchone()[0]
            print(f"\n  Rows with stage=NULL (all dates): {null_total:,}")
    finally:
        conn.close()


# ── CLI ───────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Classify Weinstein stages in km_equity_eod'
    )
    parser.add_argument('--full',   action='store_true',
                        help='Reprocess all equities (default: skip already classified)')
    parser.add_argument('--date',   metavar='YYYY-MM-DD',
                        help='Process only this trade date')
    parser.add_argument('--verify', action='store_true',
                        help='Verify counts only, no writes')
    args = parser.parse_args()

    if args.verify:
        verify(args.date)
        sys.exit(0)

    # ── Single date ──
    if args.date:
        print(f'[stage] Single-date mode: {args.date}')
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute(
                'SELECT DISTINCT equity_id FROM km_equity_eod WHERE trade_date = %s',
                [args.date],
            )
            eids = [r[0] for r in cur.fetchall()]
        conn.close()
        print(f'  {len(eids)} equities on {args.date}')

        # Reuse run_backfill but only emit today's result for each equity
        # (simpler: just call single-date path directly)
        conn = get_conn()
        t0 = time.time()
        write_batch = []
        total = 0
        trade_date_str = args.date

        for chunk_start in range(0, len(eids), CHUNK_SIZE):
            chunk = eids[chunk_start: chunk_start + CHUNK_SIZE]
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("""
                    SELECT id, equity_id, trade_date, close, sma_50, sma_200,
                           w52_high, w52_low, lifetime_high,
                           magic_rs, rvol, rsi_14
                    FROM km_equity_eod
                    WHERE equity_id = ANY(%s)
                    ORDER BY equity_id, trade_date ASC
                """, [chunk])
                rows = cur.fetchall()

            by_equity = {}
            for row in rows:
                by_equity.setdefault(row['equity_id'], []).append(row)

            for eid in chunk:
                equity_rows = by_equity.get(eid, [])
                if not equity_rows:
                    continue
                results = process_equity(equity_rows)
                if results:
                    write_batch.append(results[-1])  # last bar = today

            if len(write_batch) >= BATCH_SIZE:
                flush_batch(conn, write_batch)
                total += len(write_batch)
                write_batch = []

        if write_batch:
            flush_batch(conn, write_batch)
            total += len(write_batch)
        conn.close()
        print(f'  Updated {total} rows in {time.time()-t0:.0f}s.')
        verify(args.date)
        sys.exit(0)

    # ── Full or missing backfill ──
    conn = get_conn()
    if args.full:
        print('[stage] Full mode — reprocessing all equities.')
        equity_ids = get_all_equity_ids(conn)
        label = 'Full: '
    else:
        print('[stage] Missing mode — only equities with unclassified rows.')
        equity_ids = get_missing_equity_ids(conn)
        label = 'Missing: '
    conn.close()

    if not equity_ids:
        print('  Nothing to do — all rows already classified.')
        verify()
        sys.exit(0)

    print(f'  {len(equity_ids)} equities to process.')
    print('Press Ctrl+C to abort, or wait 3 seconds...')
    time.sleep(3)

    run_backfill(equity_ids, label=label, verbose=True)
    verify()
