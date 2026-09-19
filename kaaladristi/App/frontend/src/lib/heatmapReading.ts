import type { MarketBreadthDay, BreadthRocDay } from '@/types';

// Display scales, not trading signals. Fixed across dates and window sizes.
export const PARTICIPATION_CHANGE_POINTS = 5;
export const ROC_SIGNAL_GAP = 0.02;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
export type ParticipationHorizon = 20 | 50 | 150;
export const PARTICIPATION_BANDS: Record<ParticipationHorizon, { extremeHigh: number; high: number; neutral: number; opportunity: number }> = {
  20: { extremeHigh: 55, high: 45, neutral: 38, opportunity: 32 },
  50: { extremeHigh: 60, high: 50, neutral: 35, opportunity: 25 },
  150: { extremeHigh: 65, high: 55, neutral: 30, opportunity: 20 },
};
export function participationBand(value: number | null | undefined, horizon: ParticipationHorizon): string {
  if (!finite(value)) return 'Unavailable';
  const b = PARTICIPATION_BANDS[horizon];
  if (value > b.extremeHigh) return 'Extended';
  if (value > b.high) return 'Elevated';
  if (value > b.neutral) return 'Neutral / transition';
  if (value >= b.opportunity) return 'Opportunity watch';
  return 'Extreme fear';
}
export function participationColor(value: number | null | undefined, horizon: ParticipationHorizon = 20): string {
  if (!finite(value)) return 'var(--card)';
  const band = participationBand(value, horizon);
  if (band === 'Extended') return 'var(--risk-red)';
  if (band === 'Elevated') return 'color-mix(in srgb, var(--risk-red) 58%, var(--card))';
  if (band === 'Neutral / transition') return 'var(--risk-amber)';
  if (band === 'Opportunity watch') return 'var(--risk-green)';
  return 'color-mix(in srgb, var(--risk-green) 46%, var(--card))';
}

export type PressureKind = 'daily' | 'fiveDay';
export type PressureReading = { net: number | null; label: string; color: string; description: string };
export function pressureReading(up: number | null | undefined, down: number | null | undefined,
  universe: number | null | undefined, priorAbsoluteNets: number[], kind: PressureKind): PressureReading {
  if (!finite(up) || !finite(down) || !finite(universe) || universe <= 0) {
    return { net: null, label: 'Unavailable', color: 'var(--card)', description: 'Pressure comparison unavailable.' };
  }
  const net = (up - down) / universe * 100;
  const floor = kind === 'daily' ? 0.5 : 0.1;
  const strongFloor = kind === 'daily' ? 1.5 : 0.3;
  const sorted = priorAbsoluteNets.filter(finite).sort((a, b) => a - b);
  const unusual = sorted.length >= 5 ? sorted[Math.floor((sorted.length - 1) * .8)] : Infinity;
  const strong = Math.abs(net) >= strongFloor && Math.abs(net) >= unusual;
  const balanced = Math.abs(net) < floor;
  const positive = net > 0;
  const label = balanced ? (kind === 'daily' ? 'Balanced' : 'Normal')
    : strong ? (positive ? (kind === 'daily' ? 'Buying thrust' : 'Explosive expansion') : (kind === 'daily' ? 'Panic selling' : 'Capitulation cluster'))
    : positive ? (kind === 'daily' ? 'Buyers dominant' : 'Winners dominant') : (kind === 'daily' ? 'Sellers dominant' : 'Breakdown pressure');
  const color = balanced ? 'var(--risk-amber)'
    : positive ? (strong ? 'var(--risk-green)' : 'color-mix(in srgb, var(--risk-green) 55%, var(--card))')
      : strong ? 'var(--risk-red)' : 'color-mix(in srgb, var(--risk-red) 55%, var(--card))';
  const evidence = `${up.toLocaleString()} up versus ${down.toLocaleString()} down; net ${net >= 0 ? '+' : ''}${net.toFixed(1)}% of the ${universe.toLocaleString()}-stock universe.`;
  return { net, label, color, description: `${label}. ${evidence}${strong ? ' The imbalance is also unusually large versus the preceding 22 sessions.' : ''}` };
}

export function breadthZoneEntry(current: number | null | undefined, previous: number | null | undefined, blocked = false): HeatmapTransition | null {
  if (blocked || !finite(current) || !finite(previous)) return null;
  if (previous <= 55 && current > 55) return { direction: 'down', description: 'Entered Greed: the composite breadth score crossed above 55.' };
  if (previous >= 35 && current < 35) return { direction: 'up', description: 'Entered Fear: the composite breadth score crossed below 35.' };
  return null;
}
export function magnitudeColor(value: number | null | undefined, scale: number, positive = true): string {
  if (!finite(value)) return 'var(--card)';
  const strength = Math.min(1, Math.abs(value) / scale);
  return `color-mix(in srgb, ${positive ? 'var(--risk-green)' : 'var(--risk-red)'} ${strength >= .66 ? 100 : strength >= .33 ? 65 : 35}%, var(--card))`;
}
export function rocColor(value: number | null | undefined): string { return magnitudeColor(value, 0.25, (value ?? 0) >= 0); }
export type RocReading = { label: string; shortLabel: string; color: string; description: string };
export function rocMomentumReading(roc13: number | null | undefined, signal: number | null | undefined): RocReading {
  if (!finite(roc13) || !finite(signal)) return { label: 'Unavailable', shortLabel: '—', color: 'var(--card)', description: 'Momentum state unavailable.' };
  const gap = roc13 - signal;
  if (Math.abs(gap) < ROC_SIGNAL_GAP) return { label: 'Indecisive / flat', shortLabel: 'FLAT', color: 'var(--risk-amber)', description: `ROC 13 is within ${ROC_SIGNAL_GAP.toFixed(2)} of its signal.` };
  if (roc13 > 0 && gap > 0) return { label: 'Positive expansion', shortLabel: 'EXPAND', color: 'var(--risk-green)', description: 'ROC 13 is positive and above its signal.' };
  if (roc13 > 0) return { label: 'Positive but fading', shortLabel: 'FADING', color: 'color-mix(in srgb, var(--risk-red) 58%, var(--card))', description: 'ROC 13 remains positive but has fallen below its signal.' };
  if (gap > 0) return { label: 'Negative but recovering', shortLabel: 'RECOVER', color: 'var(--risk-green)', description: 'ROC 13 remains negative but has risen above its signal.' };
  return { label: 'Negative and weakening', shortLabel: 'WEAK', color: 'var(--risk-red)', description: 'ROC 13 is negative and below its signal.' };
}
export function rocAlignmentReading(roc13: number | null | undefined, roc55: number | null | undefined): RocReading {
  if (!finite(roc13) || !finite(roc55)) return { label: 'Unavailable', shortLabel: '—', color: 'var(--card)', description: 'Fast/slow alignment unavailable.' };
  const gap = roc13 - roc55;
  if (Math.abs(gap) < ROC_SIGNAL_GAP) return { label: 'Fast and slow aligned', shortLabel: 'ALIGNED', color: 'var(--risk-amber)', description: `ROC 13 is within ${ROC_SIGNAL_GAP.toFixed(2)} of ROC 55.` };
  if (gap > 0) return { label: 'Fast momentum leading', shortLabel: 'LEADING', color: 'var(--risk-green)', description: 'ROC 13 is meaningfully above ROC 55.' };
  return { label: 'Fast momentum lagging', shortLabel: 'LAGGING', color: 'var(--risk-red)', description: 'ROC 13 is meaningfully below ROC 55.' };
}
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
  if (current > 0 && before <= 0 && rows[i].roc_13! < 0) return { direction: 'up', description: 'Recovery attempt: negative ROC 13 held above its signal for two sessions.' };
  if (current < 0 && before >= 0 && rows[i].roc_13! > 0) return { direction: 'down', description: 'Fading warning: positive ROC 13 held below its signal for two sessions.' };
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
