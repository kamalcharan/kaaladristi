import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { from } from '@/services/postgrest';
import { ASTRO_SIGNAL_CLASSES, ASTRO_SIGNAL_LABELS, impactToColor } from '@/constants/astroSignals';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AstroEvent {
  display_name: string;
  start_date: string;
  end_date: string;
  market_impact: string;
  inference: string | null;
}

// ── Date helpers (UTC — avoids IST timezone shift) ────────────────────────────

const DOW_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseUtc(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatUtc(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function dayDiff(a: string, b: string): number {
  return Math.round((parseUtc(b).getTime() - parseUtc(a).getTime()) / 86_400_000);
}

function getTradingDays(fromDate: string, count: number): string[] {
  const days: string[] = [];
  const dt = parseUtc(fromDate);
  while (days.length < count) {
    const dow = dt.getUTCDay();
    if (dow !== 0 && dow !== 6) days.push(formatUtc(dt));
    dt.setUTCDate(dt.getUTCDate() + 1);
  }
  return days;
}

function dayLabel(iso: string) {
  const dt = parseUtc(iso);
  return { dow: DOW_ABBR[dt.getUTCDay()], dd: String(dt.getUTCDate()), mon: MON_ABBR[dt.getUTCMonth()] };
}

function isActiveOnDay(event: AstroEvent, day: string): boolean {
  return event.start_date <= day && event.end_date >= day;
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchEventsForRange(firstDay: string, lastDay: string): Promise<AstroEvent[]> {
  const { data, error } = await from('km_astro_calendar_2026')
    .select('display_name,start_date,end_date,market_impact,inference')
    .lte('start_date', lastDay)
    .gte('end_date', firstDay)
    .order('start_date', { ascending: true })
    .execute();

  if (error) throw new Error(`[km_astro_calendar_2026] ${error.message}`);
  return (data ?? []) as AstroEvent[];
}

// ── Color dot mapping (mirrors SevenDayStrip COLOR_DOT) ───────────────────────

const COLOR_DOT: Record<string, string> = {
  green: 'bg-risk-green',
  red:   'bg-risk-red',
  amber: 'bg-risk-amber',
  slate: 'bg-slate-500',
};

function dotClass(impact: string): string {
  return COLOR_DOT[impactToColor(impact)] ?? 'bg-slate-500';
}

// ── Day cell (exact layout from SevenDayStrip) ────────────────────────────────

function DayCell({ day, events, isToday }: {
  day: string;
  events: AstroEvent[];
  isToday: boolean;
}) {
  const { dow, dd, mon } = dayLabel(day);
  const [showTip, setShowTip] = useState(false);

  // Day-level events only: duration <= 1 day, active on this day
  const active = events
    .filter(e => isActiveOnDay(e, day) && dayDiff(e.start_date, e.end_date) <= 1)
    .slice(0, 5);

  const hasEvents = active.length > 0;

  return (
    <div
      className={cn(
        'relative flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border transition-all cursor-default',
        hasEvents ? 'border-kd-border-active' : 'border-kd-border',
        isToday && 'ring-2 ring-accent-indigo/60 ring-offset-1 ring-offset-kd-bg',
      )}
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      <span className="text-[9px] font-bold uppercase tracking-wider text-muted">{dow}</span>
      <span className={cn(
        'text-[17px] font-bold mono leading-none',
        isToday ? 'text-accent-indigo' : 'text-[var(--text-primary)]',
      )}>{dd}</span>
      <span className="text-[8px] text-muted uppercase tracking-wide">{mon}</span>

      {/* Dots row */}
      <div className="flex items-center gap-0.5 mt-0.5 h-3">
        {active.length === 0 ? (
          <span className="w-2 h-2 rounded-full bg-kd-border opacity-40" />
        ) : (
          active.map((e, i) => (
            <span
              key={i}
              className={cn('w-2 h-2 rounded-full', dotClass(e.market_impact))}
            />
          ))
        )}
      </div>

      {/* Tooltip */}
      {showTip && hasEvents && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-56 p-3 rounded-lg bg-kd-surface border border-kd-border shadow-xl"
          style={{ pointerEvents: 'none' }}
        >
          <div className="text-[10px] font-bold mono text-[var(--text-primary)] mb-2">
            {dd} {mon} · {dow}
          </div>
          {active.map((e, i) => {
            const c = ASTRO_SIGNAL_CLASSES[impactToColor(e.market_impact)];
            const label = ASTRO_SIGNAL_LABELS[e.market_impact] ?? e.market_impact;
            return (
              <div key={i} className="mb-2 pb-1.5 border-b border-kd-border last:border-0 last:mb-0 last:pb-0">
                <div className={cn('text-[9px] font-semibold', c.text)}>
                  {e.display_name}
                </div>
                <div className="text-[8px] text-muted mt-0.5">
                  {e.start_date}
                  <span className={cn('ml-1 uppercase', c.text)}>· {label}</span>
                </div>
                {e.inference ? (
                  <div className="text-[8px] text-[var(--accent-gold)] italic mt-1">
                    "{e.inference}"
                  </div>
                ) : (
                  <div className="text-[8px] text-muted mt-1">No inference recorded</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend({ events }: { events: AstroEvent[] }) {
  const seen = new Set<string>();
  for (const e of events) seen.add(e.market_impact);
  if (seen.size === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-3 pt-2.5 border-t border-kd-border">
      {[...seen].map(impact => {
        const c     = ASTRO_SIGNAL_CLASSES[impactToColor(impact)];
        const label = ASTRO_SIGNAL_LABELS[impact] ?? impact;
        return (
          <span
            key={impact}
            className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-semibold border', c.bg, c.text, c.border)}
          >
            <span className={cn('w-1.5 h-1.5 rounded-full', COLOR_DOT[impactToColor(impact)] ?? 'bg-slate-500')} />
            {label}
          </span>
        );
      })}
    </div>
  );
}

// ── Strip ─────────────────────────────────────────────────────────────────────

export default function DailyEventStrip({ selectedDate }: { selectedDate: string }) {
  const tradingDays = getTradingDays(selectedDate, 7);
  const today       = todayIso();
  const lastDay     = tradingDays[tradingDays.length - 1];

  const { data: allEvents = [], isLoading } = useQuery({
    queryKey: ['daily_event_strip', selectedDate],
    queryFn: () => fetchEventsForRange(tradingDays[0], lastDay),
    staleTime: 30 * 60 * 1000,
    enabled: tradingDays.length > 0,
  });

  // Only day-level events (duration <= 1) are shown in cells; pass all to Legend
  const dayLevelEvents = allEvents.filter(e => dayDiff(e.start_date, e.end_date) <= 1);

  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-bold text-[var(--text-primary)]">7-Day Outlook</h3>
        <span className="text-[10px] text-muted">Mon – Fri · daily events</span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-16 bg-kd-elevated rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-2">
            {tradingDays.map(day => (
              <DayCell
                key={day}
                day={day}
                events={allEvents}
                isToday={day === today}
              />
            ))}
          </div>
          <Legend events={dayLevelEvents} />
        </>
      )}
    </div>
  );
}
