"""
Seed market transaction tables from NSE CSV data.
Loads:
  1. niftyEOD.csv (NIFTY 50 historical, 1990-2020) into market_daily
  2. Stock-level EOD from downloaded EOD data/ into stock_daily
"""

import csv
import os
import re
from datetime import datetime
from schema import get_connection, create_schema, DB_PATH

QUANT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                         '..', '..', '..', 'NSE Data Analysis', 'QuantMappings')
EOD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                       '..', '..', '..', 'NSE Data Analysis', 'downloaded EOD data')


def parse_float(val):
    if val is None:
        return None
    val = str(val).strip().replace(',', '')
    if not val:
        return None
    try:
        v = float(val)
        return v if v != 0 else None
    except ValueError:
        return None


def parse_int(val):
    if val is None:
        return None
    val = str(val).strip().replace(',', '')
    if not val:
        return None
    try:
        return int(float(val))
    except ValueError:
        return None


# =========================================================================
# NIFTY 50 EOD (index-level historical data)
# =========================================================================
def seed_nifty_eod(conn):
    """Load niftyEOD.csv into market_daily table."""
    path = os.path.join(QUANT_DIR, 'niftyEOD.csv')
    if not os.path.exists(path):
        print("  niftyEOD.csv not found, skipping")
        return

    records = []
    prev_close = None

    with open(path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            date_str = row.get('Date', '').strip()
            if not date_str:
                continue

            # Parse date: DD-MM-YYYY -> YYYY-MM-DD
            try:
                dt = datetime.strptime(date_str, '%d-%m-%Y')
                date_iso = dt.strftime('%Y-%m-%d')
            except ValueError:
                continue

            close = parse_float(row.get('Close'))
            if close is None:
                continue

            open_val = parse_float(row.get('Open'))
            high = parse_float(row.get('High'))
            low = parse_float(row.get('Low'))
            volume = parse_int(row.get('Volume'))
            turnover = parse_float(row.get('Turnover'))

            # Compute derived fields
            daily_return = None
            gap_pct = None
            daily_range_pct = None

            if prev_close and prev_close > 0:
                daily_return = round((close - prev_close) / prev_close * 100, 4)
                if open_val and open_val > 0:
                    gap_pct = round((open_val - prev_close) / prev_close * 100, 4)

            if open_val and open_val > 0 and high and low:
                daily_range_pct = round((high - low) / open_val * 100, 4)

            records.append((
                date_iso, 'NIFTY', open_val, high, low, close,
                volume, turnover, daily_return, daily_range_pct, gap_pct
            ))

            prev_close = close

    # Batch insert
    conn.executemany(
        """INSERT OR IGNORE INTO market_daily
           (date, symbol, open, high, low, close, volume, turnover,
            daily_return, daily_range_pct, gap_pct)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
        records
    )
    conn.commit()

    # Stats
    valid = len([r for r in records if r[7] is not None])  # has daily_return
    date_range = f"{records[0][0]} to {records[-1][0]}" if records else "none"
    print(f"  market_daily (NIFTY): {len(records)} rows loaded ({date_range})")


# =========================================================================
# STOCK EOD (from TradingView exports)
# =========================================================================
def seed_stock_eod(conn):
    """Load stock-level EOD from downloaded EOD data/ into stock_daily."""
    if not os.path.exists(EOD_DIR):
        print("  downloaded EOD data/ not found, skipping")
        return

    files = [f for f in os.listdir(EOD_DIR) if f.endswith('.csv')]
    total_rows = 0
    loaded_stocks = 0

    for filename in sorted(files):
        # Extract symbol: "NSE_AXISBANK, 1D.csv" -> "AXISBANK"
        match = re.match(r'NSE_([A-Z0-9&]+)', filename)
        if not match:
            continue
        symbol = match.group(1)

        filepath = os.path.join(EOD_DIR, filename)
        records = []
        prev_close = None

        try:
            with open(filepath, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    time_str = row.get('time', '').strip()
                    if not time_str:
                        continue

                    # Parse: 2015-01-16T09:15:00+05:30 -> 2015-01-16
                    try:
                        date_iso = time_str[:10]
                        datetime.strptime(date_iso, '%Y-%m-%d')  # validate
                    except ValueError:
                        continue

                    close = parse_float(row.get('close'))
                    if close is None:
                        continue

                    open_val = parse_float(row.get('open'))
                    high = parse_float(row.get('high'))
                    low = parse_float(row.get('low'))
                    volume = parse_int(row.get('Volume'))

                    daily_return = None
                    daily_range_pct = None

                    if prev_close and prev_close > 0:
                        daily_return = round((close - prev_close) / prev_close * 100, 4)

                    if open_val and open_val > 0 and high and low:
                        daily_range_pct = round((high - low) / open_val * 100, 4)

                    records.append((
                        date_iso, symbol, open_val, high, low, close,
                        volume, daily_return, daily_range_pct
                    ))
                    prev_close = close

        except Exception as e:
            continue

        if records:
            conn.executemany(
                """INSERT OR IGNORE INTO stock_daily
                   (date, symbol, open, high, low, close, volume,
                    daily_return, daily_range_pct)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                records
            )
            total_rows += len(records)
            loaded_stocks += 1

    conn.commit()
    print(f"  stock_daily: {total_rows} rows from {loaded_stocks} stocks loaded")


# =========================================================================
# MAIN
# =========================================================================
def main():
    print("=" * 60)
    print("KĀLA-DRISHTI MARKET DATA SEED")
    print("=" * 60)
    print(f"Database: {DB_PATH}")
    print()

    conn = get_connection()
    create_schema(conn)

    print("Loading market data...")
    seed_nifty_eod(conn)
    seed_stock_eod(conn)

    # Verification
    print("\n" + "=" * 60)
    print("VERIFICATION")
    print("=" * 60)

    # Index data stats
    rows = conn.execute("""
        SELECT symbol, COUNT(*) as days,
               MIN(date) as first_date, MAX(date) as last_date,
               MIN(close) as min_close, MAX(close) as max_close
        FROM market_daily
        GROUP BY symbol
    """).fetchall()
    print("\n  market_daily:")
    for row in rows:
        print(f"    {row['symbol']:15s} {row['days']:>6} days "
              f"({row['first_date']} to {row['last_date']}) "
              f"close range: {row['min_close']:.0f} - {row['max_close']:.0f}")

    # Stock data stats
    stock_count = conn.execute("SELECT COUNT(DISTINCT symbol) FROM stock_daily").fetchone()[0]
    total_rows = conn.execute("SELECT COUNT(*) FROM stock_daily").fetchone()[0]
    date_range = conn.execute("SELECT MIN(date), MAX(date) FROM stock_daily").fetchone()
    print(f"\n  stock_daily: {total_rows} total rows, {stock_count} stocks")
    if date_range[0]:
        print(f"    date range: {date_range[0]} to {date_range[1]}")

    # Sample: top 10 stocks by data points
    rows = conn.execute("""
        SELECT symbol, COUNT(*) as days, MIN(date) as first, MAX(date) as last
        FROM stock_daily
        GROUP BY symbol
        ORDER BY days DESC
        LIMIT 10
    """).fetchall()
    print(f"\n  Top 10 stocks by history:")
    for row in rows:
        print(f"    {row['symbol']:15s} {row['days']:>6} days ({row['first']} to {row['last']})")

    conn.close()
    print("\nMarket data seed complete.")


if __name__ == '__main__':
    main()
