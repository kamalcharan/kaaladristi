import { from } from './postgrest';
import type { DailyPanchang, MarketBreadthDay, BreadthRocDay } from '@/types';

const PIPELINE_API = (import.meta.env.VITE_PIPELINE_API_URL?.trim() || 'http://localhost:8101');

export async function fetchPanchang(date: string): Promise<DailyPanchang | null> {
  // Try the JOIN endpoint on the pipeline API first (provides _next_name fields).
  // Fall back to PostgREST if the pipeline API is unreachable or missing the route.
  try {
    const res = await fetch(`${PIPELINE_API}/api/panchang/daily?date=${encodeURIComponent(date)}`);
    if (res.status === 404) return null;
    if (res.ok) return res.json() as Promise<DailyPanchang>;
  } catch {
    // pipeline API offline — fall through to PostgREST
  }

  const { data, error } = await from('km_daily_panchang')
    .select('*')
    .eq('date', date)
    .maybeSingle()
    .execute();
  if (error) throw new Error(`[km_daily_panchang] ${error.message}`);
  return data as DailyPanchang | null;
}

export async function fetchMarketBreadth(days = 66): Promise<MarketBreadthDay[]> {
  const { data, error } = await from('km_market_breadth')
    .select('*')
    .order('trade_date', { ascending: false })
    .limit(days)
    .execute();
  if (error) throw new Error(`[km_market_breadth] ${error.message}`);
  return ((data ?? []) as MarketBreadthDay[]).reverse();
}

export async function fetchBreadthRoc(days = 66): Promise<BreadthRocDay[]> {
  const { data, error } = await from('km_breadth_roc')
    .select('*')
    .order('trade_date', { ascending: false })
    .limit(days)
    .execute();
  if (error) throw new Error(`[km_breadth_roc] ${error.message}`);
  return ((data ?? []) as BreadthRocDay[]).reverse();
}
