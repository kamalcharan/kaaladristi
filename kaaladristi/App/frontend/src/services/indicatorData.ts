import { supabase } from './supabase';
import type { MarketSymbol, LuckyPopIndicator, TimeRange } from '@/types';
import { subMonths, subYears, format } from 'date-fns';

// Reuse symbol-to-index mapping from eodData
import { fetchIndexSymbol } from './eodData';

function getStartDate(range: TimeRange): string | null {
  const now = new Date();
  switch (range) {
    case '1M':  return format(subMonths(now, 1), 'yyyy-MM-dd');
    case '3M':  return format(subMonths(now, 3), 'yyyy-MM-dd');
    case '6M':  return format(subMonths(now, 6), 'yyyy-MM-dd');
    case '1Y':  return format(subYears(now, 1), 'yyyy-MM-dd');
    case '5Y':  return format(subYears(now, 5), 'yyyy-MM-dd');
    case 'MAX': return null;
  }
}

/**
 * Fetch LuckyPop indicator data for an index symbol.
 * Falls back to raw EOD data if the indicator table has no rows yet.
 */
export async function fetchIndicatorData(
  symbol: MarketSymbol,
  range: TimeRange,
): Promise<LuckyPopIndicator[]> {
  console.log(`[fetchIndicatorData] Fetching ${symbol} (${range})...`);

  const index = await fetchIndexSymbol(symbol);
  if (!index) return [];

  const startDate = getStartDate(range);

  let query = supabase
    .from('km_luckypop_indicators')
    .select('*')
    .eq('symbol_type', 'index')
    .eq('symbol_id', index.id)
    .order('trade_date', { ascending: true })
    .range(0, 9999);

  if (startDate) {
    query = query.gte('trade_date', startDate);
  }

  const { data, error } = await query;

  if (error) {
    console.warn(`[fetchIndicatorData] Indicator table error: ${error.message}. Falling back to EOD.`);
    return fallbackToEod(index.id, range);
  }

  if (!data || data.length === 0) {
    console.log(`[fetchIndicatorData] No indicator data. Falling back to EOD.`);
    return fallbackToEod(index.id, range);
  }

  console.log(`[fetchIndicatorData] Got ${data.length} indicator rows for ${symbol}`);
  return data as LuckyPopIndicator[];
}

/**
 * Fallback: convert raw km_index_eod rows into LuckyPopIndicator shape
 * (only OHLCV filled, all computed fields null/false)
 */
async function fallbackToEod(
  indexId: number,
  range: TimeRange,
): Promise<LuckyPopIndicator[]> {
  const startDate = getStartDate(range);

  let query = supabase
    .from('km_index_eod')
    .select('id,index_id,trade_date,open,high,low,close,prev_close,volume')
    .eq('index_id', indexId)
    .order('trade_date', { ascending: true })
    .range(0, 9999);

  if (startDate) {
    query = query.gte('trade_date', startDate);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    symbol_type: 'index' as const,
    symbol_id: row.index_id,
    trade_date: row.trade_date,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    prev_close: row.prev_close,
    volume: row.volume,
    // All computed fields null/false
    sma_8: null, sma_21: null, sma_55: null, sma_89: null, sma_233: null, golden_line: null,
    dist_sma_8: null, dist_sma_21: null, dist_sma_55: null, dist_golden: null,
    supertrend_val: null, supertrend_dir: null, st_buy_signal: false, st_sell_signal: false,
    svd_condition: false, sbd_condition: false, syd_condition: false, pre_syd_warning: false,
    rsi: null, mfi: null, mfi_rsi_cross: false, obv_trend: null,
    rel_volume: null, rvol: null, tvol: null, avg_range: null,
    rss_smooth: null, rss_spread: null, rss_direction: null,
    ib30_high: null, ib30_low: null, ib30_established: false, ib30_status: null,
    is30_bull_break: false, is30_bear_break: false,
    rule1_move_pct: null, rule1_satisfied: false, correction_pct: null, rule2_satisfied: false,
    volume_surge: false, ma_proximity: false, rule3_satisfied: false,
    chartink_score: null, chartink_status: null,
    delta: null, smoothed_delta: null, absorption: false,
    flow_type: null, flow_meaning: null,
    vacuum_status: null, accum_dist: null,
    magicrs_pts: null, magicrs_value: null, magicma_value: null,
    sma_cross_up: false, sma_cross_down: false, sma_cross_dist: null,
    confluence: null,
    bias_status: null, momentum_status: null,
    breakout_quality: null, breakout_label: null,
    recommendation: null, rec_reason: null, signal_score: null, display_mode: null,
    position_rec: null, position_reason: null,
    div_type: null, div_bars_ago: null, div_freshness: null,
    pivot_pp: null, pivot_r1: null, pivot_r2: null, pivot_s1: null, pivot_s2: null,
    fibo_382: null, fibo_500: null, fibo_618: null,
    gann_250: null, gann_500: null, gann_750: null,
    is_swing_high: false, is_swing_low: false,
    sniper_banker: null, sniper_hotmoney: null, sniper_rsi_line: null,
    rssi_rss: null, rssi_rsi: null, rssi_new_high: false, rssi_bull_div: false, rssi_bear_div: false,
  }));
}
