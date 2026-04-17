import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Database, Cpu, Wrench, AlertTriangle } from 'lucide-react';
import VaNiInsight from './VaNiInsight';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

interface DayStatus {
  date: string;
  status: 'ok' | 'missing' | 'partial' | 'holiday' | 'no_data' | 'future';
  error?: string | null;
  last_run_status?: string | null;
  coverage_pct?: number | null;
  populated_rows?: number | null;
  total_rows?: number | null;
}

interface HealthRow {
  id: string;
  layer: 'download' | 'snapshot' | string;
  label: string;
  latest_date: string | null;
  days: DayStatus[];
  error?: string;
  last_error?: string | null;
  last_error_date?: string | null;
  last_job_status?: string | null;
  last_job_error?: string | null;
  last_job_rows_updated?: number | null;
  last_job_completed_at?: string | null;
}

// ── Status colors ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  ok:      'bg-risk-green',
  missing: 'bg-risk-red',
  partial: 'bg-risk-amber',
  holiday: 'bg-accent-violet',
  no_data: 'bg-accent-violet',
  future:  'bg-kd-elevated/30',
};

const STATUS_LABELS: Record<string, string> = {
  ok:      'Data present',
  missing: 'Missing',
  partial: 'Partial',
  holiday: 'Holiday',
  no_data: 'No Data (skipped)',
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

function summaryStats(days: DayStatus[]): { ok: number; gaps: number; total: number } {
  const ok = days.filter(d => d.status === 'ok').length;
  // Gaps = missing OR partial. Green means fully complete only.
  const gaps = days.filter(d => d.status === 'missing' || d.status === 'partial').length;
  const total = days.filter(d => d.status !== 'future' && d.status !== 'holiday' && d.status !== 'no_data').length;
  return { ok, gaps, total };
}

// A recent fix attempt that updated zero rows is the fingerprint of a silent
// no-op — RPC returned success but the computed_at guard skipped every row.
// Flag it amber on the row label so Charan can see "this fix did nothing".
const ZERO_UPDATE_WARNING_HOURS = 48;

function isRecentZeroUpdate(row: HealthRow): boolean {
  if (row.last_job_status !== 'completed') return false;
  if (row.last_job_rows_updated == null) return false;
  if (row.last_job_rows_updated > 0) return false;
  if (!row.last_job_completed_at) return false;
  const completed = Date.parse(row.last_job_completed_at);
  if (Number.isNaN(completed)) return false;
  const ageHours = (Date.now() - completed) / 3_600_000;
  return ageHours <= ZERO_UPDATE_WARNING_HOURS;
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

function DayBox({ day, dimension, dimensionId, onMark, onFixDay }: {
  day: DayStatus;
  dimension: string;
  dimensionId: string;
  onMark?: (date: string, status: string) => void;
  onFixDay?: (dimensionId: string, tradeDate: string, force: boolean) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [force, setForce] = useState(false);
  const isProblem = day.status === 'missing' || day.status === 'partial';
  const canMark = day.status === 'missing' && onMark !== undefined;
  const canFix = isProblem && FIXABLE_DIMENSIONS.has(dimensionId) && onFixDay !== undefined;
  const interactive = canMark || canFix;

  return (
    <div className="relative group">
      <div
        onClick={() => interactive && setShowMenu(!showMenu)}
        className={cn(
          'w-[8px] h-[8px] sm:w-[10px] sm:h-[10px] rounded-[2px] transition-all',
          interactive && 'cursor-pointer',
          STATUS_COLORS[day.status] ?? 'bg-kd-border',
          day.status === 'ok' && 'opacity-90 hover:opacity-100 hover:scale-150',
          (day.status === 'missing' || day.status === 'partial') && 'opacity-80 hover:opacity-100 hover:scale-150',
          (day.status === 'holiday' || day.status === 'no_data') && 'opacity-60',
          day.status === 'future' && 'opacity-20',
        )}
      />
      {/* Tooltip (hover) */}
      {!showMenu && (
        <div className={cn(
          'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg',
          'bg-kd-card border border-kd-border shadow-xl',
          'text-[9px] z-50 max-w-[320px] whitespace-normal',
          'hidden group-hover:block',
        )}>
          <div className="text-[var(--text-primary)] font-bold whitespace-nowrap">{fmtFull(day.date)}</div>
          <div className="text-[var(--text-secondary)] mt-0.5 whitespace-nowrap">{dimension}</div>
          <div className={cn(
            'font-bold uppercase tracking-wider mt-1 whitespace-nowrap',
            day.status === 'ok' ? 'text-risk-green' :
            day.status === 'missing' ? 'text-risk-red' :
            day.status === 'partial' ? 'text-risk-amber' : 'text-muted',
          )}>
            {STATUS_LABELS[day.status] ?? day.status}
          </div>
          {/* Reason for red/amber square: surface the actual error from
              km_pipeline_runs, or a note when nothing was logged. */}
          {(day.status === 'missing' || day.status === 'partial') && (
            day.error ? (
              <div className="mt-1.5 pt-1.5 border-t border-kd-border/50">
                <div className="text-[8px] uppercase tracking-wider text-muted">Last run error</div>
                <div className="text-[9px] text-risk-red mt-0.5 break-words">{day.error}</div>
                {day.last_run_status && (
                  <div className="text-[8px] text-muted mt-0.5">run status: {day.last_run_status}</div>
                )}
              </div>
            ) : (
              <div className="mt-1.5 pt-1.5 border-t border-kd-border/50 text-[8px] text-muted whitespace-normal">
                No error logged — likely upstream dependency missing or silent skip.
              </div>
            )
          )}
          {day.coverage_pct != null && day.populated_rows != null && day.total_rows != null && day.total_rows > 0 && (
            <div className="mt-1.5 pt-1.5 border-t border-kd-border/50 text-[8px] text-muted">
              Column fill: {day.populated_rows}/{day.total_rows} ({day.coverage_pct.toFixed(0)}%)
            </div>
          )}
          {day.status === 'ok' && day.coverage_pct != null && day.coverage_pct < 95 && (
            <div className="mt-0.5 text-[8px] text-risk-amber">
              Below 95% threshold — partial run.
            </div>
          )}
          {interactive && (
            <div className="text-accent-indigo mt-1">Click for actions</div>
          )}
        </div>
      )}
      {/* Action menu (click) */}
      {showMenu && (
        <div className={cn(
          'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 rounded-lg',
          'bg-kd-card border border-kd-border shadow-xl z-50',
          'text-[9px] whitespace-nowrap min-w-[180px]',
        )}>
          <div className="text-[var(--text-primary)] font-bold mb-2">{fmtFull(day.date)}</div>
          {canFix && (
            <>
              <button
                onClick={() => { onFixDay?.(dimensionId, day.date, false); setShowMenu(false); setForce(false); }}
                className="block w-full text-left px-2 py-1 rounded hover:bg-kd-elevated text-[var(--text-primary)] transition-colors"
              >
                Fix this date
              </button>
              {force && (
                <button
                  onClick={() => { onFixDay?.(dimensionId, day.date, true); setShowMenu(false); setForce(false); }}
                  className="block w-full text-left px-2 py-1 rounded hover:bg-risk-amber/10 text-risk-amber transition-colors font-bold"
                >
                  Force-recompute this date
                </button>
              )}
              <label
                className="flex items-center gap-1.5 px-2 py-1 cursor-pointer select-none"
                title="Erase existing computation and recompute from scratch. Use when a day is marked done but data is wrong."
              >
                <input
                  type="checkbox"
                  checked={force}
                  onChange={e => setForce(e.target.checked)}
                  className="w-3 h-3 accent-risk-amber cursor-pointer"
                />
                <span className="text-[9px] text-[var(--text-secondary)]">Force recompute</span>
              </label>
              {canMark && <div className="border-t border-kd-border/50 my-1" />}
            </>
          )}
          {canMark && (
            <>
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
            </>
          )}
          <button
            onClick={() => { setShowMenu(false); setForce(false); }}
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
// These are the row ids the backend health_checks emits. Must stay in sync with
// lib/health_checks.DIMENSION_META on the backend.

const FIXABLE_DIMENSIONS = new Set([
  'nse_equities', 'bse_equities', 'fii_dii',
  'indicators',
  'nse_equity_indicators', 'bse_equity_indicators',
  'nse_magic_rs', 'bse_magic_rs',
  'flow_intelligence', 'nse_flow_intelligence', 'bse_flow_intelligence',
  'industry_composites', 'market_breadth', 'breadth_roc',
]);

// The wrench POSTs to /api/pipeline/fix. Its FIX_DIMENSIONS allowlist
// (pipeline_api.py:1127) only accepts BASE dimension keys — the underlying
// RPCs are exchange-agnostic (compute_all_magic_rs / compute_all_flow_intelligence
// run over the whole km_equity_eod). So when the user clicks the wrench on a
// split row ("NSE Magic RS", "BSE Magic RS", "NSE/BSE Flow Intelligence"), we
// map it back to the base key the API accepts. Wrench behaviour is unchanged;
// Task 2 will make the worker actually target a specific exchange.
const FIX_KEY_MAP: Record<string, string> = {
  nse_magic_rs: 'magic_rs',
  bse_magic_rs: 'magic_rs',
  nse_flow_intelligence: 'flow_intelligence',
  bse_flow_intelligence: 'flow_intelligence',
};

function toFixDimension(id: string): string {
  return FIX_KEY_MAP[id] ?? id;
}

// Derive the exchange filter the backend worker needs for split rows.
// nse_* and bse_* row ids map onto the underlying exchange-agnostic RPCs
// by passing `exchange` in km_jobs.params (see handle_fix_magic_rs,
// handle_fix_flow, handle_fix_*_equity_indicators).
function dimensionExchange(id: string): 'NSE' | 'BSE' | undefined {
  if (id.startsWith('nse_')) return 'NSE';
  if (id.startsWith('bse_')) return 'BSE';
  return undefined;
}

// ── Health row ───────────────────────────────────────────────────────────────

function HealthRowComponent({ row, period, onFix, onMark, onFixDay }: {
  row: HealthRow; period: number;
  onFix: (dimension: string, days: number) => void;
  onMark: (date: string, status: string) => void;
  onFixDay: (dimensionId: string, tradeDate: string, force: boolean) => void;
}) {
  const stats = summaryStats(row.days);
  const allGood = stats.gaps === 0 && stats.total > 0;
  const hasGaps = stats.gaps > 0;
  const canFix = FIXABLE_DIMENSIONS.has(row.id) && hasGaps;
  const zeroUpdateWarning = isRecentZeroUpdate(row);

  const zeroUpdateTooltip = zeroUpdateWarning
    ? `Last fix attempt completed ${row.last_job_completed_at ? fmtShort(row.last_job_completed_at.slice(0, 10)) : 'recently'} with 0 rows updated — likely a silent no-op (computed_at guard skipped every row).`
    : '';

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-28 sm:w-36 shrink-0">
        <div className="flex items-center gap-1">
          <div className="text-[11px] font-bold text-[var(--text-primary)] truncate">{row.label}</div>
          {zeroUpdateWarning && (
            <span
              className="inline-flex items-center text-risk-amber"
              title={zeroUpdateTooltip}
            >
              <AlertTriangle className="w-3 h-3" />
            </span>
          )}
        </div>
        <div className="text-[9px] text-muted mono">
          {row.latest_date ? fmtShort(row.latest_date) : 'No data'}
        </div>
        {zeroUpdateWarning && (
          <div className="text-[8px] text-risk-amber mt-0.5 uppercase tracking-wider">
            last fix: 0 rows updated
          </div>
        )}
      </div>

      <div className="flex-1 flex items-center gap-[2px] sm:gap-[3px] min-w-0 overflow-visible">
        {row.days.map(day => (
          <DayBox
            key={day.date}
            day={day}
            dimension={row.label}
            dimensionId={row.id}
            onMark={onMark}
            onFixDay={onFixDay}
          />
        ))}
      </div>

      <div className="w-20 shrink-0 text-right flex items-center justify-end gap-1.5">
        {allGood ? (
          <span className="text-[9px] font-bold text-risk-green uppercase tracking-wider">Current</span>
        ) : hasGaps ? (
          <span
            className="text-[9px] font-bold text-risk-red uppercase tracking-wider"
            title={row.last_error ? `Most recent error (${row.last_error_date}): ${row.last_error}` : undefined}
          >
            {stats.gaps} gaps
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
        <span>Present</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 rounded-sm bg-risk-amber opacity-90" />
        <span>Partial</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 rounded-sm bg-risk-red opacity-80" />
        <span>Missing</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 rounded-sm bg-accent-violet opacity-60" />
        <span>Holiday / Skipped</span>
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
        body: JSON.stringify({ dimension: toFixDimension(dimension), days }),
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

  // Day-level fix: submits one fix job scoped to a single trade_date.
  // This is the canonical path for closing a specific red/amber square.
  // Force = erase-and-recompute (NULL stamp columns or DELETE aggregate row).
  const fixDayMutation = useMutation({
    mutationFn: async ({
      dimensionId, tradeDate, force,
    }: { dimensionId: string; tradeDate: string; force: boolean }) => {
      const body = {
        dimension: toFixDimension(dimensionId),
        trade_date: tradeDate,
        exchange: dimensionExchange(dimensionId),
        force,
        days: period,
      };
      const res = await fetch(`${pipelineUrl}/api/pipeline/fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Fix failed' }));
        throw new Error(err.detail || 'Fix failed');
      }
      return res.json();
    },
    onSettled: () => {
      // Give the worker ~5s to pick up and start before refetching
      setTimeout(() => qc.invalidateQueries({ queryKey: ['health_checks'] }), 5000);
    },
  });

  const handleFix = (dimension: string, days: number) => {
    if (fixingId) return;
    fixMutation.mutate({ dimension, days });
  };

  const handleMark = (date: string, status: string) => {
    markMutation.mutate({ date, status });
  };

  const handleFixDay = (dimensionId: string, tradeDate: string, force: boolean) => {
    fixDayMutation.mutate({ dimensionId, tradeDate, force });
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
            {downloads.map(row => <HealthRowComponent key={row.id} row={row} period={period} onFix={handleFix} onMark={handleMark} onFixDay={handleFixDay} />)}
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
            {snapshots.map(row => <HealthRowComponent key={row.id} row={row} period={period} onFix={handleFix} onMark={handleMark} onFixDay={handleFixDay} />)}
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
