import { Fragment, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, AlertTriangle, CalendarX, CalendarOff, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  fetchHealthGrid, markCalendar,
  type DayCell, type DimensionHealth, type CalendarMarkStatus,
} from '@/services/pipeline2';
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
  holiday:  'bg-[var(--panel-recess)] hover:bg-[var(--panel-recess)]',
  no_data:  'bg-[var(--panel-recess)] hover:bg-[var(--panel-recess)]',
  future:   'bg-[var(--panel-recess)]',
};

function cellTooltip(dim: DimensionHealth, cell: DayCell): string {
  const base = `${dim.label} · ${cell.trade_date}`;
  if (cell.status === 'holiday')  return `${base} · holiday`;
  if (cell.status === 'no_data')  return `${base} · no data`;
  if (cell.status === 'future')   return `${base} · future`;
  if (cell.fill_rate === null)    return `${base} · ${cell.status}`;
  return `${base} · ${cell.fill_rate.toFixed(1)}% (${cell.populated}/${cell.total}) · ${cell.status}`;
}

interface MenuState {
  x: number;
  y: number;
  date: string;
  currentStatus: DayCell['status'];
}

export default function HealthGrid({ onCellSelect }: Props) {
  const [days, setDays] = useState<DayChoice>(30);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [markErr, setMarkErr] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['pipeline2', 'health', days],
    queryFn: () => fetchHealthGrid(days),
    refetchInterval: 30_000,
    staleTime: 25_000,
  });

  // Close the context menu on any outside click / scroll / Escape.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const handleCellContextMenu = (
    e: React.MouseEvent, cell: DayCell,
  ) => {
    if (cell.status === 'future') return;
    e.preventDefault();
    setMarkErr(null);
    setMenu({
      x: e.clientX,
      y: e.clientY,
      date: cell.trade_date,
      currentStatus: cell.status,
    });
  };

  const handleMark = async (status: CalendarMarkStatus) => {
    if (!menu) return;
    const targetDate = menu.date;
    setMenu(null);
    setMarkErr(null);
    try {
      await markCalendar(targetDate, status);
      queryClient.invalidateQueries({ queryKey: ['pipeline2', 'health'] });
    } catch (e) {
      setMarkErr(e instanceof Error ? e.message : String(e));
    }
  };

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
      {/* Horizontal scroll: w-full would compress the 30/60/90/120 day
          columns to fit the container — dropping it lets the table grow to
          its intrinsic width and `overflow-x-auto` gives a real scrollbar. */}
      <div className="overflow-x-auto">
      <table className="text-xs border-separate" style={{ borderSpacing: '2px' }}>
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
                        onContextMenu={(e) => handleCellContextMenu(e, cell)}
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
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-500/20 text-risk-red">
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
        <Legend color="bg-[var(--panel-recess)]"   label="holiday / no_data" />
        <span className="ml-auto">
          click to pre-fill fix · right-click to mark day
          {days > 30 && ' · scroll sideways for full range'}
        </span>
      </div>
      {markErr && (
        <div className="text-[10px] text-risk-red bg-rose-500/10 border-t border-rose-500/30 px-3 py-1">
          Mark failed: {markErr}
        </div>
      )}
      {menu && (
        <CellContextMenu
          state={menu}
          onMark={handleMark}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}


function CellContextMenu({ state, onMark, onClose }: {
  state: MenuState;
  onMark: (status: CalendarMarkStatus) => void;
  onClose: () => void;
}) {
  // Stop the outer `window.click` listener from immediately closing us
  // when the click that opened the menu propagates.
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const isMarked =
    state.currentStatus === 'holiday' || state.currentStatus === 'no_data';

  return (
    <div
      onClick={stop}
      className="fixed z-50 min-w-[180px] bg-kd-elevated border border-kd-border/60
                 rounded-lg shadow-xl shadow-black/40 overflow-hidden text-xs"
      style={{
        // Anchor at the click position; nudge left if it would overflow viewport.
        left: Math.min(state.x, window.innerWidth - 200),
        top: Math.min(state.y, window.innerHeight - 160),
      }}
    >
      <div className="px-3 py-1.5 bg-kd-bg/50 border-b border-kd-border/40 text-[10px]">
        <span className="text-muted">Mark </span>
        <span className="text-secondary mono">{state.date}</span>
        <span className="text-muted"> as…</span>
      </div>
      <MenuItem
        icon={<CalendarX className="w-3.5 h-3.5" />}
        onClick={() => onMark('holiday')}
        label="Mark holiday"
        sub="Cells render slate (no fill expected)"
      />
      <MenuItem
        icon={<CalendarOff className="w-3.5 h-3.5" />}
        onClick={() => onMark('no_data')}
        label="Mark no_data"
        sub="Known downtime — no bhav published"
      />
      {isMarked && (
        <MenuItem
          icon={<RotateCcw className="w-3.5 h-3.5" />}
          onClick={() => onMark('clear')}
          label="Clear override"
          sub="Restore to normal trading day"
          danger
        />
      )}
      <button
        onClick={onClose}
        className="w-full px-3 py-1.5 text-[10px] text-muted hover:bg-kd-bg/50
                   border-t border-kd-border/30 text-left"
      >
        Cancel
      </button>
    </div>
  );
}


function MenuItem({ icon, label, sub, onClick, danger }: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-2 px-3 py-2 hover:bg-accent-indigo/10 text-left',
        danger && 'text-risk-red hover:bg-rose-500/10',
      )}
    >
      <span className="mt-0.5 text-muted">{icon}</span>
      <span className="flex-1">
        <span className="block text-secondary">{label}</span>
        {sub && <span className="block text-[10px] text-muted">{sub}</span>}
      </span>
    </button>
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
