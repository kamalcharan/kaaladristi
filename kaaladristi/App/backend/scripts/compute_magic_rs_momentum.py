"""
MagicRS Momentum — 5 / 22 / 66 BAR changes, on every table that carries a
MagicRS series
==============================================================================
Driver for the SQL function compute_magic_rs_momentum(table, from, to)
(migration 219). All the arithmetic lives in that function, so there is exactly
ONE implementation of the measure — the whole point of the exercise.

The measure is a POINT DIFFERENCE, never a percent: magic_rs is already a
percentage deviation, so a percent change of a percent is not readable.

FOUR TABLES, TWO SERIES — and the bars are that table's own bars:

    km_equity_eod      magic_rs       (144-bar)  -> magic_rs_chg_*
    km_index_eod       magic_rs       (144-bar)  -> magic_rs_chg_*
    km_equity_weekly   magic_rs_short (21-bar)   -> magic_rs_short_chg_*
    km_equity_monthly  magic_rs_short (21-bar)   -> magic_rs_short_chg_*

⚠ 66 on the monthly table is 66 MONTHS. Most symbols cannot reach it and get
NULL — that is the honest answer, not a gap to fill.

Requires magic_rs / magic_rs_short to be populated first, which is why
DIMENSION_DEPENDENTS lists this as a dependent of the magic_rs dimensions.

Usage:
    cd App/backend
    python scripts/compute_magic_rs_momentum.py --date 2026-09-18
    python scripts/compute_magic_rs_momentum.py --date 2026-09-18 --verify
    python scripts/compute_magic_rs_momentum.py --from 2026-01-01 --to 2026-09-18
    python scripts/compute_magic_rs_momentum.py --all           # every table, full history
    python scripts/compute_magic_rs_momentum.py --all --table km_equity_eod

⚠ --all walks ~13.2M daily bars. Run it off-hours and NOT through the read-only
  MCP connection; a runaway window query there wedged the server for hours on
  2026-09-18. Daily tables chunk by calendar year so progress is visible and a
  failure costs one year, not the run.
"""

import sys
import os
import argparse
import psycopg2
import psycopg2.extras
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL

# Order matters only for readability; the tables are independent.
TABLES = ['km_equity_eod', 'km_index_eod', 'km_equity_weekly', 'km_equity_monthly']

# Which column prefix each table writes, for --verify.
_PREFIX = {
    'km_equity_eod':     'magic_rs',
    'km_index_eod':      'magic_rs',
    'km_equity_weekly':  'magic_rs_short',
    'km_equity_monthly': 'magic_rs_short',
}
_SOURCE = {t: ('magic_rs' if p == 'magic_rs' else 'magic_rs_short')
           for t, p in _PREFIX.items()}

# Only the daily tables are big enough to need chunking; weekly/monthly are a
# couple of hundred bars per symbol and run whole in one pass.
_CHUNK_BY_YEAR = {'km_equity_eod', 'km_index_eod'}


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(DATABASE_URL, connect_timeout=30)


def _run(conn, table, d_from, d_to) -> int:
    with conn.cursor() as cur:
        cur.execute('SELECT compute_magic_rs_momentum(%s, %s, %s)',
                    [table, str(d_from), str(d_to)])
        n = cur.fetchone()[0] or 0
    conn.commit()
    return n


def run_range(table, d_from, d_to, conn=None) -> int:
    own = conn is None
    conn = conn or get_conn()
    try:
        return _run(conn, table, d_from, d_to)
    finally:
        if own:
            conn.close()


def run_all(tables=None, verbose=True) -> int:
    """Full history for each table.

    Chunking the daily tables by calendar year is safe because the SQL function
    carries its own per-cadence warm-up BEHIND p_from — each year re-reads the
    tail of the previous one, so a bar on 1 January still sees the 66 bars
    before it. A naive chunk WITHOUT that warm-up would silently write NULL for
    the first ~66 bars of every year.
    """
    conn = get_conn()
    total = 0
    try:
        for table in (tables or TABLES):
            src = _SOURCE[table]
            with conn.cursor() as cur:
                cur.execute(f'SELECT min(trade_date), max(trade_date) FROM {table} '
                            f'WHERE {src} IS NOT NULL')
                lo, hi = cur.fetchone()
            conn.commit()
            if lo is None:
                if verbose:
                    print(f'{table}: no rows with {src} — skipped')
                continue

            if verbose:
                print(f'{table} ({src}, {lo} .. {hi}):', flush=True)
            if table in _CHUNK_BY_YEAR:
                for yr in range(lo.year, hi.year + 1):
                    n = _run(conn, table, max(lo, date(yr, 1, 1)), min(hi, date(yr, 12, 31)))
                    total += n
                    if verbose:
                        print(f'    {yr}: {n:>9,} rows', flush=True)
            else:
                n = _run(conn, table, lo, hi)
                total += n
                if verbose:
                    print(f'    all: {n:>9,} rows', flush=True)
        return total
    finally:
        conn.close()


def verify(trade_date: str, tables=None, conn=None):
    own = conn is None
    conn = conn or get_conn()
    try:
        for table in (tables or TABLES):
            p, src = _PREFIX[table], _SOURCE[table]
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                # Latest bar ON OR BEFORE the date — weekly/monthly bars land on
                # a period end, so asking for an exact daily date finds nothing.
                cur.execute(f"""
                    WITH d AS (SELECT max(trade_date) td FROM {table} WHERE trade_date <= %s)
                    SELECT (SELECT td FROM d)                     AS bar,
                           count(*)                               AS rows,
                           count({src})                           AS with_rs,
                           count({p}_chg_5d)                      AS c5,
                           count({p}_chg_22d)                     AS c22,
                           count({p}_chg_66d)                     AS c66,
                           count({p}_align)                       AS aligned,
                           count(*) FILTER (WHERE {p}_align = 3)  AS rising_all,
                           count(*) FILTER (WHERE {p}_align IS NOT NULL
                                              AND ({p}_chg_5d IS NULL OR {p}_chg_22d IS NULL
                                                OR {p}_chg_66d IS NULL
                                                OR {p}_align NOT BETWEEN 0 AND 3)) AS bad
                    FROM {table} WHERE trade_date = (SELECT td FROM d)
                """, [trade_date])
                r = cur.fetchone()
            conn.commit()
            if not r or not r['bar']:
                print(f'{table:20} no bar on or before {trade_date}')
                continue
            inv = 'OK' if r['bad'] == 0 else f"VIOLATED on {r['bad']} rows"
            print(f"{table:20} bar {r['bar']}  rows {r['rows']:>6}  {src} {r['with_rs']:>6}  "
                  f"5/22/66 {r['c5']:>6}/{r['c22']:>6}/{r['c66']:>6}  "
                  f"align {r['aligned']:>6}  rising-all {r['rising_all']:>5}  "
                  f"invariant {inv}")
    finally:
        if own:
            conn.close()


def compute_magic_rs_momentum_for_date(db_conn, trade_date, verbose=False) -> int:
    """Pipeline entry point — the pipeline2 `magic_rs_momentum` dimension.

    Runs ALL FOUR tables for the date. Weekly and monthly only have a bar on a
    period end, so on most days those two update nothing and return 0 — which
    is correct, not a failure.

    Uses the connection it is handed rather than opening its own, so a forced
    run's column nullification and this write stay on one connection.
    """
    total = 0
    for table in TABLES:
        n = run_range(table, trade_date, trade_date, conn=db_conn)
        total += n
        if verbose:
            print(f'  [magic_rs_momentum] {table}: {n} rows for {trade_date}')
    return total


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--date', default=str(date.today()), help='Single trade date YYYY-MM-DD')
    p.add_argument('--from', dest='d_from', help='Range start YYYY-MM-DD')
    p.add_argument('--to', dest='d_to', help='Range end YYYY-MM-DD (default: --from)')
    p.add_argument('--table', choices=TABLES, help='Limit to one table (default: all four)')
    p.add_argument('--all', action='store_true', help='Full history')
    p.add_argument('--verify', action='store_true', help='Verify only, no write')
    args = p.parse_args()
    tables = [args.table] if args.table else TABLES

    if args.verify:
        verify(args.date, tables)
        return

    if args.all:
        print('Computing MagicRS momentum across full history...')
        print(f'Done — {run_all(tables):,} rows updated.\n')
        verify(args.date, tables)
        return

    d_from = args.d_from or args.date
    d_to = args.d_to or d_from
    total = sum(run_range(t, d_from, d_to) for t in tables)
    print(f'Updated {total:,} rows for {d_from} .. {d_to}\n')
    verify(d_to, tables)


if __name__ == '__main__':
    main()
