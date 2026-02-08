"""
Seed ephemeris tables from generated JSON output files.
Loads: planetary_positions, planetary_aspects, astro_events, moon_intraday
"""

import json
import os
from schema import get_connection, create_schema, DB_PATH

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                          '..', 'backend', 'output')


def load_json(filename):
    path = os.path.join(OUTPUT_DIR, filename)
    print(f"  Loading {filename}...")
    with open(path, 'r') as f:
        data = json.load(f)
    print(f"    {len(data)} records read")
    return data


def seed_positions(conn, data):
    """Load planetary_positions.json."""
    records = []
    for r in data:
        records.append((
            r['date'], r['planet'], r['longitude'], r['speed'],
            1 if r.get('retrograde') else 0,
            r.get('sign'), r.get('sign_name'),
            r.get('nakshatra'), r.get('nakshatra_name'),
            r.get('nakshatra_pada'),
            1 if r.get('combust') else 0
        ))

    BATCH = 10000
    for i in range(0, len(records), BATCH):
        conn.executemany(
            """INSERT OR IGNORE INTO planetary_positions
               (date, planet, longitude, speed, retrograde, sign, sign_name,
                nakshatra, nakshatra_name, nakshatra_pada, combust)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            records[i:i+BATCH]
        )
    conn.commit()
    print(f"  planetary_positions: {len(records)} rows loaded")


def seed_aspects(conn, data):
    """Load aspects.json."""
    records = []
    for r in data:
        records.append((
            r['date'], r['planet_1'], r['planet_2'],
            r['aspect_type'], r['angle'], r['orb'],
            1 if r.get('exact') else 0
        ))

    BATCH = 10000
    for i in range(0, len(records), BATCH):
        conn.executemany(
            """INSERT OR IGNORE INTO planetary_aspects
               (date, planet_1, planet_2, aspect_type, angle, orb, exact)
               VALUES (?,?,?,?,?,?,?)""",
            records[i:i+BATCH]
        )
    conn.commit()
    print(f"  planetary_aspects: {len(records)} rows loaded")


def seed_events(conn, data):
    """Load events.json."""
    records = []
    for r in data:
        records.append((
            r['event_date'], r['event_type'], r['planet'],
            r.get('from_value'), r.get('to_value'),
            r.get('severity', 'normal')
        ))

    BATCH = 10000
    for i in range(0, len(records), BATCH):
        conn.executemany(
            """INSERT OR IGNORE INTO astro_events
               (event_date, event_type, planet, from_value, to_value, severity)
               VALUES (?,?,?,?,?,?)""",
            records[i:i+BATCH]
        )
    conn.commit()
    print(f"  astro_events: {len(records)} rows loaded")


def seed_moon(conn, data):
    """Load moon_intraday.json."""
    records = []
    for r in data:
        records.append((
            r['date'], r['time_ist'], r['longitude'],
            r.get('speed'),
            r.get('sign'), r.get('sign_name'),
            r.get('nakshatra'), r.get('nakshatra_name'),
            r.get('nakshatra_pada'),
            1 if r.get('gandanta') else 0
        ))

    BATCH = 10000
    for i in range(0, len(records), BATCH):
        conn.executemany(
            """INSERT OR IGNORE INTO moon_intraday
               (date, time_ist, longitude, speed, sign, sign_name,
                nakshatra, nakshatra_name, nakshatra_pada, gandanta)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            records[i:i+BATCH]
        )
    conn.commit()
    print(f"  moon_intraday: {len(records)} rows loaded")


def main():
    print("=" * 60)
    print("KĀLA-DRISHTI EPHEMERIS DATA SEED")
    print("=" * 60)
    print(f"Database: {DB_PATH}")
    print(f"Source: {OUTPUT_DIR}")
    print()

    conn = get_connection()
    create_schema(conn)

    print("Loading ephemeris data...")
    positions = load_json('planetary_positions.json')
    seed_positions(conn, positions)
    del positions

    aspects = load_json('aspects.json')
    seed_aspects(conn, aspects)
    del aspects

    events = load_json('events.json')
    seed_events(conn, events)
    del events

    moon = load_json('moon_intraday.json')
    seed_moon(conn, moon)
    del moon

    # Verification
    print("\n" + "=" * 60)
    print("VERIFICATION")
    print("=" * 60)

    for table in ['planetary_positions', 'planetary_aspects', 'astro_events', 'moon_intraday']:
        count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        date_range = conn.execute(f"SELECT MIN(date) as d1, MAX(date) as d2 FROM {table}" if 'event' not in table
                                   else f"SELECT MIN(event_date), MAX(event_date) FROM {table}").fetchone()
        print(f"  {table:25s} {count:>8} rows  ({date_range[0]} to {date_range[1]})")

    # Sample queries to verify data quality
    print("\n--- Retrograde periods (sample) ---")
    rows = conn.execute("""
        SELECT planet, COUNT(*) as retro_days
        FROM planetary_positions
        WHERE retrograde = 1
        GROUP BY planet
        ORDER BY retro_days DESC
    """).fetchall()
    for row in rows:
        print(f"  {row['planet']:10s} {row['retro_days']:>6} retrograde days")

    print("\n--- Aspect types ---")
    rows = conn.execute("""
        SELECT aspect_type, COUNT(*) as count, SUM(exact) as exact_count
        FROM planetary_aspects
        GROUP BY aspect_type
    """).fetchall()
    for row in rows:
        print(f"  {row['aspect_type']:15s} {row['count']:>6} total, {row['exact_count']:>5} exact")

    print("\n--- Event types ---")
    rows = conn.execute("""
        SELECT event_type, COUNT(*) as count
        FROM astro_events
        GROUP BY event_type
        ORDER BY count DESC
    """).fetchall()
    for row in rows:
        print(f"  {row['event_type']:25s} {row['count']:>6}")

    print("\n--- Moon gandanta days ---")
    count = conn.execute("SELECT COUNT(DISTINCT date) FROM moon_intraday WHERE gandanta = 1").fetchone()[0]
    print(f"  {count} unique gandanta days")

    conn.close()
    print("\nEphemeris seed complete.")


if __name__ == '__main__':
    main()
