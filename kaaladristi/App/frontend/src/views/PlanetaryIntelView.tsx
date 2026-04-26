import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertCircle, Zap } from 'lucide-react';
import { from } from '@/services/postgrest';
import { fetchMonthEvents } from '@/services/astroCalendar';
import type { AstroCalendarEvent } from '@/services/astroCalendar';

// ── Impact helpers ────────────────────────────────────────────────────────────

function impactColor(impact: string): string {
  switch (impact) {
    case 'strong_bullish': return '#16a34a';
    case 'bullish':        return '#22c55e';
    case 'minor_bullish':  return '#86efac';
    case 'turning':        return '#f59e0b';
    case 'neutral':        return '#475569';
    case 'minor_bearish':  return '#fca5a5';
    case 'bearish':        return '#ef4444';
    case 'strong_bearish': return '#b91c1c';
    default:               return '#475569';
  }
}

function impactBg(impact: string): string {
  switch (impact) {
    case 'strong_bullish': return 'rgba(22,163,74,0.08)';
    case 'bullish':        return 'rgba(34,197,94,0.06)';
    case 'minor_bullish':  return 'rgba(134,239,172,0.05)';
    case 'turning':        return 'rgba(245,158,11,0.08)';
    case 'neutral':        return 'rgba(71,85,105,0.06)';
    case 'minor_bearish':  return 'rgba(252,165,165,0.05)';
    case 'bearish':        return 'rgba(239,68,68,0.06)';
    case 'strong_bearish': return 'rgba(185,28,28,0.08)';
    default:               return 'rgba(71,85,105,0.06)';
  }
}

function impactLabel(impact: string): string {
  const map: Record<string, string> = {
    strong_bullish: 'Strong Bull',
    bullish: 'Bullish',
    minor_bullish: 'Minor Bull',
    turning: 'Turning',
    neutral: 'Neutral',
    minor_bearish: 'Minor Bear',
    bearish: 'Bearish',
    strong_bearish: 'Strong Bear',
  };
  return map[impact] ?? impact;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const SHORT_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function getDayOfWeek(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return SHORT_DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function todayIso(): string {
  const now = new Date();
  return toIsoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function parseSectors(applicability: unknown): string {
  if (!applicability) return '';
  let obj: Record<string, unknown> | null = null;
  if (typeof applicability === 'string') {
    try { obj = JSON.parse(applicability); } catch { return ''; }
  } else if (typeof applicability === 'object') {
    obj = applicability as Record<string, unknown>;
  }
  if (!obj) return '';
  const sectors = (obj.sectors ?? []) as string[];
  if (sectors.length === 0 || (sectors.length === 1 && sectors[0] === 'all')) return 'All sectors';
  return sectors.join(', ');
}

// ── Transit card ──────────────────────────────────────────────────────────────

function TransitCard({ evt }: { evt: AstroCalendarEvent }) {
  const color = impactColor(evt.market_impact);
  const sectors = parseSectors((evt as unknown as Record<string, unknown>).applicability);
  const dateRange =
    evt.end_date && evt.end_date !== evt.start_date
      ? `${evt.start_date} → ${evt.end_date}`
      : evt.start_date;

  return (
    <div style={{
      background: impactBg(evt.market_impact),
      border: `1px solid ${color}30`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 10,
      padding: '16px 18px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: evt.inference ? 10 : 0 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
            {evt.display_name}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#64748b', marginTop: 3 }}>
            {dateRange}
          </div>
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          fontWeight: 700,
          padding: '3px 8px',
          borderRadius: 4,
          background: `${color}18`,
          color,
          border: `1px solid ${color}30`,
          whiteSpace: 'nowrap',
          flexShrink: 0,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          {impactLabel(evt.market_impact)}
        </div>
      </div>

      {evt.inference && (
        <div style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 12,
          color: 'var(--text-secondary)',
          lineHeight: 1.65,
          borderLeft: `2px solid ${color}35`,
          paddingLeft: 10,
          marginBottom: sectors ? 8 : 0,
        }}>
          {evt.inference}
        </div>
      )}

      {sectors && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#475569', marginTop: 4 }}>
          ⊡ {sectors}
        </div>
      )}
    </div>
  );
}

// ── Section 1: Active Macro Transits ─────────────────────────────────────────

function ActiveMacroTransits({ today }: { today: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['active_transits', today],
    queryFn: async (): Promise<AstroCalendarEvent[]> => {
      const { data: rows, error } = await from('km_astro_calendar')
        .select('*')
        .lte('start_date', today)
        .gte('end_date', today)
        .order('start_date', { ascending: true })
        .execute();
      if (error) throw new Error(`[active_transits] ${error.message}`);
      return (rows ?? []) as AstroCalendarEvent[];
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 4 }}>
          Active Now · {today}
        </div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>
          Active Macro Transits
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#475569', padding: '16px 0' }}>
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#818cf8' }} />
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12 }}>Loading transits…</span>
        </div>
      ) : isError ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444', padding: '16px 0' }}>
          <AlertCircle className="w-4 h-4" />
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12 }}>Failed to load — backend may be offline</span>
        </div>
      ) : !data || data.length === 0 ? (
        <div style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          color: '#475569',
          padding: '24px 0',
          textAlign: 'center',
          border: '1px dashed rgba(255,255,255,0.07)',
          borderRadius: 10,
        }}>
          No active macro transits today
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {data.map(evt => <TransitCard key={evt.id} evt={evt} />)}
        </div>
      )}
    </div>
  );
}

// ── Monthly calendar hooks + sub-components ───────────────────────────────────

function useMonthEvents(year: number, month: number) {
  return useQuery({
    queryKey: ['month_events_intel', year, month],
    queryFn: () => fetchMonthEvents(year, month),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

function TransitBanner({ evt }: { evt: AstroCalendarEvent }) {
  const color = impactColor(evt.market_impact);
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 14px',
      background: impactBg(evt.market_impact),
      border: `1px solid ${color}25`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 7,
    }}>
      <div style={{ flex: 1 }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
          {evt.display_name}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#64748b', marginLeft: 10 }}>
          {evt.start_date} → {evt.end_date}
        </span>
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        fontWeight: 700,
        padding: '2px 7px',
        borderRadius: 4,
        background: `${color}18`,
        color,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        flexShrink: 0,
      }}>
        {impactLabel(evt.market_impact)}
      </div>
    </div>
  );
}

function DayRow({ dateStr, events, today }: { dateStr: string; events: AstroCalendarEvent[]; today: string }) {
  const dayNum = parseInt(dateStr.split('-')[2], 10);
  const dayOfWeek = getDayOfWeek(dateStr);
  const isToday = dateStr === today;
  const isWeekend = dayOfWeek === 'Sat' || dayOfWeek === 'Sun';
  const hasTurning = events.some(e => e.market_impact === 'turning');

  if (events.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '4px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.025)',
        opacity: isWeekend ? 0.3 : 0.5,
      }}>
        <div style={{ width: 44, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: isToday ? 700 : 400,
            color: isToday ? '#818cf8' : '#1e293b',
          }}>
            {String(dayNum).padStart(2, '0')}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#1e293b' }}>{dayOfWeek}</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      {hasTurning && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px 4px',
          background: 'rgba(245,158,11,0.05)',
        }}>
          <Zap style={{ width: 11, height: 11, color: '#f59e0b', flexShrink: 0 }} />
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, rgba(245,158,11,0.5), transparent)' }} />
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            fontWeight: 700,
            color: '#f59e0b',
            letterSpacing: '0.18em',
          }}>
            TURNING DATE
          </span>
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, rgba(245,158,11,0.5), transparent)' }} />
          <Zap style={{ width: 11, height: 11, color: '#f59e0b', flexShrink: 0 }} />
        </div>
      )}

      <div style={{
        display: 'flex',
        gap: 12,
        padding: '10px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: hasTurning
          ? 'rgba(245,158,11,0.025)'
          : isToday
          ? 'rgba(129,140,248,0.035)'
          : 'transparent',
        borderLeft: hasTurning
          ? '2px solid rgba(245,158,11,0.3)'
          : isToday
          ? '2px solid rgba(129,140,248,0.3)'
          : '2px solid transparent',
      }}>
        <div style={{ width: 44, flexShrink: 0, paddingTop: 3 }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1,
            marginBottom: 3,
            color: isToday ? '#818cf8' : hasTurning ? '#f59e0b' : 'var(--text-secondary)',
          }}>
            {String(dayNum).padStart(2, '0')}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#475569' }}>{dayOfWeek}</div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {events.map(evt => {
            const color = impactColor(evt.market_impact);
            return (
              <div
                key={evt.id}
                style={{
                  borderLeft: `3px solid ${color}`,
                  paddingLeft: 10,
                  paddingRight: 8,
                  paddingTop: 6,
                  paddingBottom: 6,
                  background: impactBg(evt.market_impact),
                  borderRadius: '0 6px 6px 0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: evt.inference ? 5 : 0 }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {evt.display_name}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 3,
                    background: `${color}18`,
                    color,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}>
                    {impactLabel(evt.market_impact)}
                  </span>
                </div>
                {evt.inference && (
                  <div style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                  }}>
                    {evt.inference}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Section 2: Monthly Calendar ───────────────────────────────────────────────

function MonthlyCalendar({ today }: { today: string }) {
  const [offset, setOffset] = useState(0);
  const now = new Date();

  const monthOptions = [0, 1, 2].map(o => {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() + o, 1));
    return {
      offset: o,
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      label: `${MONTH_NAMES[d.getUTCMonth()].slice(0, 3)} ${d.getUTCFullYear()}`,
    };
  });

  const { year, month } = monthOptions[offset];
  const { data: events = [], isLoading } = useMonthEvents(year, month);
  const daysCount = getDaysInMonth(year, month);

  const macroTransits = useMemo(
    () => events.filter(e => e.end_date && e.end_date !== e.start_date),
    [events],
  );

  const pointEventsByDate = useMemo(() => {
    const map: Record<string, AstroCalendarEvent[]> = {};
    events
      .filter(e => !e.end_date || e.end_date === e.start_date)
      .forEach(e => {
        if (!map[e.start_date]) map[e.start_date] = [];
        map[e.start_date].push(e);
      });
    return map;
  }, [events]);

  const days = useMemo(
    () => Array.from({ length: daysCount }, (_, i) => toIsoDate(year, month, i + 1)),
    [year, month, daysCount],
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 4 }}>
            Vedic Astro Calendar
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>
            Monthly Calendar
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: 2,
          padding: 3,
          background: 'rgba(0,0,0,0.25)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8,
        }}>
          {monthOptions.map(opt => (
            <button
              key={opt.offset}
              onClick={() => setOffset(opt.offset)}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 700,
                padding: '4px 12px',
                borderRadius: 5,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
                background: offset === opt.offset ? '#818cf8' : 'transparent',
                color: offset === opt.offset ? '#fff' : '#94a3b8',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#475569', padding: '24px 0' }}>
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#818cf8' }} />
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12 }}>Loading calendar…</span>
        </div>
      ) : (
        <div>
          {macroTransits.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#475569',
                marginBottom: 8,
              }}>
                Multi-Day Transits This Month
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {macroTransits.map(evt => <TransitBanner key={evt.id} evt={evt} />)}
              </div>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', marginTop: 18 }} />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {days.map(dateStr => (
              <DayRow
                key={dateStr}
                dateStr={dateStr}
                events={pointEventsByDate[dateStr] ?? []}
                today={today}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PlanetaryIntelView() {
  const today = todayIso();

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 36 }}>
      <div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--text-faint)',
          marginBottom: 6,
        }}>
          Kāla-Drishti · Planetary Intelligence
        </div>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 28,
          fontWeight: 500,
          color: 'var(--text-primary)',
          margin: 0,
          letterSpacing: '-0.01em',
        }}>
          Planetary Intel
        </h1>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
          Vedic astro-market transits and planetary cycle intelligence
        </div>
      </div>

      <div style={{
        background: 'var(--card)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 14,
        padding: '22px 22px',
      }}>
        <ActiveMacroTransits today={today} />
      </div>

      <div style={{
        background: 'var(--card)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 14,
        padding: '22px 22px',
      }}>
        <MonthlyCalendar today={today} />
      </div>
    </div>
  );
}
