/**
 * confluenceScore — pure computeConfluence()
 * ===========================================
 * Implements the Confluence Score formula from
 * docs/dristiq/intraday_page_spec.md §7.
 *
 *   Tech weight       60%
 *   Panchang weight   20%
 *   Planetary weight  20%
 *
 * When lpScore is null (no LP webhook yet), techScore falls back to
 * 3.0 (neutral) for math purposes and the UI renders the bar in grey
 * with an "Awaiting LP" label so the user isn't misled.
 */

import type { SessionQuality } from './intradayTime';

export interface ConfluenceInput {
  /** LP signal raw score in [-10, 10]. Null when webhook not wired. */
  lpScore: number | null;
  /** Session quality 0-3 (derived from net_signal). */
  sq: SessionQuality;
  /** True if current IST time is within Rahu Kala window. */
  inRahu: boolean;
  /** True if current IST time is within Abhijit window. */
  inAbhijit: boolean;
  /** Plan score in [-2, 2] from /api/intraday/plan-score. */
  planScore: number;
}

export interface ConfluenceBreakdown {
  /** Tech component (0-6 raw, weighted at 60%). */
  tech: number;
  /** Panchang component (0-2.0 raw, weighted at 20%). */
  panchang: number;
  /** Abhijit bonus (0 or 0.8) added to panchang before weighting. */
  abhBonus: number;
  /** Planetary component (negative clamped to 0, then weighted at 20%). */
  plan: number;
  /** Final 0-10 score. */
  total: number;
  /** True when LP is providing real input. */
  lpAvailable: boolean;
}

export type ConfluenceLabel = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'LOW';

export function labelForScore(total: number): ConfluenceLabel {
  if (total >= 7.5) return 'EXCELLENT';
  if (total >= 6.0) return 'GOOD';
  if (total >= 4.0) return 'FAIR';
  return 'LOW';
}

export function colorForScore(total: number): string {
  if (total >= 7.5) return 'var(--accent-gold, #C9A84C)';
  if (total >= 6.0) return 'var(--risk-green)';
  if (total >= 4.0) return 'var(--risk-amber)';
  return 'var(--risk-red)';
}

/**
 * Compute the confluence score and its breakdown.
 *
 * Tech bar treatment when lpScore is null: math falls back to a
 * neutral 3.0 so the dial doesn't read as broken. The lpAvailable
 * flag tells the UI to render the Tech bar grey + "Awaiting LP".
 */
export function computeConfluence(input: ConfluenceInput): ConfluenceBreakdown {
  const { lpScore, sq, inRahu, inAbhijit, planScore } = input;

  const lpAvailable = lpScore !== null;

  // Tech (60%) — clamp to [0, 6] = max(0, lpScore/10) * 6
  const tech = lpAvailable
    ? Math.max(0, lpScore as number / 10) * 6
    : 3.0; // neutral fallback for math

  // Panchang (20%) — driven by sq, zeroed inside Rahu
  const panchang = inRahu ? 0
                 : sq === 3 ? 2.0
                 : sq === 2 ? 1.2
                 : sq === 1 ? 0.5
                 :            0.0;
  const abhBonus = inAbhijit ? 0.8 : 0;

  // Planetary (20%) — only positive contribution flows into the dial
  const plan = Math.max(0, planScore);

  const total = Math.min(10,
    tech * 0.6
    + (panchang + abhBonus) * 0.2
    + plan * 0.2,
  );

  return {
    tech,
    panchang,
    abhBonus,
    plan,
    total: Math.round(total * 10) / 10,
    lpAvailable,
  };
}
