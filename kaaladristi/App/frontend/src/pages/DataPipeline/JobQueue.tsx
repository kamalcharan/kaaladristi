import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, AlertTriangle, X } from 'lucide-react';
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

export default function JobQueue({ refreshKey }: Props) {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['pipeline2', 'jobs', refreshKey],
    queryFn: () => fetchJobs(20),
    refetchInterval: (query) => {
      const jobs = query.state.data?.jobs ?? [];
      const active = jobs.some(j => j.status === 'running' || j.status === 'queued');
      return active ? 3_000 : 15_000;
    },
    staleTime: 2_000,
  });

  // When refreshKey flips (fresh enqueue), invalidate immediately.
  useEffect(() => {
    if (refreshKey !== undefined) {
      queryClient.invalidateQueries({ queryKey: ['pipeline2', 'jobs'] });
    }
  }, [refreshKey, queryClient]);

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
          {data.jobs.map(job => {
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
              <tr key={job.id} className="border-t border-kd-border/20">
                <td className="px-2 py-1.5 text-muted mono">#{job.id}</td>
                <td className="px-2 py-1.5">
                  <div className="text-secondary">
                    {job.job_type}
                    {job.dimension && <span className="text-muted"> · {job.dimension}</span>}
                  </div>
                  {job.exchange && (
                    <div className="text-[10px] text-muted">{job.exchange}</div>
                  )}
                </td>
                <td className="px-2 py-1.5 mono text-secondary">{job.trade_date ?? '—'}</td>
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
          })}
        </tbody>
      </table>
    </div>
  );
}
