import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Play, AlertTriangle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  enqueueFix,
  enqueueDailyRun,
  enqueueBackfill,
  fetchDimensions,
  fetchSchedulerInfo,
} from '@/services/pipeline2';
import type { CellSelection } from './index';

interface Props {
  selection: CellSelection | null;
  onEnqueued: () => void;
}

type Mode = 'fix' | 'daily_run' | 'backfill';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export default function RunPanel({ selection, onEnqueued }: Props) {
  const [mode, setMode] = useState<Mode>('fix');
  const [dimension, setDimension] = useState<string>('');
  const [tradeDate, setTradeDate] = useState<string>(todayIso());
  // Backfill defaults: 7 days back → yesterday. A wider default invites
  // hundreds of NSE/BSE HTTP hits and gets us rate-limited — keep it
  // conservative and let the user widen it deliberately.
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState<string>(yesterdayIso());
  const [exchange, setExchange] = useState<string>('');
  const [force, setForce] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const { data: dims } = useQuery({
    queryKey: ['pipeline2', 'dimensions'],
    queryFn: fetchDimensions,
    staleTime: 5 * 60_000,
  });

  const { data: sched } = useQuery({
    queryKey: ['pipeline2', 'scheduler'],
    queryFn: fetchSchedulerInfo,
    refetchInterval: 60_000,
  });

  const fixable = dims?.dimensions.filter(d => d.fixable) ?? [];

  // Apply selection from HealthGrid cell click.
  useEffect(() => {
    if (selection) {
      setMode('fix');
      setDimension(selection.dimension);
      setTradeDate(selection.tradeDate);
      setOkMsg(null);
      setErr(null);
      if (selection.dimension.startsWith('nse_')) setExchange('NSE');
      else if (selection.dimension.startsWith('bse_')) setExchange('BSE');
      else setExchange('');
    }
  }, [selection]);

  useEffect(() => {
    if (!dimension && fixable.length > 0) {
      setDimension(fixable[0].key);
    }
  }, [fixable, dimension]);

  // Clear exchange when the selected dim has no exchange concept, so a
  // stale 'NSE' from a previous equity dim selection doesn't end up on
  // the job row (handler ignores it, but km_jobs.exchange would still
  // store a misleading value).
  useEffect(() => {
    if (dimension && NO_EXCHANGE_DIMS.has(dimension) && exchange) {
      setExchange('');
    }
    // NO_EXCHANGE_DIMS is a stable set literal — no need to memoise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimension]);

  // Kept for the (now informational) hint when a user targets a download
  // dim — the endpoint is functional, but the run will touch legacy NSE
  // infra so we surface that fact so the operator isn't surprised.
  const isDownload = Boolean(
    dimension && dims?.dimensions.find(d => d.key === dimension)?.group === 'download'
  );

  // Dimensions that don't have an exchange concept — hiding the Exchange
  // dropdown for these prevents setting e.g. exchange=NSE on an index
  // download, which was misleading even though the handler ignored it.
  const NO_EXCHANGE_DIMS = new Set([
    'index_eod_download',
    'index_indicators',
    'index_flow',
    'index_magic_rs',
    'industry_composites',
    'market_breadth',
    'breadth_roc',
  ]);
  const showExchange = dimension !== '' &&
                       dimension !== 'all' &&
                       !NO_EXCHANGE_DIMS.has(dimension);

  const submit = async () => {
    setSubmitting(true);
    setErr(null);
    setOkMsg(null);
    try {
      if (mode === 'fix') {
        if (!dimension) throw new Error('Pick a dimension');
        const result = await enqueueFix({
          dimension,
          trade_date: tradeDate,
          exchange: exchange || null,
          force,
        });
        setOkMsg(`Queued fix job #${result.job_id}`);
      } else if (mode === 'daily_run') {
        const result = await enqueueDailyRun({ trade_date: tradeDate, force });
        setOkMsg(`Queued daily_run job #${result.job_id}`);
      } else {
        if (!dimension) throw new Error('Pick a dimension');
        if (!dateFrom || !dateTo) throw new Error('Pick a date range');
        const result = await enqueueBackfill({
          dimension,
          date_from: dateFrom,
          date_to: dateTo,
          exchange: exchange || null,
          force,
        });
        setOkMsg(
          `Queued backfill — ${result.job_count} job${result.job_count === 1 ? '' : 's'} ` +
          `(${result.batch_id})`
        );
      }
      onEnqueued();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  // Disable rules per mode. Downloads are now runnable — the old
  // isDownload-blocks-submit check is gone.
  let disabled = submitting;
  if (mode === 'fix') {
    disabled = disabled || !dimension || !tradeDate;
  } else if (mode === 'daily_run') {
    disabled = disabled || !tradeDate;
  } else {
    disabled = disabled || !dimension || !dateFrom || !dateTo;
  }

  return (
    <div className="space-y-3 p-3 bg-kd-surface/30 rounded-lg border border-kd-border/30">
      {/* Mode tabs */}
      <div className="flex gap-1 bg-kd-bg/60 rounded-md p-0.5 text-xs">
        <ModeTab active={mode === 'fix'}        onClick={() => setMode('fix')}        label="Fix" />
        <ModeTab active={mode === 'daily_run'}  onClick={() => setMode('daily_run')}  label="Daily run" />
        <ModeTab active={mode === 'backfill'}   onClick={() => setMode('backfill')}   label="Backfill" />
      </div>

      {/* Dimension — fix + backfill */}
      {(mode === 'fix' || mode === 'backfill') && (
        <label className="block">
          <span className="text-[11px] text-muted">Dimension</span>
          <select
            value={dimension}
            onChange={e => setDimension(e.target.value)}
            className="w-full mt-0.5 px-2 py-1.5 text-xs bg-kd-bg rounded border border-kd-border/50 text-secondary"
          >
            {mode === 'backfill' && (
              <option value="all">All dimensions (15 jobs, dependency order)</option>
            )}
            {dims?.dimensions.map(d => (
              <option key={d.key} value={d.key} disabled={!d.fixable}>
                {d.label}{!d.fixable ? '  (not fixable)' : ''}
              </option>
            ))}
          </select>
          {isDownload && dimension !== 'all' && (
            <p className="mt-1 text-[10px] text-amber-300">
              Download runs hit NSE/BSE directly — expect 30–60s per date and don't
              run multiple in parallel against the same source.
            </p>
          )}
        </label>
      )}

      {/* Single trade date — fix + daily_run */}
      {(mode === 'fix' || mode === 'daily_run') && (
        <label className="block">
          <span className="text-[11px] text-muted">Trade date</span>
          <input
            type="date"
            value={tradeDate}
            onChange={e => setTradeDate(e.target.value)}
            className="w-full mt-0.5 px-2 py-1.5 text-xs bg-kd-bg rounded border border-kd-border/50 text-secondary mono"
          />
        </label>
      )}

      {/* Date range — backfill */}
      {mode === 'backfill' && (
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[11px] text-muted">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full mt-0.5 px-2 py-1.5 text-xs bg-kd-bg rounded border border-kd-border/50 text-secondary mono"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-muted">To</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full mt-0.5 px-2 py-1.5 text-xs bg-kd-bg rounded border border-kd-border/50 text-secondary mono"
            />
          </label>
        </div>
      )}

      {/* Exchange — only for dims that actually split by exchange (nse_* / bse_*).
          Hidden for index_*, industry, breadth, and 'all' (those imply or span). */}
      {(mode === 'fix' || mode === 'backfill') && showExchange && (
        <label className="block">
          <span className="text-[11px] text-muted">Exchange (optional)</span>
          <select
            value={exchange}
            onChange={e => setExchange(e.target.value)}
            className="w-full mt-0.5 px-2 py-1.5 text-xs bg-kd-bg rounded border border-kd-border/50 text-secondary"
          >
            <option value="">—</option>
            <option value="NSE">NSE</option>
            <option value="BSE">BSE</option>
          </select>
        </label>
      )}

      {/* Force */}
      <label className="flex items-center gap-2 text-xs text-secondary">
        <input
          type="checkbox"
          checked={force}
          onChange={e => setForce(e.target.checked)}
          className="rounded"
        />
        Force (erase existing output before recompute)
      </label>

      {/* Submit */}
      <button
        onClick={submit}
        disabled={disabled}
        className={cn(
          'w-full flex items-center justify-center gap-2 py-2 rounded text-sm font-medium transition-all',
          'bg-accent-indigo/20 border border-accent-indigo/40 text-accent-indigo',
          'hover:bg-accent-indigo/30 disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        {submitting
          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Queuing…</>
          : <><Play className="w-3.5 h-3.5" />
              {mode === 'fix' && 'Queue fix'}
              {mode === 'daily_run' && 'Queue daily run'}
              {mode === 'backfill' && 'Queue backfill'}
            </>}
      </button>

      {err && (
        <div className="flex items-start gap-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded p-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{err}</span>
        </div>
      )}
      {okMsg && (
        <div className="flex items-start gap-2 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded p-2">
          <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{okMsg}</span>
        </div>
      )}

      {sched && (
        <div className="text-[10px] text-muted pt-2 border-t border-kd-border/30 space-y-0.5">
          <div>
            Scheduler: <span className={sched.active ? 'text-emerald-400' : 'text-rose-400'}>
              {sched.active ? 'active' : 'inactive'}
            </span>
          </div>
          <div>
            Daily run: <span className="mono">{sched.daily_run?.next ?? '—'}</span>
            {' · '}{sched.daily_run?.trigger}
          </div>
          <div>
            Gap sweep: <span className="mono">{sched.gap_sweep?.next ?? '—'}</span>
            {' · '}{sched.gap_sweep?.trigger}
          </div>
        </div>
      )}
    </div>
  );
}

function ModeTab({ active, onClick, label }: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 px-2 py-1.5 rounded text-[11px] transition-colors',
        active ? 'bg-accent-indigo/25 text-accent-indigo' : 'text-muted hover:text-secondary',
      )}
    >
      {label}
    </button>
  );
}
