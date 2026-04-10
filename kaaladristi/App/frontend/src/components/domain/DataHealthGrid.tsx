import { useQuery } from '@tanstack/react-query';
import { Loader2, Database, Cpu } from 'lucide-react';
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

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function summaryStats(days: DayStatus[]): { ok: number; missing: number; total: number } {
  const ok = days.filter(d => d.status === 'ok').length;
  const missing = days.filter(d => d.status === 'missing').length;
  const total = days.filter(d => d.status !== 'future' && d.status !== 'holiday').length;
  return { ok, missing, total };
}

// ── Day box ──────────────────────────────────────────────────────────────────

function DayBox({ day }: { day: DayStatus }) {
  return (
    <div className="relative group">
      <div
        className={cn(
          'w-[8px] h-[8px] sm:w-[10px] sm:h-[10px] rounded-[2px] transition-all',
          STATUS_COLORS[day.status] ?? 'bg-kd-border',
          day.status === 'ok' && 'opacity-90 hover:opacity-100',
          day.status === 'missing' && 'opacity-80 hover:opacity-100',
          day.status === 'holiday' && 'opacity-40',
          day.status === 'future' && 'opacity-20',
        )}
      />
      {/* Tooltip */}
      <div className={cn(
        'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-md',
        'bg-kd-card border border-kd-border shadow-lg',
        'text-[9px] whitespace-nowrap z-50',
        'opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150',
      )}>
        <div className="text-[var(--text-primary)] font-medium">{fmtFull(day.date)}</div>
        <div className={cn(
          'font-bold uppercase tracking-wider mt-0.5',
          day.status === 'ok' ? 'text-risk-green' :
          day.status === 'missing' ? 'text-risk-red' :
          day.status === 'partial' ? 'text-risk-amber' : 'text-muted',
        )}>
          {STATUS_LABELS[day.status] ?? day.status}
        </div>
      </div>
    </div>
  );
}

// ── Health row ───────────────────────────────────────────────────────────────

function HealthRowComponent({ row }: { row: HealthRow }) {
  const stats = summaryStats(row.days);
  const allGood = stats.missing === 0 && stats.total > 0;
  const hasGaps = stats.missing > 0;

  return (
    <div className="flex items-center gap-3 py-2">
      {/* Label */}
      <div className="w-28 sm:w-36 shrink-0">
        <div className="text-[11px] font-bold text-[var(--text-primary)] truncate">{row.label}</div>
        <div className="text-[9px] text-muted mono">
          {row.latest_date ? fmtShort(row.latest_date) : 'No data'}
        </div>
      </div>

      {/* Heatmap boxes */}
      <div className="flex-1 flex items-center gap-[2px] sm:gap-[3px] min-w-0 overflow-hidden">
        {row.days.map(day => (
          <DayBox key={day.date} day={day} />
        ))}
      </div>

      {/* Summary */}
      <div className="w-16 shrink-0 text-right">
        {allGood ? (
          <span className="text-[9px] font-bold text-risk-green uppercase tracking-wider">Current</span>
        ) : hasGaps ? (
          <span className="text-[9px] font-bold text-risk-red uppercase tracking-wider">
            {stats.missing} gaps
          </span>
        ) : (
          <span className="text-[9px] text-muted">—</span>
        )}
      </div>
    </div>
  );
}

// ── Data fetch ───────────────────────────────────────────────────────────────

function useHealthChecks() {
  const pipelineUrl = (import.meta.env.VITE_PIPELINE_API_URL as string) ?? 'http://localhost:8100';
  return useQuery({
    queryKey: ['health_checks'],
    queryFn: async (): Promise<HealthRow[]> => {
      const res = await fetch(`${pipelineUrl}/api/pipeline/health-checks`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60_000,
    retry: 1,
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
  const { data: checks, isLoading } = useHealthChecks();

  if (isLoading) {
    return (
      <div className="glass-card rounded-2xl p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-4 h-4 text-accent-indigo" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-primary)]">Data Health</h3>
        </div>
        <div className="flex items-center justify-center py-8 text-muted gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs">Checking data health...</span>
        </div>
      </div>
    );
  }

  const downloads = (checks ?? []).filter(c => c.layer === 'download');
  const snapshots = (checks ?? []).filter(c => c.layer === 'snapshot');

  return (
    <div className="glass-card rounded-2xl p-5 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-accent-indigo" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-primary)]">
            Data Health
          </h3>
          <span className="text-[9px] text-muted">60 trading days</span>
        </div>
        <Legend />
      </div>

      {/* Download layer */}
      {downloads.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Database className="w-3 h-3 text-muted" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted">Downloads</span>
          </div>
          <div className="divide-y divide-kd-border/30">
            {downloads.map(row => <HealthRowComponent key={row.id} row={row} />)}
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
            {snapshots.map(row => <HealthRowComponent key={row.id} row={row} />)}
          </div>
        </div>
      )}

      {!checks?.length && !isLoading && (
        <div className="text-center py-6 text-xs text-muted">
          No health data available — is the Pipeline API running?
        </div>
      )}
    </div>
  );
}
