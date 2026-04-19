import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAstroWeek } from '@/hooks';
import { from } from '@/services/postgrest';
import { signalColor, signalLabel, addDays, daysBetween } from '@/lib/astroSignalUtils';
import type { AstroSignal } from '@/types';

// ── Types ──────────────────────────────────────────────────────────────────────

interface TransitEvent {
  display_name: string;
  start_date: string;
  end_date: string | null;
  market_impact: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function utcDate(d: string) {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

function dayName(d: string) {
  return utcDate(d).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

function dayDateLabel(d: string) {
  return utcDate(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function isWeekend(d: string) {
  const dow = utcDate(d).getUTCDay();
  return dow === 0 || dow === 6;
}

function fmtShort(d: string) {
  return utcDate(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// ── Transit bar layer ──────────────────────────────────────────────────────────

function TransitBar({ event, today }: { event: TransitEvent; today: string }) {
  const color = signalColor(event.market_impact);

  // 7-day grid: today = col 0, today+6 = col 6
  const startOffset = daysBetween(today, event.start_date);
  const endOffset   = event.end_date ? daysBetween(today, event.end_date) : 6;

  const gridStart = Math.max(0, startOffset);
  const gridEnd   = Math.min(6, endOffset);

  // left% = left edge of starting column, right% = right edge of ending column
  const leftPct  = (gridStart / 7) * 100;
  const rightPct = ((gridEnd + 1) / 7) * 100;
  const widthPct = rightPct - leftPct;

  const label = `${event.display_name} — ${fmtShort(event.start_date)} → ${event.end_date ? fmtShort(event.end_date) : '…'}`;

  const DOT = 12; // px

  return (
    <div className="relative w-full" style={{ height: '20px' }}>
      {/* Bar */}
      <div
        className="absolute"
        style={{
          left: `${leftPct}%`,
          width: `${widthPct}%`,
          top: '50%',
          height: '3px',
          backgroundColor: color.bg,
          transform: 'translateY(-50%)',
          borderRadius: '2px',
        }}
      />

      {/* Left dot */}
      <div
        className="absolute"
        style={{
          left: `${leftPct}%`,
          top: '50%',
          width: `${DOT}px`,
          height: `${DOT}px`,
          borderRadius: '50%',
          backgroundColor: color.bg,
          transform: 'translate(-50%, -50%)',
          zIndex: 1,
        }}
      />

      {/* Right dot */}
      <div
        className="absolute"
        style={{
          left: `${rightPct}%`,
          top: '50%',
          width: `${DOT}px`,
          height: `${DOT}px`,
          borderRadius: '50%',
          backgroundColor: color.bg,
          transform: 'translate(-50%, -50%)',
          zIndex: 1,
        }}
      />

      {/* Centered label */}
      <span
        className="absolute top-1/2 text-[8px] font-semibold truncate select-none pointer-events-none"
        style={{
          left: `calc(${leftPct}% + ${DOT / 2}px)`,
          width: `calc(${widthPct}% - ${DOT}px)`,
          textAlign: 'center',
          transform: 'translateY(-50%)',
          color: color.text,
          lineHeight: 1,
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ── Day card ───────────────────────────────────────────────────────────────────

function DayCard({
  signal, isToday,
}: { signal: AstroSignal; isToday: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const color = signalColor(signal.net_signal);
  const score = signal.net_score > 0 ? `+${signal.net_score}` : `${signal.net_score}`;

  return (
    <button
      onClick={() => setExpanded(v => !v)}
      className={[
        'flex flex-col items-center text-center rounded-xl px-2 py-2.5 flex-1 min-w-0 transition-colors',
        isToday
          ? 'border-2 border-accent-indigo/70 bg-accent-indigo/5'
          : 'border border-kd-border hover:bg-kd-elevated/40',
      ].join(' ')}
    >
      <span className={['text-[10px] font-bold uppercase tracking-widest leading-tight', isToday ? 'text-accent-indigo' : 'text-muted'].join(' ')}>
        {dayName(signal.trade_date)}
      </span>
      <span className="text-[9px] text-muted leading-tight mb-1">
        {dayDateLabel(signal.trade_date)}
      </span>
      <span
        className="px-2 py-0.5 rounded text-[9px] font-bold w-full leading-tight"
        style={{ backgroundColor: color.bg, color: color.text }}
      >
        {signal.turning_date ? '⚡ ' : ''}{signalLabel(signal.net_signal)}
      </span>
      <span className="text-[10px] font-mono font-semibold text-[var(--text-secondary)] mt-1">
        {score}
      </span>

      {expanded && (
        <div className="mt-2 pt-2 border-t border-kd-border w-full text-left flex flex-col gap-0.5">
          {signal.primary_event && (
            <p className="text-[9px] text-[var(--text-primary)] leading-snug">{signal.primary_event}</p>
          )}
          {signal.secondary_event && (
            <p className="text-[9px] text-muted leading-snug">{signal.secondary_event}</p>
          )}
          <p className="text-[8px] text-muted mt-0.5">
            {signal.active_event_count} event{signal.active_event_count !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </button>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────

export default function AstroSignalWeekPanel({ date }: { date: string }) {
  const weekEnd = addDays(date, 7); // exclusive

  // Daily signals — 7 days, filter weekends in JS
  const { data: allSignals = [], isLoading, isError } = useAstroWeek(date);
  const signals = allSignals.filter(s => !isWeekend(s.trade_date));

  // Transit bars — multi-day spanning events via PostgREST
  const { data: transits = [] } = useQuery({
    queryKey: ['astro_transits_db', date],
    queryFn: async (): Promise<TransitEvent[]> => {
      const { data, error } = await from('km_astro_calendar_2026')
        .select('display_name,start_date,end_date,market_impact')
        .lte('start_date', weekEnd)
        .order('start_date', { ascending: true })
        .execute();
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as TransitEvent[];
      const today = date;
      return rows.filter(r => {
        // multi-day only — skip single-day events
        if (!r.end_date || r.end_date === r.start_date) return false;
        // must overlap the week: end_date >= today
        return r.end_date >= today;
      });
    },
    staleTime: 24 * 60 * 60 * 1000,
    enabled: !!date,
  });

  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">🔭</span>
        <h3 className="text-[13px] font-bold text-[var(--text-primary)]">Astro Signal — Week Ahead</h3>
      </div>

      {/* Layer 1 — Transit bars */}
      {transits.length > 0 && (
        <div className="flex flex-col gap-1 mb-4 px-1">
          {transits.map((t, i) => (
            <TransitBar key={i} event={t} today={date} />
          ))}
        </div>
      )}

      {/* Layer 2 — Weekday signal cards */}
      {isLoading ? (
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex-1 h-20 bg-kd-elevated rounded-xl animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-[11px] text-muted text-center py-4">Astro data unavailable</p>
      ) : (
        <div className="flex gap-2">
          {signals.map(signal => (
            <DayCard
              key={signal.trade_date}
              signal={signal}
              isToday={signal.trade_date === date}
            />
          ))}
        </div>
      )}
    </div>
  );
}
