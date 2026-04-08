"""
Apply km_migration_016_catalog_views.sql to the configured database.

Usage:
    python3 apply_migration_016.py

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
    script_dir, '..', 'DBscripts', 'km_migration_016_catalog_views.sql'
)


def verify_views(dsn: str) -> list[tuple]:
    """Return list of (view_name, size) for the catalog views."""
    conn = psycopg2.connect(dsn)
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT matviewname,
                       pg_size_pretty(pg_total_relation_size(
                           schemaname || '.' || matviewname::text))
                FROM   pg_matviews
                WHERE  matviewname IN ('mv_equity_catalog', 'mv_commodity_catalog')
                ORDER  BY matviewname
            """)
            return cur.fetchall()
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

    # psql handles all SQL syntax (dollar-quoting, multi-statement) correctly
    result = subprocess.run(
        ['psql', DATABASE_URL, '-f', sql_path, '--set=ON_ERROR_STOP=0'],
        capture_output=True,
        text=True,
    )

    stdout = result.stdout.strip()
    stderr = result.stderr.strip()

    if stdout:
        # Print DDL output, flag anything unexpected
        for line in stdout.splitlines():
            tag = '  warn' if 'ERROR' in line else '  ok  '
            print(f'{tag} — {line}')

    if stderr:
        for line in stderr.splitlines():
            # Role-not-found and "already exists" are expected in local dev
            if any(k in line for k in ('does not exist', 'already exists', 'skipping')):
                print(f'  warn — {line}')
            elif line.startswith('psql:') and 'ERROR' in line:
                print(f'  ERR  — {line}')
            else:
                print(f'       — {line}')

    print()

    # Verify regardless of warnings
    try:
        views = verify_views(DATABASE_URL)
    except Exception as e:
        print(f'ERROR: Could not verify views: {e}')
        sys.exit(1)

    if views:
        print('Views created:')
        for name, size in views:
            print(f'  ✓  {name}  ({size})')
        print('\nDone. Refresh the browser — Equities and Commodities should now load.')
    else:
        print('ERROR: Views were not created. Check errors above.')
        sys.exit(1)


if __name__ == '__main__':
    main()
