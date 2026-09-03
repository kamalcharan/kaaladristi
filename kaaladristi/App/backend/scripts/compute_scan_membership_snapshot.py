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
existed. This table is that history, appended once per day going forward —
"new since yesterday" only has something real to say starting the day AFTER
this snapshot begins running (or, backfilled, the day after the earliest
backfilled date).

Reads FROM km_scan_results rather than re-deriving each preset's qualifying
SQL by hand — that view already encodes the exact ranking, NSE-only
universe gate, ISIN-dedup, and top-N display cap the real scanner UI uses
(migration 197's `pa`/`pa_pool` CTEs), so this snapshot always matches what
users actually saw that day instead of risking drift from a second,
hand-maintained copy of the same logic. Must run in the SAME pipeline
execution as scan_refresh, immediately after it (see DAILY_STEPS,
orchestrator.py) — the matview holds only whatever the last refresh
produced, so this is the one point in the day where "today's row" is
guaranteed to still be there.

Scope: breakout_surge only for now — the one preset with Phase 3 VaNi
intents (scannerenhancement.md's Tier B). Add a preset_id to
SNAPSHOT_PRESET_IDS to extend to another preset already covered by
km_scan_results.
"""

import argparse
import logging

from lib.config import DATABASE_URL

log = logging.getLogger(__name__)


def get_conn():
    import psycopg2
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(DATABASE_URL, connect_timeout=30)


SNAPSHOT_PRESET_IDS = ['breakout_surge']


def _membership_from_scan_results(conn, trade_date, preset_id: str) -> list[tuple[int, str | None]]:
    """(equity_id, magic_rs_zone) for every row km_scan_results currently
    holds for `preset_id` on `trade_date` — i.e. exactly what the scanner UI
    showed that day (already NSE-only, ISIN-deduped, and capped at the
    preset's real display limit by the view itself)."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT equity_id, magic_rs_zone FROM km_scan_results "
            "WHERE preset_id = %(p)s AND trade_date = %(d)s",
            {'p': preset_id, 'd': str(trade_date)},
        )
        return cur.fetchall()


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
            rows = _membership_from_scan_results(conn, trade_date, preset_id)
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
