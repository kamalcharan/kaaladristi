"""
Apply km_migration_018_panchang_end_times.sql

Usage (Windows):
    cd App\\backend
    python apply_migration_018.py

Usage (Linux/Mac):
    cd App/backend
    python3 apply_migration_018.py
"""

import os
import sys
import psycopg2

script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, script_dir)

from lib.config import DATABASE_URL

MIGRATION_FILE = os.path.normpath(
    os.path.join(script_dir, '..', 'DBscripts', 'km_migration_018_panchang_end_times.sql')
)


def apply(dsn: str, sql_path: str):
    with open(sql_path, 'r', encoding='utf-8') as f:
        sql = f.read()

    conn = psycopg2.connect(dsn)
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
        print('  Migration executed successfully.')
    except psycopg2.Error as e:
        conn.rollback()
        # IF NOT EXISTS makes this idempotent — already-exists is fine
        print(f'  Note: {e.pgcode} — {e.pgerror.strip() if e.pgerror else e}')
    finally:
        conn.close()


def verify(dsn: str) -> bool:
    conn = psycopg2.connect(dsn)
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_name   = 'km_daily_panchang'
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

    if not os.path.exists(MIGRATION_FILE):
        print(f'ERROR: Migration file not found: {MIGRATION_FILE}')
        sys.exit(1)

    print(f'Applying {os.path.basename(MIGRATION_FILE)} ...')
    apply(DATABASE_URL, MIGRATION_FILE)

    if verify(DATABASE_URL):
        print('  ✓  tithi_end_ist and nakshatra_end_ist columns present')
        print('\nNext step:')
        print('  python populate_panchang_end_times.py')
    else:
        print('ERROR: columns not found after migration — check output above')
        sys.exit(1)


if __name__ == '__main__':
    main()
