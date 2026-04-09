import { cn } from '@/lib/utils';
import { useOutlookInferences } from '@/hooks';
import { MARKET_STATUS_MAP, STATUS_COLOR_CLASSES } from '@/constants/marketStatus';
import { MONTH_ABBR } from '@/lib/dateUtils';
import type { DcInference } from '@/types';

// ── Date helpers (UTC to avoid timezone shift) ────────────────────────────────

function parseUtc(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatUtc(dt: Date): string {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const DOW_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getNextTradingDays(fromDate: string, count: number): string[] {
  const days: string[] = [];
  const dt = parseUtc(fromDate);
  dt.setUTCDate(dt.getUTCDate() + 1); // start tomorrow
  while (days.length < count) {
    const dow = dt.getUTCDay(); // 0=Sun, 6=Sat
    if (dow !== 0 && dow !== 6) days.push(formatUtc(dt));
    dt.setUTCDate(dt.getUTCDate() + 1);
  }
  return days;
}

function dayLabel(iso: string) {
  const dt = parseUtc(iso);
  return {
    dow: DOW_ABBR[dt.getUTCDay()],
    dd:  String(dt.getUTCDate()),
    mon: MONTH_ABBR[dt.getUTCMonth()],
  };
}

function isActiveOnDay(inf: DcInference, day: string): boolean {
  if (inf.end_date === null) return inf.start_date === day;
  return inf.start_date <= day && inf.end_date >= day;
}

// ── Color dot ─────────────────────────────────────────────────────────────────

const COLOR_DOT: Record<string, string> = {
  green:  'bg-risk-green',
  red:    'bg-risk-red',
  amber:  'bg-risk-amber',
  violet: 'bg-accent-violet',
  blue:   'bg-accent-indigo',
  slate:  'bg-slate-400',
};

function dotClass(impact: string | null): string {
  if (!impact) return 'bg-slate-600';
  const opt = MARKET_STATUS_MAP.get(impact);
  return opt ? (COLOR_DOT[opt.color] ?? 'bg-slate-600') : 'bg-slate-600';
}

function textClass(impact: string | null): string {
  if (!impact) return 'text-muted';
  const opt = MARKET_STATUS_MAP.get(impact);
  return opt ? STATUS_COLOR_CLASSES[opt.color].text : 'text-muted';
}

// ── Day cell ──────────────────────────────────────────────────────────────────

function DayCell({ day, inferences }: { day: string; inferences: DcInference[] }) {
  const { dow, dd, mon } = dayLabel(day);
  const active = inferences
    .filter(inf => isActiveOnDay(inf, day))
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
    .slice(0, 3);

  return (
    <div className={cn(
      'flex flex-col gap-1.5 px-2 py-2.5 rounded-xl border transition-all min-w-0',
      active.length > 0 ? 'border-kd-border-active bg-kd-elevated/40' : 'border-kd-border bg-kd-elevated/20',
    )}>
      {/* Day + date */}
      <div className="text-center leading-none">
        <div className={cn('text-[10px] font-bold uppercase tracking-wider',
          active.length > 0 ? 'text-[var(--text-secondary)]' : 'text-muted'
        )}>
          {dow}
        </div>
        <div className="text-[9px] mono text-muted mt-0.5">{dd} {mon}</div>
      </div>

      {/* Inferences as colored dots only — hover for detail */}
      <div className="flex flex-wrap gap-1 justify-center min-h-[16px] mt-0.5">
        {active.length === 0 ? (
          <span className="text-[9px] text-muted">—</span>
        ) : (
          active.map(inf => {
            const opt = MARKET_STATUS_MAP.get(inf.market_impact ?? '');
            const tip = `${inf.astro_event}${opt ? ` · ${opt.label}` : ''}`;
            return (
              <span
                key={inf.id}
                className={cn('w-2.5 h-2.5 rounded-full shrink-0 cursor-default', dotClass(inf.market_impact))}
                title={tip}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend({ inferences }: { inferences: DcInference[] }) {
  // Collect unique impacts present in the data, preserving MARKET_STATUS order
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
            className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-semibold border', c.bg, c.text, c.border)}
          >
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
        <span className="text-[10px] text-muted">Mon – Fri · from DB</span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-6 gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 bg-kd-elevated rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-6 gap-1.5">
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
