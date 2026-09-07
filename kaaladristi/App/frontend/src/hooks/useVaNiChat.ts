/**
 * VaNi Conversational Layer — React hooks
 *
 * useVaNiAsk()          — mutation to ask a VaNi intent question
 */

import { useMutation } from '@tanstack/react-query';

const pipelineUrl =
  (import.meta.env.VITE_PIPELINE_API_URL as string) ?? '';

// ── Types ────────────────────────────────────────────────────────────────────

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
  // scanner.why_highlighted_weakness only — the caution-side twin, for the
  // presets whose vani_rule is is_vani_weakness (computeWeaknessExplainFacts).
  // A separate field rather than a reshaped highlight_facts: the server
  // sanitizes each fact payload against a fixed key set, and the two rules
  // measure different things (no 52-week-high term here; zone/flow mix
  // instead), so one loose shape would silently drop half of whichever side
  // it wasn't written for.
  weakness_facts?: {
    count: number;
    avg_rvol: number | null;
    avg_magic_rs: number | null;
    zone_mix: Array<{ label: string; count: number }>;
    flow_mix: Array<{ label: string; count: number }>;
    examples: Array<{ symbol: string; rvol: number | null; magic_rs: number | null; zone: string; flow: string }>;
  };
  // scanner.why_highlighted_gl only — the Golden Line pair (vani_rule
  // gl_event_any, computeGlExplainFacts). Its own field for the same reason
  // weakness_facts has one: the server sanitizes against a fixed key set.
  gl_facts?: {
    count: number;
    event: 'BREAKOUT' | 'RETEST';
    avg_pct_from_gl: number | null;
    avg_days_above: number | null;
    avg_rvol: number | null;
    examples: Array<{ symbol: string; pct_from_gl: number | null; days_above: number | null; rvol: number | null }>;
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
  // Phase 3 (km_scan_membership_daily) — computeNewSinceYesterdayFacts() /
  // computeRsFlipFacts() / computeIsUnusualFacts(), breakoutSurgeInsights.ts.
  new_since_yesterday_facts?: {
    count: number;
    prior_date: string;
    examples: Array<{ symbol: string }>;
  };
  rs_flip_facts?: {
    count: number;
    prior_date: string;
    examples: Array<{ symbol: string; from_zone: string | null; to_zone: string | null }>;
  };
  is_unusual_facts?: {
    today_count: number;
    avg_count: number;
    lookback_days: number;
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
