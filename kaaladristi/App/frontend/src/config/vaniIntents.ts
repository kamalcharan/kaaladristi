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
  /** Fired automatically when the pane mounts on this page — the opening
   *  brief, not a question the user picks. Excluded from every chip list by
   *  getIntentsForPage(); read it with getAutorunIntent() instead. */
  autorun?: boolean;
  /** Its ground is already covered by the autorun brief. Hidden wherever the
   *  brief runs (the docked pane) and still offered where it does not (the
   *  overlay drawer on /dashboard) — so the prompts stay live and re-enabling
   *  is one flag, not a rewrite. Owner triage, 2026-09-11. */
  coveredByAutorun?: boolean;
  /** Depends on work that has not landed — rendered, but it will answer from
   *  placeholder data until that work does. Industry rotation, today. */
  provisional?: boolean;
  /** Parked: rendered nowhere until the flag is removed. Astro is on hold. */
  hidden?: boolean;
}

export const VANI_INTENTS: Record<string, VaNiIntentDef> = {
  // ── Dashboard ──────────────────────────────────────────────────────────────
  // Fires on arrival, before the user clicks anything: the docked pane opens
  // on a reading of the day rather than a menu of questions. Panchangam is
  // rendered beside it as a CARD (VaNiAutorunBrief), so this covers breadth
  // and the ROC oscillator only.
  'dashboard.autorun': {
    label: "Today's read",
    page: 'dashboard',
    icon: 'sunrise',
    displayOrder: 0,
    autorun: true,
  },
  'dashboard.market_summary': {
    label: "Summarize today's market",
    page: 'dashboard',
    icon: 'activity',
    displayOrder: 1,
    coveredByAutorun: true,
  },
  'dashboard.regime_explain': {
    label: "What's the market regime today?",
    page: 'dashboard',
    icon: 'gauge',
    displayOrder: 2,
    coveredByAutorun: true,
  },
  'dashboard.rotation_overview': {
    label: 'Which industries are leading?',
    page: 'dashboard',
    icon: 'trending-up',
    displayOrder: 3,
    provisional: true,
  },
  'dashboard.warnings': {
    label: 'Are there any market warnings today?',
    page: 'dashboard',
    icon: 'alert-triangle',
    displayOrder: 4,
    coveredByAutorun: true,
  },
  'dashboard.breadth_explain': {
    label: 'Explain the breadth data',
    page: 'dashboard',
    icon: 'bar-chart-3',
    displayOrder: 5,
    coveredByAutorun: true,
  },
  'dashboard.panchangam_outlook': {
    label: 'Panchangam outlook — next 6 days',
    page: 'dashboard',
    icon: 'calendar',
    displayOrder: 6,
    hidden: true,
  },
  'dashboard.breadth_trend': {
    label: 'Which timeframe is breadth moving on?',
    page: 'dashboard',
    icon: 'trending-up',
    displayOrder: 7,
  },
  'dashboard.breadth_momentum': {
    label: 'Is participation accelerating or fading?',
    page: 'dashboard',
    icon: 'zap',
    displayOrder: 8,
  },
  'dashboard.breadth_divergence': {
    label: 'Which part of the market is carrying it?',
    page: 'dashboard',
    icon: 'git-compare',
    displayOrder: 9,
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
  // NOTE: "Also in these scans?" is NOT a pill — owner feedback (2026-09-04):
  // "it is not an intent......this has to be shown directly into the UI
  // without invoking any intent." It renders as an always-visible strip in
  // StockAskPopover.tsx instead (useScanPresence called unconditionally,
  // not gated behind a click). Intentionally no registry entry here.
};

/** The intent this page fires on arrival, if it has one. */
export function getAutorunIntent(page: VaNiPage): ({ intentId: string } & VaNiIntentDef) | null {
  const hit = Object.entries(VANI_INTENTS).find(([, def]) => def.page === page && def.autorun);
  return hit ? { intentId: hit[0], ...hit[1] } : null;
}

/**
 * Questions offered as chips on a page.
 *
 * `withAutorun` says whether the opening brief is running on this surface.
 * When it is, the intents it already covers are dropped — the brief has just
 * stated today's breadth and ROC, and re-offering "Explain the breadth data"
 * underneath it asks the user to pay for the same paragraph twice.
 */
export function getIntentsForPage(
  page: VaNiPage,
  withAutorun = false,
): Array<{ intentId: string } & VaNiIntentDef> {
  return Object.entries(VANI_INTENTS)
    .filter(([, def]) => def.page === page
      && !def.autorun
      && !def.hidden
      && !(withAutorun && def.coveredByAutorun))
    // Provisional intents sink to the bottom whatever their displayOrder —
    // a question answering from placeholder data must not be the first thing
    // offered. Clearing the flag restores its intended position, so the
    // ordering above stays the real one.
    .sort(([, a], [, b]) => (Number(!!a.provisional) - Number(!!b.provisional))
      || (a.displayOrder - b.displayOrder))
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
