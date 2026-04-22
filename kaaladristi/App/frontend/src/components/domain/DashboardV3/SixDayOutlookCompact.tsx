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
    const dow = new Date(cursor).getUTCDay();
    if (dow !== 0 && dow !== 6) days.push(cursor);
  }
  return days;
}

function labelFor(iso: string): { dow: string; dd: number; mon: string } {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return { dow: DOW[dt.getUTCDay()], dd: d, mon: MON[m - 1] };
}

// ── Signal → tone ─────────────────────────────────────────────────────────────

interface Tone { label: string; color: string; borderAccent: string }

function signalToTone(signal: string | undefined): Tone {
  switch (signal?.toLowerCase()) {
    case 'strong_bull':
    case 'strong_bullish':
    case 'bull':
    case 'bullish':      return { label: 'Positive', color: 'var(--bull)',        borderAccent: 'var(--bull)' };
    case 'minor_bull':
    case 'minor_bullish':return { label: 'Mild +',   color: 'var(--bull)',        borderAccent: 'var(--bull)' };
    case 'neutral':      return { label: 'Neutral',  color: 'var(--text-faint)',  borderAccent: 'transparent' };
    case 'turning':      return { label: 'Turning',  color: 'var(--gold)',        borderAccent: 'var(--gold)' };
    case 'minor_bear':
    case 'minor_bearish':return { label: 'Mild −',   color: 'var(--caution)',     borderAccent: 'var(--caution)' };
    case 'bear':
    case 'bearish':      return { label: 'Caution',  color: 'var(--caution)',     borderAccent: 'var(--caution)' };
    case 'strong_bear':
    case 'strong_bearish':return { label: 'Negative', color: 'var(--bear)',       borderAccent: 'var(--bear)' };
    default:             return { label: '—',        color: 'var(--text-faint)',  borderAccent: 'transparent' };
  }
}

// ── Day cell ──────────────────────────────────────────────────────────────────

function DayCell({ iso, signal }: { iso: string; signal: AstroSignal | undefined }) {
  const { dow, dd, mon } = labelFor(iso);
  const tone = signalToTone(signal?.net_signal);
  const isTurning = signal?.turning_date ?? false;

  return (
    <div
      style={{
        textAlign: 'center',
        padding: '10px 4px',
        borderRadius: 8,
        border: `1px solid var(--border)`,
        borderLeft: tone.borderAccent !== 'transparent'
          ? `2px solid ${tone.borderAccent}`
          : '1px solid var(--border)',
        cursor: 'default',
        position: 'relative',
      }}
    >
      {isTurning && (
        <div
          style={{
            position: 'absolute',
            top: 4,
            right: 5,
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: 'var(--gold)',
          }}
          title="Turning date"
        />
      )}
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          letterSpacing: '0.1em',
          color: 'var(--text-faint)',
          textTransform: 'uppercase',
          marginBottom: 3,
        }}
      >
        {dow}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 20,
          fontWeight: 500,
          color: 'var(--text-primary)',
          lineHeight: 1,
          marginBottom: 4,
        }}
      >
        {dd}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          letterSpacing: '0.04em',
          color: tone.color,
          textTransform: 'uppercase',
        }}
      >
        {tone.label}
      </div>
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

  const signalMap = new Map<string, AstroSignal>(
    weekSignals.map(s => [s.trade_date, s])
  );

  return (
    <div
      className="rounded-xl flex flex-col"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        height: '100%',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 16px 10px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 15,
              fontWeight: 500,
              color: 'var(--text-primary)',
            }}
          >
            Six-day outlook{' '}
            <em
              style={{
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
                fontSize: 12,
                color: 'var(--text-muted)',
                fontWeight: 400,
              }}
            >
              · forward read
            </em>
          </span>
        </div>
      </div>

      {/* Day grid */}
      <div style={{ padding: '14px 12px', flex: 1 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 6,
            marginBottom: 6,
          }}
        >
          {days.slice(0, 3).map(iso => (
            <DayCell key={iso} iso={iso} signal={signalMap.get(iso)} />
          ))}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 6,
          }}
        >
          {days.slice(3, 6).map(iso => (
            <DayCell key={iso} iso={iso} signal={signalMap.get(iso)} />
          ))}
        </div>
      </div>

      {/* Footer legend */}
      <div
        style={{
          padding: '8px 16px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        {[
          { color: 'var(--bull)',    label: 'Positive' },
          { color: 'var(--caution)', label: 'Caution' },
          { color: 'var(--bear)',    label: 'Negative' },
          { color: 'var(--gold)',    label: 'Turning' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div
              style={{ width: 6, height: 6, borderRadius: '50%', background: color }}
            />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 8.5,
                letterSpacing: '0.1em',
                color: 'var(--text-faint)',
                textTransform: 'uppercase',
              }}
            >
              {label}
            </span>
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 8,
            letterSpacing: '0.1em',
            color: 'var(--text-faint)',
            textTransform: 'uppercase',
          }}
        >
          ● Turning date
        </span>
      </div>
    </div>
  );
}
