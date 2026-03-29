import yfinance as yf
import pandas as pd
import os
import sys
from dotenv import load_dotenv
from datetime import datetime, timedelta
import time

# =============================================================================
# CONFIGURATION
# =============================================================================

script_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(script_dir, '..', 'frontend', '.env'))
load_dotenv(os.path.join(script_dir, '..', '.env'), override=True)

sys.path.insert(0, script_dir)
from lib.db_client import get_db  # noqa: E402

# Date range (match your ephemeris data)
START_DATE = "2000-01-01"
END_DATE = "2040-12-31"  # Yahoo will return up to today

# Symbols to download
SYMBOLS = {
    '^NSEI': 'NIFTY',           # NIFTY 50
    '^NSEBANK': 'BANKNIFTY',    # Bank NIFTY
}

# Batch size for PostgREST inserts
BATCH_SIZE = 1000

# =============================================================================
# DOWNLOAD FUNCTIONS
# =============================================================================

def download_yahoo_data(ticker, symbol_name, start_date, end_date):
    """Download data from Yahoo Finance."""
    print(f"\nDownloading {symbol_name} ({ticker})...")
    print(f"  Period: {start_date} to {end_date}")

    try:
        df = yf.download(
            ticker,
            start=start_date,
            end=end_date,
            progress=False,
            auto_adjust=False,
            multi_level_index=False
        )

        if df.empty:
            print(f"  No data returned for {ticker}")
            return None

        print(f"  Columns received: {list(df.columns)}")

        df = df.reset_index()
        print(f"  Columns after reset: {list(df.columns)}")

        df.columns = [col.lower().replace(' ', '_') for col in df.columns]

        if 'price' in df.columns:
            df = df.rename(columns={'price': 'date'})

        required_cols = ['date', 'open', 'high', 'low', 'close']
        for col in required_cols:
            if col not in df.columns:
                print(f"  Missing column: {col}")
                print(f"  Available columns: {list(df.columns)}")
                return None

        df['symbol'] = symbol_name
        df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')

        if 'volume' not in df.columns:
            df['volume'] = None

        df['daily_range_pct'] = ((df['high'] - df['low']) / df['open'] * 100).round(4)
        df['prev_close'] = df['close'].shift(1)
        df['daily_return'] = ((df['close'] - df['prev_close']) / df['prev_close'] * 100).round(4)
        df['gap_pct'] = ((df['open'] - df['prev_close']) / df['prev_close'] * 100).round(4)

        df = df.iloc[1:]
        df = df[['date', 'symbol', 'open', 'high', 'low', 'close', 'volume',
                 'daily_return', 'daily_range_pct', 'gap_pct']]

        df = df.replace([float('inf'), float('-inf')], None)
        df = df.where(pd.notnull(df), None)

        print(f"  Downloaded {len(df)} records")
        print(f"  Date range: {df['date'].iloc[0]} to {df['date'].iloc[-1]}")

        return df

    except Exception as e:
        print(f"  Error: {e}")
        import traceback
        traceback.print_exc()
        return None


def upload_to_db(db, df, symbol_name):
    """Upload dataframe to database via PostgREST."""
    print(f"\nUploading {symbol_name} to database...")

    records = df.to_dict('records')

    clean_records = []
    for r in records:
        clean_record = {
            'date': r['date'],
            'symbol': r['symbol'],
            'open': round(float(r['open']), 2) if r['open'] is not None else None,
            'high': round(float(r['high']), 2) if r['high'] is not None else None,
            'low': round(float(r['low']), 2) if r['low'] is not None else None,
            'close': round(float(r['close']), 2) if r['close'] is not None else None,
            'volume': int(r['volume']) if r['volume'] is not None and pd.notna(r['volume']) else None,
            'daily_return': round(float(r['daily_return']), 4) if r['daily_return'] is not None and pd.notna(r['daily_return']) else None,
            'daily_range_pct': round(float(r['daily_range_pct']), 4) if r['daily_range_pct'] is not None and pd.notna(r['daily_range_pct']) else None,
            'gap_pct': round(float(r['gap_pct']), 4) if r['gap_pct'] is not None and pd.notna(r['gap_pct']) else None,
        }
        clean_records.append(clean_record)

    total = len(clean_records)
    total_batches = (total + BATCH_SIZE - 1) // BATCH_SIZE
    success = 0

    for i in range(0, total, BATCH_SIZE):
        batch = clean_records[i:i + BATCH_SIZE]
        batch_num = (i // BATCH_SIZE) + 1

        try:
            db.upsert('market_daily', batch, on_conflict='date,symbol')
            success += len(batch)
            print(f"    Batch {batch_num}/{total_batches} inserted ({len(batch)} records)")
        except Exception as e:
            print(f"    Batch {batch_num} failed: {str(e)[:80]}")

    print(f"  Uploaded {success}/{total} records")
    return success


# =============================================================================
# MAIN EXECUTION
# =============================================================================

def main():
    print("=" * 60)
    print("MARKET DATA DOWNLOADER")
    print("=" * 60)

    print(f"\nyfinance version: {yf.__version__}")

    # Connect to PostgREST
    print("\nConnecting to PostgREST...")
    db = get_db()
    print("  Connected")

    total_records = 0

    for ticker, symbol_name in SYMBOLS.items():
        df = download_yahoo_data(ticker, symbol_name, START_DATE, END_DATE)

        if df is not None and not df.empty:
            uploaded = upload_to_db(db, df, symbol_name)
            total_records += uploaded

        time.sleep(1)

    print("\n" + "=" * 60)
    print("DOWNLOAD COMPLETE")
    print("=" * 60)
    print(f"\nTotal records uploaded: {total_records}")


if __name__ == '__main__':
    main()
