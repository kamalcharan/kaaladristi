import { supabase } from './supabase';
import type { MarketSymbol, KmIndexSymbol, KmIndexEod, ChartDataPoint, IndexStats, TimeRange } from '@/types';
import { subMonths, subYears, subDays, format } from 'date-fns';

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
    case 'MAX': return null; // no filter
  }
}

export async function fetchIndexSymbol(symbol: MarketSymbol): Promise<KmIndexSymbol | null> {
  const name = SYMBOL_TO_INDEX_NAME[symbol];

  try {
    const { data, error } = await supabase
      .from('km_index_symbols')
      .select('*')
      .eq('name', name)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(`[fetchIndexSymbol] ${name}:`, error.message);
      return null;
    }
    if (!data) {
      console.warn(`[fetchIndexSymbol] No index found for "${name}". Is km_seed_masters.sql loaded?`);
    }
    return data as KmIndexSymbol | null;
  } catch (err) {
    console.error(`[fetchIndexSymbol] Network/auth error for "${name}":`, err);
    return null;
  }
}

export async function fetchIndexEod(
  indexId: number,
  range: TimeRange,
): Promise<KmIndexEod[]> {
  const startDate = getStartDate(range);

  // Supabase default limit is 1000. Use .range() to get up to 10,000 rows.
  let query = supabase
    .from('km_index_eod')
    .select('id,index_id,trade_date,open,high,low,close,prev_close,chng,pct_chng,volume')
    .eq('index_id', indexId)
    .order('trade_date', { ascending: true })
    .range(0, 9999);

  if (startDate) {
    query = query.gte('trade_date', startDate);
  }

  const { data, error } = await query;
  if (error) {
    console.error(`[fetchIndexEod] index_id=${indexId}:`, error.message);
    throw new Error(`[km_index_eod] ${error.message}`);
  }
  console.log(`[fetchIndexEod] index_id=${indexId}, range=${range}: ${data?.length ?? 0} rows`);
  return (data ?? []) as KmIndexEod[];
}

export async function fetchIndexChartData(
  symbol: MarketSymbol,
  range: TimeRange,
): Promise<{ chartData: ChartDataPoint[]; stats: IndexStats | null }> {
  console.log(`[fetchIndexChartData] Fetching ${symbol} (${range})...`);

  try {
    const index = await fetchIndexSymbol(symbol);
    if (!index) {
      console.warn(`[fetchIndexChartData] No index row for ${symbol}, falling back to mock data`);
      return generateMockChartData(symbol, range);
    }

    const eod = await fetchIndexEod(index.id, range);
    if (eod.length === 0) {
      console.warn(`[fetchIndexChartData] 0 EOD rows for ${symbol}, falling back to mock data`);
      return generateMockChartData(symbol, range);
    }

    console.log(`[fetchIndexChartData] ${eod.length} real rows for ${symbol}`);

    const chartData: ChartDataPoint[] = eod.map((r) => ({
      date: r.trade_date,
      close: r.close ?? 0,
      open: r.open ?? 0,
      high: r.high ?? 0,
      low: r.low ?? 0,
      volume: r.volume ?? 0,
    }));

    // Compute stats from the latest record
    const latest = eod[eod.length - 1];
    const prev = eod.length > 1 ? eod[eod.length - 2] : null;
    const prevClose = latest.prev_close ?? prev?.close ?? latest.close ?? 0;
    const currentClose = latest.close ?? 0;
    const change = currentClose - prevClose;
    const changePct = prevClose ? (change / prevClose) * 100 : 0;

    // 52-week high/low from data in the last ~252 trading days
    const last252 = eod.slice(-252);
    const highs = last252.map((r) => r.high ?? 0).filter(Boolean);
    const lows = last252.map((r) => r.low ?? Infinity).filter((v) => v !== Infinity);

    const stats: IndexStats = {
      currentClose,
      previousClose: prevClose,
      change: Math.round(change * 100) / 100,
      changePct: Math.round(changePct * 100) / 100,
      high52w: highs.length ? Math.max(...highs) : 0,
      low52w: lows.length ? Math.min(...lows) : 0,
      dayHigh: latest.high ?? 0,
      dayLow: latest.low ?? 0,
    };

    return { chartData, stats };
  } catch (err) {
    console.error(`[fetchIndexChartData] Error, falling back to mock:`, err);
    return generateMockChartData(symbol, range);
  }
}

// ── Mock data generator (used when Supabase data is unavailable) ──

const MOCK_BASE_PRICES: Record<MarketSymbol, number> = {
  NIFTY: 22500,
  BANKNIFTY: 48000,
  NIFTYIT: 34500,
  NIFTYFMCG: 55000,
};

function getRangeDays(range: TimeRange): number {
  switch (range) {
    case '1M':  return 22;
    case '3M':  return 65;
    case '6M':  return 130;
    case '1Y':  return 252;
    case '5Y':  return 1260;
    case 'MAX': return 2500;
  }
}

function generateMockChartData(
  symbol: MarketSymbol,
  range: TimeRange,
): { chartData: ChartDataPoint[]; stats: IndexStats } {
  const days = getRangeDays(range);
  const basePrice = MOCK_BASE_PRICES[symbol];
  const today = new Date();
  const chartData: ChartDataPoint[] = [];

  // Deterministic seed from symbol
  let seed = 0;
  for (let i = 0; i < symbol.length; i++) seed += symbol.charCodeAt(i);

  let price = basePrice * 0.85; // Start lower for uptrend effect

  for (let i = days; i >= 0; i--) {
    const date = subDays(today, i);
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends

    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const rand = (seed % 1000) / 1000 - 0.48; // Slight positive bias
    const dailyReturn = rand * 0.02;
    price = price * (1 + dailyReturn);

    const dayRange = price * 0.015;
    const open = price + (rand * dayRange * 0.3);
    const high = Math.max(open, price) + Math.abs(rand * dayRange);
    const low = Math.min(open, price) - Math.abs(rand * dayRange * 0.8);
    const volume = Math.floor(100000 + Math.abs(seed % 900000));

    chartData.push({
      date: format(date, 'yyyy-MM-dd'),
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(price * 100) / 100,
      volume,
    });
  }

  const latest = chartData[chartData.length - 1];
  const prev = chartData.length > 1 ? chartData[chartData.length - 2] : latest;
  const change = latest.close - prev.close;
  const changePct = prev.close ? (change / prev.close) * 100 : 0;

  const last252 = chartData.slice(-252);
  const stats: IndexStats = {
    currentClose: latest.close,
    previousClose: prev.close,
    change: Math.round(change * 100) / 100,
    changePct: Math.round(changePct * 100) / 100,
    high52w: Math.max(...last252.map((d) => d.high)),
    low52w: Math.min(...last252.map((d) => d.low)),
    dayHigh: latest.high,
    dayLow: latest.low,
  };

  console.log(`[Mock] Generated ${chartData.length} data points for ${symbol} (${range})`);
  return { chartData, stats };
}
