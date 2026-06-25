/**
 * signalScale.ts — canonical signal vocabulary for Kāla-Drishti
 *
 * Three vocabularies, one source of truth:
 *   1. MarketImpact  — astro event impact / daily net signal  (mild_* keys, DB: km_astro_calendar.market_impact)
 *   2. MagicRS zones — DB-computed Title Case strings         (DB: km_equity_eod.magic_rs_zone)
 *   3. Flow types    — DB-computed UPPER_SNAKE strings        (DB: km_equity_eod.flow_type)
 *
 * All other files should import from here. Never define these labels inline.
 */

// ── 1. Market Impact (astro event scale) ─────────────────────────────────────

export type MarketImpact =
  | 'strong_bullish'
  | 'bullish'
  | 'mild_bullish'
  | 'neutral'
  | 'turning'
  | 'mild_bearish'
  | 'bearish'
  | 'strong_bearish';

export const SIGNAL_LABELS: Record<string, string> = {
  strong_bullish: 'Strong Bull',
  bullish:        'Bullish',
  mild_bullish:   'Mild Bull',
  neutral:        'Neutral',
  turning:        'Turning',
  mild_bearish:   'Mild Bear',
  bearish:        'Bearish',
  strong_bearish: 'Strong Bear',
};

export type SignalColor = 'green' | 'red' | 'amber' | 'slate';

export function impactToColor(impact: string): SignalColor {
  if (['strong_bullish', 'bullish', 'mild_bullish'].includes(impact)) return 'green';
  if (['strong_bearish', 'bearish', 'mild_bearish'].includes(impact)) return 'red';
  if (impact === 'turning') return 'amber';
  return 'slate';
}

export const SIGNAL_CLASSES: Record<SignalColor, { text: string; bg: string; border: string }> = {
  green: { text: 'text-risk-green',  bg: 'bg-risk-green/10',  border: 'border-risk-green/40'  },
  red:   { text: 'text-risk-red',    bg: 'bg-risk-red/10',    border: 'border-risk-red/40'    },
  amber: { text: 'text-risk-amber',  bg: 'bg-risk-amber/10',  border: 'border-risk-amber/40'  },
  slate: { text: 'text-slate-400',   bg: 'bg-slate-800/60',   border: 'border-white/10'       },
};

/** All valid impact values in display order (use for dropdowns). */
export const IMPACT_OPTIONS: MarketImpact[] = [
  'strong_bullish',
  'bullish',
  'mild_bullish',
  'neutral',
  'turning',
  'mild_bearish',
  'bearish',
  'strong_bearish',
];

// ── 2. MagicRS Zones (Title Case — as stored in DB) ──────────────────────────

export const ZONE_LABELS: Record<string, { label: string; color: string }> = {
  'Strong Bull':  { label: 'Strong Bull',  color: 'text-risk-green' },
  'Mild Bull':    { label: 'Mild Bull',    color: 'text-risk-green/70' },
  'Neutral Bull': { label: 'Neutral Bull', color: 'text-risk-green/40' },
  'Neutral':      { label: 'Neutral',      color: 'text-muted' },         // legacy
  'Neutral Bear': { label: 'Neutral Bear', color: 'text-risk-red/40' },
  'Mild Bear':    { label: 'Mild Bear',    color: 'text-risk-red/70' },
  'Strong Bear':  { label: 'Strong Bear',  color: 'text-risk-red' },
};

// ── 3. Flow Types (UPPER_SNAKE — as stored in DB) ─────────────────────────────

export const FLOW_LABELS: Record<string, { label: string; color: string }> = {
  // DB-computed flow_type values (UPPER_SNAKE)
  FRESH_LONGS:      { label: 'Fresh Longs',      color: 'text-risk-green' },
  FRESH_SHORTS:     { label: 'Fresh Shorts',     color: 'text-risk-red' },
  SHORT_COVERING:   { label: 'Short Covering',   color: 'text-risk-amber' },
  LONG_LIQUIDATION: { label: 'Long Liquidation', color: 'text-risk-red/80' },
  LOW_VOLUME:       { label: 'Low Volume',        color: 'text-muted' },
  MIXED:            { label: 'Mixed',             color: 'text-muted' },
  // Sector rotation signals (frontend-computed)
  flow_entering:    { label: 'Flow Entering',    color: 'text-risk-green' },
  flow_exiting:     { label: 'Flow Exiting',     color: 'text-risk-red' },
  sustained_flow:   { label: 'Sustained Flow',   color: 'text-risk-amber' },
};

export function flowLabel(flowType: string | null | undefined): { label: string; color: string } {
  return FLOW_LABELS[flowType ?? ''] ?? { label: flowType ?? '—', color: 'text-muted' };
}
