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
  'ema_20', 'ema_60',
  'sma_8', 'sma_21', 'sma_50', 'sma_55', 'sma_89', 'sma_150', 'sma_200', 'sma_233',
  'rsi_14', 'rsi_9', 'mfi_14',
  'atr_10', 'atr_14', 'supertrend', 'supertrend_dir',
  'obv', 'obv_sma_20', 'rvol', 'tvol',
  'magic_rs', 'magic_rs_sma144', 'magic_ma', 'magic_rs_zone',
  'sniper_inst', 'sniper_hot', 'sniper_rsi',
  'rss_value', 'rss_rsi', 'rss_spread',
  'pivot_pp', 'pivot_r1', 'pivot_r2', 'pivot_r3', 'pivot_s1', 'pivot_s2', 'pivot_s3',
  'chartink_emd_pct', 'chartink_emd_ok', 'chartink_ca_pct', 'chartink_ca_ok', 'chartink_vmac_ok', 'chartink_score',
  'dot_svd', 'dot_sbd', 'dot_syd',
  'swing_high', 'swing_low',
  'flow_type', 'vacuum_flag', 'accum_distrib', 'volume_divergence_flag',
  'score_5d', 'score_22d',
].join(',');

export interface IndicatorRow {
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  // EMAs
  ema_20: number | null;
  ema_60: number | null;
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
  rss_spread: number | null;
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
  volume_divergence_flag: string | null;
  // Money-flow conviction (owner doctrine: scores lead)
  score_5d: number | null;
  score_22d: number | null;
  delivery_surge_x?: number | null;
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

export type EquityTimeframe = 'daily' | 'weekly' | 'monthly';

/** Weekly/monthly bars for the Study cockpit's D/W/M toggle (Phase 2.3).
 *  km_equity_weekly/monthly carry trade_date (= period end), OHLCV, and
 *  avg_deliv_pct — mapped to delivery_pct so the volume shading and hover
 *  legend work unchanged. Indicator columns don't exist at these
 *  timeframes; the chart's line loops skip missing values gracefully. */
export async function fetchEquityTimeframeById(
  equityId: number,
  tf: 'weekly' | 'monthly',
): Promise<IndicatorRow[]> {
  const table = tf === 'weekly' ? 'km_equity_weekly' : 'km_equity_monthly';
  const { data, error } = await from(table)
    .select('trade_date,open,high,low,close,volume,avg_deliv_pct')
    .eq('equity_id', equityId)
    .order('trade_date', { ascending: true })
    .limit(3000)
    .execute();
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Record<string, unknown>>)
    .filter((r) => r.trade_date != null && r.close != null)
    .map((r) => ({ ...r, delivery_pct: r.avg_deliv_pct ?? null })) as unknown as IndicatorRow[];
}

/** Client-side W/M resampling for instruments WITHOUT aggregate tables
 *  (indices — km_index_weekly/monthly don't exist; equity uses the DB
 *  tables). Standard OHLCV rules: first open, max high, min low, last
 *  close, summed volume; bar dated at the period's last session.
 *  Indicator columns are period-undefined and left null. */
export function resampleRows(rows: IndicatorRow[], tf: 'weekly' | 'monthly'): IndicatorRow[] {
  const keyOf = (d: string): string => {
    if (tf === 'monthly') return d.slice(0, 7);
    // ISO week key
    const dt = new Date(d + 'T00:00:00');
    const day = (dt.getDay() + 6) % 7; // Mon=0
    const thursday = new Date(dt);
    thursday.setDate(dt.getDate() - day + 3);
    const jan1 = new Date(thursday.getFullYear(), 0, 1);
    const week = 1 + Math.round(((thursday.getTime() - jan1.getTime()) / 86400000 - 3 + ((jan1.getDay() + 6) % 7)) / 7);
    return `${thursday.getFullYear()}-W${String(week).padStart(2, '0')}`;
  };

  const out: IndicatorRow[] = [];
  let cur: IndicatorRow | null = null;
  let curKey = '';
  for (const r of rows) {
    if (r.open == null || r.close == null) continue;
    const k = keyOf(r.trade_date);
    if (k !== curKey) {
      if (cur) out.push(cur);
      curKey = k;
      cur = { ...EMPTY_INDICATORS, trade_date: r.trade_date, open: r.open, high: r.high, low: r.low, close: r.close, volume: r.volume ?? 0 } as IndicatorRow;
    } else if (cur) {
      cur.high = Math.max(cur.high, r.high);
      cur.low = Math.min(cur.low, r.low);
      cur.close = r.close;
      cur.trade_date = r.trade_date;
      cur.volume = (cur.volume ?? 0) + (r.volume ?? 0);
    }
  }
  if (cur) out.push(cur);
  return out;
}

// All-null indicator fields for resampled bars
const EMPTY_INDICATORS = Object.freeze(
  Object.fromEntries(INDICATOR_COLS.split(',').map((c) => [c, null])),
) as Partial<IndicatorRow>;

// Symbol shorthand → km_index_symbols.name mapping
const INDEX_SHORTHAND: Record<string, string> = {
  NIFTY50:   'NIFTY 50',
  NIFTY:     'NIFTY 50',
  BANKNIFTY: 'NIFTY BANK',
  NIFTYIT:   'NIFTY IT',
  NIFTYFMCG: 'NIFTY FMCG',
}

/** Resolve a symbol string to its numeric DB id and instrument type. */
export async function resolveInstrumentId(
  symbol: string,
): Promise<{ id: number; type: 'index' | 'equity' } | null> {
  const upper = symbol.toUpperCase()
  const indexName = INDEX_SHORTHAND[upper]

  if (indexName) {
    const { data } = await from('km_index_symbols')
      .select('id')
      .eq('name', indexName)
      .maybeSingle()
      .execute()
    if (data) return { id: (data as { id: number }).id, type: 'index' }
  }

  const { data } = await from('km_equity_symbols')
    .select('id')
    .eq('symbol', upper)
    .maybeSingle()
    .execute()
  if (data) return { id: (data as { id: number }).id, type: 'equity' }

  return null
}

/**
 * Resolve a symbol string to EOD indicator data.
 * Supports index shorthands (NIFTY50, BANKNIFTY…) and NSE equity ticker symbols.
 */
export async function fetchInstrumentEod(symbol: string, range: TimeRange): Promise<IndicatorRow[]> {
  const upper = symbol.toUpperCase()
  const indexName = INDEX_SHORTHAND[upper]

  if (indexName) {
    const { data: sym } = await from('km_index_symbols')
      .select('id')
      .eq('name', indexName)
      .maybeSingle()
      .execute()
    if (sym) return fetchIndicatorDataById((sym as { id: number }).id, range)
  }

  const { data: eq } = await from('km_equity_symbols')
    .select('id')
    .eq('symbol', upper)
    .maybeSingle()
    .execute()
  if (eq) return fetchEquityEodById((eq as { id: number }).id, range)

  return []
}

/** Fetch full indicator data for an equity by its DB id (used by /chart/equity/:id).
 *  Same columns as index fetch — TradingChart renders SMA overlays, dots,
 *  RSI, Sniper Dragon, and MagicRS panes. */
export async function fetchEquityEodById(
  equityId: number,
  range: TimeRange,
): Promise<IndicatorRow[]> {
  const startDate = getStartDate(range);
  // Equity-only extras (NOT in shared INDICATOR_COLS — km_index_eod lacks the
  // delivery columns): the Study cockpit's stat strip + Delivery-vs-Traded
  // widget read these.
  const EQUITY_EXTRA_COLS = 'pct_chng,value_cr,delivery_pct,delivery_qty,deliv_value_cr,ret_5d,ret_22d,ret_66d,w52_high,w52_low,delivery_surge_x';
  const cols = `trade_date,open,high,low,close,volume,${INDICATOR_COLS},${EQUITY_EXTRA_COLS}`;

  let query = from('km_equity_eod')
    .select(cols)
    .eq('equity_id', equityId)
    .order('trade_date', { ascending: true })
    .limit(10000);

  if (startDate) {
    query = query.gte('trade_date', startDate);
  }

  const { data, error } = await query.execute();
  if (error) throw new Error(error.message);

  return (data ?? []) as IndicatorRow[];
}
