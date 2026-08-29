import type { ScanStock } from '@/types'

/**
 * Declarative field spec for the Breakout Surge preview page — the first
 * instance of the "one spec per scanner, read by generic renderers" pattern
 * (vs. the four independent id-keyed lookups — PRESET_COL_OVERRIDES,
 * DEFAULT_SORT, getFilterGroup, the ScanView.tsx card dispatch — that the
 * real ScanTable/ScanFilterBar/ScanView currently reinvent per scanner).
 *
 * Scoped to this one preview page only. Does NOT touch ScanTable.tsx,
 * ScanFilterBar.tsx, or ScanView.tsx — proving the pattern here first,
 * before any migration of the real scanner pages.
 */

export type FieldFormat = 'price' | 'pct' | 'score' | 'multiplier' | 'number' | 'text'

export interface DisplayField {
  key: keyof ScanStock
  label: string
  format: FieldFormat
}

/**
 * Columns shown in the results table/cards, in display order — chosen for
 * how THIS scanner should be interpreted, not copied from a generic column
 * list. Breakout Surge's thesis is "closed above the 20-day high on an up
 * day, with participation behind the move" (see ScanDefinition.description),
 * so every field here answers one part of "is this a real breakout or
 * noise": how decisively it cleared the level (pct_from_breakout — the
 * scanner's own signature metric, previously missing), whether volume backs
 * it up (rvol), whether the move is building or fading (score_5d vs
 * score_22d together, not just 5d alone), overbought risk (rsi_14), and
 * relative-strength confirmation (magic_rs).
 */
export const BREAKOUT_SURGE_DISPLAY_FIELDS: DisplayField[] = [
  { key: 'close', label: 'Close', format: 'price' },
  { key: 'pct_chng', label: '1D%', format: 'pct' },
  { key: 'pct_from_breakout', label: '% Above Level', format: 'pct' },
  { key: 'rvol', label: 'RVOL', format: 'multiplier' },
  { key: 'score_5d', label: 'Score 5D', format: 'score' },
  { key: 'score_22d', label: 'Score 22D', format: 'score' },
  { key: 'rsi_14', label: 'RSI', format: 'score' },
  { key: 'magic_rs', label: 'MagicRS', format: 'score' },
]

export const BREAKOUT_SURGE_DEFAULT_SORT: { key: keyof ScanStock; dir: 'asc' | 'desc' } = {
  key: 'score_5d',
  dir: 'desc',
}
