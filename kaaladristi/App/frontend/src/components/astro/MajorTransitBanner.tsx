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

// ── Date helpers ──────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseUtc(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function dayDiff(a: string, b: string): number {
  return Math.round((parseUtc(b).getTime() - parseUtc(a).getTime()) / 86_400_000);
}

function fmtShort(iso: string): string {
  return parseUtc(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', timeZone: 'UTC',
  });
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchActiveEvents(today: string): Promise<AstroEvent[]> {
  const { data, error } = await from('km_astro_calendar_2026')
    .select('display_name,start_date,end_date,market_impact,inference')
    .lte('start_date', today)
    .gte('end_date', today)
    .order('start_date', { ascending: true })
    .execute();

  if (error) throw new Error(`[km_astro_calendar_2026] ${error.message}`);
  return (data ?? []) as AstroEvent[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MajorTransitBanner() {
  const today = todayIso();

  const { data: allEvents = [] } = useQuery({
    queryKey: ['major_transits', today],
    queryFn: () => fetchActiveEvents(today),
    staleTime: 24 * 60 * 60 * 1000,
  });

  // Filter: spanning more than 30 days
  const majors = allEvents.filter(e => dayDiff(e.start_date, e.end_date) > 30);

  if (majors.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {majors.map((event, i) => {
        const c      = ASTRO_SIGNAL_CLASSES[impactToColor(event.market_impact)];
        const label  = ASTRO_SIGNAL_LABELS[event.market_impact] ?? event.market_impact;
        const total  = dayDiff(event.start_date, event.end_date);
        const elapsed = dayDiff(event.start_date, today);
        const pct    = Math.min(100, Math.round((elapsed / total) * 100));

        return (
          <div
            key={i}
            className={cn(
              'rounded-2xl border p-4 space-y-3',
              c.bg, c.border,
            )}
          >
            {/* Header row */}
            <div className="flex items-start justify-between gap-3">
              <p className={cn('text-sm font-bold leading-tight', c.text)}>
                {event.display_name}
              </p>
              <span className={cn(
                'shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border',
                c.bg, c.text, c.border,
              )}>
                {label}
              </span>
            </div>

            {/* Date range */}
            <p className="text-[11px] text-muted font-mono">
              {fmtShort(event.start_date)} → {fmtShort(event.end_date)}
            </p>

            {/* Inference */}
            {event.inference && (
              <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
                {event.inference}
              </p>
            )}

            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted">
                  Day {elapsed} of {total}
                </span>
                <span className={cn('text-[10px] font-bold', c.text)}>{pct}%</span>
              </div>
              <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', c.border.replace('border-', 'bg-').replace('/40', '/60'))}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
