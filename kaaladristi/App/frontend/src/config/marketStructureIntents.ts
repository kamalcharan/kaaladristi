export const STRUCTURE_INTENT_VERSION = 2;
export type StructureSection = 'participation' | 'momentum' | 'framework' | 'historical';
export type ExplanationDepth = 'brief' | 'simple' | 'detailed';
export const STRUCTURE_INTENTS = {
  'structure.read': { label: 'Read this market snapshot', section: 'participation', kind: 'live' },
  'structure.participation': { label: 'Compare the three participation horizons', section: 'participation', kind: 'live' },
  'structure.momentum': { label: 'Why can positive ROC still be fading?', section: 'momentum', kind: 'live' },
  'structure.synthesis': { label: 'Bring participation and momentum together', section: 'framework', kind: 'live' },
  'structure.ema': { label: 'What does above 20 EMA mean?', section: 'participation', kind: 'static' },
  'structure.score_date': { label: 'Why do the score and heatmap differ?', section: 'participation', kind: 'static' },
  'structure.fear_greed': { label: 'Understand Fear and Greed', section: 'framework', kind: 'static' },
  'structure.next': { label: 'What does sector rotation add?', section: 'framework', kind: 'static' },
} as const;
export type StructureIntentId = keyof typeof STRUCTURE_INTENTS;
export const STRUCTURE_FOLLOWUPS: Record<StructureIntentId, StructureIntentId[]> = {
  'structure.read': ['structure.score_date', 'structure.participation', 'structure.momentum'],
  'structure.score_date': ['structure.ema', 'structure.participation', 'structure.momentum'],
  'structure.participation': ['structure.ema', 'structure.momentum'],
  'structure.momentum': ['structure.synthesis', 'structure.fear_greed'],
  'structure.synthesis': ['structure.fear_greed', 'structure.next'],
  'structure.ema': ['structure.participation', 'structure.momentum'],
  'structure.fear_greed': ['structure.synthesis', 'structure.next'],
  'structure.next': ['structure.read'],
};
