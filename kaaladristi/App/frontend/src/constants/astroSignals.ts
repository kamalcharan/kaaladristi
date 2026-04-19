export const ASTRO_SIGNAL_CLASSES = {
  green: { text: 'text-risk-green',  bg: 'bg-risk-green/10',  border: 'border-risk-green/40'  },
  red:   { text: 'text-risk-red',    bg: 'bg-risk-red/10',    border: 'border-risk-red/40'    },
  amber: { text: 'text-risk-amber',  bg: 'bg-risk-amber/10',  border: 'border-risk-amber/40'  },
  slate: { text: 'text-slate-400',   bg: 'bg-slate-800/60',   border: 'border-white/10'       },
} as const;

export type AstroSignalColor = keyof typeof ASTRO_SIGNAL_CLASSES;

export function impactToColor(impact: string): AstroSignalColor {
  if (['strong_bullish', 'bullish', 'minor_bullish'].includes(impact)) return 'green';
  if (['strong_bearish', 'bearish', 'minor_bearish'].includes(impact)) return 'red';
  if (impact === 'turning') return 'amber';
  return 'slate';
}

export const ASTRO_SIGNAL_LABELS: Record<string, string> = {
  strong_bullish: 'Strong Bullish',
  bullish:        'Bullish',
  minor_bullish:  'Mild Bullish',
  neutral:        'Neutral',
  turning:        'Turning',
  minor_bearish:  'Mild Bearish',
  bearish:        'Bearish',
  strong_bearish: 'Strong Bearish',
};
