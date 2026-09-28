"""
Backfill the read for historical material filings
=================================================
    python3 scripts/backfill_filing_reads.py --from 2026-03-28
    python3 scripts/backfill_filing_reads.py --from 2026-03-28 --limit 500 --budget 50
    python3 scripts/backfill_filing_reads.py --status          # counts, no reads

Owner, 2026-09-28: six months of history, "else there wont be any data to
cross check". Measured: 5,252 material events since 2026-03-28.

Resumable by construction — it reads rows that are `pending` (or `failed`
under the attempt cap) and nothing else, so a stopped run continues where it
left off. Serial, one request in flight. `--budget` caps USD spent in THIS
run from the per-row cost column; `--limit` caps rows. Progress prints every
row, with a running cost, because a backfill that is silent for an hour
cannot be told from a hung one.

⚠ Runs on the VPS (needs a route to nseindia.com for the PDFs). The scheduled
ingest passes read newest-first with their own cap, so a live filing is never
queued behind this backlog.
"""

import argparse
import logging
import os
import sys
import time
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from lib.config import DATABASE_URL                      # noqa: E402
from lib import filing_reader as fr                      # noqa: E402


def main():
    ap = argparse.ArgumentParser(description='Read historical material filings')
    ap.add_argument('--from', dest='dfrom', default='2026-03-28',
                    help='enqueue material events disseminated on/after this date')
    ap.add_argument('--limit', type=int, default=10000, help='max rows this run')
    ap.add_argument('--budget', type=float, default=None, help='max USD this run')
    ap.add_argument('--model', default=fr.MODEL)
    ap.add_argument('--status', action='store_true', help='print counts and exit')
    ap.add_argument('--no-retry', action='store_true', help='skip rows that failed before')
    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format='%(message)s')

    import psycopg2
    conn = psycopg2.connect(DATABASE_URL)
    try:
        if args.status:
            print(fr.status_counts(conn))
            return
        since = date.fromisoformat(args.dfrom)
        n = fr.enqueue_pending(conn, since=f'{since} 00:00+05:30')
        released = fr.release_stale_reading(conn)
        counts = fr.status_counts(conn)
        print(f'enqueued {n:,} new · released {released} stale · {counts}')
        if not fr.has_api_key():
            print('ANTHROPIC_API_KEY not set — nothing read'); return

        t0 = time.time()

        def progress(s):
            done = s['read']
            rate = done / max(time.time() - t0, 1)
            print(f"  {done:>5} read  done {s['done']:>5}  failed {s['failed']:>4}  "
                  f"unreadable {s['unreadable']:>4}  ${s['cost_usd']:.2f}  "
                  f"{rate * 60:.1f}/min", flush=True)

        stats = fr.read_pending(conn, limit=args.limit, budget_usd=args.budget,
                                model=args.model, retry_failed=not args.no_retry,
                                on_progress=progress)
        print(f"\n{stats}\nremaining: {fr.status_counts(conn)}")
    finally:
        conn.close()


if __name__ == '__main__':
    main()
