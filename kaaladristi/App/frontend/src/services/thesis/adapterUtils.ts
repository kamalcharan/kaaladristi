/**
 * Shared building blocks for setup adapters (Wave 2+).
 *
 * The structural skeleton of every Story View is the same — key levels
 * from pivots/w52/sma150, an LT lens reading structure (shelf / weekly
 * 50 EMA / consolidation top), a Swing lens reading near-term pivots,
 * ±1.5% entry-zone bands, and the standard horizontal lines. What makes
 * each preset ITS OWN story is the rationale copy, the What-Confirms
 * gates (which must mirror the scanner's real gates in the matview),
 * the phase read, and the Editor's Note. Adapters own those; this
 * module owns the skeleton so eight adapters can't drift apart.
 */

import type {
  KeyLevels,
  PersonaEntries,
  PersonaEntry,
  EntryZoneAnnotation,
  HorizontalLine,
  WeeklyBar,
  LatestEodRow,
} from './setupAdapter';
import { smaFromEnd, priorMaxFromEnd } from './setupAdapter';

export const ZONE_WIDTH = 0.015;

export function pickBest(a: number | null, b: number | null, combine: (x: number, y: number) => number): number | null {
  if (a != null && b != null) return combine(a, b);
  return a ?? b;
}

export function check(v: boolean | null): 'met' | 'pending' | 'failed' {
  if (v == null) return 'pending';
  return v ? 'met' : 'failed';
}

export function fmt(v: number | null | undefined): string {
  return v == null ? '—' : v.toFixed(2);
}

/** Persona-zone range guard: zones outside 0.70–1.45 × close are off
 *  the actionable map and would stretch the chart scale. */
export function rangeGuard(close: number): (p: number | null | undefined) => number | null {
  return (p) => {
    if (p == null || !Number.isFinite(p) || close <= 0) return null;
    const ratio = p / close;
    if (ratio < 0.70 || ratio > 1.45) return null;
    return p;
  };
}

export function buildStandardKeyLevels(latest: LatestEodRow, ema50Weekly: number | null): KeyLevels {
  return {
    pivot:               latest.pivot_pp,
    immediateResistance: latest.pivot_r1,
    majorResistance:     pickBest(latest.pivot_r2, latest.w52_high, Math.min),
    immediateSupport:    latest.pivot_s1,
    strongSupport:       pickBest(latest.pivot_s2, latest.sma_150, Math.max),
    ema50Weekly,
  };
}

/** Weekly 50 EMA proxy (SMA over closes — matches the chart's line). */
export function weeklyEma50(weekly: WeeklyBar[]): number | null {
  return smaFromEnd(weekly, 50, (b) => b.close);
}

export interface LensRationales {
  shelf: string;   // prior 20-week high
  ema: string;     // weekly 50 EMA
  consol: string;  // prior 8-week consolidation top
  r1: string;      // daily pivot R1
  pp: string;      // daily pivot PP
  guard: string;   // max(pivot S1, 20 EMA)
}

/** The standard LT structural trio + Swing pivot trio, with per-preset
 *  rationale copy. Range guard applied to every zone. */
export function buildStandardPersonas(
  latest: LatestEodRow,
  weekly: WeeklyBar[],
  ema50w: number | null,
  r: LensRationales,
): PersonaEntries {
  const inRange = rangeGuard(latest.close);
  const shelf = priorMaxFromEnd(weekly, 20, (b) => b.high);
  const consol = priorMaxFromEnd(weekly, 8, (b) => b.close);

  const ltInvestor: PersonaEntry[] = [
    { entryNo: 1, price: inRange(shelf),  label: 'Structural breakout zone', rationale: r.shelf },
    { entryNo: 2, price: inRange(ema50w), label: 'Structural pivot zone',    rationale: r.ema },
    { entryNo: 3, price: inRange(consol), label: 'Continuation zone',        rationale: r.consol },
  ];
  const swingTrader: PersonaEntry[] = [
    { entryNo: 1, price: inRange(latest.pivot_r1), label: 'Break-of-pivot zone', rationale: r.r1 },
    { entryNo: 2, price: inRange(latest.pivot_pp), label: 'Mid-range zone',      rationale: r.pp },
    { entryNo: 3, price: inRange(pickBest(latest.pivot_s1, latest.ema_20, Math.max)), label: 'Support-test zone', rationale: r.guard },
  ];
  return { ltInvestor, swingTrader };
}

export function buildStandardZones(personas: PersonaEntries): EntryZoneAnnotation[] {
  const zones: EntryZoneAnnotation[] = [];
  const push = (p: PersonaEntry, persona: 'lt' | 'swing') => {
    if (p.price == null || !Number.isFinite(p.price)) return;
    const half = p.price * ZONE_WIDTH;
    zones.push({
      priceLow: p.price - half,
      priceHigh: p.price + half,
      label: `${persona === 'lt' ? 'LT' : 'Swing'} E${p.entryNo}: ${p.label}`,
      persona,
      tone: 'bull',
    });
  };
  personas.ltInvestor.forEach((p) => push(p, 'lt'));
  personas.swingTrader.forEach((p) => push(p, 'swing'));
  return zones;
}

export function buildStandardLines(kl: KeyLevels): HorizontalLine[] {
  const lines: HorizontalLine[] = [];
  const push = (price: number | null, label: string, tone: 'bull' | 'bear' | 'neutral') => {
    if (price == null || !Number.isFinite(price)) return;
    lines.push({ price, label, tone });
  };
  push(kl.majorResistance,     'Major Resistance',     'bear');
  push(kl.immediateResistance, 'Immediate Resistance', 'bear');
  push(kl.pivot,               'Pivot',                'neutral');
  push(kl.ema50Weekly,         '50 EMA (weekly)',      'neutral');
  push(kl.immediateSupport,    'Immediate Support',    'bull');
  push(kl.strongSupport,       'Strong Support',       'bull');
  return lines;
}
