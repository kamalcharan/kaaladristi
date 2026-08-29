import type { ScanStock } from '@/types'

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

function isAccelerating(r: ScanStock): boolean {
  return (r.score_5d ?? 0) > 0 && (r.score_5d ?? 0) >= (r.score_22d ?? 0)
}

export function isHighlight(r: ScanStock): boolean {
  return !!(r.is_vani_surge || r.is_vani_breakout)
}

export function computeCohortStats(rows: ScanStock[]): CohortStats {
  const total = rows.length
  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100))

  const industryCounts = new Map<string, number>()
  for (const r of rows) {
    if (!r.industry) continue
    industryCounts.set(r.industry, (industryCounts.get(r.industry) ?? 0) + 1)
  }
  let leadingIndustry: CohortStats['leadingIndustry'] = null
  for (const [name, count] of industryCounts) {
    if (!leadingIndustry || count > leadingIndustry.count) leadingIndustry = { name, count }
  }

  return {
    brokeOutCount: total,
    highlightCount: rows.filter(isHighlight).length,
    acceleratingPct: pct(rows.filter(isAccelerating).length),
    realVolumePct: pct(rows.filter((r) => (r.rvol ?? 0) > 3).length),
    leadingIndustry,
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
  if (r.is_vani_breakout) tags.push('Above 50 & 150-day trend')
  if (isAccelerating(r)) tags.push('Accelerating vs 22D pace')
  if (r.industry) tags.push(r.industry)
  return tags
}
