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

/** Columns shown in the results table/cards, in display order. */
export const BREAKOUT_SURGE_DISPLAY_FIELDS: DisplayField[] = [
  { key: 'close', label: 'Close', format: 'price' },
  { key: 'score_5d', label: 'Score 5D', format: 'score' },
  { key: 'pct_chng', label: '1D%', format: 'pct' },
  { key: 'rvol', label: 'RVOL', format: 'multiplier' },
  { key: 'rsi_14', label: 'RSI', format: 'score' },
  { key: 'magic_rs', label: 'MagicRS', format: 'score' },
]

export const BREAKOUT_SURGE_DEFAULT_SORT: { key: keyof ScanStock; dir: 'asc' | 'desc' } = {
  key: 'score_5d',
  dir: 'desc',
}
