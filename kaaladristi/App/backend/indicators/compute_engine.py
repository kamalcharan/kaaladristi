"""
Kāla-Drishti Technical Indicators Compute Engine
=================================================

Orchestrates computation of all technical indicators for index and equity EOD data.
Reads OHLCV from km_index_eod / km_equity_eod, computes indicators, writes results
back to the same tables.

Modes:
  --full:  Recompute everything from scratch (initial backfill)
  default: Incremental — only symbols with new EOD rows since last computation

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
        self.benchmark_cache = {}  # table -> Series

    def _get_conn(self):
        """Get a raw psycopg2 connection from the pool."""
        return self.db._conn()

    def _put_conn(self, conn):
        """Return connection to pool."""
        self.db._put(conn)

    def _find_pending_symbols(self, conn, eod_table: str, id_col: str) -> list:
        """
        Find symbols that have EOD rows newer than their last computed indicator.
        Returns list of (symbol_id, last_computed_date, latest_eod_date).

        A symbol needs computation when:
          - It has rows where indicators_computed_at IS NULL, OR
          - It has never been computed at all
        """
        import psycopg2.extras

        sql = f"""
            SELECT {id_col} AS symbol_id,
                   MAX(CASE WHEN indicators_computed_at IS NOT NULL THEN trade_date END) AS last_computed,
                   MAX(trade_date) AS latest_eod,
                   COUNT(*) FILTER (WHERE indicators_computed_at IS NULL) AS pending_rows
            FROM {eod_table}
            GROUP BY {id_col}
            HAVING COUNT(*) FILTER (WHERE indicators_computed_at IS NULL) > 0
            ORDER BY {id_col}
        """
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql)
            return [dict(r) for r in cur.fetchall()]

    def _load_eod_range(self, conn, table: str, id_col: str, symbol_id: int,
                        date_from: str = None) -> pd.DataFrame:
        """
        Load EOD data for a symbol. If date_from is specified, loads from
        (date_from - MAX_LOOKBACK trading days) to get enough history for indicators.
        """
        import psycopg2.extras

        if date_from:
            # Load lookback window before date_from + everything after
            sql = f"""
                SELECT * FROM {table}
                WHERE {id_col} = %s
                  AND trade_date >= (
                      SELECT trade_date FROM {table}
                      WHERE {id_col} = %s AND trade_date <= %s
                      ORDER BY trade_date DESC
                      LIMIT 1 OFFSET {MAX_LOOKBACK}
                  )
                ORDER BY trade_date
            """
            params = [symbol_id, symbol_id, date_from]
        else:
            sql = f"SELECT * FROM {table} WHERE {id_col} = %s ORDER BY trade_date"
            params = [symbol_id]

        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            rows = [dict(r) for r in cur.fetchall()]

        if not rows:
            return pd.DataFrame()

        df = pd.DataFrame(rows)
        df['trade_date'] = pd.to_datetime(df['trade_date'])
        df = df.sort_values('trade_date').reset_index(drop=True)

        for col in ['open', 'high', 'low', 'close', 'volume']:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')

        return df

    def _load_benchmark(self, conn, table: str, id_col: str,
                        benchmark_id: int) -> pd.Series:
        """Load benchmark close prices indexed by trade_date (cached)."""
        cache_key = f'{table}:{benchmark_id}'
        if cache_key in self.benchmark_cache:
            return self.benchmark_cache[cache_key]

        import psycopg2.extras
        sql = f"SELECT trade_date, close FROM {table} WHERE {id_col} = %s ORDER BY trade_date"
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, [benchmark_id])
            rows = cur.fetchall()

        if not rows:
            return pd.Series(dtype=float)

        bench_df = pd.DataFrame([dict(r) for r in rows])
        bench_df['trade_date'] = pd.to_datetime(bench_df['trade_date'])
        bench_df['close'] = pd.to_numeric(bench_df['close'], errors='coerce')
        result = bench_df.set_index('trade_date')['close']
        self.benchmark_cache[cache_key] = result
        return result

    def compute_symbol(self, df: pd.DataFrame,
                       benchmark_close: pd.Series = None) -> pd.DataFrame:
        """Compute all indicators for one symbol's EOD DataFrame."""
        if df.empty or len(df) < 2:
            return df

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
                df_indexed = df.set_index('trade_date')
                rs_result = compute_magic_rs(df_indexed, benchmark_close)
                for col, series in rs_result.items():
                    df[col] = series.values
            except Exception as e:
                print(f'    [error] compute_magic_rs: {e}')

        df['indicators_computed_at'] = datetime.utcnow().isoformat()
        return df

    def _build_update_records(self, df: pd.DataFrame, id_col: str,
                              symbol_id: int, from_idx: int) -> list:
        """Build list of dicts for upsert from computed DataFrame."""
        subset = df.iloc[from_idx:]
        records = []
        now = datetime.utcnow().isoformat()

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

            record['indicators_computed_at'] = now
            records.append(record)

        return records

    def run(self, mode: str = 'both', full: bool = False,
            symbol_name: str = None, date_from: str = None,
            benchmark_symbol: str = 'NIFTY 500'):
        """
        Main entry point.

        Incremental mode (default): only computes symbols with new EOD data.
        Full mode: recomputes everything.
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
            pass

        return total_computed

    def _run_asset_type(self, asset_type: str, eod_table: str,
                        symbol_table: str, id_col: str, name_col: str,
                        full: bool, symbol_name: str, date_from: str,
                        benchmark_symbol: str) -> int:
        """Process all symbols of one asset type."""
        print(f'\n{"=" * 60}')
        print(f'  Computing {asset_type} indicators {"(FULL)" if full else "(incremental)"}')
        print(f'{"=" * 60}')

        conn = self._get_conn()
        try:
            return self._run_with_conn(
                conn, asset_type, eod_table, symbol_table,
                id_col, name_col, full, symbol_name, date_from,
                benchmark_symbol,
            )
        finally:
            self._put_conn(conn)

    def _run_with_conn(self, conn, asset_type, eod_table, symbol_table,
                       id_col, name_col, full, symbol_name, date_from,
                       benchmark_symbol) -> int:
        import psycopg2.extras

        # ── Determine which symbols to process ──

        if symbol_name:
            # Single symbol mode
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(f"SELECT * FROM {symbol_table} WHERE {name_col} = %s", [symbol_name])
                symbols = [dict(r) for r in cur.fetchall()]
            if not symbols:
                print(f'  Symbol "{symbol_name}" not found')
                return 0
            # For single symbol, always process it
            pending_map = {symbols[0]['id']: {'pending_rows': 9999, 'last_computed': None}}
        elif full or date_from:
            # Full mode — process all symbols
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(f"SELECT * FROM {symbol_table} ORDER BY id")
                symbols = [dict(r) for r in cur.fetchall()]
            pending_map = {s['id']: {'pending_rows': 9999, 'last_computed': None} for s in symbols}
        else:
            # Incremental — only symbols with uncomputed rows
            pending = self._find_pending_symbols(conn, eod_table, id_col)
            if not pending:
                print(f'  All {asset_type} symbols up to date')
                return 0

            pending_ids = [p['symbol_id'] for p in pending]
            pending_map = {p['symbol_id']: p for p in pending}

            # Load symbol details for pending ones
            placeholders = ','.join(['%s'] * len(pending_ids))
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(f"SELECT * FROM {symbol_table} WHERE id IN ({placeholders})", pending_ids)
                symbols = [dict(r) for r in cur.fetchall()]

        if not symbols:
            print(f'  No {asset_type} symbols found')
            return 0

        total_symbols = len(symbols)
        if full:
            print(f'  Processing all {total_symbols} {asset_type} symbol(s)')
        else:
            # Count total symbols for context
            with conn.cursor() as cur:
                cur.execute(f"SELECT COUNT(*) FROM {symbol_table}")
                all_count = cur.fetchone()[0]
            total_pending = sum(p['pending_rows'] for p in pending_map.values())
            print(f'  {total_symbols} of {all_count} {asset_type} symbol(s) have new data ({total_pending} new rows)')

        # ── Load benchmark for MagicRS ──

        bench_close = pd.Series(dtype=float)
        if benchmark_symbol:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(f"SELECT id FROM {symbol_table} WHERE {name_col} = %s", [benchmark_symbol])
                bench_row = cur.fetchone()
            if bench_row:
                bench_close = self._load_benchmark(conn, eod_table, id_col, bench_row['id'])
                print(f'  Benchmark: {benchmark_symbol} ({len(bench_close)} bars)')
            else:
                print(f'  [warn] Benchmark "{benchmark_symbol}" not found')

        # ── Process each symbol ──

        total = 0
        for i, sym in enumerate(symbols):
            sym_id = sym['id']
            sym_name = sym.get(name_col, sym_id)
            info = pending_map.get(sym_id, {})
            pending_rows = info.get('pending_rows', 0)
            last_computed = info.get('last_computed')

            print(f'  [{i + 1}/{total_symbols}] {sym_name} ({pending_rows} new)...', end=' ', flush=True)

            # For incremental, only load from (last_computed - lookback)
            load_from = None
            if not full and last_computed:
                load_from = str(last_computed)

            df = self._load_eod_range(conn, eod_table, id_col, sym_id, load_from)
            if df.empty:
                print('no data')
                continue

            # Compute indicators on the full loaded range
            df = self.compute_symbol(df, bench_close)

            # Determine which rows to write back
            if full or date_from:
                write_from_idx = 0
                if date_from:
                    mask = df['trade_date'] >= pd.Timestamp(date_from)
                    if mask.any():
                        write_from_idx = mask.idxmax()
            else:
                # Incremental: only write rows that were previously uncomputed
                # (the ones after last_computed date)
                if last_computed:
                    mask = df['trade_date'] > pd.Timestamp(last_computed)
                    if mask.any():
                        write_from_idx = mask.idxmax()
                    else:
                        print('up to date')
                        continue
                else:
                    write_from_idx = 0

            records = self._build_update_records(df, id_col, sym_id, write_from_idx)

            if records:
                batch_size = 500
                for j in range(0, len(records), batch_size):
                    batch = records[j:j + batch_size]
                    self.db.upsert(eod_table, batch, f'{id_col},trade_date')
                print(f'{len(records)} rows')
                total += len(records)
            else:
                print('0 rows')

        return total
