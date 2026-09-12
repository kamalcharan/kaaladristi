"""Publish longer-term basket snapshots after migration 208.

python scripts/refresh_sector_leadership.py                 # latest session
python scripts/refresh_sector_leadership.py --from 2026-06-01 --to 2026-09-11
Historical dates are reconstructed using current recorded membership.
"""
import argparse
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main():
    import psycopg2
    from lib.config import DATABASE_URL
    from lib.sector_leadership import refresh_snapshots
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--from', dest='start', type=date.fromisoformat)
    parser.add_argument('--to', dest='end', type=date.fromisoformat)
    args = parser.parse_args()
    if bool(args.start) != bool(args.end) or (args.start and args.start > args.end):
        parser.error('Supply both --from and --to, in date order')
    conn = psycopg2.connect(DATABASE_URL, connect_timeout=30)
    try:
        with conn.cursor() as cur:
            cur.execute("SET statement_timeout='15min'")
            if args.start:
                cur.execute('SELECT DISTINCT trade_date FROM km_index_eod WHERE trade_date BETWEEN %s AND %s AND ema_20 IS NOT NULL ORDER BY trade_date', (args.start,args.end))
                dates = [str(r[0]) for r in cur.fetchall()]
            else:
                cur.execute('SELECT max(trade_date) FROM km_index_eod WHERE ema_20 IS NOT NULL')
                value = cur.fetchone()[0]
                dates = [str(value)] if value else []
        for target in dates:
            count = refresh_snapshots(conn, target)
            print(f'{target}: published {count} category/window snapshots', flush=True)
    finally:
        conn.close()


if __name__ == '__main__':
    main()
