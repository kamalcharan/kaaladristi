"""
ICICI Breeze client wrapper — session init, historical data fetch with retry.
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


def init_breeze(session_token: str = None):
    """Initialize and return a BreezeConnect client."""
    try:
        from breeze_connect import BreezeConnect
    except ImportError:
        print('ERROR: pip install breeze-connect')
        sys.exit(1)

    if not BREEZE_API_KEY or not BREEZE_API_SECRET:
        print('ERROR: BREEZE_API_KEY and BREEZE_API_SECRET must be set in .env')
        sys.exit(1)

    token = session_token or BREEZE_SESSION_TOKEN
    if not token:
        login_url = ('https://api.icicidirect.com/apiuser/login?api_key='
                     + urllib.parse.quote_plus(BREEZE_API_KEY))
        print('ERROR: Session token required.')
        print(f'  Visit: {login_url}')
        print('  Then pass --session-token <TOKEN> or set BREEZE_SESSION_TOKEN in .env')
        sys.exit(1)

    print('Connecting to ICICI Breeze...')
    breeze = BreezeConnect(api_key=BREEZE_API_KEY)
    breeze.generate_session(api_secret=BREEZE_API_SECRET, session_token=token)
    print('  Connected successfully')
    return breeze


def fetch_historical(breeze, stock_code: str, exchange_code: str,
                     from_date: datetime, to_date: datetime,
                     interval: str = '1day') -> list:
    """
    Fetch OHLCV candles from Breeze with automatic chunking and retry.

    Args:
        interval: '1day', '15minute', '5minute', '30minute', '1minute'
        exchange_code: 'NSE' or 'BSE'

    Returns list of raw candle dicts from Breeze API.
    """
    # Determine chunk size based on interval
    if interval == '1day':
        chunk_days = BREEZE_MAX_CANDLES  # ~1000 trading days per chunk
    elif interval == '15minute':
        candles_per_day = 26  # 9:15-3:30 = 6.25hrs = 25 candles + 1
        chunk_days = max(1, BREEZE_MAX_CANDLES // candles_per_day)
    elif interval == '5minute':
        candles_per_day = 75
        chunk_days = max(1, BREEZE_MAX_CANDLES // candles_per_day)
    elif interval == '30minute':
        candles_per_day = 13
        chunk_days = max(1, BREEZE_MAX_CANDLES // candles_per_day)
    else:
        chunk_days = 30  # safe default

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
                    # Non-retryable error
                    print(f' [Breeze error: {err}]', end='', flush=True)
                    break
                else:
                    # Empty response — no data for this range
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
