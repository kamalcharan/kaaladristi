"""
Scan Membership Daily Snapshot
===============================
Freezes each registered scan preset's qualifying equity_ids (+ their
magic_rs_zone as of that date) into km_scan_membership_daily (migration 198)
once per trading day.

Why this exists: km_scan_results (migration 147, extended by 195/197 to
also cover the price-action presets including breakout_surge) is a
materialized VIEW — it only ever holds the CURRENT snapshot, overwritten in
place every night by the scan_refresh step. Nothing anywhere in the schema
persisted that membership across days, so there was no way to answer "which
stocks are new to this scan since yesterday" or "which stocks just turned
RS-green" — both need a PRIOR day's membership to diff against, and none
existed. This table is that history, appended once per day going forward.

CORRECTED (2026-09-03, before first deploy): the original version of this
script read membership straight from km_scan_results, reasoning that it
already encodes the right WHERE clause and would save duplicating it. That
reasoning missed the table's own nature — km_scan_results is CURRENT-
SNAPSHOT-ONLY, so it never holds a date other than "today"; reading it for
any past date silently returns zero rows. That broke exactly the case an
owner would reach for first: backfilling recent history right after deploy
so "new since yesterday" doesn't sit dark for days waiting on real pipeline
runs to accumulate it one day at a time. Fixed by re-deriving membership
directly from km_equity_eod (which DOES hold full history) for every date,
live or backfilled alike — one function, used both ways, no dependency on
what the matview happens to hold at call time. The WHERE clause mirrors
migration 197's `breakout_surge`/`pa`/`pa_pool` CTEs (NSE-only, close >= 50,
pct_chng > 0, pct_from_breakout > 0, capped at the preset's real display
limit ranked by pct_from_breakout) — kept in sync by hand since there's no
longer a live view being read; the ISIN-dedup those CTEs also apply is a
no-op once already filtered to a single exchange (a dual-listed stock's
NSE and BSE rows are two distinct equity_ids from km_equity_symbols; the
exchange filter alone drops the BSE one, nothing left to dedupe).

Scope: the presets carrying Phase 3 VaNi intents (scannerenhancement.md's
Tier B) — i.e. the ones with a Studio descriptor in
App/frontend/src/config/scannerStudio.ts. Adding another is one entry in
PRESET_MEMBERSHIP_FNS: its qualifying WHERE and ORDER BY, copied from its arm
in migration 197. The pool and its gates are shared.
"""

import argparse
import logging
import os
import sys

# Makes `lib` importable when this script is run directly from inside
# scripts/ (e.g. `cd App/backend/scripts && python compute_scan_membership_snapshot.py`)
# rather than from App/backend or via the pipeline2 app import — matches
# every other CLI script in this directory (rule_discovery.py, etc.).
# Missing this line is exactly what produced a live
# "ModuleNotFoundError: No module named 'lib.config'" when run standalone.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL

log = logging.getLogger(__name__)


def get_conn():
    import psycopg2
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(DATABASE_URL, connect_timeout=30)


SNAPSHOT_PRESET_IDS = ['breakout_surge', 'weekly_movers', 'monthly_movers',
                       'weekly_decliners', 'monthly_decliners',
                       'breakdown_watch',
                       'gl_breakout', 'gl_retest']

# Display cap per preset (kd_scan_presets.limit / SCAN_PRESETS in
# scanEngine.ts) — matches each arm's `WHERE rnk <= N` in migration 197, so a
# backfilled date's "membership" means the same top-N the UI would have shown,
# not an unbounded technical superset.
DISPLAY_CAP = {
    'breakout_surge': 500,
    'weekly_movers': 500,
    'monthly_movers': 500,
    'weekly_decliners': 500,
    'monthly_decliners': 500,
    'breakdown_watch': 500,
    'gl_breakout': 200,
    'gl_retest': 200,
}

# ---------------------------------------------------------------------------
# The shared pool every price-action arm ranks within.
#
# Mirrors migration 197's `pa_pool` / `pa` CTEs exactly, and the exactness is
# the point — this table is diffed day over day, so a pool that is wider than
# what the UI showed silently UNDER-reports tomorrow's new arrivals (a stock
# already in yesterday's over-wide snapshot never reads as new).
#
# TWO GATES THE ORIGINAL breakout_surge FUNCTION MISSED, both restored here:
#
#   ema_20 IS NOT NULL  -- `eq_base` carries it and every matview arm inherits
#       it. Measured on 2026-09-04: the faithful rule yields 270 rows for
#       breakout_surge, exactly matching km_scan_results; the old function
#       wrote 284. A 5% over-collection, every day since 2026-08-20.
#
#   ISIN de-duplication -- `pa_pool`'s row_number() keeps one row per ISIN,
#       NSE preferred. It changes nothing on today's data (both readings give
#       1,012 for weekly_movers) because the pool is already NSE-only, but two
#       NSE listings sharing an ISIN would otherwise both enter, and matching
#       the matview costs nothing.
#
# ANY EXISTING breakout_surge HISTORY WRITTEN BEFORE THIS CHANGE IS WIDER than
# what this now produces. Re-backfill it so the day-over-day diff compares like
# with like:
#     python scripts/compute_scan_membership_snapshot.py --from 2026-08-20
# ---------------------------------------------------------------------------
_PA_POOL = """
    WITH pool AS (
        SELECT e.equity_id, e.magic_rs_zone,
               e.pct_wtd, e.pct_mtd, e.pct_chng,
               e.pct_from_breakout, e.pct_from_breakdown,
               row_number() OVER (
                   PARTITION BY COALESCE(s.isin, 'EQ:' || e.equity_id::text)
                   ORDER BY (s.exchange = 'NSE') DESC, e.equity_id
               ) AS isin_rnk
        FROM km_equity_eod e
        JOIN km_equity_symbols s ON s.id = e.equity_id
        WHERE e.trade_date = %(d)s
          AND s.exchange = 'NSE'
          AND e.close >= 50
          AND e.ema_20 IS NOT NULL
    )
    SELECT equity_id, magic_rs_zone
    FROM pool
    WHERE isin_rnk = 1
      AND {qualify}
    ORDER BY {order}
    LIMIT %(cap)s
"""


# ---------------------------------------------------------------------------
# The Golden Line pair: migration 202 gave them km_scan_results arms
# (gl_breakout / gl_retest, mirroring fetchGlEvents in scanEngine.ts, which
# stays as the frontend's fallback). This pool mirrors the ARM for history —
# km_scan_results is latest-date only — and it differs from the price-action
# pool in two ways that must not be "corrected" for consistency:
#
#   no close >= 50 gate -- neither the arm nor the fetcher applies one; the
#       event flag is the whole filter. Adding the shared pool's gate here
#       would snapshot a narrower set than the UI shows, the exact under-
#       reporting this file's header describes. (The arm reads through the
#       matview's ema_20 IS NOT NULL gate; it cannot bite on a row that has
#       an sma_150-based event, so it is not reproduced here.)
#   ordering is the scan's own -- breakouts by distance above the line
#       (pct_from_gl DESC), retests by sessions held (gl_days_above DESC).
#
# NSE-only and ISIN dedup, NSE preferred, match the fetcher. Cap 200 is
# kd_scan_presets.result_limit for both. Measured 2026-09-04: 17 breakouts,
# 2 retests, 0 ISIN duplicates -- small cohorts, and a BREAKOUT cannot repeat
# on consecutive sessions (its prior close must be at or below the line), so
# gl_breakout's day-over-day diff is structurally "all new"; the Studio hides
# that card for it.
# ---------------------------------------------------------------------------
_GL_POOL = """
    WITH pool AS (
        SELECT e.equity_id, e.magic_rs_zone, e.pct_from_gl, e.gl_days_above,
               row_number() OVER (
                   PARTITION BY COALESCE(s.isin, 'EQ:' || e.equity_id::text)
                   ORDER BY (s.exchange = 'NSE') DESC, e.equity_id
               ) AS isin_rnk
        FROM km_equity_eod e
        JOIN km_equity_symbols s ON s.id = e.equity_id
        WHERE e.trade_date = %(d)s
          AND s.exchange = 'NSE'
          AND e.gl_event = %(event)s
    )
    SELECT equity_id, magic_rs_zone
    FROM pool
    WHERE isin_rnk = 1
    ORDER BY {order}
    LIMIT %(cap)s
"""


def _membership_gl(preset_id: str, event: str, order: str):
    """Membership for one Golden Line preset — mirrors the migration-202 arm
    (and fetchGlEvents, which it was copied from). See the note above _GL_POOL."""
    sql = _GL_POOL.format(order=order)

    def _fn(conn, trade_date) -> list[tuple[int, str | None]]:
        with conn.cursor() as cur:
            cur.execute(sql, {'d': str(trade_date), 'event': event, 'cap': DISPLAY_CAP[preset_id]})
            return cur.fetchall()

    _fn.__name__ = f'_membership_{preset_id}'
    return _fn


def _membership(preset_id: str, qualify: str, order: str):
    """Build a membership function for one arm.

    `qualify` and `order` are the ONLY things that differ between arms — they
    are copied verbatim from that preset's CTE in migration 197. Everything
    else (the pool, the gates, the cap) is shared, which is what keeps the two
    definitions from drifting apart one edit at a time.

    Works identically for today or any past date: km_equity_eod carries full
    history, unlike km_scan_results.
    """
    sql = _PA_POOL.format(qualify=qualify, order=order)

    def _fn(conn, trade_date) -> list[tuple[int, str | None]]:
        with conn.cursor() as cur:
            cur.execute(sql, {'d': str(trade_date), 'cap': DISPLAY_CAP[preset_id]})
            return cur.fetchall()

    _fn.__name__ = f'_membership_{preset_id}'
    return _fn


PRESET_MEMBERSHIP_FNS = {
    # migration 197: `WHERE p.pct_chng > 0 AND p.pct_from_breakout > 0`,
    # `ORDER BY p.pct_from_breakout DESC, p.equity_id`
    'breakout_surge': _membership(
        'breakout_surge',
        qualify='pct_chng > 0 AND pct_from_breakout > 0',
        order='pct_from_breakout DESC, equity_id',
    ),
    # migration 197: `WHERE p.pct_wtd > 0`,
    # `ORDER BY p.pct_wtd DESC, p.equity_id`
    'weekly_movers': _membership(
        'weekly_movers',
        qualify='pct_wtd > 0',
        order='pct_wtd DESC, equity_id',
    ),
    # migration 197: `WHERE p.pct_mtd > 0`,
    # `ORDER BY p.pct_mtd DESC, p.equity_id`
    'monthly_movers': _membership(
        'monthly_movers',
        qualify='pct_mtd > 0',
        order='pct_mtd DESC, equity_id',
    ),
    # migration 197: `WHERE p.pct_wtd < 0`,
    # `ORDER BY p.pct_wtd ASC, p.equity_id` -- ASC, because this arm ranks the
    # largest LOSS first. Copying the DESC from its weekly_movers twin would
    # have snapshotted the 500 SMALLEST declines while the UI showed the 500
    # largest: two disjoint sets, and every day-over-day diff meaningless.
    'weekly_decliners': _membership(
        'weekly_decliners',
        qualify='pct_wtd < 0',
        order='pct_wtd ASC, equity_id',
    ),
    # migration 197: `WHERE p.pct_mtd < 0`,
    # `ORDER BY p.pct_mtd ASC, p.equity_id` -- ASC again, same reason.
    'monthly_decliners': _membership(
        'monthly_decliners',
        qualify='pct_mtd < 0',
        order='pct_mtd ASC, equity_id',
    ),
    # migration 197: `WHERE p.pct_chng < 0 AND p.pct_from_breakdown < 0`,
    # `ORDER BY p.pct_from_breakdown ASC, p.equity_id` -- ASC ranks the DEEPEST
    # break first, the mirror of breakout_surge's DESC.
    #
    # BACKFILL HORIZON, and it is not a detail: pct_from_breakdown is only
    # ~6% populated before 2026-08-27 (6.5% Jun, 6.3% Jul, 19.7% Aug, 99.9%
    # Sep -- measured 2026-09-06). Backfilling this preset over those months
    # writes a 6% sample AS IF it were the day's membership, and is_unusual
    # would then compare a real count against a fake baseline. Run
    # scripts/backfill_rolling_metrics_fast.py first, or pass a --from no
    # earlier than 2026-08-27. Every other preset here is safe to backfill to
    # full history; this is the only one that is not.
    'breakdown_watch': _membership(
        'breakdown_watch',
        qualify='pct_chng < 0 AND pct_from_breakdown < 0',
        order='pct_from_breakdown ASC, equity_id',
    ),
    # fetchGlEvents: gl_event = 'BREAKOUT', sorted pct_from_gl DESC
    'gl_breakout': _membership_gl(
        'gl_breakout', event='BREAKOUT',
        order='pct_from_gl DESC NULLS LAST, equity_id',
    ),
    # fetchGlEvents: gl_event = 'RETEST', sorted gl_days_above DESC
    'gl_retest': _membership_gl(
        'gl_retest', event='RETEST',
        order='gl_days_above DESC NULLS LAST, equity_id',
    ),
}


def compute_scan_membership_for_date(conn, trade_date, verbose: bool = False) -> int:
    """Snapshot every registered preset's membership for `trade_date`.
    Idempotent — deletes this date's rows for each preset first, so a
    re-run (force or otherwise) never leaves stale/duplicate rows. Returns
    total rows written across all presets."""
    total = 0
    with conn.cursor() as cur:
        for preset_id in SNAPSHOT_PRESET_IDS:
            cur.execute(
                "DELETE FROM km_scan_membership_daily WHERE trade_date = %(d)s AND preset_id = %(p)s",
                {'d': str(trade_date), 'p': preset_id},
            )
            rows = PRESET_MEMBERSHIP_FNS[preset_id](conn, trade_date)
            if not rows:
                if verbose:
                    log.info(f'[scan_membership] {preset_id} {trade_date}: 0 qualifying rows')
                continue
            cur.executemany(
                """
                INSERT INTO km_scan_membership_daily (trade_date, preset_id, equity_id, magic_rs_zone)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (trade_date, preset_id, equity_id) DO UPDATE
                  SET magic_rs_zone = EXCLUDED.magic_rs_zone
                """,
                [(str(trade_date), preset_id, equity_id, zone) for equity_id, zone in rows],
            )
            total += len(rows)
            if verbose:
                log.info(f'[scan_membership] {preset_id} {trade_date}: {len(rows)} rows')
    conn.commit()
    return total


# ── pipeline2 entry point ────────────────────────────────────────────────
# (rows, status) shape — same bespoke-handler convention compute_dots_for_pipeline
# / compute_wg_for_pipeline use (writes a multi-preset table, no single
# fill-rate column to probe, so this bypasses _handle_script entirely).

def compute_scan_membership_for_pipeline(conn, trade_date, force: bool = False) -> tuple[int, str]:
    own_conn = conn is None
    if own_conn:
        conn = get_conn()
    try:
        rows = compute_scan_membership_for_date(conn, trade_date, verbose=False)
        return rows, ('completed' if rows > 0 else 'partial')
    except Exception:
        conn.rollback()
        raise
    finally:
        if own_conn:
            conn.close()


def main():
    ap = argparse.ArgumentParser(description='Snapshot scan membership into km_scan_membership_daily')
    ap.add_argument('--date', default=None, help='Single trade date YYYY-MM-DD')
    ap.add_argument('--from', dest='date_from', default=None, help='Backfill start date YYYY-MM-DD')
    ap.add_argument('--to', dest='date_to', default=None, help='Backfill end date YYYY-MM-DD (default: today)')
    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format='%(message)s')

    conn = get_conn()
    conn.autocommit = False
    try:
        if args.date:
            n = compute_scan_membership_for_date(conn, args.date, verbose=True)
            print(f'{args.date}: {n} rows')
        elif args.date_from:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT DISTINCT trade_date FROM km_equity_eod "
                    "WHERE trade_date >= %(f)s AND trade_date <= COALESCE(%(t)s, CURRENT_DATE) "
                    "ORDER BY trade_date",
                    {'f': args.date_from, 't': args.date_to},
                )
                dates = [r[0] for r in cur.fetchall()]
            for d in dates:
                n = compute_scan_membership_for_date(conn, d, verbose=True)
                print(f'{d}: {n} rows')
        else:
            ap.error('pass --date or --from')
    finally:
        conn.close()


if __name__ == '__main__':
    main()
