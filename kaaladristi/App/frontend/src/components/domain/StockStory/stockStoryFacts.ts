import type { IndicatorRow } from '@/services/indicatorData';

export const validNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export const positiveNumber = (v: unknown): v is number => validNumber(v) && v > 0;
export function relation(close: number | null | undefined, reference: number | null | undefined) {
  if (!validNumber(close) || !positiveNumber(reference)) return 'Unavailable';
  return close > reference ? 'Above' : close < reference ? 'Below' : 'At';
}
export interface WatchReference { id: string; label: string; value: number | null; state: string; }
/** Current reference observations only: no forecast, scoring or event detection. */
export function watchReferences(row: IndicatorRow | null): WatchReference[] {
  return [
    ['week', 'Previous week close', row?.prev_week_close],
    ['month', 'Previous month close', row?.prev_month_close],
    ['gl', 'Golden Line · daily 150 SMA', row?.sma_150],
    ['upper', 'Prior 20-session high', row?.breakout_level],
    ['lower', 'Prior 20-session low', row?.breakdown_level],
  ].map(([id, label, value]) => ({ id: String(id), label: String(label),
    value: positiveNumber(value) ? value : null,
    state: relation(row?.close, positiveNumber(value) ? value : null),
  }));
}
