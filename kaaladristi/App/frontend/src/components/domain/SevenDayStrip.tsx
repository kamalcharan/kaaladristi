import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useOutlookInferences } from '@/hooks';
import { MARKET_STATUS_MAP, STATUS_COLOR_CLASSES } from '@/constants/marketStatus';
import type { DcInference } from '@/types';

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

function getNextTradingDays(fromDate: string, count: number): string[] {
  const days: string[] = [];
  const dt = parseUtc(fromDate);
  dt.setUTCDate(dt.getUTCDate() + 1);
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

function isActiveOnDay(inf: DcInference, day: string): boolean {
  if (inf.end_date === null) return inf.start_date === day;
  return inf.start_date <= day && inf.end_date >= day;
}

// ── Color helpers ─────────────────────────────────────────────────────────────

const COLOR_DOT: Record<string, string> = {
  green:  'bg-risk-green',
  red:    'bg-risk-red',
  amber:  'bg-risk-amber',
  violet: 'bg-accent-violet',
  blue:   'bg-accent-indigo',
  slate:  'bg-slate-500',
};

function dotClass(impact: string | null): string {
  const opt = MARKET_STATUS_MAP.get(impact ?? '');
  return opt ? (COLOR_DOT[opt.color] ?? 'bg-slate-500') : 'bg-slate-500';
}

// ── Day cell ──────────────────────────────────────────────────────────────────

function DayCell({ day, inferences }: { day: string; inferences: DcInference[] }) {
  const { dow, dd, mon } = dayLabel(day);
  const [showTip, setShowTip] = useState(false);
  const active = inferences
    .filter(inf => isActiveOnDay(inf, day))
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
    .slice(0, 5);

  const hasEvents = active.length > 0;

  return (
    <div
      className={cn(
        'relative flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border transition-all cursor-default',
        hasEvents ? 'border-kd-border-active' : 'border-kd-border',
      )}
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      <span className="text-[9px] font-bold uppercase tracking-wider text-muted">{dow}</span>
      <span className="text-[17px] font-bold mono text-[var(--text-primary)] leading-none">{dd}</span>
      <span className="text-[8px] text-muted uppercase tracking-wide">{mon}</span>

      {/* Dots row */}
      <div className="flex items-center gap-0.5 mt-0.5 h-3">
        {active.length === 0 ? (
          <span className="w-2 h-2 rounded-full bg-kd-border opacity-40" />
        ) : (
          active.map(inf => (
            <span
              key={inf.id}
              className={cn('w-2 h-2 rounded-full', dotClass(inf.market_impact))}
            />
          ))
        )}
      </div>

      {/* Rich tooltip */}
      {showTip && hasEvents && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-56 p-3 rounded-lg bg-kd-surface border border-kd-border shadow-xl"
          style={{ pointerEvents: 'none' }}
        >
          <div className="text-[10px] font-bold mono text-[var(--text-primary)] mb-2">
            {dd} {mon} · {dow}
          </div>
          {active.map(inf => {
            const opt = MARKET_STATUS_MAP.get(inf.market_impact ?? '');
            const impactColor = opt ? (STATUS_COLOR_CLASSES[opt.color]?.text ?? 'text-muted') : 'text-muted';
            return (
              <div key={inf.id} className="mb-2 pb-1.5 border-b border-kd-border last:border-0 last:mb-0 last:pb-0">
                <div className={cn('text-[9px] font-semibold', impactColor)}>
                  {inf.astro_event}
                </div>
                <div className="text-[8px] text-muted mt-0.5">
                  {inf.start_date}{inf.end_date && inf.end_date !== inf.start_date ? ` → ${inf.end_date}` : ''}
                  {opt && <span className={cn('ml-1 uppercase', impactColor)}>· {opt.label}</span>}
                </div>
                {inf.inference && (
                  <div className="text-[8px] text-[var(--accent-gold)] italic mt-1">
                    "{inf.inference}"
                  </div>
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

function Legend({ inferences }: { inferences: DcInference[] }) {
  const seen = new Set<string>();
  for (const inf of inferences) {
    if (inf.market_impact) seen.add(inf.market_impact);
  }
  if (seen.size === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-3 pt-2.5 border-t border-kd-border">
      {[...seen].map(impact => {
        const opt = MARKET_STATUS_MAP.get(impact);
        if (!opt) return null;
        const c = STATUS_COLOR_CLASSES[opt.color];
        return (
          <span
            key={impact}
            className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-semibold border', c.bg, c.text, c.border)}
          >
            <span className={cn('w-1.5 h-1.5 rounded-full', COLOR_DOT[opt.color])} />
            {opt.label}
          </span>
        );
      })}
    </div>
  );
}

// ── Strip ─────────────────────────────────────────────────────────────────────

export default function SevenDayStrip({ selectedDate }: { selectedDate: string }) {
  const tradingDays = getNextTradingDays(selectedDate, 6);
  const { data: inferences = [], isLoading } = useOutlookInferences(selectedDate);

  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-bold text-[var(--text-primary)]">6-Day Outlook</h3>
        <span className="text-[10px] text-muted">Mon – Fri · inference</span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-6 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 bg-kd-elevated rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-6 gap-2">
            {tradingDays.map(day => (
              <DayCell key={day} day={day} inferences={inferences} />
            ))}
          </div>
          <Legend inferences={inferences} />
        </>
      )}
    </div>
  );
}
