import type { MarketBreadthDay, BreadthRocDay } from '@/types';

// Display scales, not trading signals. Fixed across dates and window sizes.
export const PARTICIPATION_CHANGE_POINTS = 5;
export const ROC_SIGNAL_GAP = 0.02;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
export function participationColor(value: number | null | undefined): string {
  if (!finite(value)) return 'var(--card)';
  const p = Math.max(0, Math.min(100, value));
  if (p < 35) return 'var(--risk-red)';
  if (p <= 55) return 'var(--risk-amber)';
  return 'var(--risk-green)';
}
export function magnitudeColor(value: number | null | undefined, scale: number, positive = true): string {
  if (!finite(value)) return 'var(--card)';
  const strength = Math.min(1, Math.abs(value) / scale);
  return `color-mix(in srgb, ${positive ? 'var(--risk-green)' : 'var(--risk-red)'} ${strength >= .66 ? 100 : strength >= .33 ? 65 : 35}%, var(--card))`;
}
export function rocColor(value: number | null | undefined): string { return magnitudeColor(value, 0.25, (value ?? 0) >= 0); }
type Sample = { trade_date: string; stock_count?: number | null; universe_count?: number | null };
const population = (row: Sample) => row.universe_count ?? row.stock_count;
/** Observable anomaly, not proof that unflagged populations are complete. */
export function coverageWarnings(rows: Sample[]): Map<string, string> {
  const warnings = new Map<string, string>();
  rows.forEach((row, i) => {
    const n = population(row);
    const prior = rows.slice(Math.max(0, i - 5), i).map(population)
      .filter((v): v is number => finite(v) && v > 0).sort((a, b) => a - b);
    if (!finite(n) || n <= 0) warnings.set(row.trade_date, 'Coverage unavailable; participation cannot be validated.');
    else if (prior.length) {
      const mid = Math.floor(prior.length / 2);
      const baseline = prior.length % 2 ? prior[mid] : (prior[mid - 1] + prior[mid]) / 2;
      if (n < baseline * 0.8) warnings.set(row.trade_date,
        `Coverage warning: ${n.toLocaleString()} stocks versus a recent median of ${Math.round(baseline).toLocaleString()}. The sample fell more than 20%; this may reflect missing data.`);
    }
  });
  return warnings;
}
export type HeatmapTransition = { direction: 'up' | 'down'; description: string };
export function participationTransition(current: number | null | undefined, previous: number | null | undefined, blocked = false): HeatmapTransition | null {
  if (blocked || !finite(current) || !finite(previous)) return null;
  const delta = current - previous;
  if (Math.abs(delta) < PARTICIPATION_CHANGE_POINTS) return null;
  return { direction: delta > 0 ? 'up' : 'down', description: `Participation ${delta > 0 ? 'increased' : 'decreased'} ${Math.abs(delta).toFixed(1)} percentage points versus the previous available session.` };
}
/** Mark the second session of a new side of the signal, suppressing noisy crosses. */
export function rocTransition(rows: BreadthRocDay[], i: number, blocked = false): HeatmapTransition | null {
  if (blocked || i < 2) return null;
  const gaps = rows.slice(i - 2, i + 1).map(row => finite(row.roc_13) && finite(row.sma_breadth) ? row.roc_13 - row.sma_breadth : null);
  if (!gaps.every(finite)) return null;
  const [before, previous, current] = gaps as number[];
  if (Math.abs(current) < ROC_SIGNAL_GAP || Math.sign(previous) !== Math.sign(current)) return null;
  if (current > 0 && before <= 0) return { direction: 'up', description: 'ROC 13 held above its signal for two sessions. It may still be below zero.' };
  if (current < 0 && before >= 0) return { direction: 'down', description: 'ROC 13 held below its signal for two sessions. It may still be above zero.' };
  return null;
}
export function participationChange(current: number | null | undefined, previous: number | null | undefined): string {
  if (!finite(current) || !finite(previous)) return 'Previous comparison unavailable';
  const delta = current - previous;
  return `${delta > 0 ? '+' : ''}${delta.toFixed(1)} percentage points vs previous session`;
}
/** Link by the date actually plotted, never by opposite-order array indices. */
export function chartReadingDate(event: { activeLabel?: unknown } | null | undefined): string | null {
  return typeof event?.activeLabel === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(event.activeLabel) ? event.activeLabel : null;
}
export function countContext(row: MarketBreadthDay | undefined, key: 'above_20' | 'above_50' | 'above_150'): string {
  if (!row || !finite(row[key]) || !finite(row.universe_count)) return 'Count universe unavailable';
  // Current percentages use separate warm-up denominators; don't imply equality.
  return `${row[key]!.toLocaleString()} above in the shared ${row.universe_count!.toLocaleString()}-stock count universe. Percentage eligibility may differ.`;
}
