"""
Apply km_migration_018_panchang_end_times.sql

Usage:
    cd App/backend
    python3 apply_migration_018.py
"""

import os
import sys
import subprocess
import psycopg2

script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, script_dir)

from lib.config import DATABASE_URL

MIGRATION_FILE = os.path.normpath(
    os.path.join(script_dir, '..', 'DBscripts', 'km_migration_018_panchang_end_times.sql')
)


def verify(dsn: str) -> bool:
    conn = psycopg2.connect(dsn)
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_name = 'km_daily_panchang'
                  AND column_name IN ('tithi_end_ist', 'nakshatra_end_ist')
            """)
            row = cur.fetchone()
            return (row[0] if row else 0) == 2
    finally:
        conn.close()


def main():
    if not DATABASE_URL:
        print('ERROR: DATABASE_URL not set — check App/.env')
        sys.exit(1)

    print(f'Applying {os.path.basename(MIGRATION_FILE)} ...')
    result = subprocess.run(
        ['psql', DATABASE_URL, '-f', MIGRATION_FILE, '--set=ON_ERROR_STOP=0'],
        capture_output=True, text=True,
    )
    for line in (result.stdout + result.stderr).splitlines():
        print(f'  {line}')

    if verify(DATABASE_URL):
        print('\n  ✓  tithi_end_ist and nakshatra_end_ist columns present')
        print('\nNext step: python3 populate_panchang_end_times.py')
    else:
        print('\nERROR: columns not found after migration — check output above')
        sys.exit(1)


if __name__ == '__main__':
    main()
