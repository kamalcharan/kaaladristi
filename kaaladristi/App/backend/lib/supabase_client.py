"""
Lightweight Supabase REST client — replaces the duplicated class in 3 scripts.
Uses PostgREST directly via requests.
"""

import sys
import requests
from .config import SUPABASE_URL, SUPABASE_SERVICE_KEY


class SupabaseREST:
    def __init__(self, url: str = None, key: str = None):
        url = url or SUPABASE_URL
        key = key or SUPABASE_SERVICE_KEY
        if not url or not key:
            print('ERROR: VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_KEY must be set in .env')
            sys.exit(1)
        self.base = f'{url.rstrip("/")}/rest/v1'
        self.headers = {
            'apikey': key,
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json',
        }

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
        url = f'{self.base.replace("/rest/v1", "/rest/v1/rpc")}/{fn_name}'
        resp = requests.post(url, headers=self.headers, json=params or {})
        resp.raise_for_status()
        return resp.json()

    def ping(self) -> bool:
        try:
            self.select('km_index_symbols', columns='id', limit=1)
            return True
        except Exception:
            return False


def get_supabase() -> SupabaseREST:
    sb = SupabaseREST()
    if not sb.ping():
        print('ERROR: Cannot connect to Supabase')
        sys.exit(1)
    return sb
