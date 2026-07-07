/**
 * AlmanacTab — planetary almanac view of a rule's transit windows
 * ================================================================
 * Renders a rule's km_rule_transits windows in the classic ephemeris-table
 * format (owner reference screenshot, 2026-07-06):
 *
 *   START DATE | END DATE | TOTAL DAYS | DETAIL | LORD
 *
 * DETAIL comes from conditions_snapshot (sign for sign transits, co-planet
 * for combined retrogrades, event/nakshatra for day rules).
 * LORD is the vaar (weekday) lord of the window's START date — verified
 * against the owner's reference tables (e.g. 02-Jul-26 Thursday → Jupiter).
 *
 * Unlike the Transits tab (backtest view, past windows only), the almanac
 * is forward-looking: it shows every generated window, filtered by year.
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { from } from '@/services/postgrest';
import { cn } from '@/lib/utils';

// ── Vaar (day) lord — universal Vedic constant, Sunday-first ────────────────
const DAY_LORDS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'] as const;

function vaarLord(isoDate: string): string {
  return DAY_LORDS[new Date(isoDate + 'T00:00:00').getDay()];
}

const LORD_COLORS: Record<string, string> = {
  Sun: 'text-risk-amber', Moon: 'text-secondary', Mars: 'text-risk-red/80',
  Mercury: 'text-risk-green', Jupiter: 'text-accent-gold', Venus: 'text-accent-violet',
  Saturn: 'text-accent-indigo',
};

// ── Window fetch — all windows including future (almanac, not backtest) ─────

interface AlmanacWindow {
  id: number;
  start_date: string;
  end_date: string;
  duration_days: number;
  conditions_snapshot: Record<string, unknown> | null;
}

async function fetchAlmanacWindows(ruleId: number): Promise<AlmanacWindow[]> {
  const { data, error } = await from('km_rule_transits')
    .select('id,start_date,end_date,duration_days,conditions_snapshot')
    .eq('rule_id', ruleId)
    .order('start_date', { ascending: true })
    .limit(2000)
    .execute();
  if (error) throw new Error(error.message);
  return (data as AlmanacWindow[]) ?? [];
}

/** Human-readable detail from the window's conditions snapshot. */
function windowDetail(snap: Record<string, unknown> | null): string {
  if (!snap) return '—';
  if (typeof snap.sign === 'string') return snap.sign;
  if (typeof snap.co_planet === 'string') return `+ ${snap.co_planet} retro`;
  if (typeof snap.moon_nakshatra === 'string') return `Moon in ${snap.moon_nakshatra}`;
  if (typeof snap.event === 'string') return String(snap.event).replace(/_/g, ' ');
  if (typeof snap.rule_type === 'string') return String(snap.rule_type).replace(/_/g, ' ');
  return '—';
}

// ── Tab ──────────────────────────────────────────────────────────────────────

export default function AlmanacTab({ ruleId }: { ruleId: number }) {
  const { data: windows = [], isLoading } = useQuery({
    queryKey: ['rule-engine', 'almanac', ruleId],
    queryFn: () => fetchAlmanacWindows(ruleId),
    enabled: !isNaN(ruleId),
    staleTime: 10 * 60 * 1000,
  });

  const years = useMemo(
    () => Array.from(new Set(windows.map(w => w.start_date.slice(0, 4)))).sort(),
    [windows],
  );
  const currentYear = String(new Date().getFullYear());
  const [year, setYear] = useState<string | null>(null);
  const effectiveYear = year ?? (years.includes(currentYear) ? currentYear : years[years.length - 1] ?? null);

  const rows = useMemo(
    () => effectiveYear ? windows.filter(w => w.start_date.startsWith(effectiveYear)) : windows,
    [windows, effectiveYear],
  );

  const today = new Date().toISOString().slice(0, 10);
  const hasDetail = rows.some(w => windowDetail(w.conditions_snapshot) !== '—');

  if (isLoading) return <p className="px-4 py-6 text-sm text-muted text-center">Loading almanac…</p>;
  if (windows.length === 0) {
    return <p className="px-4 py-6 text-sm text-muted text-center">No windows generated — run the transit generator for this rule</p>;
  }

  return (
    <div>
      {/* Year chips */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-kd-border/60 overflow-x-auto">
        <span className="text-[10px] font-mono text-muted uppercase tracking-wider mr-1 shrink-0">Year</span>
        {years.map(y => (
          <button
            key={y}
            onClick={() => setYear(y)}
            className={cn(
              'px-2.5 py-1 rounded-full text-[11px] font-mono transition-colors shrink-0',
              y === effectiveYear
                ? 'bg-accent-gold/15 text-accent-gold border border-accent-gold/40'
                : 'text-muted border border-kd-border hover:text-secondary',
            )}
          >
            {y}
          </button>
        ))}
      </div>

      {/* Almanac table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-kd-border bg-kd-elevated/60">
              {['Start Date', 'End Date', 'Total Days', ...(hasDetail ? ['Detail'] : []), 'Lord'].map(h => (
                <th key={h} className="text-left text-[10px] font-mono text-muted px-3 py-2.5 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(w => {
              const live = w.start_date <= today && w.end_date >= today;
              const lord = vaarLord(w.start_date);
              return (
                <tr
                  key={w.id}
                  className={cn(
                    'border-b border-kd-border/40 transition-colors hover:bg-kd-elevated/40',
                    live && 'bg-accent-gold/8 border-l-2 border-l-accent-gold',
                  )}
                >
                  <td className="px-3 py-2.5 text-xs font-mono text-[var(--text-primary)] whitespace-nowrap tabular-nums">
                    {w.start_date}
                    {live && <span className="ml-2 text-[9px] font-mono text-accent-gold animate-pulse">◉ ACTIVE</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs font-mono text-secondary whitespace-nowrap tabular-nums">{w.end_date}</td>
                  <td className="px-3 py-2.5 text-xs tabular-nums text-center text-muted">{w.duration_days}</td>
                  {hasDetail && (
                    <td className="px-3 py-2.5 text-xs text-secondary whitespace-nowrap">{windowDetail(w.conditions_snapshot)}</td>
                  )}
                  <td className={cn('px-3 py-2.5 text-xs font-mono whitespace-nowrap', LORD_COLORS[lord] ?? 'text-secondary')}>
                    {lord}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="px-4 py-2.5 text-[10px] text-muted border-t border-kd-border/40">
        Lord = weekday lord of the window's start date. Dates are ephemeris-day precision; exact start/end times not yet computed.
      </p>
    </div>
  );
}
