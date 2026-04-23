import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Loader2, AlertCircle, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MONTH_FULL } from '@/lib/dateUtils';
import {
  fetchPanchangCalendar,
  type PanchangRow,
  LABEL_COLOR,
  LABEL_BG,
} from '@/services/panchangService';
// ── Helpers ───────────────────────────────────────────────────────────────────

function isWeekend(weekday: string) {
  return weekday === 'Saturday' || weekday === 'Sunday';
}

function formatNak(row: PanchangRow) {
  if (row.nakshatra_next && row.nakshatra_change_time)
    return `${row.nakshatra} → ${row.nakshatra_next} ${row.nakshatra_change_time}`;
  if (row.nakshatra_next)
    return `${row.nakshatra} → ${row.nakshatra_next}`;
  return row.nakshatra;
}

function formatRashi(row: PanchangRow) {
  if (row.moon_rashi_next && row.moon_rashi_change_time)
    return `${row.moon_rashi} → ${row.moon_rashi_next} ${row.moon_rashi_change_time}`;
  if (row.moon_rashi_next)
    return `${row.moon_rashi} → ${row.moon_rashi_next}`;
  return row.moon_rashi;
}

function formatTithi(row: PanchangRow) {
  if (row.tithi_end_time) return `${row.tithi} (till ${row.tithi_end_time})`;
  return row.tithi;
}

// ── Note pill ─────────────────────────────────────────────────────────────────

function NotePill({ label, scope, scopeValue }: {
  label: string;
  scope: string;
  scopeValue: string | null;
}) {
  const lbl = label as keyof typeof LABEL_COLOR;
  const displayLabel = label.replace('_', ' ');
  const displayScope = scopeValue ? `${scope}: ${scopeValue}` : scope;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border leading-none',
        LABEL_COLOR[lbl] ?? 'text-slate-400',
        LABEL_BG[lbl] ?? 'bg-slate-800/60 border-white/10',
      )}
    >
      {displayLabel}
      {scope !== 'market' && (
        <span className="opacity-70">· {displayScope}</span>
      )}
    </span>
  );
}

// ── Table row ─────────────────────────────────────────────────────────────────

function PanchangTableRow({ row }: { row: PanchangRow }) {
  const weekend = isWeekend(row.weekday);
  const parts = row.trade_date.split('-'); // YYYY-MM-DD
  const dd  = parts[2];
  const mmm = MONTH_FULL[parseInt(parts[1]) - 1]?.slice(0, 3);

  return (
    <tr
      className={cn(
        'border-b border-white/5 transition-colors hover:bg-white/[0.03]',
        weekend && 'opacity-40',
      )}
    >
      {/* Date */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-white">{dd} {mmm}</span>
          <span className="text-[10px] text-muted">{row.weekday.slice(0, 3)}</span>
        </div>
      </td>

      {/* Tithi */}
      <td className="px-3 py-2.5">
        <span className="text-xs text-secondary">{formatTithi(row)}</span>
      </td>

      {/* Moon Rashi */}
      <td className="px-3 py-2.5">
        <span className="text-xs text-secondary">{formatRashi(row)}</span>
      </td>

      {/* Nakshatra */}
      <td className="px-3 py-2.5">
        <span className="text-xs text-secondary">{formatNak(row)}</span>
      </td>

      {/* Nak Lord */}
      <td className="px-3 py-2.5">
        <span className="text-xs text-muted">{row.nak_lord}</span>
      </td>

      {/* Signals / Notes */}
      <td className="px-3 py-2.5">
        {row.notes.length === 0 ? (
          <span className="text-[10px] text-white/15">—</span>
        ) : (
          <div className="flex flex-col gap-1">
            {row.notes.map(n => (
              <div key={n.id} className="flex flex-col gap-0.5">
                <NotePill
                  label={n.calendar_label}
                  scope={n.scope}
                  scopeValue={n.scope_value}
                />
                {n.annotation && (
                  <span className="text-[10px] text-muted italic pl-0.5">{n.annotation}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </td>
    </tr>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function PanchangView() {
  const today   = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const { data, isLoading, error } = useQuery<PanchangRow[]>({
    queryKey: ['panchang_calendar', year, month],
    queryFn:  () => fetchPanchangCalendar(year, month),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  function prev() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function next() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Moon className="w-4 h-4 text-accent-indigo" />
          <h1 className="text-base font-semibold text-white">Panchang</h1>
          <span className="text-sm text-muted">09:15 IST · Lahiri Sidereal</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={prev}
            className="p-1.5 rounded-lg hover:bg-white/10 text-secondary transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {/* Month select */}
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            className="text-sm bg-slate-800/80 border border-white/10 rounded-lg px-2 py-1 text-white focus:outline-none focus:border-accent-indigo/50"
          >
            {MONTH_FULL.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
          {/* Year input */}
          <input
            type="number"
            value={year}
            onChange={e => {
              const v = Number(e.target.value);
              if (v >= 1900 && v <= 2100) setYear(v);
            }}
            className="w-20 text-sm bg-slate-800/80 border border-white/10 rounded-lg px-2 py-1 text-white text-center focus:outline-none focus:border-accent-indigo/50"
          />
          <button
            onClick={next}
            className="p-1.5 rounded-lg hover:bg-white/10 text-secondary transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 py-3">
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-accent-indigo animate-spin" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-risk-red text-sm py-8 justify-center">
            <AlertCircle className="w-4 h-4" />
            {error instanceof Error ? error.message : 'Failed to load panchang data'}
          </div>
        )}

        {!isLoading && !error && (!data || data.length === 0) && (
          <div className="text-center py-16 text-muted text-sm">
            No panchang data for {MONTH_FULL[month - 1]} {year}.
            <br />
            <span className="text-xs opacity-60">
              Use Panchang Admin → Generate to compute this month.
            </span>
          </div>
        )}

        {!isLoading && data && data.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full text-left min-w-[800px]">
              <thead>
                <tr className="border-b border-white/10">
                  {['Date', 'Tithi', 'Moon Rashi', 'Nakshatra', 'Nak Lord', 'Signals / Notes'].map(h => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-[11px] font-semibold text-muted uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map(row => (
                  <PanchangTableRow key={row.trade_date} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
