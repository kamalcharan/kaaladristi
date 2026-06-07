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
  const { data, error } = await from('km_astro_calendar')
    .select('display_name,start_date,end_date,market_impact,inference')
    .lte('start_date', today)
    .gte('end_date', today)
    .order('start_date', { ascending: true })
    .execute();

  if (error) throw new Error(`[km_astro_calendar] ${error.message}`);
  return (data ?? []) as AstroEvent[];
}

// ── Chip ──────────────────────────────────────────────────────────────────────

function TransitChip({ event }: { event: AstroEvent }) {
  const [showTip, setShowTip] = useState(false);
  const c     = ASTRO_SIGNAL_CLASSES[impactToColor(event.market_impact)];
  const label = ASTRO_SIGNAL_LABELS[event.market_impact] ?? event.market_impact;

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      <div className={cn(
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-default select-none',
        c.bg, c.border,
      )}>
        {/* Impact dot */}
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', c.text.replace('text-', 'bg-'))} />
        <span className={cn('text-[11px] font-semibold', c.text)}>
          {event.display_name}
        </span>
        <span className="text-[10px] text-muted font-mono">
          {fmtShort(event.start_date)}–{fmtShort(event.end_date)}
        </span>
      </div>

      {/* Tooltip */}
      {showTip && (
        <div
          className="absolute bottom-full left-0 mb-2 z-50 w-60 p-3 rounded-xl bg-kd-surface border border-kd-border shadow-2xl"
          style={{ pointerEvents: 'none' }}
        >
          <div className={cn('text-[10px] font-bold mb-1 uppercase tracking-wide', c.text)}>
            {label}
          </div>
          <div className="text-[10px] font-mono text-muted mb-2">
            {fmtShort(event.start_date)} → {fmtShort(event.end_date)}
          </div>
          {event.inference ? (
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed italic">
              "{event.inference}"
            </p>
          ) : (
            <p className="text-[11px] text-muted">No inference recorded.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MinorTransitBar() {
  const today = todayIso();

  const { data: allEvents = [] } = useQuery({
    queryKey: ['minor_transits', today],
    queryFn: () => fetchActiveEvents(today),
    staleTime: 24 * 60 * 60 * 1000,
  });

  // Filter: duration between 1 and 30 days (inclusive)
  const minors = allEvents.filter(e => {
    const d = dayDiff(e.start_date, e.end_date);
    return d >= 1 && d <= 30;
  });

  if (minors.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {minors.map((event, i) => (
        <TransitChip key={i} event={event} />
      ))}
    </div>
  );
}
