"""
Kāla-Drishti Technical Indicators Compute Engine
=================================================

Orchestrates computation of all technical indicators for index and equity EOD data.
Reads OHLCV from km_index_eod / km_equity_eod, computes indicators, writes results
back to the same tables.

Usage: called from compute_indicators.py CLI entry point.
"""

import time
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

from indicators.calculators import ALL_CALCULATORS
from indicators.calculators.magic_rs import compute_magic_rs


# Maximum lookback needed across all indicators (SMA 233)
MAX_LOOKBACK = 250

# Columns to write back to EOD tables
INDICATOR_COLUMNS = [
    # SMAs
    'sma_8', 'sma_21', 'sma_50', 'sma_55', 'sma_89', 'sma_150', 'sma_200', 'sma_233',
    # Momentum
    'rsi_14', 'rsi_9', 'mfi_14',
    # ATR + SuperTrend
    'atr_10', 'atr_14', 'supertrend', 'supertrend_dir',
    # OBV
    'obv', 'obv_sma_20',
    # Volume
    'rvol', 'tvol',
    # Sniper Dragon
    'sniper_inst', 'sniper_hot', 'sniper_rsi',
    # RSS
    'rss_value', 'rss_rsi',
    # Pivots
    'pivot_pp', 'pivot_r1', 'pivot_r2', 'pivot_r3',
    'pivot_s1', 'pivot_s2', 'pivot_s3',
    # Chartink
    'chartink_emd_pct', 'chartink_emd_ok', 'chartink_ca_pct',
    'chartink_ca_ok', 'chartink_vmac_ok', 'chartink_score',
    # Dots
    'dot_svd', 'dot_sbd', 'dot_syd',
    # Swing
    'swing_high', 'swing_low',
    # MagicRS (computed separately)
    'magic_rs', 'magic_rs_sma144', 'magic_ma', 'magic_rs_zone',
]


class IndicatorEngine:

    def __init__(self, db):
        self.db = db
        self.benchmark_close = None  # loaded on demand

    def _load_eod(self, table: str, id_col: str, symbol_id: int,
                  date_from: str = None) -> pd.DataFrame:
        """Load EOD data for a symbol, sorted by trade_date."""
        filters = {id_col: symbol_id}
        rows = self.db.select(table, columns='*', filters=filters,
                              order='trade_date')

        if not rows:
            return pd.DataFrame()

        df = pd.DataFrame(rows)
        df['trade_date'] = pd.to_datetime(df['trade_date'])
        df = df.sort_values('trade_date').reset_index(drop=True)

        # Ensure numeric types
        for col in ['open', 'high', 'low', 'close', 'volume']:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')

        return df

    def _load_benchmark(self, table: str, id_col: str, benchmark_id: int) -> pd.Series:
        """Load benchmark close prices indexed by trade_date."""
        if self.benchmark_close is not None:
            return self.benchmark_close

        rows = self.db.select(table, columns='trade_date,close',
                              filters={id_col: benchmark_id},
                              order='trade_date')
        if not rows:
            print('  [warn] No benchmark data found — MagicRS will be skipped')
            return pd.Series(dtype=float)

        bench_df = pd.DataFrame(rows)
        bench_df['trade_date'] = pd.to_datetime(bench_df['trade_date'])
        bench_df['close'] = pd.to_numeric(bench_df['close'], errors='coerce')
        self.benchmark_close = bench_df.set_index('trade_date')['close']
        return self.benchmark_close

    def compute_symbol(self, df: pd.DataFrame, benchmark_close: pd.Series = None,
                       compute_from_idx: int = 0) -> pd.DataFrame:
        """
        Compute all indicators for one symbol's EOD DataFrame.
        Returns the DataFrame with indicator columns added.

        compute_from_idx: only rows from this index onward will be written back,
                          but all rows are used for computation (lookback).
        """
        if df.empty or len(df) < 2:
            return df

        # Run all standard calculators
        for calc_fn in ALL_CALCULATORS:
            try:
                result = calc_fn(df)
                for col, series in result.items():
                    df[col] = series
            except Exception as e:
                print(f'    [error] {calc_fn.__name__}: {e}')

        # MagicRS — needs benchmark
        if benchmark_close is not None and not benchmark_close.empty:
            try:
                # Align by trade_date
                df_indexed = df.set_index('trade_date')
                rs_result = compute_magic_rs(df_indexed, benchmark_close)
                for col, series in rs_result.items():
                    df[col] = series.values
            except Exception as e:
                print(f'    [error] compute_magic_rs: {e}')

        # Mark computation timestamp
        df['indicators_computed_at'] = datetime.utcnow().isoformat()

        return df

    def _build_update_records(self, df: pd.DataFrame, id_col: str,
                              symbol_id: int, from_idx: int) -> list:
        """Build list of dicts for upsert from computed DataFrame."""
        subset = df.iloc[from_idx:]
        records = []

        for _, row in subset.iterrows():
            record = {
                id_col: symbol_id,
                'trade_date': row['trade_date'].strftime('%Y-%m-%d'),
            }
            for col in INDICATOR_COLUMNS:
                val = row.get(col)
                if val is None or (isinstance(val, float) and np.isnan(val)):
                    record[col] = None
                elif isinstance(val, (np.bool_, bool)):
                    record[col] = bool(val)
                elif isinstance(val, (np.integer,)):
                    record[col] = int(val)
                elif isinstance(val, (np.floating,)):
                    record[col] = round(float(val), 6)
                else:
                    record[col] = val

            record['indicators_computed_at'] = datetime.utcnow().isoformat()
            records.append(record)

        return records

    def run(self, mode: str = 'both', full: bool = False,
            symbol_name: str = None, date_from: str = None,
            benchmark_symbol: str = 'NIFTY 500'):
        """
        Main entry point.

        Args:
            mode: 'index', 'equity', or 'both'
            full: if True, recompute all history
            symbol_name: single symbol to compute (for testing)
            date_from: start date for backfill (ISO format)
            benchmark_symbol: name of benchmark index for MagicRS
        """
        start = time.time()
        total_computed = 0

        if mode in ('index', 'both'):
            total_computed += self._run_asset_type(
                asset_type='index',
                eod_table='km_index_eod',
                symbol_table='km_index_symbols',
                id_col='index_id',
                name_col='name',
                full=full,
                symbol_name=symbol_name,
                date_from=date_from,
                benchmark_symbol=benchmark_symbol,
            )

        if mode in ('equity', 'both'):
            total_computed += self._run_asset_type(
                asset_type='equity',
                eod_table='km_equity_eod',
                symbol_table='km_equity_symbols',
                id_col='equity_id',
                name_col='symbol',
                full=full,
                symbol_name=symbol_name,
                date_from=date_from,
                benchmark_symbol=benchmark_symbol,
            )

        elapsed = time.time() - start
        print(f'\n  Done. {total_computed} rows computed in {elapsed:.1f}s')

        # Log compute run
        try:
            self.db.insert('km_indicator_compute_log', {
                'compute_mode': 'full' if full else 'incremental',
                'asset_type': mode,
                'rows_computed': total_computed,
                'date_from': date_from,
                'status': 'success',
                'duration_secs': round(elapsed, 2),
            })
        except Exception:
            pass  # log table may not exist yet

        return total_computed

    def _run_asset_type(self, asset_type: str, eod_table: str,
                        symbol_table: str, id_col: str, name_col: str,
                        full: bool, symbol_name: str, date_from: str,
                        benchmark_symbol: str) -> int:
        """Process all symbols of one asset type."""
        print(f'\n{"=" * 60}')
        print(f'  Computing {asset_type} indicators')
        print(f'{"=" * 60}')

        # Load symbols
        if symbol_name:
            symbols = self.db.select(symbol_table, filters={name_col: symbol_name})
        else:
            symbols = self.db.select(symbol_table)

        if not symbols:
            print(f'  No {asset_type} symbols found')
            return 0

        print(f'  Found {len(symbols)} {asset_type} symbol(s)')

        # Load benchmark for MagicRS
        bench_close = pd.Series(dtype=float)
        if benchmark_symbol:
            bench_rows = self.db.select(symbol_table,
                                        filters={name_col: benchmark_symbol})
            if bench_rows:
                bench_id = bench_rows[0]['id']
                bench_close = self._load_benchmark(eod_table, id_col, bench_id)
                print(f'  Benchmark: {benchmark_symbol} ({len(bench_close)} bars)')
            else:
                print(f'  [warn] Benchmark "{benchmark_symbol}" not found')

        total = 0
        for i, sym in enumerate(symbols):
            sym_id = sym['id']
            sym_name = sym.get(name_col, sym_id)
            print(f'  [{i + 1}/{len(symbols)}] {sym_name}...', end=' ', flush=True)

            # Load EOD
            df = self._load_eod(eod_table, id_col, sym_id)
            if df.empty:
                print('no data')
                continue

            # Determine compute range
            if full or date_from:
                compute_from_idx = 0
            else:
                # Incremental: find rows not yet computed
                computed_mask = df['indicators_computed_at'].notna()
                if computed_mask.all():
                    print('up to date')
                    continue
                # Need lookback before first uncomputed row
                first_uncomputed = (~computed_mask).idxmax()
                compute_from_idx = max(0, first_uncomputed - MAX_LOOKBACK)

            # Compute
            df = self.compute_symbol(df, bench_close, compute_from_idx)

            # Build update records (only for rows we want to write)
            write_from = compute_from_idx if full else max(compute_from_idx, 0)
            records = self._build_update_records(df, id_col, sym_id, write_from)

            if records:
                # Upsert in batches
                batch_size = 500
                for j in range(0, len(records), batch_size):
                    batch = records[j:j + batch_size]
                    self.db.upsert(eod_table, batch, f'{id_col},trade_date')

                print(f'{len(records)} rows')
                total += len(records)
            else:
                print('0 rows')

        return total
