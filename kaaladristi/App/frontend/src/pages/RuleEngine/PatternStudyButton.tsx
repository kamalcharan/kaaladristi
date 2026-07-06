/**
 * PatternStudyButton — manual trigger for the Astro Pattern Engine study
 * =======================================================================
 * Lives in the Rules Engine header (admin page — RuleList is AdminGuard-
 * gated, so no extra gating needed here). Fires POST /api/patterns/run and
 * polls /api/patterns/status while running, mirroring the Run Discovery
 * pattern. The study takes minutes; progress shows benchmarks done.
 */

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const PIPELINE_API = import.meta.env.VITE_PIPELINE_API_URL ?? '';

interface PatternStatus {
  job_id: string | null;
  running: boolean;
  benches_total: number;
  benches_done: number;
  rows_written: number;
  current_bench: string | null;
  error: string | null;
  table: { rows: number; last_computed_at: string | null } | null;
}

export default function PatternStudyButton() {
  const qc = useQueryClient();
  const [tracking, setTracking] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const { data: status } = useQuery({
    queryKey: ['rule-engine', 'pattern-status'],
    queryFn: async (): Promise<PatternStatus> => {
      const res = await fetch(`${PIPELINE_API}/api/patterns/status`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      return res.json();
    },
    refetchInterval: tracking ? 2500 : false,
    staleTime: 0,
    retry: 1,
  });

  // Stop tracking + refresh pattern queries when the job finishes
  useEffect(() => {
    if (!tracking || !status || status.running) return;
    setTracking(false);
    qc.invalidateQueries({ queryKey: ['rule-engine', 'patterns'] });
  }, [tracking, status, qc]);

  const running = status?.running ?? false;

  const start = async () => {
    setStartError(null);
    try {
      const res = await fetch(`${PIPELINE_API}/api/patterns/run`, { method: 'POST' });
      if (res.status === 409) { setTracking(true); return; }
      if (!res.ok) throw new Error(`start failed: ${res.status}`);
      setTracking(true);
    } catch (exc) {
      setStartError(exc instanceof Error ? exc.message : 'failed');
    }
  };

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <button
        onClick={start}
        disabled={running}
        title="Recompute km_rule_patterns for all rules × all benchmarks (runs in background, takes minutes)"
        className={cn(
          'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border transition-all',
          running
            ? 'text-risk-amber border-risk-amber/40 bg-risk-amber/10 cursor-wait'
            : 'text-accent-gold border-accent-gold/40 bg-accent-gold/10 hover:bg-accent-gold/20',
        )}
      >
        {running
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <Activity className="w-4 h-4" />}
        {running
          ? `Pattern Study… ${status?.benches_done ?? 0}/${status?.benches_total || '?'}`
          : 'Run Pattern Study'}
      </button>
      {running && status?.current_bench && (
        <span className="text-[10px] font-mono text-muted">{status.current_bench}</span>
      )}
      {!running && (startError ?? status?.error) && (
        <span className="text-[10px] font-mono text-risk-red/80">
          {startError ?? status?.error}
        </span>
      )}
      {!running && !startError && !status?.error && status?.table?.last_computed_at && (
        <span className="text-[10px] font-mono text-muted">
          {status.table.rows.toLocaleString()} rows · last {status.table.last_computed_at.slice(0, 10)}
        </span>
      )}
    </div>
  );
}
