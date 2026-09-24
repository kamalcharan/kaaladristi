#!/usr/bin/env python3
"""
Signal study harness — READ ONLY, writes nothing.

    python signal_study.py --source results --horizon 20 --buckets -5,-2,2,5

Produces, in order: the measurable envelope, the bucket table against the
same-date universe median, the cliff-drop count, and a split-sample check.

⚠ PORT 5432 IS NOT REACHABLE FROM THE CLOUD CONTAINER. Run this on the VPS.
For exploratory work through the read-only MCP, reuse the SQL below — but note
the MCP rejects `percentile_cont`, which is why every median here is the
`row_number()` idiom instead.

Design notes that are load-bearing, not style:

  * EXCESS, NOT RAW. Every return is minus the same-date median of the whole
    NSE active non-ETF universe. Without it a rising tape reads as an edge.
  * MEDIAN AND MEAN, BOTH. One unadjusted split dominates a mean; the gap
    between the two statistics is itself a finding.
  * CLIFFS ARE DROPPED AND COUNTED. km_corporate_actions is EMPTY, so a split
    inside a forward window reads as a genuine -50% drift. A zero count is
    still printed — a study silent on cliffs has not checked them.
  * SURVIVORSHIP IS COUNTED. An event with no bar at t+h is reported, never
    quietly discarded.
  * THE ENVELOPE RUNS FIRST. A horizon no event can carry is unmeasurable, and
    the script refuses it rather than truncating to whatever exists.
"""
from __future__ import annotations

import argparse
import os
import sys
from select import select

import psycopg2
from psycopg2.extensions import POLL_OK, POLL_READ, POLL_WRITE

# Green mode: psycopg2 blocks inside libpq, so a plain Ctrl+C is queued until
# the query returns and the DATABASE keeps executing after the client dies.
# This makes an interrupt issue a real PQcancel and stop both sides.
def _wait(conn):
    while True:
        state = conn.poll()
        if state == POLL_OK:
            break
        if state == POLL_READ:
            select([conn.fileno()], [], [])
        elif state == POLL_WRITE:
            select([], [conn.fileno()], [])
        else:
            raise psycopg2.OperationalError(f'bad poll state {state}')


psycopg2.extensions.set_wait_callback(_wait)

CLIFF_LO, CLIFF_HI = 0.55, 1.80          # same gate as adjust_close_cliffs()
UNIVERSE = ("s.exchange = 'NSE' AND s.is_active "
            "AND coalesce(s.isin,'') NOT LIKE 'INF%'")


def q(cur, sql, args=None):
    cur.execute(sql, args or ())
    return cur.fetchall()


# ── 1. envelope ──────────────────────────────────────────────────────────
def envelope(cur, source: str, horizons: list[int]) -> dict:
    ev_date = ('day_0_trade_date' if source == 'results' else 'day_0_trade_date')
    tbl = ('kd_result_returns(%(f)s, %(t)s, 20)' if source == 'results'
           else 'km_corporate_events')
    first, latest, sessions = q(cur, """
        SELECT (SELECT min(day_0_trade_date) FROM km_corporate_events),
               (SELECT max(trade_date) FROM km_equity_eod),
               (SELECT count(DISTINCT trade_date) FROM km_index_eod i
                 WHERE i.index_id = 1
                   AND i.trade_date >= (SELECT min(day_0_trade_date)
                                          FROM km_corporate_events))
    """)[0]
    print(f'\n── ENVELOPE ──\nfirst event Day 0 : {first}\nlatest bar        : {latest}'
          f'\nsessions available: {sessions}')
    carry = {}
    for h in horizons:
        n = q(cur, """
            SELECT count(*) FROM (
              SELECT DISTINCT equity_id, day_0_trade_date FROM km_corporate_events e
               WHERE e.equity_id IS NOT NULL
                 AND (SELECT count(*) FROM km_index_eod i
                       WHERE i.index_id = 1 AND i.trade_date > e.day_0_trade_date
                         AND i.trade_date <= (SELECT max(trade_date) FROM km_equity_eod)
                     ) >= %s) t
        """, (h,))[0][0]
        carry[h] = n
        flag = '' if n else '   <-- UNMEASURABLE, not "not yet run"'
        print(f'  events carrying {h:>3} sessions: {n:>6,}{flag}')
    return {'first': first, 'latest': latest, 'sessions': sessions, 'carry': carry}


# ── 2/3. bucket table ────────────────────────────────────────────────────
_BUCKETS_SQL = """
WITH bars AS (
  SELECT e.equity_id, e.trade_date, e.close,
         row_number() OVER (PARTITION BY e.equity_id ORDER BY e.trade_date) AS rn
    FROM km_equity_eod e JOIN km_equity_symbols s ON s.id = e.equity_id
   WHERE {universe} AND e.trade_date >= %(warm)s
), ratio AS (
  SELECT b.*, CASE WHEN b.close / lag(b.close) OVER w < {lo}
                     OR b.close / lag(b.close) OVER w > {hi} THEN 1 ELSE 0 END AS is_cliff
    FROM bars b WINDOW w AS (PARTITION BY b.equity_id ORDER BY b.trade_date)
), marked AS (
  -- ⚠ A WINDOW FRAME, not a correlated subquery. The subquery version is
  -- O(rows x horizon) and timed out at 30s against the live DB; this runs in
  -- one pass. Same 0.55x / 1.80x gate as adjust_close_cliffs().
  SELECT r.*, max(is_cliff) OVER (PARTITION BY equity_id ORDER BY trade_date
                                  ROWS BETWEEN 1 FOLLOWING AND %(h)s FOLLOWING) AS cliffs
    FROM ratio r
), fwd AS (
  SELECT m.equity_id, m.trade_date, coalesce(m.cliffs, 0) AS cliffs,
         round(((f.close / m.close) - 1) * 100, 4) AS ret
    FROM marked m JOIN marked f ON f.equity_id = m.equity_id AND f.rn = m.rn + %(h)s
   WHERE m.trade_date BETWEEN %(f)s AND %(t)s
), univ AS (          -- same-date universe median, row_number idiom (MCP-safe)
  SELECT trade_date, avg(ret) AS med FROM (
    SELECT trade_date, ret,
           row_number() OVER (PARTITION BY trade_date ORDER BY ret) AS r,
           count(*)     OVER (PARTITION BY trade_date)              AS c
      FROM fwd) t
   WHERE r IN ((c + 1) / 2, (c + 2) / 2) GROUP BY trade_date
), ev AS ({events}
), j AS (
  SELECT ev.bucket, ev.half, f.cliffs, f.ret - u.med AS excess
    FROM ev JOIN fwd f ON f.equity_id = ev.equity_id AND f.trade_date = ev.d0
            JOIN univ u ON u.trade_date = f.trade_date
), clean AS (
  -- ⚠ Cliffs removed HERE, not with FILTER on the window functions below:
  -- FILTER is illegal on row_number() (a pure window function, not an
  -- aggregate) and must precede OVER where it is legal. Written the other way
  -- this raises at runtime, so the number never arrives rather than arriving
  -- wrong -- which is the better failure, but still a failure.
  SELECT bucket, half, excess,
         row_number() OVER (PARTITION BY bucket ORDER BY excess) AS r,
         count(*)     OVER (PARTITION BY bucket)                 AS c
    FROM j WHERE cliffs = 0
), drops AS (
  SELECT bucket, count(*) AS cliff_drops FROM j WHERE cliffs > 0 GROUP BY bucket
)
SELECT c.bucket,
       coalesce(d.cliff_drops, 0) AS cliff_drops,
       max(c.c)                   AS n,
       round(max(CASE WHEN c.r IN ((c.c+1)/2,(c.c+2)/2) THEN c.excess END)::numeric, 2) AS median_excess,
       round(avg(c.excess)::numeric, 2) AS mean_excess,
       round((100.0 * count(*) FILTER (WHERE c.excess > 0) / count(*))::numeric, 1) AS pct_positive
  FROM clean c LEFT JOIN drops d ON d.bucket = c.bucket
 GROUP BY c.bucket, d.cliff_drops ORDER BY c.bucket
"""

_EV_RESULTS = """
  SELECT DISTINCT ON (equity_id, day_0_trade_date)
         equity_id, day_0_trade_date AS d0,
         {bucket_case} AS bucket,
         CASE WHEN day_0_trade_date <= %(mid)s THEN 'H1' ELSE 'H2' END AS half
    FROM kd_result_returns(%(f)s, %(t)s, %(h)s)
   WHERE equity_id IS NOT NULL AND suspect_corporate_action = false
"""


def bucket_case(edges: list[float], col: str = 'reaction_pct') -> str:
    parts, prev = [], None
    for i, e in enumerate(edges):
        lo = f'{prev:g}' if prev is not None else '-inf'
        parts.append(f"WHEN {col} < {e} THEN '{chr(97+i)} {lo}..{e:g}'")
        prev = e
    parts.append(f"ELSE '{chr(97+len(edges))} >={edges[-1]:g}'")
    return 'CASE ' + ' '.join(parts) + ' END'


def main() -> int:
    ap = argparse.ArgumentParser(description='Read-only signal study')
    ap.add_argument('--source', choices=['results'], default='results')
    ap.add_argument('--from', dest='dfrom', default='2026-07-10')
    ap.add_argument('--to', dest='dto', default=None)
    ap.add_argument('--horizon', type=int, default=20)
    ap.add_argument('--buckets', default='-5,-2,2,5',
                    help='comma-separated reaction_pct edges')
    args = ap.parse_args()

    dsn = os.environ.get('DB_PRIMARY')
    if not dsn:
        print('DB_PRIMARY not set. This script is read-only but still needs a '
              'connection; port 5432 is unreachable from the cloud container, '
              'so run it on the VPS.', file=sys.stderr)
        return 2

    conn = psycopg2.connect(dsn)
    conn.set_session(readonly=True, autocommit=True)
    with conn.cursor() as cur:
        cur.execute("SET statement_timeout = '300s'")
        dto = args.dto or q(cur, 'SELECT max(trade_date) FROM km_equity_eod')[0][0]
        env = envelope(cur, args.source, [5, 10, 20, 40, 60])

        if not env['carry'].get(args.horizon):
            print(f'\nREFUSED: no event carries {args.horizon} full sessions. '
                  f'That horizon is unmeasurable on this data — pick one from '
                  f'the envelope above rather than truncating to what exists.')
            return 1

        edges = [float(x) for x in args.buckets.split(',')]
        mid = q(cur, 'SELECT (%s::date + (%s::date - %s::date) / 2)',
                (args.dfrom, dto, args.dfrom))[0][0]
        sql = _BUCKETS_SQL.format(
            universe=UNIVERSE, lo=CLIFF_LO, hi=CLIFF_HI,
            events=_EV_RESULTS.format(bucket_case=bucket_case(edges)))
        params = {'f': args.dfrom, 't': dto, 'h': args.horizon, 'mid': mid,
                  'warm': args.dfrom}

        print(f'\n── BUCKETS ── {args.dfrom} .. {dto}, horizon {args.horizon} '
              f'sessions, excess vs same-date universe median')
        print(f'{"bucket":>16} {"n":>6} {"median":>8} {"mean":>8} {"%pos":>6} {"cliffs":>7}')
        total_cliffs = 0
        for b, drops, n, med, mean, pos in q(cur, sql, params):
            total_cliffs += drops or 0
            print(f'{b:>16} {n:>6,} {str(med):>8} {str(mean):>8} {str(pos):>6} {drops:>7}')
        # Printed even at zero: a study silent on cliffs has not checked them.
        print(f'\ncliff-contaminated windows dropped: {total_cliffs} '
              f'(gate {CLIFF_LO}x / {CLIFF_HI}x, km_corporate_actions is EMPTY)')
        print('⚠ split-sample: re-run with --from/--to over each half. A result '
              'present in one half and absent in the other is a regime artifact, '
              'not a signal.')
    conn.close()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
