/**
 * useLastTradingDate
 * ==================
 * Returns the most recent trading day on or before the given date.
 * Source of truth: km_index_eod (NIFTY 50 = index_id 1) — guaranteed
 * populated for every past trading day. Avoids coupling to
 * km_trading_calendar coverage.
 *
 * Returns:
 *   - lastTradingDate: ISO date string of most recent trading day ≤ today
 *   - isHoliday: true if today's date is NOT a trading day
 *   - isLoading: query in flight
 */

import { useQuery } from '@tanstack/react-query';
import { from } from '@/services/postgrest';

const NIFTY_50_ID = 1;

async function fetchLastTradingDate(today: string): Promise<string> {
  const { data, error } = await from('km_index_eod')
    .select('trade_date')
    .eq('index_id', NIFTY_50_ID)
    .lte('trade_date', today)
    .order('trade_date', { ascending: false })
    .limit(1)
    .execute();
  if (error) throw new Error(`Failed to fetch last trading date: ${error.message}`);
  if (!data || data.length === 0) {
    // Fall back to today; downstream queries will surface the absence.
    return today;
  }
  return String(data[0].trade_date);
}

export function useLastTradingDate(today: string) {
  const query = useQuery({
    queryKey: ['last-trading-date', today],
    queryFn: () => fetchLastTradingDate(today),
    staleTime: 60 * 60 * 1000, // 1h — trading calendar doesn't shift mid-day
  });

  const lastTradingDate = query.data ?? today;
  const isHoliday = !!query.data && query.data !== today;

  return {
    lastTradingDate,
    isHoliday,
    isLoading: query.isLoading,
  };
}
