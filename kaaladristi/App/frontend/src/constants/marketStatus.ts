/**
 * DC Inference — Market Status master list
 *
 * Single source of truth for market_impact values stored in dc_inference.
 * Add new entries here; they appear automatically in the form dropdown
 * and in the ImpactBadge colour mapping.
 *
 * color: tailwind colour key used for badge styling
 *   'green' | 'red' | 'amber' | 'violet' | 'blue' | 'slate'
 */

export interface MarketStatusOption {
  value: string;   // stored in DB (dc_inference.market_impact)
  label: string;   // displayed in UI
  color: 'green' | 'red' | 'amber' | 'violet' | 'blue' | 'slate';
}

export const MARKET_STATUS: MarketStatusOption[] = [
  { value: 'major_positive', label: 'Major Positive', color: 'green'  },
  { value: 'minor_positive', label: 'Minor Positive', color: 'green'  },
  { value: 'bullish',        label: 'Positive',       color: 'green'  },
  { value: 'major_negative', label: 'Major Negative', color: 'red'    },
  { value: 'minor_negative', label: 'Minor Negative', color: 'red'    },
  { value: 'bearish',        label: 'Negative',       color: 'red'    },
  { value: 'highly_volatile',label: 'Highly Volatile',color: 'amber'  },
  { value: 'volatile',       label: 'Volatile',       color: 'amber'  },
  { value: 'cautious',       label: 'Cautious',       color: 'amber'  },
  { value: 'neutral',        label: 'Neutral',        color: 'slate'  },
  { value: 'consolidation',  label: 'Consolidation',  color: 'blue'   },
  { value: 'mixed',          label: 'Mixed',          color: 'violet' },
];

/** Lookup by value — O(1) via Map */
export const MARKET_STATUS_MAP = new Map<string, MarketStatusOption>(
  MARKET_STATUS.map(s => [s.value, s])
);

/** Tailwind classes per colour key */
export const STATUS_COLOR_CLASSES: Record<MarketStatusOption['color'], {
  text: string; bg: string; border: string;
}> = {
  green:  { text: 'text-risk-green',   bg: 'bg-risk-green/10',   border: 'border-risk-green/40'   },
  red:    { text: 'text-risk-red',     bg: 'bg-risk-red/10',     border: 'border-risk-red/40'     },
  amber:  { text: 'text-risk-amber',   bg: 'bg-risk-amber/10',   border: 'border-risk-amber/40'   },
  violet: { text: 'text-accent-violet',bg: 'bg-accent-violet/10',border: 'border-accent-violet/40'},
  blue:   { text: 'text-accent-indigo',bg: 'bg-accent-indigo/10',border: 'border-accent-indigo/30'},
  slate:  { text: 'text-slate-400',    bg: 'bg-slate-800/60',    border: 'border-white/10'        },
};
