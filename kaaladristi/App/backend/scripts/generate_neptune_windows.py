"""
generate_neptune_windows.py

Generate Neptune station and retrograde transit windows from
km_planetary_positions and insert into km_rule_transits.
(ON CONFLICT DO NOTHING)

Rules generated:
  NEP-STN-RET-WIN  Stationary retrograde window  ±7 days around exact Rx station
  NEP-STN-RET-BEA  Exact retrograde station day   single day
  NEP-STN-DIR-TRN  Exact direct station day        single day
  NEP-RET-BEA      Full retrograde period          island pattern (~5 months)

Date range: 1990-01-01 to 2030-12-31
UNIQUE constraint: uq_rule_transits_rule_start (rule_id, start_date)
All inserts use ON CONFLICT (rule_id, start_date) DO NOTHING.

Prerequisite: Run km_migration_103_neptune_rules_seed.sql first.
Neptune data prerequisite: km_planetary_positions must contain Neptune rows
  (run generate_ephemeris.py + insert_outer_planets.py first).

Run:
  cd App/backend/scripts
  DB_PRIMARY=postgresql://user:pass@host:5432/kaala_dristi_db python3 generate_neptune_windows.py

DO NOT RUN AUTOMATICALLY — one-shot backfill + forward fill.
"""

import os
import json
import psycopg2
from datetime import date, timedelta


# ── DB connection ──────────────────────────────────────────────────────────────

def get_conn():
    if 'DB_PRIMARY' in os.environ:
        return psycopg2.connect(os.environ['DB_PRIMARY'])
    return psycopg2.connect(
        host='187.127.136.65', port=5432,
        dbname='kaala_dristi_db',
        password=os.environ['KD_DB_PASSWORD'],
    )


# ── Constants ──────────────────────────────────────────────────────────────────

BACKFILL_FROM = date(1990, 1, 1)
BACKFILL_TO   = date(2030, 12, 31)

# Neptune station ±7-day window
STATION_WINDOW_DAYS = 7

ALL_RULE_CODES = [
    'NEP-STN-RET-WIN',
    'NEP-STN-RET-BEA',
    'NEP-STN-DIR-TRN',
    'NEP-RET-BEA',
]


# ── Helpers ────────────────────────────────────────────────────────────────────

def lookup_rule_id(cur, rule_code: str) -> int | None:
    cur.execute(
        'SELECT id FROM km_astro_rule_master WHERE rule_code = %s LIMIT 1',
        (rule_code,),
    )
    row = cur.fetchone()
    return row[0] if row else None


INSERT_SQL = """
INSERT INTO km_rule_transits
  (rule_id, start_date, end_date, conditions_snapshot)
VALUES (%s, %s, %s, %s)
ON CONFLICT (rule_id, start_date) DO NOTHING
"""


def bulk_insert(cur, rows: list[tuple]) -> tuple[int, int]:
    inserted = skipped = 0
    for row in rows:
        cur.execute(INSERT_SQL, row)
        if cur.rowcount == 1:
            inserted += 1
        else:
            skipped += 1
    return inserted, skipped


# ── Station detection ──────────────────────────────────────────────────────────

def fetch_retrograde_stations(cur) -> list[date]:
    """Return dates where Neptune transitions from direct → retrograde."""
    cur.execute("""
        SELECT date
        FROM (
            SELECT date, retrograde,
                   LAG(retrograde) OVER (ORDER BY date) AS prev_retro
            FROM km_planetary_positions
            WHERE planet = 'Neptune'
              AND date BETWEEN %s AND %s
        ) t
        WHERE retrograde = true AND prev_retro = false
        ORDER BY date
    """, (BACKFILL_FROM, BACKFILL_TO))
    return [row[0] for row in cur.fetchall()]


def fetch_direct_stations(cur) -> list[date]:
    """Return dates where Neptune transitions from retrograde → direct."""
    cur.execute("""
        SELECT date
        FROM (
            SELECT date, retrograde,
                   LAG(retrograde) OVER (ORDER BY date) AS prev_retro
            FROM km_planetary_positions
            WHERE planet = 'Neptune'
              AND date BETWEEN %s AND %s
        ) t
        WHERE retrograde = false AND prev_retro = true
        ORDER BY date
    """, (BACKFILL_FROM, BACKFILL_TO))
    return [row[0] for row in cur.fetchall()]


# ── Window generators ──────────────────────────────────────────────────────────

def generate_stn_ret_win(cur, rule_id: int, rx_stations: list[date]) -> tuple[int, int]:
    """
    NEP-STN-RET-WIN: ±7-day window around each retrograde station.
    One row per station.
    """
    rows = []
    for station_date in rx_stations:
        start = station_date - timedelta(days=STATION_WINDOW_DAYS)
        end   = station_date + timedelta(days=STATION_WINDOW_DAYS)
        snap  = json.dumps({
            'exact_station': station_date.isoformat(),
            'station_type':  'retrograde',
            'window_days':   STATION_WINDOW_DAYS * 2 + 1,
            'rule':          'Neptune Station Retrograde',
            'source':        'Bill Meridian',
        })
        rows.append((rule_id, start, end, snap))
    return bulk_insert(cur, rows)


def generate_stn_ret_bea(cur, rule_id: int, rx_stations: list[date]) -> tuple[int, int]:
    """
    NEP-STN-RET-BEA: Exact retrograde station date only (single day per station).
    """
    rows = []
    for station_date in rx_stations:
        snap = json.dumps({
            'exact_station': station_date.isoformat(),
            'station_type':  'retrograde_exact',
            'rule':          'Neptune Station Retrograde Exact',
        })
        rows.append((rule_id, station_date, station_date, snap))
    return bulk_insert(cur, rows)


def generate_stn_dir_trn(cur, rule_id: int, dir_stations: list[date]) -> tuple[int, int]:
    """
    NEP-STN-DIR-TRN: Exact direct station date (single day per station).
    """
    rows = []
    for station_date in dir_stations:
        snap = json.dumps({
            'exact_station': station_date.isoformat(),
            'station_type':  'direct',
            'rule':          'Neptune Station Direct',
        })
        rows.append((rule_id, station_date, station_date, snap))
    return bulk_insert(cur, rows)


def generate_ret_bea(cur, rule_id: int) -> tuple[int, int]:
    """
    NEP-RET-BEA: Full retrograde period — island pattern, one row per period.
    Neptune goes retrograde ~once/year for ~5 months.
    """
    cur.execute("""
        WITH retro_days AS (
            SELECT date,
                   date - (ROW_NUMBER() OVER (ORDER BY date))::integer AS grp
            FROM km_planetary_positions
            WHERE planet = 'Neptune'
              AND retrograde = true
              AND date BETWEEN %s AND %s
        )
        SELECT MIN(date) AS start_date,
               MAX(date) AS end_date,
               (MAX(date) - MIN(date) + 1) AS duration_days
        FROM retro_days
        GROUP BY grp
        ORDER BY start_date
    """, (BACKFILL_FROM, BACKFILL_TO))

    rows = []
    for start_date, end_date, duration_days in cur.fetchall():
        snap = json.dumps({
            'planet':       'Neptune',
            'state':        'retrograde',
            'rule_type':    'full_retrograde_period',
            'duration_days': int(duration_days),
        })
        rows.append((rule_id, start_date, end_date, snap))
    return bulk_insert(cur, rows)


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    conn = get_conn()
    try:
        with conn:
            with conn.cursor() as cur:

                # ── Resolve rule IDs ──
                rule_ids: dict[str, int] = {}
                missing: list[str] = []
                for code in ALL_RULE_CODES:
                    rid = lookup_rule_id(cur, code)
                    if rid:
                        rule_ids[code] = rid
                    else:
                        missing.append(code)

                if missing:
                    print('\n⚠  Rules not found in km_astro_rule_master:')
                    print('   Run km_migration_103_neptune_rules_seed.sql first.')
                    for m in missing:
                        print(f'   {m}')
                    if len(missing) == len(ALL_RULE_CODES):
                        return

                # ── Verify Neptune data exists ──
                cur.execute(
                    'SELECT COUNT(*) FROM km_planetary_positions WHERE planet = %s',
                    ('Neptune',),
                )
                neptune_count = cur.fetchone()[0]
                if neptune_count == 0:
                    print('\n⚠  No Neptune rows found in km_planetary_positions.')
                    print('   Run generate_ephemeris.py + insert_outer_planets.py first.')
                    return
                print(f'\n  Neptune rows in km_planetary_positions: {neptune_count:,}')

                # ── Detect station dates ──
                rx_stations  = fetch_retrograde_stations(cur)
                dir_stations = fetch_direct_stations(cur)
                print(f'  Retrograde stations detected: {len(rx_stations)}')
                print(f'  Direct stations detected:     {len(dir_stations)}')

                # ── Generate windows ──
                summary: dict[str, tuple[int, int]] = {}

                if 'NEP-STN-RET-WIN' in rule_ids:
                    summary['NEP-STN-RET-WIN'] = generate_stn_ret_win(
                        cur, rule_ids['NEP-STN-RET-WIN'], rx_stations,
                    )

                if 'NEP-STN-RET-BEA' in rule_ids:
                    summary['NEP-STN-RET-BEA'] = generate_stn_ret_bea(
                        cur, rule_ids['NEP-STN-RET-BEA'], rx_stations,
                    )

                if 'NEP-STN-DIR-TRN' in rule_ids:
                    summary['NEP-STN-DIR-TRN'] = generate_stn_dir_trn(
                        cur, rule_ids['NEP-STN-DIR-TRN'], dir_stations,
                    )

                if 'NEP-RET-BEA' in rule_ids:
                    summary['NEP-RET-BEA'] = generate_ret_bea(
                        cur, rule_ids['NEP-RET-BEA'],
                    )

        # ── Print summary ──
        print()
        print(f"  {'Rule':<24}  {'Inserted':>8}  {'Skipped':>8}")
        print(f"  {'─' * 24}  {'─' * 8}  {'─' * 8}")

        total_ins = total_skp = 0
        for code in ALL_RULE_CODES:
            ins, skp = summary.get(code, (0, 0))
            total_ins += ins
            total_skp += skp
            status = '⚠  not found' if code not in rule_ids else ''
            print(f'  {code:<24}  {ins:>8}  {skp:>8}  {status}')

        print(f"  {'─' * 24}  {'─' * 8}  {'─' * 8}")
        print(f"  {'TOTAL':<24}  {total_ins:>8}  {total_skp:>8}")
        print(f'  Date range: {BACKFILL_FROM} to {BACKFILL_TO}')
        retro_count = summary.get('NEP-RET-BEA', (0, 0))
        print(f'  Neptune retrograde periods: {sum(retro_count)}')
        print()

    finally:
        conn.close()


if __name__ == '__main__':
    main()
