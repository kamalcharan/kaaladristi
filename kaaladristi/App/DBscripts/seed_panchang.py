"""
Seed Panchang data from generated JSON into SQLite.
Also seeds Panchang master tables (tithis, yogas, karanas).
"""

import json
import os
from schema import get_connection, create_schema

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                          '..', 'backend', 'output')

BATCH_SIZE = 10000

# =============================================================================
# PANCHANG MASTER DATA
# =============================================================================

TITHI_NAMES = [
    'Shukla Pratipada', 'Shukla Dwitiya', 'Shukla Tritiya', 'Shukla Chaturthi',
    'Shukla Panchami', 'Shukla Shashthi', 'Shukla Saptami', 'Shukla Ashtami',
    'Shukla Navami', 'Shukla Dashami', 'Shukla Ekadashi', 'Shukla Dwadashi',
    'Shukla Trayodashi', 'Shukla Chaturdashi', 'Purnima',
    'Krishna Pratipada', 'Krishna Dwitiya', 'Krishna Tritiya', 'Krishna Chaturthi',
    'Krishna Panchami', 'Krishna Shashthi', 'Krishna Saptami', 'Krishna Ashtami',
    'Krishna Navami', 'Krishna Dashami', 'Krishna Ekadashi', 'Krishna Dwadashi',
    'Krishna Trayodashi', 'Krishna Chaturdashi', 'Amavasya',
]

BASE_TITHI_NAMES = [
    'Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami',
    'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami',
    'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi',
]

TITHI_GROUPS = {
    1: ('Nanda', 'Jupiter'), 6: ('Nanda', 'Jupiter'), 11: ('Nanda', 'Jupiter'),
    2: ('Bhadra', 'Mercury'), 7: ('Bhadra', 'Mercury'), 12: ('Bhadra', 'Mercury'),
    3: ('Jaya', 'Mars'), 8: ('Jaya', 'Mars'), 13: ('Jaya', 'Mars'),
    4: ('Rikta', 'Saturn'), 9: ('Rikta', 'Saturn'), 14: ('Rikta', 'Saturn'),
    5: ('Purna', 'Venus'), 10: ('Purna', 'Venus'), 15: ('Purna', 'Venus'),
}

YOGAS = [
    ('Vishkumbha', 'inauspicious'), ('Preeti', 'auspicious'), ('Ayushman', 'auspicious'),
    ('Saubhagya', 'auspicious'), ('Shobhana', 'auspicious'), ('Atiganda', 'inauspicious'),
    ('Sukarma', 'auspicious'), ('Dhriti', 'auspicious'), ('Shoola', 'inauspicious'),
    ('Ganda', 'inauspicious'), ('Vriddhi', 'auspicious'), ('Dhruva', 'auspicious'),
    ('Vyaghata', 'inauspicious'), ('Harshana', 'auspicious'), ('Vajra', 'inauspicious'),
    ('Siddhi', 'auspicious'), ('Vyatipata', 'inauspicious'), ('Variyan', 'auspicious'),
    ('Parigha', 'inauspicious'), ('Shiva', 'auspicious'), ('Siddha', 'auspicious'),
    ('Sadhya', 'auspicious'), ('Shubha', 'auspicious'), ('Shukla', 'auspicious'),
    ('Brahma', 'auspicious'), ('Indra', 'auspicious'), ('Vaidhriti', 'inauspicious'),
]

KARANAS_MASTER = [
    ('Bava', 'recurring'), ('Balava', 'recurring'), ('Kaulava', 'recurring'),
    ('Taitila', 'recurring'), ('Gara', 'recurring'), ('Vanija', 'recurring'),
    ('Vishti', 'recurring'), ('Kimstughna', 'fixed'), ('Shakuni', 'fixed'),
    ('Chatushpada', 'fixed'), ('Nagava', 'fixed'),
]


def seed_panchang_masters(conn):
    """Seed tithis, yogas, karanas master tables."""

    # Tithis (30 rows)
    records = []
    for i in range(30):
        num = i + 1
        name = TITHI_NAMES[i]
        paksha = 'Shukla' if num <= 15 else 'Krishna'
        tithi_in_paksha = num if num <= 15 else num - 15
        base_name = BASE_TITHI_NAMES[tithi_in_paksha - 1] if tithi_in_paksha < 15 else name
        if num == 15:
            base_name = 'Purnima'
        elif num == 30:
            base_name = 'Amavasya'
        group, lord = TITHI_GROUPS.get(tithi_in_paksha, ('', ''))
        records.append((num, num, name, base_name, paksha, group, lord))

    conn.executemany(
        "INSERT OR REPLACE INTO tithis (id, num, name, base_name, paksha, tattva_group, group_lord) "
        "VALUES (?,?,?,?,?,?,?)", records
    )
    print(f"  tithis: {len(records)} rows loaded")

    # Yogas (27 rows)
    records = []
    for i, (name, nature) in enumerate(YOGAS):
        records.append((i + 1, name, nature))
    conn.executemany(
        "INSERT OR REPLACE INTO yogas (id, name, nature) VALUES (?,?,?)", records
    )
    print(f"  yogas: {len(records)} rows loaded")

    # Karanas (11 unique types)
    records = []
    for i, (name, ktype) in enumerate(KARANAS_MASTER):
        records.append((i + 1, name, ktype))
    conn.executemany(
        "INSERT OR REPLACE INTO karanas (id, name, type) VALUES (?,?,?)", records
    )
    print(f"  karanas: {len(records)} rows loaded")

    conn.commit()


def seed_daily_panchang(conn):
    """Load daily_panchang.json into daily_panchang table."""
    json_path = os.path.join(OUTPUT_DIR, 'daily_panchang.json')
    if not os.path.exists(json_path):
        print(f"  WARNING: {json_path} not found. Run generate_panchang.py first.")
        return 0

    with open(json_path, 'r') as f:
        data = json.load(f)

    print(f"  Loading {len(data)} daily panchang records...")

    columns = [
        'date', 'sunrise_jd', 'sunrise_ist', 'sunset_jd', 'sunset_ist',
        'tithi_num', 'tithi_name', 'tithi_base_name', 'paksha', 'tithi_group', 'tithi_lord',
        'nakshatra_num', 'nakshatra_name', 'nakshatra_lord', 'nakshatra_pada',
        'yoga_num', 'yoga_name', 'karana_num', 'karana_name',
        'vara', 'vara_lord', 'dlnl_match',
        'sun_sign', 'sun_sign_name', 'sun_longitude', 'sun_tropical_longitude',
        'moon_sign', 'moon_sign_name', 'moon_longitude',
        'is_sankranti', 'sankranti_from', 'sankranti_to',
        'hemisphere_event', 'is_purnima', 'is_amavasya', 'is_ekadashi',
    ]

    placeholders = ','.join(['?'] * len(columns))
    col_names = ','.join(columns)
    sql = f"INSERT OR REPLACE INTO daily_panchang ({col_names}) VALUES ({placeholders})"

    batch = []
    loaded = 0
    for record in data:
        row = tuple(record.get(col) for col in columns)
        batch.append(row)
        if len(batch) >= BATCH_SIZE:
            conn.executemany(sql, batch)
            loaded += len(batch)
            batch = []
            print(f"    {loaded} records loaded...")

    if batch:
        conn.executemany(sql, batch)
        loaded += len(batch)

    conn.commit()
    print(f"  daily_panchang: {loaded} rows loaded")
    return loaded


def main():
    print("=" * 60)
    print("KĀLA-DRISHTI PANCHANG DATA SEED")
    print("=" * 60)

    conn = get_connection()
    create_schema(conn)

    print("\nSeeding Panchang master tables...")
    seed_panchang_masters(conn)

    print("\nSeeding daily Panchang data...")
    seed_daily_panchang(conn)

    # Verification
    print("\n" + "=" * 60)
    print("VERIFICATION")
    print("=" * 60)

    tables = ['tithis', 'yogas', 'karanas', 'daily_panchang']
    for table in tables:
        count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        print(f"  {table:25s} {count:>8} rows")

    # Sample panchang
    print("\n--- Sample Panchang Records ---")
    rows = conn.execute("""
        SELECT date, vara, tithi_name, nakshatra_name, yoga_name, karana_name, dlnl_match
        FROM daily_panchang
        WHERE date IN ('2024-01-14', '2024-03-20', '2024-06-20', '2025-01-01')
        ORDER BY date
    """).fetchall()
    for row in rows:
        dlnl = 'DLNL' if row['dlnl_match'] else ''
        print(f"  {row['date']}: {row['vara']:9s} | {row['tithi_name']:25s} | "
              f"{row['nakshatra_name']:20s} | {row['yoga_name']:12s} | {row['karana_name']:10s} {dlnl}")

    conn.close()
    print("\nPanchang seed complete.")


if __name__ == '__main__':
    main()
