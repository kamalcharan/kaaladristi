"""
MagicRS Momentum — 5 / 22 / 66 bar changes on km_equity_eod
============================================================
Writes magic_rs_chg_5d / magic_rs_chg_22d / magic_rs_chg_66d and
magic_rs_align by calling the SQL function compute_magic_rs_momentum()
(migration 219). All the arithmetic lives in that function — this script is
the driver, so there is exactly ONE implementation of the measure.

The measure is a POINT DIFFERENCE, not a percent change: magic_rs is already
a percentage deviation, so a percent change of a percent is not readable.

5/22/66 is the house clock — ret_5d/22d/66d, avg_amt_5d/22d/66d, rel_*_n500,
score_5d/22d all use it. MagicRS was the one measure speaking 1/5/20.

Requires magic_rs to be populated first (the nse_magic_rs / bse_magic_rs
dimensions), which is why DIMENSION_DEPENDENTS lists this as their dependent.

Usage:
    cd App/backend
    python scripts/compute_magic_rs_momentum.py --date 2026-09-18
    python scripts/compute_magic_rs_momentum.py --date 2026-09-18 --verify
    python scripts/compute_magic_rs_momentum.py --from 2026-01-01 --to 2026-09-18
    python scripts/compute_magic_rs_momentum.py --all      # full history, by year

⚠ --all walks ~13.2M bars. Run it off-hours and NOT through the read-only MCP
  connection; a runaway window query there wedged the server for hours on
  2026-09-18. It chunks by calendar year so progress is visible and a failure
  costs one year, not the run.
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


def _run(conn, d_from, d_to) -> int:
    """One call to the SQL function. Commits on the connection it is given."""
    with conn.cursor() as cur:
        cur.execute('SELECT compute_magic_rs_momentum(%s, %s)', [str(d_from), str(d_to)])
        n = cur.fetchone()[0] or 0
    conn.commit()
    return n


def run_range(d_from, d_to, conn=None) -> int:
    own = conn is None
    conn = conn or get_conn()
    try:
        return _run(conn, d_from, d_to)
    finally:
        if own:
            conn.close()


def run_all(verbose=True) -> int:
    """Full history, chunked by calendar year.

    Chunking is safe because the SQL function carries its own 400-day warm-up
    behind p_from — each year re-reads the tail of the previous one, so a bar
    on 1 January still sees the 66 bars before it. A naive chunk WITHOUT that
    warm-up would silently write NULL for the first ~66 bars of every year.
    """
    conn = get_conn()
    total = 0
    try:
        with conn.cursor() as cur:
            cur.execute('SELECT min(trade_date), max(trade_date) FROM km_equity_eod '
                        'WHERE magic_rs IS NOT NULL')
            lo, hi = cur.fetchone()
        conn.commit()
        if lo is None:
            print('No rows with magic_rs — nothing to do.')
            return 0

        for yr in range(lo.year, hi.year + 1):
            y_from = max(lo, date(yr, 1, 1))
            y_to = min(hi, date(yr, 12, 31))
            n = _run(conn, y_from, y_to)
            total += n
            if verbose:
                print(f'  {yr}: {n:>9,} rows  ({y_from} .. {y_to})', flush=True)
        return total
    finally:
        conn.close()


def verify(trade_date: str, conn=None):
    own = conn is None
    conn = conn or get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT COUNT(*)                                     AS total_rows,
                       COUNT(magic_rs)                              AS with_rs,
                       COUNT(magic_rs_chg_5d)                       AS c5,
                       COUNT(magic_rs_chg_22d)                      AS c22,
                       COUNT(magic_rs_chg_66d)                      AS c66,
                       COUNT(magic_rs_align)                        AS align,
                       COUNT(*) FILTER (WHERE magic_rs_align = 3)   AS rising_all_three,
                       COUNT(*) FILTER (WHERE magic_rs_align = 0)   AS falling_all_three
                FROM km_equity_eod WHERE trade_date = %s
            """, [trade_date])
            r = cur.fetchone()
            print(f"\n[verify] trade_date = {trade_date}")
            print(f"  rows / with magic_rs : {r['total_rows']} / {r['with_rs']}")
            print(f"  chg_5d / 22d / 66d   : {r['c5']} / {r['c22']} / {r['c66']}")
            print(f"  align scored         : {r['align']}")
            print(f"  rising on all three  : {r['rising_all_three']}")
            print(f"  falling on all three : {r['falling_all_three']}")

            # The invariant the migration's COMMENT promises. A violation here
            # means align was scored from an incomplete set, which is the
            # stir_days denominator mistake in a different column.
            cur.execute("""
                SELECT COUNT(*) AS bad FROM km_equity_eod
                WHERE trade_date = %s AND magic_rs_align IS NOT NULL
                  AND (magic_rs_chg_5d IS NULL OR magic_rs_chg_22d IS NULL
                       OR magic_rs_chg_66d IS NULL
                       OR magic_rs_align NOT BETWEEN 0 AND 3)
            """, [trade_date])
            bad = cur.fetchone()['bad']
            print(f"  align invariant      : {'OK' if bad == 0 else f'VIOLATED on {bad} rows'}")
        conn.commit()
    finally:
        if own:
            conn.close()


def compute_magic_rs_momentum_for_date(db_conn, trade_date, verbose=False) -> int:
    """Pipeline entry point — the pipeline2 `magic_rs_momentum` dimension.

    Unlike backfill_rs_percentile, this USES the connection it is handed rather
    than opening its own, so a forced run's column nullification and this write
    stay on one connection.
    """
    n = run_range(trade_date, trade_date, conn=db_conn)
    if verbose:
        print(f'  [magic_rs_momentum] {n} rows updated for {trade_date}')
    return n


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--date', default=str(date.today()), help='Single trade date YYYY-MM-DD')
    p.add_argument('--from', dest='d_from', help='Range start YYYY-MM-DD')
    p.add_argument('--to', dest='d_to', help='Range end YYYY-MM-DD (default: --from)')
    p.add_argument('--all', action='store_true', help='Full history, chunked by year')
    p.add_argument('--verify', action='store_true', help='Verify only, no write')
    args = p.parse_args()

    if args.verify:
        verify(args.date)
        return

    if args.all:
        print('Computing magic_rs momentum across full history (by year)...')
        total = run_all()
        print(f'Done — {total:,} rows updated.')
        verify(args.date)
        return

    if args.d_from:
        d_to = args.d_to or args.d_from
        n = run_range(args.d_from, d_to)
        print(f'Updated {n:,} rows for {args.d_from} .. {d_to}')
        verify(d_to)
        return

    n = run_range(args.date, args.date)
    print(f'Updated {n:,} rows for {args.date}')
    verify(args.date)


if __name__ == '__main__':
    main()
