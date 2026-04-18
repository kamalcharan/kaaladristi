import { Fragment, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, AlertTriangle, X, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchJobs, cancelJob, type Job, type JobStatus } from '@/services/pipeline2';

interface Props {
  refreshKey?: number;
}

const STATUS_BADGE: Record<JobStatus, string> = {
  queued:    'bg-slate-600/30 text-slate-300',
  running:   'bg-accent-indigo/30 text-accent-indigo animate-pulse',
  completed: 'bg-emerald-500/20 text-emerald-300',
  partial:   'bg-amber-500/20 text-amber-300',
  failed:    'bg-rose-500/20 text-rose-300',
  cancelled: 'bg-slate-700/30 text-muted',
};

const COL_COUNT = 8;

function elapsedMs(job: Job): number | null {
  if (!job.started_at) return null;
  const start = new Date(job.started_at).getTime();
  const end = job.completed_at ? new Date(job.completed_at).getTime() : Date.now();
  return end - start;
}

function fmtMs(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m${s.toString().padStart(2, '0')}s`;
}

function jobDateDisplay(job: Job): string {
  if (job.trade_date) return job.trade_date;
  if (job.date_from && job.date_to) {
    return job.date_from === job.date_to
      ? job.date_from
      : `${job.date_from} → ${job.date_to}`;
  }
  return '—';
}

// A "visual group": either a solo job (no batch) or a set of jobs sharing batch_id.
type JobGroup =
  | { kind: 'solo'; job: Job }
  | {
      kind: 'batch';
      batchId: string;
      jobs: Job[];
      completed: number;
      total: number;
      running: boolean;
      failed: number;
      partial: number;
    };

function groupJobs(jobs: Job[]): JobGroup[] {
  // Preserve the API's ordering (created_at DESC, id DESC). Walk the list:
  // when we hit the first job of a new batch_id, emit the whole batch in
  // its own block and skip subsequent members of that batch as we encounter
  // them.
  const seenBatches = new Set<string>();
  const out: JobGroup[] = [];

  for (const job of jobs) {
    if (!job.batch_id) {
      out.push({ kind: 'solo', job });
      continue;
    }
    if (seenBatches.has(job.batch_id)) continue;
    seenBatches.add(job.batch_id);

    const siblings = jobs.filter(j => j.batch_id === job.batch_id);
    // Show batch members in insertion order (oldest first = dependency order).
    const ordered = [...siblings].sort((a, b) => a.id - b.id);
    const completed = ordered.filter(j =>
      j.status === 'completed' || j.status === 'partial'
    ).length;
    const failed = ordered.filter(j => j.status === 'failed').length;
    const partial = ordered.filter(j => j.status === 'partial').length;
    const running = ordered.some(j =>
      j.status === 'running' || j.status === 'queued'
    );
    out.push({
      kind: 'batch',
      batchId: job.batch_id,
      jobs: ordered,
      completed,
      total: ordered.length,
      running,
      failed,
      partial,
    });
  }
  return out;
}

export default function JobQueue({ refreshKey }: Props) {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['pipeline2', 'jobs', refreshKey],
    queryFn: () => fetchJobs(50),
    refetchInterval: (query) => {
      const jobs = query.state.data?.jobs ?? [];
      const active = jobs.some(j => j.status === 'running' || j.status === 'queued');
      return active ? 3_000 : 15_000;
    },
    staleTime: 2_000,
  });

  useEffect(() => {
    if (refreshKey !== undefined) {
      queryClient.invalidateQueries({ queryKey: ['pipeline2', 'jobs'] });
    }
  }, [refreshKey, queryClient]);

  const groups = useMemo(() => (data ? groupJobs(data.jobs) : []), [data]);

  const onCancel = async (jobId: number) => {
    try {
      await cancelJob(jobId);
      queryClient.invalidateQueries({ queryKey: ['pipeline2', 'jobs'] });
    } catch (e) {
      console.error('cancel failed', e);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted p-4 bg-kd-surface/30 rounded-lg border border-kd-border/30">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading jobs…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center gap-2 text-sm text-risk-amber p-4 bg-risk-amber/5 rounded-lg border border-risk-amber/30">
        <AlertTriangle className="w-4 h-4" />
        {error instanceof Error ? error.message : 'Failed to load jobs'}
      </div>
    );
  }

  if (data.jobs.length === 0) {
    return (
      <div className="text-sm text-muted p-4 bg-kd-surface/30 rounded-lg border border-kd-border/30">
        No jobs yet. Use the Run / Fix panel to enqueue one.
      </div>
    );
  }

  return (
    <div className="bg-kd-surface/30 rounded-lg border border-kd-border/30 overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-kd-surface/50">
          <tr className="text-left text-muted">
            <th className="px-2 py-1.5 font-normal">#</th>
            <th className="px-2 py-1.5 font-normal">Type · Dimension</th>
            <th className="px-2 py-1.5 font-normal">Date</th>
            <th className="px-2 py-1.5 font-normal">Status</th>
            <th className="px-2 py-1.5 font-normal">Fill %</th>
            <th className="px-2 py-1.5 font-normal">Progress</th>
            <th className="px-2 py-1.5 font-normal">Elapsed</th>
            <th className="px-2 py-1.5"></th>
          </tr>
        </thead>
        <tbody>
          {groups.map(group => {
            if (group.kind === 'solo') {
              return (
                <JobRow
                  key={group.job.id}
                  job={group.job}
                  onCancel={onCancel}
                />
              );
            }
            const headerPct = Math.round(group.completed / Math.max(group.total, 1) * 100);
            const headerLabel =
              group.jobs[0]?.date_from && group.jobs[0]?.date_to
                ? `${group.jobs[0].date_from} → ${group.jobs[0].date_to}`
                : '';
            return (
              <Fragment key={group.batchId}>
                <tr className="bg-kd-elevated/30 border-t border-kd-border/40">
                  <td colSpan={COL_COUNT} className="px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-accent-indigo" />
                      <span className="text-xs font-medium text-secondary">
                        Backfill {headerLabel}
                      </span>
                      <span className="text-[10px] text-muted mono">
                        {group.batchId}
                      </span>
                      <span className="ml-auto text-[10px] text-muted">
                        {group.completed}/{group.total} complete
                        {group.failed > 0 && (
                          <span className="text-rose-400"> · {group.failed} failed</span>
                        )}
                        {group.partial > 0 && (
                          <span className="text-amber-300"> · {group.partial} partial</span>
                        )}
                      </span>
                      <div className="w-28 h-1 bg-slate-800 rounded overflow-hidden">
                        <div
                          className={cn(
                            'h-full transition-all',
                            group.failed > 0 ? 'bg-rose-500' :
                            group.partial > 0 ? 'bg-amber-500' :
                            group.running ? 'bg-accent-indigo' : 'bg-emerald-500',
                          )}
                          style={{ width: `${headerPct}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
                {group.jobs.map(j => (
                  <JobRow
                    key={j.id}
                    job={j}
                    onCancel={onCancel}
                    indent
                  />
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


function JobRow({ job, onCancel, indent }: {
  job: Job;
  onCancel: (id: number) => void;
  indent?: boolean;
}) {
  const isActive = job.status === 'queued' || job.status === 'running';
  const fillBefore = job.fill_rate_before;
  const fillAfter = job.fill_rate_after;
  const fillCell =
    fillBefore !== null && fillAfter !== null
      ? `${fillBefore.toFixed(1)} → ${fillAfter.toFixed(1)}`
      : fillAfter !== null
      ? fillAfter.toFixed(1)
      : '—';

  return (
    <tr className="border-t border-kd-border/20">
      <td className={cn('px-2 py-1.5 text-muted mono', indent && 'pl-6')}>#{job.id}</td>
      <td className="px-2 py-1.5">
        <div className="text-secondary">
          {job.job_type}
          {job.dimension && <span className="text-muted"> · {job.dimension}</span>}
        </div>
        {job.exchange && (
          <div className="text-[10px] text-muted">{job.exchange}</div>
        )}
      </td>
      <td className="px-2 py-1.5 mono text-secondary">{jobDateDisplay(job)}</td>
      <td className="px-2 py-1.5">
        <span className={cn(
          'inline-block px-1.5 py-0.5 rounded text-[10px] font-medium',
          STATUS_BADGE[job.status],
        )}>
          {job.status}
          {job.force && <span className="ml-1 opacity-70">force</span>}
        </span>
      </td>
      <td className="px-2 py-1.5 mono text-secondary">{fillCell}</td>
      <td className="px-2 py-1.5 min-w-[180px]">
        {job.status === 'running' && (
          <div className="space-y-1">
            <div className="w-full h-1 bg-slate-800 rounded overflow-hidden">
              <div
                className="h-full bg-accent-indigo transition-all"
                style={{ width: `${job.progress_pct ?? 0}%` }}
              />
            </div>
            <div className="text-[10px] text-muted truncate" title={job.progress_text ?? ''}>
              {job.progress_text ?? '…'}
            </div>
          </div>
        )}
        {job.status !== 'running' && job.progress_text && (
          <div className="text-[10px] text-muted truncate" title={job.progress_text}>
            {job.progress_text}
          </div>
        )}
        {job.error_msg && (
          <div className="text-[10px] text-rose-400 truncate" title={job.error_msg}>
            {job.error_msg}
          </div>
        )}
      </td>
      <td className="px-2 py-1.5 mono text-muted">{fmtMs(elapsedMs(job))}</td>
      <td className="px-2 py-1.5 text-right">
        {isActive && (
          <button
            onClick={() => onCancel(job.id)}
            className="p-1 text-muted hover:text-rose-400"
            title="Cancel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </td>
    </tr>
  );
}
