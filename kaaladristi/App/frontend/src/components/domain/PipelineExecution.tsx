import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2, XCircle, Loader2, Clock, MinusCircle,
  Play, ChevronDown, ChevronRight, StopCircle,
} from 'lucide-react';
import { useState } from 'react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

interface StepStatus {
  step: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  rows_count: number;
  duration_ms: number | null;
  error_msg: string | null;
  started_at: string | null;
  completed_at: string | null;
}

interface DateView {
  date: string;
  steps: StepStatus[];
  completed: number;
  total: number;
  progress_pct: number;
}

interface ExchangeView {
  exchange: string;
  dates: DateView[];
}

interface LiveJob {
  job_id: number;
  status: string;
  exchange: string;
  type: string;
  started_at: string;
  completed_at: string | null;
  elapsed_ms: number | null;
  progress: string | null;
  progress_pct: number;
  error_msg: string | null;
}

interface LiveData {
  active: boolean;
  job: LiveJob | null;
  exchanges: ExchangeView[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDate(d: string): string {
  const [, m, day] = d.split('-');
  return `${+day} ${MONTHS[+m - 1]}`;
}

function fmtDuration(ms: number | null): string {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.round((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  } catch { return ''; }
}

function fmtTimeIST(iso: string | null): string {
  if (!iso) return '';
  try {
    // Handle various timestamp formats from the DB
    let d: Date;
    if (iso.includes('+') || iso.endsWith('Z')) {
      // Already has timezone info
      d = new Date(iso);
    } else {
      // No timezone — assume UTC
      d = new Date(iso + 'Z');
    }
    return d.toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: true, timeZone: 'Asia/Kolkata',
    });
  } catch { return ''; }
}

// ── Step icon ────────────────────────────────────────────────────────────────

function StepIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed': return <CheckCircle2 className="w-4 h-4 text-risk-green" />;
    case 'failed':    return <XCircle className="w-4 h-4 text-risk-red" />;
    case 'skipped':   return <MinusCircle className="w-4 h-4 text-muted" />;
    case 'running':   return <Loader2 className="w-4 h-4 text-accent-indigo animate-spin" />;
    default:          return <Clock className="w-4 h-4 text-[var(--text-muted)] opacity-30" />;
  }
}

// ── Step row ─────────────────────────────────────────────────────────────────

function StepRow({ step }: { step: StepStatus }) {
  const isActive = step.status === 'running';
  const isDone = step.status === 'completed' || step.status === 'skipped';
  const isFailed = step.status === 'failed';

  return (
    <div className={cn(
      'flex items-center gap-3 py-2 px-3 rounded-lg transition-all',
      isActive && 'bg-accent-indigo/5 border border-accent-indigo/20',
      isFailed && 'bg-risk-red/5',
    )}>
      {/* Timeline connector */}
      <div className="flex flex-col items-center gap-0.5">
        <StepIcon status={step.status} />
      </div>

      {/* Label */}
      <div className="flex-1 min-w-0">
        <div className={cn(
          'text-[12px] font-medium',
          isActive ? 'text-accent-indigo font-bold' :
          isDone ? 'text-[var(--text-primary)]' :
          isFailed ? 'text-risk-red' :
          'text-[var(--text-muted)]',
        )}>
          {step.label}
        </div>
        {isFailed && step.error_msg && (
          <div className="text-[10px] text-risk-red mt-0.5 truncate max-w-[300px]">
            {step.error_msg}
          </div>
        )}
      </div>

      {/* Row count */}
      <div className="w-20 text-right">
        {step.rows_count > 0 && (
          <span className={cn(
            'text-[11px] mono font-medium',
            isActive ? 'text-accent-indigo' : 'text-[var(--text-secondary)]',
          )}>
            {step.rows_count.toLocaleString()} rows
          </span>
        )}
      </div>

      {/* Duration */}
      <div className="w-14 text-right">
        {step.duration_ms != null && step.duration_ms > 0 && (
          <span className="text-[10px] mono text-muted">
            {fmtDuration(step.duration_ms)}
          </span>
        )}
        {isActive && (
          <span className="text-[10px] text-accent-indigo animate-pulse">running</span>
        )}
      </div>
    </div>
  );
}

// ── Date section (collapsible for backfill with many dates) ──────────────────

function DateSection({ view, defaultOpen }: { view: DateView; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const allDone = view.completed === view.total;
  const hasFailed = view.steps.some(s => s.status === 'failed');

  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left py-1.5 px-2 rounded-md hover:bg-kd-elevated/40 transition-colors"
      >
        {open ? <ChevronDown className="w-3 h-3 text-muted" /> : <ChevronRight className="w-3 h-3 text-muted" />}
        <span className="text-[11px] font-bold text-[var(--text-primary)]">{fmtDate(view.date)}</span>
        <span className="text-[9px] text-muted mono">{view.date}</span>

        {/* Progress bar */}
        <div className="flex-1 mx-2">
          <div className="h-1.5 bg-kd-elevated rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                hasFailed ? 'bg-risk-red' : allDone ? 'bg-risk-green' : 'bg-accent-indigo',
              )}
              style={{ width: `${view.progress_pct}%` }}
            />
          </div>
        </div>

        <span className={cn(
          'text-[10px] font-bold mono',
          hasFailed ? 'text-risk-red' : allDone ? 'text-risk-green' : 'text-accent-indigo',
        )}>
          {view.completed}/{view.total}
        </span>
      </button>

      {open && (
        <div className="ml-3 mt-1 space-y-0.5">
          {view.steps.map(step => (
            <StepRow key={step.step} step={step} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Data fetch ───────────────────────────────────────────────────────────────

function usePipelineLive(enabled: boolean) {
  const pipelineUrl = (import.meta.env.VITE_PIPELINE_API_URL as string) ?? '';
  return useQuery({
    queryKey: ['pipeline_live'],
    queryFn: async (): Promise<LiveData> => {
      const res = await fetch(`${pipelineUrl}/api/pipeline/live`);
      if (!res.ok) return { active: false, job: null, exchanges: [] };
      return res.json();
    },
    staleTime: 2_000,
    refetchInterval: enabled ? 3_000 : 30_000, // Poll every 3s when active, 30s when idle
    retry: 1,
  });
}

// ── Fix job label mapping ────────────────────────────────────────────────────

const FIX_LABELS: Record<string, string> = {
  'fix:indicators': 'Recomputing Technical Indicators',
  'fix:flow_intelligence': 'Recomputing Flow Intelligence',
  'fix:market_breadth': 'Recomputing Market Breadth',
  'fix:breadth_roc': 'Recomputing Breadth ROC',
  'fix:nse_equities': 'Backfilling NSE Equities',
  'fix:bse_equities': 'Backfilling BSE Equities',
  'fix:fii_dii': 'Downloading FII/DII Data',
};

// ── Main Component ───────────────────────────────────────────────────────────

export default function PipelineExecution() {
  const { data: live, isLoading } = usePipelineLive(true);
  const qc = useQueryClient();
  const pipelineUrl = (import.meta.env.VITE_PIPELINE_API_URL as string) ?? '';

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${pipelineUrl}/api/pipeline/cancel`, { method: 'POST' });
      if (!res.ok) throw new Error('Cancel failed');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipeline_live'] });
    },
  });

  const isActive = live?.active ?? false;
  const job = live?.job;
  const exchanges = live?.exchanges ?? [];
  const isFixJob = job?.type?.startsWith('fix:') ?? false;
  const hasDates = exchanges.some(e => e.dates.length > 0);
  // Fix jobs with dates (backfill-style) should show step view, not simple card
  const showStepView = hasDates;
  const showFixCard = isFixJob && !hasDates;

  // Don't render if no job data at all
  if (!isLoading && !job && exchanges.length === 0) {
    return null;
  }

  return (
    <Card rounded="xxl" className="p-5 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {isActive ? (
            <Loader2 className="w-4 h-4 text-accent-indigo animate-spin" />
          ) : job?.status === 'completed' ? (
            <CheckCircle2 className="w-4 h-4 text-risk-green" />
          ) : job?.status === 'failed' ? (
            <XCircle className="w-4 h-4 text-risk-red" />
          ) : (
            <Play className="w-4 h-4 text-muted" />
          )}
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-primary)]">
            Pipeline Execution
          </h3>
          {isActive && (
            <>
              <span className="px-2 py-0.5 rounded-md bg-accent-indigo/10 border border-accent-indigo/30 text-[9px] font-bold text-accent-indigo uppercase">
                Live
              </span>
              <button
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="px-2 py-0.5 rounded-md bg-risk-red/10 border border-risk-red/30 text-[9px] font-bold text-risk-red uppercase hover:bg-risk-red/20 transition-colors"
              >
                {cancelMutation.isPending ? 'Cancelling...' : 'Cancel'}
              </button>
            </>
          )}
          {job?.status === 'cancelled' && (
            <span className="px-2 py-0.5 rounded-md bg-risk-amber/10 border border-risk-amber/30 text-[9px] font-bold text-risk-amber uppercase">
              Cancelled
            </span>
          )}
        </div>

        {job && (
          <div className="flex items-center gap-3 text-[10px] text-muted">
            {job.type === 'backfill' && (
              <span className="font-bold">{job.total_dates} dates</span>
            )}
            {!isFixJob && <span className="mono">{job.exchange}</span>}
            {job.elapsed_ms != null && (
              <span className="mono">{fmtDuration(job.elapsed_ms)}</span>
            )}
            {job.status === 'completed' && !isFixJob && (
              <span className={cn(
                'font-bold uppercase',
                job.failed > 0 ? 'text-risk-amber' : 'text-risk-green',
              )}>
                {job.success} ok{job.failed > 0 ? ` · ${job.failed} failed` : ''}
              </span>
            )}
          </div>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-6 text-muted gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs">Loading execution state...</span>
        </div>
      )}

      {/* Job progress view */}
      {job && (
        <div className={cn(
          'py-4 px-4 rounded-xl border mb-3',
          isActive ? 'bg-accent-indigo/5 border-accent-indigo/20' :
          job.status === 'completed' ? 'bg-risk-green/5 border-risk-green/20' :
          job.status === 'failed' ? 'bg-risk-red/5 border-risk-red/20' :
          job.status === 'cancelled' ? 'bg-risk-amber/5 border-risk-amber/20' :
          'bg-kd-elevated border-kd-border',
        )}>
          <div className="flex items-center gap-3">
            {isActive ? (
              <Loader2 className="w-5 h-5 text-accent-indigo animate-spin shrink-0" />
            ) : job.status === 'completed' ? (
              <CheckCircle2 className="w-5 h-5 text-risk-green shrink-0" />
            ) : job.status === 'cancelled' ? (
              <StopCircle className="w-5 h-5 text-risk-amber shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-risk-red shrink-0" />
            )}
            <div className="flex-1">
              <div className={cn(
                'text-[13px] font-bold',
                isActive ? 'text-accent-indigo' :
                job.status === 'completed' ? 'text-risk-green' :
                job.status === 'cancelled' ? 'text-risk-amber' : 'text-risk-red',
              )}>
                {FIX_LABELS[job.type] ?? job.type.replace('fix:', 'Fixing ')}
              </div>
              {/* Progress text from worker */}
              {job.progress && (
                <div className="text-[11px] text-[var(--text-secondary)] mt-0.5 mono">
                  {job.progress}
                </div>
              )}
              {!job.progress && (
                <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                  {isActive ? 'Waiting for worker to pick up job...' :
                   job.status === 'completed' ? 'Completed successfully.' :
                   job.status === 'cancelled' ? 'Job was cancelled.' :
                   job.error_msg || 'Failed — check worker logs.'}
                </div>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {isActive && job.progress_pct > 0 && (
            <div className="mt-3">
              <div className="h-1.5 bg-kd-elevated rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent-indigo transition-all duration-500"
                  style={{ width: `${job.progress_pct}%` }}
                />
              </div>
              <div className="text-[9px] text-muted mt-1 text-right mono">
                {job.progress_pct}%
              </div>
            </div>
          )}
        </div>
      )}

      {/* Per-date step-by-step view */}
      {exchanges.length > 0 && exchanges.map(exch => (
        <div key={exch.exchange} className="mb-3">
          {exch.dates.map((view) => (
            <DateSection
              key={view.date}
              view={view}
              defaultOpen={true}
            />
          ))}
        </div>
      ))}

      {/* Job timestamps */}
      {job && (
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-kd-border/30 text-[9px] text-muted">
          {job.started_at && (
            <span>Started: <span className="mono text-[var(--text-secondary)]">{fmtTimeIST(job.started_at)}</span></span>
          )}
          {job.completed_at && (
            <span>Completed: <span className="mono text-[var(--text-secondary)]">{fmtTimeIST(job.completed_at)}</span></span>
          )}
          <span className="ml-auto mono">{job.job_id}</span>
        </div>
      )}
    </Card>
  );
}
