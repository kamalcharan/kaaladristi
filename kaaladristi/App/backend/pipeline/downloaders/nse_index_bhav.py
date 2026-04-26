"""
NSE Index Bhav Copy Downloader
===============================
Downloads daily index data (all indexes OHLCV + P/E + P/B + Div Yield)
and TRI (Total Return Index) data from NSE archives.

No Breeze dependency — directly from NSE website.
One file = all ~120 indexes for that day.
"""

import csv
import time
from datetime import date

from pipeline.config import (
    NSE_INDEX_URL, NSE_TRI_URL_PATTERNS, DOWNLOAD_MAX_RETRIES,
)
from pipeline.utils.nse_session import NseSession
from pipeline.utils.file_manager import save_csv, file_exists


def _index_url(d: date) -> str:
    return NSE_INDEX_URL.format(date=d.strftime('%d%m%Y'))


def _tri_urls(d: date) -> list[str]:
    return [p.format(date=d.strftime('%d%m%Y')) for p in NSE_TRI_URL_PATTERNS]


def download_nse_index_bhav(d: date, session: NseSession = None) -> str | None:
    """
    Download NSE index bhav copy CSV for a given date.
    Returns path to saved CSV, or None if failed.
    """
    existing = file_exists(d, prefix='nse_index', ext='.csv')
    if existing:
        print(f'  [nse_index] Already exists: {existing}')
        return existing

    if session is None:
        session = NseSession()

    url = _index_url(d)
    print(f'  [nse_index] Downloading: {url}')

    for attempt in range(DOWNLOAD_MAX_RETRIES):
        try:
            csv_bytes = session.download(url)

            if len(csv_bytes) < 500:
                content = csv_bytes[:200].decode('utf-8', errors='replace')
                if '<html' in content.lower() or 'no data' in content.lower():
                    print(f'  [nse_index] No data for {d}')
                    return None
                raise ValueError(f'Response too small ({len(csv_bytes)} bytes)')

            csv_path = save_csv(csv_bytes, d, prefix='nse_index')
            print(f'  [nse_index] Saved: {csv_path} ({len(csv_bytes):,} bytes)')
            return csv_path

        except Exception as e:
            if attempt < DOWNLOAD_MAX_RETRIES - 1:
                wait = (attempt + 1) * 30
                print(f'  [nse_index] Attempt {attempt + 1} failed: {e}, retrying in {wait}s')
                time.sleep(wait)
            else:
                print(f'  [nse_index] All attempts failed: {e}')
                return None


def download_nse_tri(d: date, session: NseSession = None) -> str | None:
    """
    Download NSE TRI (Total Return Index) CSV for a given date.
    Tries multiple URL patterns since NSE may use different naming.
    Returns path to saved CSV, or None if failed.
    """
    existing = file_exists(d, prefix='nse_tri', ext='.csv')
    if existing:
        print(f'  [nse_tri] Already exists: {existing}')
        return existing

    if session is None:
        session = NseSession()

    urls = _tri_urls(d)
    for url in urls:
        print(f'  [nse_tri] Trying: {url}')
        try:
            csv_bytes = session.download(url)

            if len(csv_bytes) < 300:
                continue  # Try next URL pattern

            csv_path = save_csv(csv_bytes, d, prefix='nse_tri')
            print(f'  [nse_tri] Saved: {csv_path} ({len(csv_bytes):,} bytes)')
            return csv_path

        except Exception:
            continue

    print(f'  [nse_tri] No TRI data available for {d}')
    return None


# ── Parser ────────────────────────────────────────────────────────────────────

def _safe_float(val) -> float | None:
    if val is None:
        return None
    try:
        v = str(val).strip().replace(',', '')
        if not v or v == '-':  # NSE uses bare '-' as null marker
            return None
        return round(float(v), 2)
    except (ValueError, TypeError):
        return None


def _safe_int(val) -> int | None:
    if val is None:
        return None
    try:
        v = str(val).strip().replace(',', '')
        if not v or v == '-':  # NSE uses bare '-' as null marker
            return None
        return int(float(v))
    except (ValueError, TypeError):
        return None


# Column name mapping (NSE index CSV headers)
_INDEX_COL_MAP = {
    'Index Name': 'name',
    'Index Date': 'trade_date',
    'Open Index Value': 'open',
    'High Index Value': 'high',
    'Low Index Value': 'low',
    'Closing Index Value': 'close',
    'Points Change': 'chng',
    'Change(%)': 'pct_chng',
    'Volume': 'volume',
    'Turnover (Rs. Cr.)': 'value_cr',
    'P/E': 'pe',
    'P/B': 'pb',
    'Div Yield': 'div_yield',
}


def parse_nse_index_bhav(csv_path: str, trade_date: date) -> list[dict]:
    """
    Parse NSE index bhav copy CSV.
    Returns list of dicts with: name, open, high, low, close, chng, pct_chng,
    volume, value_cr, prev_close (computed), trade_date.
    """
    records = []

    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for raw in reader:
            # Normalize column names
            row = {}
            for k, v in raw.items():
                clean_k = k.strip()
                if clean_k in _INDEX_COL_MAP:
                    row[_INDEX_COL_MAP[clean_k]] = v

            name = (row.get('name') or '').strip()
            if not name:
                continue

            # Skip bond/G-sec indices, dividend points, futures indices
            if any(skip in name.lower() for skip in ['g-sec', 'bond', 'dividend points',
                                                       '1d rate', 'arbitrage']):
                continue

            o = _safe_float(row.get('open'))
            h = _safe_float(row.get('high'))
            l = _safe_float(row.get('low'))
            c = _safe_float(row.get('close'))

            if not c:  # Close is mandatory
                continue

            chng = _safe_float(row.get('chng'))
            prev_close = round(c - chng, 2) if c and chng else None

            records.append({
                'name': name,
                'trade_date': str(trade_date),
                'open': o,
                'high': h,
                'low': l,
                'close': c,
                'prev_close': prev_close,
                'chng': chng,
                'pct_chng': _safe_float(row.get('pct_chng')),
                'volume': _safe_int(row.get('volume')),
                'value_cr': _safe_float(row.get('value_cr')),
            })

    return records


def parse_nse_tri(csv_path: str, trade_date: date) -> list[dict]:
    """Parse NSE TRI CSV — same format as index bhav."""
    return parse_nse_index_bhav(csv_path, trade_date)


# ── Symbol Matcher (Index) ────────────────────────────────────────────────────

class IndexMatcher:
    """Maps index names from CSV to km_index_symbols IDs."""

    def __init__(self, db):
        self.db = db
        self._map: dict[str, int] = {}
        self._tri_map: dict[str, int] = {}  # TRI variant IDs
        self._loaded = False

    def _load(self):
        rows = self.db.select('km_index_symbols', 'id,name,is_tri')
        for r in rows:
            key = r['name'].strip().upper()
            if r.get('is_tri'):
                self._tri_map[key] = r['id']
            else:
                self._map[key] = r['id']
        self._loaded = True
        print(f'  [index_matcher] Loaded {len(self._map)} indexes + {len(self._tri_map)} TRI')

    def get_id(self, name: str, is_tri: bool = False) -> int | None:
        if not self._loaded:
            self._load()
        key = name.strip().upper()
        target = self._tri_map if is_tri else self._map
        return target.get(key)

    def match_records(self, records: list[dict], is_tri: bool = False) -> tuple[list[dict], list[str]]:
        if not self._loaded:
            self._load()

        matched = []
        unmatched = set()

        for rec in records:
            name = rec.get('name', '').strip()
            idx_id = self.get_id(name, is_tri)

            if idx_id is None:
                unmatched.add(name)
                continue

            row = {
                'index_id': idx_id,
                'trade_date': rec['trade_date'],
                'open': rec.get('open'),
                'high': rec.get('high'),
                'low': rec.get('low'),
                'close': rec.get('close'),
                'prev_close': rec.get('prev_close'),
                'chng': rec.get('chng'),
                'pct_chng': rec.get('pct_chng'),
                'volume': rec.get('volume'),
                'value_cr': rec.get('value_cr'),
            }
            matched.append(row)

        return matched, sorted(unmatched)

    @property
    def total(self) -> int:
        if not self._loaded:
            self._load()
        return len(self._map)


# ── Inserter ──────────────────────────────────────────────────────────────────

def upsert_index_eod(db, records: list[dict]) -> int:
    """Batch upsert index EOD records into km_index_eod."""
    if not records:
        return 0

    # Sanitize
    import math
    clean = []
    for rec in records:
        row = {}
        for k, v in rec.items():
            if v is None:
                row[k] = None
            elif isinstance(v, float) and math.isnan(v):
                row[k] = None
            else:
                try:
                    import pandas as pd
                    if pd.isna(v):
                        row[k] = None
                        continue
                except (ImportError, TypeError, ValueError):
                    pass
                row[k] = v
        if row.get('index_id') and row.get('trade_date'):
            clean.append(row)

    total = 0
    batch_size = 500
    for i in range(0, len(clean), batch_size):
        batch = clean[i:i + batch_size]
        count = db.upsert('km_index_eod', batch, 'index_id,trade_date')
        total += count

    return total
