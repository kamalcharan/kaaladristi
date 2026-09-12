import { flowSignal, SIGNAL_COLOR, SIGNAL_TEXT, STRONG_SCORE_CUT_INDEX, type FlowSignal } from '@/components/domain/FlowIntensityMap';
import type { SectorIndexRow } from '@/services/sectorRotation';

export const SECTOR_FLOW_LABEL: Record<FlowSignal, string> = {
  STRONG: 'Strong', BUILDING: 'Building', FADING: 'Fading', OUTFLOW: 'Outflow', QUIET: 'Quiet',
};
export const SECTOR_FLOW_CONDITIONS: Record<FlowSignal, string[]> = {
  STRONG: ['Flow 5D at least 25 and at or above Flow 22D'],
  BUILDING: ['Positive Flow 5D below 25, at or above Flow 22D'],
  FADING: ['Positive Flow 5D below Flow 22D'],
  OUTFLOW: ['Flow 5D is zero', '5D return negative', '5D average amount below 22D average amount'],
  QUIET: ['No positive flow score or qualifying outflow condition'],
};
export const SECTOR_FLOW_STYLE = Object.fromEntries(Object.keys(SECTOR_FLOW_LABEL).map(k => {
  const key = k as FlowSignal;
  return [key, { color: SIGNAL_TEXT[key], bg: SIGNAL_COLOR[key], border: SIGNAL_COLOR[key] }];
})) as Record<FlowSignal, { color: string; bg: string; border: string }>;

export function sectorSignal(row: Pick<SectorIndexRow, 'score_5d' | 'score_22d' | 'avg_amt_5d' | 'avg_amt_22d' | 'ret_5d'>): FlowSignal | null {
  if (row.score_5d == null || row.score_22d == null) return null;
  if (row.score_5d <= 0 && (row.avg_amt_5d == null || row.avg_amt_22d == null || row.ret_5d == null)) return null;
  return flowSignal({ d1: 0, amt: 0, s5: row.score_5d, s22: row.score_22d,
    amt_5d: row.avg_amt_5d ?? undefined, amt_22d: row.avg_amt_22d ?? undefined, ret_5d: row.ret_5d ?? undefined }, STRONG_SCORE_CUT_INDEX);
}

export function sectorSessionDate(value: string) {
  return new Date(value + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });
}
