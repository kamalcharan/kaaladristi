"""
Shared configuration — loads .env once, exposes all settings.
Checks both backend/.env and frontend/.env (backend takes priority).
"""

import os
from dotenv import load_dotenv

_script_dir = os.path.dirname(os.path.abspath(__file__))

# Load frontend .env first (Supabase keys live here)
_frontend_env = os.path.join(_script_dir, '..', '..', 'frontend', '.env')
load_dotenv(_frontend_env)

# Load backend .env second — overrides any overlapping keys (Breeze keys live here)
_backend_env = os.path.join(_script_dir, '..', '.env')
load_dotenv(_backend_env, override=True)

# Supabase
SUPABASE_URL = os.getenv('VITE_SUPABASE_URL', '').strip()
SUPABASE_SERVICE_KEY = os.getenv('VITE_SUPABASE_SERVICE_KEY', '').strip()
SUPABASE_ANON_KEY = os.getenv('VITE_SUPABASE_ANON_KEY', '').strip()

# ICICI Breeze
BREEZE_API_KEY = os.getenv('BREEZE_API_KEY', '').strip()
BREEZE_API_SECRET = os.getenv('BREEZE_API_SECRET', '').strip()
BREEZE_SESSION_TOKEN = os.getenv('BREEZE_SESSION_TOKEN', '').strip()

# Pipeline defaults
BATCH_SIZE = 500           # rows per Supabase upsert
REQUEST_DELAY = 0.5        # seconds between Breeze API calls
MAX_RETRIES = 4            # retry count for transient failures
BREEZE_MAX_CANDLES = 1000  # Breeze limit per request
