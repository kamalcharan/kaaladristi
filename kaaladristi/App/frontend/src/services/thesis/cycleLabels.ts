/**
 * Shared cycle-label builders for setup adapters.
 *
 * Every preset's Story View wants the same regime bands (the vertical
 * "OLD STAGE 2 / LONG STAGE 1 / NEW STAGE 2" chapters). Two paths:
 *
 *   1. Stage-walk — label contiguous runs of km_equity_eod.stage
 *      (stamped onto weekly bars by useSetupData).
 *   2. Price-shape fallback — stage is NULL for ~15% of the universe,
 *      concentrated in exactly the stocks scanners surface (the
 *      classifier stamps forward from when it first ran, so base years
 *      are unclassified). Derives regimes from price shape alone.
 *
 * Extracted from adapters/stage2.ts when adapter #2 landed, per the POA
 * reuse rule. Do not fork this logic into individual adapters.
 */

import type { CycleLabel, WeeklyBar } from './setupAdapter';

const MIN_S2_RUN_WEEKS = 26;
const MIN_S4_RUN_WEEKS = 20;
const MIN_S1_RUN_WEEKS = 26;

const STAGE_LABEL_RULES: Record<string, { label: string; tone: 'bull' | 'bear' | 'neutral'; minWeeks: number }> = {
  'S1':           { label: 'Long Stage 1 Re-accumulation', tone: 'neutral', minWeeks: MIN_S1_RUN_WEEKS },
  'S1_CANDIDATE': { label: 'Basing (Stage 1 Candidate)',   tone: 'neutral', minWeeks: MIN_S1_RUN_WEEKS },
  'S2_CANDIDATE': { label: 'Stage 2 Breakout Attempt',     tone: 'bull',    minWeeks: 4 },
  'S2':           { label: 'Stage 2 Uptrend',              tone: 'bull',    minWeeks: MIN_S2_RUN_WEEKS },
  'S3':           { label: 'Stage 3 Topping',              tone: 'neutral', minWeeks: 12 },
  'S4':           { label: 'Stage 4 Markdown',             tone: 'bear',    minWeeks: MIN_S4_RUN_WEEKS },
};

/** Stage-walk first; price-shape fallback when stage data is missing. */
export function buildCycleLabels(weekly: WeeklyBar[]): CycleLabel[] {
  const stageBased = buildFromStage(weekly);
  if (stageBased.length > 0) return stageBased;
  return buildFromPriceShape(weekly);
}

export function buildFromStage(weekly: WeeklyBar[]): CycleLabel[] {
  if (weekly.length === 0) return [];
  const labels: CycleLabel[] = [];
  let runStart = 0;
  let runStage = weekly[0].stage ?? '';
  const emit = (from: number, to: number, stage: string) => {
    const length = to - from + 1;
    const rule = STAGE_LABEL_RULES[stage];
    if (!rule || length < rule.minWeeks) return;
    labels.push({
      from: weekly[from].trade_date,
      to:   weekly[to].trade_date,
      label: rule.label,
      tone:  rule.tone,
    });
  };
  for (let i = 1; i < weekly.length; i++) {
    const s = weekly[i].stage ?? '';
    if (s === runStage) continue;
    emit(runStart, i - 1, runStage);
    runStart = i;
    runStage = s;
  }
  emit(runStart, weekly.length - 1, runStage);
  return labels;
}

/**
 * Price-shape regime detector. Identifies (up to) four regimes:
 *   Prior Uptrend → Correction (≥18% dd) → Long Base (±20% of trough)
 *   → Recovery (decisive break above the base ceiling).
 * A regime needs ≥8 weeks to earn a band. Returns [] when the archetype
 * doesn't fit (e.g. a long steady uptrend with no correction).
 */
export function buildFromPriceShape(weekly: WeeklyBar[]): CycleLabel[] {
  const N = weekly.length;
  if (N < 40) return [];
  const closes = weekly.map((b) => b.close);
  const dates  = weekly.map((b) => b.trade_date);

  const peakSearchEnd = Math.floor(N * 0.67);
  let peakIdx = 0;
  for (let i = 0; i <= peakSearchEnd; i++) if (closes[i] > closes[peakIdx]) peakIdx = i;
  const peakPrice = closes[peakIdx];

  const troughSearchStart = peakIdx + 1;
  const troughSearchEnd   = Math.floor(N * 0.85);
  if (troughSearchEnd - troughSearchStart < 8) return [];
  let troughIdx = troughSearchStart;
  for (let i = troughSearchStart; i <= troughSearchEnd; i++) if (closes[i] < closes[troughIdx]) troughIdx = i;
  const troughPrice = closes[troughIdx];

  if (troughPrice / peakPrice > 0.82) return [];

  const baseCeiling = troughPrice * 1.20;
  let baseEnd = troughIdx;
  for (let i = troughIdx + 1; i < N; i++) {
    if (closes[i] > baseCeiling) break;
    baseEnd = i;
  }

  const labels: CycleLabel[] = [];
  const push = (from: number, to: number, label: string, tone: 'bull' | 'bear' | 'neutral') => {
    if (to - from < 8) return;
    labels.push({ from: dates[from], to: dates[to], label, tone });
  };

  push(0, peakIdx - 1, 'Old Stage 2 Uptrend', 'bull');
  push(peakIdx, troughIdx - 1, 'Old Cycle Correction', 'bear');
  push(troughIdx, baseEnd, 'Long Stage 1 Base', 'neutral');
  if (baseEnd < N - 1 && closes[N - 1] > baseCeiling) {
    push(baseEnd + 1, N - 1, 'New Stage 2 Recovery', 'bull');
  }

  return labels;
}
