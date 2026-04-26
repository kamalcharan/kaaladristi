import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertCircle, Zap, LayoutGrid, List } from 'lucide-react';
import { from } from '@/services/postgrest';
import { fetchMonthEvents } from '@/services/astroCalendar';
import type { AstroCalendarEvent } from '@/services/astroCalendar';
import { getFirstWeekdayOffset, DAY_ABBR } from '@/lib/dateUtils';

// ── Impact helpers ────────────────────────────────────────────────────────────

function impactColor(impact: string): string {
  switch (impact) {
    case 'strong_bullish': return '#16a34a';
    case 'bullish':        return '#22c55e';
    case 'minor_bullish':  return '#86efac';
    case 'mild_bullish':   return '#86efac';
    case 'turning':        return '#f59e0b';
    case 'neutral':        return '#475569';
    case 'minor_bearish':  return '#fca5a5';
    case 'mild_bearish':   return '#fca5a5';
    case 'bearish':        return '#ef4444';
    case 'strong_bearish': return '#b91c1c';
    default:               return '#475569';
  }
}

function impactBg(impact: string): string {
  switch (impact) {
    case 'strong_bullish': return 'rgba(22,163,74,0.08)';
    case 'bullish':        return 'rgba(34,197,94,0.06)';
    case 'minor_bullish':
    case 'mild_bullish':   return 'rgba(134,239,172,0.05)';
    case 'turning':        return 'rgba(245,158,11,0.08)';
    case 'neutral':        return 'rgba(71,85,105,0.06)';
    case 'minor_bearish':
    case 'mild_bearish':   return 'rgba(252,165,165,0.05)';
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
    mild_bullish: 'Mild Bull',
    turning: 'Turning',
    neutral: 'Neutral',
    minor_bearish: 'Minor Bear',
    mild_bearish: 'Mild Bear',
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

// ── Monthly calendar hooks ────────────────────────────────────────────────────

function useMonthEvents(year: number, month: number) {
  return useQuery({
    queryKey: ['month_events_intel', year, month],
    queryFn: () => fetchMonthEvents(year, month),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

// ── Calendar grid view ────────────────────────────────────────────────────────

const IMPACT_WEIGHTS: Record<string, number> = {
  strong_bullish:  2,
  bullish:         1,
  mild_bullish:    0.5,
  neutral:         0,
  mild_bearish:   -0.5,
  bearish:        -1,
  strong_bearish: -2,
  // 'turning' absent → contributes 0 to net score
};

function eventDurationDays(e: AstroCalendarEvent): number {
  if (!e.end_date || e.end_date === e.start_date) return 1;
  const ms = new Date(e.end_date).getTime() - new Date(e.start_date).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

function netScore(evts: AstroCalendarEvent[]): number {
  return evts.reduce((sum, e) => sum + (IMPACT_WEIGHTS[e.market_impact] ?? 0), 0);
}

function macroBg(macroEvts: AstroCalendarEvent[]): string {
  if (macroEvts.length === 0) return 'transparent';
  const score = netScore(macroEvts);
  if (score >= 1)  return 'rgba(34,197,94,0.12)';
  if (score <= -1) return 'rgba(239,68,68,0.12)';
  return 'transparent';
}

function scoreToColor(score: number): string {
  if (score >= 2)  return '#15803d'; // strong positive
  if (score > 0)   return '#22c55e'; // positive (0.5, 1, 1.5)
  if (score === 0) return '#6b7280'; // neutral
  if (score > -2)  return '#ef4444'; // negative (-0.5, -1, -1.5)
  return '#991b1b';                  // strong negative
}

function scoreToLabel(score: number): string {
  if (score >= 2)  return 'Strong Positive';
  if (score > 0)   return 'Positive';
  if (score === 0) return 'Neutral';
  if (score > -2)  return 'Negative';
  return 'Strong Negative';
}

interface TooltipState {
  macroEvents: AstroCalendarEvent[];
  dailyEvents: AstroCalendarEvent[];
  isTurning: boolean;
  x: number;
  y: number;
}

function TooltipEventRow({ evt }: { evt: AstroCalendarEvent }) {
  const color = impactColor(evt.market_impact);
  const text = evt.inference ?? evt.narrative ?? null;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: text ? 2 : 0 }}>
        {evt.market_impact === 'turning' ? (
          <Zap style={{ width: 7, height: 7, color: '#f59e0b', flexShrink: 0 }} />
        ) : (
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
        )}
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, flex: 1 }}>
          {evt.display_name}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
          {impactLabel(evt.market_impact)}
        </span>
      </div>
      {text && (
        <div style={{ paddingLeft: 13, fontFamily: 'var(--font-sans)', fontSize: 10.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {text}
        </div>
      )}
    </div>
  );
}

function CalendarGrid({
  events,
  year,
  month,
  today,
}: {
  events: AstroCalendarEvent[];
  year: number;
  month: number;
  today: string;
}) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const numDays = getDaysInMonth(year, month);
  const offset = getFirstWeekdayOffset(year, month);
  const totalCells = Math.ceil((offset + numDays) / 7) * 7;

  // For each day: split into macro (>7d) and daily (≤7d)
  const cellData = useMemo(() => {
    const map: Record<string, { macro: AstroCalendarEvent[]; daily: AstroCalendarEvent[] }> = {};
    for (let d = 1; d <= numDays; d++) {
      const iso = toIsoDate(year, month, d);
      const all = events.filter(e => {
        const end = e.end_date ?? e.start_date;
        return iso >= e.start_date && iso <= end;
      });
      if (all.length === 0) continue;
      map[iso] = {
        macro: all.filter(e => eventDurationDays(e) > 7),
        daily: all.filter(e => eventDurationDays(e) <= 7),
      };
    }
    return map;
  }, [events, year, month, numDays]);

  function onEnter(data: { macro: AstroCalendarEvent[]; daily: AstroCalendarEvent[] }, ev: React.MouseEvent) {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    const isTurning = [...data.macro, ...data.daily].some(e => e.market_impact === 'turning');
    setTooltip({ macroEvents: data.macro, dailyEvents: data.daily, isTurning, x: ev.clientX, y: ev.clientY });
  }
  function onLeave() {
    hideTimer.current = setTimeout(() => setTooltip(null), 80);
  }

  return (
    <div>
      {/* Day-of-week headers — Mon-first */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {DAY_ABBR.map(d => (
          <div key={d} style={{
            textAlign: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: 'var(--text-faint)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            padding: '6px 0',
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {Array.from({ length: totalCells }, (_, i) => {
          const dayNum = i - offset + 1;
          if (dayNum < 1 || dayNum > numDays) return <div key={`empty-${i}`} style={{ minHeight: 72 }} />;

          const iso = toIsoDate(year, month, dayNum);
          const data       = cellData[iso];
          const macroEvts  = data?.macro ?? [];
          const dailyEvts  = data?.daily ?? [];
          const allEvts    = [...macroEvts, ...dailyEvts];
          const isTurning  = allEvts.some(e => e.market_impact === 'turning');
          const dScore     = dailyEvts.length > 0 ? netScore(dailyEvts) : null;
          const hasAny     = allEvts.length > 0;

          const isToday    = iso === today;
          const colIndex   = i % 7;
          const isWeekend  = colIndex === 5 || colIndex === 6;

          // Layer 1: macro tint (green/red/transparent)
          const bg = macroBg(macroEvts);
          // Layer 2: dot color from daily net score (only if not turning)
          const dotColor = (!isTurning && dScore !== null) ? scoreToColor(dScore) : null;

          return (
            <div
              key={iso}
              style={{
                minHeight: 72,
                padding: '7px 6px 6px',
                border: isToday
                  ? '1px solid rgba(212,168,75,0.65)'
                  : '1px solid rgba(255,255,255,0.05)',
                borderRadius: 6,
                background: bg !== 'transparent' && !isWeekend
                  ? bg
                  : isToday
                  ? 'rgba(212,168,75,0.04)'
                  : isWeekend
                  ? 'rgba(255,255,255,0.01)'
                  : 'transparent',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
              onMouseEnter={hasAny ? ev => onEnter(data!, ev) : undefined}
              onMouseLeave={hasAny ? onLeave : undefined}
            >
              {/* Date number */}
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: isToday ? 700 : 400,
                color: isToday ? '#D4A853' : isWeekend ? 'rgba(255,255,255,0.18)' : 'var(--text-secondary)',
                lineHeight: 1,
                marginBottom: 8,
                alignSelf: 'flex-start',
              }}>
                {dayNum}
              </span>

              {/* Layer 2 indicator */}
              {isTurning ? (
                <Zap style={{ width: 18, height: 18, color: '#f59e0b' }} />
              ) : dotColor !== null ? (
                <div style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: dotColor,
                  opacity: dotColor === '#6b7280' ? 0.45 : 0.85,
                  flexShrink: 0,
                }} />
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Two-row legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-faint)', letterSpacing: '0.12em', textTransform: 'uppercase', minWidth: 110 }}>
            Background tint
          </span>
          {[
            { bg: 'rgba(34,197,94,0.12)',    border: 'rgba(34,197,94,0.35)',    label: 'Bullish macro' },
            { bg: 'rgba(239,68,68,0.12)',    border: 'rgba(239,68,68,0.35)',    label: 'Bearish macro' },
            { bg: 'rgba(255,255,255,0.03)',  border: 'rgba(255,255,255,0.1)',   label: 'Neutral' },
          ].map(({ bg, border, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 14, height: 10, borderRadius: 2, background: bg, border: `1px solid ${border}` }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-faint)' }}>{label}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-faint)', letterSpacing: '0.12em', textTransform: 'uppercase', minWidth: 110 }}>
            Dot
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', opacity: 0.85 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-faint)' }}>Positive event</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', opacity: 0.85 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-faint)' }}>Negative event</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Zap style={{ width: 10, height: 10, color: '#f59e0b' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-faint)' }}>Turning date</span>
          </div>
        </div>
      </div>

      {/* Hover tooltip */}
      {tooltip && (() => {
        const ms = netScore(tooltip.macroEvents);
        const nonTurningDaily = tooltip.dailyEvents.filter(e => e.market_impact !== 'turning');
        const ds = netScore(nonTurningDaily);
        const hasMacro = tooltip.macroEvents.length > 0;
        const hasDaily = tooltip.dailyEvents.length > 0;
        const macroLabel = ms >= 1 ? 'Bullish Macro' : ms <= -1 ? 'Bearish Macro' : 'Neutral Macro';
        const macroColor = ms >= 1 ? '#22c55e' : ms <= -1 ? '#ef4444' : '#6b7280';
        const macroBgColor = ms >= 1 ? 'rgba(34,197,94,0.18)' : ms <= -1 ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.04)';

        return (
          <div style={{
            position: 'fixed',
            left: Math.min(tooltip.x + 14, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 310),
            top: tooltip.y - 10,
            width: 300,
            background: 'var(--card)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10,
            padding: '12px 14px',
            zIndex: 9999,
            pointerEvents: 'none',
            boxShadow: '0 8px 32px rgba(0,0,0,0.65)',
          }}>
            {/* Layer 1 — Macro */}
            {hasMacro && (
              <div style={{ marginBottom: hasDaily ? 10 : 0 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#475569', marginBottom: 6 }}>
                  Macro Transits (&gt;7d)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {tooltip.macroEvents.map(e => <TooltipEventRow key={e.id} evt={e} />)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7 }}>
                  <div style={{ width: 14, height: 10, borderRadius: 2, background: macroBgColor, border: `1px solid ${macroColor}40` }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, fontWeight: 700, color: macroColor, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {macroLabel}
                  </span>
                </div>
              </div>
            )}

            {hasMacro && hasDaily && <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 10 }} />}

            {/* Layer 2 — Daily */}
            {hasDaily && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#475569', marginBottom: 6 }}>
                  Daily Events (≤7d)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {tooltip.dailyEvents.map(e => <TooltipEventRow key={e.id} evt={e} />)}
                </div>
                {!tooltip.isTurning && nonTurningDaily.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: scoreToColor(ds), opacity: 0.85 }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, fontWeight: 700, color: scoreToColor(ds), textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {scoreToLabel(ds)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Combined read */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 8, display: 'flex', alignItems: 'center', gap: 7 }}>
              {tooltip.isTurning ? (
                <>
                  <Zap style={{ width: 11, height: 11, color: '#f59e0b', flexShrink: 0 }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Turning Date{hasMacro ? ` · ${macroLabel}` : ''}
                  </span>
                </>
              ) : (
                <>
                  {hasMacro && <div style={{ width: 14, height: 10, borderRadius: 2, background: macroBgColor, border: `1px solid ${macroColor}40`, flexShrink: 0 }} />}
                  {hasDaily && nonTurningDaily.length > 0 && <div style={{ width: 8, height: 8, borderRadius: '50%', background: scoreToColor(ds), opacity: 0.85, flexShrink: 0 }} />}
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {[hasMacro ? macroLabel : null, hasDaily && nonTurningDaily.length > 0 ? scoreToLabel(ds) : null].filter(Boolean).join(' · ')}
                  </span>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Timeline sub-components ───────────────────────────────────────────────────

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

// ── Section 2: Monthly Calendar (calendar grid + timeline toggle) ─────────────

function MonthlyCalendar({ today }: { today: string }) {
  const [offset, setOffset] = useState(0);
  const [viewMode, setViewMode] = useState<'calendar' | 'timeline'>('calendar');
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
      {/* Header row: title + month tabs + view toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 4 }}>
            Vedic Astro Calendar
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>
            Monthly Calendar
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Month selector */}
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

          {/* Calendar / Timeline toggle */}
          <div style={{
            display: 'flex',
            gap: 2,
            padding: 3,
            background: 'rgba(0,0,0,0.25)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
          }}>
            <button
              onClick={() => setViewMode('calendar')}
              title="Calendar grid"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 28,
                borderRadius: 5,
                border: 'none',
                cursor: 'pointer',
                background: viewMode === 'calendar' ? '#818cf8' : 'transparent',
                color: viewMode === 'calendar' ? '#fff' : '#94a3b8',
                transition: 'all 0.15s',
              }}
            >
              <LayoutGrid style={{ width: 14, height: 14 }} />
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              title="Timeline"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 28,
                borderRadius: 5,
                border: 'none',
                cursor: 'pointer',
                background: viewMode === 'timeline' ? '#818cf8' : 'transparent',
                color: viewMode === 'timeline' ? '#fff' : '#94a3b8',
                transition: 'all 0.15s',
              }}
            >
              <List style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#475569', padding: '24px 0' }}>
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#818cf8' }} />
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12 }}>Loading calendar…</span>
        </div>
      ) : viewMode === 'calendar' ? (
        // ── Calendar grid ──────────────────────────────────────────────────────
        <CalendarGrid
          events={events}
          year={year}
          month={month}
          today={today}
        />
      ) : (
        // ── Timeline (day-by-day) ──────────────────────────────────────────────
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
