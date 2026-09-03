/**
 * VaNi Conversational Layer — React hooks
 *
 * useVaNiIntents(page)  — fetch available intents for the current page
 * useVaNiAsk()          — mutation to ask a VaNi intent question
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import type { VaNiPage } from '@/config/vaniIntents';

const pipelineUrl =
  (import.meta.env.VITE_PIPELINE_API_URL as string) ?? '';

// ── Types ────────────────────────────────────────────────────────────────────

export interface VaNiIntentItem {
  intent_id: string;
  label: string;
  page: string;
}

export interface VaNiAskRequest {
  intent_id: string;
  date?: string;
  entity_type?: 'equity' | 'index';
  entity_id?: number;
  page_context?: string;
  // Scanner intents (scanner.*) — display context: the exact filtered
  // result view the user sees. Rows use on-screen vocabulary only.
  preset_id?: string;
  total_count?: number;
  rows?: Array<{
    symbol: string;
    industry: string | null;
    zone: string | null;
    flow: string | null;
    rsi: number | null;
    rvol: number | null;
    pct_chng: number | null;
    surge: number | null;
    vani: boolean;
  }>;
  data_date?: string;
  timeframe?: string;
  exchange?: string;
  // Tier A (scannerenhancement.md) — precomputed facts over the FULL result
  // set, not the capped `rows` sample above. Optional.
  cohort_stats?: {
    vani_highlight_count: number;
    accelerating_pct: number;
    real_volume_pct: number;
    leading_industry: string | null;
    leading_industry_count: number | null;
  };
  // scanner.your_view only — computed client-side (the user's own watchlist
  // store, score_5d - score_22d over the visible rows). Optional.
  bookmarked_symbols?: string[];
  top_accelerators?: Array<{ symbol: string; delta: number }>;
  // scanner.why_highlighted only — real facts over the full day's
  // VaNi-highlighted cohort (computeHighlightExplainFacts, breakoutSurgeInsights.ts).
  highlight_facts?: {
    count: number;
    avg_rvol: number | null;
    avg_pct_of_52w_high: number | null;
    avg_magic_rs: number | null;
    examples: Array<{ symbol: string; rvol: number | null; pct_of_52w_high: number | null; magic_rs: number | null }>;
  };
  // scanner.momentum_gap only — computeMomentumGapFacts(), breakoutSurgeInsights.ts.
  momentum_gap_facts?: {
    count: number;
    avg_gap: number | null;
    examples: Array<{ symbol: string; gap: number; score_5d: number; score_22d: number }>;
  };
  // scanner.leading_industry only — computeLeadingIndustryFacts(), breakoutSurgeInsights.ts.
  leading_industry_facts?: {
    name: string;
    count: number;
    total_count: number;
    runner_up: { name: string; count: number } | null;
  };
  // scanner.sector_leading only — computeSectorLeadingFacts(), breakoutSurgeInsights.ts.
  sector_leading_facts?: {
    count: number;
    industries: Array<{ name: string; count: number }>;
  };
}

export interface VaNiAskResponse {
  intent_id: string;
  date?: string;
  response: string | null;
  ai: boolean;
  cached: boolean;
  provider: string | null;
  log_id?: string | null;
  error?: string;
}

// ── Hooks ────────────────────────────────────────────────────────────────────

export function useVaNiIntents(page: VaNiPage) {
  return useQuery({
    queryKey: ['vani_intents', page],
    queryFn: async (): Promise<VaNiIntentItem[]> => {
      const res = await fetch(
        `${pipelineUrl}/api/vani/intents?page=${encodeURIComponent(page)}`,
      );
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });
}

export function useVaNiAsk() {
  return useMutation({
    mutationFn: async (req: VaNiAskRequest): Promise<VaNiAskResponse> => {
      const res = await fetch(`${pipelineUrl}/api/vani/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
      if (!res.ok) {
        return {
          intent_id: req.intent_id,
          response: null,
          ai: false,
          cached: false,
          provider: null,
          error: `HTTP ${res.status}`,
        };
      }
      return res.json();
    },
  });
}
