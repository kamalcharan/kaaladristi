/**
 * intradayTime — pure time helpers for the Intraday page.
 *
 * No React, no fetches. Trivially testable.
 */

// ── IST clock ──────────────────────────────────────────────────────

/** Current IST time as minutes-since-midnight (with seconds as fraction). */
export function currentIstMinutes(now: Date = new Date()): number {
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  return ist.getUTCHours() * 60 + ist.getUTCMinutes() + ist.getUTCSeconds() / 60;
}

/** "HH:MM" or "HH:MM:SS" → minutes-since-midnight. Returns null on bad input. */
export function parseTimeToMinutes(s: string | null | undefined): number | null {
  if (!s) return null;
  const parts = s.split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const sec = parts[2] ? parseInt(parts[2], 10) : 0;
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m + sec / 60;
}

/** Format minutes-since-midnight back to "HH:MM". */
export function formatHHMM(minutes: number): string {
  const total = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ── Window membership ──────────────────────────────────────────────

export interface Window { startMin: number; endMin: number; }

/** True if `nowMin` falls inside [startMin, endMin). */
export function inWindow(nowMin: number, w: Window | null): boolean {
  if (!w) return false;
  return nowMin >= w.startMin && nowMin < w.endMin;
}

/** Build a Window from "HH:MM" strings. Null if either is invalid. */
export function buildWindow(start: string | null, end: string | null): Window | null {
  const s = parseTimeToMinutes(start);
  const e = parseTimeToMinutes(end);
  if (s == null || e == null) return null;
  return { startMin: s, endMin: e };
}

// ── Session quality derivation ─────────────────────────────────────
//
// CAVEAT: this maps a directional indicator (km_astro_daily_signal.net_signal)
// to a quality indicator. Faithful Finastro semantics would derive from
// panchang flags (yoga, tithi, dlnl_match, special days). Open product
// question (audit Appendix Q2). 'turning' is preserved separately so the
// caller can render a TURNING badge alongside the NEUTRAL color.

export type SessionQuality = 0 | 1 | 2 | 3;

export function deriveSessionQuality(netSignal: string | null | undefined): SessionQuality {
  if (!netSignal) return 1;
  switch (netSignal) {
    case 'strong_bullish':
    case 'bullish':
      return 3;
    case 'mild_bullish':
    case 'neutral':
    case 'turning':
      return 2;
    case 'mild_bearish':
    case 'bearish':
      return 1;
    case 'strong_bearish':
      return 0;
    default:
      return 1;
  }
}

export const SQ_LABELS: Record<SessionQuality, string> = {
  0: 'AVOID',
  1: 'CAUTION',
  2: 'NEUTRAL',
  3: 'FAVORABLE',
};

export const SQ_ICONS: Record<SessionQuality, string> = {
  0: '✕',
  1: '⚠',
  2: '◎',
  3: '✦',
};

/** Tailwind-free color tokens — caller plugs into inline styles. */
export const SQ_COLOR_VARS: Record<SessionQuality, string> = {
  0: 'var(--risk-red)',
  1: 'var(--risk-amber)',
  2: 'var(--risk-amber)',
  3: 'var(--risk-green)',
};

// ── Yoga favorability ──────────────────────────────────────────────

const YOGA_AVOID = new Set(['Vyatipata', 'Vaidhriti']);
const YOGA_FAV   = new Set(['Siddha', 'Siddhi', 'Saubhagya', 'Sukarman', 'Dhriti', 'Brahma', 'Ayushman']);

export type YogaFavorability = 'favorable' | 'avoid' | 'neutral';

export function yogaFavorability(yogaName: string | null | undefined): YogaFavorability {
  if (!yogaName) return 'neutral';
  if (YOGA_AVOID.has(yogaName)) return 'avoid';
  if (YOGA_FAV.has(yogaName))   return 'favorable';
  return 'neutral';
}

// ── Moon sign element ──────────────────────────────────────────────

const SIGN_ELEMENT: Record<string, string> = {
  Aries: 'Fire',     Leo: 'Fire',       Sagittarius: 'Fire',
  Taurus: 'Earth',   Virgo: 'Earth',    Capricorn: 'Earth',
  Gemini: 'Air',     Libra: 'Air',      Aquarius: 'Air',
  Cancer: 'Water',   Scorpio: 'Water',  Pisces: 'Water',
};

export function elementOfSign(sign: string | null | undefined): string | null {
  if (!sign) return null;
  return SIGN_ELEMENT[sign] ?? null;
}

// ── Next event resolver ────────────────────────────────────────────

export interface UpcomingEvent { time: string; label: string; minutesFromNow: number; }

export interface EventInputs {
  rahuKala: Window | null;
  abhijit: Window | null;
  yogaEnd: { time: string; isNextDay: boolean } | null;
  tithiEnd: { time: string; isNextDay: boolean } | null;
  nakshatraEnd: { time: string; isNextDay: boolean } | null;
}

/**
 * Given the current minute and a set of windows/changeovers, return the
 * single next event in chronological order (earliest after now).
 * Returns null if nothing scheduled today.
 */
export function nextEvent(nowMin: number, ev: EventInputs): UpcomingEvent | null {
  const candidates: UpcomingEvent[] = [];

  if (ev.rahuKala) {
    if (nowMin < ev.rahuKala.startMin) {
      candidates.push({
        time: formatHHMM(ev.rahuKala.startMin), label: 'Rahu Kala starts',
        minutesFromNow: ev.rahuKala.startMin - nowMin,
      });
    } else if (nowMin < ev.rahuKala.endMin) {
      candidates.push({
        time: formatHHMM(ev.rahuKala.endMin), label: 'Rahu Kala ends',
        minutesFromNow: ev.rahuKala.endMin - nowMin,
      });
    }
  }

  if (ev.abhijit) {
    if (nowMin < ev.abhijit.startMin) {
      candidates.push({
        time: formatHHMM(ev.abhijit.startMin), label: 'Abhijit starts',
        minutesFromNow: ev.abhijit.startMin - nowMin,
      });
    } else if (nowMin < ev.abhijit.endMin) {
      candidates.push({
        time: formatHHMM(ev.abhijit.endMin), label: 'Abhijit ends',
        minutesFromNow: ev.abhijit.endMin - nowMin,
      });
    }
  }

  const addChangeover = (ch: { time: string; isNextDay: boolean } | null, label: string) => {
    if (!ch || ch.isNextDay) return;
    const m = parseTimeToMinutes(ch.time);
    if (m == null || m <= nowMin) return;
    candidates.push({ time: formatHHMM(m), label, minutesFromNow: m - nowMin });
  };
  addChangeover(ev.yogaEnd,      'Yoga changeover');
  addChangeover(ev.tithiEnd,     'Tithi changeover');
  addChangeover(ev.nakshatraEnd, 'Nakshatra changeover');

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.minutesFromNow - b.minutesFromNow);
  return candidates[0];
}

// ── Trading session window ─────────────────────────────────────────

export const SESSION_OPEN_MIN  = 9 * 60 + 15;  // 09:15
export const SESSION_CLOSE_MIN = 15 * 60 + 30; // 15:30
