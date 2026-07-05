/**
 * Sector Rotation table — column order (single source of truth).
 *
 * To reorder the table, edit THIS array only — both the header and the body
 * render from it (SectorRotationTable maps over this order; column
 * definitions live in the component, order lives here).
 *
 * Rules:
 *  - 'name' must stay FIRST — it is the sticky left column.
 *  - Optional picker columns (Open/High/Low/Volume/Turnover/MagicRS/66D Avg)
 *    are always inserted immediately BEFORE the last entry, so keep 'signal'
 *    last for the "verdict on the right edge" reading.
 *
 * Default order tells the story left → right, CONVICTION FIRST (owner
 * decision 2026-07-05: "Score is the real moat, not %ge — scores start
 * moving first"): scores → returns → momentum → money columns → verdict.
 */

export type SectorRotationColKey =
  | 'name' | 'stock_count' | 'close' | 'pct_chng'
  | 'ret_5d' | 'score_5d' | 'ret_22d' | 'score_22d' | 'ret_66d'
  | 'rsi_14' | 'avg_amt_5d' | 'avg_amt_22d' | 'pct_amt_chg'
  | 'signal';

export const SECTOR_ROTATION_COLUMN_ORDER: SectorRotationColKey[] = [
  'name',
  'stock_count',
  'close',
  'score_5d',      // conviction first — the leading signal
  'score_22d',
  'pct_chng',      // labeled 1D%
  'ret_5d',        // 5D% (carries the gaining-strength dot)
  'ret_22d',
  'ret_66d',
  'rsi_14',
  'avg_amt_5d',
  'avg_amt_22d',
  'pct_amt_chg',
  'signal',
];
