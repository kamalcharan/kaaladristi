/**
 * Risk data hooks — delegates to snapshot (production) or mock (dev).
 *
 * VITE_DATA_MODE=snapshot → uses Edge Function snapshot (Phase 0)
 * VITE_DATA_MODE=mock     → uses seeded random mock data (offline dev)
 */

import { useQuery } from '@tanstack/react-query';
import { fetchDayRisk, fetchWeekRisk, fetchHistoricalProofs } from '@/services/riskData';
import {
  useSnapshotAsDayRisk,
  useSnapshotAsWeekRisk,
  useSnapshotAsHistoricalProofs,
} from './useSnapshot';
import type { MarketSymbol } from '@/types';

const DATA_MODE = import.meta.env.VITE_DATA_MODE || 'mock';

export function useDayRisk(date: string, symbol: MarketSymbol) {
  // Snapshot mode: data comes from pre-computed edge function
  const snapshotResult = useSnapshotAsDayRisk(date, symbol);

  // Mock mode: data comes from seeded random generator
  const mockResult = useQuery({
    queryKey: ['risk', 'day', date, symbol],
    queryFn: () => fetchDayRisk(date, symbol),
    staleTime: 5 * 60 * 1000,
    enabled: DATA_MODE === 'mock',
  });

  return DATA_MODE === 'snapshot' ? snapshotResult : mockResult;
}

export function useWeekRisk(startDate: string, symbol: MarketSymbol) {
  const snapshotResult = useSnapshotAsWeekRisk(startDate, symbol);

  const mockResult = useQuery({
    queryKey: ['risk', 'week', startDate, symbol],
    queryFn: () => fetchWeekRisk(startDate, symbol),
    staleTime: 5 * 60 * 1000,
    enabled: DATA_MODE === 'mock',
  });

  return DATA_MODE === 'snapshot' ? snapshotResult : mockResult;
}

export function useHistoricalProofs(symbol: MarketSymbol) {
  const snapshotResult = useSnapshotAsHistoricalProofs(symbol);

  const mockResult = useQuery({
    queryKey: ['risk', 'proofs', symbol],
    queryFn: () => fetchHistoricalProofs(symbol),
    staleTime: 5 * 60 * 1000,
    enabled: DATA_MODE === 'mock',
  });

  return DATA_MODE === 'snapshot' ? snapshotResult : mockResult;
}
