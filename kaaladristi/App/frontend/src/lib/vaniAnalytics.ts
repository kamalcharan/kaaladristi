import { trackEvent } from './analytics';

export interface VaniAnalyticsContext {
  page: string;
  mode?: 'current_flow' | 'longer_term' | 'market_structure' | 'chat';
  intent_id?: string;
  period?: number;
  months?: number;
}
export type VaniEvent = 'panel_viewed' | 'intent_selected' | 'reading_ready' | 'reading_failed'
  | 'retry' | 'detail_opened' | 'next_step' | 'feedback_submitted' | 'feedback_failed';
export interface VaniEventProperties extends VaniAnalyticsContext {
  source?: 'automatic' | 'manual' | 'external';
  duration_ms?: number;
  detail?: 'explanation' | 'evidence' | 'intents' | 'connections';
  destination?: 'sector_detail' | 'sector_rotation' | 'stock_chart' | 'bookmarks' | 'positions' | 'login';
  area?: 'personal_connections' | 'reading';
  rating?: 'helpful' | 'not_helpful';
}
// Explicit allowlist: never forward request bodies, answers, stock names, URLs,
// account data, log IDs, or exception messages into product analytics.
export function trackVani(event: VaniEvent, props: VaniEventProperties) {
  const route = `/vani/${props.page.replace(/[^a-z_]/g, '')}`;
  // Override automatic URL properties on these explicit events, too.
  const safe: Record<string, unknown> = { analytics_version: 1, $current_url: route, $pathname: route, $referrer: '[redacted]' };
  for (const key of ['page','mode','intent_id','period','months','source','duration_ms','detail','destination','area','rating'] as const) {
    const value = props[key];
    if (value !== undefined) safe[key] = value;
  }
  try { trackEvent(`vani_${event}`, safe); } catch { /* Telemetry must not interrupt research. */ }
}
export function vaniDestination(href: string): VaniEventProperties['destination'] | undefined {
  // Only local application destinations. Never return the actual URL or ID.
  if (/^\/sector-rotation\/\d+(?:[?#]|$)/.test(href)) return 'sector_detail';
  if (/^\/sector-rotation(?:[?#]|$)/.test(href)) return 'sector_rotation';
  if (/^\/chart\/equity\/\d+(?:[?#]|$)/.test(href)) return 'stock_chart';
  if (/^\/bookmarks(?:[?#]|$)/.test(href)) return new URLSearchParams(href.split('?')[1] ?? '').get('tab') === 'positions' ? 'positions' : 'bookmarks';
  if (/^\/login(?:[?#]|$)/.test(href)) return 'login';
}
