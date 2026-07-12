"""
BSE Delivery Backfill (SCBSEALL)
================================
Backfills historical BSE delivery (delivery_qty / delivery_pct) into
km_equity_eod, reusing the Part A live feed (download_bse_delivery /
parse_bse_delivery). BSE ships the delivery percentage directly, so no
derivation is needed.

Design (per Part B scoping):
  * Resumable       — per-date status in bse_delivery_backfill_progress; a
                      re-run skips dates already 'ok' and never restarts.
  * Rate-limited    — polite delay between dates (default 3s) so BSE isn't
                      hammered over thousands of requests.
  * Format-drift    — a downloaded-but-unparseable file is logged as
                      'format_mismatch', distinct from 'not_found' (404) and
                      'network_error' (exception), never silently skipped.
  * Background-safe — standalone; does NOT touch the nightly pipeline. Safe to
                      interrupt (Ctrl-C) and resume.

Only dates that already have BSE EOD rows are processed (delivery UPDATEs
existing rows; it never inserts partial rows).

Usage (inside the backend container — has DB env + code):
    cd App/backend
    python scripts/backfill_bse_delivery.py --years 2          # last 2 years
    python scripts/backfill_bse_delivery.py --years 26         # full history
    python scripts/backfill_bse_delivery.py --from 2024-07-01 --to 2026-07-10
    python scripts/backfill_bse_delivery.py --years 2 --retry-failed
    python scripts/backfill_bse_delivery.py --status           # progress summary only

From the container on the VPS:
    docker exec kd-pipeline-api2 python scripts/backfill_bse_delivery.py --years 2
"""

import sys
import os
import time
import argparse
from datetime import date, timedelta

import psycopg2
import psycopg2.extras

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL
from pipeline.downloaders.bse_bhav import download_bse_delivery
from pipeline.processors.parser import parse_bse_delivery

PROGRESS_DDL = """
CREATE TABLE IF NOT EXISTS bse_delivery_backfill_progress (
    trade_date    DATE PRIMARY KEY,
    status        TEXT NOT NULL,
    delivery_rows INTEGER,
    error         TEXT,
    attempted_at  TIMESTAMPTZ DEFAULT now()
);
"""

# Statuses that a plain re-run will retry (transient). 'ok' is always skipped;
# 'not_found' / 'format_mismatch' are only retried with --retry-failed.
RETRYABLE_DEFAULT = {'network_error'}
RETRYABLE_ALL = {'network_error', 'not_found', 'format_mismatch', 'no_rows'}


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(DATABASE_URL, connect_timeout=30)


def _ensure_progress_table(conn):
    with conn.cursor() as cur:
        cur.execute(PROGRESS_DDL)
    conn.commit()


def _load_progress(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT trade_date, status FROM bse_delivery_backfill_progress")
        return {str(r[0]): r[1] for r in cur.fetchall()}


def _record(conn, trade_date, status, rows=None, error=None):
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO bse_delivery_backfill_progress
                 (trade_date, status, delivery_rows, error, attempted_at)
               VALUES (%s, %s, %s, %s, now())
               ON CONFLICT (trade_date) DO UPDATE
                 SET status = EXCLUDED.status,
                     delivery_rows = EXCLUDED.delivery_rows,
                     error = EXCLUDED.error,
                     attempted_at = now()""",
            (trade_date, status, rows, (error or '')[:500]),
        )
    conn.commit()


def _bse_scrip_to_id(conn):
    """Map BSE scrip code (== km_equity_symbols.symbol) -> equity_id."""
    with conn.cursor() as cur:
        cur.execute("SELECT symbol, id FROM km_equity_symbols WHERE exchange = 'BSE'")
        return {str(sym).strip(): eid for sym, eid in cur.fetchall()}


def _bse_trading_dates(conn, from_d, to_d):
    """Distinct BSE trading dates in the window (dates that have BSE EOD rows)."""
    with conn.cursor() as cur:
        cur.execute(
            """SELECT DISTINCT e.trade_date
                 FROM km_equity_eod e
                 JOIN km_equity_symbols s ON s.id = e.equity_id
                WHERE s.exchange = 'BSE'
                  AND e.trade_date BETWEEN %s AND %s
                ORDER BY e.trade_date""",
            (from_d, to_d),
        )
        return [r[0] for r in cur.fetchall()]


def _apply_delivery(conn, trade_date, deliv_map, scrip_to_id):
    """UPDATE delivery_qty/delivery_pct on existing BSE km_equity_eod rows."""
    rows = []
    for scrip, d in deliv_map.items():
        eid = scrip_to_id.get(str(scrip).strip())
        if eid is None:
            continue
        rows.append((eid, str(trade_date), d.get('delivery_qty'), d.get('delivery_pct')))
    if not rows:
        return 0
    with conn.cursor() as cur:
        psycopg2.extras.execute_values(
            cur,
            """UPDATE km_equity_eod AS e
                 SET delivery_qty = v.dq, delivery_pct = v.dp
                FROM (VALUES %s) AS v(equity_id, td, dq, dp)
                WHERE e.equity_id = v.equity_id AND e.trade_date = v.td::date""",
            rows,
            template="(%s, %s, %s, %s)",
        )
        n = cur.rowcount
    conn.commit()
    return n


def print_status(conn):
    _ensure_progress_table(conn)
    with conn.cursor() as cur:
        cur.execute(
            "SELECT status, count(*), COALESCE(sum(delivery_rows), 0) "
            "FROM bse_delivery_backfill_progress GROUP BY status ORDER BY status")
        rows = cur.fetchall()
        cur.execute("SELECT min(trade_date), max(trade_date) "
                    "FROM bse_delivery_backfill_progress WHERE status = 'ok'")
        span = cur.fetchone()
    print("BSE delivery backfill progress:")
    if not rows:
        print("  (no runs yet)")
        return
    for status, cnt, rowsum in rows:
        print(f"  {status:16s} {cnt:6d} dates   {int(rowsum):>12,} rows updated")
    if span and span[0]:
        print(f"  ok span: {span[0]} .. {span[1]}")


def run(args):
    conn = get_conn()
    _ensure_progress_table(conn)

    if args.status:
        print_status(conn)
        return

    # Resolve window
    with conn.cursor() as cur:
        cur.execute("SELECT max(trade_date) FROM km_equity_eod")
        latest = cur.fetchone()[0]
    to_d = _parse_date(args.to_date) if args.to_date else latest
    if args.from_date:
        from_d = _parse_date(args.from_date)
    else:
        from_d = to_d - timedelta(days=int(round(args.years * 365.25)))

    scrip_to_id = _bse_scrip_to_id(conn)
    print(f"[backfill] window {from_d} .. {to_d} | {len(scrip_to_id):,} BSE symbols in master")

    dates = _bse_trading_dates(conn, from_d, to_d)
    progress = _load_progress(conn)
    retryable = RETRYABLE_ALL if args.retry_failed else RETRYABLE_DEFAULT

    todo = [d for d in dates
            if progress.get(str(d)) != 'ok' and (str(d) not in progress
                                                 or progress[str(d)] in retryable)]
    skipped = len(dates) - len(todo)
    print(f"[backfill] {len(dates)} BSE trading dates in window; "
          f"{skipped} already done/skipped; {len(todo)} to process "
          f"(delay {args.delay}s between dates)")

    n_ok = n_notfound = n_fmt = n_err = 0
    for i, d in enumerate(todo, 1):
        try:
            path = download_bse_delivery(d)
            if not path:
                _record(conn, d, 'not_found')
                n_notfound += 1
            else:
                deliv = parse_bse_delivery(path)
                if not deliv:
                    _record(conn, d, 'format_mismatch',
                            error='downloaded but no rows parsed (schema drift?)')
                    n_fmt += 1
                else:
                    updated = _apply_delivery(conn, d, deliv, scrip_to_id)
                    _record(conn, d, 'ok' if updated else 'no_rows', rows=updated)
                    if updated:
                        n_ok += 1
                    else:
                        n_fmt += 1  # parsed but nothing matched — treat as anomaly
        except KeyboardInterrupt:
            print("\n[backfill] interrupted — progress saved, safe to resume.")
            break
        except Exception as e:
            try:
                conn.rollback()
            except Exception:
                pass
            _record(conn, d, 'network_error', error=str(e))
            n_err += 1
            print(f"  [{d}] error: {str(e)[:120]}")

        if i % 20 == 0 or i == len(todo):
            print(f"  [{i}/{len(todo)}] {d} | ok={n_ok} not_found={n_notfound} "
                  f"fmt/anom={n_fmt} err={n_err}")
        time.sleep(args.delay)

    print(f"[backfill] done. ok={n_ok} not_found={n_notfound} "
          f"fmt/anom={n_fmt} err={n_err}")
    print_status(conn)
    conn.close()


def _parse_date(s):
    y, m, d = (int(x) for x in s.split('-'))
    return date(y, m, d)


def main():
    ap = argparse.ArgumentParser(description="Backfill BSE delivery (SCBSEALL).")
    ap.add_argument('--years', type=float, default=2.0,
                    help='How many years back from the latest date (default 2).')
    ap.add_argument('--from', dest='from_date', help='Start date YYYY-MM-DD (overrides --years).')
    ap.add_argument('--to', dest='to_date', help='End date YYYY-MM-DD (default = latest EOD date).')
    ap.add_argument('--delay', type=float, default=3.0,
                    help='Seconds to wait between dates (default 3, be polite).')
    ap.add_argument('--retry-failed', action='store_true',
                    help='Also retry not_found / format_mismatch dates.')
    ap.add_argument('--status', action='store_true', help='Print progress summary and exit.')
    run(ap.parse_args())


if __name__ == '__main__':
    main()
