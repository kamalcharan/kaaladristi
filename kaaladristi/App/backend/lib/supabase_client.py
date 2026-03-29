"""
Backward-compatibility shim — imports from db_client.
All new code should import from lib.db_client directly.
"""

from .db_client import PostgRESTClient as SupabaseREST, get_db as get_supabase  # noqa: F401
