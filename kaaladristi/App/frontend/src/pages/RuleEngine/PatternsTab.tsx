/**
 * PatternsTab — Astro Pattern Engine results on /rules/:id (Phase 3)
 * ===================================================================
 * POA: docs/POA/POA-astro-pattern-engine.md
 * Reads km_rule_patterns (written by pattern_study.py) for one rule and
 * renders, per selected benchmark:
 *
 *   - Level-break card: window high/low break base rates + forward returns,
 *     read against the benchmark's unconditional drift. Clean-subset stats
 *     lead when they have enough occurrences.
 *   - Sequence line: who-moves-first statement.
 *   - Reaction curves: small-multiple sparklines per indicator (D-10..D+15).
 *   - Context splits: Jupiter/Saturn/Mars/Mercury conditioning.
 *   - Peer overlaps: same-band co-occurring rules.
 *
 * Display gates (POA, applied here — the engine stores everything):
 *   n >= 20 publish normally · 10-19 greyed "insufficient occurrences"
 *   · < 10 never listed. No silent caps: gated entries say why.
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { from } from '@/services/postgrest';
import { cn } from '@/lib/utils';
import RuleInferencePanel from './RuleInferencePanel';

// ── Types (results JSONB shapes from pattern_study.py) ──────────────────────

interface BreakSide {
  n: number; pct: number;
  median_sessions_to_break?: number;
  avg_fwd_5d?: number | null; avg_fwd_10d?: number | null; avg_fwd_22d?: number | null;
}
interface BreakStats {
  n: number;
  high_first?: BreakSide; low_first?: BreakSide; no_break?: BreakSide;
}
interface ProfileField { mean_delta: (number | null)[]; n: number[]; t: (number | null)[] }
interface ProfileStats { n: number; offsets: number[]; fields: Record<string, ProfileField> }
interface SequenceMove { field: string; first_move: number; direction: 'up' | 'down' }

interface PatternRow {
  benchmark_index_id: number;
  pattern_type: 'level_break' | 'reaction_profile' | 'sequence';
  anchor: string;
  band: string;
  results: {
    overall?: BreakStats | ProfileStats | { sequence: SequenceMove[]; note?: string } | null;
    clean?: (BreakStats & ProfileStats & { sequence?: SequenceMove[] }) | { n: number } | null;
    peers?: { with: string; n: number; stats: BreakStats | null }[];
    context_splits?: Record<string, Record<string, BreakStats | { n: number }>>;
    benchmark_baseline?: Record<string, number | null>;
    tactical_density?: { avg_events_inside: number };
  };
  n_windows: number;
  n_clean: number;
  computed_at: string;
}

interface IndexMeta { id: number; name: string; category: string | null }

const FIELD_LABELS: Record<string, string> = {
  ret_1d: '1d Return', rsi_14: 'RSI', rvol: 'RVOL',
  sniper_inst: 'Smart Money', sniper_hot: 'Fast Money',
  rss_value: 'RSS', magic_rs: 'Magic RS',
};

// ── Fetch ────────────────────────────────────────────────────────────────────

async function fetchPatterns(ruleId: number): Promise<PatternRow[]> {
  const { data, error } = await from('km_rule_patterns')
    .select('benchmark_index_id,pattern_type,anchor,band,results,n_windows,n_clean,computed_at')
    .eq('rule_id', ruleId)
    .gte('n_windows', 10)   // POA gate: <10 never displayed
    .execute();
  if (error) throw new Error(error.message);
  return (data as PatternRow[]) ?? [];
}

async function fetchIndexNames(): Promise<IndexMeta[]> {
  const { data, error } = await from('km_index_symbols')
    .select('id,name,category')
    .execute();
  if (error) throw new Error(error.message);
  return (data as IndexMeta[]) ?? [];
}

// ── Small pieces ─────────────────────────────────────────────────────────────

function fmtPct(v: number | null | undefined, sign = false): string {
  if (v == null) return '—';
  const s = sign && v > 0 ? '+' : '';
  return `${s}${v.toFixed(2)}%`;
}

function retColor(v: number | null | undefined): string {
  if (v == null) return 'text-muted';
  return v > 0 ? 'text-risk-green' : v < 0 ? 'text-risk-red/80' : 'text-muted';
}

/** Sparkline for one indicator's mean-delta curve. Zero line + D0 marker. */
function Spark({ field, offsets }: { field: ProfileField; offsets: number[] }) {
  const W = 180, H = 48, PAD = 4;
  const vals = field.mean_delta;
  const nums = vals.filter((v): v is number => v != null);
  if (nums.length < 3) return null;
  const lo = Math.min(...nums, 0), hi = Math.max(...nums, 0);
  const range = hi - lo || 1;
  const x = (i: number) => PAD + (i / (vals.length - 1)) * (W - 2 * PAD);
  const y = (v: number) => PAD + (1 - (v - lo) / range) * (H - 2 * PAD);
  const d = vals.map((v, i) => v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .filter(Boolean);
  const zeroIdx = offsets.indexOf(0);
  return (
    <svg width={W} height={H} className="block">
      <line x1={PAD} x2={W - PAD} y1={y(0)} y2={y(0)} stroke="var(--kd-border)" strokeWidth={1} />
      {zeroIdx >= 0 && (
        <line x1={x(zeroIdx)} x2={x(zeroIdx)} y1={PAD} y2={H - PAD}
          stroke="var(--accent-gold)" strokeWidth={1} strokeDasharray="2 3" opacity={0.7} />
      )}
      <polyline points={d.join(' ')} fill="none" stroke="var(--accent-indigo)" strokeWidth={1.5} />
    </svg>
  );
}

function BreakRow({ label, side, baseline, color }: {
  label: string; side?: BreakSide; baseline?: Record<string, number | null>; color: string;
}) {
  if (!side) return null;
  return (
    <tr className="border-b border-kd-border/40">
      <td className={cn('px-3 py-2 text-xs font-mono', color)}>{label}</td>
      <td className="px-3 py-2 text-xs tabular-nums text-center text-white">{side.pct?.toFixed(0)}%</td>
      <td className="px-3 py-2 text-xs tabular-nums text-center text-muted">{side.n}</td>
      <td className="px-3 py-2 text-xs tabular-nums text-center text-muted">
        {side.median_sessions_to_break != null ? `${side.median_sessions_to_break}s` : '—'}
      </td>
      {(['avg_fwd_5d', 'avg_fwd_10d', 'avg_fwd_22d'] as const).map((k, i) => {
        const bl = baseline?.[`avg_${[5, 10, 22][i]}d`];
        return (
          <td key={k} className={cn('px-3 py-2 text-xs tabular-nums text-center', retColor(side[k]))}>
            {fmtPct(side[k], true)}
            {side[k] != null && bl != null && (
              <span className="text-[9px] text-muted ml-1">vs {fmtPct(bl, true)}</span>
            )}
          </td>
        );
      })}
    </tr>
  );
}

function LevelBreakCard({ row }: { row: PatternRow }) {
  const overall = row.results.overall as BreakStats | null;
  const clean = row.results.clean as BreakStats | null;
  const baseline = row.results.benchmark_baseline;
  const cleanUsable = clean && 'high_first' in (clean as object) && (clean.n ?? 0) >= 10;
  const headline = cleanUsable ? clean! : overall;
  if (!headline) return null;

  return (
    <div className="rounded-xl border border-kd-border bg-kd-card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-kd-border/60 flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-mono uppercase tracking-wider text-accent-gold">
          Level Break — window high/low
        </span>
        <span className="text-[10px] font-mono text-muted">
          anchor: {row.anchor === 'window_end' ? 'window end' : 'window start'} · scan 30 sessions
        </span>
        <span className="ml-auto text-[10px] font-mono text-muted">
          {cleanUsable
            ? `clean occurrences (no same-band overlap) · n=${headline.n}`
            : `all occurrences · n=${headline.n}${clean && (clean.n ?? 0) > 0 ? ` (clean n=${clean.n} — insufficient)` : ''}`}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-kd-border bg-kd-elevated/60">
              {['Outcome', 'Share', 'n', 'Median break', 'Fwd 5d', 'Fwd 10d', 'Fwd 22d'].map(h => (
                <th key={h} className="text-left text-[10px] font-mono text-muted px-3 py-2 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <BreakRow label="High broken first" side={headline.high_first} baseline={baseline} color="text-risk-green" />
            <BreakRow label="Low broken first" side={headline.low_first} baseline={baseline} color="text-risk-red/80" />
            <BreakRow label="No break in 30s" side={headline.no_break} baseline={baseline} color="text-muted" />
          </tbody>
        </table>
      </div>
      {cleanUsable && overall && (
        <div className="px-4 py-2 text-[10px] font-mono text-muted border-t border-kd-border/40">
          All occurrences (n={overall.n}): high first {overall.high_first?.pct?.toFixed(0)}%
          {' · '}low first {overall.low_first?.pct?.toFixed(0)}%
          {' · '}fwd 10d after high-break {fmtPct(overall.high_first?.avg_fwd_10d, true)}
        </div>
      )}
    </div>
  );
}

/** How many benchmarks show the same field moving the same direction within
 *  ±2 offsets. Phase 4 calibration finding: per-series |t| thresholds fire at
 *  noise-consistent rates (16.6% of 7,584 series at t=2.0 ≈ the multiple-
 *  comparison expectation), so a single-benchmark sequence proves nothing —
 *  REPLICATION across benchmarks is the discriminator. */
function replicationCount(move: SequenceMove, allSeqRows: PatternRow[]): number {
  let count = 0;
  for (const r of allSeqRows) {
    const seqs = [
      ...(((r.results.overall as { sequence?: SequenceMove[] } | null)?.sequence) ?? []),
      ...(((r.results.clean as { sequence?: SequenceMove[] } | null)?.sequence) ?? []),
    ];
    if (seqs.some(m => m.field === move.field && m.direction === move.direction
        && Math.abs(m.first_move - move.first_move) <= 2)) {
      count += 1;
    }
  }
  return count;
}

const REPLICATION_MIN = 5;   // benchmarks agreeing before a move reads as real

function SequenceCard({ row, allSeqRows }: { row: PatternRow; allSeqRows: PatternRow[] }) {
  const clean = row.results.clean as { sequence?: SequenceMove[] } | null;
  const overall = row.results.overall as { sequence: SequenceMove[]; note?: string } | null;
  const seq = (clean?.sequence?.length ? clean.sequence : overall?.sequence) ?? [];
  const fromClean = !!clean?.sequence?.length;
  return (
    <div className="rounded-xl border border-kd-border bg-kd-card px-4 py-3">
      <div className="text-[11px] font-mono uppercase tracking-wider text-accent-gold mb-1.5">
        Sequence — who moves first
      </div>
      {seq.length === 0 ? (
        <p className="text-xs text-muted italic">
          {overall?.note ?? 'No stable sequence at the significance threshold.'}
        </p>
      ) : (
        <>
          <p className="text-[13px] leading-relaxed">
            {seq.map((m, i) => {
              const reps = replicationCount(m, allSeqRows);
              const replicated = reps >= REPLICATION_MIN;
              return (
                <span key={m.field} className={replicated ? '' : 'opacity-50'}>
                  {i > 0 && <span className="text-muted"> → </span>}
                  <span className="text-white">{FIELD_LABELS[m.field] ?? m.field}</span>
                  <span className={m.direction === 'up' ? 'text-risk-green' : 'text-risk-red/80'}>
                    {' '}{m.direction === 'up' ? '↑' : '↓'}
                  </span>
                  <span className="text-muted font-mono text-[11px]"> D{m.first_move >= 0 ? '+' : ''}{m.first_move}</span>
                  <span className={cn('font-mono text-[10px] ml-1',
                    replicated ? 'text-risk-green/80' : 'text-muted')}>
                    {replicated ? `· ${reps} benchmarks agree` : `· unreplicated (${reps})`}
                  </span>
                </span>
              );
            })}
            {fromClean && <span className="text-[10px] font-mono text-muted ml-2">(clean subset)</span>}
          </p>
          <p className="text-[10px] text-muted mt-1.5 leading-relaxed">
            Single-benchmark sequences fire at noise-consistent rates — only moves the same
            direction on ≥{REPLICATION_MIN} benchmarks (±2 sessions) read as signatures; the
            rest are shown faded.
          </p>
        </>
      )}
    </div>
  );
}

function ProfileCard({ row }: { row: PatternRow }) {
  const overall = row.results.overall as ProfileStats | null;
  if (!overall?.fields) return null;
  return (
    <div className="rounded-xl border border-kd-border bg-kd-card px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] font-mono uppercase tracking-wider text-accent-gold">
          Reaction profile
        </span>
        <span className="text-[10px] font-mono text-muted">
          D−10 … D+15 around anchor · deviation vs own D−10…D−4 baseline · n={overall.n}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {Object.entries(overall.fields).map(([f, data]) => (
          <div key={f} className="rounded-lg bg-kd-elevated/40 border border-kd-border/50 p-2">
            <div className="text-[10px] font-mono text-secondary mb-1">{FIELD_LABELS[f] ?? f}</div>
            <Spark field={data} offsets={overall.offsets} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ContextCard({ row }: { row: PatternRow }) {
  const splits = row.results.context_splits;
  if (!splits || Object.keys(splits).length === 0) return null;
  const CONTEXT_LABELS: Record<string, string> = {
    jupiter_motion: 'Jupiter motion', saturn_motion: 'Saturn motion',
    mars_motion: 'Mars motion', mercury_motion: 'Mercury motion',
    jupiter_sign: 'Jupiter sign', saturn_sign: 'Saturn sign',
  };
  return (
    <div className="rounded-xl border border-kd-border bg-kd-card px-4 py-3">
      <div className="text-[11px] font-mono uppercase tracking-wider text-accent-gold mb-2">
        Context conditioning — same pattern under different regimes
      </div>
      <div className="space-y-2.5">
        {Object.entries(splits).map(([key, groups]) => {
          const entries = Object.entries(groups)
            .filter(([, st]) => (st as BreakStats).n >= 10)
            .sort(([, a], [, b]) => ((b as BreakStats).n ?? 0) - ((a as BreakStats).n ?? 0));
          if (entries.length < 2) return null;
          return (
            <div key={key}>
              <div className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1">
                {CONTEXT_LABELS[key] ?? key}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {entries.map(([val, st]) => {
                  const bs = st as BreakStats;
                  const greyed = (bs.n ?? 0) < 20;
                  return (
                    <span key={val} className={cn(
                      'px-2 py-1 rounded-md text-[10px] font-mono border',
                      greyed ? 'text-muted border-kd-border opacity-60' : 'text-secondary border-kd-border',
                    )}>
                      {val}: high-first {bs.high_first?.pct != null ? `${bs.high_first.pct.toFixed(0)}%` : '—'}
                      <span className="text-muted"> · n={bs.n}{greyed ? ' (low n)' : ''}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PeersCard({ row }: { row: PatternRow }) {
  const peers = row.results.peers ?? [];
  if (peers.length === 0) return null;
  return (
    <div className="rounded-xl border border-kd-border bg-kd-card px-4 py-3">
      <div className="text-[11px] font-mono uppercase tracking-wider text-accent-gold mb-1.5">
        Co-occurring events (same band)
      </div>
      <div className="flex flex-wrap gap-1.5">
        {peers.map(p => (
          <span key={p.with} className="px-2 py-1 rounded-md text-[10px] font-mono text-secondary border border-kd-border">
            {p.with} <span className="text-muted">· n={p.n}</span>
            {p.stats?.high_first?.pct != null && (
              <span className="text-muted"> · combo high-first {p.stats.high_first.pct.toFixed(0)}%</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Tab ──────────────────────────────────────────────────────────────────────

export default function PatternsTab({ ruleId, autoOpenInference }: { ruleId: number; autoOpenInference?: boolean }) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['rule-engine', 'patterns', ruleId],
    queryFn: () => fetchPatterns(ruleId),
    enabled: !isNaN(ruleId),
    staleTime: 10 * 60 * 1000,
  });
  const { data: indices = [] } = useQuery({
    queryKey: ['rule-engine', 'index-names'],
    queryFn: fetchIndexNames,
    staleTime: 30 * 60 * 1000,
  });

  const indexById = useMemo(
    () => new Map(indices.map(i => [i.id, i])),
    [indices],
  );

  // Benchmarks having any displayable row, NIFTY 50 first then by n desc
  const benchmarks = useMemo(() => {
    const byBench = new Map<number, number>();
    for (const r of rows) {
      byBench.set(r.benchmark_index_id, Math.max(byBench.get(r.benchmark_index_id) ?? 0, r.n_windows));
    }
    return [...byBench.entries()]
      .map(([id, maxN]) => ({
        id, maxN,
        name: indexById.get(id)?.name ?? `#${id}`,
        curated: indexById.get(id)?.category === 'custom',
      }))
      .sort((a, b) => {
        if (a.name === 'NIFTY 50') return -1;
        if (b.name === 'NIFTY 50') return 1;
        return b.maxN - a.maxN || a.name.localeCompare(b.name);
      });
  }, [rows, indexById]);

  const [benchId, setBenchId] = useState<number | null>(null);
  const effectiveBench = benchId ?? benchmarks[0]?.id ?? null;
  const selected = benchmarks.find(b => b.id === effectiveBench);

  const benchRows = useMemo(
    () => rows.filter(r => r.benchmark_index_id === effectiveBench),
    [rows, effectiveBench],
  );
  const levelBreak = benchRows.find(r => r.pattern_type === 'level_break');
  const profile = benchRows.find(r => r.pattern_type === 'reaction_profile');
  const sequence = benchRows.find(r => r.pattern_type === 'sequence');
  const allSeqRows = useMemo(
    () => rows.filter(r => r.pattern_type === 'sequence'),
    [rows],
  );

  if (isLoading) return <p className="px-4 py-6 text-sm text-muted text-center">Loading patterns…</p>;
  if (rows.length === 0) {
    return (
      <div className="p-3 space-y-3">
        <RuleInferencePanel ruleId={ruleId} autoOpen={autoOpenInference} />
        <p className="px-4 py-6 text-sm text-muted text-center">
          No pattern data for this rule — run the Pattern Study from the Rules Engine page
          (needs ≥10 completed windows inside a benchmark's history). Rare or recurring-every-few-years
          combinations may never reach that threshold — the inference above still shows the expected
          behavior even when the evidence stays thin.
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      <RuleInferencePanel ruleId={ruleId} autoOpen={autoOpenInference} />

      {/* Benchmark selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-mono text-muted uppercase tracking-wider">Benchmark</span>
        <select
          value={effectiveBench ?? ''}
          onChange={e => setBenchId(Number(e.target.value))}
          className="bg-kd-elevated border border-kd-border rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
        >
          {benchmarks.map(b => (
            <option key={b.id} value={b.id}>
              {b.name}{b.curated ? ' · curated' : ''}{b.maxN < 20 ? ' · low n' : ''} ({b.maxN})
            </option>
          ))}
        </select>
        {selected?.curated && (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono text-risk-amber border border-risk-amber/30 bg-risk-amber/10">
            curated basket — reconstructed composite of current constituents
          </span>
        )}
        {selected && selected.maxN < 20 && (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono text-muted border border-kd-border">
            insufficient occurrences (n={selected.maxN}) — read with caution
          </span>
        )}
        {levelBreak && (
          <span className="ml-auto text-[10px] font-mono text-muted">
            band: {levelBreak.band} · computed {levelBreak.computed_at?.slice(0, 10)}
          </span>
        )}
      </div>

      <div className={cn(selected && selected.maxN < 20 && 'opacity-70')}>
        <div className="space-y-3">
          {levelBreak && <LevelBreakCard row={levelBreak} />}
          {sequence && <SequenceCard row={sequence} allSeqRows={allSeqRows} />}
          {profile && <ProfileCard row={profile} />}
          {levelBreak && <ContextCard row={levelBreak} />}
          {levelBreak && <PeersCard row={levelBreak} />}
        </div>
      </div>

      <p className="text-[10px] text-muted leading-relaxed">
        Historical base rates from completed transit windows — observations, not predictions or advice.
        Clean = occurrences with no same-band co-occurring event. Forward returns shown against the
        benchmark's unconditional drift. Stats with n &lt; 20 are greyed; n &lt; 10 is never shown.
      </p>
    </div>
  );
}
