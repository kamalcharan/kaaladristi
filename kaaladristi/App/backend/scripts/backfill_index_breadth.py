"""
backfill_index_breadth.py — fill km_index_breadth history (migration 203).

The nightly pipeline2 dimension `index_breadth` computes only its own trade
date. Run this once after applying the migration so every index has the
252-session history its percentile zone mode needs, and again for one index
after a large constituent edit.

    KD_DB_PASSWORD=... python scripts/backfill_index_breadth.py                  # default: 2 years, all indices
    python scripts/backfill_index_breadth.py --from 2025-09-01 --to 2026-09-04
    python scripts/backfill_index_breadth.py --index 1                           # one index (NIFTY 50)
    python scripts/backfill_index_breadth.py --dry-run

Runs compute_index_breadth() in monthly chunks — one statement per chunk,
~131 indices × ~22 sessions each, a few seconds per chunk on the VPS — so a
long history never becomes one long-running statement. Idempotent: the
function upserts, re-running a range simply rewrites it.

Connection: DATABASE_URL / DB_PRIMARY from App/.env (lib.config), the same
as the other backfills.
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from datetime import date, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from lib.config import DATABASE_URL  # noqa: E402


def get_conn():
    import psycopg2  # lazy: --dry-run must work on a machine without the driver
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(DATABASE_URL, connect_timeout=30,
                            options='-c statement_timeout=600000')


def month_chunks(start: date, end: date):
    """Yield (chunk_start, chunk_end) inclusive, calendar-month aligned."""
    cur = start
    while cur <= end:
        nxt = (cur.replace(day=1) + timedelta(days=32)).replace(day=1)
        yield cur, min(end, nxt - timedelta(days=1))
        cur = nxt


def main() -> int:
    ap = argparse.ArgumentParser(description='Backfill km_index_breadth via compute_index_breadth()')
    ap.add_argument('--from', dest='from_date', type=date.fromisoformat,
                    default=date.today() - timedelta(days=2 * 365),
                    help='first trade date (default: 2 years ago)')
    ap.add_argument('--to', dest='to_date', type=date.fromisoformat, default=date.today(),
                    help='last trade date (default: today)')
    ap.add_argument('--index', dest='index_id', type=int, default=None,
                    help='one km_index_symbols.id (default: every index with constituents)')
    ap.add_argument('--dry-run', action='store_true', help='print the chunks, write nothing')
    args = ap.parse_args()

    chunks = list(month_chunks(args.from_date, args.to_date))
    scope = f'index {args.index_id}' if args.index_id else 'all indices with constituents'
    print(f'km_index_breadth backfill · {args.from_date} → {args.to_date} · {scope} · {len(chunks)} chunks')
    if args.dry_run:
        for a, b in chunks:
            print(f'  {a} → {b}')
        return 0

    conn = get_conn()
    total = 0
    t0 = time.time()
    try:
        for a, b in chunks:
            t = time.time()
            with conn.cursor() as cur:
                cur.execute('SELECT compute_index_breadth(%s, %s, %s)', [a, b, args.index_id])
                n = cur.fetchone()[0] or 0
            conn.commit()
            total += n
            print(f'  {a} → {b}: {n:6d} rows  ({time.time() - t:.1f}s)')
    finally:
        conn.close()
    print(f'done · {total} rows · {time.time() - t0:.0f}s')
    return 0


if __name__ == '__main__':
    sys.exit(main())
