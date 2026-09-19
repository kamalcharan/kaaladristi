export const STRUCTURE_INTENT_VERSION = 3;
export type StructureSection = 'participation' | 'momentum' | 'framework' | 'historical';
export type ExplanationDepth = 'brief' | 'simple' | 'detailed';
export const STRUCTURE_INTENTS = {
  'structure.read': { label: 'Read the complete market structure', section: 'participation', kind: 'live' },
  'structure.participation': { label: 'Explain the three participation horizons', section: 'participation', kind: 'live' },
  'structure.pressure': { label: 'Explain daily pressure and five-day extremes', section: 'participation', kind: 'live' },
  'structure.momentum': { label: 'Explain momentum state and alignment', section: 'momentum', kind: 'live' },
  'structure.synthesis': { label: 'Bring breadth, pressure and momentum together', section: 'framework', kind: 'live' },
  'structure.ema': { label: 'What does above 20 EMA mean?', section: 'participation', kind: 'static' },
  'structure.score_date': { label: 'Why do the score and heatmap differ?', section: 'participation', kind: 'static' },
  'structure.fear_greed': { label: 'Understand Fear and Greed', section: 'framework', kind: 'static' },
  'structure.next': { label: 'What does sector rotation add?', section: 'framework', kind: 'static' },
} as const;
export type StructureIntentId = keyof typeof STRUCTURE_INTENTS;
export const STRUCTURE_FOLLOWUPS: Record<StructureIntentId, StructureIntentId[]> = {
  'structure.read': ['structure.participation', 'structure.pressure', 'structure.momentum'],
  'structure.score_date': ['structure.ema', 'structure.participation', 'structure.pressure'],
  'structure.participation': ['structure.pressure', 'structure.momentum'],
  'structure.pressure': ['structure.momentum', 'structure.synthesis'],
  'structure.momentum': ['structure.synthesis', 'structure.fear_greed'],
  'structure.synthesis': ['structure.fear_greed', 'structure.next'],
  'structure.ema': ['structure.participation', 'structure.pressure'],
  'structure.fear_greed': ['structure.synthesis', 'structure.next'],
  'structure.next': ['structure.read'],
};
