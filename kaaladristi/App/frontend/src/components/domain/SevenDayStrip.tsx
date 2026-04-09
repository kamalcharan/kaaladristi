import { cn } from '@/lib/utils';
import { useOutlookInferences } from '@/hooks';
import { MARKET_STATUS_MAP, STATUS_COLOR_CLASSES } from '@/constants/marketStatus';
import { MONTH_ABBR } from '@/lib/dateUtils';
import type { DcInference } from '@/types';

// ── Date helpers ──────────────────────────────────────────────────────────────

function getNextTradingDays(fromDate: string, count: number): string[] {
  const days: string[] = [];
  const d = new Date(fromDate + 'T00:00:00');
  d.setDate(d.getDate() + 1); // start tomorrow
  while (days.length < count) {
    const dow = d.getDay(); // 0=Sun, 6=Sat
    if (dow !== 0 && dow !== 6) {
      days.push(d.toISOString().slice(0, 10));
    }
    d.setDate(d.getDate() + 1);
  }
  return days;
}

const DOW_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayLabel(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return { dow: DOW_ABBR[d.getDay()], dd: String(d.getDate()), mon: MONTH_ABBR[d.getMonth()] };
}

function isActiveOnDay(inf: DcInference, day: string): boolean {
  if (inf.end_date === null) return inf.start_date === day;
  return inf.start_date <= day && inf.end_date >= day;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ImpactPill({ impact }: { impact: string | null }) {
  if (!impact) return null;
  const opt = MARKET_STATUS_MAP.get(impact);
  if (!opt) return null;
  const cls = STATUS_COLOR_CLASSES[opt.color];
  return (
    <span className={cn('text-[8px] font-bold px-1.5 py-0.5 rounded border', cls.text, cls.bg, cls.border)}>
      {opt.label}
    </span>
  );
}

function DayCell({ day, inferences }: { day: string; inferences: DcInference[] }) {
  const { dow, dd, mon } = dayLabel(day);
  const active = inferences
    .filter(inf => isActiveOnDay(inf, day))
    .sort((a, b) => {
      // prioritise higher confidence; fall back to start_date order
      return (b.confidence ?? 0) - (a.confidence ?? 0);
    })
    .slice(0, 2);

  return (
    <div className={cn(
      'flex flex-col gap-1.5 px-1.5 py-2 rounded-xl border transition-all',
      active.length > 0
        ? 'border-kd-border-active bg-kd-elevated/40'
        : 'border-kd-border bg-kd-elevated/20',
    )}>
      {/* Day + date */}
      <div className="text-center">
        <div className={cn('text-[9px] font-bold uppercase tracking-wider',
          active.length > 0 ? 'text-[var(--text-secondary)]' : 'text-muted'
        )}>
          {dow}
        </div>
        <div className="text-[10px] mono text-muted leading-none mt-0.5">
          {dd} {mon}
        </div>
      </div>

      {/* Inferences */}
      <div className="flex flex-col gap-1 min-h-[36px]">
        {active.length === 0 ? (
          <span className="text-[9px] text-muted text-center mt-1">—</span>
        ) : (
          active.map(inf => (
            <div key={inf.id} className="flex flex-col gap-0.5">
              <span className="text-[8px] text-[var(--text-secondary)] leading-snug truncate" title={inf.astro_event}>
                {inf.astro_event}
              </span>
              <ImpactPill impact={inf.market_impact} />
            </div>
          ))
        )}
      </div>
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
        <span className="text-[10px] text-muted">Mon – Fri · from DB</span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-6 gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 bg-kd-elevated rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-6 gap-1.5">
          {tradingDays.map(day => (
            <DayCell key={day} day={day} inferences={inferences} />
          ))}
        </div>
      )}
    </div>
  );
}
