import { useQuery } from '@tanstack/react-query';
import { fetchDayRisk, fetchWeekRisk, fetchHistoricalProofs } from '@/services/riskData';
import type { MarketSymbol } from '@/types';

export function useDayRisk(date: string, symbol: MarketSymbol) {
  return useQuery({
    queryKey: ['risk', 'day', date, symbol],
    queryFn: () => fetchDayRisk(date, symbol),
    staleTime: 5 * 60 * 1000,
  });
}

export function useWeekRisk(startDate: string, symbol: MarketSymbol) {
  return useQuery({
    queryKey: ['risk', 'week', startDate, symbol],
    queryFn: () => fetchWeekRisk(startDate, symbol),
    staleTime: 5 * 60 * 1000,
  });
}

export function useHistoricalProofs(symbol: MarketSymbol) {
  return useQuery({
    queryKey: ['risk', 'proofs', symbol],
    queryFn: () => fetchHistoricalProofs(symbol),
    staleTime: 5 * 60 * 1000,
  });
}
