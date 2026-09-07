import type { ScanStock } from '@/types'
import { displaySymbol } from '@/lib/symbolUtils'
import { zoneLabel, flowLabel } from '@/constants/signalScale'

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

/**
 * The STRENGTH-side pace predicate: the 5-day score is positive and at or
 * ahead of the stock's own 22-day pace.
 *
 * Kept as the default so every existing caller behaves exactly as before, but
 * the pace test is now injectable — a weakness scan measures the mirror, and
 * running this one over a decliners cohort would report "accelerating" for
 * stocks that are doing the opposite. The per-preset predicate lives in
 * config/scannerStudio.ts.
 */
export function isAccelerating(r: ScanStock): boolean {
  return (r.score_5d ?? 0) > 0 && (r.score_5d ?? 0) >= (r.score_22d ?? 0)
}

/**
 * The CAUTION-side mirror: the 5-day score is negative and at or BELOW the
 * stock's own 22-day pace — the recent stretch is worse than the medium-term
 * one. Deliberately not called "slowing": on a decliners cohort a 5-day score
 * below the 22-day pace means the move is steepening, and "slowing" would
 * read as the opposite. The descriptor labels this tile with D39's
 * `contracting`, which is the approved word for a shrinking measure.
 */
export function isDecelerating(r: ScanStock): boolean {
  return (r.score_5d ?? 0) < 0 && (r.score_5d ?? 0) <= (r.score_22d ?? 0)
}

export type PacePredicate = (r: ScanStock) => boolean

/**
 * How far a row sits from its own recent pace, as a POSITIVE distance on
 * either side. Strength reads `score_5d - score_22d` (ahead of its pace);
 * caution reads the negation (behind it). Both sort descending on the same
 * "furthest from its own pace first" rule, which is why this is a function
 * on the descriptor rather than a sign flip at each call site.
 */
export type GapFn = (r: ScanStock) => number

export const gapAhead: GapFn = (r) => (r.score_5d ?? 0) - (r.score_22d ?? 0)
export const gapBehind: GapFn = (r) => (r.score_22d ?? 0) - (r.score_5d ?? 0)

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

export function computeCohortStats(
  rows: ScanStock[],
  pace: PacePredicate = isAccelerating,
): CohortStats {
  const total = rows.length
  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));

  return {
    brokeOutCount: total,
    highlightCount: rows.filter(isHighlight).length,
    acceleratingPct: pct(rows.filter(pace).length),
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

export interface WeaknessExplainFacts {
  count: number
  avgRvol: number | null
  avgMagicRs: number | null
  /** Composition of the highlighted cohort across the two dimensions the
   *  rule actually gates on, carried as DISPLAY labels (Weakening/Lagging,
   *  Fresh Shorts/Long Liquidation) so no raw DB value can reach a prompt. */
  zoneMix: { label: string; count: number }[]
  flowMix: { label: string; count: number }[]
  examples: { symbol: string; rvol: number | null; magicRs: number | null; zone: string; flow: string }[]
}

function _mix(rows: ScanStock[], pick: (r: ScanStock) => string | null): { label: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const r of rows) {
    const label = pick(r)
    if (!label) continue
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
}

/**
 * The CAUTION-side twin of computeHighlightExplainFacts, for the presets whose
 * vani_rule is `is_vani_weakness` (weekly_decliners, monthly_decliners,
 * breakdown_watch).
 *
 * It exists because the strength builder must NOT be reused here: its own
 * docstring says it is grounded in what `is_vani_surge_or_breakout` measures,
 * and `avgPctOf52wHigh` on a decliners cohort is a confidently wrong answer
 * rather than a degraded one.
 *
 * What `is_vani_weakness` actually gates on (backfill_vani_flags.py, read
 * 2026-09-06 — this list IS the bar, nothing else):
 *
 *     magic_rs_zone IN ('Strong Bear', 'Mild Bear')
 *     AND flow_type IN ('FRESH_SHORTS', 'LONG_LIQUIDATION')
 *     AND rvol > 1.5
 *     AND magic_rs < -10
 *
 * So the facts are the four terms of that rule and nothing more: volume,
 * relative-strength reading, and the zone/flow composition that separates this
 * rule from every other one. The 52-week LOW is deliberately absent even
 * though it is the tidy mirror of the strength builder's 52-week high — the
 * weakness rule does not measure it, and reporting it as though it were part
 * of the bar would repeat exactly the mistake the strength docstring warns
 * against. (`is_vani_52wl` is a separate flag that no preset here uses.)
 *
 * Always computed over the FULL day's cohort, matching computeCohortStats().
 */
export function computeWeaknessExplainFacts(rows: ScanStock[]): WeaknessExplainFacts {
  const hl = rows.filter(isHighlight)
  const examples = [...hl]
    .sort((a, b) => (b.rvol ?? 0) - (a.rvol ?? 0))
    .slice(0, 2)
    .map((r) => ({
      symbol: displaySymbol(r),
      rvol: r.rvol ?? null,
      magicRs: r.magic_rs ?? null,
      zone: zoneLabel(r.magic_rs_zone).label,
      flow: flowLabel(r.flow_type).label,
    }))
  return {
    count: hl.length,
    avgRvol: _avg(hl.map((r) => r.rvol)),
    avgMagicRs: _avg(hl.map((r) => r.magic_rs)),
    zoneMix: _mix(hl, (r) => (r.magic_rs_zone ? zoneLabel(r.magic_rs_zone).label : null)),
    flowMix: _mix(hl, (r) => (r.flow_type ? flowLabel(r.flow_type).label : null)),
    examples,
  }
}

export type GlEvent = 'BREAKOUT' | 'RETEST'

export interface GlExplainFacts {
  count: number
  event: GlEvent
  /** Average close vs the Golden Line (sma_150), as a % above it. */
  avgPctFromGl: number | null
  /** Average sessions closed above the line before the bar. Meaningful on a
   *  RETEST (the rule requires ≥ 10 prior sessions); on a BREAKOUT it is the
   *  crossing bar itself and reads ~1. */
  avgDaysAbove: number | null
  avgRvol: number | null
  examples: { symbol: string; pctFromGl: number | null; daysAbove: number | null; rvol: number | null }[]
}

/**
 * The third highlight-explain builder, for the two Golden Line presets whose
 * vani_rule is `gl_event_any`.
 *
 * What the rule is (backfill_gl_events.py, owner-specified):
 *
 *   BREAKOUT  prior close ≤ prior GL, this close > GL, on an SVD/SBD bar.
 *   RETEST    low ≤ GL while close > GL (touched and held), on an SVD/SBD
 *             bar, after ≥ 10 PRIOR sessions closed above the line.
 *
 * Two things follow that make this builder unlike the other two.
 *
 * Every row is a highlight. fetchGlEvents filters on `gl_event = <event>` and
 * sets vaniOpportunity true for all — the scan IS the highlight rule. So the
 * question "why did VaNi flag these" is really "what is this event", and the
 * facts describe the event's own measurements rather than pick a subset.
 *
 * No volume-signature mix, deliberately. The rule reads dot_svd/dot_sbd on
 * the bar when the event is stamped, but the dots are rewritten afterwards:
 * measured 2026-09-04, 10 of 34 BREAKOUT rows carried NEITHER dot by the
 * time the scan read them. Citing today's dots as "the signature behind the
 * move" would be wrong for a third of the cohort, so the prompt states the
 * rule's guarantee in words and the numbers here are only ones read off the
 * row as it stands: distance above the line, sessions held, RVOL.
 *
 * Examples follow the scan's own ranking — furthest above the line for a
 * breakout, longest hold for a retest — so the named stocks are the ones at
 * the top of the table the user is looking at.
 */
export function computeGlExplainFacts(rows: ScanStock[], event: GlEvent): GlExplainFacts {
  const hl = rows.filter(isHighlight)
  const ranked = [...hl].sort((a, b) => event === 'BREAKOUT'
    ? (b.pct_from_gl ?? -Infinity) - (a.pct_from_gl ?? -Infinity)
    : (b.gl_days_above ?? 0) - (a.gl_days_above ?? 0))
  return {
    count: hl.length,
    event,
    avgPctFromGl: _avg(hl.map((r) => r.pct_from_gl)),
    avgDaysAbove: _avg(hl.map((r) => r.gl_days_above)),
    avgRvol: _avg(hl.map((r) => r.rvol)),
    examples: ranked.slice(0, 2).map((r) => ({
      symbol: displaySymbol(r),
      pctFromGl: r.pct_from_gl ?? null,
      daysAbove: r.gl_days_above ?? null,
      rvol: r.rvol ?? null,
    })),
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
export function computeMomentumGapFacts(
  rows: ScanStock[],
  pace: PacePredicate = isAccelerating,
  gapOf: GapFn = gapAhead,
): MomentumGapFacts {
  // The note this replaces was right: with the strength `gap`
  // (score_5d − score_22d) a weakness cohort produces NEGATIVE gaps, so the
  // descending sort below would surface the SMALLEST divergence first — the
  // least interesting rows, presented as the most. `gapOf` is what fixes it:
  // caution passes gapBehind, so both sides sort "furthest from its own pace
  // first" and `avgGap` is a positive distance on either side.
  const gapped = rows
    .filter(pace)
    .map((r) => ({ r, gap: gapOf(r) }))
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

/** The bear-side mirror, same 7-band scale. Displayed via signalScale's
 *  ZONE_LABELS as Weakening / Lagging — the raw DB values are never shown.
 *  'Neutral Bear' is included for the same reason 'Neutral Bull' is on the
 *  other side: the pipeline emits a 7-band scheme and a consumer that knows
 *  only 5 blanks ~47% of the universe (CLAUDE.md's MagicRS zone note). */
export const BEARISH_ZONES = ['Strong Bear', 'Mild Bear', 'Neutral Bear']

export type FlipInto = 'bullish' | 'bearish'

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
  /** fromZone/toZone are DISPLAY labels (ZONE_LABELS), never the raw DB
   *  values. The prompt instructs the model to print these verbatim, and the
   *  raw scale is spelled Strong Bull / Strong Bear — sending those made the
   *  narration say "bull"/"bear" outright, which D39 forbids in any displayed
   *  label. Mapping here fixes it for both sides at the source. */
  examples: { symbol: string; fromZone: string | null; toZone: string | null }[]
}

/**
 * For scanner.rs_flip — a stock present both yesterday and today whose zone
 * crossed from OUTSIDE the target side INTO it. A stock that WASN'T in
 * yesterday's snapshot at all doesn't count as a flip (it's
 * new_since_yesterday's concern, not this one) — only equities present on
 * both days qualify.
 *
 * `into` picks the side, because on a decliners scan the meaningful crossing
 * is the opposite one: the same "crossed in from outside" test, run against
 * BEARISH_ZONES. Defaults to the shipped bullish behaviour so every existing
 * caller is unchanged.
 */
export function computeRsFlipFacts(
  rows: ScanStock[],
  ctx: DayOverDayContext,
  into: FlipInto = 'bullish',
): { facts: RsFlipFacts; isFlip: (r: ScanStock) => boolean } | null {
  if (!ctx.priorDate) return null
  const target = into === 'bullish' ? BULLISH_ZONES : BEARISH_ZONES
  const isFlip = (r: ScanStock): boolean => {
    if (!ctx.priorZoneByEquity.has(r.equity_id)) return false
    const fromZone = ctx.priorZoneByEquity.get(r.equity_id) ?? null
    const wasInside = !!fromZone && target.includes(fromZone)
    const isInsideNow = !!r.magic_rs_zone && target.includes(r.magic_rs_zone)
    return !wasInside && isInsideNow
  }
  const matched = rows.filter(isFlip)
  return {
    facts: {
      count: matched.length,
      priorDate: ctx.priorDate,
      examples: matched.slice(0, 3).map((r) => {
        const from = ctx.priorZoneByEquity.get(r.equity_id) ?? null
        return {
          symbol: displaySymbol(r),
          fromZone: from ? zoneLabel(from).label : null,
          toZone: r.magic_rs_zone ? zoneLabel(r.magic_rs_zone).label : null,
        }
      }),
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

