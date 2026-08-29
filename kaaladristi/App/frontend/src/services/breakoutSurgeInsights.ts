import type { ScanStock } from '@/types'
import { displaySymbol } from '@/lib/symbolUtils'

/**
 * Phase 1/2-Tier-A computed facts for the Breakout Surge preview — pure
 * functions over the real, full fetched result set (never a sample), no LLM
 * call. This is the "compute in code" half of scannerenhancement.md's
 * "compute in code, narrate in prose" principle. Phase 2 hands these facts
 * to VaNi to phrase into prose; Phase 1 just needs them to be correct.
 */

export interface CohortStats {
  brokeOutCount: number
  highlightCount: number
  acceleratingPct: number
  realVolumePct: number
  leadingIndustry: { name: string; count: number } | null
}

export function isAccelerating(r: ScanStock): boolean {
  return (r.score_5d ?? 0) > 0 && (r.score_5d ?? 0) >= (r.score_22d ?? 0)
}

/**
 * NOT `r.is_vani_surge || r.is_vani_breakout` — those raw DB flags are
 * fetched by scanEngine.ts's breakout_surge query but only used internally
 * to compute `vaniOpportunity`; they are never copied onto the returned
 * ScanStock. Reading them here always evaluated to false (0 of 252 instead
 * of the real 15) — `vaniOpportunity` is the field that actually carries
 * the result, and it's already computed via the same is_vani_surge ||
 * is_vani_breakout rule (computeVaniOpportunity, scanEngine.ts:307-308).
 */
export function isHighlight(r: ScanStock): boolean {
  return r.vaniOpportunity
}

/** Every industry represented in the cohort, sorted by count, most first. */
export function industryBreakdown(rows: ScanStock[]): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const r of rows) {
    if (!r.industry) continue
    counts.set(r.industry, (counts.get(r.industry) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

export function computeCohortStats(rows: ScanStock[]): CohortStats {
  const total = rows.length
  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100))

  return {
    brokeOutCount: total,
    highlightCount: rows.filter(isHighlight).length,
    acceleratingPct: pct(rows.filter(isAccelerating).length),
    realVolumePct: pct(rows.filter((r) => (r.rvol ?? 0) > 3).length),
    leadingIndustry: industryBreakdown(rows)[0] ?? null,
  }
}

export interface HighlightExplainFacts {
  count: number
  avgRvol: number | null
  /** Average of (close / w52_high) × 100 among highlighted rows — how close
   *  to their own 52-week high the highlighted stocks sit, on average. */
  avgPctOf52wHigh: number | null
  avgMagicRs: number | null
  /** Up to 2 highlighted stocks, ranked by RVOL — real named examples for
   *  VaNi to cite, never a curated "pick". */
  examples: { symbol: string; rvol: number | null; pctOf52wHigh: number | null; magicRs: number | null }[]
}

function _avg(vals: (number | null | undefined)[]): number | null {
  const nums = vals.filter((v): v is number => v != null)
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null
}

function _pctOf52wHigh(r: ScanStock): number | null {
  return r.w52_high ? (r.close / r.w52_high) * 100 : null
}

/**
 * Real facts about TODAY's highlighted cohort — for the scanner.why_highlighted
 * VaNi intent, so "why are these flagged" answers with actual numbers instead
 * of a generic definition. Grounded in what `isHighlight()`/`vaniOpportunity`
 * actually measures for this preset (breakout_surge: `is_vani_surge_or_breakout`
 * — RVOL + closeness to 52-week high + RS strength; see
 * backfill_vani_flags.py's `is_vani_surge`/`is_vani_breakout` SQL for the
 * exact bar), NOT a reward-to-risk/ATR story — that mechanism belongs to a
 * different vani_rule entirely and does not apply here. Always compute over
 * the FULL day's cohort (unfiltered), matching computeCohortStats()'s scope.
 */
export function computeHighlightExplainFacts(rows: ScanStock[]): HighlightExplainFacts {
  const hl = rows.filter(isHighlight)
  const examples = [...hl]
    .sort((a, b) => (b.rvol ?? 0) - (a.rvol ?? 0))
    .slice(0, 2)
    .map((r) => ({
      symbol: displaySymbol(r),
      rvol: r.rvol ?? null,
      pctOf52wHigh: _pctOf52wHigh(r),
      magicRs: r.magic_rs ?? null,
    }))
  return {
    count: hl.length,
    avgRvol: _avg(hl.map((r) => r.rvol)),
    avgPctOf52wHigh: _avg(hl.map(_pctOf52wHigh)),
    avgMagicRs: _avg(hl.map((r) => r.magic_rs)),
    examples,
  }
}

/**
 * Deterministic "why this row" tags — the same boolean logic backfill_vani_flags.py
 * uses for is_vani_surge/is_vani_breakout (App/backend/scripts/backfill_vani_flags.py),
 * re-expressed as human-readable tags instead of a single boolean. No LLM call —
 * Phase 2 is where these facts get handed to VaNi to turn into prose.
 */
export function buildWhyTags(r: ScanStock): string[] {
  const tags: string[] = []
  if (r.w52_high != null && r.close >= r.w52_high * 0.95) tags.push('At 52W high')
  if ((r.rvol ?? 0) > 3) tags.push(`RVOL ${r.rvol!.toFixed(1)}×`)
  if (r.rsi_14 != null && r.rsi_14 < 78) tags.push('Not yet overbought')
  else if (r.rsi_14 != null) tags.push(`RSI ${r.rsi_14.toFixed(0)} — extended`)
  // Same latent bug as isHighlight() above (r.is_vani_breakout is never
  // populated on this preset's rows) — re-derived from real sma columns
  // instead of the missing flag.
  if (r.sma_50 != null && r.sma_150 != null && r.close > r.sma_50 && r.close > r.sma_150) tags.push('Above 50 & 150-day trend')
  if (isAccelerating(r)) tags.push('Accelerating vs 22D pace')
  if (r.industry) tags.push(r.industry)
  return tags
}
