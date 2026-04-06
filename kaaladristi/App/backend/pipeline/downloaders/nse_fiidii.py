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

The raw JSON is saved to data/bhav/YYYY/ as an audit trail.
"""

import json
import math
from datetime import date

from pipeline.config import NSE_FIIDII_URL, DOWNLOAD_MAX_RETRIES
from pipeline.utils.nse_session import NseSession
from pipeline.utils.file_manager import file_exists, save_file

import time


# ── Normalise category names from NSE response ───────────────────────────────

_CATEGORY_MAP = {
    'FII/FPI*': 'FII',
    'FII/FPI': 'FII',
    'FPI': 'FII',
    'DII': 'DII',
}


def _normalise_category(raw: str) -> str | None:
    """Map NSE category strings to canonical 'FII' or 'DII'."""
    raw = raw.strip()
    return _CATEGORY_MAP.get(raw) or _CATEGORY_MAP.get(raw.upper())


def _parse_number(val) -> float | None:
    """Parse NSE value strings ('12,345.67' or '-1234.56') to float."""
    if val is None:
        return None
    try:
        cleaned = str(val).replace(',', '').strip()
        if cleaned in ('', '-', 'N/A', 'NA', '--'):
            return None
        result = float(cleaned)
        if math.isnan(result) or math.isinf(result):
            return None
        return result
    except (ValueError, TypeError):
        return None


# ── Downloader ────────────────────────────────────────────────────────────────

def download_nse_fiidii(d: date, session: NseSession = None) -> list[dict] | None:
    """
    Download FII/DII activity from NSE API for the given date.

    NSE returns the last ~10 trading days in one JSON response.
    We filter the response to return only records matching the requested date.

    Returns list of dicts [{trade_date, category, buy_value, sell_value, net_value}]
    or None if data not available (holiday, weekend, not yet published).
    """
    # Check if we already have raw JSON saved for this date
    existing = file_exists(d, prefix='nse_fiidii', ext='.json')
    if existing:
        print(f'  [fii_dii] Already exists: {existing}')
        try:
            with open(existing, 'r') as f:
                raw_data = json.load(f)
            return _parse_response(raw_data, d)
        except Exception as e:
            print(f'  [fii_dii] Re-downloading (parse error on cached file: {e})')

    if session is None:
        session = NseSession()

    print(f'  [fii_dii] Downloading: {NSE_FIIDII_URL}')

    for attempt in range(DOWNLOAD_MAX_RETRIES):
        try:
            resp = session.get(NSE_FIIDII_URL)
            raw_data = resp.json()

            if not raw_data or not isinstance(raw_data, list):
                print(f'  [fii_dii] Unexpected response format')
                return None

            # Save raw JSON as audit trail
            json_bytes = json.dumps(raw_data, indent=2).encode('utf-8')
            save_file(json_bytes, f'nse_fiidii_{d.strftime("%Y%m%d")}.json', d)
            print(f'  [fii_dii] Saved raw JSON ({len(raw_data)} records from NSE)')

            return _parse_response(raw_data, d)

        except Exception as e:
            if attempt < DOWNLOAD_MAX_RETRIES - 1:
                wait = (attempt + 1) * 60
                print(f'  [fii_dii] Attempt {attempt + 1} failed: {e}')
                print(f'  [fii_dii] Retrying in {wait}s...')
                time.sleep(wait)
            else:
                print(f'  [fii_dii] All {DOWNLOAD_MAX_RETRIES} attempts failed: {e}')
                return None


# ── Parser ────────────────────────────────────────────────────────────────────

def _parse_response(raw_data: list, target_date: date) -> list[dict] | None:
    """
    Parse NSE JSON response and extract records for target_date.

    NSE date format in response: '04-Apr-2026' or '2026-04-04'
    We try both formats.
    """
    from datetime import datetime

    records = []

    for item in raw_data:
        # Parse date from NSE response
        raw_date_str = item.get('date', '')
        parsed_date = None

        for fmt in ('%d-%b-%Y', '%Y-%m-%d', '%d/%m/%Y'):
            try:
                parsed_date = datetime.strptime(raw_date_str.strip(), fmt).date()
                break
            except (ValueError, AttributeError):
                continue

        if parsed_date is None:
            continue

        if parsed_date != target_date:
            continue

        category_raw = item.get('category', '')
        category = _normalise_category(category_raw)
        if not category:
            print(f'  [fii_dii] Unknown category: "{category_raw}" — skipping')
            continue

        buy_value = _parse_number(item.get('buyValue'))
        sell_value = _parse_number(item.get('sellValue'))
        net_value = _parse_number(item.get('netValue'))

        records.append({
            'trade_date': str(target_date),
            'category': category,
            'buy_value': buy_value,
            'sell_value': sell_value,
            'net_value': net_value,
        })

    if not records:
        print(f'  [fii_dii] No records found for {target_date} in NSE response')
        print(f'  [fii_dii]   (Data covers: {_date_range_in_response(raw_data)})')
        return None

    return records


def _date_range_in_response(raw_data: list) -> str:
    """Helper to show which dates NSE returned, for debug output."""
    dates = [item.get('date', '') for item in raw_data if item.get('date')]
    return ', '.join(sorted(set(dates))) if dates else 'unknown'


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

    clean = []
    for rec in records:
        row = {k: rec.get(k) for k in FII_DII_COLUMNS}
        if row.get('trade_date') and row.get('category'):
            clean.append(row)

    if not clean:
        return 0

    return db.upsert('km_fii_dii', clean, 'trade_date,category')
