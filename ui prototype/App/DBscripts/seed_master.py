"""
Seed master/reference tables from QuantMappings CSVs.
"""

import csv
import os
import re
from schema import get_connection, create_schema, DB_PATH

QUANT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                         '..', '..', '..', 'NSE Data Analysis', 'QuantMappings')
NSE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                       '..', '..', '..', 'NSE Data Analysis')


def read_csv(filename):
    path = os.path.join(QUANT_DIR, filename)
    with open(path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        return list(reader), reader.fieldnames


# =========================================================================
# PLANETS
# =========================================================================
def seed_planets(conn):
    """Load planets.csv into planets table."""
    rows, _ = read_csv('planets.csv')

    # Category classification
    classical = {'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'}
    nodes = {'Rahu', 'Ketu'}

    records = []
    for i, row in enumerate(rows, 1):
        name = row.get('Planet', '').strip()
        if not name:
            continue
        if name in classical:
            cat = 'classical'
        elif name in nodes:
            cat = 'node'
        else:
            cat = 'outer'
        records.append((i, name, None, cat))

    conn.executemany(
        "INSERT OR REPLACE INTO planets (id, name, vedic_name, category) VALUES (?,?,?,?)",
        records
    )
    conn.commit()
    print(f"  planets: {len(records)} rows loaded")
    return {r[1]: r[0] for r in records}  # name -> id map


# =========================================================================
# NAKSHATRAS
# =========================================================================
def seed_nakshatras(conn):
    """Load Nakshatra.csv into nakshatras table."""
    rows, _ = read_csv('Nakshatra.csv')

    # Standard nakshatra order (each spans 13°20' = 13.3333°)
    NAKSHATRA_ORDER = [
        'Ashvini', 'Bharani', 'Krithika', 'Rohini', 'Mrigasira', 'Arudra',
        'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni',
        'Uttara Phalguni', 'Hastha', 'Chitra', 'Swathi', 'Vishakha',
        'Anuradha', 'Jyestha', 'Moola', 'Purva Ashada', 'Uttara Ashada',
        'Shravana', 'Dhanistha', 'Shatabhisha', 'Purva Bhadra',
        'Uttara Bhadra', 'Revathi'
    ]

    # Build name lookup from CSV
    csv_names = set()
    for row in rows:
        name = row.get('Nakshatra', '').strip()
        if name:
            csv_names.add(name)

    records = []
    span = 360.0 / 27.0  # 13.3333°
    for i, name in enumerate(NAKSHATRA_ORDER):
        start = round(i * span, 4)
        end = round((i + 1) * span, 4)
        records.append((i + 1, name, start, end))

    conn.executemany(
        "INSERT OR REPLACE INTO nakshatras (id, name, start_deg, end_deg) VALUES (?,?,?,?)",
        records
    )
    conn.commit()
    print(f"  nakshatras: {len(records)} rows loaded")
    return {r[1]: r[0] for r in records}


# =========================================================================
# NAKSHATRA LORDS
# =========================================================================
def seed_nakshatra_lords(conn, nakshatra_map, planet_map):
    """Load nakshatralord.csv into nakshatra_lords table."""
    rows, _ = read_csv('nakshatralord.csv')

    records = []
    for row in rows:
        nak_name = row.get('Nakshatra', '').strip()
        planet_name = row.get('Planet', '').strip()
        nak_id = nakshatra_map.get(nak_name)
        planet_id = planet_map.get(planet_name)
        if nak_id and planet_id:
            records.append((nak_id, planet_id))

    conn.executemany(
        "INSERT OR REPLACE INTO nakshatra_lords (nakshatra_id, planet_id) VALUES (?,?)",
        records
    )
    conn.commit()
    print(f"  nakshatra_lords: {len(records)} rows loaded")


# =========================================================================
# ZODIAC SIGNS
# =========================================================================
def seed_zodiac(conn):
    """Load zodiac.csv into zodiac_signs table."""
    rows, _ = read_csv('zodiac.csv')

    ELEMENTS = {
        'Aries': 'Fire', 'Tauras': 'Earth', 'Gemini': 'Air', 'Cancer': 'Water',
        'Leo': 'Fire', 'Virgo': 'Earth', 'Libra': 'Air', 'Scorpio': 'Water',
        'Sagittarius': 'Fire', 'Capricon': 'Earth', 'Aquarius': 'Air', 'Pisces': 'Water'
    }

    records = []
    for i, row in enumerate(rows, 1):
        name = row.get('Zodiac', '').strip()
        if not name:
            continue
        start = round((i - 1) * 30.0, 1)
        end = round(i * 30.0, 1)
        records.append((i, name, ELEMENTS.get(name), start, end))

    conn.executemany(
        "INSERT OR REPLACE INTO zodiac_signs (id, name, element, start_deg, end_deg) VALUES (?,?,?,?,?)",
        records
    )
    conn.commit()
    print(f"  zodiac_signs: {len(records)} rows loaded")
    return {r[1]: r[0] for r in records}


# =========================================================================
# ZODIAC LORDS
# =========================================================================
def seed_zodiac_lords(conn, zodiac_map, planet_map):
    """Load zodiaclord.csv into zodiac_lords table."""
    rows, _ = read_csv('zodiaclord.csv')

    records = []
    for row in rows:
        zodiac_name = row.get('Zodiac', '').strip()
        planet_name = row.get('Planet', '').strip()
        zodiac_id = zodiac_map.get(zodiac_name)
        planet_id = planet_map.get(planet_name)
        if zodiac_id and planet_id:
            records.append((zodiac_id, planet_id))

    conn.executemany(
        "INSERT OR REPLACE INTO zodiac_lords (zodiac_id, planet_id) VALUES (?,?)",
        records
    )
    conn.commit()
    print(f"  zodiac_lords: {len(records)} rows loaded")


# =========================================================================
# DAYS OF WEEK + DAY LORDS
# =========================================================================
def seed_days(conn, planet_map):
    """Load Daysofweek.csv + daylord.csv."""
    rows, _ = read_csv('Daysofweek.csv')

    day_map = {}
    for i, row in enumerate(rows, 1):
        name = row.get('Day', '').strip()
        if not name:
            continue
        conn.execute(
            "INSERT OR REPLACE INTO days_of_week (id, name) VALUES (?,?)",
            (i, name)
        )
        day_map[name] = i

    conn.commit()
    print(f"  days_of_week: {len(day_map)} rows loaded")

    # Day lords
    rows, _ = read_csv('daylord.csv')
    records = []
    primary_days = set()
    for row in rows:
        day_name = row.get('Day', '').strip()
        planet_name = row.get('Planet', '').strip()
        day_id = day_map.get(day_name)
        planet_id = planet_map.get(planet_name)
        if day_id and planet_id:
            is_primary = 1 if day_id not in primary_days else 0
            primary_days.add(day_id)
            records.append((day_id, planet_id, is_primary))

    conn.executemany(
        "INSERT OR REPLACE INTO day_lords (day_id, planet_id, is_primary) VALUES (?,?,?)",
        records
    )
    conn.commit()
    print(f"  day_lords: {len(records)} rows loaded")


# =========================================================================
# SECTORS + SECTOR LORDS
# =========================================================================
def seed_sectors(conn, planet_map):
    """Load sectors.csv + sectorlord.csv."""
    rows, _ = read_csv('sectors.csv')

    sector_map = {}
    sector_id = 0
    for row in rows:
        name = row.get('Sector', '').strip()
        if not name or name in sector_map:
            continue
        sector_id += 1
        conn.execute(
            "INSERT OR REPLACE INTO sectors (id, name) VALUES (?,?)",
            (sector_id, name)
        )
        sector_map[name] = sector_id

    conn.commit()
    print(f"  sectors: {len(sector_map)} rows loaded")

    # Sector lords
    rows, _ = read_csv('sectorlord.csv')
    records = []
    seen = set()
    for row in rows:
        sector_name = row.get('Sector', '').strip()
        planet_name = row.get('Planet', '').strip()
        sector_id = sector_map.get(sector_name)
        planet_id = planet_map.get(planet_name)
        if sector_id and planet_id and (sector_id, planet_id) not in seen:
            seen.add((sector_id, planet_id))
            records.append((sector_id, planet_id))

    conn.executemany(
        "INSERT OR REPLACE INTO sector_lords (sector_id, planet_id) VALUES (?,?)",
        records
    )
    conn.commit()
    print(f"  sector_lords: {len(records)} rows loaded")
    return sector_map


# =========================================================================
# INDEX MASTER + COMPOSITION (from MW-NIFTY-*.csv files)
# =========================================================================
def seed_indices(conn, sector_map):
    """Load index definitions and composition from MW-*.csv files."""

    INDEX_DEFS = [
        ('NIFTY', 'NIFTY 50', '^NSEI', 'MW-NIFTY-50-08-Jan-2024.csv'),
        ('BANKNIFTY', 'NIFTY Bank', '^NSEBANK', 'MW-NIFTY-BANK-08-Jan-2024.csv'),
        ('NIFTYIT', 'NIFTY IT', '^CNXIT', 'MW-NIFTY-IT-08-Jan-2024.csv'),
        ('NIFTYFMCG', 'NIFTY FMCG', None, 'MW-NIFTY-FMCG-08-Jan-2024.csv'),
        ('NIFTYPHARMA', 'NIFTY Pharma', None, 'MW-NIFTY-PHARMA-08-Jan-2024.csv'),
        ('NIFTYMETAL', 'NIFTY Metal', None, 'MW-NIFTY-METAL-08-Jan-2024.csv'),
        ('NIFTYREALTY', 'NIFTY Realty', None, 'MW-NIFTY-REALTY-08-Jan-2024.csv'),
        ('NIFTYAUTO', 'NIFTY Auto', None, 'MW-NIFTY-AUTO-08-Jan-2024.csv'),
        ('NIFTYENERGY', 'NIFTY Energy', None, 'MW-NIFTY-ENERGY-08-Jan-2024.csv'),
        ('NIFTYPSU', 'NIFTY PSU Bank', None, 'MW-NIFTY-PSU-BANK-08-Jan-2024.csv'),
        ('NIFTYINFRA', 'NIFTY Infrastructure', None, 'MW-NIFTY-INFRASTRUCTURE-08-Jan-2024.csv'),
        ('NIFTYMEDIA', 'NIFTY Media', None, 'MW-NIFTY-MEDIA-08-Jan-2024.csv'),
        ('NIFTYFINSERV', 'NIFTY Financial Services', None, 'MW-NIFTY-FINANCIAL-SERVICES-08-Jan-2024.csv'),
    ]

    index_count = 0
    comp_count = 0

    for symbol, name, yahoo, csv_file in INDEX_DEFS:
        conn.execute(
            "INSERT OR REPLACE INTO index_master (symbol, name, yahoo_ticker) VALUES (?,?,?)",
            (symbol, name, yahoo)
        )
        index_count += 1

        # Get the index_id
        row = conn.execute("SELECT id FROM index_master WHERE symbol=?", (symbol,)).fetchone()
        index_id = row[0]

        # Load composition from MW CSV
        csv_path = os.path.join(NSE_DIR, csv_file)
        if not os.path.exists(csv_path):
            print(f"    WARN: {csv_file} not found, skipping composition")
            continue

        try:
            with open(csv_path, 'r', encoding='utf-8-sig') as f:
                content = f.read()

            # These CSVs have messy headers with embedded newlines
            # Parse manually: each stock is a row with SYMBOL, OPEN, HIGH, etc.
            lines = content.strip().split('\n')

            # Find data rows (skip header which may span multiple lines)
            stock_symbols = []
            for line in lines:
                # Clean the line
                line = line.strip().strip('"').strip(',')
                if not line:
                    continue
                parts = [p.strip().strip('"').strip() for p in line.split(',')]
                # A data row starts with a stock symbol (uppercase letters)
                if parts and re.match(r'^[A-Z][A-Z0-9&\-]+$', parts[0]):
                    stock_symbols.append(parts[0])

            for stock in stock_symbols:
                conn.execute(
                    "INSERT OR IGNORE INTO index_composition (index_id, stock_symbol, snapshot_date) VALUES (?,?,?)",
                    (index_id, stock, '2024-01-08')
                )
                comp_count += 1

        except Exception as e:
            print(f"    ERROR loading {csv_file}: {e}")

    conn.commit()
    print(f"  index_master: {index_count} indices loaded")
    print(f"  index_composition: {comp_count} stock-index mappings loaded")


# =========================================================================
# MAIN
# =========================================================================
def main():
    print("=" * 60)
    print("KĀLA-DRISHTI MASTER DATA SEED")
    print("=" * 60)
    print(f"Database: {DB_PATH}")
    print(f"QuantMappings: {QUANT_DIR}")
    print()

    conn = get_connection()
    create_schema(conn)

    print("Loading master tables...")

    planet_map = seed_planets(conn)
    nakshatra_map = seed_nakshatras(conn)
    seed_nakshatra_lords(conn, nakshatra_map, planet_map)
    zodiac_map = seed_zodiac(conn)
    seed_zodiac_lords(conn, zodiac_map, planet_map)
    seed_days(conn, planet_map)
    sector_map = seed_sectors(conn, planet_map)
    seed_indices(conn, sector_map)

    # Verification
    print("\n" + "=" * 60)
    print("VERIFICATION")
    print("=" * 60)

    tables = [
        'planets', 'nakshatras', 'nakshatra_lords', 'zodiac_signs',
        'zodiac_lords', 'days_of_week', 'day_lords', 'sectors',
        'sector_lords', 'index_master', 'index_composition'
    ]
    for table in tables:
        count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        print(f"  {table:25s} {count:>6} rows")

    # Show key relationships
    print("\n--- Planet -> Sector mapping sample ---")
    rows = conn.execute("""
        SELECT p.name AS planet, GROUP_CONCAT(s.name, ', ') AS sectors
        FROM sector_lords sl
        JOIN planets p ON p.id = sl.planet_id
        JOIN sectors s ON s.id = sl.sector_id
        WHERE p.category IN ('classical', 'node')
        GROUP BY p.name
        ORDER BY p.name
    """).fetchall()
    for row in rows:
        sectors = row['sectors']
        if len(sectors) > 80:
            sectors = sectors[:80] + '...'
        print(f"  {row['planet']:10s} -> {sectors}")

    # Show index composition counts
    print("\n--- Index composition ---")
    rows = conn.execute("""
        SELECT im.symbol, im.name, COUNT(ic.id) AS stocks
        FROM index_master im
        LEFT JOIN index_composition ic ON ic.index_id = im.id
        GROUP BY im.id
        ORDER BY stocks DESC
    """).fetchall()
    for row in rows:
        print(f"  {row['symbol']:15s} ({row['name']:30s}) {row['stocks']:>4} stocks")

    conn.close()
    print("\nMaster data seed complete.")


if __name__ == '__main__':
    main()
