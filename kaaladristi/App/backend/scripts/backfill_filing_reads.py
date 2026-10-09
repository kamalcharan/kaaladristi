"""
Read filings now, outside the scheduled passes
==============================================
    python3 scripts/backfill_filing_reads.py --from 2026-09-01 --tier high --backend anthropic --budget 15
    python3 scripts/backfill_filing_reads.py --from 2026-09-01 --limit 500
    python3 scripts/backfill_filing_reads.py --status          # counts, no reads

Owner, 2026-10-09: "complete sept and oct — invoke haiku now and close them
… after that they will go as per what we have now". So:

* The queue step runs over ALL history first (prepare_queue): every filing
  gets a row and a tier, routine ones get their by-type verdict (no model),
  and a non-routine filing before FILING_READ_FROM (2026-09-01) is recorded
  'not analysed' — the owner's "mark Aug for not to analyse".
* `--from` limits what THIS run READS (filings disseminated on/after it).
* `--tier high|low` limits it to one tier.
* `--backend anthropic` reads with the Anthropic SDK (Haiku) for this run
  only, whatever FILING_READ_BACKEND says; the scheduled passes keep the
  lanes. Needs ANTHROPIC_API_KEY. `--budget` caps USD spent in this run.

Resumable by construction — it reads rows that are `pending` (or `failed`
under the attempt cap) and nothing else, so a stopped run continues where it
left off. Serial, one request in flight. Progress prints every row, with a
running cost, because a backfill that is silent for an hour cannot be told
from a hung one.

⚠ Runs on the VPS (needs a route to nseindia.com for the PDFs). The API
thread's runner keeps reading current filings meanwhile, on the lanes, so a
few rows in range may be read there instead — both write the same verdict.
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
    ap.add_argument('--from', dest='dfrom', default=fr.READ_FROM,
                    help='read filings disseminated on/after this date')
    ap.add_argument('--tier', choices=('high', 'low'), default=None, help='read only this tier')
    ap.add_argument('--backend', choices=('anthropic', 'local'), default=None,
                    help='read with this backend for this run (default: FILING_READ_BACKEND)')
    ap.add_argument('--limit', type=int, default=10000, help='max rows this run')
    ap.add_argument('--budget', type=float, default=None, help='max USD this run')
    ap.add_argument('--model', default=None, help='default: the backend\'s own model')
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
        since = f'{date.fromisoformat(args.dfrom)} 00:00+05:30'
        q = fr.prepare_queue(conn)
        if q['skipped']:
            print(q['skipped']); return
        released = fr.release_stale_reading(conn)
        print(f"queued {q['queued']:,} new · {q['routine']:,} routine settled by type · "
              f"{q['retiered']:,} re-tiered · released {released} stale · {fr.status_counts(conn)}")

        backend = args.backend or fr.BACKEND
        client = None
        if args.backend == 'anthropic':
            if not fr.has_api_key():
                print('ANTHROPIC_API_KEY not set — nothing read'); return
            import anthropic
            client = anthropic.Anthropic(api_key=fr._api_key())
        elif args.backend == 'local':
            client = fr.local_client()
        else:
            missing = fr.backend_missing()
            if missing:
                print(f'{missing} — nothing read'); return
        model = args.model or fr._resolve_model(backend)
        print(f'backend {backend} · model {model} · reading from {args.dfrom}'
              + (f' · tier {args.tier}' if args.tier else '')
              + (f' · ctx {fr.LOCAL_CTX_TOKENS} · {fr.LOCAL_URL}' if backend == 'local' else ''))

        t0 = time.time()

        def progress(s):
            done = s['read']
            rate = done / max(time.time() - t0, 1)
            print(f"  {done:>5} read  done {s['done']:>5}  triaged {s['triaged']:>5}  "
                  f"failed {s['failed']:>4}  unreadable {s['unreadable']:>4}  "
                  f"${s['cost_usd']:.2f}  {rate * 60:.1f}/min", flush=True)

        # max_seconds=0: the backfill is the deliberate long run; the wall-clock
        # cap exists for the scheduled pass that shares the pipeline worker.
        stats = fr.read_pending(conn, client=client, limit=args.limit, budget_usd=args.budget,
                                model=model, retry_failed=not args.no_retry,
                                on_progress=progress, max_seconds=0, tier=args.tier, since=since,
                                backend=backend if client is not None else None)
        print(f"\n{stats}\nremaining: {fr.status_counts(conn)}")
    finally:
        conn.close()


if __name__ == '__main__':
    main()
