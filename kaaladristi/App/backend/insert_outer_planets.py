"""
insert_outer_planets.py

Insert ONLY Neptune, Herschel, Pluto rows from output/planetary_positions.json
into km_planetary_positions.

SAFETY:
  - Filters JSON to planet IN ('Neptune', 'Herschel', 'Pluto') only
  - ON CONFLICT (date, planet) DO NOTHING — never overwrites existing rows
  - No DELETE, TRUNCATE, or UPDATE anywhere in this script
  - Does not touch km_planetary_aspects, km_astro_events, or km_moon_intraday

Run:
  cd App/backend
  DB_PRIMARY=postgresql://user:pass@host:5432/kaala_dristi_db python3 insert_outer_planets.py

DO NOT RUN AUTOMATICALLY — one-shot insert.
"""

import os
import json
import psycopg2
import psycopg2.extras
from pathlib import Path

# ── Constants ──────────────────────────────────────────────────────────────────

OUTER_PLANETS = {'Neptune', 'Herschel', 'Pluto'}
BATCH_SIZE    = 500
TABLE         = 'km_planetary_positions'

script_dir  = Path(__file__).parent
output_path = script_dir / 'output' / 'planetary_positions.json'


# ── DB connection ──────────────────────────────────────────────────────────────

def get_conn():
    if 'DB_PRIMARY' in os.environ:
        return psycopg2.connect(os.environ['DB_PRIMARY'])
    return psycopg2.connect(
        host='187.127.136.65', port=5432,
        dbname='kaala_dristi_db',
        password=os.environ['KD_DB_PASSWORD'],
    )


# ── Constraint check ───────────────────────────────────────────────────────────

def check_unique_constraint(cur) -> bool:
    """Return True if a UNIQUE constraint exists on (date, planet)."""
    cur.execute("""
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = %s
          AND constraint_type = 'UNIQUE'
    """, (TABLE,))
    rows = cur.fetchall()
    names = [r[0] for r in rows]
    print(f"  Unique constraints on {TABLE}: {names or '(none)'}")
    # Also check primary key — PK also guarantees uniqueness
    cur.execute("""
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_name = kcu.table_name
        WHERE tc.table_name = %s
          AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
        ORDER BY kcu.ordinal_position
    """, (TABLE,))
    cols = [r[0] for r in cur.fetchall()]
    print(f"  Constrained columns: {cols or '(none found)'}")
    has_constraint = 'date' in cols and 'planet' in cols
    return has_constraint


# ── Batch insert ───────────────────────────────────────────────────────────────

INSERT_SQL = f"""
INSERT INTO {TABLE}
  (date, planet, longitude, speed, retrograde,
   sign, sign_name, nakshatra, nakshatra_name,
   nakshatra_pada, combust)
VALUES %s
ON CONFLICT (date, planet) DO NOTHING
"""

INSERT_SQL_SAFE = f"""
INSERT INTO {TABLE}
  (date, planet, longitude, speed, retrograde,
   sign, sign_name, nakshatra, nakshatra_name,
   nakshatra_pada, combust)
SELECT %(date)s, %(planet)s, %(longitude)s, %(speed)s, %(retrograde)s,
       %(sign)s, %(sign_name)s, %(nakshatra)s, %(nakshatra_name)s,
       %(nakshatra_pada)s, %(combust)s
WHERE NOT EXISTS (
    SELECT 1 FROM {TABLE}
    WHERE date = %(date)s AND planet = %(planet)s
)
"""


def insert_batch_conflict(cur, batch: list[dict]) -> tuple[int, int]:
    """Insert using ON CONFLICT DO NOTHING (requires unique constraint)."""
    values = [
        (
            r['date'], r['planet'], r['longitude'], r['speed'], r['retrograde'],
            r['sign'], r['sign_name'], r['nakshatra'], r['nakshatra_name'],
            r['nakshatra_pada'], r['combust'],
        )
        for r in batch
    ]
    before = cur.rowcount  # not reliable across batches; use statusmessage
    psycopg2.extras.execute_values(cur, INSERT_SQL, values, page_size=BATCH_SIZE)
    # statusmessage is "INSERT 0 N" where N = rows actually inserted
    inserted = int(cur.statusmessage.split()[-1])
    skipped  = len(batch) - inserted
    return inserted, skipped


def insert_batch_safe(cur, batch: list[dict]) -> tuple[int, int]:
    """Insert row-by-row using WHERE NOT EXISTS (no unique constraint needed)."""
    inserted = skipped = 0
    for r in batch:
        cur.execute(INSERT_SQL_SAFE, r)
        if int(cur.statusmessage.split()[-1]) == 1:
            inserted += 1
        else:
            skipped += 1
    return inserted, skipped


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    print('=' * 60)
    print('OUTER PLANETS INSERT — Neptune / Herschel / Pluto')
    print('=' * 60)

    # ── Load JSON ──
    print(f'\nLoading {output_path} ...')
    if not output_path.exists():
        print(f'ERROR: {output_path} not found.')
        print('  Run generate_ephemeris.py first to produce the JSON.')
        return

    with open(output_path) as f:
        all_rows = json.load(f)
    print(f'  Total rows in JSON: {len(all_rows):,}')

    # ── Filter to outer planets only ──
    rows = [r for r in all_rows if r['planet'] in OUTER_PLANETS]
    print(f'  Outer-planet rows: {len(rows):,}  '
          f'({", ".join(f"{p}={sum(1 for r in rows if r[\"planet\"]==p)}" for p in sorted(OUTER_PLANETS))})')

    if not rows:
        print('\nNothing to insert — no outer planet rows found in JSON.')
        return

    # ── Connect ──
    print('\nConnecting to database...')
    conn = get_conn()
    print('  Connected.')

    try:
        with conn:
            with conn.cursor() as cur:

                # ── Check constraint ──
                print(f'\nChecking unique constraints on {TABLE}...')
                has_constraint = check_unique_constraint(cur)
                if has_constraint:
                    print('  → Using ON CONFLICT (date, planet) DO NOTHING')
                else:
                    print('  → No unique constraint found; using WHERE NOT EXISTS (slower but safe)')

                # ── Per-planet summary buckets ──
                summary: dict[str, tuple[int, int]] = {p: (0, 0) for p in OUTER_PLANETS}

                # ── Insert by planet, batch by batch ──
                for planet in sorted(OUTER_PLANETS):
                    planet_rows = [r for r in rows if r['planet'] == planet]
                    total       = len(planet_rows)
                    p_ins = p_skp = 0
                    batches     = (total + BATCH_SIZE - 1) // BATCH_SIZE

                    print(f'\n  {planet}: {total:,} rows → {batches} batch(es)')

                    for i in range(0, total, BATCH_SIZE):
                        batch     = planet_rows[i:i + BATCH_SIZE]
                        batch_num = i // BATCH_SIZE + 1

                        if has_constraint:
                            ins, skp = insert_batch_conflict(cur, batch)
                        else:
                            ins, skp = insert_batch_safe(cur, batch)

                        p_ins += ins
                        p_skp += skp
                        print(f'    batch {batch_num}/{batches}: +{ins} inserted, {skp} skipped')

                    summary[planet] = (p_ins, p_skp)

        # ── Summary ──
        print('\n' + '=' * 60)
        print('SUMMARY')
        print('=' * 60)
        total_ins = total_skp = 0
        for planet in sorted(OUTER_PLANETS):
            ins, skp = summary[planet]
            total_ins += ins
            total_skp += skp
            print(f'  {planet:<10} {ins:>6} inserted,  {skp:>6} skipped')
        print(f'  {"─" * 38}')
        print(f'  {"Total":<10} {total_ins:>6} inserted,  {total_skp:>6} skipped')
        print()

    finally:
        conn.close()


if __name__ == '__main__':
    main()
