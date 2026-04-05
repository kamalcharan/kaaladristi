import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Loader2, AlertCircle, LayoutGrid, AlignLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorBoundary } from '@/components/ui';
import { fetchInferencesForMonth } from '@/services/dcInference';
import { MARKET_STATUS_MAP, STATUS_COLOR_CLASSES } from '@/constants/marketStatus';
import {
  MONTH_ABBR, MONTH_FULL, DAY_ABBR,
  getDaysInMonth, getFirstWeekdayOffset, toIso, todayIso, fmtDate,
} from '@/lib/dateUtils';
import type { DcInference } from '@/types';

// ── Sentiment scoring ─────────────────────────────────────────────────────────

const IMPACT_WEIGHT: Record<string, number> = {
  major_positive:  3,
  bullish:         2,
  minor_positive:  1,
  consolidation:   0,
  neutral:         0,
  mixed:           0,
  cautious:       -0.5,
  volatile:       -1,
  highly_volatile:-1.5,
  minor_negative: -1,
  bearish:        -2,
  major_negative: -3,
};

function dayScore(events: DcInference[]): number {
  return events.reduce((s, e) => s + (IMPACT_WEIGHT[e.market_impact ?? ''] ?? 0), 0);
}

interface DayMeta {
  borderClass: string;
  bgClass: string;
  scoreColor: string;
  glowClass: string;
  label: string;
}

function scoreMeta(score: number): DayMeta {
  if (score >= 4) return { borderClass:'border-emerald-400/60', bgClass:'bg-emerald-950/30', glowClass:'shadow-emerald-900/40', scoreColor:'text-emerald-400', label:'Strong Positive' };
  if (score >= 2) return { borderClass:'border-emerald-600/40', bgClass:'bg-emerald-950/15', glowClass:'', scoreColor:'text-emerald-500', label:'Positive' };
  if (score > 0)  return { borderClass:'border-green-800/30',   bgClass:'bg-green-950/10',   glowClass:'', scoreColor:'text-green-600',  label:'Mild Positive' };
  if (score === 0)return { borderClass:'border-white/6',        bgClass:'',                  glowClass:'', scoreColor:'text-slate-500',  label:'Neutral' };
  if (score >= -1)return { borderClass:'border-red-800/30',     bgClass:'bg-red-950/10',     glowClass:'', scoreColor:'text-red-500',    label:'Mild Negative' };
  if (score >= -2)return { borderClass:'border-red-600/40',     bgClass:'bg-red-950/20',     glowClass:'', scoreColor:'text-red-400',    label:'Negative' };
  return            { borderClass:'border-red-400/60',          bgClass:'bg-red-950/30',     glowClass:'shadow-red-900/40', scoreColor:'text-red-400', label:'Strong Negative' };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getActiveEventsForDay(dayIso: string, events: DcInference[]): DcInference[] {
  return events.filter(e => {
    if (!e.end_date) return e.start_date === dayIso;
    return dayIso >= e.start_date && dayIso <= e.end_date;
  });
}

function isMultiDay(e: DcInference): boolean {
  return !!e.end_date && e.end_date !== e.start_date;
}

function isTurningDate(e: DcInference): boolean {
  return (e.inference ?? '').toLowerCase().includes('turning');
}

// ── Event pill ────────────────────────────────────────────────────────────────

function EventPill({ event }: { event: DcInference }) {
  const s = MARKET_STATUS_MAP.get(event.market_impact ?? '');
  const c = STATUS_COLOR_CLASSES[s?.color ?? 'slate'];
  const multi = isMultiDay(event);

  return (
    <div className={cn(
      'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium truncate border',
      c.bg, c.text, c.border,
    )}>
      {multi && <span className="opacity-60 shrink-0">↔</span>}
      <span className="truncate">{event.astro_event}</span>
    </div>
  );
}

// ── Day cell ──────────────────────────────────────────────────────────────────

interface DayCellProps {
  dayIso: string;
  dayNum: number;
  weekday: string;
  events: DcInference[];
  isToday: boolean;
  isCurrentMonth: boolean;
}

function DayCell({ dayIso, dayNum, weekday, events, isToday, isCurrentMonth }: DayCellProps) {
  const score   = dayScore(events);
  const meta    = scoreMeta(score);
  const turning = events.some(isTurningDate);
  const hasMajor = events.some(e => e.market_impact === 'major_positive' || e.market_impact === 'major_negative');
  const maxShow = 4;
  const overflow = Math.max(0, events.length - maxShow);

  return (
    <div className={cn(
      'relative flex flex-col rounded-xl border p-2 min-h-[130px] transition-all',
      meta.borderClass, meta.bgClass,
      isToday && 'ring-2 ring-accent-indigo/70 ring-offset-1 ring-offset-kd-bg',
      !isCurrentMonth && 'opacity-25',
      meta.glowClass && `shadow-lg ${meta.glowClass}`,
    )}>
      {/* Date header */}
      <div className="flex items-start justify-between mb-1.5">
        <div>
          <span className={cn(
            'text-base font-bold mono leading-none',
            isToday ? 'text-accent-indigo' : 'text-white',
          )}>{dayNum}</span>
          <span className="text-[10px] text-muted ml-1">{weekday}</span>
        </div>
        <div className="flex items-center gap-1">
          {turning && (
            <span className="text-risk-amber text-xs" title="Turning Date">◈</span>
          )}
          {hasMajor && (
            <span className="text-[#fbbf24] text-xs" title="Major Event">✦</span>
          )}
          {events.length > 0 && (
            <span className={cn('text-[11px] font-bold mono', meta.scoreColor)}>
              {score > 0 ? '+' : ''}{Math.round(score * 10) / 10}
            </span>
          )}
        </div>
      </div>

      {/* Events */}
      <div className="flex flex-col gap-0.5 flex-1">
        {events.slice(0, maxShow).map(e => (
          <EventPill key={e.id} event={e} />
        ))}
        {overflow > 0 && (
          <span className="text-[10px] text-muted pl-1">+{overflow} more</span>
        )}
        {events.length === 0 && (
          <span className="text-[10px] text-slate-700 mt-auto">—</span>
        )}
      </div>
    </div>
  );
}

// ── Month summary strip ───────────────────────────────────────────────────────

function MonthSummary({ events, year, month }: { events: DcInference[]; year: number; month: number }) {
  const days = getDaysInMonth(year, month);
  let posCount = 0, negCount = 0, strongPos = 0;

  for (let d = 1; d <= days; d++) {
    const iso = toIso(year, month, d);
    const dayEvents = getActiveEventsForDay(iso, events);
    const score = dayScore(dayEvents);
    if (score > 1)  posCount++;
    if (score < -1) negCount++;
    if (score >= 4) strongPos++;
  }

  const highlights = events
    .filter(e => e.market_impact === 'major_positive' || e.market_impact === 'bullish' || isTurningDate(e))
    .slice(0, 4);

  return (
    <div className="glass-card rounded-2xl p-5 mb-6">
      <div className="flex flex-wrap items-start gap-6">
        {/* Stats */}
        <div className="flex gap-4">
          <Stat value={posCount} label="Positive Days" color="text-emerald-400" />
          <Stat value={negCount} label="Caution Days"  color="text-red-400" />
          <Stat value={strongPos} label="Peak Days"    color="text-[#fbbf24]" />
          <Stat value={events.length} label="Total Events" color="text-accent-indigo" />
        </div>

        {/* Key events */}
        {highlights.length > 0 && (
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted mb-2">Key Events</p>
            <div className="flex flex-wrap gap-2">
              {highlights.map(e => {
                const s = MARKET_STATUS_MAP.get(e.market_impact ?? '');
                const c = STATUS_COLOR_CLASSES[s?.color ?? 'slate'];
                return (
                  <div key={e.id} className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px]', c.bg, c.border)}>
                    <span className={cn('font-bold', c.text)}>{fmtDate(e.start_date)}</span>
                    <span className="text-slate-300">{e.astro_event}</span>
                    {isTurningDate(e) && <span className="text-risk-amber">◈</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="text-center">
      <p className={cn('text-2xl font-bold mono', color)}>{value}</p>
      <p className="text-[10px] text-muted uppercase tracking-wide">{label}</p>
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend() {
  const items: { label: string; dotClass: string }[] = [
    { label: 'Strong Positive (≥4)', dotClass: 'bg-emerald-400' },
    { label: 'Positive (2-3)',        dotClass: 'bg-emerald-600' },
    { label: 'Mild Positive (0-1)',   dotClass: 'bg-green-700' },
    { label: 'Neutral',              dotClass: 'bg-slate-600' },
    { label: 'Mild Negative',        dotClass: 'bg-red-700' },
    { label: 'Negative / Bearish',   dotClass: 'bg-red-500' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4">
      <span className="text-[10px] uppercase tracking-widest font-bold text-muted">Legend</span>
      {items.map(i => (
        <div key={i.label} className="flex items-center gap-1.5">
          <div className={cn('w-2.5 h-2.5 rounded-sm', i.dotClass)} />
          <span className="text-[11px] text-slate-400">{i.label}</span>
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <span className="text-risk-amber text-sm">◈</span>
        <span className="text-[11px] text-slate-400">Turning Date</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[#fbbf24] text-sm">✦</span>
        <span className="text-[11px] text-slate-400">Major Event</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-slate-500">↔</span>
        <span className="text-[11px] text-slate-400">Multi-day event</span>
      </div>
    </div>
  );
}

// ── Timeline View ─────────────────────────────────────────────────────────────

interface HoverState {
  id:     number;
  cx:     number; // clientX
  cy:     number; // clientY
}

/** Clamp ISO date to the visible month; return day-of-month integer */
function clampDay(iso: string, monthPrefix: string, numDays: number, side: 'start' | 'end'): number {
  if (iso.slice(0, 7) < monthPrefix) return 1;
  if (iso.slice(0, 7) > monthPrefix) return numDays;
  return parseInt(iso.split('-')[2], 10);
}

/** Greedy track assignment for bars within a single week row */
function assignWeekTracks(
  items: { event: DcInference; cs: number; ce: number }[],
): { event: DcInference; cs: number; ce: number; track: number }[] {
  const trackEnds: number[] = [];
  return items.map(item => {
    let t = trackEnds.findIndex(e => e < item.cs);
    if (t === -1) t = trackEnds.length;
    trackEnds[t] = item.ce;
    return { ...item, track: t };
  });
}

function TimelineView({ events, year, month }: { events: DcInference[]; year: number; month: number }) {
  const numDays     = getDaysInMonth(year, month);
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
  const [hovered, setHovered] = useState<HoverState | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build weekly bands: [1-7], [8-14], [15-21], [22-28], [29-end]
  const weeks = useMemo(() => {
    const ws = [];
    for (let d = 1; d <= numDays; d += 7) ws.push({ wStart: d, wEnd: Math.min(d + 6, numDays) });
    return ws;
  }, [numDays]);

  // Pre-compute event day-range once
  const eventDays = useMemo(() => new Map(
    events.map(e => [e.id, {
      sd: clampDay(e.start_date, monthPrefix, numDays, 'start'),
      ed: clampDay(e.end_date ?? e.start_date, monthPrefix, numDays, 'end'),
    }])
  ), [events, monthPrefix, numDays]);

  // Build week rows with greedy-packed tracks
  const weekRows = useMemo(() => weeks.map(({ wStart, wEnd }) => {
    const wDays = wEnd - wStart + 1;
    const all = events
      .map(e => {
        const { sd, ed } = eventDays.get(e.id)!;
        return { event: e, cs: Math.max(wStart, sd), ce: Math.min(wEnd, ed) };
      })
      .filter(i => i.cs <= i.ce)
      .sort((a, b) => a.cs - b.cs);

    // Multi-day → horizontal track bars
    const multiItems = assignWeekTracks(all.filter(i => i.cs < i.ce));
    const numT = Math.max(1, multiItems.reduce((m, i) => Math.max(m, i.track + 1), 0));

    // Single-day → stacked column bars grouped by day
    const singleDayMap = new Map<number, DcInference[]>();
    for (const { event, cs, ce } of all) {
      if (cs === ce) {
        if (!singleDayMap.has(cs)) singleDayMap.set(cs, []);
        singleDayMap.get(cs)!.push(event);
      }
    }

    return { wStart, wEnd, wDays, multiItems, singleDayMap, numT, hasEvents: all.length > 0 };
  }), [weeks, events, eventDays]);

  const todayStr = todayIso();
  const todayDay = todayStr.startsWith(monthPrefix)
    ? parseInt(todayStr.split('-')[2], 10) : null;

  const BAR_H = 30;
  const PAD   = 5;

  // Find hovered event details
  const hoveredEvent = hovered ? events.find(e => e.id === hovered.id) ?? null : null;

  function onEnter(e: DcInference, ev: React.MouseEvent) {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setHovered({ id: e.id, cx: ev.clientX, cy: ev.clientY });
  }
  function onLeave() {
    hideTimer.current = setTimeout(() => setHovered(null), 120);
  }

  return (
    <div className="glass-card rounded-3xl p-6">
      <p className="text-[10px] text-muted uppercase tracking-widest font-bold mb-5">
        Market Sentiment Timeline · {MONTH_FULL[month - 1]} {year}
      </p>

      <div className="space-y-3">
        {weekRows.map(({ wStart, wEnd, wDays, multiItems, singleDayMap, numT, hasEvents }) => {
          const rowH = PAD + numT * (BAR_H + PAD);
          return (
            <div key={wStart} className="flex items-stretch gap-0">
              {/* Week label */}
              <div className="w-[72px] shrink-0 flex flex-col items-end justify-center pr-3 border-r border-kd-border/50">
                <span className="text-[12px] font-mono font-bold text-white/70">
                  {wStart}–{wEnd}
                </span>
                <span className="text-[9px] uppercase tracking-widest text-slate-600 mt-0.5">
                  {MONTH_ABBR[month - 1]}
                </span>
              </div>

              {/* Bar area */}
              <div className="flex-1 pl-3 flex flex-col gap-1">
                {/* Day number ruler */}
                <div className="relative h-4">
                  {Array.from({ length: wDays }, (_, i) => {
                    const d = wStart + i;
                    const dow = new Date(year, month - 1, d).getDay();
                    const isWeekend = dow === 0 || dow === 6;
                    return (
                      <span
                        key={d}
                        className={cn(
                          'absolute text-[9px] font-mono -translate-x-1/2',
                          isWeekend ? 'text-slate-600' : 'text-slate-500',
                        )}
                        style={{ left: `${((i + 0.5) / wDays) * 100}%` }}
                      >
                        {d}
                      </span>
                    );
                  })}
                </div>

                {/* Track band */}
                <div
                  className="relative rounded-lg bg-black/25 border border-kd-border/40"
                  style={{ height: rowH }}
                >
                  {/* Day separator lines */}
                  {Array.from({ length: wDays - 1 }, (_, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 border-l border-white/[0.04] pointer-events-none"
                      style={{ left: `${((i + 1) / wDays) * 100}%` }}
                    />
                  ))}

                  {/* Weekend tint */}
                  {Array.from({ length: wDays }, (_, i) => {
                    const dow = new Date(year, month - 1, wStart + i).getDay();
                    if (dow !== 0 && dow !== 6) return null;
                    return (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 bg-white/[0.018] pointer-events-none"
                        style={{ left: `${(i / wDays) * 100}%`, width: `${(1 / wDays) * 100}%` }}
                      />
                    );
                  })}

                  {/* Today line */}
                  {todayDay !== null && todayDay >= wStart && todayDay <= wEnd && (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-indigo-400/50 z-10 pointer-events-none"
                      style={{ left: `${((todayDay - wStart + 0.5) / wDays) * 100}%` }}
                    />
                  )}

                  {/* Multi-day horizontal bars (show inference text) */}
                  {multiItems.map(({ event, cs, ce, track }) => {
                    const leftPct  = ((cs - wStart) / wDays) * 100;
                    const widthPct = ((ce - cs + 1) / wDays) * 100;
                    const s = MARKET_STATUS_MAP.get(event.market_impact ?? '');
                    const c = STATUS_COLOR_CLASSES[s?.color ?? 'slate'];
                    return (
                      <div
                        key={`${event.id}-w${wStart}`}
                        className={cn(
                          'absolute flex items-center px-2.5 rounded cursor-pointer',
                          'border transition-all duration-150 overflow-hidden',
                          c.bg, c.border,
                          hovered?.id === event.id && 'brightness-125 ring-1 ring-white/30 z-20',
                        )}
                        style={{
                          left:   `${leftPct}%`,
                          width:  `max(${widthPct}%, 18px)`,
                          top:    PAD + track * (BAR_H + PAD),
                          height: BAR_H,
                        }}
                        onMouseEnter={ev => onEnter(event, ev)}
                        onMouseLeave={onLeave}
                      >
                        <span className={cn('text-[11px] font-medium truncate leading-tight', c.text)}>
                          {event.inference ?? ''}
                        </span>
                      </div>
                    );
                  })}

                  {/* Single-day stacked bar columns */}
                  {Array.from(singleDayMap.entries()).map(([day, dayEvents]) => {
                    const leftPct = ((day - wStart) / wDays) * 100;
                    const colW    = (1 / wDays) * 100;
                    return (
                      <div
                        key={`col-${day}`}
                        className="absolute flex flex-col"
                        style={{
                          left:   `calc(${leftPct}% + 1px)`,
                          width:  `calc(${colW}% - 2px)`,
                          top:    PAD,
                          bottom: PAD,
                          gap:    1,
                        }}
                      >
                        {dayEvents.map(event => {
                          const s = MARKET_STATUS_MAP.get(event.market_impact ?? '');
                          const c = STATUS_COLOR_CLASSES[s?.color ?? 'slate'];
                          return (
                            <div
                              key={event.id}
                              className={cn(
                                'flex-1 rounded-sm cursor-pointer transition-all',
                                c.bg,
                                hovered?.id === event.id && 'brightness-125 ring-1 ring-inset ring-white/30 z-20',
                              )}
                              title={s?.label}
                              onMouseEnter={ev => onEnter(event, ev)}
                              onMouseLeave={onLeave}
                            />
                          );
                        })}
                      </div>
                    );
                  })}

                  {/* Empty state */}
                  {!hasEvents && (
                    <span className="absolute inset-0 flex items-center px-3 text-[11px] text-slate-700">
                      No events
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tooltip — fixed to viewport */}
      {hovered && hoveredEvent && (() => {
        const s = MARKET_STATUS_MAP.get(hoveredEvent.market_impact ?? '');
        const c = STATUS_COLOR_CLASSES[s?.color ?? 'slate'];
        const tooltipW = 300;
        const left = Math.min(hovered.cx + 14, window.innerWidth - tooltipW - 16);
        const top  = hovered.cy - 10;
        return (
          <div
            className={cn(
              'fixed z-[9999] pointer-events-none rounded-xl border shadow-2xl',
              'bg-slate-900/98 backdrop-blur-sm', c.border,
            )}
            style={{ left, top, width: tooltipW }}
            onMouseEnter={() => { if (hideTimer.current) clearTimeout(hideTimer.current); }}
            onMouseLeave={onLeave}
          >
            <div className="p-3.5">
              {/* Impact badge */}
              {s && (
                <span className={cn('inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border mb-2', c.bg, c.text, c.border)}>
                  {s.label}
                </span>
              )}
              {/* Inference */}
              <p className="text-[12px] text-white leading-relaxed mb-2.5">
                {hoveredEvent.inference ?? '—'}
              </p>
              {/* Date + confidence */}
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <span className="text-[10px] font-mono text-muted">
                  {fmtDate(hoveredEvent.start_date)}
                  {hoveredEvent.end_date && hoveredEvent.end_date !== hoveredEvent.start_date
                    ? ` → ${fmtDate(hoveredEvent.end_date)}` : ''}
                </span>
                {hoveredEvent.confidence !== null && (
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 10 }, (_, i) => (
                      <div
                        key={i}
                        className={cn('w-1.5 h-2.5 rounded-sm', i < (hoveredEvent.confidence ?? 0) ? c.bg.replace('/10', '/80') : 'bg-white/5')}
                      />
                    ))}
                    <span className={cn('text-[10px] font-mono ml-1', c.text)}>{hoveredEvent.confidence}/10</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Impact legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-6 pt-4 border-t border-kd-border">
        <span className="text-[10px] uppercase tracking-widest font-bold text-muted self-center">Legend</span>
        {Array.from(MARKET_STATUS_MAP.values()).map(s => {
          const c = STATUS_COLOR_CLASSES[s.color];
          return (
            <div key={s.value} className="flex items-center gap-1.5">
              <div className={cn('w-3 h-3 rounded-sm border', c.bg, c.border)} />
              <span className="text-[11px] text-slate-400">{s.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────

export default function DCCalendarView() {
  const today = todayIso();
  const [year,  setYear]  = useState(2026);
  const [month, setMonth] = useState(4);
  const [view,  setView]  = useState<'calendar' | 'timeline'>('calendar');

  const { data: events = [], isLoading, isError, error } = useQuery({
    queryKey: ['dc_inference_calendar', year, month],
    queryFn:  () => fetchInferencesForMonth(year, month),
    staleTime: 60_000,
  });

  // Calendar grid: 7 cols, up to 6 rows
  const offset   = getFirstWeekdayOffset(year, month);
  const numDays  = getDaysInMonth(year, month);
  const totalCells = Math.ceil((offset + numDays) / 7) * 7;

  const cells = useMemo(() => Array.from({ length: totalCells }, (_, i) => {
    const dayNum = i - offset + 1;
    if (dayNum < 1 || dayNum > numDays) return null;
    const iso = toIso(year, month, dayNum);
    return {
      dayNum,
      iso,
      weekday: DAY_ABBR[i % 7],
      events: getActiveEventsForDay(iso, events),
      isToday: iso === today,
    };
  }), [offset, numDays, totalCells, year, month, events, today]);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  return (
    <ErrorBoundary>
      <div className="animate-fade-in">

        {/* Page header */}
        <header className="mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-white mb-1">
                Planetary Intelligence
              </h1>
              <p className="text-secondary font-medium">
                Astrological event calendar for Indian equity markets
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* View toggle */}
              <div className="flex bg-slate-900/60 border border-kd-border rounded-xl p-1 gap-1">
                <button
                  onClick={() => setView('calendar')}
                  title="Calendar view"
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
                    view === 'calendar' ? 'bg-accent-indigo/20 text-indigo-400' : 'text-slate-500 hover:text-slate-300',
                  )}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setView('timeline')}
                  title="Timeline view"
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
                    view === 'timeline' ? 'bg-accent-indigo/20 text-indigo-400' : 'text-slate-500 hover:text-slate-300',
                  )}
                >
                  <AlignLeft className="w-4 h-4" />
                </button>
              </div>

              {/* Month navigator */}
              <button
                onClick={prevMonth}
                className="w-9 h-9 rounded-xl border border-kd-border flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="text-center min-w-[140px]">
                <p className="text-xl font-bold text-white">{MONTH_FULL[month - 1]}</p>
                <p className="text-xs text-muted mono">{year}</p>
              </div>
              <button
                onClick={nextMonth}
                className="w-9 h-9 rounded-xl border border-kd-border flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center py-32 gap-3">
            <Loader2 className="w-5 h-5 text-accent-indigo animate-spin" />
            <span className="text-sm text-muted">Loading planetary data...</span>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <AlertCircle className="w-8 h-8 text-risk-red mb-4" />
            <p className="text-sm text-muted">{error instanceof Error ? error.message : 'Failed to load'}</p>
          </div>
        ) : (
          <>
            {/* Summary strip */}
            {events.length > 0 && (
              <MonthSummary events={events} year={year} month={month} />
            )}

            {view === 'calendar' ? (
              <>
                {/* Calendar grid */}
                <div className="glass-card rounded-3xl p-5">
                  {/* Day headers */}
                  <div className="grid grid-cols-7 mb-3">
                    {DAY_ABBR.map(d => (
                      <div key={d} className="text-center text-[11px] uppercase tracking-widest font-bold text-muted py-2">
                        {d}
                      </div>
                    ))}
                  </div>

                  {/* Day cells */}
                  <div className="grid grid-cols-7 gap-2">
                    {cells.map((cell, i) =>
                      cell ? (
                        <DayCell
                          key={cell.iso}
                          dayIso={cell.iso}
                          dayNum={cell.dayNum}
                          weekday={cell.weekday}
                          events={cell.events}
                          isToday={cell.isToday}
                          isCurrentMonth
                        />
                      ) : (
                        <div key={`empty-${i}`} className="min-h-[130px]" />
                      )
                    )}
                  </div>
                </div>

                {/* Legend */}
                <Legend />

                {/* Footer */}
                <p className="text-[10px] text-muted text-right mt-4 mono">
                  Kāla-Drishti · {events.length} events · {MONTH_FULL[month - 1]} {year}
                </p>
              </>
            ) : (
              <TimelineView events={events} year={year} month={month} />
            )}
          </>
        )}
      </div>
    </ErrorBoundary>
  );
}
