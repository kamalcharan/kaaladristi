import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

// ── Date helpers ──────────────────────────────────────────────────────────────

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function tradingDaysFrom(startDate: string, count: number): string[] {
  const days: string[] = [];
  let cursor = shiftDate(startDate, -1);
  while (days.length < count) {
    cursor = shiftDate(cursor, 1);
    const dow = new Date(cursor + 'T00:00:00Z').getUTCDay();
    if (dow !== 0 && dow !== 6) days.push(cursor);
  }
  return days;
}

function labelFor(iso: string): { dow: string; dd: number; mon: string } {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return { dow: DOW[dt.getUTCDay()], dd: d, mon: MONTHS[m - 1] };
}

// ── Tone ──────────────────────────────────────────────────────────────────────

interface Tone { label: string; color: string; borderAccent: string }

function weekDayToTone(day: WeekDay | undefined): Tone {
  if (!day || day.total_signals === 0) {
    return { label: '—', color: 'var(--text-faint)', borderAccent: 'transparent' };
  }
  const { bullish, bearish, turning, total_signals } = day;
  if (turning > 0 && turning >= bullish && turning >= bearish) {
    return { label: 'Inflection', color: 'var(--gold)', borderAccent: 'var(--gold)' };
  }
  const ratio = (bullish - bearish) / total_signals;
  if (ratio > 0.5)  return { label: 'High Positive', color: 'var(--bull)',        borderAccent: 'var(--bull)' };
  if (ratio > 0.2)  return { label: 'Mod. Positive', color: 'var(--bull)',        borderAccent: 'var(--bull)' };
  if (ratio > -0.2) return { label: 'Mixed Signals', color: 'var(--text-faint)',  borderAccent: 'transparent' };
  if (ratio > -0.5) return { label: 'Mod. Negative', color: 'var(--caution)',     borderAccent: 'var(--caution)' };
  return               { label: 'High Negative', color: 'var(--bear)',        borderAccent: 'var(--bear)' };
}

// ── Outcome helpers ───────────────────────────────────────────────────────────

const OUTCOME_MAP: Record<string, { label: string; color: string }> = {
  strong_bullish: { label: 'High +ve',    color: 'var(--bull)' },
  bullish:        { label: 'Positive',    color: 'var(--bull)' },
  mild_bullish:   { label: 'Mod. +ve',    color: 'var(--bull)' },
  turning:        { label: 'Inflection',  color: 'var(--gold)' },
  neutral:        { label: 'Neutral',     color: 'var(--text-faint)' },
  mild_bearish:   { label: 'Mod. -ve',    color: 'var(--bear)' },
  bearish:        { label: 'Negative',    color: 'var(--bear)' },
  strong_bearish: { label: 'High -ve',    color: 'var(--bear)' },
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface SignalItem {
  rule_id: number;
  rule_name: string;
  outcome: string;
  strength: number | null;
  confidence: number | null;
  probability_label: string | null;
}

interface WeekDay {
  date: string;
  total_signals: number;
  bullish: number;
  bearish: number;
  turning: number;
  signals: SignalItem[];
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

const PIPELINE_API = (import.meta.env.VITE_PIPELINE_API_URL as string | undefined)?.trim() ?? '';

async function fetchPanchangWeek(from: string, to: string): Promise<WeekDay[]> {
  const res = await fetch(`${PIPELINE_API}/api/panchang/week?from=${from}&to=${to}`);
  if (!res.ok) return [];
  return res.json() as Promise<WeekDay[]>;
}

function usePanchangWeek(from: string, to: string) {
  return useQuery({
    queryKey: ['panchang_week', from, to],
    queryFn: () => fetchPanchangWeek(from, to),
    staleTime: 5 * 60 * 1000,
    enabled: !!from && !!to,
  });
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function SignalTooltip({ signals, dow, dd, mon }: { signals: SignalItem[]; dow: string; dd: number; mon: string }) {
  return (
    <div style={{
      position: 'absolute',
      bottom: 'calc(100% + 8px)',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 50,
      width: 210,
      background: 'var(--card)',
      border: '1px solid rgba(212,168,83,0.30)',
      borderRadius: 10,
      boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
      pointerEvents: 'none',
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 12px 6px',
        borderBottom: '1px solid color-mix(in srgb, var(--text-primary) 6%, transparent)',
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        letterSpacing: '0.12em',
        color: 'var(--text-faint)',
        textTransform: 'uppercase',
      }}>
        {dd} {mon} · {dow} · {signals.length} nak-vara rule{signals.length !== 1 ? 's' : ''}
      </div>

      {/* Signal list */}
      <div style={{ padding: '6px 0' }}>
        {signals.map((s, i) => {
          const outcome = OUTCOME_MAP[s.outcome] ?? { label: s.outcome, color: 'var(--text-faint)' };
          return (
            <div key={s.rule_id} style={{
              padding: '5px 12px',
              borderBottom: i < signals.length - 1 ? '1px solid color-mix(in srgb, var(--text-primary) 4%, transparent)' : 'none',
            }}>
              {/* Rule name */}
              <div style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: 3,
              }}>
                {s.rule_name}
              </div>

              {/* Outcome + confidence row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 8,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: outcome.color,
                  background: `${outcome.color}18`,
                  border: `1px solid ${outcome.color}40`,
                  borderRadius: 3,
                  padding: '1px 5px',
                }}>
                  {outcome.label}
                </span>
                {s.confidence != null && (
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 8,
                    color: 'var(--text-faint)',
                    letterSpacing: '0.06em',
                  }}>
                    {s.confidence.toFixed(0)}% conf
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Day cell ──────────────────────────────────────────────────────────────────

function DayCell({ iso, week }: { iso: string; week: WeekDay | undefined }) {
  const [hovered, setHovered] = useState(false);
  const { dow, dd, mon } = labelFor(iso);
  const tone    = weekDayToTone(week);
  const total   = week?.total_signals ?? 0;
  const bullish = week?.bullish ?? 0;
  const bearish = week?.bearish ?? 0;
  const turning = week?.turning ?? 0;
  const signals = week?.signals ?? [];

  return (
    <div
      style={{
        position: 'relative',
        textAlign: 'center',
        padding: '9px 4px 7px',
        borderRadius: 8,
        border: `1px solid var(--border)`,
        borderLeft: tone.borderAccent !== 'transparent'
          ? `2px solid ${tone.borderAccent}`
          : '1px solid var(--border)',
        cursor: signals.length > 0 ? 'default' : 'default',
        transition: 'background 0.15s',
        background: hovered && signals.length > 0 ? 'color-mix(in srgb, var(--text-primary) 3%, transparent)' : 'transparent',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Tooltip */}
      {hovered && signals.length > 0 && (
        <SignalTooltip signals={signals} dow={dow} dd={dd} mon={mon} />
      )}

      {/* Day */}
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 2 }}>
        {dow}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1, marginBottom: 3 }}>
        {dd}
      </div>

      {/* Tone */}
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, letterSpacing: '0.04em', color: tone.color, textTransform: 'uppercase', marginBottom: 4 }}>
        {tone.label}
      </div>

      {/* Micro-bar */}
      {total > 0 && (
        <div style={{ padding: '0 6px' }}>
          <div style={{ display: 'flex', height: 3, borderRadius: 2, overflow: 'hidden', gap: 1 }}>
            {bullish > 0 && <div style={{ flex: bullish, background: 'var(--bull)', borderRadius: 2 }} />}
            {turning > 0 && <div style={{ flex: turning, background: 'var(--caution)', borderRadius: 2 }} />}
            {bearish > 0 && <div style={{ flex: bearish, background: 'var(--bear)', borderRadius: 2 }} />}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-faint)', marginTop: 2, letterSpacing: '0.06em' }}>
            {total} rule{total !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface SixDayOutlookCompactProps {
  date: string;
}

export default function SixDayOutlookCompact({ date }: SixDayOutlookCompactProps) {
  const days = tradingDaysFrom(date, 6);
  const fromDate = days[0];
  const toDate   = days[days.length - 1];
  const { data: panchangWeek = [] } = usePanchangWeek(fromDate, toDate);
  const weekMap = new Map<string, WeekDay>(panchangWeek.map(d => [d.date, d]));

  return (
    <div
      className="rounded-xl flex flex-col"
      style={{ background: 'var(--card)', border: '1px solid var(--border)', height: '100%' }}
    >
      {/* Header */}
      <div style={{
        padding: '14px 16px 10px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
          Six-day outlook{' '}
          <em style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>
            · forward read
          </em>
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-faint)', letterSpacing: '0.1em' }}>
          HOVER FOR RULES
        </span>
      </div>

      {/* Day grid — overflow visible so tooltips escape */}
      <div style={{ padding: '14px 12px', flex: 1, overflow: 'visible' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 6, overflow: 'visible' }}>
          {days.slice(0, 3).map(iso => (
            <DayCell key={iso} iso={iso} week={weekMap.get(iso)} />
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, overflow: 'visible' }}>
          {days.slice(3, 6).map(iso => (
            <DayCell key={iso} iso={iso} week={weekMap.get(iso)} />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 16px',
        borderTop: '1px solid var(--border)',
        display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
      }}>
        {[
          { color: 'var(--bull)',     label: 'Positive' },
          { color: 'var(--caution)',  label: 'Negative' },
          { color: 'var(--bear)',     label: 'High -ve' },
          { color: 'var(--gold)',     label: 'Inflection' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, letterSpacing: '0.1em', color: 'var(--text-faint)', textTransform: 'uppercase' }}>
              {label}
            </span>
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.1em', color: 'var(--text-faint)', textTransform: 'uppercase' }}>
          bar = nak-vara signals
        </span>
      </div>
    </div>
  );
}
