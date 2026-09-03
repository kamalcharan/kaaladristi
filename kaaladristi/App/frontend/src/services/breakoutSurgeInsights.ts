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

export interface MomentumGapFacts {
  count: number
  avgGap: number | null
  /** Up to 2 accelerating stocks, ranked by gap size — real named examples
   *  for VaNi to cite, never a curated "pick". */
  examples: { symbol: string; gap: number; score5d: number; score22d: number }[]
}

/**
 * "Momentum gap" for the scanner.momentum_gap VaNi intent — how far a
 * stock's 5-day score has pulled ahead of its own 22-day pace, among the
 * SAME accelerating cohort isAccelerating()/ScanFilterBar's `accelerating`
 * toggle already use. Deliberately not a new absolute threshold on
 * (score_5d - score_22d) — see LESSONS_LEARNED.md's threshold-calibration
 * lesson; there's no live data access at build time to calibrate a fresh
 * cutoff, so this rides on an already-shipped, already-live one instead.
 */
export function computeMomentumGapFacts(rows: ScanStock[]): MomentumGapFacts {
  const gapped = rows
    .filter(isAccelerating)
    .map((r) => ({ r, gap: (r.score_5d ?? 0) - (r.score_22d ?? 0) }))
    .sort((a, b) => b.gap - a.gap)
  const examples = gapped.slice(0, 2).map(({ r, gap }) => ({
    symbol: displaySymbol(r),
    gap,
    score5d: r.score_5d ?? 0,
    score22d: r.score_22d ?? 0,
  }))
  return {
    count: gapped.length,
    avgGap: _avg(gapped.map((x) => x.gap)),
    examples,
  }
}

export interface LeadingIndustryFacts {
  name: string
  count: number
  totalCount: number
  runnerUp: { name: string; count: number } | null
}

/**
 * For the scanner.leading_industry VaNi intent — reuses the SAME industry
 * breakdown computeCohortStats() already computes for the "Leading
 * Industry" stat tile, just also surfacing the runner-up for contrast.
 */
export function computeLeadingIndustryFacts(rows: ScanStock[]): LeadingIndustryFacts | null {
  const breakdown = industryBreakdown(rows)
  if (!breakdown.length) return null
  return {
    name: breakdown[0].name,
    count: breakdown[0].count,
    totalCount: rows.length,
    runnerUp: breakdown[1] ?? null,
  }
}

export interface SectorLeadingFacts {
  count: number
  /** Leading industries represented in today's cohort, sorted by count desc. */
  industries: { name: string; count: number }[]
}

/**
 * For the scanner.sector_leading VaNi intent ("Which sectors' stocks are
 * leading today?") — a CROSS-SCANNER signal from Sector Rotation's own
 * industry_rank (km_industry_eod), not today's in-result concentration
 * (that's computeLeadingIndustryFacts above). "Leading" reuses the exact
 * same "top quartile by industry_rank" cutoff Sector Rotation's own Leading
 * category already uses (industryRotation.ts's topQuartileCutoff) — not a
 * fresh threshold.
 */
export function computeSectorLeadingFacts(
  rows: ScanStock[],
  rankByIndustry: Map<string, number>,
  leadingCutoff: number,
): { facts: SectorLeadingFacts; isSectorLeading: (r: ScanStock) => boolean } {
  const isSectorLeading = (r: ScanStock): boolean => {
    if (!r.industry) return false
    const rank = rankByIndustry.get(r.industry)
    return rank != null && rank <= leadingCutoff
  }
  const matched = rows.filter(isSectorLeading)
  const counts = new Map<string, number>()
  for (const r of matched) {
    if (!r.industry) continue
    counts.set(r.industry, (counts.get(r.industry) ?? 0) + 1)
  }
  const industries = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
  return { facts: { count: matched.length, industries }, isSectorLeading }
}

/** Zones on the bull side of the 7-band Magic RS scale (signalScale.ts) —
 *  a stock "turns RS-green" when it crosses INTO one of these from outside
 *  them, never merely for sitting in one already. */
export const BULLISH_ZONES = ['Strong Bull', 'Mild Bull', 'Neutral Bull']

export interface DayOverDayContext {
  /** Most recent trade_date strictly before today with a snapshot row —
   *  null when no history exists yet (fresh deploy, or the very first day
   *  the scan_membership_snapshot pipeline step ran). */
  priorDate: string | null
  priorZoneByEquity: Map<number, string | null>
  /** One entry per distinct historical date (excludes today), oldest last —
   *  for the "is today unusual" count comparison. */
  countHistory: { tradeDate: string; count: number }[]
}

/**
 * Groups a flat km_scan_membership_daily row list (fetchScanMembershipHistory,
 * scanEngine.ts) into the shape the 3 day-over-day intents need. Today's own
 * membership never comes from this — it's always the live scan (`all`), to
 * avoid any timing drift between the two; this only ever supplies PRIOR days.
 */
export function buildDayOverDayContext(
  history: { trade_date: string; equity_id: number; magic_rs_zone: string | null }[],
): DayOverDayContext {
  const dates = [...new Set(history.map((r) => r.trade_date))].sort((a, b) => b.localeCompare(a))
  const priorDate = dates[0] ?? null
  const priorZoneByEquity = new Map<number, string | null>()
  if (priorDate) {
    for (const r of history) {
      if (r.trade_date === priorDate) priorZoneByEquity.set(r.equity_id, r.magic_rs_zone)
    }
  }
  const countHistory = dates.map((d) => ({
    tradeDate: d,
    count: history.filter((r) => r.trade_date === d).length,
  }))
  return { priorDate, priorZoneByEquity, countHistory }
}

export interface NewSinceYesterdayFacts {
  count: number
  priorDate: string
  examples: { symbol: string }[]
}

/**
 * For scanner.new_since_yesterday ("Show me what's new since yesterday").
 * Returns null when there's no prior-day snapshot yet — never renders as
 * "everything is new", which would be true but meaningless on day one.
 */
export function computeNewSinceYesterdayFacts(
  rows: ScanStock[],
  ctx: DayOverDayContext,
): { facts: NewSinceYesterdayFacts; isNew: (r: ScanStock) => boolean } | null {
  if (!ctx.priorDate) return null
  const isNew = (r: ScanStock): boolean => !ctx.priorZoneByEquity.has(r.equity_id)
  const matched = rows.filter(isNew)
  return {
    facts: {
      count: matched.length,
      priorDate: ctx.priorDate,
      examples: matched.slice(0, 3).map((r) => ({ symbol: displaySymbol(r) })),
    },
    isNew,
  }
}

export interface RsFlipFacts {
  count: number
  priorDate: string
  examples: { symbol: string; fromZone: string | null; toZone: string | null }[]
}

/**
 * For scanner.rs_flip ("Which stocks just turned RS-green?") — a stock
 * present both yesterday and today whose zone crossed from outside
 * BULLISH_ZONES into one of them. A stock that WASN'T in yesterday's
 * snapshot at all doesn't count as a flip (it's new_since_yesterday's
 * concern, not this one) — only equities present on both days qualify.
 */
export function computeRsFlipFacts(
  rows: ScanStock[],
  ctx: DayOverDayContext,
): { facts: RsFlipFacts; isFlip: (r: ScanStock) => boolean } | null {
  if (!ctx.priorDate) return null
  const isFlip = (r: ScanStock): boolean => {
    if (!ctx.priorZoneByEquity.has(r.equity_id)) return false
    const fromZone = ctx.priorZoneByEquity.get(r.equity_id) ?? null
    const wasBullish = !!fromZone && BULLISH_ZONES.includes(fromZone)
    const isBullishNow = !!r.magic_rs_zone && BULLISH_ZONES.includes(r.magic_rs_zone)
    return !wasBullish && isBullishNow
  }
  const matched = rows.filter(isFlip)
  return {
    facts: {
      count: matched.length,
      priorDate: ctx.priorDate,
      examples: matched.slice(0, 3).map((r) => ({
        symbol: displaySymbol(r),
        fromZone: ctx.priorZoneByEquity.get(r.equity_id) ?? null,
        toZone: r.magic_rs_zone ?? null,
      })),
    },
    isFlip,
  }
}

export interface IsUnusualFacts {
  todayCount: number
  avgCount: number
  lookbackDays: number
}

/**
 * For scanner.is_unusual ("Is today unusual compared to recent sessions?")
 * — the mockup's own example frames this as industry-concentration-of-
 * momentum-gap-stocks vs a typical session, which isn't something anything
 * stores per day; this uses the simplest REAL comparison the new snapshot
 * table actually gives us instead of a second hand-rolled historical
 * computation: today's qualifying count vs the trailing-session average.
 * Requires at least 3 prior days of history (a minimum-sample floor, not a
 * calibrated threshold) before saying anything — an "average" of 1-2 days
 * isn't a baseline. mode: none in the card (no filter/highlight applies).
 */
export function computeIsUnusualFacts(todayCount: number, ctx: DayOverDayContext): IsUnusualFacts | null {
  if (ctx.countHistory.length < 3) return null
  const avgCount = ctx.countHistory.reduce((sum, d) => sum + d.count, 0) / ctx.countHistory.length
  return { todayCount, avgCount, lookbackDays: ctx.countHistory.length }
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
