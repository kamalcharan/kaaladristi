/**
 * signalScale.ts — canonical signal vocabulary for Kāla-Drishti (SINGLE SOURCE)
 *
 * Vocabularies, one source of truth:
 *   1. MarketImpact  — astro event impact / daily net signal  (mild_* keys, DB: km_astro_calendar.market_impact)
 *   2. MagicRS zones — DB-computed Title Case strings         (DB: km_equity_eod.magic_rs_zone)
 *   3. Flow types    — DB-computed UPPER_SNAKE strings        (DB: km_equity_eod.flow_type)
 *   4. RSI bands     — value → neutral band label
 *
 * D39 (SEBI): displayed labels are NON-DIRECTIONAL — never "bull/bear/uptrend/
 * downtrend" in any badge, label or tooltip. DB *keys* keep their names; only
 * the shown text is neutral. Get every displayed label via the helpers below
 * (impactLabel / zoneLabel / zoneLabelShort / rsiLabel / flowLabel) — NEVER
 * hardcode a label string in a component. That is what prevents vocabulary
 * drift (new components import a helper; there is no string to re-invent).
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
  strong_bullish: 'Strong Positive',
  bullish:        'Positive',
  mild_bullish:   'Mild Positive',
  neutral:        'Neutral',
  turning:        'Turning',
  mild_bearish:   'Mild Negative',
  bearish:        'Negative',
  strong_bearish: 'Strong Negative',
};

/** Displayed market-impact label (D39-neutral). Never render the raw key. */
export function impactLabel(impact: string | null | undefined): string {
  return SIGNAL_LABELS[impact ?? ''] ?? (impact ?? '—');
}

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
  slate: { text: 'text-muted',   bg: 'bg-[var(--panel-recess)]',   border: 'border-white/10'       },
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

// ── 2. MagicRS Zones (Title Case DB keys → D39-neutral relative-strength labels)
// DB keeps 'Strong Bull' etc. in magic_rs_zone; only the SHOWN label is neutral.

export const ZONE_LABELS: Record<string, { label: string; color: string }> = {
  'Strong Bull':  { label: 'Leading',    color: 'text-risk-green' },
  'Mild Bull':    { label: 'Improving',  color: 'text-risk-green/70' },
  'Neutral Bull': { label: 'Neutral',    color: 'text-risk-green/40' },
  'Neutral':      { label: 'Neutral',    color: 'text-muted' },         // legacy
  'Neutral Bear': { label: 'Neutral',    color: 'text-risk-red/40' },
  'Mild Bear':    { label: 'Weakening',  color: 'text-risk-red/70' },
  'Strong Bear':  { label: 'Lagging',    color: 'text-risk-red' },
};

/** Short zone label for tight UI (ticker rail etc.) — D39-neutral. */
export const ZONE_LABELS_SHORT: Record<string, string> = {
  'Strong Bull':  'Lead',
  'Mild Bull':    'Firm',
  'Neutral Bull': 'Neut',
  'Neutral':      'Neut',
  'Neutral Bear': 'Neut',
  'Mild Bear':    'Soft',
  'Strong Bear':  'Lag',
};

/** Displayed MagicRS zone label + color. Never render raw magic_rs_zone. */
export function zoneLabel(zone: string | null | undefined): { label: string; color: string } {
  return ZONE_LABELS[zone ?? ''] ?? { label: zone ?? '—', color: 'text-muted' };
}
export function zoneLabelShort(zone: string | null | undefined): string {
  return ZONE_LABELS_SHORT[zone ?? ''] ?? '—';
}

// ── 4. RSI bands (value → neutral band label, D39-safe) ──────────────────────

export function rsiLabel(value: number): string {
  if (value >= 70) return 'Overbought';
  if (value >= 55) return 'Strong';
  if (value > 45)  return 'Neutral';
  if (value >= 30) return 'Weak';
  return 'Oversold';
}

// ── 5. SuperTrend direction (dir → neutral label, D39-safe) ──────────────────

export function trendLabel(dir: number | null | undefined): string {
  if (dir == null) return '—';
  return dir === 1 ? 'Rising' : 'Falling';
}

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
