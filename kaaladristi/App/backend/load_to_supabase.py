import json
import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

# =============================================================================
# CONFIGURATION
# =============================================================================

script_dir = os.path.dirname(os.path.abspath(__file__))
output_path = os.path.join(script_dir, 'output')

# Try multiple .env locations
for env_candidate in [
    os.path.join(script_dir, '.env'),
    os.path.join(script_dir, '..', 'frontend', '.env'),
    os.path.join(script_dir, '..', '.env'),
]:
    if os.path.exists(env_candidate):
        load_dotenv(env_candidate)
        break

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

# Batch size for inserts
BATCH_SIZE = 1000

# Client created lazily in main()
supabase: Client = None

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


def insert_batch(table_name, records, batch_num, total_batches):
    """Insert a batch of records into Supabase."""
    try:
        supabase.table(table_name).insert(records).execute()
        print(f"    Batch {batch_num}/{total_batches} inserted ({len(records)} records)")
        return True
    except Exception as e:
        print(f"    ERROR in batch {batch_num}: {str(e)[:200]}")
        return False


def upload_data(table_name, data, transform_fn=None):
    """Upload data to Supabase table in batches."""
    print(f"\nUploading to {table_name}...")

    # Transform data if needed
    if transform_fn:
        data = [transform_fn(record) for record in data]

    # Calculate batches
    total_records = len(data)
    total_batches = (total_records + BATCH_SIZE - 1) // BATCH_SIZE

    success_count = 0
    fail_count = 0

    for i in range(0, total_records, BATCH_SIZE):
        batch = data[i:i + BATCH_SIZE]
        batch_num = (i // BATCH_SIZE) + 1

        if insert_batch(table_name, batch, batch_num, total_batches):
            success_count += len(batch)
        else:
            fail_count += len(batch)

    print(f"  Uploaded {success_count} records")
    if fail_count > 0:
        print(f"  FAILED {fail_count} records")

    return success_count, fail_count


# =============================================================================
# DATA TRANSFORMERS
# =============================================================================

def transform_position(record):
    """Transform position record for Supabase."""
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
    """Transform aspect record for Supabase."""
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
    """Transform event record for Supabase."""
    return {
        'event_date': record['event_date'],
        'event_type': record['event_type'],
        'planet': record['planet'],
        'from_value': record.get('from_value'),
        'to_value': record.get('to_value'),
        'severity': record.get('severity', 'normal'),
    }


def transform_moon(record):
    """Transform moon intraday record for Supabase."""
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


def transform_panchang(record):
    """Transform panchang record for Supabase."""
    return {
        'date': record['date'],
        'sunrise_jd': record['sunrise_jd'],
        'sunrise_ist': record['sunrise_ist'],
        'sunset_jd': record['sunset_jd'],
        'sunset_ist': record['sunset_ist'],
        'tithi_num': record['tithi_num'],
        'tithi_name': record['tithi_name'],
        'tithi_base_name': record.get('tithi_base_name'),
        'paksha': record['paksha'],
        'tithi_group': record.get('tithi_group'),
        'tithi_lord': record.get('tithi_lord'),
        'nakshatra_num': record['nakshatra_num'],
        'nakshatra_name': record['nakshatra_name'],
        'nakshatra_lord': record.get('nakshatra_lord'),
        'nakshatra_pada': record.get('nakshatra_pada'),
        'yoga_num': record.get('yoga_num'),
        'yoga_name': record.get('yoga_name'),
        'karana_num': record.get('karana_num'),
        'karana_name': record.get('karana_name'),
        'vara': record['vara'],
        'vara_lord': record['vara_lord'],
        'dlnl_match': record.get('dlnl_match', False),
        'sun_sign': record.get('sun_sign'),
        'sun_sign_name': record.get('sun_sign_name'),
        'sun_longitude': record.get('sun_longitude'),
        'sun_tropical_longitude': record.get('sun_tropical_longitude'),
        'moon_sign': record.get('moon_sign'),
        'moon_sign_name': record.get('moon_sign_name'),
        'moon_longitude': record.get('moon_longitude'),
        'is_sankranti': record.get('is_sankranti', False),
        'sankranti_from': record.get('sankranti_from'),
        'sankranti_to': record.get('sankranti_to'),
        'hemisphere_event': record.get('hemisphere_event'),
        'is_purnima': record.get('is_purnima', False),
        'is_amavasya': record.get('is_amavasya', False),
        'is_ekadashi': record.get('is_ekadashi', False),
    }


# =============================================================================
# TABLE DEFINITIONS
# =============================================================================

TABLES = {
    'ephemeris': {
        'positions': ('km_planetary_positions', 'planetary_positions.json', transform_position),
        'aspects': ('km_planetary_aspects', 'aspects.json', transform_aspect),
        'events': ('km_astro_events', 'events.json', transform_event),
        'moon': ('km_moon_intraday', 'moon_intraday.json', transform_moon),
    },
    'panchang': {
        'panchang': ('km_daily_panchang', 'daily_panchang.json', transform_panchang),
    },
}


# =============================================================================
# MAIN EXECUTION
# =============================================================================

def upload_group(group_name, table_defs):
    """Upload a group of tables."""
    results = {}
    for key, (table, json_file, transform) in table_defs.items():
        data = load_json(json_file)
        results[key] = upload_data(table, data, transform)
    return results


def main():
    global supabase

    print("=" * 60)
    print("KALA-DRISHTI DATA LOADER")
    print("=" * 60)

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("\nERROR: SUPABASE_URL and SUPABASE_KEY not found.")
        print("Set them via environment variables or create a .env file in:")
        print(f"  {script_dir}/.env")
        print(f"  {os.path.join(script_dir, '..', 'frontend', '.env')}")
        print("\nRequired .env contents:")
        print("  SUPABASE_URL=https://your-project.supabase.co")
        print("  SUPABASE_KEY=your-service-role-key")
        return

    print(f"\nSupabase URL: {SUPABASE_URL[:40]}...")
    print(f"Batch Size: {BATCH_SIZE}")

    # Parse --table argument
    target = 'all'
    for arg in sys.argv[1:]:
        if arg.startswith('--table='):
            target = arg.split('=', 1)[1]

    # Create client
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Test connection
    print("\nTesting Supabase connection...")
    try:
        result = supabase.table('km_planetary_positions').select('id').limit(1).execute()
        print("  Connected successfully")
    except Exception as e:
        print(f"  Connection failed: {e}")
        print("\nPlease check your SUPABASE_URL and SUPABASE_KEY")
        return

    # Determine which tables to upload
    if target == 'all':
        groups = TABLES
    elif target in TABLES:
        groups = {target: TABLES[target]}
    else:
        print(f"\nUnknown table group: {target}")
        print(f"Valid options: all, {', '.join(TABLES.keys())}")
        return

    # Upload
    print("\n" + "=" * 60)
    print("UPLOADING TO SUPABASE")
    print("=" * 60)

    all_results = {}
    for group_name, table_defs in groups.items():
        print(f"\n--- {group_name.upper()} ---")
        all_results.update(upload_group(group_name, table_defs))

    # Summary
    print("\n" + "=" * 60)
    print("UPLOAD COMPLETE")
    print("=" * 60)

    total_success = sum(r[0] for r in all_results.values())
    total_fail = sum(r[1] for r in all_results.values())

    print(f"\nTotal records uploaded: {total_success}")
    if total_fail > 0:
        print(f"Total records failed: {total_fail}")

    print("\nTable breakdown:")
    for key, (success, fail) in all_results.items():
        status = f"{success} uploaded"
        if fail > 0:
            status += f", {fail} FAILED"
        print(f"  {key}: {status}")


if __name__ == '__main__':
    main()
