"""
CSV Parser — reads NSE/BSE bhav copy CSVs into normalized dicts.
Handles column name variations across different NSE file formats.
"""

import csv
from datetime import date


def _safe_float(val) -> float | None:
    if val is None:
        return None
    try:
        import pandas as pd
        if pd.isna(val):
            return None
    except (ImportError, TypeError, ValueError):
        pass
    try:
        v = str(val).strip().replace(',', '')
        return round(float(v), 2) if v else None
    except (ValueError, TypeError):
        return None


def _safe_int(val) -> int | None:
    if val is None:
        return None
    try:
        import pandas as pd
        if pd.isna(val):
            return None
    except (ImportError, TypeError, ValueError):
        pass
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
    All CM-segment series are included; SymbolMatcher filters to known symbols.
    """
    records = []

    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for raw in reader:
            row = _normalize_row(raw, _NSE_BHAV_MAP)

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

            symbol = (row.get('symbol') or '').strip().upper()
            if not symbol:
                continue

            result[symbol] = {
                'delivery_qty': _safe_int(row.get('delivery_qty')),
                'delivery_pct': _safe_float(row.get('delivery_pct')),
            }

    return result


# ── BSE Bhav Copy Parser ──────────────────────────────────────────────────────

# BSE CSV column mappings (BSE uses different headers across formats)
_BSE_BHAV_MAP = {
    # Scrip code (BSE uses numeric codes)
    'SC_CODE': 'scrip_code', 'SCRIP_CD': 'scrip_code', 'ScripCode': 'scrip_code',
    'FinInstrmId': 'scrip_code',  # UDiFF format
    # Name
    'SC_NAME': 'name', 'SCRIP_NAME': 'name', 'ScripName': 'name',
    # Group
    'SC_GROUP': 'group', 'SCRIP_GRP': 'group', 'ScripGroup': 'group', 'SctySrs': 'group',
    # Type
    'SC_TYPE': 'type',
    # OHLC
    'OPEN': 'open', 'OpnPric': 'open',
    'HIGH': 'high', 'HghPric': 'high',
    'LOW': 'low', 'LwPric': 'low',
    'CLOSE': 'close', 'ClsPric': 'close',
    'LAST': 'last', 'LastPric': 'last',
    'PREVCLOSE': 'prev_close', 'PrvsClsgPric': 'prev_close', 'PREV_CLOSE': 'prev_close',
    # Volume / Value
    'NO_OF_SHRS': 'volume', 'TtlTradgVol': 'volume', 'VOLUME': 'volume', 'NO_TRADES': 'total_trades',
    'NET_TURNOV': 'value', 'TtlTrfVal': 'value', 'TURNOVER': 'value',
    # ISIN
    'ISIN_CODE': 'isin', 'ISIN': 'isin',
    # Symbol (UDiFF format)
    'TckrSymb': 'symbol', 'TCKRSYMB': 'symbol',
}

# BSE groups to include (A=large cap, B=mid/small, T=trade-to-trade, X=illiquid)
_BSE_VALID_GROUPS = {'A', 'B', 'T', 'X', 'XC', 'XD', 'XT', 'Z', 'P', 'IF'}


def parse_bse_bhav(csv_path: str, trade_date: date) -> list[dict]:
    """
    Parse BSE UDiFF bhav copy (tab-separated CSV).
    BSE master table stores symbols as scrip codes (e.g., '500002') in
    km_equity_symbols WHERE exchange='BSE'.
    This parser outputs scrip code as 'symbol' for matching.
    """
    records = []

    # Detect delimiter — BSE UDiFF uses tab, older formats use comma
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        first_line = f.readline()
    delimiter = '\t' if '\t' in first_line else ','

    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f, delimiter=delimiter)
        for raw in reader:
            row = _normalize_row(raw, _BSE_BHAV_MAP)

            # Only process equities (STK = stock)
            fin_type = (raw.get('FinInstrmTp') or '').strip().upper()
            if fin_type and fin_type != 'STK':
                continue

            # Only CM segment
            segment = (raw.get('Sgmt') or '').strip().upper()
            if segment and segment != 'CM':
                continue

            # Filter by group/series
            group = (row.get('group') or '').strip().upper()
            if group and group not in _BSE_VALID_GROUPS:
                continue

            # BSE scrip code is the primary key in km_equity_symbols (exchange='BSE')
            scrip_code = (row.get('scrip_code') or '').strip()
            if not scrip_code:
                continue

            o = _safe_float(row.get('open'))
            h = _safe_float(row.get('high'))
            l = _safe_float(row.get('low'))
            c = _safe_float(row.get('close'))

            if not all([o, h, l, c]):
                continue

            volume = _safe_int(row.get('volume'))
            value_raw = _safe_float(row.get('value'))
            # BSE UDiFF value is in rupees, convert to crores
            value_cr = round(value_raw / 1e7, 4) if value_raw else None

            prev = _safe_float(row.get('prev_close'))

            records.append({
                'symbol': scrip_code,  # Match against km_equity_symbols.symbol WHERE exchange='BSE'
                'trade_date': str(trade_date),
                'open': o,
                'high': h,
                'low': l,
                'close': c,
                'prev_close': prev,
                'chng': round(c - (prev or c), 2) if prev else None,
                'pct_chng': round(((c - prev) / prev) * 100, 2) if prev else None,
                'volume': volume,
                'value_cr': value_cr,
                'isin': (row.get('isin') or '').strip() or None,
            })

    return records
