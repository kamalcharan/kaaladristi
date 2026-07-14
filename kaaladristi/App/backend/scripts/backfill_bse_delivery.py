"""
BSE Delivery Backfill (SCBSEALL)
================================
Backfills historical BSE delivery (delivery_qty / delivery_pct) into
km_equity_eod, reusing the Part A live feed (download_bse_delivery /
parse_bse_delivery). BSE ships the delivery percentage directly, so no
derivation is needed.

Design (per Part B scoping):
  * Resumable       — per-date status in a JSON progress log under data/
    (a docker volume, so it survives container restarts). A re-run skips dates
    already 'ok' and never restarts. No DB DDL, so no CREATE-privilege risk.
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
    cd /app   # (container workdir)
    python scripts/backfill_bse_delivery.py --years 2          # last 2 years
    python scripts/backfill_bse_delivery.py --years 26         # full history
    python scripts/backfill_bse_delivery.py --from 2024-07-01 --to 2026-07-10
    python scripts/backfill_bse_delivery.py --years 2 --retry-failed
    python scripts/backfill_bse_delivery.py --status           # progress summary only

From the VPS host:
    docker exec kd-pipeline-api2 python scripts/backfill_bse_delivery.py --years 2
"""

import sys
import os
import json
import time
import argparse
from datetime import date, timedelta

import psycopg2
import psycopg2.extras

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL
from pipeline.config import DATA_DIR
from pipeline.downloaders.bse_bhav import download_bse_delivery
from pipeline.processors.parser import parse_bse_delivery

PROGRESS_PATH = os.path.join(DATA_DIR, 'bse_delivery_backfill_progress.json')

# Statuses a plain re-run retries (transient). 'ok' is always skipped;
# 'not_found' / 'format_mismatch' are only retried with --retry-failed.
RETRYABLE_DEFAULT = {'network_error'}
RETRYABLE_ALL = {'network_error', 'not_found', 'format_mismatch', 'no_rows'}


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in env')
    return psycopg2.connect(DATABASE_URL, connect_timeout=30)


# ── File-backed progress log (no DDL / privilege needed) ─────────────────────

def _load_progress():
    try:
        with open(PROGRESS_PATH, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _save_progress(prog):
    os.makedirs(DATA_DIR, exist_ok=True)
    tmp = PROGRESS_PATH + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(prog, f)
    os.replace(tmp, PROGRESS_PATH)  # atomic — never leaves a half-written file


def _record(prog, trade_date, status, rows=None, error=None):
    prog[str(trade_date)] = {
        'status': status,
        'rows': rows,
        'error': (error or '')[:300] or None,
    }
    _save_progress(prog)


def print_status():
    prog = _load_progress()
    if not prog:
        print('BSE delivery backfill: no runs yet.')
        return
    agg = {}
    ok_dates = []
    for d, rec in prog.items():
        s = rec.get('status', '?')
        agg.setdefault(s, [0, 0])
        agg[s][0] += 1
        agg[s][1] += (rec.get('rows') or 0)
        if s == 'ok':
            ok_dates.append(d)
    print('BSE delivery backfill progress:')
    for s in sorted(agg):
        cnt, rowsum = agg[s]
        print(f'  {s:16s} {cnt:6d} dates   {int(rowsum):>12,} rows updated')
    if ok_dates:
        print(f'  ok span: {min(ok_dates)} .. {max(ok_dates)}')


# ── DB helpers (direct psycopg2, like the other backfill scripts) ────────────

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


def _parse_date(s):
    y, m, d = (int(x) for x in s.split('-'))
    return date(y, m, d)


def run(args):
    if args.status:
        print_status()
        return

    conn = get_conn()

    with conn.cursor() as cur:
        cur.execute("SELECT max(trade_date) FROM km_equity_eod")
        latest = cur.fetchone()[0]
    to_d = _parse_date(args.to_date) if args.to_date else latest
    from_d = _parse_date(args.from_date) if args.from_date \
        else to_d - timedelta(days=int(round(args.years * 365.25)))

    scrip_to_id = _bse_scrip_to_id(conn)
    print(f'[backfill] window {from_d} .. {to_d} | {len(scrip_to_id):,} BSE symbols in master')

    dates = _bse_trading_dates(conn, from_d, to_d)
    prog = _load_progress()
    retryable = RETRYABLE_ALL if args.retry_failed else RETRYABLE_DEFAULT

    def _should_do(d):
        rec = prog.get(str(d))
        if rec is None:
            return True
        return rec.get('status') != 'ok' and rec.get('status') in retryable

    todo = [d for d in dates if _should_do(d)]
    skipped = len(dates) - len(todo)
    print(f'[backfill] {len(dates)} BSE trading dates in window; '
          f'{skipped} already done/skipped; {len(todo)} to process '
          f'(delay {args.delay}s between dates)')

    n_ok = n_notfound = n_fmt = n_err = 0
    for i, d in enumerate(todo, 1):
        try:
            path = download_bse_delivery(d)
            if not path:
                _record(prog, d, 'not_found')
                n_notfound += 1
            else:
                deliv = parse_bse_delivery(path)
                if not deliv:
                    _record(prog, d, 'format_mismatch',
                            error='downloaded but no rows parsed (schema drift?)')
                    n_fmt += 1
                else:
                    updated = _apply_delivery(conn, d, deliv, scrip_to_id)
                    _record(prog, d, 'ok' if updated else 'no_rows', rows=updated)
                    if updated:
                        n_ok += 1
                    else:
                        n_fmt += 1
        except KeyboardInterrupt:
            print('\n[backfill] interrupted — progress saved, safe to resume.')
            break
        except Exception as e:
            try:
                conn.rollback()
            except Exception:
                pass
            _record(prog, d, 'network_error', error=str(e))
            n_err += 1
            print(f'  [{d}] error: {str(e)[:120]}')

        if i % 20 == 0 or i == len(todo):
            print(f'  [{i}/{len(todo)}] {d} | ok={n_ok} not_found={n_notfound} '
                  f'fmt/anom={n_fmt} err={n_err}')
        time.sleep(args.delay)

    print(f'[backfill] done. ok={n_ok} not_found={n_notfound} fmt/anom={n_fmt} err={n_err}')
    print_status()
    conn.close()


def main():
    ap = argparse.ArgumentParser(description='Backfill BSE delivery (SCBSEALL).')
    ap.add_argument('--years', type=float, default=2.0,
                    help='How many years back from the latest date (default 2).')
    ap.add_argument('--from', dest='from_date', help='Start date YYYY-MM-DD (overrides --years).')
    ap.add_argument('--to', dest='to_date', help='End date YYYY-MM-DD (default = latest EOD date).')
    ap.add_argument('--delay', type=float, default=3.0,
                    help='Seconds between dates (default 3, be polite).')
    ap.add_argument('--retry-failed', action='store_true',
                    help='Also retry not_found / format_mismatch dates.')
    ap.add_argument('--status', action='store_true', help='Print progress summary and exit.')
    run(ap.parse_args())


if __name__ == '__main__':
    main()
