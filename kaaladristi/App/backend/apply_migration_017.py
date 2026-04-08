"""
Apply km_migration_017_inference_evaluation.sql to the configured database.

Usage:
    python3 apply_migration_017.py

Uses DATABASE_URL from frontend/.env (same credentials as pipeline_api.py).
"""

import os
import sys
import subprocess
import psycopg2

script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, script_dir)

from lib.config import DATABASE_URL

MIGRATION_FILE = os.path.join(
    script_dir, '..', 'DBscripts', 'km_migration_017_inference_evaluation.sql'
)


def verify_function(dsn: str) -> bool:
    """Return True if evaluate_dc_inferences() exists in the database."""
    conn = psycopg2.connect(dsn)
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT COUNT(*) FROM pg_proc
                JOIN   pg_namespace ns ON ns.oid = pg_proc.pronamespace
                WHERE  proname = 'evaluate_dc_inferences'
                  AND  ns.nspname = 'public'
            """)
            row = cur.fetchone()
            return (row[0] if row else 0) > 0
    finally:
        conn.close()


def main():
    if not DATABASE_URL:
        print('ERROR: DATABASE_URL is not set.')
        print('  Make sure frontend/.env has DB_PRIMARY=postgresql://...')
        sys.exit(1)

    sql_path = os.path.normpath(MIGRATION_FILE)
    if not os.path.exists(sql_path):
        print(f'ERROR: Migration file not found: {sql_path}')
        sys.exit(1)

    print(f'Applying {os.path.basename(sql_path)}...')

    result = subprocess.run(
        ['psql', DATABASE_URL, '-f', sql_path, '--set=ON_ERROR_STOP=0'],
        capture_output=True,
        text=True,
    )

    stdout = result.stdout.strip()
    stderr = result.stderr.strip()

    if stdout:
        for line in stdout.splitlines():
            tag = '  warn' if 'ERROR' in line else '  ok  '
            print(f'{tag} — {line}')

    if stderr:
        for line in stderr.splitlines():
            if any(k in line for k in ('does not exist', 'already exists', 'skipping')):
                print(f'  warn — {line}')
            elif line.startswith('psql:') and 'ERROR' in line:
                print(f'  ERR  — {line}')
            else:
                print(f'       — {line}')

    print()

    try:
        ok = verify_function(DATABASE_URL)
    except Exception as e:
        print(f'ERROR: Could not verify function: {e}')
        sys.exit(1)

    if ok:
        print('Function created:')
        print('  ✓  evaluate_dc_inferences(index, minor_pct, major_pct, lookback_days)')
        print('\nDone. Open /inference and click "Evaluate Rules" to use it.')
    else:
        print('ERROR: Function was not created. Check errors above.')
        sys.exit(1)


if __name__ == '__main__':
    main()
