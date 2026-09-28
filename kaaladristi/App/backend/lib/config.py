"""
Shared configuration — loads .env once, exposes all settings.
Checks both backend/.env and frontend/.env (backend takes priority).
"""

import os
from dotenv import load_dotenv

_script_dir = os.path.dirname(os.path.abspath(__file__))

# Load frontend .env first (PostgREST / DB keys live here)
_frontend_env = os.path.join(_script_dir, '..', '..', 'frontend', '.env')
load_dotenv(_frontend_env)

# Load backend .env second — overrides any overlapping keys (Breeze keys live here)
_backend_env = os.path.join(_script_dir, '..', '.env')
load_dotenv(_backend_env, override=True)

# Database / PostgREST
POSTGREST_URL = os.getenv('POSTGREST_URL', '').strip()          # e.g. http://postgrest:3000
DATABASE_URL  = (
    os.getenv('DATABASE_URL', '').strip() or
    os.getenv('DB_PRIMARY', '').strip()      # Docker / shared env alias
)
JWT_SECRET = os.getenv('JWT_SECRET', '').strip() or os.getenv('VITE_JWT_SECRET', '').strip()

# Legacy Supabase env vars — map to PostgREST equivalents for backward compat
# Scripts that still read VITE_SUPABASE_URL will get POSTGREST_URL instead
if not POSTGREST_URL:
    POSTGREST_URL = os.getenv('VITE_SUPABASE_URL', '').strip()
    if POSTGREST_URL:
        # Supabase URL → PostgREST base (append /rest/v1 handled by client)
        pass

POSTGREST_SERVICE_KEY = os.getenv('POSTGREST_SERVICE_KEY', '').strip()
if not POSTGREST_SERVICE_KEY:
    POSTGREST_SERVICE_KEY = os.getenv('VITE_SUPABASE_SERVICE_KEY', '').strip()

POSTGREST_ANON_KEY = os.getenv('POSTGREST_ANON_KEY', '').strip()
if not POSTGREST_ANON_KEY:
    POSTGREST_ANON_KEY = os.getenv('VITE_SUPABASE_ANON_KEY', '').strip()

# ICICI Breeze
BREEZE_API_KEY = os.getenv('BREEZE_API_KEY', '').strip()
BREEZE_API_SECRET = os.getenv('BREEZE_API_SECRET', '').strip()
BREEZE_SESSION_TOKEN = os.getenv('BREEZE_SESSION_TOKEN', '').strip()

# Which parts of pipeline2 this process runs.
#   full      API + worker subprocess + scheduler   (the VPS; the default)
#   api-only  API only — no worker, no scheduler, no stale-job reset. For a
#             dev machine whose only database IS production: it serves every
#             route from prod without becoming a second pipeline.
# Either way the worker and scheduler take a session lease (pipeline2/lease.py),
# so a second `full` instance refuses to run them instead of splitting the queue.
PIPELINE2_ROLES = ('full', 'api-only')
_raw_role = (os.getenv('PIPELINE2_ROLE') or 'full').strip().lower()
if _raw_role not in PIPELINE2_ROLES:
    import logging as _logging
    _logging.getLogger('config').warning(
        "PIPELINE2_ROLE=%r is not one of %s — running as 'full' (the lease still "
        "refuses a second worker/scheduler)", _raw_role, PIPELINE2_ROLES)
    _raw_role = 'full'
PIPELINE2_ROLE = _raw_role

# Pipeline defaults
BATCH_SIZE = 500           # rows per PostgREST upsert
REQUEST_DELAY = 0.5        # seconds between Breeze API calls
MAX_RETRIES = 4            # retry count for transient failures
BREEZE_MAX_CANDLES = 1000  # Breeze limit per request
