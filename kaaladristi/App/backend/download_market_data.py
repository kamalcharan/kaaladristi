import yfinance as yf
import pandas as pd
import os
from dotenv import load_dotenv
from supabase import create_client, Client
from datetime import datetime, timedelta
import time

# =============================================================================
# CONFIGURATION
# =============================================================================

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend', '.env'))

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

# Date range (match your ephemeris data)
START_DATE = "2000-01-01"
END_DATE = "2040-12-31"  # Yahoo will return up to today

# Symbols to download
SYMBOLS = {
    '^NSEI': 'NIFTY',           # NIFTY 50
    '^NSEBANK': 'BANKNIFTY',    # Bank NIFTY
}

# Batch size for Supabase inserts
BATCH_SIZE = 1000

# =============================================================================
# SUPABASE CLIENT
# =============================================================================

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# =============================================================================
# DOWNLOAD FUNCTIONS
# =============================================================================

def download_yahoo_data(ticker, symbol_name, start_date, end_date):
    """Download data from Yahoo Finance."""
    print(f"\nDownloading {symbol_name} ({ticker})...")
    print(f"  Period: {start_date} to {end_date}")
    
    try:
        # Download data with explicit parameters for new yfinance version
        df = yf.download(
            ticker, 
            start=start_date, 
            end=end_date, 
            progress=False,
            auto_adjust=False,  # Keep original OHLC values
            multi_level_index=False  # Flatten column index
        )
        
        if df.empty:
            print(f"  ✗ No data returned for {ticker}")
            return None
        
        # Debug: Print columns to see structure
        print(f"  Columns received: {list(df.columns)}")
        
        # Reset index to get date as column
        df = df.reset_index()
        
        # Debug: Print columns after reset
        print(f"  Columns after reset: {list(df.columns)}")
        
        # Standardize column names (handle both old and new yfinance formats)
        df.columns = [col.lower().replace(' ', '_') for col in df.columns]
        
        # Rename 'price' to 'date' if needed (new yfinance uses 'price' sometimes)
        if 'price' in df.columns:
            df = df.rename(columns={'price': 'date'})
        
        # Ensure we have required columns
        required_cols = ['date', 'open', 'high', 'low', 'close']
        for col in required_cols:
            if col not in df.columns:
                print(f"  ✗ Missing column: {col}")
                print(f"  Available columns: {list(df.columns)}")
                return None
        
        # Add symbol
        df['symbol'] = symbol_name
        
        # Convert date to string format
        df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
        
        # Get volume (might be named differently)
        if 'volume' not in df.columns:
            df['volume'] = None
        
        # Calculate derived fields
        df['daily_range_pct'] = ((df['high'] - df['low']) / df['open'] * 100).round(4)
        
        # Calculate daily return and gap (need previous day's close)
        df['prev_close'] = df['close'].shift(1)
        df['daily_return'] = ((df['close'] - df['prev_close']) / df['prev_close'] * 100).round(4)
        df['gap_pct'] = ((df['open'] - df['prev_close']) / df['prev_close'] * 100).round(4)
        
        # Drop first row (no previous close)
        df = df.iloc[1:]
        
        # Select only needed columns
        df = df[['date', 'symbol', 'open', 'high', 'low', 'close', 'volume', 
                 'daily_return', 'daily_range_pct', 'gap_pct']]
        
        # Handle NaN and Inf values
        df = df.replace([float('inf'), float('-inf')], None)
        df = df.where(pd.notnull(df), None)
        
        print(f"  ✓ Downloaded {len(df)} records")
        print(f"  Date range: {df['date'].iloc[0]} to {df['date'].iloc[-1]}")
        
        return df
        
    except Exception as e:
        print(f"  ✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return None


def upload_to_supabase(df, symbol_name):
    """Upload dataframe to Supabase."""
    print(f"\nUploading {symbol_name} to Supabase...")
    
    # Convert to list of dicts
    records = df.to_dict('records')
    
    # Clean up records for Supabase
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
    
    # Upload in batches
    total = len(clean_records)
    total_batches = (total + BATCH_SIZE - 1) // BATCH_SIZE
    success = 0
    
    for i in range(0, total, BATCH_SIZE):
        batch = clean_records[i:i + BATCH_SIZE]
        batch_num = (i // BATCH_SIZE) + 1
        
        try:
            supabase.table('market_daily').insert(batch).execute()
            success += len(batch)
            print(f"    Batch {batch_num}/{total_batches} inserted ({len(batch)} records)")
        except Exception as e:
            print(f"    ✗ Batch {batch_num} failed: {str(e)[:80]}")
    
    print(f"  ✓ Uploaded {success}/{total} records")
    return success


# =============================================================================
# MAIN EXECUTION
# =============================================================================

def main():
    print("=" * 60)
    print("MARKET DATA DOWNLOADER")
    print("=" * 60)
    
    # Print yfinance version
    print(f"\nyfinance version: {yf.__version__}")
    
    # Test Supabase connection
    print("\nTesting Supabase connection...")
    try:
        supabase.table('market_daily').select('id').limit(1).execute()
        print("  ✓ Connected")
    except Exception as e:
        print(f"  ✗ Failed: {e}")
        return
    
    # Download and upload each symbol
    total_records = 0
    
    for ticker, symbol_name in SYMBOLS.items():
        # Download
        df = download_yahoo_data(ticker, symbol_name, START_DATE, END_DATE)
        
        if df is not None and not df.empty:
            # Upload
            uploaded = upload_to_supabase(df, symbol_name)
            total_records += uploaded
        
        # Small delay between symbols
        time.sleep(1)
    
    # Summary
    print("\n" + "=" * 60)
    print("DOWNLOAD COMPLETE")
    print("=" * 60)
    print(f"\nTotal records uploaded: {total_records}")
    
    # Quick verification query
    print("\nVerification - Record counts by symbol:")
    for _, symbol_name in SYMBOLS.items():
        result = supabase.table('market_daily')\
            .select('date', count='exact')\
            .eq('symbol', symbol_name)\
            .execute()
        print(f"  {symbol_name}: {result.count} records")


if __name__ == '__main__':
    main()