import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Play, RefreshCw, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  fetchFilingCheckSummary, queueLocalFilingChecks, runFilingChecks, stopFilingChecks,
} from '@/services/pipeline2';
import { BACKEND_LABELS } from '@/constants/filingReads';
import type { FilingCheckSummary } from '@/services/pipeline2';

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
  const stop = useMutation({ mutationFn: stopFilingChecks, onSuccess: invalidate });

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
  // Current filings waiting, plus reads cut off mid-way (a restart). Run
  // releases the stuck ones first, so either is work for the button.
  const waitingReads = (data.current?.status.pending ?? 0)
    + (data.running_now ?? []).filter((r) => r.where.startsWith('Interrupted')).length;
  const work = pending + waitingReads;

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
            disabled={run.isPending || running || work === 0}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-[12px]',
              'bg-kd-elevated border-kd-border text-primary hover:border-[var(--accent)]/40',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
            title="Release stuck reads, then read waiting filings and drain pending checks"
          >
            <RefreshCw className={cn('w-3 h-3', running && 'animate-spin')} />
            {data.runner.stopping ? 'Stopping…' : running ? 'Running…' : `Run now (${work} waiting)`}
          </button>
          <button
            type="button"
            onClick={() => stop.mutate()}
            disabled={stop.isPending || !!data.runner.stopping || (!running && pending === 0)}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-[12px]',
              'bg-kd-elevated border-kd-border text-risk-red hover:border-risk-red/40',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
            title="Stop the runner. Waiting checks are parked as failed and never restart on their own."
          >
            <Square className="w-3 h-3" />
            Stop
          </button>
        </div>
      </div>

      {data.current && <CurrentReads current={data.current} />}
      <RunningNow items={data.running_now ?? []} stopping={!!data.runner.stopping} />

      {/* queue + cost */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {(['anthropic', 'local'] as const).map((b) => (
          <div key={b} className="rounded border border-kd-border/40 px-2 py-1.5">
            <div className="text-[10px] uppercase tracking-wider text-muted">{BACKEND_LABELS[b]} checks</div>
            <div className="font-mono text-primary">
              {count(b, 'done')} done · {count(b, 'pending') + count(b, 'running')} queued · {count(b, 'failed')} failed
              {count(b, 'stopped') > 0 && ` · ${count(b, 'stopped')} stopped`}
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
            size {data.agree_magnitude} of {data.compared_magnitude ?? data.compared} ({pct(data.agree_magnitude, data.compared_magnitude ?? data.compared)})
            {' '}· older reads only
          </div>
        </div>
      </div>

      {data.runner.waiting_until && (
        <div className="text-risk-amber">
          Qwen is not answering. Waiting, then retrying on its own at{' '}
          {new Date(data.runner.waiting_until).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST.
          Nothing is lost; the rows stay pending.
        </div>
      )}
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
                <td className="py-1 text-right font-mono text-secondary">{t.magnitude} of {t.magnitude_n ?? t.n} · {pct(t.magnitude, t.magnitude_n ?? t.n)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const READER_LABELS: Record<string, string> = {
  groq: 'Groq', openrouter: 'OpenRouter', qwen: 'Qwen', haiku: 'Haiku',
};

const istTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
      })
    : '—';

/**
 * The CURRENT stream, above the history comparison: filings disseminated in
 * the last few days — how many are read, how many wait, and which lane read
 * them (lib/llm_lanes.py). The table below measures the past; this says
 * whether today is being read at all.
 */
function CurrentReads({ current }: { current: NonNullable<FilingCheckSummary['current']> }) {
  const st = current.status;
  const n = (k: string) => st[k] ?? 0;
  const total = Object.values(st).reduce((a, b) => a + b, 0);
  const waiting = n('pending') + n('reading');
  return (
    <div className="rounded border border-[var(--accent)]/30 px-2.5 py-2 space-y-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[10px] uppercase tracking-wider text-muted">
          Current filings · last {current.days} days
        </div>
        <div className="text-[10px] text-muted">
          Route: {current.route.map((r) => READER_LABELS[r] ?? r).join(' → ')}
        </div>
      </div>
      <div className="font-mono text-primary">
        {n('done')} read · {waiting} waiting · {n('failed')} failed · {n('skipped')} skipped
        {n('unreadable') > 0 && ` · ${n('unreadable')} unreadable`}
        <span className="text-muted"> — of {total}</span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
        <span className="text-muted">
          Read by:{' '}
          {current.by_reader.length === 0
            ? 'none yet'
            : current.by_reader.map((r) => `${READER_LABELS[r.reader] ?? r.reader} ${r.n}`).join(' · ')}
        </span>
        <span className="text-muted">Last read: {istTime(current.last_read_at)} IST</span>
        {current.oldest_waiting_at && (
          <span className={cn(waiting > 0 ? 'text-risk-amber' : 'text-muted')}>
            Oldest waiting: filed {istTime(current.oldest_waiting_at)} IST
          </span>
        )}
      </div>
    </div>
  );
}

const minutesSince = (iso: string | null) => {
  if (!iso) return '';
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 1 ? 'under a minute' : `${m} min`;
};

/**
 * What is being read RIGHT NOW, and where. Two processes read filings: the
 * API runner (today's filings first, then second-opinion checks — Stop
 * controls it) and the pipeline worker's scheduled ingest passes (separate,
 * capped at 15 minutes a pass, not touched by Stop). A Stop lets the item in
 * flight finish, which on Qwen can take minutes — so it says so.
 */
function RunningNow({ items, stopping }: {
  items: NonNullable<FilingCheckSummary['running_now']>; stopping: boolean;
}) {
  return (
    <div className="rounded border border-kd-border/40 px-2.5 py-2 space-y-1">
      <div className="text-[10px] uppercase tracking-wider text-muted">Running now</div>
      {stopping && (
        <div className="text-risk-amber text-[11px]">
          Stopping — the item in flight finishes first (on Qwen this can take a few minutes). Nothing new starts.
        </div>
      )}
      {items.length === 0 ? (
        <div className="text-muted text-[11px]">Nothing is being read.</div>
      ) : (
        items.map((it, i) => (
          <div key={i} className="flex flex-wrap gap-x-3 text-[11px]">
            <span className="text-primary font-medium">{it.where}</span>
            <span className="text-secondary">
              {it.kind === 'check' ? 'second opinion' : 'reading'} · {it.company ?? '—'}
            </span>
            {it.provider && <span className="text-muted">via {READER_LABELS[it.provider] ?? it.provider}</span>}
            <span className="text-muted">{minutesSince(it.since)}</span>
          </div>
        ))
      )}
      <div className="text-[10px] text-muted">
        Stop controls the API runner only. The pipeline worker reads during its scheduled filing passes
        (max 15 minutes each) and is not affected.
      </div>
    </div>
  );
}
