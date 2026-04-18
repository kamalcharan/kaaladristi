import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchHealthGrid, type DayCell, type DimensionHealth } from '@/services/pipeline2';
import type { CellSelection } from './index';

interface Props {
  onCellSelect: (selection: CellSelection) => void;
}

const DAY_CHOICES = [30, 60, 90, 120] as const;
type DayChoice = typeof DAY_CHOICES[number];

const STATUS_CLASSES: Record<DayCell['status'], string> = {
  ok:       'bg-emerald-500/70 hover:bg-emerald-400',
  partial:  'bg-amber-500/70 hover:bg-amber-400',
  missing:  'bg-rose-500/70 hover:bg-rose-400',
  holiday:  'bg-slate-700/50 hover:bg-slate-600',
  no_data:  'bg-slate-700/50 hover:bg-slate-600',
  future:   'bg-slate-800/40',
};

function cellTooltip(dim: DimensionHealth, cell: DayCell): string {
  const base = `${dim.label} · ${cell.trade_date}`;
  if (cell.status === 'holiday')  return `${base} · holiday`;
  if (cell.status === 'no_data')  return `${base} · no data`;
  if (cell.status === 'future')   return `${base} · future`;
  if (cell.fill_rate === null)    return `${base} · ${cell.status}`;
  return `${base} · ${cell.fill_rate.toFixed(1)}% (${cell.populated}/${cell.total}) · ${cell.status}`;
}

export default function HealthGrid({ onCellSelect }: Props) {
  const [days, setDays] = useState<DayChoice>(30);

  const { data, isLoading, error } = useQuery({
    queryKey: ['pipeline2', 'health', days],
    queryFn: () => fetchHealthGrid(days),
    refetchInterval: 30_000,
    staleTime: 25_000,
  });

  const rangeToggle = (
    <div className="flex items-center gap-1 text-[10px]">
      <span className="text-muted mr-1">Range:</span>
      {DAY_CHOICES.map(n => (
        <button
          key={n}
          onClick={() => setDays(n)}
          className={cn(
            'px-2 py-0.5 rounded border transition-colors',
            days === n
              ? 'bg-accent-indigo/25 border-accent-indigo/40 text-accent-indigo'
              : 'bg-kd-bg border-kd-border/40 text-muted hover:text-secondary',
          )}
        >
          {n}d
        </button>
      ))}
    </div>
  );

  if (isLoading) {
    return (
      <div className="bg-kd-surface/30 rounded-lg border border-kd-border/30">
        <div className="flex items-center justify-between px-3 py-2 border-b border-kd-border/30">
          <span className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading health grid…
          </span>
          {rangeToggle}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-risk-amber/5 rounded-lg border border-risk-amber/30">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="flex items-center gap-2 text-sm text-risk-amber">
            <AlertTriangle className="w-4 h-4" />
            {error instanceof Error ? error.message : 'Failed to load'}
          </span>
          {rangeToggle}
        </div>
      </div>
    );
  }

  if (data.dimensions.length === 0) {
    return <div className="text-sm text-muted">No dimensions configured.</div>;
  }

  // All dimensions share the same day ordering — take from the first.
  const headerDays = data.dimensions[0].days;

  return (
    <div className="bg-kd-surface/30 rounded-lg border border-kd-border/30">
      <div className="flex items-center justify-between px-3 py-2 border-b border-kd-border/30">
        <span className="text-[11px] text-muted">
          {data.dimensions.length} dimensions · {headerDays.length} trading days
        </span>
        {rangeToggle}
      </div>
      <div className="overflow-x-auto">
      <table className="text-xs w-full border-separate" style={{ borderSpacing: '2px' }}>
        <thead>
          <tr>
            <th className="text-left font-normal text-muted px-2 py-1 sticky left-0 bg-kd-surface/60 z-10">
              Dimension
            </th>
            {headerDays.map(d => (
              <th
                key={d.trade_date}
                className="font-normal text-[10px] text-muted px-0.5 py-1"
                title={d.trade_date}
              >
                {d.trade_date.slice(5)}
              </th>
            ))}
            <th className="text-left font-normal text-muted px-2 py-1">Latest OK</th>
          </tr>
        </thead>
        <tbody>
          {data.dimensions.map((dim, idx) => {
            const prevGroup = idx > 0 ? data.dimensions[idx - 1].group : null;
            const needsSeparator = prevGroup && prevGroup !== dim.group;
            const colSpan = headerDays.length + 2;
            return (
              <Fragment key={dim.dimension}>
                {needsSeparator && (
                  <tr aria-hidden="true">
                    <td colSpan={colSpan} className="h-3 p-0">
                      <div className="border-t border-kd-border/40 my-1" />
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="px-2 py-1 whitespace-nowrap sticky left-0 bg-kd-surface/60 z-10 text-secondary">
                    {dim.label}
                  </td>
                  {dim.days.map(cell => (
                    <td key={cell.trade_date} className="p-0">
                      <button
                        type="button"
                        onClick={() =>
                          onCellSelect({
                            dimension: dim.dimension,
                            tradeDate: cell.trade_date,
                          })
                        }
                        title={cellTooltip(dim, cell)}
                        className={cn(
                          'w-4 h-4 block rounded-[3px] transition-transform',
                          'hover:scale-125 hover:z-10 relative',
                          STATUS_CLASSES[cell.status],
                          cell.status === 'future' && 'cursor-default',
                        )}
                        disabled={cell.status === 'future'}
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1 whitespace-nowrap">
                    {dim.latest_ok ? (
                      <span className="text-muted mono">{dim.latest_ok}</span>
                    ) : (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-500/20 text-rose-300">
                        never
                      </span>
                    )}
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
      </div>

      <div className="flex items-center gap-4 text-[10px] text-muted p-2 border-t border-kd-border/30">
        <Legend color="bg-emerald-500/70" label="ok ≥ threshold" />
        <Legend color="bg-amber-500/70"   label="partial" />
        <Legend color="bg-rose-500/70"    label="missing" />
        <Legend color="bg-slate-700/50"   label="holiday / no_data" />
        <span className="ml-auto">click any cell to pre-fill the fix form</span>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn('w-2.5 h-2.5 rounded-sm', color)} />
      {label}
    </span>
  );
}
