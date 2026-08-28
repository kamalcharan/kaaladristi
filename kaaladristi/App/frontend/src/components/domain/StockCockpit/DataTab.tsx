/**
 * DataTab — Study → Data. The raw record behind every other view.
 *
 * A date and its bar, plus whichever of km_equity_eod's 145 columns the reader
 * wants beside it. Deliberately dumb: it reports what is stored and computes
 * nothing. ATR is a column here, not a signal — it is a volatility reading,
 * not a target, and inferring "room left to move" from it would be inventing
 * a claim the number does not support.
 *
 * Columns come from config/dataColumns, which is also what builds the
 * PostgREST select — one list, so the picker cannot offer something the query
 * never asked for. That mismatch is what put dashes across the scanners.
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Settings2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { fetchDataBars, fetchDataCoverage, type DataRange } from '@/services/dataTab';
import {
  DATA_COLUMN_GROUPS, DATA_DEFAULT_COLUMNS, DATA_PINNED_COLUMNS, prettifyKey,
} from '@/config/dataColumns';
import { formatValue, getLabel } from '@/config/fieldConfig';
import DataCoverageCards from './DataCoverageCards';
import { cn } from '@/lib/utils';

const PAGE = 250;
const RANGES: DataRange[] = ['1Y', '3Y', '5Y', 'ALL'];

function label(col: string): string {
  const l = getLabel(col);
  return l === col ? prettifyKey(col) : l;
}

function render(col: string, val: unknown): string {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'boolean') return val ? 'yes' : 'no';
  const f = formatValue(col, val);
  // formatValue returns String(val) for keys with no fieldConfig entry; dates
  // come back as full ISO timestamps there, so trim them to the day.
  if (/^\d{4}-\d{2}-\d{2}T/.test(f)) return f.slice(0, 10);
  return f;
}

export default function DataTab({ equityId, symbol }: { equityId: number; symbol: string }) {
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const [range, setRange] = useState<DataRange>('1Y');
  const [page, setPage] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);

  const storageKey = `dristiq_data_cols_${equityId ? 'all' : 'all'}`;
  const [visible, setVisible] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved) as string[];
    } catch { /* ignore */ }
    return DATA_DEFAULT_COLUMNS;
  });

  const setCols = (next: string[]) => {
    setVisible(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['data-bars', equityId, range, page],
    queryFn: () => fetchDataBars(equityId, range, PAGE, page * PAGE),
    enabled: !!equityId,
    staleTime: 5 * 60 * 1000,
  });
  const { data: cov } = useQuery({
    queryKey: ['data-coverage', equityId],
    queryFn: () => fetchDataCoverage(equityId),
    enabled: !!equityId,
    staleTime: 5 * 60 * 1000,
  });

  const rows = data?.rows ?? [];
  // Pinned columns cannot be hidden — a row without its date is unreadable.
  const cols = useMemo(
    () => [...DATA_PINNED_COLUMNS, ...visible.filter((c) => !DATA_PINNED_COLUMNS.includes(c as never))],
    [visible],
  );

  function exportCsv() {
    const head = cols.map(label).join(',');
    const body = rows.map((r) =>
      cols.map((c) => {
        const v = r[c];
        const s = v === null || v === undefined ? '' : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(','),
    );
    const blob = new Blob([[head, ...body].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${symbol}_${range}_p${page + 1}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* What you are looking at, stated rather than inferred. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-mono text-muted">
        {cov && (
          <span>
            {cov.actualBars.toLocaleString()} bars · {cov.firstTradeDate ?? '?'} →{' '}
            {cov.lastTradeDate ?? '?'} · {cov.exchange ?? '?'}
          </span>
        )}
        <span className="text-[var(--text-faint)]">
          Prices are raw exchange closes — not adjusted for splits or bonuses.
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => { setRange(r); setPage(0); }}
            className={cn(
              'px-2 py-1 rounded text-[10px] font-mono border transition-colors',
              range === r
                ? 'border-[var(--accent)] text-[var(--text-primary)]'
                : 'border-kd-border text-muted hover:text-[var(--text-primary)]',
            )}
          >
            {r}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setPickerOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-kd-border text-[10px] font-mono text-muted hover:text-[var(--text-primary)]"
          >
            <Settings2 className="w-3 h-3" /> Columns · {cols.length}
          </button>
          <button
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-kd-border text-[10px] font-mono text-muted hover:text-[var(--text-primary)] disabled:opacity-40"
          >
            <Download className="w-3 h-3" /> CSV
          </button>
        </div>
      </div>

      {pickerOpen && (
        <div className="rounded-lg border border-kd-border bg-kd-card p-3 max-h-80 overflow-y-auto">
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => setCols(DATA_DEFAULT_COLUMNS)}
              className="text-[10px] font-mono text-accent-indigo hover:underline">Reset to default</button>
          </div>
          {DATA_COLUMN_GROUPS.map((g) => (
            <div key={g.id} className="mb-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-faint)] mb-1">
                {g.title}
              </div>
              {g.note && (
                <p className="text-[9px] font-mono text-muted mb-1 leading-relaxed">{g.note}</p>
              )}
              <div className="flex flex-wrap gap-1">
                {g.columns.map((c) => {
                  const on = cols.includes(c);
                  const pinned = DATA_PINNED_COLUMNS.includes(c as never);
                  return (
                    <button
                      key={c}
                      disabled={pinned}
                      onClick={() =>
                        setCols(on ? visible.filter((x) => x !== c) : [...visible, c])
                      }
                      className={cn(
                        'px-1.5 py-0.5 rounded text-[10px] font-mono border transition-colors',
                        pinned && 'opacity-50 cursor-default',
                        on
                          ? 'border-[var(--accent)] text-[var(--text-primary)]'
                          : 'border-kd-border text-muted hover:text-[var(--text-primary)]',
                      )}
                    >
                      {label(c)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {isAdmin && <DataCoverageCards equityId={equityId} />}

      {isError && (
        <p className="text-[11px] font-mono text-risk-red">
          {(error as Error)?.message ?? 'Could not read bars.'}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-kd-border">
        <table className="w-full text-[11px] font-mono">
          <thead>
            <tr className="border-b border-kd-border bg-kd-elevated">
              {cols.map((c) => (
                <th key={c} className="px-2 py-1.5 text-right whitespace-nowrap text-[10px] uppercase tracking-wider text-muted">
                  {label(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={cols.length} className="px-2 py-3 text-muted">Reading…</td></tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={cols.length} className="px-2 py-3 text-muted">
                No bars in this range.
              </td></tr>
            )}
            {rows.map((r, i) => (
              <tr key={String(r.trade_date) + i} className="border-b border-kd-border/40 hover:bg-kd-elevated/50">
                {cols.map((c) => (
                  <td key={c} className="px-2 py-1 text-right whitespace-nowrap tabular-nums text-[var(--text-secondary)]">
                    {render(c, r[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 text-[10px] font-mono text-muted">
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="px-2 py-1 rounded border border-kd-border disabled:opacity-40 hover:text-[var(--text-primary)]"
        >
          Newer
        </button>
        <span>Page {page + 1}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={!data?.hasMore}
          className="px-2 py-1 rounded border border-kd-border disabled:opacity-40 hover:text-[var(--text-primary)]"
        >
          Older
        </button>
      </div>
    </div>
  );
}
