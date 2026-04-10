import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Database, Cpu, Wrench } from 'lucide-react';
import VaNiInsight from './VaNiInsight';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

interface DayStatus {
  date: string;
  status: 'ok' | 'missing' | 'partial' | 'holiday' | 'future';
}

interface HealthRow {
  id: string;
  layer: 'download' | 'snapshot' | string;
  label: string;
  latest_date: string | null;
  days: DayStatus[];
  error?: string;
}

// ── Status colors ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  ok:      'bg-risk-green',
  missing: 'bg-risk-red',
  partial: 'bg-risk-amber',
  holiday: 'bg-kd-border',
  future:  'bg-kd-elevated/30',
};

const STATUS_LABELS: Record<string, string> = {
  ok:      'Data present',
  missing: 'Missing',
  partial: 'Partial',
  holiday: 'Holiday',
  future:  'Future',
};

// ── Period options ────────────────────────────────────────────────────────────

const PERIODS = [
  { label: '60D', days: 60 },
  { label: '90D', days: 90 },
  { label: '120D', days: 120 },
] as const;

// ── Date helpers ─────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function fmtShort(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${+d} ${MONTHS[+m - 1]}`;
}

function fmtFull(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DAYS[dt.getDay()]}, ${d} ${MONTHS[m - 1]} ${y}`;
}

function getMonth(dateStr: string): string {
  const [, m] = dateStr.split('-');
  return MONTHS[+m - 1];
}

function summaryStats(days: DayStatus[]): { ok: number; missing: number; total: number } {
  const ok = days.filter(d => d.status === 'ok').length;
  const missing = days.filter(d => d.status === 'missing').length;
  const total = days.filter(d => d.status !== 'future' && d.status !== 'holiday').length;
  return { ok, missing, total };
}

// ── Month markers ────────────────────────────────────────────────────────────

function MonthMarkers({ days }: { days: DayStatus[] }) {
  // Find first occurrence of each month
  const markers: { month: string; index: number }[] = [];
  let lastMonth = '';
  days.forEach((d, i) => {
    const m = getMonth(d.date);
    if (m !== lastMonth) {
      markers.push({ month: m, index: i });
      lastMonth = m;
    }
  });

  return (
    <div className="flex items-center gap-[2px] sm:gap-[3px] ml-0">
      {days.map((d, i) => {
        const marker = markers.find(m => m.index === i);
        return (
          <div key={d.date} className="w-[8px] sm:w-[10px] text-center">
            {marker ? (
              <span className="text-[7px] sm:text-[8px] text-muted font-bold uppercase tracking-wider">
                {marker.month}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ── Day box ──────────────────────────────────────────────────────────────────

function DayBox({ day, dimension, onMark }: {
  day: DayStatus; dimension: string;
  onMark?: (date: string, status: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const canMark = day.status === 'missing' && onMark;

  return (
    <div className="relative group">
      <div
        onClick={() => canMark && setShowMenu(!showMenu)}
        className={cn(
          'w-[8px] h-[8px] sm:w-[10px] sm:h-[10px] rounded-[2px] transition-all',
          canMark && 'cursor-pointer',
          STATUS_COLORS[day.status] ?? 'bg-kd-border',
          day.status === 'ok' && 'opacity-90 hover:opacity-100 hover:scale-150',
          day.status === 'missing' && 'opacity-80 hover:opacity-100 hover:scale-150',
          day.status === 'holiday' && 'opacity-40',
          day.status === 'future' && 'opacity-20',
        )}
      />
      {/* Tooltip (hover) */}
      {!showMenu && (
        <div className={cn(
          'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg',
          'bg-kd-card border border-kd-border shadow-xl',
          'text-[9px] whitespace-nowrap z-50',
          'hidden group-hover:block',
        )}>
          <div className="text-[var(--text-primary)] font-bold">{fmtFull(day.date)}</div>
          <div className="text-[var(--text-secondary)] mt-0.5">{dimension}</div>
          <div className={cn(
            'font-bold uppercase tracking-wider mt-1',
            day.status === 'ok' ? 'text-risk-green' :
            day.status === 'missing' ? 'text-risk-red' :
            day.status === 'partial' ? 'text-risk-amber' : 'text-muted',
          )}>
            {STATUS_LABELS[day.status] ?? day.status}
          </div>
          {canMark && (
            <div className="text-accent-indigo mt-1">Click to mark</div>
          )}
        </div>
      )}
      {/* Mark menu (click) */}
      {showMenu && (
        <div className={cn(
          'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 rounded-lg',
          'bg-kd-card border border-kd-border shadow-xl z-50',
          'text-[9px] whitespace-nowrap',
        )}>
          <div className="text-[var(--text-primary)] font-bold mb-2">{fmtFull(day.date)}</div>
          <button
            onClick={() => { onMark?.(day.date, 'holiday'); setShowMenu(false); }}
            className="block w-full text-left px-2 py-1 rounded hover:bg-kd-elevated text-[var(--text-secondary)] transition-colors"
          >
            Mark as Holiday
          </button>
          <button
            onClick={() => { onMark?.(day.date, 'no_data'); setShowMenu(false); }}
            className="block w-full text-left px-2 py-1 rounded hover:bg-kd-elevated text-[var(--text-secondary)] transition-colors"
          >
            Mark as No Data
          </button>
          <button
            onClick={() => setShowMenu(false)}
            className="block w-full text-left px-2 py-1 rounded hover:bg-kd-elevated text-muted transition-colors mt-1"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ── Fixable dimensions ───────────────────────────────────────────────────────

const FIXABLE_DIMENSIONS = new Set([
  'nse_equities', 'bse_equities', 'indicators', 'flow_intelligence',
  'market_breadth', 'breadth_roc', 'fii_dii',
]);

// ── Health row ───────────────────────────────────────────────────────────────

function HealthRowComponent({ row, period, onFix, onMark }: {
  row: HealthRow; period: number;
  onFix: (dimension: string, days: number) => void;
  onMark: (date: string, status: string) => void;
}) {
  const stats = summaryStats(row.days);
  const allGood = stats.missing === 0 && stats.total > 0;
  const hasGaps = stats.missing > 0;
  const canFix = FIXABLE_DIMENSIONS.has(row.id) && hasGaps;

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-28 sm:w-36 shrink-0">
        <div className="text-[11px] font-bold text-[var(--text-primary)] truncate">{row.label}</div>
        <div className="text-[9px] text-muted mono">
          {row.latest_date ? fmtShort(row.latest_date) : 'No data'}
        </div>
      </div>

      <div className="flex-1 flex items-center gap-[2px] sm:gap-[3px] min-w-0 overflow-visible">
        {row.days.map(day => (
          <DayBox key={day.date} day={day} dimension={row.label} onMark={onMark} />
        ))}
      </div>

      <div className="w-20 shrink-0 text-right flex items-center justify-end gap-1.5">
        {allGood ? (
          <span className="text-[9px] font-bold text-risk-green uppercase tracking-wider">Current</span>
        ) : hasGaps ? (
          <span className="text-[9px] font-bold text-risk-red uppercase tracking-wider">
            {stats.missing} gaps
          </span>
        ) : (
          <span className="text-[9px] text-muted">—</span>
        )}
        {canFix && (
          <button
            onClick={() => onFix(row.id, period)}
            className={cn(
              'p-1 rounded-md transition-all',
              'text-accent-indigo hover:bg-accent-indigo/10 hover:scale-110',
            )}
            title={`Fix ${row.label}`}
          >
            <Wrench className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Data fetch ───────────────────────────────────────────────────────────────

function useHealthChecks(days: number) {
  const pipelineUrl = (import.meta.env.VITE_PIPELINE_API_URL as string) ?? 'http://localhost:8100';
  return useQuery({
    queryKey: ['health_checks', days],
    queryFn: async (): Promise<HealthRow[]> => {
      const res = await fetch(`${pipelineUrl}/api/pipeline/health-checks?days=${days}`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60_000,
    retry: 1,
  });
}

function useHealthInsight(days: number) {
  const pipelineUrl = (import.meta.env.VITE_PIPELINE_API_URL as string) ?? 'http://localhost:8100';
  return useQuery({
    queryKey: ['health_insight', days],
    queryFn: async (): Promise<{ insight: string | null; ai: boolean }> => {
      const res = await fetch(`${pipelineUrl}/api/ai/data-health-insight?days=${days}`);
      if (!res.ok) return { insight: null, ai: false };
      return res.json();
    },
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex items-center gap-4 text-[9px] text-muted">
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 rounded-sm bg-risk-green opacity-90" />
        <span>Data present</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 rounded-sm bg-risk-red opacity-80" />
        <span>Missing</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 rounded-sm bg-kd-border opacity-40" />
        <span>Holiday</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 rounded-sm bg-kd-elevated/30 opacity-20" />
        <span>Future</span>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function DataHealthGrid() {
  const [period, setPeriod] = useState<number>(60);
  const [fixingId, setFixingId] = useState<string | null>(null);
  const qc = useQueryClient();
  const { data: checks, isLoading } = useHealthChecks(period);
  const { data: healthInsight, isLoading: insightLoading } = useHealthInsight(period);

  const pipelineUrl = (import.meta.env.VITE_PIPELINE_API_URL as string) ?? 'http://localhost:8100';
  const fixMutation = useMutation({
    mutationFn: async ({ dimension, days }: { dimension: string; days: number }) => {
      const res = await fetch(`${pipelineUrl}/api/pipeline/fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dimension, days }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Fix failed' }));
        throw new Error(err.detail || 'Fix failed');
      }
      return res.json();
    },
    onMutate: ({ dimension }) => setFixingId(dimension),
    onSettled: () => {
      setFixingId(null);
      // Refresh health checks after a short delay to let the fix run
      setTimeout(() => qc.invalidateQueries({ queryKey: ['health_checks'] }), 5000);
    },
  });

  const markMutation = useMutation({
    mutationFn: async ({ date, status }: { date: string; status: string }) => {
      const res = await fetch(`${pipelineUrl}/api/pipeline/mark-date`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, status, exchange: 'NSE' }),
      });
      if (!res.ok) throw new Error('Mark failed');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['health_checks'] });
    },
  });

  const handleFix = (dimension: string, days: number) => {
    if (fixingId) return;
    fixMutation.mutate({ dimension, days });
  };

  const handleMark = (date: string, status: string) => {
    markMutation.mutate({ date, status });
  };

  if (isLoading) {
    return (
      <Card rounded="xxl" className="p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-4 h-4 text-accent-indigo" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-primary)]">Data Health</h3>
        </div>
        <div className="flex items-center justify-center py-8 text-muted gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs">Checking data health...</span>
        </div>
      </Card>
    );
  }

  const downloads = (checks ?? []).filter(c => c.layer === 'download');
  const snapshots = (checks ?? []).filter(c => c.layer === 'snapshot');

  // Use first row's days for month markers (all rows share the same days)
  const firstRow = checks?.[0];

  return (
    <Card rounded="xxl" className="p-5 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-accent-indigo" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-primary)]">
            Data Health
          </h3>
        </div>
        <div className="flex items-center gap-3">
          {/* Period selector */}
          <div className="flex items-center gap-1">
            {PERIODS.map(p => (
              <button
                key={p.days}
                onClick={() => setPeriod(p.days)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all',
                  period === p.days
                    ? 'bg-accent-indigo/20 text-accent-indigo border border-accent-indigo/30'
                    : 'text-muted hover:text-[var(--text-secondary)] hover:bg-kd-elevated'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Legend />
        </div>
      </div>

      {/* Month markers */}
      {firstRow && firstRow.days.length > 0 && (
        <div className="flex items-center gap-3 mb-1">
          <div className="w-28 sm:w-36 shrink-0" />
          <MonthMarkers days={firstRow.days} />
          <div className="w-16 shrink-0" />
        </div>
      )}

      {/* Download layer */}
      {downloads.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Database className="w-3 h-3 text-muted" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted">Downloads</span>
          </div>
          <div className="divide-y divide-kd-border/30">
            {downloads.map(row => <HealthRowComponent key={row.id} row={row} period={period} onFix={handleFix} onMark={handleMark} />)}
          </div>
        </div>
      )}

      {/* Snapshot layer */}
      {snapshots.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1 mt-2">
            <Cpu className="w-3 h-3 text-muted" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted">Computations</span>
          </div>
          <div className="divide-y divide-kd-border/30">
            {snapshots.map(row => <HealthRowComponent key={row.id} row={row} period={period} onFix={handleFix} onMark={handleMark} />)}
          </div>
        </div>
      )}

      {!checks?.length && !isLoading && (
        <div className="text-center py-6 text-xs text-muted">
          No health data available — is the Pipeline API running?
        </div>
      )}

      {/* VaNi Health Insight */}
      <VaNiInsight insight={healthInsight?.insight} isLoading={insightLoading} />
    </Card>
  );
}
