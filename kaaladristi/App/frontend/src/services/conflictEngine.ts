/**
 * conflictEngine — pure resolveConflict()
 * ========================================
 * Implements the 7-case conflict resolver from
 * docs/dristiq/intraday_page_spec.md §9.
 *
 * Priority order (highest → lowest, fixed by spec):
 *   3  Rahu Kala       → HARD_OVERRIDE
 *   2  AVOID session   → HARD_CONFLICT
 *   7  Yoga block      → YOGA_BLOCK
 *   6  SYD on FAV day  → DOT_CONFLICT
 *   1  Aligned         → ALIGNED  (Abhijit bonus)
 *   5  SVD/SBD aligned → DOT_ALIGNED
 *   4  Watch mode      → WATCH_MODE
 *
 * When lpScore === null, panchang-only verdicts (Rahu / AVOID / Yoga
 * Block / Watch Mode) still fire — LP-dependent verdicts route to
 * AWAITING_LP. This keeps the engine useful before the webhook lands.
 *
 * No I/O, no side effects, deterministic. Unit-testable by inspection.
 */

import type { SessionQuality } from './intradayTime';

export type Verdict =
  | 'HARD_OVERRIDE' | 'HARD_CONFLICT' | 'YOGA_BLOCK'
  | 'DOT_CONFLICT'  | 'ALIGNED'       | 'DOT_ALIGNED'
  | 'WATCH_MODE'    | 'NEUTRAL'       | 'AWAITING_LP';

export type LpDot = 'SVD' | 'SBD' | 'SYD' | 'PRE-SYD' | null;

export interface ConflictInput {
  sq: SessionQuality;
  inRahu: boolean;
  inAbhijit: boolean;
  yoga: string | null;
  lpScore: number | null;
  lpDot: LpDot;
}

export interface ConflictResult {
  verdict: Verdict;
  label: string;          // short pill text
  action: string;         // imperative line
  rule: string;           // why this verdict fired
  stats?: string;         // e.g. 'n=312, p=0.018'
  bonus?: string;         // e.g. 'Abhijit active +0.8'
  color: 'red' | 'green' | 'amber' | 'teal' | 'dim';
}

const YOGA_BLOCK_NAMES = new Set(['Vyatipata', 'Vaidhriti']);

export function resolveConflict(input: ConflictInput): ConflictResult {
  const { sq, inRahu, inAbhijit, yoga, lpScore, lpDot } = input;

  const isBullishEntry = lpScore !== null && lpScore >= 7;
  const isBearishEntry = lpScore !== null && lpScore <= -6;
  const yogaBlock = yoga !== null && YOGA_BLOCK_NAMES.has(yoga);

  // ── Panchang-only verdicts (fire even with lpScore === null) ──

  if (yogaBlock && lpScore === null) {
    return {
      verdict: 'YOGA_BLOCK',
      label: '⚠ YOGA BLOCK',
      action: 'AWAIT — yoga inauspicious',
      rule: `${yoga} active`,
      stats: 'n=2184, p=0.031',
      color: 'red',
    };
  }

  if (inRahu && lpScore === null) {
    return {
      verdict: 'HARD_OVERRIDE',
      label: '✕ RAHU BLOCK',
      action: 'NO ENTRIES — Rahu Kala',
      rule: 'Rahu Kala active',
      stats: 'n=312, p=0.018',
      color: 'red',
    };
  }

  // ── Case 3 — Rahu Kala (highest priority once LP exists) ──
  if (isBullishEntry && inRahu) {
    return {
      verdict: 'HARD_OVERRIDE',
      label: '✕ RAHU BLOCK',
      action: 'SKIP TRADE',
      rule: 'Rahu Kala active',
      stats: 'n=312, p=0.018',
      color: 'red',
    };
  }

  // ── Case 2 — AVOID session ──
  if (isBullishEntry && sq === 0) {
    return {
      verdict: 'HARD_CONFLICT',
      label: '⚠ HARD CONFLICT',
      action: 'SKIP TRADE',
      rule: 'AVOID session overrides LP',
      stats: 'n=486, p=0.028',
      color: 'red',
    };
  }

  // ── Case 7 — Yoga block ──
  if (isBullishEntry && yogaBlock) {
    return {
      verdict: 'YOGA_BLOCK',
      label: '⚠ YOGA BLOCK',
      action: 'SKIP TRADE',
      rule: `${yoga} — most inauspicious`,
      stats: 'n=2184, p=0.031',
      color: 'red',
    };
  }

  // ── Case 6 — SYD dot on favorable day ──
  if (lpDot === 'SYD' && sq === 3) {
    return {
      verdict: 'DOT_CONFLICT',
      label: '⚠ DOT CONFLICT',
      action: 'NO NEW LONGS',
      rule: 'Distribution on favorable session',
      color: 'amber',
    };
  }

  // ── Case 1 — Aligned ──
  if (isBullishEntry && sq === 3) {
    return {
      verdict: 'ALIGNED',
      label: '▲▲ ALIGNED',
      action: 'FULL SIZE ENTRY',
      rule: 'LP BUY + Favorable session',
      bonus: inAbhijit ? 'Abhijit active +0.8' : undefined,
      color: 'green',
    };
  }

  // ── Case 5 — SVD/SBD aligned ──
  if ((lpDot === 'SVD' || lpDot === 'SBD') && sq >= 2) {
    return {
      verdict: 'DOT_ALIGNED',
      label: '● DOT ALIGNED',
      action: 'HIGH CONVICTION',
      rule: lpDot === 'SVD' ? 'SVD +2.5 boost' : 'SBD +1.5 boost',
      color: 'green',
    };
  }

  // ── Case 4 — Watch mode ──
  if ((lpScore === null || lpScore === 0) && sq === 3) {
    return {
      verdict: 'WATCH_MODE',
      label: '◈ WATCH MODE',
      action: 'AWAIT LP CONFIRMATION',
      rule: 'Favorable session, no LP signal yet',
      color: 'teal',
    };
  }

  // ── Bearish-aligned (informational, not in spec's 7 but useful) ──
  if (isBearishEntry && sq <= 1) {
    return {
      verdict: 'NEUTRAL',
      label: '▼▼ BEAR ALIGNED',
      action: 'BOTH SYSTEMS BEARISH',
      rule: 'LP SELL + cautious session',
      color: 'red',
    };
  }

  // ── Default ──
  if (lpScore === null) {
    return {
      verdict: 'AWAITING_LP',
      label: '○ AWAITING LP',
      action: 'No LP signal',
      rule: 'Webhook not yet wired',
      color: 'dim',
    };
  }

  return {
    verdict: 'NEUTRAL',
    label: '— NEUTRAL',
    action: 'MONITOR',
    rule: 'No alignment criteria met',
    color: 'dim',
  };
}
