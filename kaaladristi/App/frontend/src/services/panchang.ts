import { from, rpc } from './postgrest';
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

export async function fetchMarketBreadth(
  days = 90,
  resolution: 'daily' | 'weekly' | 'monthly' = 'daily',
): Promise<MarketBreadthDay[]> {
  const { data, error } = await rpc('get_market_breadth', {
    p_days:       days,
    p_resolution: resolution,
  });
  if (error) throw new Error(`[get_market_breadth] ${error.message}`);
  return (data ?? []) as MarketBreadthDay[];
}
