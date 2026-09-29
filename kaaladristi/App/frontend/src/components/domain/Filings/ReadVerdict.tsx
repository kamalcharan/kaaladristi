/**
 * The READ of a filing on the Filings page — the reader's verdict
 * (km_filing_reads), its status while it is not yet a verdict, and the
 * admin's second opinion beside it (km_filing_read_checks, migration 233).
 *
 * Three pieces, one file, because they share one vocabulary
 * (constants/filingReads.ts):
 *   ReadCell      — the column: a status pill, or the verdict in five words.
 *   ReadDetail    — on expand: headline, reasoning, quoted evidence, the second
 *                   opinion side by side, and Restart for admin on a failed row.
 *   CheckActionBar — the admin's selection bar: "Check with Haiku (n)".
 *
 * ⚠ A verdict is the filing's effect on the COMPANY as the document states it.
 * Nothing here says "buy", "target" or "will rise"; the drift beside a filing
 * comes from bars, on the scanner, never from here.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FilingRead, FilingReadCheck } from '@/services/filingReads';
import { requestFilingChecks, restartFilingRead } from '@/services/pipeline2';
import {
  BACKEND_LABELS, IMPACT_LABELS, MAGNITUDE_LABELS, READ_STATUS_LABELS,
  backendOfModel, otherBackend, type CheckBackend,
} from '@/constants/filingReads';

const READS_KEY = ['filing-reads'];

/** Five words at most: "Positive · notable" or the status. Nothing for an event outside the reader's scope. */
export function ReadCell({ read }: { read: FilingRead | undefined }) {
  if (!read) return <span className="text-[11px] text-muted/60">—</span>;
  if (read.status !== 'done' || !read.impact) {
    const s = READ_STATUS_LABELS[read.status] ?? READ_STATUS_LABELS.pending;
    return (
      <span className={cn('inline-flex items-center gap-1 text-[11px]', s.color)}>
        {read.status === 'reading' && <Loader2 className="w-3 h-3 animate-spin" />}
        {read.status === 'failed' && <AlertTriangle className="w-3 h-3" />}
        {s.label}
      </span>
    );
  }
  const imp = IMPACT_LABELS[read.impact];
  return (
    <span className="min-w-0 block">
      <span className={cn('text-[12px] font-medium', imp.color)}>{imp.label}</span>
      {read.magnitude && (
        <span className="text-[11px] text-muted"> · {MAGNITUDE_LABELS[read.magnitude]}</span>
      )}
    </span>
  );
}

function VerdictBlock({
  title, impact, magnitude, headline, reasoning, evidenceQuote, confidence, model, foot,
}: {
  title: string;
  impact: FilingRead['impact'];
  magnitude: FilingRead['magnitude'];
  headline: string | null;
  reasoning: string | null;
  evidenceQuote: string | null;
  confidence: number | null;
  model: string | null;
  foot?: string | null;
}) {
  const imp = impact ? IMPACT_LABELS[impact] : null;
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">{title}</span>
        {imp && <span className={cn('text-[12px] font-medium', imp.color)}>{imp.label}</span>}
        {magnitude && <span className="text-[11px] text-muted">· {MAGNITUDE_LABELS[magnitude]}</span>}
        {confidence != null && (
          <span className="text-[10px] font-mono text-muted">· confidence {Math.round(confidence * 100)}%</span>
        )}
      </div>
      {headline && <div className="text-[13px] text-primary leading-snug">{headline}</div>}
      {reasoning && (
        <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">{reasoning}</p>
      )}
      {evidenceQuote && (
        <blockquote className="text-[11px] text-muted italic leading-relaxed border-l-2 border-kd-border pl-2 whitespace-pre-line">
          “{evidenceQuote}”
        </blockquote>
      )}
      <div className="text-[10px] font-mono text-muted">
        {model ? `${BACKEND_LABELS[backendOfModel(model)]} · ${model.replace(/^local:/, '')}` : ''}
        {foot ? ` · ${foot}` : ''}
      </div>
    </div>
  );
}

export function ReadDetail({
  eventId, read, checks, isAdmin,
}: {
  eventId: number;
  read: FilingRead | undefined;
  checks: FilingReadCheck[];
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: READS_KEY });
  const restart = useMutation({ mutationFn: () => restartFilingRead(eventId), onSuccess: invalidate });
  const check = useMutation({
    mutationFn: (backend: CheckBackend) => requestFilingChecks({ event_ids: [eventId], backend }),
    onSuccess: invalidate,
  });

  if (!read) return null;                       // outside the reader's scope: say nothing
  const s = READ_STATUS_LABELS[read.status] ?? READ_STATUS_LABELS.pending;

  if (read.status !== 'done') {
    return (
      <div className="space-y-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">Read</div>
        <div className={cn('text-[12px] flex items-center gap-2 flex-wrap', s.color)}>
          {read.status === 'reading' && <Loader2 className="w-3 h-3 animate-spin" />}
          {s.label}
          {read.status === 'pending' && <span className="text-muted">· runs after the next filings download</span>}
          {read.triageReason && <span className="text-muted">· {read.triageReason}</span>}
          {read.lastError && <span className="text-muted font-mono break-all">· {read.lastError}</span>}
          {read.attempts > 0 && <span className="text-muted">· {read.attempts} attempt{read.attempts === 1 ? '' : 's'}</span>}
        </div>
        {isAdmin && s.restartable && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); restart.mutate(); }}
            disabled={restart.isPending}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium',
              'bg-kd-elevated border border-kd-border text-primary hover:border-[var(--accent)]/40',
              'disabled:opacity-50',
            )}
          >
            <RotateCcw className="w-3 h-3" />
            {restart.isPending ? 'Restarting…' : 'Restart read'}
          </button>
        )}
        {restart.isError && <div className="text-[11px] text-risk-red">Could not restart: {String((restart.error as Error)?.message ?? '')}</div>}
      </div>
    );
  }

  const second = checks.find((c) => c.backend === otherBackend(read.model));
  const agree = second?.status === 'done' && second.impact === read.impact;

  return (
    <div className="space-y-2.5">
      <div className={cn('grid gap-4', second ? 'sm:grid-cols-2' : 'grid-cols-1')}>
        <VerdictBlock
          title="Read — for the company"
          impact={read.impact} magnitude={read.magnitude} headline={read.headline}
          reasoning={read.reasoning} evidenceQuote={read.evidenceQuote}
          confidence={read.confidence} model={read.model}
          foot={read.pagesRead != null && read.pageCount != null && read.pagesRead < read.pageCount
            ? `${read.pagesRead} of ${read.pageCount} pages` : null}
        />
        {second && second.status === 'done' && (
          <VerdictBlock
            title={`Second opinion — ${BACKEND_LABELS[second.backend]}`}
            impact={second.impact} magnitude={second.magnitude} headline={second.headline}
            reasoning={second.reasoning} evidenceQuote={second.evidenceQuote}
            confidence={second.confidence} model={second.model}
            foot={second.costUsd ? `$${second.costUsd.toFixed(4)}` : null}
          />
        )}
        {second && second.status !== 'done' && (
          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              Second opinion — {BACKEND_LABELS[second.backend]}
            </div>
            <div className={cn('text-[12px] flex items-center gap-2', second.status === 'failed' ? 'text-risk-red' : 'text-muted')}>
              {second.status !== 'failed' && <Loader2 className="w-3 h-3 animate-spin" />}
              {second.status === 'failed' ? 'Failed' : second.status === 'running' ? 'Reading…' : 'Queued'}
              {second.lastError && <span className="font-mono break-all">· {second.lastError}</span>}
            </div>
          </div>
        )}
      </div>

      {second?.status === 'done' && (
        <div className={cn('inline-flex items-center gap-1.5 text-[11px] font-medium', agree ? 'text-risk-green' : 'text-risk-red')}>
          {agree ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          {agree ? 'Both readers agree on the impact.' : 'The two readers DISAGREE on the impact — judge by the quotes.'}
        </div>
      )}

      {isAdmin && (!second || second.status === 'failed') && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); check.mutate(otherBackend(read.model)); }}
          disabled={check.isPending}
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium',
            'bg-kd-elevated border border-kd-border text-primary hover:border-[var(--accent)]/40',
            'disabled:opacity-50',
          )}
        >
          <Sparkles className="w-3 h-3" />
          {check.isPending ? 'Queuing…' : `Check with ${BACKEND_LABELS[otherBackend(read.model)]}`}
        </button>
      )}
      {check.isError && <div className="text-[11px] text-risk-red">Could not queue: {String((check.error as Error)?.message ?? '')}</div>}
    </div>
  );
}

/**
 * The admin's bar for a multi-row selection. Every ticked row is read by the
 * same primary backend or the button is split — a Haiku-read row wants a Qwen
 * check and a Qwen-read row wants a Haiku one, and one click must never send a
 * paid request for a row that only needed a free one.
 */
export function CheckActionBar({
  selected, reads, onDone, onClear,
}: {
  selected: number[];
  reads: Map<number, FilingRead>;
  onDone: () => void;
  onClear: () => void;
}) {
  const qc = useQueryClient();
  const groups: Record<CheckBackend, number[]> = { anthropic: [], local: [] };
  for (const id of selected) {
    const r = reads.get(id);
    if (r?.status === 'done') groups[otherBackend(r.model)].push(id);
  }
  const m = useMutation({
    mutationFn: (backend: CheckBackend) => requestFilingChecks({ event_ids: groups[backend], backend }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: READS_KEY }); onDone(); },
  });
  if (!selected.length) return null;
  const btn = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium border disabled:opacity-50';
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-kd-border bg-[var(--accent)]/10">
      <span className="text-[12px] text-primary">{selected.length} selected</span>
      {groups.anthropic.length > 0 && (
        <button type="button" disabled={m.isPending} onClick={() => m.mutate('anthropic')}
          className={cn(btn, 'bg-[var(--accent)]/15 border-[var(--accent)]/40 text-[var(--accent)]')}>
          <Sparkles className="w-3 h-3" /> Check with Haiku ({groups.anthropic.length}) · paid
        </button>
      )}
      {groups.local.length > 0 && (
        <button type="button" disabled={m.isPending} onClick={() => m.mutate('local')}
          className={cn(btn, 'bg-kd-elevated border-kd-border text-primary')}>
          <Sparkles className="w-3 h-3" /> Check with Qwen ({groups.local.length}) · free
        </button>
      )}
      {groups.anthropic.length + groups.local.length < selected.length && (
        <span className="text-[11px] text-muted">
          {selected.length - groups.anthropic.length - groups.local.length} not read yet — skipped
        </span>
      )}
      {m.data && (
        <span className="text-[11px] text-muted font-mono">
          queued {m.data.queued}{m.data.already ? ` · ${m.data.already} already checked` : ''}
          {m.data.capped ? ` · ${m.data.capped} over the cap` : ''}
        </span>
      )}
      {m.isError && <span className="text-[11px] text-risk-red">{String((m.error as Error)?.message ?? 'failed')}</span>}
      <button type="button" onClick={onClear} className="ml-auto text-[11px] text-muted hover:text-primary">Clear</button>
    </div>
  );
}
