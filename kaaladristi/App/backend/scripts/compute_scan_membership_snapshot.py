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

Scope: breakout_surge only for now — the one preset with Phase 3 VaNi
intents (scannerenhancement.md's Tier B). Add a preset_id + its qualifying
WHERE clause to extend to another preset.
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


SNAPSHOT_PRESET_IDS = ['breakout_surge']

# Preset display cap (kd_scan_presets.limit / SCAN_PRESETS in scanEngine.ts)
# — matches migration 197's `FROM breakout_surge WHERE rnk <= 500`, so a
# backfilled date's "membership" means the same top-N the UI would have
# shown, not an unbounded technical superset.
BREAKOUT_SURGE_DISPLAY_CAP = 500


def _membership_breakout_surge(conn, trade_date) -> list[tuple[int, str | None]]:
    """(equity_id, magic_rs_zone) for every equity that qualifies for
    Breakout Surge on `trade_date`, ranked and capped exactly like migration
    197's `breakout_surge` CTE (NSE-only, close >= 50, pct_chng > 0,
    pct_from_breakout > 0, top BREAKOUT_SURGE_DISPLAY_CAP by
    pct_from_breakout DESC). Works identically for today or any past date —
    km_equity_eod carries full history, unlike km_scan_results."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT e.equity_id, e.magic_rs_zone
            FROM km_equity_eod e
            JOIN km_equity_symbols s ON s.id = e.equity_id
            WHERE e.trade_date = %(d)s
              AND s.exchange = 'NSE'
              AND e.close >= 50
              AND e.pct_chng > 0
              AND e.pct_from_breakout > 0
            ORDER BY e.pct_from_breakout DESC, e.equity_id
            LIMIT %(cap)s
            """,
            {'d': str(trade_date), 'cap': BREAKOUT_SURGE_DISPLAY_CAP},
        )
        return cur.fetchall()


PRESET_MEMBERSHIP_FNS = {
    'breakout_surge': _membership_breakout_surge,
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
