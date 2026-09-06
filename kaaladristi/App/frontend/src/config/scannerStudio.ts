/**
 * Scanner Studio descriptors — what differs between one Level 2 scanner page
 * and the next.
 *
 * The Studio shell (stat tiles, quick filters, the seven VaNi intent cards,
 * filter bar, table/cards toggle, exports) is identical for every preset. What
 * is NOT identical falls into two buckets, and only the second one is real:
 *
 *   · Preset IDENTITY — name, description, universe. Already in the DB
 *     (`kd_scan_presets`, read through `getPresetMeta`). Nothing here repeats it.
 *
 *   · Preset SEMANTICS — what its cohort count means, which levels its rows
 *     carry, and above all which DIRECTION it reads in. That is what this file
 *     carries.
 *
 * DIRECTION IS THE AXIS THAT MATTERS. Two of the five new targets are strength
 * scans and share `breakout_surge`'s exact `vani_rule`
 * (`is_vani_surge_or_breakout`), so they inherit its highlight semantics
 * unchanged. Three are weakness scans on `is_vani_weakness`, where "accelerating
 * ahead of its own pace" and "at its 52-week high" are not merely less useful,
 * they are the wrong measurement — see computeHighlightExplainFacts's own
 * docstring in breakoutSurgeInsights.ts, which forbids reuse across rules.
 *
 * SEBI / D39: every user-visible string here is drawn from vocabulary the
 * platform already ships and has cleared — `ZONE_LABELS` in
 * constants/signalScale.ts (Leading / Improving / Neutral / Weakening /
 * Lagging) and the D39 badge set (expanding / slowing / turning / contracting).
 * No new directional phrasing is invented here, and none should be added.
 */

import type { ScanStock } from '@/types'
import type { ScanVariant } from '@/utils/downloadXls'
import type { VaNiAskRequest } from '@/hooks/useVaNiChat'
import {
  isAccelerating, isDecelerating, gapAhead, gapBehind, type GapFn,
  computeHighlightExplainFacts, computeWeaknessExplainFacts,
} from '@/services/breakoutSurgeInsights'

export type StudioSide = 'strength' | 'caution'

export interface StudioLevel {
  label: string
  value: (r: ScanStock) => number | null | undefined
  /** fieldConfig key for colouring, when the field has one. */
  colorKey?: string
}

export interface StudioDescriptor {
  presetId: string
  side: StudioSide

  /** Cohort-count stat tile. `breakout_surge` reads "Broke Out Today". */
  countLabel: string

  /**
   * The pace tile, and the predicate behind the `momentum_gap` intent's
   * ordering. On the strength side this is "5-day score at or ahead of the
   * 22-day pace"; on the caution side it is the mirror, and the label uses the
   * D39 participation vocabulary rather than a directional word.
   */
  paceLabel: string
  paceSub: string
  pace: (r: ScanStock) => boolean

  /**
   * The single RSI quick toggle. Strength scans filter OUT the extended names;
   * caution scans filter out the already-washed-out ones, which is the same
   * intent mirrored, not a different feature.
   */
  rsiQuick: { label: string; test: (r: ScanStock) => boolean }

  /**
   * `rs_flip` question text and which direction counts as a flip. Null hides
   * the intent entirely for presets where a zone crossing says nothing.
   */
  rsFlip: { question: string; into: 'bullish' | 'bearish' } | null

  /**
   * How far a row sits from its own recent pace, always as a POSITIVE
   * distance so both sides sort "furthest from its own pace first". Strength
   * reads score_5d − score_22d; caution reads the negation. Used by the
   * momentum_gap intent AND by the Studio's own table sort, which is why it
   * lives here rather than being flipped at each call site.
   */
  gapOf: GapFn

  /**
   * The `why_flagged` intent: which backend intent answers it, and the facts
   * to send. Both change together with the preset's `vani_rule` — a weakness
   * preset needs the weakness builder AND the prompt written for its shape,
   * and pairing them in one field makes the mismatch unrepresentable.
   */
  highlight: {
    intentId: string
    payload: (rows: ScanStock[]) => Partial<VaNiAskRequest>
  }

  /**
   * Override for the `leading_industry` question. The default reads "Which
   * industry is leading this scan?", which is accurate on a strength cohort
   * but not on a caution one — the fact underneath is only which industry has
   * the most representation, and "leading" would assert something the number
   * does not say. Omit to keep the shipped wording.
   */
  industryQuestion?: string

  /** Export file naming + the XLS column set. */
  exportName: string
  xlsVariant: ScanVariant

  /**
   * The two level columns the cards view shows in its third row. Breakout
   * shows its breakout level and distance from it; the movers show the prior
   * period close and the move since.
   */
  cardLevels: [StudioLevel, StudioLevel]

  /**
   * Short human name for the cards view — its empty state and its VaNi entity
   * pageContext. Deliberately a field rather than derived from `pageContext`
   * by string surgery, and deliberately not read from `meta.name`: the cards
   * component has no `meta`, and threading one through for a label would be a
   * worse trade than one short string here.
   */
  displayName: string
}

const STRENGTH_RSI_QUICK = {
  label: 'Not overbought',
  test: (r: ScanStock) => (r.rsi_14 ?? 0) < 70,
}

const STRENGTH_PACE = {
  paceLabel: 'Accelerating',
  paceSub: '5D ≥ 22D pace',
  pace: isAccelerating,
  gapOf: gapAhead,
}

const STRENGTH_HIGHLIGHT = {
  intentId: 'scanner.why_highlighted',
  payload: (rows: ScanStock[]): Partial<VaNiAskRequest> => {
    const f = computeHighlightExplainFacts(rows)
    return {
      highlight_facts: {
        count: f.count,
        avg_rvol: f.avgRvol,
        avg_pct_of_52w_high: f.avgPctOf52wHigh,
        avg_magic_rs: f.avgMagicRs,
        examples: f.examples.map((e) => ({
          symbol: e.symbol, rvol: e.rvol, pct_of_52w_high: e.pctOf52wHigh, magic_rs: e.magicRs,
        })),
      },
    }
  },
}

// ── The caution side ───────────────────────────────────────────────────────
// Read off what is_vani_weakness actually gates on (backfill_vani_flags.py),
// not guessed from symmetry with the strength side:
//
//     magic_rs_zone IN ('Strong Bear','Mild Bear')
//     AND flow_type IN ('FRESH_SHORTS','LONG_LIQUIDATION')
//     AND rvol > 1.5 AND magic_rs < -10
//
// Every label below comes from vocabulary the platform already ships and has
// cleared (§9.2): ZONE_LABELS' Weakening/Lagging and D39's `contracting`.
// Nothing here is invented phrasing.

const CAUTION_RSI_QUICK = {
  // 30 is the platform's own oversold bar (is_vani_oversold: rsi_14 < 30),
  // not a fresh threshold — the same discipline that made the strength
  // toggle reuse 70. A null RSI passes, mirroring the strength default.
  label: 'Not oversold',
  test: (r: ScanStock) => (r.rsi_14 ?? 100) > 30,
}

const CAUTION_PACE = {
  // NOT "Slowing": on a decliners cohort a 5-day score below the 22-day pace
  // means the move is steepening, and "slowing" would say the opposite.
  // `Contracting` is D39's approved word for a shrinking measure.
  paceLabel: 'Contracting',
  paceSub: '5D ≤ 22D pace',
  pace: isDecelerating,
  gapOf: gapBehind,
}

const CAUTION_HIGHLIGHT = {
  intentId: 'scanner.why_highlighted_weakness',
  payload: (rows: ScanStock[]): Partial<VaNiAskRequest> => {
    const f = computeWeaknessExplainFacts(rows)
    return {
      weakness_facts: {
        count: f.count,
        avg_rvol: f.avgRvol,
        avg_magic_rs: f.avgMagicRs,
        zone_mix: f.zoneMix,
        flow_mix: f.flowMix,
        examples: f.examples.map((e) => ({
          symbol: e.symbol, rvol: e.rvol, magic_rs: e.magicRs, zone: e.zone, flow: e.flow,
        })),
      },
    }
  },
}

/** Shared by all three caution presets — the crossing that matters there is
 *  into the bear side, worded in ZONE_LABELS' own terms. */
const CAUTION_RS_FLIP = {
  question: 'Which stocks just moved into Weakening or Lagging?',
  into: 'bearish' as const,
}

/** "Leading" asserts something the underlying count does not say once the
 *  cohort is a weakening one — the fact is representation. */
const CAUTION_INDUSTRY_Q = 'Which industry is most represented here?'

export const STUDIO_DESCRIPTORS: Record<string, StudioDescriptor> = {
  breakout_surge: {
    presetId: 'breakout_surge',
    side: 'strength',
    countLabel: 'Broke Out Today',
    ...STRENGTH_PACE,
    rsiQuick: STRENGTH_RSI_QUICK,
    highlight: STRENGTH_HIGHLIGHT,
    rsFlip: { question: 'Which stocks just turned RS-green?', into: 'bullish' },
    exportName: 'Breakout_Surge',
    xlsVariant: 'breakout_surge',
    cardLevels: [
      { label: 'Brk Lvl', value: (r) => r.breakout_level },
      { label: 'Brk%', value: (r) => r.pct_from_breakout, colorKey: 'pct_from_breakout' },
    ],
    displayName: 'Breakout Surge',
  },

  weekly_movers: {
    presetId: 'weekly_movers',
    side: 'strength',
    // Not "Gained This Week": the scan's own gate is close > prior week's
    // close, which is a position, not a claim about the week's path.
    countLabel: "Above Last Week's Close",
    ...STRENGTH_PACE,
    rsiQuick: STRENGTH_RSI_QUICK,
    highlight: STRENGTH_HIGHLIGHT,
    // Same rule as breakout_surge (is_vani_surge_or_breakout), so the shipped
    // question text applies unchanged — no new wording to clear.
    rsFlip: { question: 'Which stocks just turned RS-green?', into: 'bullish' },
    exportName: 'Weekly_Movers',
    xlsVariant: 'default',
    cardLevels: [
      { label: 'Prev Wk', value: (r) => r.prev_week_close },
      { label: 'WTD%', value: (r) => r.pct_wtd, colorKey: 'pct_wtd' },
    ],
    displayName: 'Weekly Movers',
  },

  monthly_movers: {
    presetId: 'monthly_movers',
    side: 'strength',
    // Same construction as weekly_movers: the gate is close > prior month's
    // close, a position rather than a claim about the month's path.
    countLabel: "Above Last Month's Close",
    ...STRENGTH_PACE,
    rsiQuick: STRENGTH_RSI_QUICK,
    highlight: STRENGTH_HIGHLIGHT,
    // Third preset on is_vani_surge_or_breakout, so the cleared question text
    // and computeHighlightExplainFacts both apply unchanged.
    rsFlip: { question: 'Which stocks just turned RS-green?', into: 'bullish' },
    exportName: 'Monthly_Movers',
    xlsVariant: 'default',
    cardLevels: [
      { label: 'Prev Mth', value: (r) => r.prev_month_close },
      { label: 'MTD%', value: (r) => r.pct_mtd, colorKey: 'pct_mtd' },
    ],
    displayName: 'Monthly Movers',
  },

  weekly_decliners: {
    presetId: 'weekly_decliners',
    side: 'caution',
    // The mirror of weekly_movers' tile: the gate is close < prior week's
    // close, a position, not a claim about the week's path.
    countLabel: "Below Last Week's Close",
    ...CAUTION_PACE,
    rsiQuick: CAUTION_RSI_QUICK,
    highlight: CAUTION_HIGHLIGHT,
    rsFlip: CAUTION_RS_FLIP,
    industryQuestion: CAUTION_INDUSTRY_Q,
    exportName: 'Weekly_Decliners',
    xlsVariant: 'default',
    cardLevels: [
      { label: 'Prev Wk', value: (r) => r.prev_week_close },
      { label: 'WTD%', value: (r) => r.pct_wtd, colorKey: 'pct_wtd' },
    ],
    displayName: 'Weekly Decliners',
  },

  monthly_decliners: {
    presetId: 'monthly_decliners',
    side: 'caution',
    countLabel: "Below Last Month's Close",
    ...CAUTION_PACE,
    rsiQuick: CAUTION_RSI_QUICK,
    highlight: CAUTION_HIGHLIGHT,
    rsFlip: CAUTION_RS_FLIP,
    industryQuestion: CAUTION_INDUSTRY_Q,
    exportName: 'Monthly_Decliners',
    xlsVariant: 'default',
    cardLevels: [
      { label: 'Prev Mth', value: (r) => r.prev_month_close },
      { label: 'MTD%', value: (r) => r.pct_mtd, colorKey: 'pct_mtd' },
    ],
    displayName: 'Monthly Decliners',
  },
}

export function getStudioDescriptor(presetId: string): StudioDescriptor | null {
  return STUDIO_DESCRIPTORS[presetId] ?? null
}

/** Presets that render the Studio instead of ScanView's generic layout. */
export const STUDIO_PRESET_IDS = new Set(Object.keys(STUDIO_DESCRIPTORS))
