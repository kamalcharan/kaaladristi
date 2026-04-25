import { from } from './postgrest';
import { toIso, getDaysInMonth } from '@/lib/dateUtils';

const PIPELINE_API = (import.meta.env.VITE_PIPELINE_API_URL?.trim() || 'http://localhost:8101');

export interface AstroCalendarEvent {
  id: number;
  display_name: string;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  market_impact: string;
  inference: string | null;
  narrative: string | null;
  notes: string | null;
  is_transit: boolean;
  day_of_week: string | null;
  month: number;
  year: number;
}

export interface AstroDailySignal {
  trade_date: string;
  net_signal: string;
  net_score: number;
  primary_event: string | null;
  secondary_event: string | null;
  active_event_count: number;
  turning_date: boolean;
  strong_bullish_count: number;
  bullish_count: number;
  minor_bullish_count: number;
  neutral_count: number;
  minor_bearish_count: number;
  bearish_count: number;
  strong_bearish_count: number;
}

export interface AstroCalendarPayload {
  display_name: string;
  start_date: string;
  end_date?: string | null;
  market_impact: string;
  is_transit: boolean;
  narrative?: string | null;
  notes?: string | null;
  inference?: string | null;
}

/** All events that overlap a given month (including cross-month spans). */
export async function fetchMonthEvents(year: number, month: number): Promise<AstroCalendarEvent[]> {
  const firstDay = toIso(year, month, 1);
  const lastDay  = toIso(year, month, getDaysInMonth(year, month));

  const { data, error } = await from('km_astro_calendar')
    .select('*')
    .lte('start_date', lastDay)
    .order('start_date', { ascending: true })
    .execute();

  if (error) throw new Error(`[km_astro_calendar] ${error.message}`);

  const rows = (data ?? []) as AstroCalendarEvent[];
  return rows.filter(r =>
    r.end_date ? r.end_date >= firstDay : r.start_date >= firstDay
  );
}

/** Daily astro signals for a given month — derived from km_rule_signals (nakshatra_vara only). */
export async function fetchMonthSignals(year: number, month: number): Promise<AstroDailySignal[]> {
  const firstDay = toIso(year, month, 1);
  const lastDay  = toIso(year, month, getDaysInMonth(year, month));

  const res = await fetch(`${PIPELINE_API}/api/panchang/week?from=${firstDay}&to=${lastDay}`);
  if (!res.ok) return [];

  type RuleDay = {
    date: string;
    total_signals: number;
    bullish: number;
    bearish: number;
    turning: number;
    signals: Array<{ rule_name: string; outcome: string }>;
  };

  const days: RuleDay[] = await res.json();

  return days.map(d => {
    const { date, total_signals, bullish, bearish, turning, signals } = d;

    // Derive net_signal using same logic as SixDayOutlookCompact
    let net_signal = 'neutral';
    if (total_signals > 0) {
      if (turning > 0 && turning >= bullish && turning >= bearish) {
        net_signal = 'turning';
      } else {
        const ratio = (bullish - bearish) / total_signals;
        if      (ratio >  0.5) net_signal = 'strong_bullish';
        else if (ratio >  0.2) net_signal = 'bullish';
        else if (ratio > -0.2) net_signal = 'neutral';
        else if (ratio > -0.5) net_signal = 'bearish';
        else                   net_signal = 'strong_bearish';
      }
    }

    const isTurning = turning > 0 && turning >= bullish && turning >= bearish;

    return {
      trade_date:           date,
      net_signal,
      net_score:            bullish - bearish,
      primary_event:        signals[0]?.rule_name ?? null,
      secondary_event:      signals[1]?.rule_name ?? null,
      active_event_count:   total_signals,
      turning_date:         isTurning,
      strong_bullish_count: 0,
      bullish_count:        bullish,
      minor_bullish_count:  0,
      neutral_count:        Math.max(0, total_signals - bullish - bearish - turning),
      minor_bearish_count:  0,
      bearish_count:        bearish,
      strong_bearish_count: 0,
    };
  });
}

/** Key events for the month — turning dates and strong signals only. */
export async function fetchKeyEvents(year: number, month: number): Promise<AstroCalendarEvent[]> {
  const { data, error } = await from('km_astro_calendar')
    .select('*')
    .eq('month', month)
    .eq('year', year)
    .in('market_impact', ['strong_bullish', 'strong_bearish', 'turning'])
    .order('start_date', { ascending: true })
    .execute();

  if (error) throw new Error(`[km_astro_calendar] ${error.message}`);
  return (data ?? []) as AstroCalendarEvent[];
}

// ── Admin CRUD (pipeline2_api) ────────────────────────────────────────────────

export async function createCalendarEvent(payload: AstroCalendarPayload): Promise<{ id: number }> {
  const res = await fetch(`${PIPELINE_API}/api/astro/calendar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`[create calendar event] HTTP ${res.status}`);
  return res.json();
}

export async function updateCalendarEvent(id: number, payload: AstroCalendarPayload): Promise<void> {
  const res = await fetch(`${PIPELINE_API}/api/astro/calendar/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`[update calendar event] HTTP ${res.status}`);
}

export async function deleteCalendarEvent(id: number): Promise<void> {
  const res = await fetch(`${PIPELINE_API}/api/astro/calendar/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`[delete calendar event] HTTP ${res.status}`);
}
