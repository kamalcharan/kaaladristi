"""
NSE FII/DII Activity Downloader
================================
Downloads daily FII (Foreign Institutional Investor) and DII
(Domestic Institutional Investor) cash market activity from NSE.

Source: NSE API — /api/fiidiiTradeReact
Returns ~10 most recent trading days per call.

Data fields (all in crores INR):
  buy_value  — gross purchases
  sell_value — gross sales
  net_value  — net flow (buy - sell), negative = net sellers

NOTE: No file caching — always downloads fresh because NSE publishes
FII/DII data after market close and we need the latest version.
Raw JSON is still saved as an audit trail.
"""

import json
import math
from datetime import date, datetime

from pipeline.config import NSE_FIIDII_URL, DOWNLOAD_MAX_RETRIES
from pipeline.utils.nse_session import NseSession
from pipeline.utils.file_manager import save_file

import time


# ── Normalise category names from NSE response ───────────────────────────────

_CATEGORY_MAP = {
    'FII/FPI*':     'FII',
    'FII/FPI':      'FII',
    'FPI':          'FII',
    'FII':          'FII',
    'DII':          'DII',
    'dii':          'DII',
}


def _normalise_category(raw: str) -> str | None:
    raw = (raw or '').strip()
    return _CATEGORY_MAP.get(raw) or _CATEGORY_MAP.get(raw.upper())


def _parse_number(val) -> float | None:
    """Parse NSE value strings ('12,345.67', '-1234.56', '12345') to float."""
    if val is None:
        return None
    try:
        cleaned = str(val).replace(',', '').strip()
        if cleaned in ('', '-', 'N/A', 'NA', '--'):
            return None
        result = float(cleaned)
        return None if (math.isnan(result) or math.isinf(result)) else result
    except (ValueError, TypeError):
        return None


def _get_field(item: dict, *candidates) -> any:
    """Return first matching field from a dict, trying multiple candidate keys."""
    for key in candidates:
        if key in item:
            return item[key]
    return None


# ── Downloader ────────────────────────────────────────────────────────────────

def download_nse_fiidii(d: date, session: NseSession = None) -> list[dict] | None:
    """
    Download FII/DII activity from NSE API and return records for date d.

    Always fetches fresh data (no cache) because NSE publishes FII/DII after
    market close — a cached response from earlier in the day would be stale.
    """
    if session is None:
        session = NseSession()

    print(f'  [fii_dii] Downloading: {NSE_FIIDII_URL}')

    for attempt in range(DOWNLOAD_MAX_RETRIES):
        try:
            resp = session.get(NSE_FIIDII_URL)
            raw_data = resp.json()

            if not raw_data:
                print(f'  [fii_dii] Empty response from NSE')
                return None

            # Handle both list and dict-wrapped responses
            if isinstance(raw_data, dict):
                # Some NSE endpoints wrap list in a key like {"data": [...]}
                for key in ('data', 'fiidiiData', 'result', 'Data'):
                    if key in raw_data and isinstance(raw_data[key], list):
                        raw_data = raw_data[key]
                        print(f'  [fii_dii] Unwrapped from dict key "{key}"')
                        break

            if not isinstance(raw_data, list):
                print(f'  [fii_dii] Unexpected format: {type(raw_data).__name__}')
                print(f'  [fii_dii] Preview: {str(raw_data)[:300]}')
                return None

            # Log first record's keys so we can see NSE's field names
            if raw_data:
                print(f'  [fii_dii] {len(raw_data)} records, keys={list(raw_data[0].keys())}')
                print(f'  [fii_dii] Dates in response: {_date_range_in_response(raw_data)}')

            # Save raw JSON as audit trail (always overwrites — fresh data)
            json_bytes = json.dumps(raw_data, indent=2).encode('utf-8')
            save_file(json_bytes, f'nse_fiidii_{d.strftime("%Y%m%d")}.json', d)

            records = _parse_response(raw_data, d)
            return records

        except Exception as e:
            if attempt < DOWNLOAD_MAX_RETRIES - 1:
                wait = (attempt + 1) * 30
                print(f'  [fii_dii] Attempt {attempt + 1} failed: {e}')
                print(f'  [fii_dii] Retrying in {wait}s...')
                time.sleep(wait)
            else:
                print(f'  [fii_dii] All {DOWNLOAD_MAX_RETRIES} attempts failed: {e}')
                return None


# ── Parser ────────────────────────────────────────────────────────────────────

# NSE has used several different field name conventions over time
_DATE_KEYS     = ('date', 'Date', 'DATE', 'tradeDate', 'trade_date')
_CATEGORY_KEYS = ('category', 'Category', 'CATEGORY', 'name', 'type')
_BUY_KEYS      = ('buyValue', 'BuyValue', 'BUY', 'buy', 'Buy', 'grossPurchase', 'purchases')
_SELL_KEYS     = ('sellValue', 'SellValue', 'SELL', 'sell', 'Sell', 'grossSales', 'sales')
_NET_KEYS      = ('netValue', 'NetValue', 'NET', 'net', 'Net', 'netPurchase', 'netSales')


def _parse_response(raw_data: list, target_date: date) -> list[dict] | None:
    records = []

    for item in raw_data:
        # ── Parse date ──
        raw_date_str = str(_get_field(item, *_DATE_KEYS) or '').strip()
        parsed_date = _parse_date(raw_date_str)
        if parsed_date is None:
            continue
        if parsed_date != target_date:
            continue

        # ── Parse category ──
        category_raw = str(_get_field(item, *_CATEGORY_KEYS) or '').strip()
        category = _normalise_category(category_raw)
        if not category:
            print(f'  [fii_dii] Unknown category: "{category_raw}" — skipping')
            continue

        # ── Parse values ──
        buy_value  = _parse_number(_get_field(item, *_BUY_KEYS))
        sell_value = _parse_number(_get_field(item, *_SELL_KEYS))
        net_value  = _parse_number(_get_field(item, *_NET_KEYS))

        records.append({
            'trade_date': str(target_date),
            'category':   category,
            'buy_value':  buy_value,
            'sell_value': sell_value,
            'net_value':  net_value,
        })

    if not records:
        print(f'  [fii_dii] No records matched {target_date}')
        print(f'  [fii_dii] Response covers: {_date_range_in_response(raw_data)}')
        return None

    print(f'  [fii_dii] Parsed {len(records)} records for {target_date}')
    return records


def _parse_date(raw: str) -> date | None:
    """Try multiple date formats NSE has used."""
    if not raw:
        return None
    for fmt in ('%d-%b-%Y', '%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y', '%b %d, %Y'):
        try:
            return datetime.strptime(raw.strip(), fmt).date()
        except ValueError:
            continue
    return None


def _date_range_in_response(raw_data: list) -> str:
    dates = set()
    for item in raw_data:
        d = _get_field(item, *_DATE_KEYS)
        if d:
            dates.add(str(d))
    return ', '.join(sorted(dates)) if dates else 'no dates found'


# ── Inserter ──────────────────────────────────────────────────────────────────

FII_DII_COLUMNS = ['trade_date', 'category', 'buy_value', 'sell_value', 'net_value']


def upsert_fii_dii(db, records: list[dict]) -> int:
    """
    Upsert FII/DII records into km_fii_dii.
    Conflict key: (trade_date, category).
    Returns total rows upserted.
    """
    if not records:
        return 0

    clean = [
        {k: rec.get(k) for k in FII_DII_COLUMNS}
        for rec in records
        if rec.get('trade_date') and rec.get('category')
    ]
    return db.upsert('km_fii_dii', clean, 'trade_date,category') if clean else 0
