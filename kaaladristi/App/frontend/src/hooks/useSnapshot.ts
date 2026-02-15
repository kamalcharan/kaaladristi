/**
 * useSnapshot — THE core hook for Dashboard data.
 *
 * One fetch → one snapshot → powers RiskGauge, FactorCards, Outlook,
 * Panchang, Planets, Signals, Sectors, and MarketStats.
 *
 * Also provides derived hooks that extract specific sections from
 * the snapshot with ZERO additional network requests.
 */

import { useQuery } from '@tanstack/react-query';
import { fetchSnapshot, fetchCalendarMonth, fetchProofs } from '@/services/edgeFunctions';
import type {
  MarketSymbol,
  DailySnapshot,
  SnapshotRisk,
  SnapshotPanchang,
  SnapshotPlanet,
  SnapshotAspect,
  SnapshotEvent,
  SnapshotSignals,
  SnapshotSector,
  SnapshotOutlookDay,
  SnapshotMarket,
  DayRiskReport,
  WeekDay,
  HistoricalProof,
  RiskFactors,
  CalendarMonth,
  ProofsResponse,
} from '@/types';
import { getRegimeFromScore } from '@/lib/utils';
import { getDay } from 'date-fns';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ── Core snapshot hook ──

export function useSnapshot(date: string, symbol: MarketSymbol) {
  return useQuery({
    queryKey: ['snapshot', date, symbol],
    queryFn: () => fetchSnapshot(date, symbol),
    staleTime: 5 * 60 * 1000,  // 5 min
    gcTime: 30 * 60 * 1000,    // 30 min
    enabled: !!date && !!symbol,
  });
}

// ── Derived hooks (extract from snapshot, ZERO extra fetches) ──

export function useRiskFromSnapshot(date: string, symbol: MarketSymbol): SnapshotRisk | null | undefined {
  const { data } = useSnapshot(date, symbol);
  return data?.risk;
}

export function usePanchangFromSnapshot(date: string, symbol: MarketSymbol): SnapshotPanchang | null | undefined {
  const { data } = useSnapshot(date, symbol);
  return data?.panchang;
}

export function usePlanetsFromSnapshot(date: string, symbol: MarketSymbol): SnapshotPlanet[] | undefined {
  const { data } = useSnapshot(date, symbol);
  return data?.planets;
}

export function useAspectsFromSnapshot(date: string, symbol: MarketSymbol): SnapshotAspect[] | undefined {
  const { data } = useSnapshot(date, symbol);
  return data?.aspects;
}

export function useEventsFromSnapshot(date: string, symbol: MarketSymbol): SnapshotEvent[] | undefined {
  const { data } = useSnapshot(date, symbol);
  return data?.events;
}

export function useSignalsFromSnapshot(date: string, symbol: MarketSymbol): SnapshotSignals | undefined {
  const { data } = useSnapshot(date, symbol);
  return data?.signals;
}

export function useSectorsFromSnapshot(date: string, symbol: MarketSymbol): SnapshotSector[] | undefined {
  const { data } = useSnapshot(date, symbol);
  return data?.sectors;
}

export function useOutlookFromSnapshot(date: string, symbol: MarketSymbol): SnapshotOutlookDay[] | undefined {
  const { data } = useSnapshot(date, symbol);
  return data?.outlook;
}

export function useMarketFromSnapshot(date: string, symbol: MarketSymbol): SnapshotMarket | null | undefined {
  const { data } = useSnapshot(date, symbol);
  return data?.market;
}

// ── Compatibility adapters ──
// These map snapshot data to the existing DayRiskReport / WeekDay / HistoricalProof
// types so existing components (RiskGauge, FactorCard, MiniBarChart) work without changes.

/**
 * Maps snapshot risk to the existing DayRiskReport interface.
 * Drop-in replacement for the old useDayRisk() hook.
 */
export function useSnapshotAsDayRisk(date: string, symbol: MarketSymbol) {
  const query = useSnapshot(date, symbol);

  const data: DayRiskReport | undefined = query.data ? mapSnapshotToDayRisk(query.data) : undefined;

  return { ...query, data };
}

function mapSnapshotToDayRisk(s: DailySnapshot): DayRiskReport {
  const risk = s.risk;
  const score = risk?.composite_score ?? 0;
  const factors: RiskFactors = {
    structural: risk?.structural ?? 0,
    momentum: risk?.momentum ?? 0,
    volatility: risk?.volatility ?? 0,
    deception: risk?.deception ?? 0,
  };

  // Build planetary summary from actual planet data
  const retros = s.planets.filter(p => p.retrograde).map(p => p.planet);
  const exactAspects = s.aspects.filter(a => a.exact);
  const summaryParts: string[] = [];
  if (retros.length > 0) summaryParts.push(`${retros.join(', ')} retrograde`);
  if (exactAspects.length > 0) {
    const asp = exactAspects[0];
    summaryParts.push(`${asp.planet_1}-${asp.planet_2} ${asp.aspect_type}`);
  }

  // Map sectors
  const sectorImpacts = s.sectors.map(sec => ({
    sector: sec.sector,
    sensitivity: Math.round(sec.volatility_multiplier * 100 - 100),
    weight: 0, // weight not in snapshot — will be populated when index composition is loaded
  }));

  return {
    date: s.date,
    symbol: s.symbol as MarketSymbol,
    riskScore: score,
    regime: risk?.regime ?? getRegimeFromScore(score),
    explanation: risk?.explanation ?? '',
    factors,
    planetarySummary: summaryParts.join(' | ') || 'No major planetary events',
    sectorImpacts,
  };
}

/**
 * Maps snapshot outlook to the existing WeekDay[] interface.
 * Drop-in replacement for the old useWeekRisk() hook.
 */
export function useSnapshotAsWeekRisk(date: string, symbol: MarketSymbol) {
  const query = useSnapshot(date, symbol);

  const data: WeekDay[] | undefined = query.data?.outlook?.map(o => ({
    date: o.date,
    dayName: DAY_NAMES[getDay(new Date(o.date + 'T00:00:00'))],
    riskScore: o.score ?? 0,
    regime: o.regime ?? getRegimeFromScore(o.score ?? 0),
  }));

  return { ...query, data };
}

// ── Historical Proofs (via Edge Function, NOT from snapshot) ──

export function useSnapshotProofs(symbol: MarketSymbol, limit = 20) {
  return useQuery({
    queryKey: ['proofs', symbol, limit],
    queryFn: () => fetchProofs(symbol, limit),
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
  });
}

/**
 * Adapts proofs response to the existing HistoricalProof[] interface.
 */
export function useSnapshotAsHistoricalProofs(symbol: MarketSymbol) {
  const query = useSnapshotProofs(symbol);

  const data: HistoricalProof[] | undefined = query.data?.proofs?.map(p => ({
    date: p.date,
    score: p.score,
    actualReturn: p.actualReturn,
    volatility: p.volatility,
    isCorrect: p.isCorrect,
  }));

  return { ...query, data };
}

// ── Calendar (via Edge Function) ──

export function useCalendarMonth(year: number, month: number, symbol: MarketSymbol) {
  return useQuery({
    queryKey: ['calendar', year, month, symbol],
    queryFn: () => fetchCalendarMonth(year, month, symbol),
    staleTime: 30 * 60 * 1000,   // 30 min
    gcTime: 2 * 60 * 60 * 1000,  // 2 hours
    enabled: !!year && !!month,
  });
}
