import { planetCatalogItem, type AstroOccurrence } from './astroEvents';
import type { IndicatorRow } from './indicatorData';
import type { AstroBand } from './astroOverlayService';

export function shiftStudyDate(date: string, days: number): string {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function validStudyDate(date: string | null): date is string {
  return !!date && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date + 'T12:00:00Z').toISOString().slice(0,10) === date;
}
/** Last completed session on or before the event's calendar date. Never shift the event itself. */
export function studySession(rows: IndicatorRow[], date: string): IndicatorRow | undefined {
  return rows.filter(r => r.trade_date <= date).at(-1);
}
export function studyEventBand(e: AstroOccurrence): AstroBand {
  return { eventKey: e.event_key, ruleCode: `astro_event:${e.family_id}`, ruleId: e.rule_id, displayName: e.display_name,
    from: e.start_date, to: e.end_date, isPoint: e.shape === 'point',
    startTs: e.start_ts, endTs: e.end_ts, precision: e.precision,
    matched: null, baseBias: null, color: planetCatalogItem(e.planets[0] === 'Venus' ? 'Venus' : 'Mercury').color!,
    opacity: 0.05, isPanchak: false, groupTag: e.event_type };
}
export function astroStudyLink(e: AstroOccurrence, index = 1): string {
  return '/astro/study?' + new URLSearchParams({ event: e.event_key, family: e.family_id, type: e.event_type, date: e.start_date, index: String(index) });
}
