"""
Direct PostgreSQL client for KaalaDristi backend.
Same API as PostgRESTClient so callers don't need to change.

Uses psycopg2 with a connection pool for efficient reuse.
Preferred over PostgREST for backend scripts (no JWT needed).
"""

import json
import time
import psycopg2
import psycopg2.pool
import psycopg2.extras
from .config import DATABASE_URL

# Register JSONB adapter so psycopg2 returns dicts, not strings
psycopg2.extras.register_default_jsonb(loads=json.loads)

# Pool sizing:
#   FastAPI polls 4 endpoints every 10s → up to 4 concurrent reads
#   Background pipeline thread → up to 3 concurrent step writes
#   Headroom for backfill jobs (multiple dates in flight)
_POOL_MIN = 2
_POOL_MAX = 20


class PgClient:
    """Drop-in replacement for PostgRESTClient using direct PostgreSQL."""

    def __init__(self, dsn: str = None):
        dsn = dsn or DATABASE_URL
        if not dsn:
            raise ValueError('DATABASE_URL is not set')
        self._pool = psycopg2.pool.ThreadedConnectionPool(_POOL_MIN, _POOL_MAX, dsn)

    def _conn(self):
        """Get a connection from the pool, retrying briefly if exhausted."""
        for attempt in range(10):
            try:
                return self._pool.getconn()
            except psycopg2.pool.PoolError:
                if attempt < 9:
                    time.sleep(0.2)   # wait 200ms, total ~2s max
                else:
                    raise

    def _put(self, conn):
        self._pool.putconn(conn)

    # ── SELECT ────────────────────────────────────────────────────────────

    def select(self, table: str, columns: str = '*', filters: dict = None,
               order: str = None, ilike: tuple = None, limit: int = None) -> list:
        parts = [f'SELECT {columns} FROM {table}']
        params = []

        wheres = []
        if filters:
            for k, v in filters.items():
                wheres.append(f'{k} = %s')
                params.append(v)
        if ilike:
            col, val = ilike
            # PostgREST ilike uses %pattern% — keep same convention
            wheres.append(f'{col} ILIKE %s')
            params.append(val)

        if wheres:
            parts.append('WHERE ' + ' AND '.join(wheres))
        if order:
            # PostgREST format: "col" or "col.desc"
            if '.' in order:
                col, direction = order.rsplit('.', 1)
                parts.append(f'ORDER BY {col} {direction.upper()}')
            else:
                parts.append(f'ORDER BY {order}')
        if limit:
            parts.append(f'LIMIT {limit}')

        sql = ' '.join(parts)
        conn = self._conn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(sql, params)
                rows = cur.fetchall()
            return [dict(r) for r in rows]
        finally:
            self._put(conn)

    # ── UPSERT ────────────────────────────────────────────────────────────

    def upsert(self, table: str, records: list, on_conflict: str) -> int:
        if not records:
            return 0

        cols = list(records[0].keys())
        conflict_cols = [c.strip() for c in on_conflict.split(',')]
        update_cols = [c for c in cols if c not in conflict_cols]

        col_list = ', '.join(cols)
        placeholders = ', '.join([f'%({c})s' for c in cols])
        update_set = ', '.join([f'{c} = EXCLUDED.{c}' for c in update_cols]) if update_cols else 'id = EXCLUDED.id'

        sql = (
            f'INSERT INTO {table} ({col_list}) VALUES ({placeholders}) '
            f'ON CONFLICT ({on_conflict}) DO UPDATE SET {update_set}'
        )

        conn = self._conn()
        try:
            with conn.cursor() as cur:
                psycopg2.extras.execute_batch(cur, sql, records, page_size=500)
            conn.commit()
            return len(records)
        except Exception:
            conn.rollback()
            raise
        finally:
            self._put(conn)

    # ── INSERT ────────────────────────────────────────────────────────────

    def insert(self, table: str, record: dict) -> bool:
        cols = list(record.keys())
        col_list = ', '.join(cols)
        placeholders = ', '.join([f'%({c})s' for c in cols])
        sql = f'INSERT INTO {table} ({col_list}) VALUES ({placeholders})'

        conn = self._conn()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, record)
            conn.commit()
            return True
        except Exception:
            conn.rollback()
            return False
        finally:
            self._put(conn)

    # ── PATCH (UPDATE) ────────────────────────────────────────────────────

    def patch(self, table: str, filters: dict, data: dict) -> bool:
        set_parts = []
        params = []
        for k, v in data.items():
            # Handle JSONB — if value is a string that looks like JSON, cast it
            if isinstance(v, str) and v.startswith('{'):
                set_parts.append(f'{k} = %s::jsonb')
            else:
                set_parts.append(f'{k} = %s')
            params.append(v)

        where_parts = []
        for k, v in filters.items():
            where_parts.append(f'{k} = %s')
            params.append(v)

        sql = f"UPDATE {table} SET {', '.join(set_parts)} WHERE {' AND '.join(where_parts)}"

        conn = self._conn()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, params)
            conn.commit()
            return True
        except Exception:
            conn.rollback()
            return False
        finally:
            self._put(conn)

    # ── RPC (call a PG function) ──────────────────────────────────────────

    def rpc(self, fn_name: str, params: dict = None) -> any:
        # Many of our RPCs (compute_all_pending_indicators, compute_all_magic_rs,
        # compute_all_flow_intelligence, …) perform UPDATEs inside PL/pgSQL.
        # psycopg2 defaults to autocommit=False, so without an explicit commit
        # the writes stay in an open transaction on the pooled connection and
        # get rolled back by the next unrelated caller. Match upsert()/patch()/
        # insert(): commit on success, rollback + re-raise on failure so
        # callers' try/except (e.g. tracker.fail()) still captures the error.
        params = params or {}
        arg_list = ', '.join([f'%({k})s' for k in params.keys()])
        sql = f'SELECT * FROM {fn_name}({arg_list})'

        conn = self._conn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(sql, params)
                rows = cur.fetchall()
            conn.commit()
            return [dict(r) for r in rows]
        except Exception:
            conn.rollback()
            raise
        finally:
            self._put(conn)

    # ── PING ──────────────────────────────────────────────────────────────

    def ping(self) -> bool:
        conn = self._conn()
        try:
            with conn.cursor() as cur:
                cur.execute('SELECT 1')
            return True
        except Exception:
            return False
        finally:
            self._put(conn)

    def close(self):
        self._pool.closeall()
