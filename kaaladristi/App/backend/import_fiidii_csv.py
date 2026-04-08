"""
FII/DII Historical CSV Importer
================================
One-time backfill from NSE's downloadable FII/DII CSV.

How to get the CSV:
  1. Go to https://www.nseindia.com/market-data/fii-dii-activity
  2. Set date range (you can go back several years)
  3. Click "Download" / "Export CSV"
  4. Save the file (e.g. fii_dii_history.csv)

Usage:
  python import_fiidii_csv.py fii_dii_history.csv
  python import_fiidii_csv.py fii_dii_history.csv --dry-run
  python import_fiidii_csv.py fii_dii_history.csv --preview
"""

import os
import sys
import csv
import math
import argparse
from datetime import datetime, date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lib.db_client import get_db


# ── Category normalisation (same as downloader) ──────────────────────────────

_CATEGORY_MAP = {
    'FII/FPI*': 'FII', 'FII/FPI': 'FII', 'FPI': 'FII', 'FII': 'FII',
    'DII': 'DII',
}

def _norm_category(raw: str) -> str | None:
    return _CATEGORY_MAP.get(raw.strip()) or _CATEGORY_MAP.get(raw.strip().upper())


def _parse_number(val) -> float | None:
    if val is None:
        return None
    try:
        cleaned = str(val).replace(',', '').strip()
        if cleaned in ('', '-', 'N/A', 'NA', '--'):
            return None
        f = float(cleaned)
        return None if math.isnan(f) or math.isinf(f) else f
    except (ValueError, TypeError):
        return None


def _parse_date(raw: str) -> date | None:
    for fmt in ('%d-%b-%Y', '%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y', '%b %d, %Y',
                '%d %b %Y', '%B %d, %Y'):
        try:
            return datetime.strptime(raw.strip(), fmt).date()
        except ValueError:
            continue
    return None


# ── CSV reader — handles NSE's column name variations ───────────────────────

# NSE has used different column headers at different times
_DATE_COLS     = ('Date', 'date', 'Trade Date', 'TradeDate')
_CATEGORY_COLS = ('Category', 'category', 'Type')
_BUY_COLS      = ('Buy Value', 'buyValue', 'BUY', 'Gross Purchase', 'Purchase (Cr.)')
_SELL_COLS     = ('Sell Value', 'sellValue', 'SELL', 'Gross Sales', 'Sales (Cr.)')
_NET_COLS      = ('Net Value', 'netValue', 'NET', 'Net Investment', 'Net (Cr.)')


def _find_col(headers: list[str], *candidates) -> str | None:
    """Find first matching column header (case-insensitive)."""
    h_lower = {h.lower(): h for h in headers}
    for cand in candidates:
        if cand in headers:
            return cand
        if cand.lower() in h_lower:
            return h_lower[cand.lower()]
    return None


def _sniff_columns(headers: list[str]) -> dict:
    """Map logical fields to actual column names in this CSV."""
    mapping = {}
    for field, candidates in [
        ('date',       _DATE_COLS),
        ('category',   _CATEGORY_COLS),
        ('buy_value',  _BUY_COLS),
        ('sell_value', _SELL_COLS),
        ('net_value',  _NET_COLS),
    ]:
        col = _find_col(headers, *candidates)
        mapping[field] = col
    return mapping


def parse_csv(filepath: str) -> list[dict]:
    """
    Parse NSE FII/DII CSV file into a list of normalised records.
    Handles both wide format (one row = one date, columns for FII/DII)
    and long format (one row = one category per date).
    """
    records = []
    skipped = 0

    with open(filepath, 'r', encoding='utf-8-sig') as f:
        # Detect delimiter
        sample = f.read(2048)
        f.seek(0)
        dialect = csv.Sniffer().sniff(sample, delimiters=',\t|')
        reader = csv.DictReader(f, dialect=dialect)
        headers = reader.fieldnames or []

        print(f'  CSV columns: {headers}')
        col = _sniff_columns(headers)
        print(f'  Mapped: {col}')

        # Detect format: wide (FII Buy, DII Buy as separate cols) vs long (category col)
        is_wide = col['category'] is None

        for row in reader:
            if is_wide:
                # Wide format: one row per date, separate columns for FII/DII
                rows = _parse_wide_row(row, headers)
            else:
                # Long format: one row per (date, category)
                rows = _parse_long_row(row, col)

            for r in rows:
                if r:
                    records.append(r)
                else:
                    skipped += 1

    print(f'  Parsed: {len(records)} records, skipped: {skipped}')
    return records


def _parse_long_row(row: dict, col: dict) -> list[dict | None]:
    """Parse a single long-format row (one category per row)."""
    raw_date = row.get(col['date'], '') if col['date'] else ''
    raw_cat  = row.get(col['category'], '') if col['category'] else ''

    d = _parse_date(raw_date)
    cat = _norm_category(raw_cat) if raw_cat else None

    if not d or not cat:
        return [None]

    return [{
        'trade_date': str(d),
        'category':   cat,
        'buy_value':  _parse_number(row.get(col['buy_value'])  if col['buy_value']  else None),
        'sell_value': _parse_number(row.get(col['sell_value']) if col['sell_value'] else None),
        'net_value':  _parse_number(row.get(col['net_value'])  if col['net_value']  else None),
    }]


def _parse_wide_row(row: dict, headers: list[str]) -> list[dict | None]:
    """
    Parse a wide-format row where FII and DII are separate column groups.
    Example headers: Date | FII Buy | FII Sell | FII Net | DII Buy | DII Sell | DII Net
    """
    # Find date column
    date_col = _find_col(headers, *_DATE_COLS)
    raw_date = row.get(date_col, '') if date_col else ''
    d = _parse_date(raw_date)
    if not d:
        return [None]

    results = []
    col_lower = {h.lower(): h for h in headers}

    for cat, prefixes in [('FII', ['fii', 'fpi']), ('DII', ['dii'])]:
        buy = sell = net = None
        for h in headers:
            hl = h.lower()
            for pfx in prefixes:
                if pfx in hl:
                    if any(k in hl for k in ('buy', 'purchase', 'gross pur')):
                        buy = _parse_number(row.get(h))
                    elif any(k in hl for k in ('sell', 'sale', 'gross sal')):
                        sell = _parse_number(row.get(h))
                    elif any(k in hl for k in ('net',)):
                        net = _parse_number(row.get(h))

        if buy is not None or sell is not None or net is not None:
            results.append({
                'trade_date': str(d),
                'category':   cat,
                'buy_value':  buy,
                'sell_value': sell,
                'net_value':  net,
            })

    return results or [None]


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Import FII/DII historical CSV into km_fii_dii')
    parser.add_argument('filepath', help='Path to the NSE FII/DII CSV file')
    parser.add_argument('--dry-run', action='store_true', help='Parse only, do not insert')
    parser.add_argument('--preview', action='store_true', help='Show first 10 parsed records and exit')
    args = parser.parse_args()

    if not os.path.exists(args.filepath):
        print(f'File not found: {args.filepath}')
        sys.exit(1)

    print(f'\nParsing: {args.filepath}')
    records = parse_csv(args.filepath)

    if not records:
        print('No valid records found. Check the CSV format.')
        sys.exit(1)

    # Show date range
    dates = sorted(set(r['trade_date'] for r in records))
    print(f'  Date range: {dates[0]} → {dates[-1]}  ({len(dates)} trading days)')
    cats = sorted(set(r['category'] for r in records))
    print(f'  Categories: {cats}')

    if args.preview:
        print('\nFirst 10 records:')
        for r in records[:10]:
            print(f"  {r['trade_date']}  {r['category']:4}  "
                  f"buy={r['buy_value']}  sell={r['sell_value']}  net={r['net_value']}")
        return

    if args.dry_run:
        print(f'\nDRY RUN — {len(records)} records would be upserted (no DB write)')
        return

    # Insert
    db = get_db()
    count = db.upsert('km_fii_dii', records, 'trade_date,category')
    print(f'\n✓ Upserted {count} records into km_fii_dii')
    print(f'  ({len(dates)} dates × {len(cats)} categories)')


if __name__ == '__main__':
    main()
