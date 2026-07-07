import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Loader2, AlertCircle, Copy, Trash2, Lock, Play, WifiOff, X, Eraser, Sparkles } from 'lucide-react';
import { from } from '@/services/postgrest';
import { useAuthStore } from '@/stores/authStore';
import { fmtDate } from '@/lib/dateUtils';
import { useToast, ToastContainer } from '@/components/ui';
import { useBackendStatus } from '@/hooks';
import { cn } from '@/lib/utils';
import RuleFormModal, { ruleToForm, formToInput, type FormMode } from './RuleFormModal';
import AlmanacTab from './AlmanacTab';
import PatternsTab from './PatternsTab';
import RuleInferenceModal from './RuleInferenceModal';
import { updateRule, softDeleteRule, createRule, type AstroRuleFull } from './ruleService';
import { runRuleDiscovery, fetchDiscoveryStatus, cancelDiscovery, dropRuleSignals } from './discoveryService';

// ── Types ────────────────────────────────────────────────────────────────────

interface RuleConfidence {
  rule_id: number;
  total_occurrences: number | null;
  matched_count: number | null;
  confidence_score: number | null;
  avg_return_all: number | null;
  avg_return_matched: number | null;
  avg_return_unmatched: number | null;
  best_return: number | null;
  worst_return: number | null;
  avg_duration_days: number | null;
  historical_transits: number | null;
  last_computed_at: string | null;
  /** Which hypothesis the numbers were tested against (migration 138). */
  hypothesis_source: 'inference' | 'base_bias' | null;
  hypothesis_impact: string | null;
}

interface RuleTransit {
  id: number;
  start_date: string;
  end_date: string;
  duration_days: number;
  nifty_return_pct: number | null;
  matched: boolean | null;
}

interface RuleConfidenceYearly {
  year: number;
  transits: number;
  matched: number;
  win_pct: number | null;
  avg_return: number | null;
  avg_duration: number | null;
}

interface RuleSignal {
  id: number;
  date: string;
  signal: string | null;
  strength: number | null;
  details: string | null;
  matched: boolean | null;
  actual_market_return: number | null;
  partial_day: boolean | null;
}

const DAILY_ONLY_TYPES = new Set(['nakshatra_vara', 'tithi_alone', 'eclipse']);

function signalToTransit(s: RuleSignal): RuleTransit {
  return {
    id: s.id,
    start_date: s.date,
    end_date: s.date,
    duration_days: 1,
    nifty_return_pct: s.actual_market_return,
    matched: s.matched,
  };
}

// ── Constants ────────────────────────────────────────────────────────────────

const OUTCOME_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  bullish:  { bg: 'bg-risk-green/15',    text: 'text-risk-green',    border: 'border-risk-green/30'    },
  bearish:  { bg: 'bg-risk-red/15',      text: 'text-risk-red',      border: 'border-risk-red/30'      },
  volatile: { bg: 'bg-risk-amber/15',    text: 'text-risk-amber',    border: 'border-risk-amber/30'    },
  turning:  { bg: 'bg-accent-indigo/12', text: 'text-accent-indigo', border: 'border-accent-indigo/30' },
  neutral:  { bg: 'bg-kd-elevated',      text: 'text-secondary',     border: 'border-kd-border'        },
};

const RULE_TYPE_LABELS: Record<string, string> = {
  nakshatra_vara:       'Nakshatra · Vara',
  planet_transit:       'Planet Transit',
  planet_state:         'Planet State',
  planet_conjunction:   'Conjunction',
  planet_manifestation: 'Manifestation',
  compound:             'Compound',
  tithi_alone:          'Tithi',
  eclipse:              'Eclipse',
  vedh:                 'Vedh',
  moon_position:        'Moon Position',
  tithi_vara:           'Tithi · Vara',
  tithi_nakshatra:      'Tithi · Nakshatra',
  planet_speed:         'Planet Speed',
};

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchRule(id: number): Promise<AstroRuleFull> {
  const { data, error } = await from('km_astro_rule_master')
    .select('*')
    .eq('id', id)
    .single()
    .execute();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Rule not found');
  return data as unknown as AstroRuleFull;
}

async function fetchRuleConfidence(ruleId: number): Promise<RuleConfidence | null> {
  const { data, error } = await from('km_rule_confidence')
    .select([
      'rule_id', 'total_occurrences', 'matched_count', 'confidence_score',
      'avg_return_all', 'avg_return_matched', 'avg_return_unmatched',
      'best_return', 'worst_return', 'avg_duration_days', 'historical_transits',
      'last_computed_at', 'hypothesis_source', 'hypothesis_impact',
    ].join(','))
    .eq('rule_id', ruleId)
    .maybeSingle()
    .execute();
  if (error) throw new Error(error.message);
  return (data as unknown as RuleConfidence) ?? null;
}

const PAGE_SIZE = 20;

interface SignalsPage {
  rows: RuleSignal[];
  total: number;
}

async function fetchRuleSignals(ruleId: number, page: number): Promise<SignalsPage> {
  const today = new Date().toISOString().split('T')[0];
  const offset = page * PAGE_SIZE;
  const { data, error, count } = await from('km_rule_signals')
    .select('id,date,signal,strength,details,matched,actual_market_return,partial_day')
    .eq('rule_id', ruleId)
    .lte('date', today)
    .order('date', { ascending: false })
    .withCount()
    .range(offset, offset + PAGE_SIZE - 1)
    .execute();
  if (error) throw new Error(error.message);
  return { rows: (data as RuleSignal[]) ?? [], total: count ?? 0 };
}

async function fetchSignalReturns(ruleId: number): Promise<RuleTransit[]> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await from('km_rule_signals')
    .select('id,date,matched,actual_market_return,partial_day')
    .eq('rule_id', ruleId)
    .lte('date', today)
    .notNull('actual_market_return')
    .order('date', { ascending: false })
    .limit(300)
    .execute();
  if (error) throw new Error(error.message);
  return ((data as RuleSignal[]) ?? []).map(signalToTransit);
}

async function fetchUpcomingSignals(ruleId: number): Promise<RuleSignal[]> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await from('km_rule_signals')
    .select('id,date,signal,strength,details,matched')
    .eq('rule_id', ruleId)
    .gt('date', today)
    .order('date', { ascending: true })
    .limit(5)
    .execute();
  if (error) throw new Error(error.message);
  return (data as RuleSignal[]) ?? [];
}

async function fetchRuleTransits(ruleId: number): Promise<RuleTransit[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await from('km_rule_transits')
    .select('id,start_date,end_date,duration_days,nifty_return_pct,matched')
    .eq('rule_id', ruleId)
    .lte('start_date', today)   // include ongoing transits (end_date may be in future)
    .order('start_date', { ascending: false })
    .limit(100)
    .execute();
  if (error) throw new Error(error.message);
  return (data as RuleTransit[]) ?? [];
}

async function fetchUpcomingTransits(ruleId: number): Promise<RuleTransit[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await from('km_rule_transits')
    .select('id,start_date,end_date,duration_days,nifty_return_pct,matched')
    .eq('rule_id', ruleId)
    .gt('start_date', today)
    .order('start_date', { ascending: true })
    .limit(3)
    .execute();
  if (error) throw new Error(error.message);
  return (data as RuleTransit[]) ?? [];
}

const PIPELINE_API = import.meta.env.VITE_PIPELINE_API_URL ?? '';

async function fetchYearlyConfidence(ruleId: number): Promise<RuleConfidenceYearly[]> {
  const res = await fetch(`${PIPELINE_API}/api/confidence/yearly/${ruleId}`);
  if (!res.ok) throw new Error(`Yearly confidence fetch failed: ${res.status}`);
  return res.json();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function effectiveOutcome(rule: AstroRuleFull): string {
  return rule.outcome || rule.base_bias || 'neutral';
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const s = OUTCOME_STYLES[outcome] ?? OUTCOME_STYLES.neutral;
  return (
    <span className={cn('inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border', s.bg, s.text, s.border)}>
      {outcome.charAt(0).toUpperCase() + outcome.slice(1)}
    </span>
  );
}

function ScopeChips({ scope }: { scope: string[] | null }) {
  if (!scope || scope.length === 0) return <span className="text-muted text-xs">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {scope.map(s => {
        const label = s.startsWith('sector:')
          ? `${s.slice(7)} Sectors`
          : s.charAt(0).toUpperCase() + s.slice(1);
        return (
          <span key={s} className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] border border-kd-border bg-kd-elevated text-secondary font-mono">
            {label}
          </span>
        );
      })}
    </div>
  );
}

function ConditionsBlock({ conditions }: { conditions: Record<string, unknown> | null }) {
  if (!conditions || Object.keys(conditions).length === 0) {
    return <p className="text-muted text-xs italic">No structured conditions</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
      {Object.entries(conditions).map(([k, v]) => (
        <div key={k} className="flex flex-col gap-0.5">
          <span className="text-[10px] font-mono text-muted uppercase tracking-wider">{k}</span>
          <span className="text-xs text-secondary break-words">
            {Array.isArray(v) ? v.join(', ') : String(v)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function confidenceColor(score: number | null): string {
  if (score == null) return 'text-muted';
  if (score >= 70) return 'text-risk-green';
  if (score >= 60) return 'text-risk-amber';
  if (score >= 50) return 'text-yellow-400';
  return 'text-risk-red/70';
}

function returnColor(v: number | null): string {
  if (v == null) return 'text-muted';
  return v >= 0 ? 'text-risk-green' : 'text-risk-red/80';
}

function fmtPct(v: number | null, decimals = 1): string {
  if (v == null) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(decimals)}%`;
}

function regimeOf(ret: number | null): 'bull' | 'side' | 'bear' {
  if (ret == null) return 'side';
  if (ret > 1.5) return 'bull';
  if (ret < -1.5) return 'bear';
  return 'side';
}

// ── Per-Transit Bar Chart ─────────────────────────────────────────────────────

function PerTransitBarChart({ transits, highlightId, onHighlight }: {
  transits: RuleTransit[];
  highlightId: number | null;
  onHighlight: (id: number | null) => void;
}) {
  const W = 1100, H = 320;
  const PAD = { l: 52, r: 114, t: 30, b: 58 };

  const sorted = useMemo(() =>
    [...transits]
      .filter(t => t.nifty_return_pct != null)
      .sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [transits]
  );

  const avgDuration = useMemo(() => {
    if (sorted.length === 0) return 0;
    return Math.round(sorted.reduce((s, t) => s + (t.duration_days ?? 0), 0) / sorted.length);
  }, [sorted]);

  if (sorted.length < 1) return null;

  const n = sorted.length;
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;
  const chartBotY = PAD.t + chartH;
  const baseline  = PAD.t + chartH / 2;

  const returns = sorted.map(t => t.nifty_return_pct ?? 0);
  const maxAbs     = Math.max(...returns.map(Math.abs), 1);
  const paddedMax  = maxAbs * 1.18;
  const avgReturn  = returns.reduce((s, v) => s + v, 0) / n;
  const medianReturn = (() => {
    const s = [...returns].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
  })();

  const slotW = chartW / n;
  const barW  = Math.max(3, Math.min(slotW * 0.62, 18));

  const yForRet  = (ret: number) => baseline - (ret / paddedMax) * (chartH / 2);
  const xForIdx  = (i: number)   => PAD.l + (i + 0.5) * slotW;
  const avgLineY = yForRet(avgReturn);

  // Y-axis ticks
  const tickStep = paddedMax > 20 ? 10 : paddedMax > 9 ? 5 : 2;
  const ticks: number[] = [];
  for (let v = -Math.ceil(paddedMax / tickStep) * tickStep; v <= paddedMax; v += tickStep) ticks.push(v);

  // Year labels — first bar of each year
  const yearMarks: Array<{ year: number; x: number }> = [];
  let prevYear = -1;
  sorted.forEach((t, i) => {
    const yr = parseInt(t.start_date.slice(0, 4));
    if (yr !== prevYear) { yearMarks.push({ year: yr, x: xForIdx(i) }); prevYear = yr; }
  });

  const startYear   = parseInt(sorted[0].start_date.slice(0, 4));
  const endYear     = parseInt(sorted[n - 1].start_date.slice(0, 4));
  const windowYears = endYear - startYear;
  const today       = new Date().toISOString().slice(0, 10);
  const windowLabel = windowYears > 0 ? `${windowYears}Y window` : sorted[0].start_date.slice(0, 7);

  return (
    <div className="rounded-xl border border-kd-border bg-kd-card overflow-hidden">
      <div className="px-5 pt-4 pb-2">
        <p className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1.5">
          Per-Transit Performance · {n} event{n !== 1 ? 's' : ''} · {windowLabel} · as of {today}
        </p>
        <p className="font-display text-xl text-white leading-snug">
          Each bar is{' '}
          <em className="not-italic text-accent-gold font-medium">one transit</em>
          {' '}— the rule fires{avgDuration > 0 ? `, runs for ~${avgDuration}d,` : ''} and ends. Between events, nothing is held.
          {n < 5 && <span className="text-[11px] font-sans font-normal text-muted ml-2">({n} event{n !== 1 ? 's' : ''} — more history accumulates over time)</span>}
        </p>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: H, display: 'block' }}>
        {/* Grid lines */}
        {ticks.map(v => {
          const y = yForRet(v);
          if (y < PAD.t || y > chartBotY) return null;
          return (
            <g key={v}>
              <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y}
                stroke={v === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.04)'}
                strokeWidth={v === 0 ? 0.9 : 0.5}
                strokeDasharray={v === 0 ? undefined : '3 6'}
              />
              <text x={PAD.l - 5} y={y + 3.5}
                fill="rgba(148,163,184,0.45)" fontFamily="monospace" fontSize="8.5" textAnchor="end">
                {v > 0 ? `+${v}%` : `${v}%`}
              </text>
            </g>
          );
        })}

        {/* Bars + match dots */}
        {sorted.map((t, i) => {
          const ret   = t.nifty_return_pct ?? 0;
          const x     = xForIdx(i);
          const isPos = ret >= 0;
          const barTop = isPos ? yForRet(ret) : baseline;
          const barH   = Math.max(1.5, Math.abs(yForRet(ret) - baseline));
          const isHl  = highlightId === t.id;
          const dim   = highlightId != null && !isHl;

          return (
            <g key={t.id} style={{ cursor: 'pointer' }} onClick={() => onHighlight(isHl ? null : t.id)}>
              {isHl && (
                <line x1={x} y1={PAD.t} x2={x} y2={chartBotY}
                  stroke="var(--gold)" strokeWidth="0.7" strokeDasharray="2 3" opacity="0.55"/>
              )}
              {/* Bar: filled green for positive, hollow red for negative */}
              <rect
                x={x - barW / 2} y={barTop} width={barW} height={barH}
                fill={isPos ? 'var(--bull)' : 'none'}
                stroke={isPos ? 'none' : 'var(--bear)'}
                strokeWidth={isPos ? 0 : 1.2}
                opacity={dim ? 0.15 : isHl ? 1 : 0.82}
              />
              {/* Match dot at zero baseline */}
              <circle cx={x} cy={ret >= 0 ? baseline + 8 : baseline - 8} r={2.2}
                fill={
                  t.matched === true  ? 'var(--bull)' :
                  t.matched === false ? 'var(--bear)' :
                  'rgba(255,255,255,0.12)'
                }
                opacity={dim ? 0.18 : 0.9}
              />
            </g>
          );
        })}

        {/* Avg return dashed line + label */}
        {avgLineY > PAD.t && avgLineY < chartBotY && (
          <>
            <line x1={PAD.l} y1={avgLineY} x2={W - PAD.r} y2={avgLineY}
              stroke="var(--gold)" strokeWidth="1.2" strokeDasharray="5 4" opacity="0.75"/>
            <text x={W - PAD.r + 7} y={avgLineY + 4}
              fill="var(--gold)" fontFamily="monospace" fontSize="9" letterSpacing="0.5">
              {`AVG ${avgReturn >= 0 ? '+' : ''}${avgReturn.toFixed(1)}%`}
            </text>
          </>
        )}

        {/* Year labels */}
        {yearMarks.map(({ year, x }) => (
          <text key={year} x={x} y={H - 8}
            fill="rgba(148,163,184,0.38)" fontFamily="monospace" fontSize="9" textAnchor="middle">
            {year}
          </text>
        ))}
      </svg>

      {/* Reading guide */}
      <div className="px-4 py-2.5 border-t border-kd-border/30 flex items-center gap-5 flex-wrap">
        <span className="flex items-center gap-1.5 text-[10px] font-mono text-muted">
          <span className="w-2.5 h-2.5 bg-risk-green shrink-0 opacity-80"/>
          Positive return
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-mono text-muted">
          <span className="w-2.5 h-2.5 border border-risk-red shrink-0"/>
          Negative return
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-mono text-muted">
          <span className="w-2 h-2 rounded-full bg-risk-green shrink-0"/>
          Matched ·
          <span className="w-2 h-2 rounded-full bg-risk-red shrink-0 mx-1"/>
          Unmatched (dot at baseline)
        </span>
        <span className="text-[10px] font-mono text-accent-gold">
          {`— AVG ${avgReturn >= 0 ? '+' : ''}${avgReturn.toFixed(1)}%`}
        </span>
        <span className="text-[10px] font-mono text-accent-indigo/80">
          {`MED ${medianReturn >= 0 ? '+' : ''}${medianReturn.toFixed(1)}%`}
        </span>
        <span className="text-[10px] font-mono text-muted ml-auto">click bar to highlight row</span>
      </div>
    </div>
  );
}

// ── Stat Grid ─────────────────────────────────────────────────────────────────

function BacktestStatGrid({ conf, transits, isDaily = false }: {
  conf: RuleConfidence; transits: RuleTransit[]; isDaily?: boolean;
}) {
  const occ = isDaily ? 'signals' : 'transits';
  const n = conf.total_occurrences ?? 0;
  const confQual = n < 20 ? 'MODERATE' : n < 50 ? 'STRONG' : 'VERY STRONG';
  const hitRate = conf.matched_count != null && n > 0
    ? `${((conf.matched_count / n) * 100).toFixed(0)}% hit rate`
    : '';

  // Best/worst dates from local data
  const scored = transits.filter(t => t.nifty_return_pct != null);
  const bestT  = scored.reduce<RuleTransit | null>((b, t) =>
    b == null || (t.nifty_return_pct ?? -Infinity) > (b.nifty_return_pct ?? -Infinity) ? t : b, null);
  const worstT = scored.reduce<RuleTransit | null>((b, t) =>
    b == null || (t.nifty_return_pct ?? Infinity) < (b.nifty_return_pct ?? Infinity) ? t : b, null);

  const top = [
    // POA item 3: the % only means something against a stated hypothesis —
    // name the tested claim right under the number (active inference wins;
    // base_bias is the fallback for rules with no authored inference).
    { k: 'CONFIDENCE',  v: conf.confidence_score != null ? `${conf.confidence_score.toFixed(1)}%` : '—',
      sub: `${confQual} · n=${n}${conf.hypothesis_source ? ` · vs ${conf.hypothesis_source === 'inference' ? 'inference' : 'base bias'}${conf.hypothesis_impact ? ` (${conf.hypothesis_impact.replace(/_/g, ' ')})` : ''}` : ''}`,
      color: confidenceColor(conf.confidence_score), big: true },
    { k: 'HISTORICAL',  v: conf.historical_transits != null ? String(conf.historical_transits) : '—', sub: n > 0 ? `${n} scored` : '', color: 'text-white' },
    { k: 'MATCHED',     v: conf.matched_count != null && n > 0 ? `${conf.matched_count}/${n}` : '—', sub: hitRate, color: 'text-accent-gold' },
    { k: 'AVG RETURN',  v: fmtPct(conf.avg_return_all), sub: `All ${occ}`, color: returnColor(conf.avg_return_all) },
    { k: 'AVG MATCHED', v: fmtPct(conf.avg_return_matched), sub: conf.matched_count != null ? `${conf.matched_count} ${occ}` : '', color: 'text-risk-green' },
  ];
  const bot = [
    { k: 'AVG UNMATCHED', v: fmtPct(conf.avg_return_unmatched), sub: conf.matched_count != null && n > 0 ? `${n - conf.matched_count} ${occ}` : '', color: 'text-risk-red/70' },
    { k: isDaily ? 'BEST DAY'  : 'BEST TRANSIT',  v: fmtPct(conf.best_return),  sub: bestT?.start_date  ?? '', color: 'text-risk-green' },
    { k: isDaily ? 'WORST DAY' : 'WORST TRANSIT', v: fmtPct(conf.worst_return), sub: worstT?.start_date ?? '', color: 'text-risk-red/70' },
    { k: 'AVG DURATION', v: conf.avg_duration_days != null ? `${conf.avg_duration_days.toFixed(1)}d` : '—', sub: isDaily ? 'Per signal' : 'Window length', color: 'text-secondary' },
  ];

  return (
    <div className="rounded-xl border border-kd-border bg-kd-card overflow-hidden">
      {/* Top row — Confidence gets extra width */}
      <div className="grid grid-cols-2 sm:grid-cols-[1.3fr_1fr_1fr_1fr_1fr] divide-y sm:divide-y-0 divide-x divide-kd-border/50">
        {top.map((s, i) => (
          <div key={i} className="px-4 py-5">
            <p className="text-[10px] font-mono text-muted uppercase tracking-wider mb-2">{s.k}</p>
            <p className={cn('font-mono font-semibold tabular-nums leading-none', i === 0 ? 'text-3xl' : 'text-xl', s.color)}>{s.v}</p>
            {s.sub && <p className="text-[10px] font-mono text-muted mt-1.5">{s.sub}</p>}
          </div>
        ))}
      </div>
      {/* Bottom row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-kd-border/50 border-t border-kd-border/50">
        {bot.map((s, i) => (
          <div key={i} className="px-4 py-3">
            <p className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1">{s.k}</p>
            <p className={cn('font-mono text-lg font-semibold tabular-nums', s.color)}>{s.v}</p>
            {s.sub && <p className="text-[10px] font-mono text-muted mt-1">{s.sub}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Regime Grid ───────────────────────────────────────────────────────────────

function RegimeGrid({ transits }: { transits: RuleTransit[] }) {
  const regimes = useMemo(() => {
    const done = transits.filter(t => t.nifty_return_pct != null);
    return (['bull', 'side', 'bear'] as const).map(regime => {
      const sub = done.filter(t => regimeOf(t.nifty_return_pct) === regime);
      const matched = sub.filter(t => t.matched === true);
      const avg = sub.length
        ? sub.reduce((s, t) => s + (t.nifty_return_pct ?? 0), 0) / sub.length
        : 0;
      return { regime, count: sub.length, matched: matched.length, avg };
    });
  }, [transits]);

  const maxCount = Math.max(...regimes.map(r => r.count), 1);

  const CFG = {
    bull: { label: 'Bull Regime', accent: 'text-risk-green',  bar: 'bg-risk-green'  },
    side: { label: 'Sideways',    accent: 'text-risk-amber',  bar: 'bg-risk-amber'  },
    bear: { label: 'Bear Regime', accent: 'text-risk-red/80', bar: 'bg-risk-red'    },
  } as const;

  return (
    <div className="rounded-xl border border-kd-border bg-kd-card p-4">
      <p className="text-[10px] font-mono text-muted uppercase tracking-wider mb-3">Performance by Market Regime</p>
      <div className="grid grid-cols-3 gap-3">
        {regimes.map(r => {
          const c = CFG[r.regime];
          return (
            <div key={r.regime} className="rounded-lg border border-kd-border bg-kd-elevated/50 px-3 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className={cn('text-[10px] font-mono uppercase tracking-wider', c.accent)}>{c.label}</span>
                <span className="text-[10px] font-mono text-muted">n={r.count}</span>
              </div>
              <p className={cn('text-xl font-mono font-semibold tabular-nums', r.avg >= 0 ? 'text-risk-green' : 'text-risk-red/80')}>
                {fmtPct(r.avg)}
              </p>
              <p className="text-[10px] font-mono text-muted mt-1">
                {r.matched}/{r.count} matched · {r.count ? ((r.matched / r.count) * 100).toFixed(0) : 0}% hit
              </p>
              <div className="mt-2.5 h-1 rounded-full bg-kd-border/60">
                <div
                  className={cn('h-1 rounded-full opacity-50', c.bar)}
                  style={{ width: `${(r.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Distribution Chart ────────────────────────────────────────────────────────

const DIST_BUCKETS = [
  { lo: -15, hi: -10 },
  { lo: -10, hi: -5 },
  { lo: -5,  hi:  0 },
  { lo:  0,  hi:  5 },
  { lo:  5,  hi: 10 },
  { lo: 10,  hi: 20 },
  { lo: 20,  hi: 40 },
];

function DistributionChart({ transits }: { transits: RuleTransit[] }) {
  const W = 540, H = 190;
  const PAD = { l: 30, r: 20, t: 36, b: 44 };

  const returns = transits
    .filter(t => t.nifty_return_pct != null)
    .map(t => t.nifty_return_pct!);

  if (returns.length === 0) return null;

  const counts = DIST_BUCKETS.map(b => ({
    ...b,
    count: returns.filter(r => r >= b.lo && r < b.hi).length,
    isNeg: b.hi <= 0,
  }));

  const maxCount = Math.max(...counts.map(c => c.count), 1);
  const avg = returns.reduce((s, v) => s + v, 0) / returns.length;

  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;
  const barSlot = chartW / DIST_BUCKETS.length;
  const chartBotY = PAD.t + chartH;

  const fullRange = DIST_BUCKETS[DIST_BUCKETS.length - 1].hi - DIST_BUCKETS[0].lo;
  const avgClipped = Math.max(DIST_BUCKETS[0].lo, Math.min(DIST_BUCKETS[DIST_BUCKETS.length - 1].hi, avg));
  const avgLineX = PAD.l + ((avgClipped - DIST_BUCKETS[0].lo) / fullRange) * chartW;

  return (
    <div className="rounded-xl border border-kd-border bg-kd-card overflow-hidden">
      <div className="px-4 pt-4 pb-1">
        <p className="text-[10px] font-mono text-muted uppercase tracking-wider">Return Distribution · {returns.length} transits</p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: H, display: 'block' }}>
        {counts.map((b, i) => {
          const bH = (b.count / maxCount) * chartH;
          const bX = PAD.l + i * barSlot;
          const color = b.isNeg ? 'var(--bear)' : 'var(--bull)';
          return (
            <g key={i}>
              {bH > 0 && (
                <rect x={bX + 2} y={chartBotY - bH} width={barSlot - 4} height={bH}
                  fill={color} opacity={0.72}/>
              )}
              {b.count > 0 && (
                <text x={bX + barSlot / 2} y={chartBotY - bH - 5}
                  fill="rgba(148,163,184,0.75)" fontFamily="monospace" fontSize="9" textAnchor="middle">
                  {b.count}
                </text>
              )}
              <text x={bX + barSlot / 2} y={chartBotY + 14}
                fill="rgba(148,163,184,0.4)" fontFamily="monospace" fontSize="8.5" textAnchor="middle">
                {b.lo >= 0 ? `+${b.lo}` : `${b.lo}`}
              </text>
            </g>
          );
        })}
        <text x={W - PAD.r} y={chartBotY + 14}
          fill="rgba(148,163,184,0.4)" fontFamily="monospace" fontSize="8.5" textAnchor="end">
          +40
        </text>
        <line x1={PAD.l} y1={chartBotY} x2={W - PAD.r} y2={chartBotY}
          stroke="rgba(255,255,255,0.08)" strokeWidth="0.5"/>
        <line x1={avgLineX} y1={PAD.t} x2={avgLineX} y2={chartBotY}
          stroke="var(--gold)" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.8"/>
        <text x={avgLineX + 3} y={PAD.t + 11}
          fill="var(--gold)" fontFamily="monospace" fontSize="8.5">
          {`AVG ${avg >= 0 ? '+' : ''}${avg.toFixed(1)}%`}
        </text>
      </svg>
      <div className="px-4 pb-3 border-t border-kd-border/30 pt-2">
        <p className="text-[10px] font-mono text-muted italic">
          Are wins spread across many transits, or do a few outliers inflate the average?
        </p>
      </div>
    </div>
  );
}

// ── Alpha Chart ───────────────────────────────────────────────────────────────

function AlphaChart({ transits }: { transits: RuleTransit[] }) {
  const W = 540, H = 190;
  const PAD = { l: 52, r: 80, t: 36, b: 44 };

  const scored = useMemo(() =>
    [...transits]
      .filter(t => t.nifty_return_pct != null)
      .sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [transits]
  );

  if (scored.length < 2) return null;

  const returns = scored.map(t => t.nifty_return_pct!);
  const avg = returns.reduce((s, v) => s + v, 0) / returns.length;
  // Alpha here = deviation from mean (how each transit beats/misses the rule's own avg)
  const alphas = returns.map(r => r - avg);
  const maxAbsAlpha = Math.max(...alphas.map(Math.abs), 0.5);
  const paddedMax = maxAbsAlpha * 1.2;

  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;
  const chartBotY = PAD.t + chartH;
  const baseline = PAD.t + chartH / 2;
  const n = scored.length;
  const barSlot = chartW / n;
  const barW = Math.max(3, Math.min(barSlot * 0.65, 16));

  const yFor = (v: number) => baseline - (v / paddedMax) * (chartH / 2);
  const xFor = (i: number) => PAD.l + (i + 0.5) * barSlot;

  const tickStep = paddedMax > 5 ? 5 : 2;
  const ticks: number[] = [];
  for (let v = -Math.ceil(paddedMax / tickStep) * tickStep; v <= paddedMax; v += tickStep) ticks.push(v);

  return (
    <div className="rounded-xl border border-kd-border bg-kd-card overflow-hidden">
      <div className="px-4 pt-4 pb-1">
        <p className="text-[10px] font-mono text-muted uppercase tracking-wider">Return vs Average (α) · {n} transits</p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: H, display: 'block' }}>
        {ticks.map(v => {
          const y = yFor(v);
          if (y < PAD.t || y > chartBotY) return null;
          return (
            <g key={v}>
              <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y}
                stroke={v === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.04)'}
                strokeWidth={v === 0 ? 0.8 : 0.5} strokeDasharray={v === 0 ? undefined : '3 6'}/>
              <text x={PAD.l - 5} y={y + 3.5}
                fill="rgba(148,163,184,0.4)" fontFamily="monospace" fontSize="8.5" textAnchor="end">
                {v > 0 ? `+${v}%` : `${v}%`}
              </text>
            </g>
          );
        })}
        {alphas.map((alpha, i) => {
          const x = xFor(i);
          const isPos = alpha >= 0;
          const barTop = isPos ? yFor(alpha) : baseline;
          const barH = Math.max(1.5, Math.abs(yFor(alpha) - baseline));
          return (
            <rect key={i}
              x={x - barW / 2} y={barTop} width={barW} height={barH}
              fill={isPos ? 'var(--bull)' : 'none'}
              stroke={isPos ? 'none' : 'var(--bear)'}
              strokeWidth={isPos ? 0 : 1.2}
              opacity={0.75}
            />
          );
        })}
        {/* avg line = 0 baseline already at center; show label on right */}
        <text x={W - PAD.r + 6} y={baseline + 4}
          fill="var(--gold)" fontFamily="monospace" fontSize="8.5">
          AVG
        </text>
      </svg>
      <div className="px-4 pb-3 border-t border-kd-border/30 pt-2">
        <p className="text-[10px] font-mono text-muted italic">
          Green = transit beat the rule's average · Red = missed · Centred on {avg >= 0 ? '+' : ''}{avg.toFixed(1)}% avg
        </p>
      </div>
    </div>
  );
}

// ── Tabbed detail panel ───────────────────────────────────────────────────────

function BacktestTabs({
  ruleId,
  transits, upcomingTransits,
  signals, upcomingSignals,
  signalsPage, setSignalsPage, signalsTotal,
  yearlyConf,
  highlightId, onHighlight,
}: {
  ruleId: number;
  transits: RuleTransit[];
  upcomingTransits: RuleTransit[];
  signals: RuleSignal[];
  upcomingSignals: RuleSignal[];
  signalsPage: number;
  setSignalsPage: (fn: (p: number) => number) => void;
  signalsTotal: number;
  yearlyConf: RuleConfidenceYearly[];
  highlightId: number | null;
  onHighlight: (id: number | null) => void;
}) {
  const [tab, setTab] = useState<'transits' | 'upcoming' | 'signals' | 'occurrences' | 'yearly' | 'almanac' | 'patterns'>('transits');
  const totalPages = Math.ceil(signalsTotal / PAGE_SIZE);

  const tabs = [
    { key: 'transits'    as const, label: `Transits · ${transits.length}` },
    { key: 'upcoming'    as const, label: `Upcoming · ${upcomingTransits.length}` },
    { key: 'almanac'     as const, label: 'Almanac' },
    { key: 'patterns'    as const, label: 'Patterns' },
    { key: 'signals'     as const, label: `Next Signals · ${upcomingSignals.length}` },
    { key: 'occurrences' as const, label: `Daily · ${signalsTotal.toLocaleString()}` },
    ...(yearlyConf.length > 0 ? [{ key: 'yearly' as const, label: `Year-by-Year · ${yearlyConf.length}` }] : []),
  ];

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="rounded-xl border border-kd-border bg-kd-card overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-kd-border/60 px-1 overflow-x-auto">
        <div className="flex">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'px-4 py-3 text-[11px] font-mono uppercase tracking-wider whitespace-nowrap border-b-2 transition-colors',
                tab === t.key
                  ? 'border-accent-gold text-accent-gold'
                  : 'border-transparent text-muted hover:text-secondary',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transits tab */}
      {tab === 'transits' && (
        transits.length === 0
          ? <p className="px-4 py-6 text-sm text-muted text-center">No transits recorded — run discovery to populate</p>
          : <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-kd-border bg-kd-elevated/60">
                  {['Start', 'End', 'Days', 'Nifty Return', 'Regime', 'Matched'].map(h => (
                    <th key={h} className="text-left text-[10px] font-mono text-muted px-3 py-2.5 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transits.map(t => {
                  const isActive  = t.nifty_return_pct == null && t.end_date >= today;
                  const regime    = regimeOf(t.nifty_return_pct);
                  const isHl      = highlightId === t.id;
                  const regimeCfg = { bull: 'text-risk-green', side: 'text-risk-amber', bear: 'text-risk-red/70' } as const;
                  return (
                    <tr
                      key={t.id}
                      onClick={() => onHighlight(isHl ? null : t.id)}
                      className={cn(
                        'border-b border-kd-border/40 cursor-pointer transition-colors',
                        isHl ? 'bg-accent-gold/8 border-l-2 border-l-accent-gold' : 'hover:bg-kd-elevated/40',
                      )}
                    >
                      <td className="px-3 py-2.5 text-xs font-mono text-secondary whitespace-nowrap">{t.start_date}</td>
                      <td className="px-3 py-2.5 text-xs font-mono text-secondary whitespace-nowrap">{t.end_date}</td>
                      <td className="px-3 py-2.5 text-xs tabular-nums text-center text-muted">{t.duration_days}</td>
                      <td className="px-3 py-2.5 text-xs tabular-nums text-center">
                        {isActive
                          ? <span className="text-risk-amber font-mono animate-pulse">◉ LIVE</span>
                          : <span className={returnColor(t.nifty_return_pct)}>{fmtPct(t.nifty_return_pct)}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-[10px] font-mono uppercase">
                        <span className={cn(regimeCfg[regime])}>{regime}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-center">
                        {isActive
                          ? <span className="text-risk-amber font-mono text-[10px]">ACTIVE</span>
                          : <span className={t.matched === true ? 'text-risk-green' : t.matched === false ? 'text-risk-red/60' : 'text-muted'}>
                              {t.matched === true ? '✓ Match' : t.matched === false ? '✕ Miss' : '—'}
                            </span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
      )}

      {/* Upcoming tab */}
      {tab === 'upcoming' && (
        upcomingTransits.length === 0
          ? <p className="px-4 py-6 text-sm text-muted text-center">No upcoming transits in data range</p>
          : <div className="overflow-x-auto">
              {/* Header */}
              <div className="grid grid-cols-[120px_120px_70px_1fr_100px_1fr] gap-2.5 px-4 py-2.5 border-b border-kd-border bg-kd-elevated/60">
                {['START', 'END', 'DAYS', 'AGING', 'STRENGTH', 'NOTE'].map(h => (
                  <span key={h} className="text-[9.5px] font-mono text-muted uppercase tracking-wider">{h}</span>
                ))}
              </div>
              {upcomingTransits.map(t => {
                const inDays  = Math.round((new Date(t.start_date + 'T00:00:00').getTime() - Date.now()) / 86400000);
                const agingPct = Math.max(5, 100 - Math.min(100, inDays / 10));
                const agingColor = inDays < 30 ? 'text-accent-gold' : inDays < 180 ? 'text-secondary' : 'text-muted';
                const agingBar   = inDays < 30 ? 'bg-accent-gold' : inDays < 180 ? 'bg-secondary' : 'bg-kd-border';
                const stars   = inDays < 7 ? 5 : inDays < 30 ? 4 : inDays < 180 ? 3 : 2;
                const note    = inDays < 7 ? 'Imminent — watch' : inDays < 90 ? 'Future window' : 'Long window — rare';
                return (
                  <div key={t.id} className="grid grid-cols-[120px_120px_70px_1fr_100px_1fr] gap-2.5 items-center px-4 py-3 border-b border-kd-border/40 hover:bg-kd-elevated/30 transition-colors">
                    <span className="font-mono text-[12.5px] text-white tabular-nums">{t.start_date}</span>
                    <span className="font-mono text-[12.5px] text-secondary tabular-nums">{t.end_date}</span>
                    <span className="font-mono text-xs text-muted tabular-nums">{t.duration_days}d</span>
                    <span className="flex items-center gap-2">
                      <span className={cn('font-mono text-[13px] tabular-nums font-medium', agingColor)}>in {inDays}d</span>
                      <div className="flex-1 h-[3px] bg-kd-border/50 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full opacity-70', agingBar)} style={{ width: `${agingPct}%` }}/>
                      </div>
                    </span>
                    <span className="text-accent-gold text-sm tracking-wider">{'★'.repeat(stars)}</span>
                    <span className={cn('text-xs', inDays < 7 ? 'text-accent-gold italic' : 'text-muted')}>{note}</span>
                  </div>
                );
              })}
          </div>
      )}

      {/* Almanac tab — full forward calendar of windows (screenshot format) */}
      {tab === 'almanac' && <AlmanacTab ruleId={ruleId} />}

      {/* Patterns tab — Astro Pattern Engine results (POA Phase 3) */}
      {tab === 'patterns' && <PatternsTab ruleId={ruleId} />}

      {/* Next Signals tab */}
      {tab === 'signals' && (
        upcomingSignals.length === 0
          ? <p className="px-4 py-6 text-sm text-muted text-center">No upcoming signals in data range</p>
          : <div className="p-4 flex flex-wrap gap-3">
              {upcomingSignals.map((s, i) => {
                const dt = new Date(s.date + 'T00:00:00');
                const inDays = Math.round((dt.getTime() - Date.now()) / 86400000);
                const isNext = i === 0;
                return (
                  <div key={s.id} className={cn(
                    'min-w-[140px] px-4 py-3 border',
                    isNext
                      ? 'border-accent-gold/40 bg-accent-gold/5'
                      : 'border-kd-border bg-kd-elevated/30',
                  )}>
                    <p className={cn('font-mono text-[10px] uppercase tracking-wider mb-1', isNext ? 'text-accent-gold' : 'text-muted')}>
                      {isNext ? `Next · in ${inDays}d` : `T+${inDays}d`}
                    </p>
                    <p className="font-mono text-lg font-medium text-white">{fmtDate(s.date)}</p>
                    <p className="font-mono text-[10px] text-muted mt-1 uppercase">
                      {dt.toLocaleDateString('en-US', { weekday: 'long' })}
                    </p>
                  </div>
                );
              })}
            </div>
      )}

      {/* Occurrences tab */}
      {tab === 'occurrences' && (
        signals.length === 0 && signalsTotal === 0
          ? <p className="px-4 py-6 text-sm text-muted text-center">No signals recorded — run discovery to populate</p>
          : <div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-kd-border bg-kd-elevated/60">
                      {['Date', 'Signal', 'Strength', 'Nifty', 'Details'].map(h => (
                        <th key={h} className="text-left text-[10px] font-mono text-muted px-3 py-2.5 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {signals.map(sig => (
                      <tr key={sig.id} className={cn(
                        'border-b border-kd-border/40 hover:bg-kd-elevated/40 transition-colors',
                        sig.partial_day && 'opacity-70'
                      )}>
                        <td className="px-3 py-2 text-xs font-mono text-secondary whitespace-nowrap">
                          {sig.date}
                          {sig.partial_day && (
                            <span className="ml-1.5 text-[9px] font-mono text-risk-amber/70 border border-risk-amber/30 rounded px-1">
                              partial
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-secondary capitalize">{sig.signal ?? '—'}</td>
                        <td className="px-3 py-2 text-xs tabular-nums text-center">
                          {sig.strength != null ? <span className="text-accent-gold">{sig.strength}</span> : '—'}
                        </td>
                        <td className="px-3 py-2 text-xs tabular-nums text-center">
                          {sig.actual_market_return != null
                            ? <span className={sig.actual_market_return >= 0 ? 'text-risk-green' : 'text-risk-red'}>
                                {sig.actual_market_return >= 0 ? '+' : ''}{sig.actual_market_return.toFixed(2)}%
                              </span>
                            : <span className="text-muted">—</span>}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted max-w-[280px] truncate">{sig.details ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-kd-border/40">
                  <button
                    onClick={() => setSignalsPage(p => p - 1)}
                    disabled={signalsPage === 0}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs text-muted border border-kd-border rounded-lg hover:text-secondary hover:border-kd-border-active transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-3.5 h-3.5"/> Prev
                  </button>
                  <span className="text-[11px] font-mono text-muted">
                    Page {signalsPage + 1} of {totalPages} · {signalsTotal.toLocaleString()} total
                  </span>
                  <button
                    onClick={() => setSignalsPage(p => p + 1)}
                    disabled={signalsPage >= totalPages - 1}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs text-muted border border-kd-border rounded-lg hover:text-secondary hover:border-kd-border-active transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Next <ChevronRight className="w-3.5 h-3.5"/>
                  </button>
                </div>
              )}
          </div>
      )}

      {/* Year-by-Year tab */}
      {tab === 'yearly' && yearlyConf.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-kd-border bg-kd-elevated/60">
                {['Year', 'Transits', 'Matched', 'Win %', 'Avg Return', 'Avg Days'].map(h => (
                  <th key={h} className="text-left text-[10px] font-mono text-muted px-3 py-2.5 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {yearlyConf.slice(0, 15).map(row => (
                <tr key={row.year} className="border-b border-kd-border/40 hover:bg-kd-elevated/40 transition-colors">
                  <td className="px-3 py-2 text-xs font-mono text-secondary tabular-nums">{row.year}</td>
                  <td className="px-3 py-2 text-xs tabular-nums text-center">{row.transits}</td>
                  <td className="px-3 py-2 text-xs tabular-nums text-center">{row.matched}</td>
                  <td className="px-3 py-2 text-xs tabular-nums text-center">
                    <span className={confidenceColor(row.win_pct)}>
                      {row.win_pct != null ? `${row.win_pct.toFixed(1)}%` : '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums text-center">
                    <span className={returnColor(row.avg_return)}>{fmtPct(row.avg_return)}</span>
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums text-center text-muted">
                    {row.avg_duration != null ? `${row.avg_duration.toFixed(1)}d` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Admin guard ───────────────────────────────────────────────────────────────

function AdminGuard() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted">
      <Lock className="w-8 h-8 opacity-40" />
      <p className="text-sm">Rule Engine is admin-only</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RuleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuthStore();
  const { toasts, toast, dismiss } = useToast();
  const qc = useQueryClient();
  const ruleId = Number(id);

  // Modal state: null = closed, 'edit' | 'clone' = open
  const [modalMode, setModalMode] = useState<FormMode | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Delete confirmation: first click arms, second click within 3s fires
  const [deleteArmed, setDeleteArmed] = useState(false);
  // Drop signals confirmation: same two-step pattern
  const [dropArmed, setDropArmed] = useState(false);
  // Track when a background discovery job is running for this page
  const [trackingDiscovery, setTrackingDiscovery] = useState(false);
  // Job ID of the discovery we started — used to avoid reacting to a stale cached status
  const [startedJobId, setStartedJobId] = useState<string | null>(null);
  // Signals pagination (0-indexed)
  const [signalsPage, setSignalsPage] = useState(0);
  // Highlight a transit on the equity chart + table
  const [highlightTransitId, setHighlightTransitId] = useState<number | null>(null);
  // "Rule Inference" modal (renamed from "Edit" — that button now edits rule
  // metadata under a smaller secondary action since it's a different form)
  const [inferenceModalOpen, setInferenceModalOpen] = useState(false);

  const backendStatus = useBackendStatus();

  const { data: rule, isLoading, isError, error } = useQuery({
    queryKey: ['rule-engine', 'rule', ruleId],
    queryFn: () => fetchRule(ruleId),
    enabled: !isNaN(ruleId),
    staleTime: 5 * 60 * 1000,
  });

  const { data: conf = null } = useQuery({
    queryKey: ['rule-engine', 'confidence', ruleId],
    queryFn: () => fetchRuleConfidence(ruleId),
    enabled: !isNaN(ruleId),
    staleTime: 10 * 60 * 1000,
  });

  const { data: signalsData = { rows: [], total: 0 } } = useQuery({
    queryKey: ['rule-engine', 'signals', ruleId, signalsPage],
    queryFn: () => fetchRuleSignals(ruleId, signalsPage),
    enabled: !isNaN(ruleId),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const { data: upcomingSignals = [] } = useQuery({
    queryKey: ['rule-engine', 'signals-upcoming', ruleId],
    queryFn: () => fetchUpcomingSignals(ruleId),
    enabled: !isNaN(ruleId),
    staleTime: 5 * 60 * 1000,
  });

  const { data: transits = [] } = useQuery({
    queryKey: ['rule-engine', 'transits', ruleId],
    queryFn: () => fetchRuleTransits(ruleId),
    enabled: !isNaN(ruleId),
    staleTime: 5 * 60 * 1000,
  });

  const isDailyOnlyRule = rule ? DAILY_ONLY_TYPES.has(rule.rule_type) : false;

  // For daily-only rule types (nakshatra_vara, tithi_alone, eclipse), signals carry
  // actual_market_return instead of transits. Fetch these to power the backtest charts.
  const { data: signalTransits = [] } = useQuery({
    queryKey: ['rule-engine', 'signal-returns', ruleId],
    queryFn: () => fetchSignalReturns(ruleId),
    enabled: !isNaN(ruleId) && isDailyOnlyRule,
    staleTime: 5 * 60 * 1000,
  });

  // Charts use transit data when available, falling back to signal-derived transits
  const chartsData = transits.length > 0 ? transits : signalTransits;

  const { data: upcomingTransits = [] } = useQuery({
    queryKey: ['rule-engine', 'transits-upcoming', ruleId],
    queryFn: () => fetchUpcomingTransits(ruleId),
    enabled: !isNaN(ruleId),
    staleTime: 5 * 60 * 1000,
  });

  const { data: yearlyConf = [] } = useQuery({
    queryKey: ['rule-engine', 'confidence-yearly', ruleId],
    queryFn: () => fetchYearlyConfidence(ruleId),
    enabled: !isNaN(ruleId),
    staleTime: 10 * 60 * 1000,
  });

  // Poll discovery status while a job is running so the button stays in loading
  // state and data refreshes automatically when the job completes.
  const { data: discoveryStatus, isError: discoveryPollError } = useQuery({
    queryKey: ['rule-engine', 'discovery-status'],
    queryFn: fetchDiscoveryStatus,
    staleTime: 0,
    enabled: trackingDiscovery,
    refetchInterval: trackingDiscovery ? 2000 : false,
    retry: 1,
    retryDelay: 1000,
  });

  // If backend goes offline while tracking, stop showing "Running…" immediately
  useEffect(() => {
    if (!trackingDiscovery) return;
    if (backendStatus !== 'offline' && !discoveryPollError) return;
    setTrackingDiscovery(false);
    setStartedJobId(null);
    toast('error', 'Backend offline — discovery status unknown. Check if the server is running.');
  }, [backendStatus, discoveryPollError, trackingDiscovery, toast]);

  useEffect(() => {
    if (!trackingDiscovery || !discoveryStatus) return;
    if (discoveryStatus.running) return;
    // Guard against stale cached status from before our job was launched
    if (startedJobId && discoveryStatus.job_id !== startedJobId) return;
    // Job finished — stop polling and refresh rule data
    setTrackingDiscovery(false);
    setStartedJobId(null);
    setSignalsPage(0);
    qc.invalidateQueries({ queryKey: ['rule-engine', 'signals', ruleId] });
    qc.invalidateQueries({ queryKey: ['rule-engine', 'signals-upcoming', ruleId] });
    qc.invalidateQueries({ queryKey: ['rule-engine', 'transits', ruleId] });
    qc.invalidateQueries({ queryKey: ['rule-engine', 'transits-upcoming', ruleId] });
    qc.invalidateQueries({ queryKey: ['rule-engine', 'confidence', ruleId] });
    qc.invalidateQueries({ queryKey: ['rule-engine', 'signal-returns', ruleId] });
    qc.invalidateQueries({ queryKey: ['rule-engine', 'signal-counts'] });
    const inserted = discoveryStatus.signals_inserted;
    const errs = discoveryStatus.errors;
    if (errs.length > 0) {
      const first = errs[0];
      const extra = errs.length > 1 ? ` (+${errs.length - 1} more)` : '';
      toast('error', `Discovery error — ${first.rule_code}: ${first.error}${extra}`);
    } else {
      const transits = discoveryStatus.transits_inserted ?? 0;
      toast('success', `Discovery complete — ${inserted.toLocaleString()} signals, ${transits} transits`);
    }
  }, [discoveryStatus, trackingDiscovery, startedJobId, ruleId, qc, toast, setSignalsPage]);

  // ── Edit mutation ──
  const editMutation = useMutation({
    mutationFn: (patch: Parameters<typeof updateRule>[1]) => updateRule(ruleId, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rule-engine', 'rule', ruleId] });
      qc.invalidateQueries({ queryKey: ['rule-engine', 'rules'] });
      setModalMode(null);
      setSaveError(null);
      toast('success', 'Rule updated');
    },
    onError: (err: Error) => {
      setSaveError(err.message);
      toast('error', err.message);
    },
  });

  // ── Clone mutation (creates a new rule) ──
  const cloneMutation = useMutation({
    mutationFn: createRule,
    onSuccess: (newRule: AstroRuleFull) => {
      qc.invalidateQueries({ queryKey: ['rule-engine', 'rules'] });
      setModalMode(null);
      setSaveError(null);
      toast('success', 'Rule cloned — navigating to clone');
      setTimeout(() => navigate(`/rules/${newRule.id}`), 600);
    },
    onError: (err: Error) => {
      setSaveError(err.message);
      toast('error', err.message);
    },
  });

  // ── Delete mutation ──
  const deleteMutation = useMutation({
    mutationFn: () => softDeleteRule(ruleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rule-engine', 'rules'] });
      toast('success', 'Rule deleted');
      setTimeout(() => navigate('/rules'), 600);
    },
    onError: (err: Error) => toast('error', `Delete failed: ${err.message}`),
  });

  // ── Discover mutation ──
  const discoverMutation = useMutation({
    mutationFn: () => runRuleDiscovery(ruleId),
    onSuccess: (data) => {
      setStartedJobId(data.job_id);
      setTrackingDiscovery(true);
      toast('info', 'Discovery running — results will refresh when done');
    },
    onError: (err: Error) => toast('error', err.message),
  });

  // ── Drop signals mutation ──
  const dropSignalsMutation = useMutation({
    mutationFn: () => dropRuleSignals(ruleId),
    onSuccess: (data) => {
      setDropArmed(false);
      qc.invalidateQueries({ queryKey: ['rule-engine', 'signals', ruleId] });
      qc.invalidateQueries({ queryKey: ['rule-engine', 'signals-upcoming', ruleId] });
      qc.invalidateQueries({ queryKey: ['rule-engine', 'transits', ruleId] });
      qc.invalidateQueries({ queryKey: ['rule-engine', 'transits-upcoming', ruleId] });
      qc.invalidateQueries({ queryKey: ['rule-engine', 'confidence', ruleId] });
      qc.invalidateQueries({ queryKey: ['rule-engine', 'confidence-yearly', ruleId] });
      toast('success', `Cleared ${data.signals_deleted} signals · ${data.transits_deleted} transits — run discovery to repopulate`);
    },
    onError: (err: Error) => { setDropArmed(false); toast('error', `Drop failed: ${err.message}`); },
  });

  const handleDropSignals = () => {
    if (dropArmed) {
      dropSignalsMutation.mutate();
      setDropArmed(false);
    } else {
      setDropArmed(true);
      setTimeout(() => setDropArmed(false), 3000);
    }
  };

  // ── Cancel mutation ──
  const cancelMutation = useMutation({
    mutationFn: cancelDiscovery,
    onSuccess: () => {
      setTrackingDiscovery(false);
      setStartedJobId(null);
      toast('info', 'Cancel requested — job will stop after current rule');
    },
    onError: (err: Error) => toast('error', `Cancel failed: ${err.message}`),
  });

  const isDiscoveryRunning = discoverMutation.isPending || trackingDiscovery;

  const handleDelete = () => {
    if (deleteArmed) {
      deleteMutation.mutate();
      setDeleteArmed(false);
    } else {
      setDeleteArmed(true);
      setTimeout(() => setDeleteArmed(false), 3000);
    }
  };

  if (!isAdmin) return <AdminGuard />;

  if (isNaN(ruleId)) {
    return (
      <div className="flex items-center justify-center h-48 gap-2 text-risk-red text-sm">
        <AlertCircle className="w-4 h-4" /> Invalid rule ID
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 gap-2 text-muted text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading rule…
      </div>
    );
  }

  if (isError || !rule) {
    return (
      <div className="flex items-center justify-center h-48 gap-2 text-risk-red text-sm">
        <AlertCircle className="w-4 h-4" /> {(error as Error)?.message ?? 'Rule not found'}
      </div>
    );
  }

  const outcome = effectiveOutcome(rule);
  const activeMutationPending = modalMode === 'edit' ? editMutation.isPending : cloneMutation.isPending;

  return (
    <>
      <div className="space-y-5">
        {/* Backend offline banner */}
        {backendStatus === 'offline' && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-risk-red/30 bg-risk-red/10 text-risk-red/80 text-xs">
            <WifiOff className="w-3.5 h-3.5 shrink-0" />
            <span>Backend offline — server is not responding. Start uvicorn and refresh.</span>
          </div>
        )}

        {/* Back + action buttons */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={() => navigate('/rules')}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-secondary transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Rule Engine
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Run Discovery / Cancel */}
            {isDiscoveryRunning ? (
              <button
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                title="Request cancellation"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-risk-red/80 border border-risk-red/30 bg-risk-red/10 rounded-lg hover:bg-risk-red/20 transition-all disabled:opacity-50"
              >
                {cancelMutation.isPending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <X className="w-3.5 h-3.5" />}
                {cancelMutation.isPending ? 'Cancelling…' : 'Running… Cancel?'}
              </button>
            ) : (
              <button
                onClick={() => discoverMutation.mutate()}
                disabled={backendStatus === 'offline'}
                title={backendStatus === 'offline' ? 'Backend offline' : 'Run discovery for this rule only'}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-risk-amber border border-risk-amber/30 bg-risk-amber/10 rounded-lg hover:bg-risk-amber/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {backendStatus === 'offline'
                  ? <WifiOff className="w-3.5 h-3.5" />
                  : <Play className="w-3.5 h-3.5" />}
                Run Discovery
              </button>
            )}

            {/* Drop Signals (two-step confirm) */}
            <button
              onClick={handleDropSignals}
              disabled={dropSignalsMutation.isPending || isDiscoveryRunning}
              title="Delete all signals, transits and confidence for this rule so you can re-run discovery from scratch"
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all disabled:opacity-50',
                dropArmed
                  ? 'text-white bg-risk-red/60 border-risk-red animate-pulse'
                  : 'text-muted border-kd-border hover:text-risk-red/70 hover:border-risk-red/30',
              )}
            >
              {dropSignalsMutation.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Eraser className="w-3.5 h-3.5" />}
              {dropArmed ? 'Confirm Drop?' : 'Drop Signals'}
            </button>

            {/* Clone */}
            <button
              onClick={() => { setSaveError(null); setModalMode('clone'); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted border border-kd-border rounded-lg hover:text-secondary hover:border-kd-border-active transition-all"
            >
              <Copy className="w-3.5 h-3.5" /> Clone
            </button>

            {/* Rule Inference — replaces the old Edit button (owner 2026-07-07).
                Opens the /inference-style modal: manual entry or AI Inference
                (Claude/Qwen). Rule METADATA editing (rule_code/tags/base_bias)
                is intentionally no longer on this toolbar — reachable only
                through the modal's small footer link. */}
            <button
              onClick={() => setInferenceModalOpen(true)}
              title="Author the expected behavior for this rule — manual or AI Inference"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-accent-indigo border border-accent-indigo/30 bg-accent-indigo/10 rounded-lg hover:bg-accent-indigo/20 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" /> Rule Inference
            </button>

            {/* Delete (armed = confirm state) */}
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all disabled:opacity-50',
                deleteArmed
                  ? 'text-white bg-risk-red/70 border-risk-red animate-pulse'
                  : 'text-risk-red/70 border-risk-red/30 bg-risk-red/10 hover:bg-risk-red/20',
              )}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {deleteArmed ? 'Confirm Delete?' : 'Delete'}
            </button>
          </div>
        </div>

        {/* Header card */}
        <div className="rounded-xl border border-kd-border bg-kd-card p-5 space-y-4">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex-1 min-w-0">
              {/* Pills row */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="font-mono text-[10px] tracking-wider text-accent-indigo/80 bg-accent-indigo/10 border border-accent-indigo/20 px-2.5 py-1 rounded">
                  {rule.rule_code}
                </span>
                <span className="font-mono text-[10px] tracking-wider text-accent-indigo border border-accent-indigo/30 bg-accent-indigo/8 px-2.5 py-1 rounded uppercase">
                  {RULE_TYPE_LABELS[rule.rule_type] ?? rule.rule_type}
                </span>
                <OutcomeBadge outcome={outcome} />
                {!rule.is_active && (
                  <span className="font-mono text-[10px] text-risk-red/70 border border-risk-red/20 bg-risk-red/10 px-2.5 py-1 rounded uppercase tracking-wider">
                    Inactive
                  </span>
                )}
                <span className="font-mono text-[10px] text-muted tracking-wider ml-1">
                  BENCHMARK · NIFTY 50
                </span>
              </div>
              {/* Large serif title */}
              <h1 className="font-display text-3xl font-medium text-white leading-tight tracking-tight">
                {rule.display_name}
              </h1>
              {/* Italic remarks inline */}
              {rule.remarks && (
                <p className="text-sm text-muted italic mt-1.5 leading-relaxed">{rule.remarks}</p>
              )}
            </div>
          </div>

          {/* Conditions inline as key → value chips */}
          {rule.conditions && Object.keys(rule.conditions).length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-kd-border/40">
              <span className="font-mono text-[10px] text-muted uppercase tracking-wider shrink-0">Conditions</span>
              {Object.entries(rule.conditions).map(([k, v]) => (
                <span key={k} className="inline-flex items-center gap-2 px-3 py-1 border border-kd-border/60 bg-kd-elevated/30 text-xs">
                  <span className="font-mono text-[10px] text-muted uppercase tracking-wider">{k}</span>
                  <span className="text-secondary">{Array.isArray(v) ? v.join(', ') : String(v)}</span>
                </span>
              ))}
            </div>
          )}

          {/* Scope + data source row */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-3 border-t border-kd-border/40">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-muted uppercase tracking-wider">Scope</span>
              <ScopeChips scope={rule.scope} />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-muted uppercase tracking-wider">Source</span>
              <span className={cn('inline-flex items-center gap-1.5 text-xs', rule.data_source !== 'unavailable' ? 'text-risk-green/70' : 'text-muted')}>
                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', rule.data_source !== 'unavailable' ? 'bg-risk-green/70' : 'bg-kd-border')} />
                {rule.data_source === 'user_defined' ? 'Custom' : rule.data_source ?? '—'}
              </span>
            </div>
            {(rule.probability_label ?? rule.probability) && (
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-muted uppercase tracking-wider">Probability</span>
                <span className="text-xs text-secondary">{rule.probability_label ?? rule.probability}</span>
              </div>
            )}
          </div>
        </div>

        {/* Backtesting */}
        <section className="space-y-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-medium text-secondary">Backtesting</h2>
            {conf?.last_computed_at && (
              <span className="text-[11px] font-mono text-muted">as of {conf.last_computed_at.slice(0, 10)}</span>
            )}
          </div>

          {conf != null ? (
            <>
              {isDailyOnlyRule && signalTransits.length > 0 && (
                <div className="px-3 py-2 rounded-lg bg-accent-indigo/8 border border-accent-indigo/20">
                  <span className="text-[11px] font-mono text-accent-indigo/80">
                    Daily-signal rule — each bar = one trading day · return = same-day Nifty close-to-close
                  </span>
                </div>
              )}
              <PerTransitBarChart
                transits={chartsData}
                highlightId={highlightTransitId}
                onHighlight={setHighlightTransitId}
              />
              <BacktestStatGrid conf={conf} transits={chartsData} isDaily={isDailyOnlyRule} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <DistributionChart transits={chartsData} />
                <AlphaChart transits={chartsData} />
              </div>
              {chartsData.length >= 1 && <RegimeGrid transits={chartsData} />}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-6 rounded-xl border border-kd-border bg-kd-elevated/30">
              <p className="text-sm text-muted">Run discovery and confidence scoring to populate data</p>
              <button
                onClick={() => discoverMutation.mutate()}
                disabled={isDiscoveryRunning}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-risk-amber border border-risk-amber/30 bg-risk-amber/10 rounded-lg hover:bg-risk-amber/20 transition-all disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                Run Discovery
              </button>
            </div>
          )}
        </section>

        {/* Tabbed detail panel */}
        <BacktestTabs
          ruleId={ruleId}
          transits={transits}
          upcomingTransits={upcomingTransits}
          signals={signalsData.rows}
          upcomingSignals={upcomingSignals}
          signalsPage={signalsPage}
          setSignalsPage={setSignalsPage}
          signalsTotal={signalsData.total}
          yearlyConf={yearlyConf}
          highlightId={highlightTransitId}
          onHighlight={setHighlightTransitId}
        />
      </div>

      {/* Rule Inference — theory-vs-evidence authoring, styled like /inference */}
      {inferenceModalOpen && rule && (
        <RuleInferenceModal
          ruleId={ruleId}
          ruleName={rule.display_name}
          onClose={() => setInferenceModalOpen(false)}
          metadataForm={{
            initial: ruleToForm(rule, 'edit'),
            save: async input => {
              const { rule_code: _rc, rule_type: _rt, ...patch } = input;
              await editMutation.mutateAsync(patch);
            },
          }}
        />
      )}

      {/* Edit / Clone Modal */}
      {modalMode && (
        <RuleFormModal
          mode={modalMode}
          initial={ruleToForm(rule, modalMode)}
          onClose={() => { setModalMode(null); setSaveError(null); }}
          onSave={input => {
            setSaveError(null);
            if (modalMode === 'edit') {
              // strip non-editable fields from patch
              const { rule_code: _rc, rule_type: _rt, ...patch } = input;
              editMutation.mutate(patch);
            } else {
              cloneMutation.mutate(input);
            }
          }}
          isSaving={activeMutationPending}
          saveError={saveError}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
