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
    # Flow Intelligence (derived from existing indicators)
    'flow_type', 'vacuum_flag', 'accum_distrib',
    # Rolling range (equity-only; index tables don't have these columns but upsert ignores missing cols)
    'w52_high', 'w52_low', 'lifetime_high',
    # Momentum returns
    'd30_pct_chng', 'd365_pct_chng',
    # Delivery value averages
    'avg_amt_5d', 'avg_amt_22d', 'delivery_surge_x',
]


def compute_flow_intelligence(df: pd.DataFrame) -> dict:
    """
    Derive flow_type, vacuum_flag, accum_distrib from existing indicators.

    Flow classification (LuckyPop Order Flow using MagicRS as OI proxy):
      FRESH_LONGS / SHORT_COVERING / FRESH_SHORTS / LONG_LIQUIDATION / MIXED / LOW_VOLUME

    Vacuum detection:
      Price moved > 1% over 5 days but avg RVOL < 0.5 → VACUUM_UP / VACUUM_DOWN

    Accumulation / Distribution:
      Below/above Golden Line (SMA 150) + RVOL >= 3.0 + momentum/RS aligned
    """
    n = len(df)
    flow = pd.Series([None] * n, index=df.index, dtype=object)
    vacuum = pd.Series([None] * n, index=df.index, dtype=object)
    accum = pd.Series([None] * n, index=df.index, dtype=object)

    close = df['close'].values
    rvol = df.get('rvol', pd.Series([None] * n)).values
    rsi = df.get('rsi_14', pd.Series([None] * n)).values
    mfi = df.get('mfi_14', pd.Series([None] * n)).values
    sma150 = df.get('sma_150', pd.Series([None] * n)).values
    mrs_zone = df.get('magic_rs_zone', pd.Series([None] * n)).values
    mrs = df.get('magic_rs', pd.Series([None] * n)).values
    mrs_ma = df.get('magic_ma', pd.Series([None] * n)).values

    for i in range(1, n):
        if close[i] is None or np.isnan(close[i]) or close[i-1] is None or np.isnan(close[i-1]):
            continue

        price_up = close[i] > close[i-1]
        price_down = close[i] < close[i-1]
        cur_rvol = float(rvol[i]) if rvol[i] is not None and not (isinstance(rvol[i], float) and np.isnan(rvol[i])) else 0.0
        high_vol = cur_rvol >= 1.1

        # MagicRS direction
        zone = mrs_zone[i] if mrs_zone[i] is not None else None
        rs_bullish = zone in ('Strong Bull', 'Mild Bull') if zone else False
        rs_bearish = zone in ('Strong Bear', 'Mild Bear') if zone else False
        if not rs_bullish and not rs_bearish:
            # Fallback to raw values
            mr = mrs[i] if mrs[i] is not None and not (isinstance(mrs[i], float) and np.isnan(mrs[i])) else None
            mm = mrs_ma[i] if mrs_ma[i] is not None and not (isinstance(mrs_ma[i], float) and np.isnan(mrs_ma[i])) else None
            if mr is not None and mm is not None:
                rs_bullish = mr > mm
                rs_bearish = mr < mm

        # Flow type
        if not high_vol:
            flow.iloc[i] = 'LOW_VOLUME'
        elif price_up and rs_bullish:
            flow.iloc[i] = 'FRESH_LONGS'
        elif price_up and rs_bearish:
            flow.iloc[i] = 'SHORT_COVERING'
        elif price_down and rs_bearish:
            flow.iloc[i] = 'FRESH_SHORTS'
        elif price_down and rs_bullish:
            flow.iloc[i] = 'LONG_LIQUIDATION'
        else:
            flow.iloc[i] = 'MIXED'

        # Vacuum detection (need 5-day lookback)
        if i >= 5 and close[i-5] is not None and not np.isnan(close[i-5]) and close[i-5] > 0:
            pct_change_5 = ((close[i] - close[i-5]) / close[i-5]) * 100
            rvol_vals = [float(rvol[j]) for j in range(i-4, i+1)
                         if rvol[j] is not None and not (isinstance(rvol[j], float) and np.isnan(rvol[j]))]
            avg_rvol_5 = sum(rvol_vals) / len(rvol_vals) if rvol_vals else None

            if avg_rvol_5 is not None and avg_rvol_5 < 0.5:
                if pct_change_5 > 1.0:
                    vacuum.iloc[i] = 'VACUUM_UP'
                elif pct_change_5 < -1.0:
                    vacuum.iloc[i] = 'VACUUM_DOWN'

        # Accumulation / Distribution
        cur_sma150 = sma150[i] if sma150[i] is not None and not (isinstance(sma150[i], float) and np.isnan(sma150[i])) else None
        cur_rsi = float(rsi[i]) if rsi[i] is not None and not (isinstance(rsi[i], float) and np.isnan(rsi[i])) else 0.0
        cur_mfi = float(mfi[i]) if mfi[i] is not None and not (isinstance(mfi[i], float) and np.isnan(mfi[i])) else 0.0
        mom_bullish = cur_rsi > 50 and cur_mfi > 50
        mom_bearish = cur_rsi < 50 and cur_mfi < 50

        if cur_sma150 is not None and cur_rvol >= 3.0:
            if close[i] < cur_sma150 and (mom_bullish or rs_bullish):
                accum.iloc[i] = 'ACCUMULATION'
            elif close[i] > cur_sma150 and (mom_bearish or rs_bearish):
                accum.iloc[i] = 'DISTRIBUTION'

    return {
        'flow_type': flow,
        'vacuum_flag': vacuum,
        'accum_distrib': accum,
    }


def compute_rolling_range(df: pd.DataFrame) -> dict:
    """
    Compute w52_high, w52_low (252-bar rolling window), lifetime_high
    (expanding max), and SuperTrend (ATR period=10, multiplier=3.0).

    SuperTrend requires sequential bar-by-bar state — cannot be vectorised.
    Direction: 1 = bullish, -1 = bearish.
    """
    high  = df['high'].values
    low   = df['low'].values
    close = df['close'].values
    n     = len(df)

    # ── Rolling / expanding range ──────────────────────────────────────────
    h_series = df['high']
    l_series = df['low']
    w52_high      = h_series.rolling(window=252, min_periods=1).max()
    w52_low       = l_series.rolling(window=252, min_periods=1).min()
    lifetime_high = h_series.expanding(min_periods=1).max()

    # ── SuperTrend ─────────────────────────────────────────────────────────
    ST_MULTIPLIER = 3.0
    atr_col = df.get('atr_10') if 'atr_10' in df.columns else None

    st_value = np.full(n, np.nan)
    st_dir   = np.full(n, np.nan)

    if atr_col is not None:
        atr_vals = atr_col.values.astype(float)

        prev_dir   = 1
        prev_lower = 0.0
        prev_upper = 0.0
        first_valid = True

        for i in range(n):
            atr = atr_vals[i]
            if np.isnan(atr):
                continue

            hl2   = (high[i] + low[i]) / 2.0
            upper = hl2 + ST_MULTIPLIER * atr
            lower = hl2 - ST_MULTIPLIER * atr

            if first_valid:
                direction   = 1
                final_lower = lower
                final_upper = upper
                st_val      = lower
                first_valid = False
            else:
                if prev_dir == 1:
                    final_lower = max(lower, prev_lower)
                    final_upper = upper
                else:
                    final_upper = min(upper, prev_upper)
                    final_lower = lower

                if prev_dir == 1:
                    if close[i] < final_lower:
                        direction = -1
                        st_val    = final_upper
                    else:
                        direction = 1
                        st_val    = final_lower
                else:
                    if close[i] > final_upper:
                        direction = 1
                        st_val    = final_lower
                    else:
                        direction = -1
                        st_val    = final_upper

            prev_dir   = direction
            prev_lower = final_lower
            prev_upper = final_upper

            st_value[i] = round(st_val, 4)
            st_dir[i]   = direction

    # ── Momentum returns ──────────────────────────────────────────────────
    close = df['close']
    d30_pct_chng  = close.pct_change(periods=22).mul(100).round(2)   # ~1 month (22 trading days)
    d365_pct_chng = close.pct_change(periods=252).mul(100).round(2)  # ~1 year  (252 trading days)

    # ── Delivery value rolling averages ───────────────────────────────────
    # value_cr = traded value in crores; use 0 where missing so window stays valid
    value_cr = df.get('value_cr', pd.Series(dtype=float))
    if value_cr is None or value_cr.empty:
        value_cr = pd.Series(np.nan, index=df.index)
    avg_amt_5d  = value_cr.rolling(window=5,  min_periods=1).mean().round(4)
    avg_amt_22d = value_cr.rolling(window=22, min_periods=1).mean().round(4)
    delivery_surge_x = avg_amt_5d.div(avg_amt_22d.replace(0, np.nan)).round(4)

    return {
        'w52_high':           w52_high,
        'w52_low':            w52_low,
        'lifetime_high':      lifetime_high,
        'supertrend':         pd.Series(st_value, index=df.index),
        'supertrend_dir':     pd.Series(st_dir, index=df.index),
        'd30_pct_chng':       d30_pct_chng,
        'd365_pct_chng':      d365_pct_chng,
        'avg_amt_5d':         avg_amt_5d,
        'avg_amt_22d':        avg_amt_22d,
        'delivery_surge_x':   delivery_surge_x,
    }


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

        # Flow Intelligence — derived from existing indicators
        try:
            flow_result = compute_flow_intelligence(df)
            for col, series in flow_result.items():
                df[col] = series
        except Exception as e:
            print(f'    [error] compute_flow_intelligence: {e}')

        # Rolling range — w52_high, w52_low, lifetime_high
        try:
            range_result = compute_rolling_range(df)
            for col, series in range_result.items():
                df[col] = series.values
        except Exception as e:
            print(f'    [error] compute_rolling_range: {e}')

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
                # Catch all NA-like values: None, np.nan, pd.NA, pd.NaT
                if val is None:
                    record[col] = None
                elif isinstance(val, float) and np.isnan(val):
                    record[col] = None
                elif isinstance(val, (np.bool_, bool)):
                    record[col] = bool(val)
                elif isinstance(val, (np.integer,)):
                    record[col] = int(val)
                elif isinstance(val, (np.floating,)):
                    record[col] = round(float(val), 6)
                else:
                    try:
                        if pd.isna(val):
                            record[col] = None
                            continue
                    except (TypeError, ValueError):
                        pass
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
        if total_computed > 0:
            print(f'\n  Done. Updated indicators on {total_computed} EOD rows in {elapsed:.1f}s')
        else:
            print(f'\n  Done. All indicators up to date, nothing to update. ({elapsed:.1f}s)')

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
            print(f'  Full recompute: {total_symbols} {asset_type} symbol(s)')
        else:
            with conn.cursor() as cur:
                cur.execute(f"SELECT COUNT(*) FROM {symbol_table}")
                all_count = cur.fetchone()[0]
            total_pending = sum(p['pending_rows'] for p in pending_map.values())
            print(f'  {total_symbols} of {all_count} {asset_type} symbol(s) have {total_pending} pending EOD rows to update')

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

            if full:
                print(f'  [{i + 1}/{total_symbols}] {sym_name}...', end=' ', flush=True)
            else:
                print(f'  [{i + 1}/{total_symbols}] {sym_name} ({pending_rows} pending)...', end=' ', flush=True)

            # For incremental, only load from (last_computed - lookback)
            load_from = None
            if not full and last_computed:
                load_from = str(last_computed)

            df = self._load_eod_range(conn, eod_table, id_col, sym_id, load_from)
            if df.empty:
                print('no EOD data, skipped')
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
                print(f'updated {len(records)} rows')
                total += len(records)
            else:
                print('nothing to update')

        return total


# ── Standalone rolling-metrics step for the daily pipeline ────────────────────

ROLLING_COLUMNS = [
    'w52_high', 'w52_low', 'lifetime_high',
    'd30_pct_chng', 'd365_pct_chng',
    'avg_amt_5d', 'avg_amt_22d', 'delivery_surge_x',
]


def compute_rolling_metrics_for_date(db, trade_date, verbose: bool = False) -> int:
    """
    Compute rolling-range and momentum columns for all equity rows on trade_date.

    Called as a dedicated pipeline step (step 6g) so these columns are populated
    even after the PostgreSQL RPC has already set indicators_computed_at.

    Loads full per-symbol history (needed for d365 calendar-date lookback and
    lifetime_high expanding max), computes via compute_rolling_range(), then
    batch-updates only the row for trade_date.

    d365_pct_chng uses calendar-date bisect (not 252-bar count) matching
    backfill_d365.py: finds closest trading day on or before trade_date - 365 days
    within a ±30-day tolerance.

    Returns number of rows updated.
    """
    import psycopg2
    import psycopg2.extras
    from bisect import bisect_left
    from datetime import timedelta

    D365_TOLERANCE = 30  # days

    conn = db._conn()
    total = 0
    batch = []
    BATCH = 500

    try:
        with conn.cursor() as cur:
            cur.execute(
                'SELECT DISTINCT equity_id FROM km_equity_eod WHERE trade_date = %s ORDER BY equity_id',
                [str(trade_date)],
            )
            equity_ids = [r[0] for r in cur.fetchall()]

        if verbose:
            print(f'    [rolling_metrics] {len(equity_ids)} symbols for {trade_date}')

        for eid in equity_ids:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT id, trade_date, high, low, close, atr_10, value_cr
                    FROM km_equity_eod
                    WHERE equity_id = %s
                    ORDER BY trade_date ASC
                    """,
                    [eid],
                )
                rows = cur.fetchall()

            if not rows:
                continue

            df = pd.DataFrame([dict(r) for r in rows])
            df['trade_date'] = pd.to_datetime(df['trade_date'])
            for col in ['high', 'low', 'close', 'atr_10', 'value_cr']:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors='coerce')

            try:
                result = compute_rolling_range(df)
            except Exception as e:
                if verbose:
                    print(f'      [rolling_metrics] equity_id={eid} error: {e}')
                continue

            # Find the row for trade_date
            mask = df['trade_date'] == pd.Timestamp(trade_date)
            if not mask.any():
                continue
            idx = mask.idxmax()

            record = {'id': int(df.loc[idx, 'id'])}
            for col in ROLLING_COLUMNS:
                if col == 'd365_pct_chng':
                    continue  # computed separately below via calendar-date bisect
                if col in result:
                    val = result[col].iloc[idx]
                    record[col] = None if (val is None or (isinstance(val, float) and np.isnan(val))) else round(float(val), 4)
                else:
                    record[col] = None

            # ── d365 via calendar-date bisect (mirrors backfill_d365.py) ──
            dates_list  = [r['trade_date'] for r in rows]   # already datetime.date from psycopg2
            closes_list = [float(r['close']) if r['close'] is not None else None for r in rows]
            from datetime import date as _date
            td_date = trade_date if isinstance(trade_date, _date) else trade_date.date()
            target  = td_date - timedelta(days=365)
            j = bisect_left(dates_list, target, 0, idx)
            if j > 0 and (j >= idx or dates_list[j] > target):
                j -= 1
            d365 = None
            if 0 <= j < idx:
                diff = abs((dates_list[j] - target).days)
                past_close = closes_list[j]
                if diff <= D365_TOLERANCE and past_close and past_close != 0:
                    cur_close = closes_list[idx]
                    if cur_close is not None:
                        d365 = round((cur_close - past_close) / past_close * 100, 2)
            record['d365_pct_chng'] = d365

            batch.append(record)

            if len(batch) >= BATCH:
                _flush_rolling_batch(conn, batch)
                total += len(batch)
                batch = []

        if batch:
            _flush_rolling_batch(conn, batch)
            total += len(batch)

    finally:
        conn.close()

    if verbose:
        print(f'    [rolling_metrics] {total} rows updated for {trade_date}')

    return total


def _flush_rolling_batch(conn, batch: list):
    import psycopg2.extras

    sql = """
        UPDATE km_equity_eod AS e
        SET
          w52_high         = v.w52_high,
          w52_low          = v.w52_low,
          lifetime_high    = v.lifetime_high,
          d30_pct_chng     = v.d30_pct_chng,
          d365_pct_chng    = v.d365_pct_chng,
          avg_amt_5d       = v.avg_amt_5d,
          avg_amt_22d      = v.avg_amt_22d,
          delivery_surge_x = v.delivery_surge_x
        FROM (VALUES %s) AS v(
          id, w52_high, w52_low, lifetime_high,
          d30_pct_chng, d365_pct_chng,
          avg_amt_5d, avg_amt_22d, delivery_surge_x
        )
        WHERE e.id = v.id::int
    """
    rows = [
        (
            r['id'], r['w52_high'], r['w52_low'], r['lifetime_high'],
            r['d30_pct_chng'], r['d365_pct_chng'],
            r['avg_amt_5d'], r['avg_amt_22d'], r['delivery_surge_x'],
        )
        for r in batch
    ]
    with conn.cursor() as cur:
        psycopg2.extras.execute_values(cur, sql, rows)
    conn.commit()
