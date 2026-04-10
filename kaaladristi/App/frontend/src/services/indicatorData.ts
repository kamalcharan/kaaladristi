import { from } from './postgrest';
import type { MarketSymbol, TimeRange } from '@/types';
import { subMonths, subYears, format } from 'date-fns';

// Map UI symbols to index names in km_index_symbols
const SYMBOL_TO_INDEX_NAME: Record<MarketSymbol, string> = {
  NIFTY: 'NIFTY 50',
  BANKNIFTY: 'NIFTY BANK',
  NIFTYIT: 'NIFTY IT',
  NIFTYFMCG: 'NIFTY FMCG',
};

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

// Indicator columns to fetch — all that migration 005 added
const INDICATOR_COLS = [
  'sma_8', 'sma_21', 'sma_50', 'sma_55', 'sma_89', 'sma_150', 'sma_200', 'sma_233',
  'rsi_14', 'rsi_9', 'mfi_14',
  'atr_10', 'atr_14', 'supertrend', 'supertrend_dir',
  'obv', 'obv_sma_20', 'rvol', 'tvol',
  'magic_rs', 'magic_rs_sma144', 'magic_ma', 'magic_rs_zone',
  'sniper_inst', 'sniper_hot', 'sniper_rsi',
  'rss_value', 'rss_rsi',
  'pivot_pp', 'pivot_r1', 'pivot_r2', 'pivot_r3', 'pivot_s1', 'pivot_s2', 'pivot_s3',
  'chartink_emd_pct', 'chartink_emd_ok', 'chartink_ca_pct', 'chartink_ca_ok', 'chartink_vmac_ok', 'chartink_score',
  'dot_svd', 'dot_sbd', 'dot_syd',
  'swing_high', 'swing_low',
  'flow_type', 'vacuum_flag', 'accum_distrib',
].join(',');

export interface IndicatorRow {
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  // SMAs
  sma_8: number | null;
  sma_21: number | null;
  sma_50: number | null;
  sma_55: number | null;
  sma_89: number | null;
  sma_150: number | null;
  sma_200: number | null;
  sma_233: number | null;
  // Momentum
  rsi_14: number | null;
  rsi_9: number | null;
  mfi_14: number | null;
  // ATR + SuperTrend
  atr_10: number | null;
  atr_14: number | null;
  supertrend: number | null;
  supertrend_dir: number | null;
  // Volume
  obv: number | null;
  obv_sma_20: number | null;
  rvol: number | null;
  tvol: number | null;
  // MagicRS
  magic_rs: number | null;
  magic_rs_sma144: number | null;
  magic_ma: number | null;
  magic_rs_zone: string | null;
  // Sniper Dragon
  sniper_inst: number | null;
  sniper_hot: number | null;
  sniper_rsi: number | null;
  // RSS
  rss_value: number | null;
  rss_rsi: number | null;
  // Pivots
  pivot_pp: number | null;
  pivot_r1: number | null;
  pivot_r2: number | null;
  pivot_r3: number | null;
  pivot_s1: number | null;
  pivot_s2: number | null;
  pivot_s3: number | null;
  // Chartink
  chartink_emd_pct: number | null;
  chartink_emd_ok: boolean | null;
  chartink_ca_pct: number | null;
  chartink_ca_ok: boolean | null;
  chartink_vmac_ok: boolean | null;
  chartink_score: number | null;
  // Dots
  dot_svd: boolean;
  dot_sbd: boolean;
  dot_syd: boolean;
  // Swing
  swing_high: boolean;
  swing_low: boolean;
  // Flow Intelligence
  flow_type: string | null;
  vacuum_flag: string | null;
  accum_distrib: string | null;
}

export async function fetchIndicatorData(
  symbol: MarketSymbol,
  range: TimeRange,
): Promise<IndicatorRow[]> {
  // Look up index ID
  const name = SYMBOL_TO_INDEX_NAME[symbol];
  const { data: symData, error: symErr } = await from('km_index_symbols')
    .select('id')
    .eq('name', name)
    .maybeSingle()
    .execute();

  if (symErr || !symData) return [];

  const indexId = (symData as { id: number }).id;
  const startDate = getStartDate(range);
  const cols = `trade_date,open,high,low,close,volume,${INDICATOR_COLS}`;

  let query = from('km_index_eod')
    .select(cols)
    .eq('index_id', indexId)
    .order('trade_date', { ascending: true })
    .limit(10000);

  if (startDate) {
    query = query.gte('trade_date', startDate);
  }

  const { data, error } = await query.execute();
  if (error) throw new Error(error.message);

  return (data ?? []) as IndicatorRow[];
}

/** Fetch indicator data for any index by its DB id (used by /chart/index/:id) */
export async function fetchIndicatorDataById(
  indexId: number,
  range: TimeRange,
): Promise<IndicatorRow[]> {
  const startDate = getStartDate(range);
  const cols = `trade_date,open,high,low,close,volume,${INDICATOR_COLS}`;

  let query = from('km_index_eod')
    .select(cols)
    .eq('index_id', indexId)
    .order('trade_date', { ascending: true })
    .limit(10000);

  if (startDate) {
    query = query.gte('trade_date', startDate);
  }

  const { data, error } = await query.execute();
  if (error) throw new Error(error.message);

  return (data ?? []) as IndicatorRow[];
}

/** Fetch OHLCV data for an equity by its DB id (used by /chart/equity/:id).
 *  Returns IndicatorRow[] with indicator fields set to null — TradingChart
 *  renders a clean candlestick + volume chart without overlays. */
export async function fetchEquityEodById(
  equityId: number,
  range: TimeRange,
): Promise<IndicatorRow[]> {
  const startDate = getStartDate(range);

  let query = from('km_equity_eod')
    .select('trade_date,open,high,low,close,volume')
    .eq('equity_id', equityId)
    .order('trade_date', { ascending: true })
    .limit(10000);

  if (startDate) {
    query = query.gte('trade_date', startDate);
  }

  const { data, error } = await query.execute();
  if (error) throw new Error(error.message);

  // Pad with null indicators so TradingChart receives the expected shape
  const NULL_INDICATORS: Omit<IndicatorRow, 'trade_date' | 'open' | 'high' | 'low' | 'close' | 'volume'> = {
    sma_8: null, sma_21: null, sma_50: null, sma_55: null,
    sma_89: null, sma_150: null, sma_200: null, sma_233: null,
    rsi_14: null, rsi_9: null, mfi_14: null,
    atr_10: null, atr_14: null, supertrend: null, supertrend_dir: null,
    obv: null, obv_sma_20: null, rvol: null, tvol: null,
    magic_rs: null, magic_rs_sma144: null, magic_ma: null, magic_rs_zone: null,
    sniper_inst: null, sniper_hot: null, sniper_rsi: null,
    rss_value: null, rss_rsi: null,
    pivot_pp: null, pivot_r1: null, pivot_r2: null, pivot_r3: null,
    pivot_s1: null, pivot_s2: null, pivot_s3: null,
    chartink_emd_pct: null, chartink_emd_ok: null,
    chartink_ca_pct: null, chartink_ca_ok: null,
    chartink_vmac_ok: null, chartink_score: null,
    dot_svd: false, dot_sbd: false, dot_syd: false,
    swing_high: false, swing_low: false,
    flow_type: null, vacuum_flag: null, accum_distrib: null,
  };

  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...NULL_INDICATORS,
    trade_date: row.trade_date as string,
    open:   Number(row.open   ?? 0),
    high:   Number(row.high   ?? 0),
    low:    Number(row.low    ?? 0),
    close:  Number(row.close  ?? 0),
    volume: Number(row.volume ?? 0),
  }));
}
