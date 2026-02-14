"""
Shared Supabase client for engine scripts.

Provides get_supabase() and helper query functions that map
SQLite-style queries to the Supabase REST API.

Table name mapping (SQLite → Supabase):
    market_daily           → km_index_eod (via km_index_master join)
    planetary_positions    → km_planetary_positions
    planetary_aspects      → km_planetary_aspects
    astro_events           → km_astro_events
    moon_intraday          → km_moon_intraday
    daily_panchang         → km_daily_panchang
    risk_scores            → km_risk_scores
    factor_correlation_stats → km_factor_correlation_stats
    rules                  → km_rules
    rule_signals           → km_rule_signals
    candidate_rules        → km_candidate_rules
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Load .env (same search logic as load_to_supabase.py)
_script_dir = os.path.dirname(os.path.abspath(__file__))
for _env in [
    os.path.join(_script_dir, '.env'),
    os.path.join(_script_dir, '..', '.env'),
    os.path.join(_script_dir, '..', '..', 'frontend', '.env'),
]:
    if os.path.exists(_env):
        load_dotenv(_env)
        break

_SUPABASE_URL = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
_SUPABASE_KEY = (os.getenv('SUPABASE_KEY')
                 or os.getenv('VITE_SUPABASE_SERVICE_KEY')
                 or os.getenv('VITE_SUPABASE_ANON_KEY'))

_client: Client = None


def get_supabase() -> Client:
    """Get (or create) the shared Supabase client."""
    global _client
    if _client is None:
        if not _SUPABASE_URL or not _SUPABASE_KEY:
            raise RuntimeError(
                "SUPABASE_URL / SUPABASE_KEY not found. "
                "Set env vars or create .env in engine/ or frontend/."
            )
        _client = create_client(_SUPABASE_URL, _SUPABASE_KEY)
    return _client


# =========================================================================
# INDEX RESOLUTION CACHE
# =========================================================================

_index_id_cache: dict = {}

# Short symbols used by engine scripts → full names in km_index_symbols
_SYMBOL_TO_NAME = {
    'NIFTY': 'NIFTY 50',
    'BANKNIFTY': 'NIFTY BANK',
    'NIFTYIT': 'NIFTY IT',
    'NIFTYFMCG': 'NIFTY FMCG',
    'NIFTYPHARMA': 'NIFTY PHARMA',
    'NIFTYMETAL': 'NIFTY METAL',
    'NIFTYREALTY': 'NIFTY REALTY',
    'NIFTYAUTO': 'NIFTY AUTO',
    'NIFTYENERGY': 'NIFTY ENERGY',
    'NIFTYPSU': 'NIFTY PSU BANK',
    'NIFTYINFRA': 'NIFTY INFRASTRUCTURE',
    'NIFTYMEDIA': 'NIFTY MEDIA',
    'NIFTYFINSERV': 'NIFTY FINANCIAL SERVICES',
}


def resolve_index_id(symbol: str) -> int:
    """
    Resolve index symbol (e.g. 'NIFTY') to km_index_symbols.id.

    km_index_eod.index_id references km_index_symbols(id), which uses
    full names like 'NIFTY 50'. This maps short engine symbols to those names.
    """
    if symbol not in _index_id_cache:
        sb = get_supabase()
        full_name = _SYMBOL_TO_NAME.get(symbol, symbol)

        # Try km_index_symbols (the table that km_index_eod references)
        row = (sb.table('km_index_symbols')
               .select('id')
               .eq('name', full_name)
               .limit(1)
               .execute())
        if row.data:
            _index_id_cache[symbol] = row.data[0]['id']
        else:
            # Fallback: try matching the symbol directly as a name
            row2 = (sb.table('km_index_symbols')
                    .select('id')
                    .eq('name', symbol)
                    .limit(1)
                    .execute())
            if row2.data:
                _index_id_cache[symbol] = row2.data[0]['id']
            else:
                raise ValueError(
                    f"Index '{symbol}' (name='{full_name}') not found in km_index_symbols. "
                    f"Check that km_index_symbols has this index."
                )
    return _index_id_cache[symbol]


# =========================================================================
# MARKET DATA HELPERS
# =========================================================================

def get_market_returns(symbol: str, start_date: str, end_date: str):
    """
    Fetch daily returns for an index from km_index_eod.

    Maps: market_daily(symbol, date, daily_return, daily_range_pct)
      →   km_index_eod(index_id, trade_date, pct_chng, high, low, close)

    Returns list of dicts with keys: date, daily_return, daily_range_pct
    """
    sb = get_supabase()
    idx = resolve_index_id(symbol)
    print(f"  [db] Resolved '{symbol}' → index_id={idx}")

    # Fetch in pages (Supabase default limit is 1000)
    all_rows = []
    page_size = 1000
    offset = 0

    while True:
        resp = (sb.table('km_index_eod')
                .select('trade_date, pct_chng, prev_close, high, low, close')
                .eq('index_id', idx)
                .gte('trade_date', start_date)
                .lte('trade_date', end_date)
                .order('trade_date')
                .range(offset, offset + page_size - 1)
                .execute())
        if not resp.data:
            break
        all_rows.extend(resp.data)
        if len(resp.data) < page_size:
            break
        offset += page_size

    print(f"  [db] km_index_eod: fetched {len(all_rows)} rows for index_id={idx}, "
          f"{start_date} to {end_date}")

    # Compute daily returns - use pct_chng if available, otherwise compute
    # from consecutive close prices (yfinance data only has OHLC, no pct_chng)
    results = []
    prev_close_val = None
    for r in all_rows:
        close = float(r['close']) if r['close'] is not None else None

        # Try pct_chng first
        if r['pct_chng'] is not None:
            daily_return = float(r['pct_chng'])
        # Try prev_close column (NSE/Breeze data may have it)
        elif r.get('prev_close') is not None and float(r['prev_close']) > 0 and close is not None:
            daily_return = round((close - float(r['prev_close'])) / float(r['prev_close']) * 100, 4)
        # Compute from consecutive close prices (yfinance data)
        elif prev_close_val is not None and prev_close_val > 0 and close is not None:
            daily_return = round((close - prev_close_val) / prev_close_val * 100, 4)
        else:
            daily_return = None

        prev_close_val = close

        # Compute range % from high/low/close
        if r['high'] and r['low'] and close and close > 0:
            daily_range_pct = (float(r['high']) - float(r['low'])) / close * 100
        else:
            daily_range_pct = None
        results.append({
            'date': r['trade_date'],
            'daily_return': daily_return,
            'daily_range_pct': round(daily_range_pct, 4) if daily_range_pct else None,
        })

    # Count how many rows have computed returns
    with_returns = sum(1 for r in results if r['daily_return'] is not None)
    print(f"  [db] {with_returns}/{len(results)} rows have daily_return values")

    return results


def get_trading_dates(symbol: str, start_date: str, end_date: str):
    """Get sorted list of trading dates for a symbol."""
    sb = get_supabase()
    idx = resolve_index_id(symbol)

    all_dates = []
    page_size = 1000
    offset = 0

    while True:
        resp = (sb.table('km_index_eod')
                .select('trade_date')
                .eq('index_id', idx)
                .gte('trade_date', start_date)
                .lte('trade_date', end_date)
                .order('trade_date')
                .range(offset, offset + page_size - 1)
                .execute())
        if not resp.data:
            break
        all_dates.extend(r['trade_date'] for r in resp.data)
        if len(resp.data) < page_size:
            break
        offset += page_size

    return all_dates


def get_return_for_date(symbol: str, date_str: str):
    """Get single day return for a symbol.

    Falls back to computing from close/prev_close or consecutive closes
    when pct_chng is not available (yfinance data).
    """
    sb = get_supabase()
    idx = resolve_index_id(symbol)
    resp = (sb.table('km_index_eod')
            .select('pct_chng, prev_close, close')
            .eq('index_id', idx)
            .eq('trade_date', date_str)
            .limit(1)
            .execute())
    if not resp.data:
        return None

    row = resp.data[0]
    # Try pct_chng first
    if row['pct_chng'] is not None:
        return float(row['pct_chng'])
    # Try computing from prev_close
    if (row.get('prev_close') is not None and row['close'] is not None
            and float(row['prev_close']) > 0):
        return round((float(row['close']) - float(row['prev_close']))
                     / float(row['prev_close']) * 100, 4)
    return None


# =========================================================================
# EPHEMERIS HELPERS
# =========================================================================

def get_positions_for_date(date_str: str):
    """Get all planetary positions for a date."""
    sb = get_supabase()
    resp = (sb.table('km_planetary_positions')
            .select('planet, longitude, speed, retrograde, sign, sign_name, '
                    'nakshatra, nakshatra_name, nakshatra_pada, combust')
            .eq('date', date_str)
            .execute())
    return resp.data or []


def get_retrograde_dates(planet: str, start_date: str, end_date: str):
    """Get set of dates when planet is retrograde."""
    sb = get_supabase()
    all_dates = set()
    page_size = 1000
    offset = 0

    while True:
        resp = (sb.table('km_planetary_positions')
                .select('date')
                .eq('planet', planet)
                .eq('retrograde', True)
                .gte('date', start_date)
                .lte('date', end_date)
                .range(offset, offset + page_size - 1)
                .execute())
        if not resp.data:
            break
        all_dates.update(r['date'] for r in resp.data)
        if len(resp.data) < page_size:
            break
        offset += page_size

    return all_dates


def get_aspects_for_date(date_str: str):
    """Get all aspects active on a date."""
    sb = get_supabase()
    resp = (sb.table('km_planetary_aspects')
            .select('planet_1, planet_2, aspect_type, angle, orb, exact')
            .eq('date', date_str)
            .execute())
    return resp.data or []


def get_aspect_dates(planet_1: str, planet_2: str, aspect_types: list,
                     start_date: str, end_date: str):
    """Get set of dates when two planets are in specific aspects."""
    sb = get_supabase()
    all_dates = set()
    page_size = 1000

    # Query both orderings (p1,p2) and (p2,p1)
    for p1, p2 in [(planet_1, planet_2), (planet_2, planet_1)]:
        offset = 0
        while True:
            resp = (sb.table('km_planetary_aspects')
                    .select('date')
                    .eq('planet_1', p1)
                    .eq('planet_2', p2)
                    .in_('aspect_type', aspect_types)
                    .gte('date', start_date)
                    .lte('date', end_date)
                    .range(offset, offset + page_size - 1)
                    .execute())
            if not resp.data:
                break
            all_dates.update(r['date'] for r in resp.data)
            if len(resp.data) < page_size:
                break
            offset += page_size

    return all_dates


def get_moon_nakshatra_dates(nakshatras: list, start_date: str, end_date: str):
    """Get dates when Moon is in specified nakshatras at market open."""
    sb = get_supabase()
    all_dates = set()
    page_size = 1000
    offset = 0

    while True:
        resp = (sb.table('km_moon_intraday')
                .select('date')
                .in_('nakshatra_name', nakshatras)
                .eq('time_ist', '09:15')
                .gte('date', start_date)
                .lte('date', end_date)
                .range(offset, offset + page_size - 1)
                .execute())
        if not resp.data:
            break
        all_dates.update(r['date'] for r in resp.data)
        if len(resp.data) < page_size:
            break
        offset += page_size

    return all_dates


def get_gandanta_dates(start_date: str, end_date: str):
    """Get dates when Moon is in gandanta zone."""
    sb = get_supabase()
    all_dates = set()
    page_size = 1000
    offset = 0

    while True:
        resp = (sb.table('km_moon_intraday')
                .select('date')
                .eq('gandanta', True)
                .gte('date', start_date)
                .lte('date', end_date)
                .range(offset, offset + page_size - 1)
                .execute())
        if not resp.data:
            break
        all_dates.update(r['date'] for r in resp.data)
        if len(resp.data) < page_size:
            break
        offset += page_size

    return all_dates


def get_moon_intraday_for_date(date_str: str, time_ist: str = '09:15'):
    """Get Moon intraday data for a specific date and time."""
    sb = get_supabase()
    resp = (sb.table('km_moon_intraday')
            .select('gandanta, nakshatra_name')
            .eq('date', date_str)
            .eq('time_ist', time_ist)
            .limit(1)
            .execute())
    return resp.data[0] if resp.data else None


def get_nakshatra_change_dates(start_date: str, end_date: str):
    """Get dates when Moon changes nakshatra."""
    sb = get_supabase()
    all_dates = set()
    page_size = 1000
    offset = 0

    while True:
        resp = (sb.table('km_astro_events')
                .select('event_date')
                .eq('event_type', 'nakshatra_change')
                .eq('planet', 'Moon')
                .gte('event_date', start_date)
                .lte('event_date', end_date)
                .range(offset, offset + page_size - 1)
                .execute())
        if not resp.data:
            break
        all_dates.update(r['event_date'] for r in resp.data)
        if len(resp.data) < page_size:
            break
        offset += page_size

    return all_dates


# =========================================================================
# PANCHANG HELPERS
# =========================================================================

def get_panchang_for_date(date_str: str):
    """Get full panchang record for a date."""
    sb = get_supabase()
    resp = (sb.table('km_daily_panchang')
            .select('*')
            .eq('date', date_str)
            .limit(1)
            .execute())
    return resp.data[0] if resp.data else None


def get_panchang_range(start_date: str, end_date: str, columns: str = '*'):
    """Get panchang records for a date range."""
    sb = get_supabase()
    all_rows = []
    page_size = 1000
    offset = 0

    while True:
        resp = (sb.table('km_daily_panchang')
                .select(columns)
                .gte('date', start_date)
                .lte('date', end_date)
                .order('date')
                .range(offset, offset + page_size - 1)
                .execute())
        if not resp.data:
            break
        all_rows.extend(resp.data)
        if len(resp.data) < page_size:
            break
        offset += page_size

    return all_rows


# =========================================================================
# RULE HELPERS
# =========================================================================

def get_active_rules():
    """Load all active rules from km_rules."""
    sb = get_supabase()
    resp = (sb.table('km_rules')
            .select('id, code, category, name, description, conditions, '
                    'signal, strength, source, historical_note')
            .eq('active', True)
            .execute())
    return resp.data or []


# =========================================================================
# UPSERT HELPERS (for engine output)
# =========================================================================

def upsert_risk_scores(scores: list):
    """Upsert risk scores to km_risk_scores (batch)."""
    sb = get_supabase()
    # Supabase upsert in batches of 1000
    for i in range(0, len(scores), 1000):
        batch = scores[i:i + 1000]
        sb.table('km_risk_scores').upsert(batch, on_conflict='date,symbol').execute()


def upsert_correlation_stats(stats: list):
    """Upsert correlation stats to km_factor_correlation_stats (batch)."""
    sb = get_supabase()
    for i in range(0, len(stats), 1000):
        batch = stats[i:i + 1000]
        sb.table('km_factor_correlation_stats').upsert(
            batch, on_conflict='factor_type,index_symbol'
        ).execute()


def upsert_rule_signals(signals: list):
    """Upsert rule signals to km_rule_signals."""
    sb = get_supabase()
    for i in range(0, len(signals), 1000):
        batch = signals[i:i + 1000]
        sb.table('km_rule_signals').upsert(batch, on_conflict='date,rule_id').execute()


def insert_candidate_rules(candidates: list):
    """Insert candidate rules to km_candidate_rules."""
    sb = get_supabase()
    for i in range(0, len(candidates), 1000):
        batch = candidates[i:i + 1000]
        sb.table('km_candidate_rules').insert(batch).execute()
