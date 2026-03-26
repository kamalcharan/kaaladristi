"""
PostgREST client for KaalaDristi.
Replaces the old SupabaseREST class — same PostgREST protocol, new infra.

Works with both:
  - Self-hosted PostgREST (POSTGREST_URL=http://postgrest:3000)
  - Legacy Supabase (VITE_SUPABASE_URL=https://xxx.supabase.co → /rest/v1)
"""

import sys
import requests
from .config import POSTGREST_URL, POSTGREST_SERVICE_KEY


class PostgRESTClient:
    """Lightweight PostgREST HTTP client."""

    def __init__(self, url: str = None, key: str = None):
        url = url or POSTGREST_URL
        key = key or POSTGREST_SERVICE_KEY
        if not url or not key:
            print('ERROR: POSTGREST_URL and POSTGREST_SERVICE_KEY must be set in .env')
            sys.exit(1)

        # Self-hosted PostgREST: URL is the base directly (http://postgrest:3000)
        # Supabase legacy: URL is https://xxx.supabase.co → need /rest/v1
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
        # Supabase also needs the apikey header
        if 'supabase.co' in url:
            self.headers['apikey'] = key

    def select(self, table: str, columns: str = '*', filters: dict = None,
               order: str = None, ilike: tuple = None, limit: int = None) -> list:
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
        resp = requests.get(url, headers=self.headers)
        resp.raise_for_status()
        return resp.json()

    def upsert(self, table: str, records: list, on_conflict: str) -> int:
        if not records:
            return 0
        url = f'{self.base}/{table}?on_conflict={on_conflict}'
        headers = {**self.headers, 'Prefer': 'resolution=merge-duplicates,return=minimal'}
        resp = requests.post(url, headers=headers, json=records)
        resp.raise_for_status()
        return len(records)

    def insert(self, table: str, record: dict) -> bool:
        url = f'{self.base}/{table}'
        headers = {**self.headers, 'Prefer': 'return=minimal'}
        resp = requests.post(url, headers=headers, json=record)
        return resp.status_code in (200, 201)

    def patch(self, table: str, filters: dict, data: dict) -> bool:
        url = f'{self.base}/{table}'
        for k, v in filters.items():
            url += f'?{k}=eq.{v}' if '?' not in url else f'&{k}=eq.{v}'
        headers = {**self.headers, 'Prefer': 'return=minimal'}
        resp = requests.patch(url, headers=headers, json=data)
        return resp.status_code in (200, 204)

    def rpc(self, fn_name: str, params: dict = None) -> any:
        url = f'{self.base}/rpc/{fn_name}'
        resp = requests.post(url, headers=self.headers, json=params or {})
        resp.raise_for_status()
        return resp.json()

    def ping(self) -> bool:
        try:
            self.select('km_index_symbols', columns='id', limit=1)
            return True
        except Exception:
            return False


# Backward-compatible aliases
SupabaseREST = PostgRESTClient


def get_db() -> PostgRESTClient:
    """Return a connected PostgREST client, or exit on failure."""
    db = PostgRESTClient()
    if not db.ping():
        print('ERROR: Cannot connect to PostgREST')
        sys.exit(1)
    return db


# Legacy alias
get_supabase = get_db
