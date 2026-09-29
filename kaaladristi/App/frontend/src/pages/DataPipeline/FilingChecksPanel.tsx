import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Play, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  fetchFilingCheckSummary, queueLocalFilingChecks, runFilingChecks,
} from '@/services/pipeline2';
import { BACKEND_LABELS } from '@/constants/filingReads';

/**
 * Qwen vs Haiku on the filings both have read — the admin's measurement panel
 * (migration 233, lib/filing_checks.py).
 *
 * Every rate carries its denominator. "82%" alone is the number that gets
 * quoted; "41 of 50" is the one that gets checked.
 */
export default function FilingChecksPanel() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['pipeline2', 'filing-checks', 'summary'],
    queryFn: fetchFilingCheckSummary,
    refetchInterval: (q) => (q.state.data?.runner.running ? 15 * 1000 : 60 * 1000),
    retry: 1,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['pipeline2', 'filing-checks'] });
  const queueLocal = useMutation({ mutationFn: queueLocalFilingChecks, onSuccess: invalidate });
  const run = useMutation({ mutationFn: runFilingChecks, onSuccess: invalidate });

  if (isLoading) {
    return <div className="text-xs text-muted flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</div>;
  }
  if (isError || !data) {
    return <div className="text-xs text-risk-amber">Could not load the check summary. Migration 233 applied?</div>;
  }

  const pct = (a: number, n: number) => (n ? `${Math.round((100 * a) / n)}%` : '—');
  const q = data.queue;
  const count = (b: string, s: string) => q[b]?.[s] ?? 0;
  const pending = count('anthropic', 'pending') + count('local', 'pending');
  const running = data.runner.running;

  return (
    <div className="rounded-lg border border-kd-border/40 bg-kd-card p-3 space-y-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-secondary">Qwen vs Haiku · filing reads</div>
          <div className="text-[11px] text-muted mt-0.5">
            Second opinions run in the API, never in the pipeline queue. Paid checks are capped at{' '}
            {data.paid_per_request} per click.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => queueLocal.mutate()}
            disabled={queueLocal.isPending || data.paid_reads_without_local_check === 0}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-[12px]',
              'bg-kd-elevated border-kd-border text-primary hover:border-[var(--accent)]/40',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
            title="Queue a free Qwen read on every filing Haiku read and Qwen has not"
          >
            <Play className="w-3 h-3" />
            Queue Qwen on {data.paid_reads_without_local_check.toLocaleString('en-IN')} Haiku reads
          </button>
          <button
            type="button"
            onClick={() => run.mutate()}
            disabled={run.isPending || running || pending === 0}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-[12px]',
              'bg-kd-elevated border-kd-border text-primary hover:border-[var(--accent)]/40',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
            title="Drain the pending checks (after a restart, or a batch that stopped)"
          >
            <RefreshCw className={cn('w-3 h-3', running && 'animate-spin')} />
            {running ? 'Running…' : `Run ${pending} pending`}
          </button>
        </div>
      </div>

      {/* queue + cost */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {(['anthropic', 'local'] as const).map((b) => (
          <div key={b} className="rounded border border-kd-border/40 px-2 py-1.5">
            <div className="text-[10px] uppercase tracking-wider text-muted">{BACKEND_LABELS[b]} checks</div>
            <div className="font-mono text-primary">
              {count(b, 'done')} done · {count(b, 'pending') + count(b, 'running')} queued · {count(b, 'failed')} failed
            </div>
          </div>
        ))}
        <div className="rounded border border-kd-border/40 px-2 py-1.5">
          <div className="text-[10px] uppercase tracking-wider text-muted">Spent on checks</div>
          <div className="font-mono text-primary">${data.cost_usd.toFixed(3)}</div>
        </div>
        <div className="rounded border border-kd-border/40 px-2 py-1.5">
          <div className="text-[10px] uppercase tracking-wider text-muted">Agreement</div>
          <div className="font-mono text-primary">
            impact {data.agree_impact} of {data.compared} ({pct(data.agree_impact, data.compared)})
          </div>
          <div className="font-mono text-muted">
            size {data.agree_magnitude} of {data.compared} ({pct(data.agree_magnitude, data.compared)})
          </div>
        </div>
      </div>

      {data.runner.error && (
        <div className="text-risk-red">Runner stopped: {data.runner.error}</div>
      )}
      {data.runner.last && typeof data.runner.last.stopped === 'string' && (
        <div className="text-risk-amber">Last batch stopped early: {data.runner.last.stopped}</div>
      )}

      {/* per event type */}
      {data.compared === 0 ? (
        <div className="text-muted">
          No filing has been read by both yet. Tick rows on the Filings page and choose
          "Check with Haiku", or queue Qwen on the Haiku reads above.
        </div>
      ) : (
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-muted">
              <th className="text-left font-semibold py-1">Event type</th>
              <th className="text-right font-semibold py-1">Compared</th>
              <th className="text-right font-semibold py-1">Impact agrees</th>
              <th className="text-right font-semibold py-1">Size agrees</th>
            </tr>
          </thead>
          <tbody>
            {data.by_type.map((t) => (
              <tr key={t.event_type} className="border-t border-kd-border/30">
                <td className="py-1 font-mono text-primary">{t.event_type}</td>
                <td className="py-1 text-right font-mono text-secondary">{t.n}</td>
                <td className={cn('py-1 text-right font-mono', t.impact === t.n ? 'text-risk-green' : t.impact * 2 < t.n ? 'text-risk-red' : 'text-primary')}>
                  {t.impact} of {t.n} · {pct(t.impact, t.n)}
                </td>
                <td className="py-1 text-right font-mono text-secondary">{t.magnitude} of {t.n} · {pct(t.magnitude, t.n)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
