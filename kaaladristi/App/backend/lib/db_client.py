"""
Database client factory for KaalaDristi backend.

Picks the best available connection method:
  1. Direct PostgreSQL (psycopg2) — if DATABASE_URL is set  ← preferred
  2. PostgREST HTTP — if POSTGREST_URL + key are set         ← fallback

Both clients expose the same API: select, upsert, insert, patch, rpc, ping.
"""

import sys
from .config import DATABASE_URL, POSTGREST_URL, POSTGREST_SERVICE_KEY


# ── PostgREST HTTP client (fallback) ─────────────────────────────────────────

class PostgRESTClient:
    """Lightweight PostgREST HTTP client."""

    def __init__(self, url: str = None, key: str = None):
        import requests as _requests
        self._requests = _requests

        url = url or POSTGREST_URL
        key = key or POSTGREST_SERVICE_KEY
        if not url or not key:
            raise ValueError('POSTGREST_URL and POSTGREST_SERVICE_KEY must be set')

        url = url.rstrip('/')
        if 'supabase.co' in url:
            self.base = f'{url}/rest/v1'
        elif url.endswith('/rest/v1'):
            self.base = url
        else:
            self.base = url

        self.headers = {
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json',
        }
        if 'supabase.co' in url:
            self.headers['apikey'] = key

    def select(self, table, columns='*', filters=None, order=None, ilike=None, limit=None):
        url = f'{self.base}/{table}?select={columns}'
        if filters:
            for k, v in filters.items():
                url += f'&{k}=eq.{v}'
        if ilike:
            col, val = ilike
            url += f'&{col}=ilike.{val}'
        if order:
            url += f'&order={order}'
        if limit:
            url += f'&limit={limit}'
        resp = self._requests.get(url, headers=self.headers)
        resp.raise_for_status()
        return resp.json()

    def upsert(self, table, records, on_conflict):
        if not records:
            return 0
        url = f'{self.base}/{table}?on_conflict={on_conflict}'
        headers = {**self.headers, 'Prefer': 'resolution=merge-duplicates,return=minimal'}
        resp = self._requests.post(url, headers=headers, json=records)
        resp.raise_for_status()
        return len(records)

    def insert(self, table, record):
        url = f'{self.base}/{table}'
        headers = {**self.headers, 'Prefer': 'return=minimal'}
        resp = self._requests.post(url, headers=headers, json=record)
        return resp.status_code in (200, 201)

    def patch(self, table, filters, data):
        url = f'{self.base}/{table}'
        for k, v in filters.items():
            url += f'?{k}=eq.{v}' if '?' not in url else f'&{k}=eq.{v}'
        headers = {**self.headers, 'Prefer': 'return=minimal'}
        resp = self._requests.patch(url, headers=headers, json=data)
        return resp.status_code in (200, 204)

    def rpc(self, fn_name, params=None):
        url = f'{self.base}/rpc/{fn_name}'
        resp = self._requests.post(url, headers=self.headers, json=params or {})
        resp.raise_for_status()
        return resp.json()

    def ping(self):
        try:
            self.select('km_index_symbols', columns='id', limit=1)
            return True
        except Exception:
            return False


# ── Factory ───────────────────────────────────────────────────────────────────

# Backward-compatible aliases
SupabaseREST = PostgRESTClient


def get_db():
    """
    Return a connected database client.
    Prefers direct PG (psycopg2) when DATABASE_URL is set.
    Falls back to PostgREST HTTP.
    """
    # Try direct PostgreSQL first
    if DATABASE_URL:
        try:
            from .pg_client import PgClient
            db = PgClient(DATABASE_URL)
            if db.ping():
                print('  [db] Connected via PostgreSQL (direct)')
                return db
            else:
                print('  [db] PostgreSQL ping failed, trying PostgREST...')
        except ImportError:
            print('  [db] psycopg2 not installed, trying PostgREST...')
        except Exception as e:
            print(f'  [db] PostgreSQL connection failed: {e}, trying PostgREST...')

    # Fall back to PostgREST
    if POSTGREST_URL and POSTGREST_SERVICE_KEY:
        try:
            db = PostgRESTClient()
            if db.ping():
                print('  [db] Connected via PostgREST')
                return db
        except Exception as e:
            print(f'  [db] PostgREST connection failed: {e}')

    print('ERROR: No database connection available.')
    print('  Set DATABASE_URL for direct PG, or POSTGREST_URL + POSTGREST_SERVICE_KEY for REST.')
    sys.exit(1)


# Legacy alias
get_supabase = get_db
