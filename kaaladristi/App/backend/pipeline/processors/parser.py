"""
CSV Parser — reads NSE/BSE bhav copy CSVs into normalized dicts.
Handles column name variations across different NSE file formats.
"""

import csv
from datetime import date

from pipeline.config import NSE_VALID_SERIES


def _safe_float(val) -> float | None:
    if val is None:
        return None
    try:
        v = str(val).strip().replace(',', '')
        return round(float(v), 2) if v else None
    except (ValueError, TypeError):
        return None


def _safe_int(val) -> int | None:
    if val is None:
        return None
    try:
        v = str(val).strip().replace(',', '')
        return int(float(v)) if v else None
    except (ValueError, TypeError):
        return None


# Column name mappings — NSE changes header names across formats
_NSE_BHAV_MAP = {
    # Symbol
    'SYMBOL': 'symbol', 'TckrSymb': 'symbol', 'TCKRSYMB': 'symbol',
    # Series
    'SERIES': 'series', 'SctySrs': 'series', 'SCTYSRS': 'series',
    # OHLC
    'OPEN': 'open', 'OpnPric': 'open', 'OPNPRIC': 'open',
    'HIGH': 'high', 'HghPric': 'high', 'HGHPRIC': 'high',
    'LOW': 'low', 'LwPric': 'low', 'LWPRIC': 'low',
    'CLOSE': 'close', 'ClsPric': 'close', 'CLSPRIC': 'close',
    'LAST': 'last', 'LastPric': 'last', 'LASTPRIC': 'last',
    'PREVCLOSE': 'prev_close', 'PrvsClsgPric': 'prev_close', 'PRVSCLSGPRIC': 'prev_close',
    # Volume / Value
    'TOTTRDQTY': 'volume', 'TtlTradgVol': 'volume', 'TTLTRADGVOL': 'volume',
    'TOTTRDVAL': 'value', 'TtlTrfVal': 'value', 'TTLTRFVAL': 'value',
    'TOTALTRADES': 'total_trades', 'TtlNbOfTxsExctd': 'total_trades',
    # ISIN
    'ISIN': 'isin', 'ISIN_CODE': 'isin',
}

_NSE_DELIV_MAP = {
    'SYMBOL': 'symbol',
    'SERIES': 'series',
    'DELIV_QTY': 'delivery_qty', ' DELIV_QTY': 'delivery_qty',
    'DELIV_PER': 'delivery_pct', ' DELIV_PER': 'delivery_pct',
    '%DELTO': 'delivery_pct',
}


def _normalize_row(raw_row: dict, col_map: dict) -> dict:
    """Map raw CSV column names to normalized names."""
    out = {}
    for raw_key, value in raw_row.items():
        clean_key = raw_key.strip()
        if clean_key in col_map:
            out[col_map[clean_key]] = value
    return out


def parse_nse_bhav(csv_path: str, trade_date: date) -> list[dict]:
    """
    Parse NSE CM bhav copy CSV.
    Returns list of normalized dicts with: symbol, open, high, low, close,
    prev_close, volume, value_cr, trade_date.
    Filters to EQ series only.
    """
    records = []

    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for raw in reader:
            row = _normalize_row(raw, _NSE_BHAV_MAP)

            series = (row.get('series') or '').strip().upper()
            if series not in NSE_VALID_SERIES:
                continue

            symbol = (row.get('symbol') or '').strip().upper()
            if not symbol:
                continue

            o = _safe_float(row.get('open'))
            h = _safe_float(row.get('high'))
            l = _safe_float(row.get('low'))
            c = _safe_float(row.get('close'))

            if not all([o, h, l, c]):
                continue

            volume = _safe_int(row.get('volume'))
            value_raw = _safe_float(row.get('value'))
            # NSE value is in lakhs, convert to crores
            value_cr = round(value_raw / 100, 4) if value_raw else None

            records.append({
                'symbol': symbol,
                'trade_date': str(trade_date),
                'open': o,
                'high': h,
                'low': l,
                'close': c,
                'prev_close': _safe_float(row.get('prev_close')),
                'chng': round(c - (_safe_float(row.get('prev_close')) or c), 2),
                'pct_chng': round(
                    ((c - (_safe_float(row.get('prev_close')) or c)) /
                     (_safe_float(row.get('prev_close')) or c)) * 100, 2
                ) if _safe_float(row.get('prev_close')) else None,
                'volume': volume,
                'value_cr': value_cr,
                'isin': (row.get('isin') or '').strip() or None,
            })

    return records


def parse_nse_delivery(csv_path: str) -> dict[str, dict]:
    """
    Parse NSE delivery data CSV.
    Returns dict keyed by symbol: {symbol: {delivery_qty, delivery_pct}}.
    """
    result = {}

    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for raw in reader:
            row = _normalize_row(raw, _NSE_DELIV_MAP)

            series = (row.get('series') or '').strip().upper()
            if series not in NSE_VALID_SERIES:
                continue

            symbol = (row.get('symbol') or '').strip().upper()
            if not symbol:
                continue

            result[symbol] = {
                'delivery_qty': _safe_int(row.get('delivery_qty')),
                'delivery_pct': _safe_float(row.get('delivery_pct')),
            }

    return result
