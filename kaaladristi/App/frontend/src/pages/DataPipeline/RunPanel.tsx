import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Play, AlertTriangle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  enqueueFix,
  enqueueDailyRun,
  fetchDimensions,
  fetchSchedulerInfo,
} from '@/services/pipeline2';
import type { CellSelection } from './index';

interface Props {
  selection: CellSelection | null;
  onEnqueued: () => void;
}

type Mode = 'fix' | 'daily_run';

function todayIso(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export default function RunPanel({ selection, onEnqueued }: Props) {
  const [mode, setMode] = useState<Mode>('fix');
  const [dimension, setDimension] = useState<string>('');
  const [tradeDate, setTradeDate] = useState<string>(todayIso());
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

  // Default-pick first dimension once list loads.
  useEffect(() => {
    if (!dimension && dims && dims.dimensions.length > 0) {
      setDimension(dims.dimensions[0].key);
    }
  }, [dims, dimension]);

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
      } else {
        const result = await enqueueDailyRun({ trade_date: tradeDate, force });
        setOkMsg(`Queued daily_run job #${result.job_id}`);
      }
      onEnqueued();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 p-3 bg-kd-surface/30 rounded-lg border border-kd-border/30">
      {/* Mode toggle */}
      <div className="flex gap-1 bg-kd-bg/60 rounded-md p-0.5 text-xs">
        <ModeTab active={mode === 'fix'}       onClick={() => setMode('fix')}       label="Fix one dimension" />
        <ModeTab active={mode === 'daily_run'} onClick={() => setMode('daily_run')} label="Daily run" />
      </div>

      {/* Dimension (fix only) */}
      {mode === 'fix' && (
        <label className="block">
          <span className="text-[11px] text-muted">Dimension</span>
          <select
            value={dimension}
            onChange={e => setDimension(e.target.value)}
            className="w-full mt-0.5 px-2 py-1.5 text-xs bg-kd-bg rounded border border-kd-border/50 text-secondary"
          >
            {dims?.dimensions.map(d => (
              <option key={d.key} value={d.key}>{d.label}</option>
            ))}
          </select>
        </label>
      )}

      {/* Trade date */}
      <label className="block">
        <span className="text-[11px] text-muted">Trade date</span>
        <input
          type="date"
          value={tradeDate}
          onChange={e => setTradeDate(e.target.value)}
          className="w-full mt-0.5 px-2 py-1.5 text-xs bg-kd-bg rounded border border-kd-border/50 text-secondary mono"
        />
      </label>

      {/* Exchange (fix only, editable) */}
      {mode === 'fix' && (
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
        disabled={submitting || !tradeDate || (mode === 'fix' && !dimension)}
        className={cn(
          'w-full flex items-center justify-center gap-2 py-2 rounded text-sm font-medium transition-all',
          'bg-accent-indigo/20 border border-accent-indigo/40 text-accent-indigo',
          'hover:bg-accent-indigo/30 disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        {submitting
          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Queuing…</>
          : <><Play className="w-3.5 h-3.5" /> Queue {mode === 'fix' ? 'fix' : 'daily run'}</>}
      </button>

      {/* Messages */}
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

      {/* Scheduler hint */}
      {sched && (
        <div className="text-[10px] text-muted pt-2 border-t border-kd-border/30">
          Scheduler: <span className={sched.active ? 'text-emerald-400' : 'text-rose-400'}>
            {sched.active ? 'active' : 'inactive'}
          </span>
          {' · '}next: <span className="mono">{sched.next_run ?? '—'}</span>
          {' · '}{sched.trigger}
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
