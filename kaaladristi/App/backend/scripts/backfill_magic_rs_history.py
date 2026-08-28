#!/usr/bin/env python3
"""
backfill_magic_rs_history — persist the Magic RS history the compute already
derives but never writes.

THE BUG
-------
compute_magic_rs_batch loads a window, computes the full series in memory, and
then writes only from `p_from_date` onward:

    IF p_from_date IS NOT NULL THEN
      FOR i IN 1..n LOOP
        IF a_date[i] >= p_from_date THEN start_idx := i; EXIT; END IF;
    ...
    FOR i IN start_idx..n LOOP   -- everything before start_idx is discarded

The nightly pipeline passes the run date, so each night persists ONE bar. The
in-memory series behind it — up to ~240 bars once the 350-day window is loaded
— is thrown away.

magic_ma is the tell. It is SMA(60) of magic_rs, computed over that in-memory
series, and it IS written. So the table ends up holding a 60-bar average whose
inputs it does not hold:

    WALCHANNAG, 2026-07-31 — the FIRST bar carrying magic_rs at all:
        magic_rs  9.22      magic_ma  31.99

A 60-bar mean of a series starting that day cannot exist. It then declines
smoothly to 20.72 as the window rolls off values no row ever recorded.

Because magic_rs_zone is classified on (magic_rs - magic_ma), the whole series
reads Strong Bear on every one of its 21 bars. On 2026-08-28, 1,876 of the
6,493 stocks carrying magic_ma had no magic_rs 60 sessions earlier; 269 of
those are labelled Strong Bear off an average built on nothing.

THE FIX
-------
compute_magic_rs_batch with p_from_date = NULL loads the symbol's FULL history
(the date bound is only applied when p_from_date is given) and writes from
index 1. So the history it already knows how to derive gets persisted. No new
maths, no new migration — the same RPC, asked for the whole series instead of
the last bar.

Zones, and everything downstream of them, are recomputed as a consequence.

    python scripts/backfill_magic_rs_history.py            # short symbols only
    python scripts/backfill_magic_rs_history.py --all      # every symbol
    python scripts/backfill_magic_rs_history.py --dry-run
"""
from __future__ import annotations

import argparse
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import psycopg2
import psycopg2.extras
from lib.config import DATABASE_URL

# NIFTY 500 — the benchmark the Pine Script names (NSE:CNX500) and the one
# every stored magic_rs value is already measured against. Resolved by name so
# a re-seeded index table cannot silently repoint the series.
BENCHMARK_NAME = 'NIFTY 500'

# A symbol is "short" when it holds far fewer magic_rs bars than its price
# history supports. Long MagicRS needs 144 prior bars, so anything past that
# should carry a value; 0.6 leaves room for genuine benchmark gaps without
# waving through a symbol that has 21 of a possible 400.
COVERAGE_FLOOR = 0.6
STATEMENT_TIMEOUT_MS = 15 * 60 * 1000


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(
        DATABASE_URL,
        keepalives=1, keepalives_idle=30, keepalives_interval=10, keepalives_count=5,
        options=f'-c statement_timeout={STATEMENT_TIMEOUT_MS}',
    )


def benchmark_id(conn) -> int:
    with conn.cursor() as cur:
        cur.execute('SELECT id FROM km_index_symbols WHERE name = %s LIMIT 1', (BENCHMARK_NAME,))
        row = cur.fetchone()
    if not row:
        raise RuntimeError(f'Benchmark index {BENCHMARK_NAME!r} not found in km_index_symbols')
    return int(row[0])


def candidates(conn, do_all: bool) -> list[tuple[int, str, int, int]]:
    """(equity_id, symbol, bars, magic_rs_bars) for symbols worth recomputing.

    `expected` counts bars past the 144-bar warm-up — the ones long MagicRS can
    actually be computed on. Comparing against total bars would mark every
    young symbol short forever.
    """
    sql = """
        SELECT s.id, s.symbol,
               count(e.*)                                   AS bars,
               count(e.magic_rs)                            AS rs_bars,
               GREATEST(count(e.*) - 144, 0)                AS expected
        FROM km_equity_symbols s
        JOIN km_equity_eod e ON e.equity_id = s.id
        WHERE s.is_active
        GROUP BY s.id, s.symbol
        HAVING GREATEST(count(e.*) - 144, 0) > 0
    """
    if not do_all:
        sql += f" AND count(e.magic_rs) < GREATEST(count(e.*) - 144, 0) * {COVERAGE_FLOOR}"
    sql += " ORDER BY GREATEST(count(e.*) - 144, 0) - count(e.magic_rs) DESC"

    with conn.cursor() as cur:
        cur.execute(sql)
        return [(int(r[0]), r[1], int(r[2]), int(r[3])) for r in cur.fetchall()]


def recompute(conn, equity_id: int, bench_id: int) -> int:
    """Full-history recompute for one symbol. p_from_date NULL is the whole point."""
    with conn.cursor() as cur:
        cur.execute(
            """SELECT compute_magic_rs_batch(
                   p_table => 'km_equity_eod',
                   p_id_col => 'equity_id',
                   p_symbol_id => %s,
                   p_from_date => NULL,
                   p_bench_table => 'km_index_eod',
                   p_bench_id_col => 'index_id',
                   p_benchmark_id => %s)""",
            (equity_id, bench_id),
        )
        row = cur.fetchone()
    conn.commit()
    return int(row[0]) if row and row[0] is not None else 0


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--all', action='store_true',
                    help='recompute every active symbol, not only short ones')
    ap.add_argument('--dry-run', action='store_true',
                    help='report what would be recomputed and stop')
    ap.add_argument('--limit', type=int, default=0, help='stop after N symbols')
    a = ap.parse_args()

    conn = get_conn()
    try:
        bench = benchmark_id(conn)
        print(f'[magic-rs] benchmark {BENCHMARK_NAME} = index {bench}')

        rows = candidates(conn, a.all)
        if a.limit:
            rows = rows[:a.limit]
        if not rows:
            print('[magic-rs] nothing short — every symbol already carries its history.')
            return

        deficit = sum(max(b - 144, 0) - r for _, _, b, r in rows)
        print(f'[magic-rs] {len(rows):,} symbols, {deficit:,} bars missing')
        for eid, sym, bars, rs in rows[:10]:
            print(f'    {sym:<14} {rs:>5} of {max(bars - 144, 0):>5} computable bars')
        if len(rows) > 10:
            print(f'    … {len(rows) - 10:,} more')

        if a.dry_run:
            print('[magic-rs] dry run — nothing written.')
            return

        t0 = time.time()
        written = 0
        for i, (eid, sym, _bars, _rs) in enumerate(rows, 1):
            try:
                written += recompute(conn, eid, bench)
            except Exception as exc:                      # noqa: BLE001
                # One bad symbol must not cost the run. A benchmark gap or a
                # single-bar history raises inside the RPC; skip and continue.
                conn.rollback()
                print(f'    ! {sym}: {exc}')
            if i % 100 == 0:
                print(f'    {i}/{len(rows)} symbols, {written:,} rows, '
                      f'{time.time() - t0:.0f}s')

        print(f'[magic-rs] done — {written:,} rows over {len(rows):,} symbols '
              f'in {time.time() - t0:.0f}s')
        print('    magic_rs_zone is recomputed with it, so scanners, the Waking')
        print('    Giants clocks and the Discovery tabs all shift. Re-run')
        print('    compute_wg_journeys.py afterwards.')
    finally:
        conn.close()


if __name__ == '__main__':
    main()
