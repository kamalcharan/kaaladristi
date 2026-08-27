"""
Stage Entry Backfill — when a stock entered its stage, and at what price
=======================================================================
Writes km_equity_eod.stage_confirmed / stage_since / stage_since_close /
stage_bars / pct_from_stage_entry / stage_run_bars / stage_since_censored
(migration 191).

THE DEFINITION
--------------
The raw `stage` label flickers hard around the 200-SMA -- measured over 120
symbols x 20 months, 52% of contiguous runs last 3 bars or fewer and 29% last
a single bar. Reading the entry date off the raw run therefore gives dates
that are technically true and practically useless (ABB: "Stage 2 since
2026-07-15 @ 7,204.50", +5.6%, when the turn is 2026-03-04 @ 5,830.50, +30.5%).

So a stage becomes CONFIRMED only once it has held MIN_SPELL bars. Shorter
spells inherit the previous confirmed stage instead of resetting the clock.
On confirmation the entry is backdated to the FIRST bar of that raw run --
the date the turn actually happened, not the date it was proven.

The rule is CAUSAL. A spell confirms on its MIN_SPELL-th bar using only bars
up to that point (run_pos, the position WITHIN the run, never the run's total
length). That is what lets the nightly O(1) step and a full-history rebuild
produce identical rows: neither can see the future. Using the run's total
length instead would confirm a spell retroactively from its first bar and the
two paths would disagree on every historical row.

Bars with stage NULL or 'UNKNOWN' are skipped entirely -- both mean "sma_200
does not exist yet", and a stock cannot be in a stage that could not be
computed.

Usage:
    cd App/backend

    # Full history, symbol-batched (the only safe batching -- see below)
    python scripts/backfill_stage_entry.py

    # Smaller batches if the box is tight
    python scripts/backfill_stage_entry.py --batch-size 100

    # Read-only summary of what is currently stored
    python scripts/backfill_stage_entry.py --verify

WHY SYMBOL-BATCHED AND NOT DATE-BATCHED
---------------------------------------
Every window here is PARTITION BY equity_id over the symbol's whole history.
Chunking by DATE would hand each chunk a truncated history, so a spell that
began before the chunk would look like it began at the chunk boundary -- a
silent wrong answer, not an error. Chunking by SYMBOL keeps each partition
complete. This is the same lesson the rolling-metrics backfill learned when
date-chunking corrupted lifetime_high.
"""

import os
import sys
import time
import argparse

import psycopg2
import psycopg2.extras

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL

# Bars a stage must hold before it counts. Chosen on the run-length
# distribution (60 symbols, 4.5y, 3,582 runs): >=5 keeps 1,515 runs, >=10
# keeps 942, >=15 keeps 700, >=20 keeps 543. Ten discards three quarters of
# the noise and still confirms a fresh Stage 2 inside a fortnight; twenty
# would delay every new entry by a month. Changing this means re-running the
# full backfill -- the nightly step reads the same constant.
MIN_SPELL = 10

STATEMENT_TIMEOUT_MS = 60 * 60 * 1000

# pct_from_stage_entry is NUMERIC(10,2): anything at 1e8 or beyond fails the
# UPDATE. stage_since_close is a real traded close, and junk BSE bars put
# 0.01 closes next to four-figure prices, so the denominator can collapse.
# NULL beats a clamped lie and beats a widened column that hides the junk.
PCT_GUARD = 100000000


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    # keepalives so a dropped socket ERRORS instead of hanging forever
    # (connect_timeout covers CONNECT only, never query execution), and a
    # bounded work_mem so one batch cannot push the backend into the OOM killer.
    return psycopg2.connect(
        DATABASE_URL,
        connect_timeout=30,
        keepalives=1,
        keepalives_idle=30,
        keepalives_interval=10,
        keepalives_count=5,
        options=(f"-c statement_timeout={STATEMENT_TIMEOUT_MS} "
                 f"-c work_mem=64MB"),
    )


_SQL = """
WITH h AS (
    -- Classified bars only. NULL and 'UNKNOWN' both mean "sma_200 not
    -- available"; excluding them keeps rn contiguous over the bars a stage
    -- could actually be held on.
    SELECT id, equity_id, trade_date, close, stage,
           row_number() OVER (PARTITION BY equity_id ORDER BY trade_date) AS rn,
           row_number() OVER (PARTITION BY equity_id, stage ORDER BY trade_date) AS rn_s
    FROM km_equity_eod
    WHERE equity_id = ANY(%(ids)s)
      AND stage IS NOT NULL
      AND stage <> 'UNKNOWN'
), runs AS (
    -- rn - rn_s is the classic gaps-and-islands key for a contiguous run of
    -- one stage. run_pos is the position WITHIN that run: causal, unlike the
    -- run's total length.
    SELECT h.*,
           row_number() OVER (PARTITION BY equity_id, stage, rn - rn_s
                              ORDER BY rn) AS run_pos
    FROM h
), conf AS (
    SELECT runs.*,
           CASE WHEN run_pos >= %(min_spell)s THEN stage END AS conf_raw
    FROM runs
), ff AS (
    -- Fill the confirmed stage forward across unconfirmed bars. count() over
    -- a running frame increments only on non-NULL, so every unconfirmed bar
    -- shares a group with the last confirmed one.
    SELECT conf.*,
           count(conf_raw) OVER (PARTITION BY equity_id ORDER BY rn
                                 ROWS UNBOUNDED PRECEDING) AS fgrp
    FROM conf
), filled AS (
    SELECT ff.*,
           first_value(conf_raw) OVER (PARTITION BY equity_id, fgrp
                                       ORDER BY rn) AS conf_stage
    FROM ff
), spells AS (
    -- Contiguous runs of the CONFIRMED stage. Bars before any confirmation
    -- drop out here and keep NULL fields, which is the honest answer.
    SELECT filled.*,
           rn - row_number() OVER (PARTITION BY equity_id, conf_stage
                                   ORDER BY rn) AS sgrp
    FROM filled
    WHERE conf_stage IS NOT NULL
), marked AS (
    -- The spell's first row is the bar where it confirmed, so its
    -- (rn - run_pos + 1) is the first bar of the raw run that opened it.
    -- Broadcasting that across the spell is what backdates the entry.
    SELECT spells.*,
           first_value(rn - run_pos + 1) OVER (PARTITION BY equity_id, conf_stage, sgrp
                                               ORDER BY rn) AS entry_rn
    FROM spells
), resolved AS (
    -- Driven from `runs` (EVERY classified bar), not from `marked` (confirmed
    -- bars only), so stage_run_bars is stamped even on bars before a symbol's
    -- first confirmation. It is the carry the nightly step reads: left NULL
    -- there, the night after a rebuild would see no run in progress, restart
    -- the count at 1 and delay the next confirmation by however many bars the
    -- run had already accumulated. Caught by replaying the two paths against
    -- each other -- the user-visible columns agreed, this one did not.
    SELECT a.id, a.equity_id, a.close, a.run_pos,
           m.conf_stage,
           m.rn - m.entry_rn + 1 AS bars_in,
           -- rn is 1 on each symbol's FIRST classified bar, so entry_rn = 1
           -- IS the censored case. An earlier draft compared against
           -- min(rn) over the spell rows, which excludes unconfirmed bars --
           -- it read the first CONFIRMED bar as the symbol's first bar and
           -- never fired.
           m.entry_rn = 1 AS censored,
           e.trade_date AS since_date,
           e.close      AS since_close
    FROM runs a
    LEFT JOIN marked m ON m.id = a.id
    -- Same numbering as h, so entry_rn addresses the same bar.
    LEFT JOIN (SELECT equity_id, trade_date, close,
                 row_number() OVER (PARTITION BY equity_id ORDER BY trade_date) AS rn
          FROM km_equity_eod
          WHERE equity_id = ANY(%(ids)s)
            AND stage IS NOT NULL
            AND stage <> 'UNKNOWN') e
      ON e.equity_id = m.equity_id AND e.rn = m.entry_rn
)
UPDATE km_equity_eod t
SET stage_confirmed      = r.conf_stage,
    stage_since          = r.since_date,
    stage_since_close    = ROUND(r.since_close, 2),
    stage_bars           = r.bars_in,
    stage_run_bars       = r.run_pos,
    stage_since_censored = r.censored,
    pct_from_stage_entry = CASE
        WHEN r.since_close > 0
         AND abs((r.close - r.since_close) / r.since_close * 100.0) < %(guard)s
        THEN ROUND((r.close - r.since_close) / r.since_close * 100.0, 2)
        ELSE NULL
    END
FROM resolved r
WHERE t.id = r.id
"""


def run_backfill(batch_size: int) -> int:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT DISTINCT equity_id FROM km_equity_eod ORDER BY equity_id")
            ids = [row[0] for row in cur.fetchall()]

        total = len(ids)
        batches = (total + batch_size - 1) // batch_size
        print(f"\n[stage-entry] {total:,} symbols in {batches} batches of {batch_size}.")
        print(f"  MIN_SPELL = {MIN_SPELL} bars. Each batch carries each symbol's FULL")
        print(f"  history — date-chunking would silently truncate spells.\n")

        t0 = time.time()
        updated = 0
        for i in range(0, total, batch_size):
            chunk = ids[i:i + batch_size]
            with conn.cursor() as cur:
                cur.execute(_SQL, {'ids': chunk, 'min_spell': MIN_SPELL, 'guard': PCT_GUARD})
                n = cur.rowcount
            conn.commit()
            updated += n
            done = min(i + batch_size, total)
            print(f"  [{done:>5}/{total}] {n:>9,} rows   "
                  f"(running {updated:>11,} · {time.time() - t0:.0f}s)", flush=True)

        print(f"\n  Done in {time.time() - t0:.0f}s — {updated:,} rows updated.")
        return updated
    finally:
        conn.close()


def run_verify() -> None:
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT max(trade_date) AS d FROM km_equity_eod")
            latest = cur.fetchone()['d']
            print(f"\n[verify] latest trade_date = {latest}\n")

            cur.execute("""
                SELECT count(*) AS classified,
                       count(stage_confirmed)  AS confirmed,
                       count(stage_since)      AS with_entry,
                       count(*) FILTER (WHERE stage_since_censored) AS censored,
                       count(*) FILTER (WHERE stage_confirmed = stage) AS agrees,
                       count(*) FILTER (WHERE stage_confirmed IS NOT NULL
                                          AND stage_confirmed <> stage) AS disagrees
                FROM km_equity_eod
                WHERE trade_date = %s AND stage IS NOT NULL AND stage <> 'UNKNOWN'
            """, [latest])
            r = cur.fetchone()
            for k, v in r.items():
                print(f"  {k:<12} = {v:>8,}")

            print("\n  stage vs stage_confirmed:")
            cur.execute("""
                SELECT stage, stage_confirmed, count(*) AS n
                FROM km_equity_eod
                WHERE trade_date = %s AND stage IS NOT NULL AND stage <> 'UNKNOWN'
                GROUP BY 1, 2 ORDER BY n DESC LIMIT 12
            """, [latest])
            for row in cur.fetchall():
                mark = '' if row['stage'] == row['stage_confirmed'] else '   <- fresh flip'
                print(f"    {str(row['stage']):<14} -> {str(row['stage_confirmed']):<14} "
                      f"{row['n']:>6,}{mark}")
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(
        description='Backfill stage entry date/price on km_equity_eod (migration 191).')
    parser.add_argument('--batch-size', type=int, default=250,
                        help='symbols per batch (default 250)')
    parser.add_argument('--verify', action='store_true',
                        help='report what is stored; write nothing')
    args = parser.parse_args()

    if args.verify:
        run_verify()
    else:
        run_backfill(args.batch_size)


if __name__ == '__main__':
    main()


# ── Nightly increment ─────────────────────────────────────────────────────
# The batch above walks a symbol's whole history. That is right for a rebuild
# and wrong for a nightly run: it would re-scan every bar ever recorded to
# learn one new day. The increment below reads ONE prior row per symbol and
# decides from it, which is why stage_run_bars is stored at all.
#
# It produces byte-identical rows to the batch because both apply the same
# causal rule -- a spell confirms on its MIN_SPELL-th bar, using only bars up
# to that bar. There is exactly one lookup that reaches back: on the
# confirming bar, the entry is backdated MIN_SPELL-1 classified bars. That is
# ~2 weeks, so the 400-day bound below is generous headroom, not a guess.

_SQL_INCREMENTAL = """
WITH cur AS (
    SELECT id, equity_id, close, stage
    FROM km_equity_eod
    WHERE trade_date = %(dt)s
      AND stage IS NOT NULL AND stage <> 'UNKNOWN'
), prev AS (
    -- The single prior classified bar per symbol. Everything the rule needs
    -- is on it; nothing older is read except the one backdating lookup.
    SELECT DISTINCT ON (p.equity_id)
           p.equity_id, p.stage, p.stage_confirmed, p.stage_since,
           p.stage_since_close, p.stage_bars, p.stage_run_bars,
           p.stage_since_censored
    FROM km_equity_eod p
    JOIN cur c ON c.equity_id = p.equity_id
    WHERE p.trade_date < %(dt)s
      AND p.trade_date >= %(dt)s::date - INTERVAL '400 days'
      AND p.stage IS NOT NULL AND p.stage <> 'UNKNOWN'
    ORDER BY p.equity_id, p.trade_date DESC
), calc AS (
    SELECT c.id, c.equity_id, c.close, c.stage,
           CASE WHEN p.stage = c.stage THEN COALESCE(p.stage_run_bars, 0) + 1
                ELSE 1 END AS run_bars,
           p.stage_confirmed      AS prev_conf,
           p.stage_since          AS prev_since,
           p.stage_since_close    AS prev_since_close,
           p.stage_bars           AS prev_bars,
           p.stage_since_censored AS prev_censored
    FROM cur c
    LEFT JOIN prev p ON p.equity_id = c.equity_id
), resolved AS (
    SELECT k.*,
           -- A new spell opens only when the run has held long enough AND the
           -- stage actually differs from what is already confirmed. Without
           -- the second test, a stage that dips out and returns would reset
           -- its own clock every time it re-confirmed.
           (k.run_bars >= %(min_spell)s
            AND (k.prev_conf IS NULL OR k.prev_conf <> k.stage)) AS opens_new,
           e.trade_date AS new_since,
           e.close      AS new_since_close
    FROM calc k
    LEFT JOIN LATERAL (
        SELECT x.trade_date, x.close
        FROM km_equity_eod x
        WHERE x.equity_id = k.equity_id
          AND x.trade_date <= %(dt)s
          AND x.trade_date >= %(dt)s::date - INTERVAL '400 days'
          AND x.stage IS NOT NULL AND x.stage <> 'UNKNOWN'
        ORDER BY x.trade_date DESC
        OFFSET k.run_bars - 1 LIMIT 1
    ) e ON k.run_bars >= %(min_spell)s
), final AS (
    SELECT r.id, r.equity_id, r.close, r.run_bars,
           CASE WHEN r.opens_new THEN r.stage ELSE r.prev_conf END AS f_conf,
           CASE WHEN r.opens_new THEN r.new_since ELSE r.prev_since END AS f_since,
           CASE WHEN r.opens_new THEN ROUND(r.new_since_close, 2)
                ELSE r.prev_since_close END AS f_since_close,
           CASE WHEN r.opens_new THEN r.run_bars
                WHEN r.prev_conf IS NOT NULL THEN COALESCE(r.prev_bars, 0) + 1
                ELSE NULL END AS f_bars,
           CASE WHEN r.opens_new
                     -- censored = the spell opens on the symbol's first
                     -- classified bar, so the real entry predates the data
                     THEN NOT EXISTS (
                         SELECT 1 FROM km_equity_eod z
                         WHERE z.equity_id = r.equity_id
                           AND z.trade_date < r.new_since
                           AND z.stage IS NOT NULL AND z.stage <> 'UNKNOWN')
                ELSE r.prev_censored END AS f_censored
    FROM resolved r
)
UPDATE km_equity_eod t
SET stage_run_bars       = f.run_bars,
    stage_confirmed      = f.f_conf,
    stage_since          = f.f_since,
    stage_since_close    = f.f_since_close,
    stage_bars           = f.f_bars,
    stage_since_censored = f.f_censored,
    pct_from_stage_entry = CASE
        WHEN f.f_since_close > 0
         AND abs((f.close - f.f_since_close) / f.f_since_close * 100.0) < %(guard)s
        THEN ROUND((f.close - f.f_since_close) / f.f_since_close * 100.0, 2)
        ELSE NULL
    END
FROM final f
WHERE t.id = f.id
"""


def compute_stage_entry_for_date(db_conn, trade_date, verbose: bool = False) -> int:
    """Nightly step: extend each symbol's confirmed spell onto `trade_date`.

    Runs immediately after stage classification for the same date — it reads
    `stage`, so ordering is not optional. Opens its own psycopg2 connection
    for the same reason compute_stage_for_date does: PgClient from
    daily_pipeline has no cursor()/commit().
    """
    conn = get_conn()
    try:
        t0 = time.time()
        with conn.cursor() as cur:
            cur.execute(_SQL_INCREMENTAL, {
                'dt': str(trade_date),
                'min_spell': MIN_SPELL,
                'guard': PCT_GUARD,
            })
            n = cur.rowcount
        conn.commit()
        if verbose:
            print(f"  [stage-entry] {trade_date}: {n:,} rows in {time.time() - t0:.1f}s")
        return n
    finally:
        conn.close()
