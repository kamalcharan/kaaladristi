"""
NSE Delivery Backfill (sec_bhavdata_full)
=========================================
Backfills historical NSE delivery (delivery_qty / delivery_pct) into
km_equity_eod, reusing the live daily feed (download_nse_delivery /
parse_nse_delivery). The NSE twin of scripts/backfill_bse_delivery.py, which
has existed since the BSE gap was closed; nothing equivalent existed for NSE.

WHY THIS EXISTS

Delivery data does not exist in km_equity_eod before 2024-06-03 on NSE --
delivery_qty is 0, not merely NULL, on every earlier bar. That is an INGESTION
gap, not a compute gap: no amount of recomputation recovers it, because the
numbers were never downloaded. Everything built on delivered value inherits
that floor:

  * Big Money days (migration 200) cannot be detected before it
  * delivery_surge_x, avg_amt_5d/22d/66d and deliv_value_cr are all 0 before it
  * every scanner gating on delivery reads a ~15-month universe

NSE publishes sec_bhavdata_full daily and keeps the archive, so the depth is
recoverable -- one polite pass per historical trading date.

AFTER THIS RUNS, in order:
    python scripts/backfill_rolling_metrics_fast.py     # deliv_value_cr, avg_amt_*
    python scripts/backfill_big_money.py --restart      # now sees the deeper history
    REFRESH MATERIALIZED VIEW km_scan_results;

Design (mirrors backfill_bse_delivery.py deliberately -- two scripts doing the
same job in two shapes is how they drift):
  * Resumable       -- per-date status in a JSON progress log under data/ (a
                       docker volume, so it survives container restarts). A
                       re-run skips dates already 'ok' and never restarts.
  * Rate-limited    -- polite delay between dates. NSE throttles aggressively
                       and a thousand-date run is exactly the shape it
                       throttles; the default here is 4s, higher than the BSE
                       script's 3s, for that reason.
  * Session reuse   -- ONE NseSession across the whole run. NSE hands out
                       cookies per session and re-initialising them on every
                       date is both slow and the fastest way to get blocked.
  * Format-drift    -- a downloaded-but-unparseable file is logged as
                       'format_mismatch', distinct from 'download_failed',
                       never silently skipped.
  * Background-safe -- standalone; does NOT touch the nightly pipeline. Safe to
                       interrupt (Ctrl-C) and resume.

ONE HONEST DIFFERENCE FROM THE BSE SCRIPT. download_nse_delivery() catches its
own exceptions and returns None, so a 404 (holiday, archive purged) and a
network error arrive here identically. They are recorded as one status,
'download_failed', rather than pretending to tell them apart -- and that status
IS retried by default, since the more common cause on a real trading date is
transient. Only dates that already have NSE EOD rows are iterated, so genuine
holidays never enter the list in the first place.

Only dates that already have NSE EOD rows are processed (delivery UPDATEs
existing rows; it never inserts partial rows).

Usage (inside the backend container -- has DB env + code):
    cd /app   # (container workdir)
    python scripts/backfill_nse_delivery.py --years 6           # the 6-year target
    python scripts/backfill_nse_delivery.py --from 2020-09-01 --to 2024-06-02
    python scripts/backfill_nse_delivery.py --years 6 --retry-failed
    python scripts/backfill_nse_delivery.py --status            # progress summary only

From the VPS host:
    docker exec kd-pipeline-api2 python scripts/backfill_nse_delivery.py --years 6

Six years is roughly 1,480 trading dates. At the default 4s delay plus download
time that is on the order of 3-4 hours -- run it detached (nohup / docker exec
-d) and check back with --status.
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
from pipeline.downloaders.nse_bhav import download_nse_delivery
from pipeline.processors.parser import parse_nse_delivery
from pipeline.utils.nse_session import NseSession

PROGRESS_PATH = os.path.join(DATA_DIR, 'nse_delivery_backfill_progress.json')

# Statuses a plain re-run retries. 'ok' is always skipped. Unlike the BSE
# script, 'download_failed' is retryable by DEFAULT -- see the header: it
# conflates a transient failure with a missing archive, and on a date that
# already has NSE EOD rows the transient reading is the likelier one.
RETRYABLE_DEFAULT = {'download_failed'}
RETRYABLE_ALL = {'download_failed', 'format_mismatch', 'no_rows'}


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
        print('NSE delivery backfill: no runs yet.')
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
    print('NSE delivery backfill progress:')
    for s in sorted(agg):
        cnt, rowsum = agg[s]
        print(f'  {s:16s} {cnt:6d} dates   {int(rowsum):>12,} rows updated')
    if ok_dates:
        print(f'  ok span: {min(ok_dates)} .. {max(ok_dates)}')


# ── DB helpers (direct psycopg2, like the other backfill scripts) ────────────

def _nse_symbol_to_id(conn):
    """Map NSE ticker (== km_equity_symbols.symbol) -> equity_id.

    Upper-cased on both sides: parse_nse_delivery upper-cases what it reads
    out of the CSV, and a master row that differs only in case would otherwise
    silently never match.
    """
    with conn.cursor() as cur:
        cur.execute("SELECT symbol, id FROM km_equity_symbols WHERE exchange = 'NSE'")
        return {str(sym).strip().upper(): eid for sym, eid in cur.fetchall()}


def _nse_trading_dates(conn, from_d, to_d):
    """Distinct NSE trading dates in the window (dates that have NSE EOD rows).

    Driving off rows we already hold is what keeps holidays out of the list --
    the difference between a run that reports 1,480 successes and one that
    reports 1,480 successes plus 700 phantom failures.
    """
    with conn.cursor() as cur:
        cur.execute(
            """SELECT DISTINCT e.trade_date
                 FROM km_equity_eod e
                 JOIN km_equity_symbols s ON s.id = e.equity_id
                WHERE s.exchange = 'NSE'
                  AND e.trade_date BETWEEN %s AND %s
                ORDER BY e.trade_date""",
            (from_d, to_d),
        )
        return [r[0] for r in cur.fetchall()]


def _apply_delivery(conn, trade_date, deliv_map, symbol_to_id):
    """UPDATE delivery_qty/delivery_pct on existing NSE km_equity_eod rows.

    Inherited behaviour worth knowing: parse_nse_delivery keys purely by
    SYMBOL, so where sec_bhavdata_full carries several series for one ticker
    (EQ and BE, say) the last row read wins. That is exactly what the nightly
    pipeline does with the same function, and matching it is the point -- a
    backfill that resolved series differently would leave history and
    going-forward data subtly inconsistent.
    """
    rows = []
    for symbol, d in deliv_map.items():
        eid = symbol_to_id.get(str(symbol).strip().upper())
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

    symbol_to_id = _nse_symbol_to_id(conn)
    print(f'[backfill] window {from_d} .. {to_d} | {len(symbol_to_id):,} NSE symbols in master')

    dates = _nse_trading_dates(conn, from_d, to_d)
    prog = _load_progress()
    retryable = RETRYABLE_ALL if args.retry_failed else RETRYABLE_DEFAULT

    def _should_do(d):
        rec = prog.get(str(d))
        if rec is None:
            return True
        return rec.get('status') != 'ok' and rec.get('status') in retryable

    todo = [d for d in dates if _should_do(d)]
    skipped = len(dates) - len(todo)
    print(f'[backfill] {len(dates)} NSE trading dates in window; '
          f'{skipped} already done/skipped; {len(todo)} to process '
          f'(delay {args.delay}s between dates)')

    # ONE session for the whole run. NseSession initialises cookies on first
    # use and reuses them; constructing one per date would re-run that
    # handshake ~1,500 times, which is slow and is the pattern NSE blocks.
    session = NseSession()

    n_ok = n_dl = n_fmt = n_err = 0
    for i, d in enumerate(todo, 1):
        try:
            path = download_nse_delivery(d, session=session)
            if not path:
                # See the header: 404 and network error are indistinguishable
                # here because the downloader swallows its own exceptions.
                _record(prog, d, 'download_failed')
                n_dl += 1
            else:
                deliv = parse_nse_delivery(path)
                if not deliv:
                    _record(prog, d, 'format_mismatch',
                            error='downloaded but no rows parsed (schema drift?)')
                    n_fmt += 1
                else:
                    updated = _apply_delivery(conn, d, deliv, symbol_to_id)
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
            _record(prog, d, 'download_failed', error=str(e))
            n_err += 1
            print(f'  [{d}] error: {str(e)[:120]}')

        if i % 20 == 0 or i == len(todo):
            print(f'  [{i}/{len(todo)}] {d} | ok={n_ok} dl_failed={n_dl} '
                  f'fmt/anom={n_fmt} err={n_err}')
        time.sleep(args.delay)

    print(f'[backfill] done. ok={n_ok} dl_failed={n_dl} fmt/anom={n_fmt} err={n_err}')
    print_status()
    print('\nNext, to turn the deeper delivery history into deeper signals:')
    print('  python scripts/backfill_rolling_metrics_fast.py')
    print('  python scripts/backfill_big_money.py --restart')
    print('  REFRESH MATERIALIZED VIEW km_scan_results;')
    conn.close()


def main():
    ap = argparse.ArgumentParser(
        description='Backfill NSE delivery (sec_bhavdata_full) into km_equity_eod.')
    ap.add_argument('--years', type=float, default=6.0,
                    help='How many years back from the latest date (default 6).')
    ap.add_argument('--from', dest='from_date', help='Start date YYYY-MM-DD (overrides --years).')
    ap.add_argument('--to', dest='to_date', help='End date YYYY-MM-DD (default = latest EOD date).')
    ap.add_argument('--delay', type=float, default=4.0,
                    help='Seconds between dates (default 4 — NSE throttles harder than BSE).')
    ap.add_argument('--retry-failed', action='store_true',
                    help='Also retry format_mismatch / no_rows dates.')
    ap.add_argument('--status', action='store_true', help='Print progress summary and exit.')
    run(ap.parse_args())


if __name__ == '__main__':
    main()
