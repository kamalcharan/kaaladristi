/**
 * useIntraday — composite data hook for the Intraday page
 * ========================================================
 * Fetches everything the page needs given a (possibly fallback) date:
 *   - Panchang row (km_daily_panchang via /api/panchang/daily)
 *     incl. the M072 columns: rahu_kala_start/end, abhijit_start/end,
 *     yoga_end_ist, yoga_end_next_day
 *   - Plan score (/api/intraday/plan-score) — Cycle 1 endpoint
 *   - Astro daily signal (/api/astro/daily-signal) — net_signal +
 *     turning_date drive session quality derivation in Cycle 3
 *
 * Conflict engine + confluence math land in Cycle 4.
 */

import { useQuery } from '@tanstack/react-query';

const API_BASE = import.meta.env.VITE_PIPELINE_API_URL ?? '';

interface PanchangDailyResponse {
  date: string;
  vara: string;
  vara_lord: string;
  tithi_name: string;
  tithi_base_name: string | null;
  paksha: string;
  nakshatra_name: string;
  nakshatra_lord: string | null;
  yoga_name: string | null;
  karana_name: string | null;
  moon_sign_name: string | null;
  is_ekadashi: boolean;
  is_purnima: boolean;
  is_amavasya: boolean;
  dlnl_match: boolean;
  hemisphere_event: string | null;
  sunrise_ist: string | null;
  sunset_ist: string | null;
  // M072 columns
  rahu_kala_start: string | null;
  rahu_kala_end: string | null;
  abhijit_start: string | null;
  abhijit_end: string | null;
  yoga_end_ist: string | null;
  yoga_end_next_day: boolean;
  // Auxiliary
  is_trading_day: boolean | null;
  signals: Array<Record<string, unknown>>;
  summary: {
    total_signals: number;
    bullish: number;
    bearish: number;
    volatile: number;
    turning: number;
    neutral: number;
    avg_confidence: number | null;
  };
}

interface PlanScoreResponse {
  date: string;
  plan_raw: number;
  contributing_rules: number;
  normalizer: number | null;
  plan_score: number;
  calibrated_at: string | null;
  is_calibrated: boolean;
}

interface AstroDailySignalResponse {
  trade_date: string;
  net_signal: string | null;
  net_score: number | null;
  turning_date: boolean;
  active_event_count: number;
  primary_event: string | null;
  secondary_event: string | null;
  active_events: Array<{
    id: number;
    display_name: string;
    market_impact: string;
    start_date: string;
    end_date: string | null;
  }>;
}

async function fetchPanchang(date: string): Promise<PanchangDailyResponse> {
  const url = `${API_BASE}/api/panchang/daily?date=${date}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Panchang fetch failed: ${res.status}`);
  return res.json();
}

async function fetchPlanScore(date: string): Promise<PlanScoreResponse> {
  const url = `${API_BASE}/api/intraday/plan-score?date=${date}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Plan score fetch failed: ${res.status}`);
  return res.json();
}

async function fetchAstroSignal(date: string): Promise<AstroDailySignalResponse | null> {
  const url = `${API_BASE}/api/astro/daily-signal?date=${date}`;
  const res = await fetch(url);
  if (res.status === 404) return null; // no signal computed yet — not an error
  if (!res.ok) throw new Error(`Astro signal fetch failed: ${res.status}`);
  return res.json();
}

export function useIntraday(date: string | null) {
  const panchangQuery = useQuery({
    queryKey: ['intraday-panchang', date],
    queryFn: () => fetchPanchang(date!),
    staleTime: 30 * 60 * 1000,
    enabled: !!date,
  });

  const planScoreQuery = useQuery({
    queryKey: ['intraday-plan-score', date],
    queryFn: () => fetchPlanScore(date!),
    staleTime: 30 * 60 * 1000,
    enabled: !!date,
  });

  const astroQuery = useQuery({
    queryKey: ['intraday-astro-signal', date],
    queryFn: () => fetchAstroSignal(date!),
    staleTime: 30 * 60 * 1000,
    enabled: !!date,
  });

  return {
    panchang: panchangQuery.data ?? null,
    planScore: planScoreQuery.data ?? null,
    astroSignal: astroQuery.data ?? null,
    isLoading:
      panchangQuery.isLoading ||
      planScoreQuery.isLoading ||
      astroQuery.isLoading,
    error: panchangQuery.error || planScoreQuery.error || astroQuery.error,
  };
}

export type {
  PanchangDailyResponse,
  PlanScoreResponse,
  AstroDailySignalResponse,
};
