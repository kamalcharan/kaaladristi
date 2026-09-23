"""
ONE-SHOT REPAIR — 2026-09-23. Delete this file once it has been run.

WHAT IT FIXES
-------------
The 09-16 / 09-22 cascade deadlock left w52_high/w52_low NULL, which demoted
every S2 row to S2_CANDIDATE. `stage` was then repaired by hand with
backfill_stage_classification.py, which writes `stage` AND NOTHING ELSE.

stage_since / stage_since_close / pct_from_stage_entry / stage_run_bars are a
FORWARD CARRY -- each bar reads the single prior classified bar and either
extends its run or opens a new one. So the label came back while the entry
family still held what it derived from the demoted label, on 09-16 and on
every bar since. Measured on the 09-22 bar: every S2 name reads "in stage
since 22 Sept", entry price = that day's close, 0.00% since entry. TBZ's real
S2 run began 2026-07-31 at Rs 276.34 -- a 141% move, displayed as zero.

  bar      mean run   max run   oldest entry
  09-15      27.4       161     2025-10-15   <- intact, seeds the chain
  09-16       1.1        24     2026-08-13
  09-17       1.0         1     2026-09-17
  09-18       1.9         2     2026-09-17
  09-21       2.8         3     2026-09-17
  09-22       1.1        24     2026-05-14

WHAT IT DOES
------------
Calls compute_stage_entry_for_date -- the exact function pipeline2's nightly
handler already runs on every bar -- once per affected session, ASCENDING.
No new logic. Nothing on the nightly path changes.

Ascending and contiguous is load-bearing: the carry is a chain, so replaying
out of order, or skipping a session, hands a bar a predecessor that still
holds the old answer and writes a wrong result with no error. Dates come from
the table, so a holiday cannot be guessed wrong.

It writes SEVEN DERIVED COLUMNS only -- stage_since, stage_since_close,
pct_from_stage_entry, stage_bars, stage_run_bars, stage_confirmed,
stage_since_censored. It does not touch `stage`, `close`, or anything a
scanner filters membership on.

    cd App/backend
    # 1. back up first -- App/backend/scripts/repair_stage_entry_20260923.sql, STEP 1
    python scripts/repair_stage_entry_20260923.py
    # 2. verify -- same file, STEP 3.  Rollback is STEP 2.
"""

import os
import sys

import psycopg2

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL                        # noqa: E402
from scripts.backfill_stage_entry import (                 # noqa: E402
    compute_stage_entry_for_date,
)

# First damaged bar. 09-15 and 09-11 are intact and seed the chain.
START = '2026-09-16'


def main() -> int:
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in App/.env')

    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT DISTINCT trade_date FROM km_equity_eod
                WHERE trade_date >= %s
                  AND stage IS NOT NULL AND stage <> 'UNKNOWN'
                ORDER BY trade_date
            """, (START,))
            dates = [r[0] for r in cur.fetchall()]
        conn.commit()
    finally:
        conn.close()

    if not dates:
        print(f'[repair] no classified bars on or after {START} — nothing to do.')
        return 0

    print(f'\n[repair] replaying the stage-entry carry over {len(dates)} '
          f'sessions, ascending: {dates[0]} → {dates[-1]}')
    print('  Each bar reads the one before it, so order matters.\n')

    total = 0
    for d in dates:
        n = compute_stage_entry_for_date(None, d)
        total += n
        print(f'  {d}  {n:>9,} rows', flush=True)
        if n == 0:
            # Continuing would write a wrong answer onto every later bar.
            print(f'\n  ✗ {d} updated ZERO rows. Stopping — the seed bar was '
                  f'not found, and the remaining sessions would be computed '
                  f'from bad inputs. Nothing after this date was touched.')
            return 1

    print(f'\n  Done — {total:,} rows rewritten.')
    print('  Now run STEP 3 of scripts/repair_stage_entry_20260923.sql to verify.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
