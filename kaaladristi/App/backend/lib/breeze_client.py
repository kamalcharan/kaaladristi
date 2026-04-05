"""
ICICI Breeze client wrapper — auto-TOTP session, historical data fetch with retry.

Session flow:
  1. Check km_api_sessions for valid stored token
  2. If expired/missing → generate TOTP from BREEZE_API_SECRET via pyotp
  3. Login via BreezeConnect → get session token
  4. Store token + expiry in km_api_sessions
  5. Reuse until expired (~24 hours)
"""

import sys
import time
import urllib.parse
from datetime import datetime, timedelta
from .config import (
    BREEZE_API_KEY, BREEZE_API_SECRET, BREEZE_SESSION_TOKEN,
    REQUEST_DELAY, MAX_RETRIES, BREEZE_MAX_CANDLES,
)


def iso_ts(dt: datetime) -> str:
    return dt.strftime('%Y-%m-%dT%H:%M:%S.000Z')


# ── Auto-TOTP + Session Management ───────────────────────────────────────────

def _generate_totp() -> str:
    """Generate TOTP from BREEZE_API_SECRET using pyotp."""
    try:
        import pyotp
    except ImportError:
        print('ERROR: pip install pyotp')
        sys.exit(1)

    if not BREEZE_API_SECRET:
        print('ERROR: BREEZE_API_SECRET must be set in .env for auto-TOTP')
        sys.exit(1)

    return pyotp.TOTP(BREEZE_API_SECRET).now()


def _get_stored_session(db) -> dict | None:
    """Read the current Breeze session from km_api_sessions."""
    try:
        rows = db.select('km_api_sessions', '*', filters={'provider': 'breeze'}, limit=1)
        if rows and len(rows) > 0:
            return rows[0]
    except Exception:
        pass
    return None


def _is_session_valid(session: dict) -> bool:
    """Check if stored session is still valid (not expired)."""
    if not session or session.get('status') != 'connected':
        return False
    expires = session.get('expires_at')
    if not expires:
        return False
    try:
        exp_str = str(expires).replace('Z', '').replace('+00:00', '')
        exp_dt = datetime.fromisoformat(exp_str)
        return datetime.utcnow() < (exp_dt - timedelta(minutes=30))
    except Exception:
        return False


def _save_session(db, token: str, status: str = 'connected', error: str = None):
    """Upsert session record in km_api_sessions."""
    now = datetime.utcnow().isoformat()
    expires = (datetime.utcnow() + timedelta(hours=23)).isoformat()
    hint = BREEZE_API_KEY[-6:] if BREEZE_API_KEY else None

    record = {
        'provider': 'breeze',
        'api_key_hint': hint,
        'session_token': token,
        'status': status,
        'last_error': error,
        'connected_at': now if status == 'connected' else None,
        'expires_at': expires if status == 'connected' else None,
    }
    try:
        db.upsert('km_api_sessions', [record], 'provider')
    except Exception as e:
        print(f'  [warn] Could not save session to DB: {e}')


def _mark_session_error(db, error: str):
    """Mark the current session as errored."""
    try:
        db.patch('km_api_sessions', {'provider': 'breeze'}, {
            'status': 'error',
            'last_error': error,
        })
    except Exception:
        pass


def _connect_breeze(token: str):
    """Create BreezeConnect client with given token. Returns client or raises."""
    from breeze_connect import BreezeConnect

    breeze = BreezeConnect(api_key=BREEZE_API_KEY)
    breeze.generate_session(api_secret=BREEZE_API_SECRET, session_token=token)
    return breeze


def init_breeze(session_token: str = None, db=None):
    """
    Initialize and return a BreezeConnect client.

    Session resolution order:
      1. Explicit session_token argument
      2. Stored token from km_api_sessions (if not expired)
      3. BREEZE_SESSION_TOKEN from .env
      4. Auto-generate TOTP for fresh login

    Args:
        session_token: Explicit token override
        db: Database client — if provided, sessions are persisted to km_api_sessions
    """
    try:
        from breeze_connect import BreezeConnect
    except ImportError:
        print('ERROR: pip install breeze-connect')
        sys.exit(1)

    if not BREEZE_API_KEY:
        print('ERROR: BREEZE_API_KEY must be set in .env')
        sys.exit(1)

    # ── 1. Explicit token ──
    if session_token:
        print('  [session] Using explicit session token')
        breeze = _connect_breeze(session_token)
        if db:
            _save_session(db, session_token)
        return breeze

    # ── 2. Stored session from DB ──
    if db:
        stored = _get_stored_session(db)
        if stored and _is_session_valid(stored):
            token = stored.get('session_token')
            if token:
                try:
                    print('  [session] Reusing stored session (still valid)')
                    breeze = _connect_breeze(token)
                    return breeze
                except Exception as e:
                    print(f'  [session] Stored session failed: {e}')
                    _mark_session_error(db, str(e))

    # ── 3. Env var token ──
    if BREEZE_SESSION_TOKEN:
        try:
            print('  [session] Using BREEZE_SESSION_TOKEN from .env')
            breeze = _connect_breeze(BREEZE_SESSION_TOKEN)
            if db:
                _save_session(db, BREEZE_SESSION_TOKEN)
            return breeze
        except Exception as e:
            print(f'  [session] Env token failed: {e}')

    # ── 4. Auto-TOTP ──
    if BREEZE_API_SECRET:
        print('  [session] Generating fresh TOTP...')
        totp = _generate_totp()
        print(f'  [session] TOTP: {totp[:2]}****')
        try:
            breeze = _connect_breeze(totp)
            print('  [session] Connected via auto-TOTP')
            if db:
                _save_session(db, totp)
            return breeze
        except Exception as e:
            err = str(e)
            print(f'  [session] TOTP login failed: {err}')
            if db:
                _mark_session_error(db, err)

    # ── All methods exhausted ──
    login_url = ('https://api.icicidirect.com/apiuser/login?api_key='
                 + urllib.parse.quote_plus(BREEZE_API_KEY))
    print('ERROR: Could not establish Breeze session.')
    print(f'  Manual login: {login_url}')
    print('  Then pass --session-token <TOKEN> or set BREEZE_SESSION_TOKEN in .env')
    sys.exit(1)


# ── Historical Data Fetch ─────────────────────────────────────────────────────

def fetch_historical(breeze, stock_code: str, exchange_code: str,
                     from_date: datetime, to_date: datetime,
                     interval: str = '1day') -> list:
    """
    Fetch OHLCV candles from Breeze with automatic chunking and retry.

    Args:
        interval: '1day', '15minute', '5minute', '30minute', '1minute'
        exchange_code: 'NSE', 'BSE', or 'MCX'

    Returns list of raw candle dicts from Breeze API.
    """
    # Determine chunk size based on interval
    if interval == '1day':
        chunk_days = BREEZE_MAX_CANDLES
    elif interval == '1minute':
        chunk_days = max(1, BREEZE_MAX_CANDLES // 375)
    elif interval == '5minute':
        chunk_days = max(1, BREEZE_MAX_CANDLES // 75)
    elif interval == '15minute':
        chunk_days = max(1, BREEZE_MAX_CANDLES // 26)
    elif interval == '30minute':
        chunk_days = max(1, BREEZE_MAX_CANDLES // 13)
    else:
        chunk_days = 30

    all_records = []
    cursor = from_date

    while cursor < to_date:
        chunk_end = min(cursor + timedelta(days=chunk_days - 1), to_date)

        for attempt in range(MAX_RETRIES):
            try:
                resp = breeze.get_historical_data_v2(
                    interval=interval,
                    from_date=iso_ts(cursor),
                    to_date=iso_ts(chunk_end),
                    stock_code=stock_code,
                    exchange_code=exchange_code,
                    product_type='cash',
                )

                if resp and resp.get('Success'):
                    all_records.extend(resp['Success'])
                    break
                elif resp and resp.get('Error'):
                    err = resp['Error']
                    if '429' in str(err) or 'rate' in str(err).lower():
                        wait = (attempt + 1) * 2
                        print(f' [rate limited, retry in {wait}s]', end='', flush=True)
                        time.sleep(wait)
                        continue
                    print(f' [Breeze error: {err}]', end='', flush=True)
                    break
                else:
                    break

            except Exception as e:
                if attempt < MAX_RETRIES - 1:
                    wait = (attempt + 1) * 2
                    print(f' [error: {e}, retry in {wait}s]', end='', flush=True)
                    time.sleep(wait)
                else:
                    print(f' [failed after {MAX_RETRIES} retries: {e}]', end='', flush=True)

        cursor = chunk_end + timedelta(days=1)
        time.sleep(REQUEST_DELAY)

    return all_records
