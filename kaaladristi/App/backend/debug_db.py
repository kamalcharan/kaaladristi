"""Quick DB diagnostic — run: python debug_db.py"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lib.pg_client import PgClient
from lib.config import DATABASE_URL
import psycopg2.extras

db = PgClient(DATABASE_URL)
conn = db._conn()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# 1. Who am I, which DB, which schema?
cur.execute('SELECT current_user, current_database(), current_schema')
print('Context:', dict(cur.fetchone()))

# 2. Where does the table live?
cur.execute("SELECT schemaname, tablename FROM pg_tables WHERE tablename = 'km_commodity_symbols'")
rows = cur.fetchall()
print('Table location:', [dict(r) for r in rows])

# 3. Count rows
cur.execute('SELECT count(*) as n FROM km_commodity_symbols')
print('Commodity count:', dict(cur.fetchone()))

# 4. Sample rows
cur.execute('SELECT id, symbol, exchange FROM km_commodity_symbols LIMIT 3')
print('Sample:', [dict(r) for r in cur.fetchall()])

# 5. Also check equity symbols
cur.execute('SELECT count(*) as n FROM km_equity_symbols')
print('Equity count:', dict(cur.fetchone()))

cur.execute("SELECT count(*) as n FROM km_equity_symbols WHERE exchange = 'BSE'")
print('BSE equity count:', dict(cur.fetchone()))

# 6. Check search_path
cur.execute('SHOW search_path')
print('search_path:', cur.fetchone()[0])

db._put(conn)
print('\nDone.')
