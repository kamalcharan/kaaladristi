import json
import os
import sys
from dotenv import load_dotenv
from datetime import datetime

# =============================================================================
# CONFIGURATION
# =============================================================================

script_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(script_dir, '..', 'frontend', '.env'))
load_dotenv(os.path.join(script_dir, '..', '.env'), override=True)

sys.path.insert(0, script_dir)
from lib.db_client import get_db  # noqa: E402

output_path = os.path.join(script_dir, 'output')

# Batch size for inserts
BATCH_SIZE = 1000

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def load_json(filename):
    """Load JSON file from output directory."""
    filepath = os.path.join(output_path, filename)
    print(f"Loading {filename}...")
    with open(filepath, 'r') as f:
        data = json.load(f)
    print(f"  Loaded {len(data)} records")
    return data


def insert_batch(db, table_name, records, batch_num, total_batches):
    """Insert a batch of records into the database via PostgREST."""
    try:
        db.upsert(table_name, records, on_conflict='id')
        print(f"    Batch {batch_num}/{total_batches} inserted ({len(records)} records)")
        return True
    except Exception as e:
        print(f"    ERROR in batch {batch_num}: {str(e)[:100]}")
        # Fall back to single inserts
        ok = 0
        for rec in records:
            if db.insert(table_name, rec):
                ok += 1
        print(f"    Fallback: {ok}/{len(records)} inserted individually")
        return ok > 0


def upload_data(db, table_name, data, transform_fn=None):
    """Upload data to table in batches."""
    print(f"\nUploading to {table_name}...")

    # Transform data if needed
    if transform_fn:
        data = [transform_fn(record) for record in data]

    total_records = len(data)
    total_batches = (total_records + BATCH_SIZE - 1) // BATCH_SIZE

    success_count = 0
    fail_count = 0

    for i in range(0, total_records, BATCH_SIZE):
        batch = data[i:i + BATCH_SIZE]
        batch_num = (i // BATCH_SIZE) + 1

        if insert_batch(db, table_name, batch, batch_num, total_batches):
            success_count += len(batch)
        else:
            fail_count += len(batch)

    print(f"  Uploaded {success_count} records")
    if fail_count > 0:
        print(f"  Failed {fail_count} records")

    return success_count, fail_count


# =============================================================================
# DATA TRANSFORMERS
# =============================================================================

def transform_position(record):
    return {
        'date': record['date'],
        'planet': record['planet'],
        'longitude': record['longitude'],
        'speed': record['speed'],
        'retrograde': record['retrograde'],
        'sign': record['sign'],
        'sign_name': record['sign_name'],
        'nakshatra': record['nakshatra'],
        'nakshatra_name': record['nakshatra_name'],
        'nakshatra_pada': record['nakshatra_pada'],
        'combust': record.get('combust', False),
    }


def transform_aspect(record):
    return {
        'date': record['date'],
        'planet_1': record['planet_1'],
        'planet_2': record['planet_2'],
        'aspect_type': record['aspect_type'],
        'angle': record['angle'],
        'orb': record['orb'],
        'exact': record.get('exact', False),
    }


def transform_event(record):
    return {
        'event_date': record['event_date'],
        'event_type': record['event_type'],
        'planet': record['planet'],
        'from_value': record.get('from_value'),
        'to_value': record.get('to_value'),
        'severity': record.get('severity', 'normal'),
    }


def transform_moon(record):
    return {
        'date': record['date'],
        'time_ist': record['time_ist'],
        'longitude': record['longitude'],
        'speed': record['speed'],
        'sign': record['sign'],
        'sign_name': record['sign_name'],
        'nakshatra': record['nakshatra'],
        'nakshatra_name': record['nakshatra_name'],
        'nakshatra_pada': record['nakshatra_pada'],
        'gandanta': record.get('gandanta', False),
    }


# =============================================================================
# MAIN EXECUTION
# =============================================================================

def main():
    print("=" * 60)
    print("KAALA-DRISHTI DATA LOADER")
    print("=" * 60)
    print(f"Batch Size: {BATCH_SIZE}")

    # Connect to PostgREST
    print("\nConnecting to PostgREST...")
    db = get_db()
    print("  Connected successfully")

    # Load JSON files
    print("\n" + "=" * 60)
    print("LOADING JSON FILES")
    print("=" * 60)

    positions = load_json('planetary_positions.json')
    aspects = load_json('aspects.json')
    events = load_json('events.json')
    moon_data = load_json('moon_intraday.json')

    # Upload to database
    print("\n" + "=" * 60)
    print("UPLOADING TO DATABASE")
    print("=" * 60)

    results = {}

    results['positions'] = upload_data(
        db, 'planetary_positions',
        positions, transform_position
    )

    results['aspects'] = upload_data(
        db, 'planetary_aspects',
        aspects, transform_aspect
    )

    results['events'] = upload_data(
        db, 'astro_events',
        events, transform_event
    )

    results['moon'] = upload_data(
        db, 'moon_intraday',
        moon_data, transform_moon
    )

    # Summary
    print("\n" + "=" * 60)
    print("UPLOAD COMPLETE")
    print("=" * 60)

    total_success = sum(r[0] for r in results.values())
    total_fail = sum(r[1] for r in results.values())

    print(f"\nTotal records uploaded: {total_success}")
    if total_fail > 0:
        print(f"Total records failed: {total_fail}")

    print("\nTable breakdown:")
    print(f"  planetary_positions: {results['positions'][0]}")
    print(f"  planetary_aspects: {results['aspects'][0]}")
    print(f"  astro_events: {results['events'][0]}")
    print(f"  moon_intraday: {results['moon'][0]}")


if __name__ == '__main__':
    main()
