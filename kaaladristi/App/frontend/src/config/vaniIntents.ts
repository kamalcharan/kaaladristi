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
  | 'active_signals'
  | 'astro_calendar';

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
  'dashboard.panchangam_outlook': {
    label: 'Panchangam outlook — next 6 days',
    page: 'dashboard',
    icon: 'calendar',
    displayOrder: 6,
  },
  'dashboard.breadth_trend': {
    label: 'How has breadth changed in the last 2-3 days?',
    page: 'dashboard',
    icon: 'trending-up',
    displayOrder: 7,
  },
  'dashboard.breadth_momentum': {
    label: 'Is momentum supporting longs or shorts?',
    page: 'dashboard',
    icon: 'zap',
    displayOrder: 8,
  },
  // ── Scanner (parameterized by preset — same set for every scan) ──────────
  'scanner.explain_preset': {
    label: 'What does this screener show?',
    page: 'scanner',
    icon: 'book-open',
    displayOrder: 1,
  },
  'scanner.read_results': {
    label: "Read today's results",
    page: 'scanner',
    icon: 'list',
    displayOrder: 2,
  },
  // ── Index Chart — Astro (deterministic, no LLM — astro_narration.py) ─────
  'index.astro_now': {
    label: "What's Mercury doing right now?",
    page: 'index_vp',
    icon: 'moon',
    displayOrder: 1,
  },
  // ── Astro Calendar ────────────────────────────────────────────────────────
  'astro_calendar.month_outlook': {
    label: "What's the planetary outlook this month?",
    page: 'astro_calendar',
    icon: 'sparkles',
    displayOrder: 1,
  },
  'astro_calendar.week_events': {
    label: "Explain this week's planetary events",
    page: 'astro_calendar',
    icon: 'calendar',
    displayOrder: 2,
  },
  'astro_calendar.turning_dates': {
    label: 'What are the turning dates this month?',
    page: 'astro_calendar',
    icon: 'rotate-ccw',
    displayOrder: 3,
  },
  'astro_calendar.risk_days': {
    label: 'Which days have elevated risk?',
    page: 'astro_calendar',
    icon: 'alert-triangle',
    displayOrder: 4,
  },
  // ── Industry Transition ──────────────────────────────────────────────────
  'industry_transition.rotation_picture': {
    label: "What's the rotation picture today?",
    page: 'industry_transition',
    icon: 'arrow-right-left',
    displayOrder: 1,
  },
  'industry_transition.gaining_momentum': {
    label: 'Which industries are gaining momentum?',
    page: 'industry_transition',
    icon: 'trending-up',
    displayOrder: 2,
  },
  'industry_transition.losing_strength': {
    label: 'Which industries are losing strength?',
    page: 'industry_transition',
    icon: 'trending-down',
    displayOrder: 3,
  },
  'industry_transition.strongest_stocks': {
    label: 'What are the strongest stocks in leading industries?',
    page: 'industry_transition',
    icon: 'star',
    displayOrder: 4,
  },
} as const;

export interface EquityIntentDef {
  labelTemplate: string;
  icon: string;
  displayOrder: number;
  /** 'position' pills (about the user's own holding) render visually
   *  separated from 'market' pills (about the stock in general) in
   *  StockAskPopover — first because they're about you, not the stock.
   *  Omitted = 'market'. */
  group?: 'position' | 'market';
}

export const EQUITY_INTENTS: Record<string, EquityIntentDef> = {
  // ── Your position — deterministic, no LLM call (StockAskPopover computes
  // these itself via services/thesis.ts + bookmarkStore) ──────────────────
  'equity.i_hold_this': {
    labelTemplate: 'I hold this',
    icon: 'briefcase',
    displayOrder: 1,
    group: 'position',
  },
  'equity.can_i_enter': {
    labelTemplate: 'Can I enter now?',
    icon: 'log-in',
    displayOrder: 2,
    group: 'position',
  },
  // ── About the stock ───────────────────────────────────────────────────
  'equity.explain_signals': {
    labelTemplate: "Explain {symbol}'s signals",
    icon: 'activity',
    displayOrder: 3,
  },
  'equity.why_in_context': {
    labelTemplate: 'Why is {symbol} here?',
    icon: 'help-circle',
    displayOrder: 4,
  },
  'equity.risk_assessment': {
    labelTemplate: "What's the risk on {symbol}?",
    icon: 'shield-alert',
    displayOrder: 5,
  },
  // Deterministic (useScanPresence), same as the position pills — no LLM call.
  'equity.also_in_scans': {
    labelTemplate: 'Also in these scans?',
    icon: 'scan-search',
    displayOrder: 6,
  },
};

export function getIntentsForPage(page: VaNiPage): Array<{ intentId: string } & VaNiIntentDef> {
  return Object.entries(VANI_INTENTS)
    .filter(([, def]) => def.page === page)
    .sort(([, a], [, b]) => a.displayOrder - b.displayOrder)
    .map(([id, def]) => ({ intentId: id, ...def }));
}

export function getEquityIntents(symbol: string): Array<{ intentId: string; label: string; icon: string; displayOrder: number; group?: 'position' | 'market' }> {
  return Object.entries(EQUITY_INTENTS)
    .sort(([, a], [, b]) => a.displayOrder - b.displayOrder)
    .map(([id, def]) => ({
      intentId: id,
      label: def.labelTemplate.replace('{symbol}', symbol),
      icon: def.icon,
      displayOrder: def.displayOrder,
      group: def.group,
    }));
}
