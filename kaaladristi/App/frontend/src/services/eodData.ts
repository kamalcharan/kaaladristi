import { supabase } from './supabase';
import type { MarketSymbol, KmIndexSymbol, KmIndexEod, ChartDataPoint, IndexStats, TimeRange } from '@/types';
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
    case 'MAX': return null; // no filter
  }
}

export async function fetchIndexSymbol(symbol: MarketSymbol): Promise<KmIndexSymbol | null> {
  const name = SYMBOL_TO_INDEX_NAME[symbol];
  const { data, error } = await supabase
    .from('km_index_symbols')
    .select('*')
    .ilike('name', name)
    .limit(1)
    .single();

  if (error) {
    console.warn(`[fetchIndexSymbol] ${name}: ${error.message}`);
    return null;
  }
  return data as KmIndexSymbol;
}

export async function fetchIndexEod(
  indexId: number,
  range: TimeRange,
): Promise<KmIndexEod[]> {
  const startDate = getStartDate(range);

  let query = supabase
    .from('km_index_eod')
    .select('id,index_id,trade_date,open,high,low,close,prev_close,chng,pct_chng,volume')
    .eq('index_id', indexId)
    .order('trade_date', { ascending: true });

  if (startDate) {
    query = query.gte('trade_date', startDate);
  }

  const { data, error } = await query;
  if (error) throw new Error(`[km_index_eod] ${error.message}`);
  return (data ?? []) as KmIndexEod[];
}

export async function fetchIndexChartData(
  symbol: MarketSymbol,
  range: TimeRange,
): Promise<{ chartData: ChartDataPoint[]; stats: IndexStats | null }> {
  const index = await fetchIndexSymbol(symbol);
  if (!index) return { chartData: [], stats: null };

  const eod = await fetchIndexEod(index.id, range);
  if (eod.length === 0) return { chartData: [], stats: null };

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
}
