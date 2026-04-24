import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Loader2, AlertCircle, Pencil, Copy, Trash2, Lock, Play, WifiOff, X, Eraser } from 'lucide-react';
import { from } from '@/services/postgrest';
import { useAuthStore } from '@/stores/authStore';
import { useToast, ToastContainer } from '@/components/ui';
import { useBackendStatus } from '@/hooks';
import { cn } from '@/lib/utils';
import RuleFormModal, { ruleToForm, formToInput, type FormMode } from './RuleFormModal';
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
      'last_computed_at',
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
    .select('id,date,signal,strength,details,matched')
    .eq('rule_id', ruleId)
    .lte('date', today)
    .order('date', { ascending: false })
    .withCount()
    .range(offset, offset + PAGE_SIZE - 1)
    .execute();
  if (error) throw new Error(error.message);
  return { rows: (data as RuleSignal[]) ?? [], total: count ?? 0 };
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

// ── Equity Curve Chart ────────────────────────────────────────────────────────

function EquityChart({ transits, highlightId, onHighlight }: {
  transits: RuleTransit[];
  highlightId: number | null;
  onHighlight: (id: number | null) => void;
}) {
  const W = 800, H = 240;
  const PAD = { l: 48, r: 16, t: 16, b: 36 };

  const sorted = useMemo(() =>
    [...transits]
      .filter(t => t.nifty_return_pct != null)
      .sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [transits]
  );

  const points = useMemo(() => {
    let equity = 100;
    return sorted.map(t => {
      equity *= (1 + (t.nifty_return_pct ?? 0) / 100);
      return { t, equity };
    });
  }, [sorted]);

  if (points.length < 2) return null;

  const xs = sorted.map(p => new Date(p.start_date).getTime());
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const ys = points.map(p => p.equity);
  const minY = Math.min(Math.min(...ys) * 0.96, 97);
  const maxY = Math.max(...ys) * 1.04;
  const maxAbs = Math.max(...sorted.map(t => Math.abs(t.nifty_return_pct ?? 0)), 1);

  const xFor = (iso: string) =>
    minX === maxX ? (W - PAD.l - PAD.r) / 2 + PAD.l
    : PAD.l + ((new Date(iso).getTime() - minX) / (maxX - minX)) * (W - PAD.l - PAD.r);
  const yFor = (v: number) =>
    PAD.t + (1 - (v - minY) / (maxY - minY)) * (H - PAD.t - PAD.b);

  const linePath = points.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${xFor(p.t.start_date).toFixed(1)} ${yFor(p.equity).toFixed(1)}`
  ).join(' ');

  const lastX = xFor(points[points.length - 1].t.start_date).toFixed(1);
  const fillPath = `M ${PAD.l} ${H - PAD.b} L ${points.map(p =>
    `${xFor(p.t.start_date).toFixed(1)} ${yFor(p.equity).toFixed(1)}`).join(' L ')} L ${lastX} ${H - PAD.b} Z`;

  const baseline = yFor(100);

  const startYear = new Date(minX).getFullYear();
  const endYear   = new Date(maxX).getFullYear();
  const yearStep  = Math.max(1, Math.ceil((endYear - startYear) / 6));
  const years: number[] = [];
  for (let y = startYear; y <= endYear; y += yearStep) years.push(y);

  const finalEquity = points[points.length - 1].equity;
  const finalGain   = (finalEquity - 100).toFixed(1);
  const scored      = points.length;
  const windowYears = endYear - startYear;

  return (
    <div className="rounded-xl border border-kd-border bg-kd-card overflow-hidden">
      <div className="px-5 pt-4 pb-2">
        <p className="text-[10px] font-mono text-muted uppercase tracking-wider mb-2">
          Backtest · {windowYears}Y window · as of {new Date().toISOString().slice(0, 10)}
        </p>
        <p className="font-display text-2xl text-white leading-snug">
          <em className={cn('not-italic font-medium', Number(finalGain) >= 0 ? 'text-risk-green' : 'text-risk-red/80')}>
            {Number(finalGain) >= 0 ? '+' : ''}{finalGain}%
          </em>
          {' '}compounded across{' '}
          <span className="font-mono text-accent-gold">{scored}</span>
          {' '}completed transits
        </p>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: H, display: 'block' }}>
        <defs>
          <linearGradient id="eqFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%"   stopColor="var(--bull)" stopOpacity="0.18"/>
            <stop offset="100%" stopColor="var(--bull)" stopOpacity="0"/>
          </linearGradient>
        </defs>

        {/* Baseline at 100 */}
        <line x1={PAD.l} y1={baseline} x2={W - PAD.r} y2={baseline}
          stroke="rgba(255,255,255,0.09)" strokeWidth="0.8" strokeDasharray="4 6"/>

        {/* Y-axis labels */}
        {[-20, -10, 0, 10, 20, 50, 100, 150].map(offset => {
          const v = 100 + offset;
          if (v < minY || v > maxY) return null;
          return (
            <text key={offset} x={PAD.l - 6} y={yFor(v) + 3}
              fill="rgba(148,163,184,0.45)" fontFamily="monospace" fontSize="8" textAnchor="end">
              {offset >= 0 ? `+${offset}%` : `${offset}%`}
            </text>
          );
        })}

        {/* Year ticks */}
        {years.map(y => {
          const x = xFor(`${y}-06-01`);
          return (
            <g key={y}>
              <line x1={x} y1={H - PAD.b} x2={x} y2={H - PAD.b + 4} stroke="rgba(255,255,255,0.1)"/>
              <text x={x} y={H - PAD.b + 16} fill="rgba(148,163,184,0.45)" fontFamily="monospace" fontSize="9" textAnchor="middle">{y}</text>
            </g>
          );
        })}

        {/* Area fill + line */}
        <path d={fillPath} fill="url(#eqFill)"/>
        <path d={linePath} fill="none" stroke="var(--bull)" strokeWidth="1.6"/>

        {/* Scatter dots */}
        {points.map(({ t, equity }) => {
          const x = xFor(t.start_date);
          const y = yFor(equity);
          const r = 3 + (Math.abs(t.nifty_return_pct ?? 0) / maxAbs) * 4.5;
          const col = t.matched === true
            ? 'var(--bull)'
            : t.matched === false
              ? 'var(--bear)'
              : 'var(--caution)';
          const isHl = highlightId === t.id;
          const dim  = highlightId != null && !isHl;
          return (
            <g key={t.id} style={{ cursor: 'pointer' }} onClick={() => onHighlight(isHl ? null : t.id)}>
              {isHl && <circle cx={x} cy={y} r={r + 7} fill={col} opacity="0.18"/>}
              <circle cx={x} cy={y} r={r}
                fill={t.matched !== false ? col : 'none'}
                stroke={col}
                strokeWidth={t.matched === false ? 1.5 : 0}
                opacity={dim ? 0.18 : 1}/>
            </g>
          );
        })}
      </svg>

      <div className="px-4 pb-3 pt-1 flex gap-5 flex-wrap border-t border-kd-border/30 mt-1">
        {[
          { dot: 'bg-risk-green', label: 'Matched' },
          { dot: 'bg-risk-red', border: true, label: 'Unmatched (hollow)' },
        ].map(({ dot, border, label }) => (
          <span key={label} className="flex items-center gap-1.5 text-[10px] font-mono text-muted">
            <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', dot, border ? 'bg-transparent border border-risk-red' : '')}/>
            {label}
          </span>
        ))}
        <span className="text-[10px] font-mono text-muted">Dot size ∝ return magnitude · click to highlight row</span>
      </div>
    </div>
  );
}

// ── Stat Grid ─────────────────────────────────────────────────────────────────

function BacktestStatGrid({ conf }: { conf: RuleConfidence }) {
  const hitRate = conf.matched_count != null && conf.total_occurrences != null && conf.total_occurrences > 0
    ? `${((conf.matched_count / conf.total_occurrences) * 100).toFixed(0)}% hit rate`
    : '';

  const top = [
    { k: 'CONFIDENCE',   v: conf.confidence_score != null ? `${conf.confidence_score.toFixed(1)}%` : '—', sub: conf.total_occurrences != null ? `n=${conf.total_occurrences}` : '', color: confidenceColor(conf.confidence_score), big: true },
    { k: 'HISTORICAL',   v: conf.historical_transits != null ? String(conf.historical_transits) : '—', sub: conf.total_occurrences != null ? `${conf.total_occurrences} scored` : '', color: 'text-white' },
    { k: 'MATCHED',      v: conf.matched_count != null && conf.total_occurrences != null ? `${conf.matched_count}/${conf.total_occurrences}` : '—', sub: hitRate, color: 'text-accent-gold' },
    { k: 'AVG RETURN',   v: fmtPct(conf.avg_return_all), sub: 'All transits', color: returnColor(conf.avg_return_all) },
    { k: 'AVG MATCHED',  v: fmtPct(conf.avg_return_matched), sub: conf.matched_count != null ? `${conf.matched_count} transits` : '', color: 'text-risk-green' },
  ];
  const bot = [
    { k: 'AVG UNMATCHED', v: fmtPct(conf.avg_return_unmatched), color: 'text-risk-red/70' },
    { k: 'BEST TRANSIT',  v: fmtPct(conf.best_return),          color: 'text-risk-green' },
    { k: 'WORST TRANSIT', v: fmtPct(conf.worst_return),         color: 'text-risk-red/70' },
    { k: 'AVG DURATION',  v: conf.avg_duration_days != null ? `${conf.avg_duration_days.toFixed(1)}d` : '—', color: 'text-secondary' },
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

// ── Tabbed detail panel ───────────────────────────────────────────────────────

function BacktestTabs({
  transits, upcomingTransits,
  signals, upcomingSignals,
  signalsPage, setSignalsPage, signalsTotal,
  yearlyConf,
  highlightId, onHighlight,
}: {
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
  const [tab, setTab] = useState<'transits' | 'upcoming' | 'occurrences' | 'yearly'>('transits');
  const totalPages = Math.ceil(signalsTotal / PAGE_SIZE);

  const tabs = [
    { key: 'transits'    as const, label: `Transits · ${transits.length}` },
    { key: 'upcoming'    as const, label: `Upcoming · ${upcomingTransits.length}` },
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
                  {['Start', 'End', 'Days', 'Return', 'Regime', 'Matched'].map(h => (
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
          : <div>
              {upcomingTransits.map((t, i) => {
                const inDays = Math.round((new Date(t.start_date).getTime() - Date.now()) / 86400000);
                const fmt = (iso: string) =>
                  new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                return (
                  <div key={t.id} className={cn(
                    'flex items-center justify-between gap-4 px-4 py-3 border-b border-kd-border/40',
                    i === 0 && 'bg-accent-gold/5',
                  )}>
                    <div>
                      {i === 0 && <span className="text-[10px] font-mono text-accent-gold uppercase tracking-wider block mb-0.5">Next · in {inDays}d</span>}
                      <span className="text-sm font-mono text-secondary">{fmt(t.start_date)} – {fmt(t.end_date)}</span>
                    </div>
                    <span className="text-xs text-muted whitespace-nowrap">{t.duration_days}d window</span>
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
                      {['Date', 'Signal', 'Strength', 'Details', 'Matched'].map(h => (
                        <th key={h} className="text-left text-[10px] font-mono text-muted px-3 py-2.5 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {signals.map(sig => (
                      <tr key={sig.id} className="border-b border-kd-border/40 hover:bg-kd-elevated/40 transition-colors">
                        <td className="px-3 py-2 text-xs font-mono text-secondary whitespace-nowrap">{sig.date}</td>
                        <td className="px-3 py-2 text-xs text-secondary capitalize">{sig.signal ?? '—'}</td>
                        <td className="px-3 py-2 text-xs tabular-nums text-center">
                          {sig.strength != null ? <span className="text-risk-amber">{sig.strength}</span> : '—'}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted max-w-[260px] truncate">{sig.details ?? '—'}</td>
                        <td className="px-3 py-2 text-xs text-center">
                          <span className={sig.matched === true ? 'text-risk-green' : sig.matched === false ? 'text-risk-red/60' : 'text-muted'}>
                            {sig.matched === true ? '✓' : sig.matched === false ? '✗' : '—'}
                          </span>
                        </td>
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
              {upcomingSignals.length > 0 && (
                <div className="px-4 py-3 border-t border-kd-border/40">
                  <p className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1">Upcoming Signals</p>
                  <p className="text-xs text-secondary font-mono">
                    Next:{' '}
                    <span className="text-accent-indigo">
                      {new Date(upcomingSignals[0].date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    {upcomingSignals.length > 1 && (
                      <span className="text-muted ml-2">+{upcomingSignals.length - 1} more</span>
                    )}
                  </p>
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

            {/* Edit */}
            <button
              onClick={() => { setSaveError(null); setModalMode('edit'); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-accent-indigo border border-accent-indigo/30 bg-accent-indigo/10 rounded-lg hover:bg-accent-indigo/20 transition-all"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
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
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-accent-indigo/80 bg-accent-indigo/10 border border-accent-indigo/20 px-2 py-0.5 rounded">
                  {rule.rule_code}
                </span>
                <span className="text-[11px] font-mono text-muted border border-kd-border bg-kd-elevated px-1.5 py-0.5 rounded">
                  {RULE_TYPE_LABELS[rule.rule_type] ?? rule.rule_type}
                </span>
                {!rule.is_active && (
                  <span className="text-[11px] font-mono text-risk-red/70 border border-risk-red/20 bg-risk-red/10 px-1.5 py-0.5 rounded">
                    Inactive
                  </span>
                )}
              </div>
              <h1 className="font-display text-3xl font-medium text-white leading-tight mt-1 tracking-tight">{rule.display_name}</h1>
            </div>
            <OutcomeBadge outcome={outcome} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-kd-border/40">
            <div>
              <p className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1">Probability</p>
              <p className="text-sm text-secondary">{rule.probability_label ?? rule.probability ?? '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1">Data Source</p>
              <span className={cn('inline-flex items-center gap-1 text-sm', rule.data_source !== 'unavailable' ? 'text-risk-green/70' : 'text-muted')}>
                <span className={cn('w-1.5 h-1.5 rounded-full', rule.data_source !== 'unavailable' ? 'bg-risk-green/70' : 'bg-kd-border')} />
                {rule.data_source === 'user_defined' ? 'Custom' : rule.data_source ?? '—'}
              </span>
            </div>
            <div className="col-span-2">
              <p className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1">Scope</p>
              <ScopeChips scope={rule.scope} />
            </div>
          </div>

          {rule.remarks && (
            <div className="pt-3 border-t border-kd-border/40">
              <p className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1">Remarks</p>
              <p className="text-sm text-secondary leading-relaxed">{rule.remarks}</p>
            </div>
          )}
        </div>

        {/* Conditions */}
        <section>
          <h2 className="text-sm font-medium text-secondary mb-2">Conditions</h2>
          <div className="rounded-xl border border-kd-border bg-kd-card p-4">
            <ConditionsBlock conditions={rule.conditions} />
          </div>
        </section>

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
              <EquityChart
                transits={transits}
                highlightId={highlightTransitId}
                onHighlight={setHighlightTransitId}
              />
              <BacktestStatGrid conf={conf} />
              {transits.length >= 3 && <RegimeGrid transits={transits} />}
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
