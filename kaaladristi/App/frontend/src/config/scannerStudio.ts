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

const acceleratingStrength = (r: ScanStock): boolean =>
  (r.score_5d ?? 0) > 0 && (r.score_5d ?? 0) >= (r.score_22d ?? 0)

const STRENGTH_RSI_QUICK = {
  label: 'Not overbought',
  test: (r: ScanStock) => (r.rsi_14 ?? 0) < 70,
}

const STRENGTH_PACE = {
  paceLabel: 'Accelerating',
  paceSub: '5D ≥ 22D pace',
  pace: acceleratingStrength,
}

// The caution-side mirrors (a "slowing" pace predicate, a "Not oversold"
// toggle, and the weakness-rule highlight builder) land with weekly_decliners.
// They are deliberately not pre-written here: their shape depends on what the
// is_vani_weakness bar actually measures, which is worth reading off live data
// rather than guessing from symmetry.

export const STUDIO_DESCRIPTORS: Record<string, StudioDescriptor> = {
  breakout_surge: {
    presetId: 'breakout_surge',
    side: 'strength',
    countLabel: 'Broke Out Today',
    ...STRENGTH_PACE,
    rsiQuick: STRENGTH_RSI_QUICK,
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
}

export function getStudioDescriptor(presetId: string): StudioDescriptor | null {
  return STUDIO_DESCRIPTORS[presetId] ?? null
}

/** Presets that render the Studio instead of ScanView's generic layout. */
export const STUDIO_PRESET_IDS = new Set(Object.keys(STUDIO_DESCRIPTORS))
