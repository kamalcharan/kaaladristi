/**
 * Risk data hooks — always uses snapshot (Edge Function).
 *
 * No mock fallback. If the Edge Function is unreachable or returns
 * an error, React Query surfaces the error to the UI so the user
 * sees a clear failure message instead of misleading fake data.
 */

import {
  useSnapshotAsDayRisk,
  useSnapshotAsWeekRisk,
  useSnapshotAsHistoricalProofs,
} from './useSnapshot';
import type { MarketSymbol } from '@/types';

export function useDayRisk(date: string, symbol: MarketSymbol) {
  return useSnapshotAsDayRisk(date, symbol);
}

export function useWeekRisk(startDate: string, symbol: MarketSymbol) {
  return useSnapshotAsWeekRisk(startDate, symbol);
}

export function useHistoricalProofs(symbol: MarketSymbol) {
  return useSnapshotAsHistoricalProofs(symbol);
}
