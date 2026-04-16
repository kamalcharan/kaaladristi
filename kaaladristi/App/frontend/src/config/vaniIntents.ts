/**
 * VaNi Conversational Intent Registry — Frontend
 *
 * Maps intent IDs to display metadata. The actual prompt templates
 * and LLM logic live on the backend (lib/vani_intents.py).
 *
 * This file controls: labels, icons, display order, and page routing.
 */

export type VaNiPage =
  | 'dashboard'
  | 'equity_vp'
  | 'index_vp'
  | 'industry_transition'
  | 'scanner'
  | 'manipulation_watch'
  | 'active_signals';

export interface VaNiIntentDef {
  label: string;
  page: VaNiPage;
  icon: string;
  displayOrder: number;
}

export const VANI_INTENTS: Record<string, VaNiIntentDef> = {
  // ── Dashboard ──────────────────────────────────────────────────────────────
  'dashboard.market_summary': {
    label: "Summarize today's market",
    page: 'dashboard',
    icon: 'activity',
    displayOrder: 1,
  },
  'dashboard.regime_explain': {
    label: "What's the market regime today?",
    page: 'dashboard',
    icon: 'gauge',
    displayOrder: 2,
  },
  'dashboard.rotation_overview': {
    label: 'Which industries are leading?',
    page: 'dashboard',
    icon: 'trending-up',
    displayOrder: 3,
  },
  'dashboard.warnings': {
    label: 'Are there any market warnings today?',
    page: 'dashboard',
    icon: 'alert-triangle',
    displayOrder: 4,
  },
  'dashboard.breadth_explain': {
    label: 'Explain the breadth data',
    page: 'dashboard',
    icon: 'bar-chart-3',
    displayOrder: 5,
  },
} as const;

export function getIntentsForPage(page: VaNiPage): Array<{ intentId: string } & VaNiIntentDef> {
  return Object.entries(VANI_INTENTS)
    .filter(([, def]) => def.page === page)
    .sort(([, a], [, b]) => a.displayOrder - b.displayOrder)
    .map(([id, def]) => ({ intentId: id, ...def }));
}
