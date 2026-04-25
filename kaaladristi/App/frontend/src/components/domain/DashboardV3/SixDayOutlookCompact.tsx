import { useQuery } from '@tanstack/react-query';
import { useAstroWeek } from '@/hooks';
import type { AstroSignal } from '@/types';

// ── Date helpers ──────────────────────────────────────────────────────────────

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function nextTradingDays(fromDate: string, count: number): string[] {
  const days: string[] = [];
  let cursor = fromDate;
  while (days.length < count) {
    cursor = shiftDate(cursor, 1);
    const dow = new Date(cursor + 'T00:00:00Z').getUTCDay();
    if (dow !== 0 && dow !== 6) days.push(cursor);
  }
  return days;
}

function labelFor(iso: string): { dow: string; dd: number; mon: string } {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return { dow: DOW[dt.getUTCDay()], dd: d, mon: MON[m - 1] };
}

// ── Neutral signal vocabulary ─────────────────────────────────────────────────

interface Tone { label: string; color: string; borderAccent: string }

function signalToTone(signal: string | undefined): Tone {
  switch (signal?.toLowerCase()) {
    case 'strong_bullish': return { label: 'High Positive',      color: 'var(--bull)',        borderAccent: 'var(--bull)' };
    case 'bullish':        return { label: 'Positive',           color: 'var(--bull)',        borderAccent: 'var(--bull)' };
    case 'mild_bullish':   return { label: 'Mod. Positive',      color: 'var(--bull)',        borderAccent: 'var(--bull)' };
    case 'neutral':        return { label: 'Mixed Signals',      color: 'var(--text-faint)',  borderAccent: 'transparent' };
    case 'turning':        return { label: 'Inflection',         color: 'var(--gold)',        borderAccent: 'var(--gold)' };
    case 'mild_bearish':   return { label: 'Mod. Negative',      color: 'var(--caution)',     borderAccent: 'var(--caution)' };
    case 'bearish':        return { label: 'Negative',           color: 'var(--caution)',     borderAccent: 'var(--caution)' };
    case 'strong_bearish': return { label: 'High Negative',      color: 'var(--bear)',        borderAccent: 'var(--bear)' };
    default:               return { label: '—',                  color: 'var(--text-faint)',  borderAccent: 'transparent' };
  }
}

// ── Panchang week types ───────────────────────────────────────────────────────

interface WeekDay {
  date: string;
  total_signals: number;
  bullish: number;
  bearish: number;
  turning: number;
}

// ── Panchang week fetch ───────────────────────────────────────────────────────

const PIPELINE_API = (import.meta.env.VITE_PIPELINE_API_URL as string | undefined)?.trim() ?? 'http://localhost:8101';

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

// ── Day cell ──────────────────────────────────────────────────────────────────

function DayCell({
  iso,
  signal,
  week,
}: {
  iso: string;
  signal: AstroSignal | undefined;
  week: WeekDay | undefined;
}) {
  const { dow, dd } = labelFor(iso);
  const tone = signalToTone(signal?.net_signal);
  const isTurning = signal?.turning_date ?? false;

  const total    = week?.total_signals ?? 0;
  const bullish  = week?.bullish ?? 0;
  const bearish  = week?.bearish ?? 0;
  const turning  = week?.turning ?? 0;

  return (
    <div style={{
      textAlign: 'center',
      padding: '9px 4px 7px',
      borderRadius: 8,
      border: `1px solid var(--border)`,
      borderLeft: tone.borderAccent !== 'transparent'
        ? `2px solid ${tone.borderAccent}`
        : '1px solid var(--border)',
      position: 'relative',
    }}>
      {isTurning && (
        <div style={{
          position: 'absolute', top: 4, right: 5,
          width: 4, height: 4, borderRadius: '50%', background: 'var(--gold)',
        }} title="Inflection date" />
      )}

      {/* Day + date */}
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 2 }}>
        {dow}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1, marginBottom: 3 }}>
        {dd}
      </div>

      {/* Astro signal tone */}
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, letterSpacing: '0.04em', color: tone.color, textTransform: 'uppercase', marginBottom: 4 }}>
        {tone.label}
      </div>

      {/* Rule signal micro-bar */}
      {total > 0 && (
        <div style={{ padding: '0 6px' }}>
          <div style={{ display: 'flex', height: 3, borderRadius: 2, overflow: 'hidden', gap: 1 }}>
            {bullish > 0 && (
              <div style={{ flex: bullish, background: '#22c55e', borderRadius: 2 }} />
            )}
            {turning > 0 && (
              <div style={{ flex: turning, background: '#f59e0b', borderRadius: 2 }} />
            )}
            {bearish > 0 && (
              <div style={{ flex: bearish, background: '#ef4444', borderRadius: 2 }} />
            )}
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
  const { data: weekSignals = [] } = useAstroWeek(date);
  const days = nextTradingDays(date, 6);

  // Panchang/week covers the 6 trading days ahead
  const fromDate = days[0];
  const toDate   = days[days.length - 1];
  const { data: panchangWeek = [] } = usePanchangWeek(fromDate, toDate);

  const signalMap = new Map<string, AstroSignal>(weekSignals.map(s => [s.trade_date, s]));
  const weekMap   = new Map<string, WeekDay>(panchangWeek.map(d => [d.date, d]));

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
      </div>

      {/* Day grid */}
      <div style={{ padding: '14px 12px', flex: 1 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 6 }}>
          {days.slice(0, 3).map(iso => (
            <DayCell key={iso} iso={iso} signal={signalMap.get(iso)} week={weekMap.get(iso)} />
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {days.slice(3, 6).map(iso => (
            <DayCell key={iso} iso={iso} signal={signalMap.get(iso)} week={weekMap.get(iso)} />
          ))}
        </div>
      </div>

      {/* Footer legend */}
      <div style={{
        padding: '8px 16px',
        borderTop: '1px solid var(--border)',
        display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
      }}>
        {[
          { color: 'var(--bull)',    label: 'Positive' },
          { color: 'var(--caution)', label: 'Negative' },
          { color: 'var(--bear)',    label: 'High Negative' },
          { color: 'var(--gold)',    label: 'Inflection' },
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
          ● Inflection date · bar = rule signals
        </span>
      </div>
    </div>
  );
}
