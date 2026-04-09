import { from } from './postgrest';
import type { DailyPanchang, MarketBreadthDay } from '@/types';

export async function fetchPanchang(date: string): Promise<DailyPanchang | null> {
  const { data, error } = await from('km_daily_panchang')
    .select('*')
    .eq('date', date)
    .maybeSingle()
    .execute();
  if (error) throw new Error(`[km_daily_panchang] ${error.message}`);
  return data as DailyPanchang | null;
}

export async function fetchMarketBreadth(days = 60): Promise<MarketBreadthDay[]> {
  const { data, error } = await from('km_market_breadth')
    .select('*')
    .order('trade_date', { ascending: false })
    .limit(days)
    .execute();
  if (error) throw new Error(`[km_market_breadth] ${error.message}`);
  // Return in ascending order for chart
  return ((data ?? []) as MarketBreadthDay[]).reverse();
}
