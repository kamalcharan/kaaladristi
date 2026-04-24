import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Loader2, AlertCircle, Pencil, Copy, Trash2, Lock, Play, WifiOff, X } from 'lucide-react';
import { from } from '@/services/postgrest';
import { useAuthStore } from '@/stores/authStore';
import { useToast, ToastContainer } from '@/components/ui';
import { useBackendStatus } from '@/hooks';
import { cn } from '@/lib/utils';
import RuleFormModal, { ruleToForm, formToInput, type FormMode } from './RuleFormModal';
import { updateRule, softDeleteRule, createRule, type AstroRuleFull } from './ruleService';
import { runRuleDiscovery, fetchDiscoveryStatus, cancelDiscovery } from './discoveryService';

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
  const { data, error } = await from('km_rule_transits')
    .select('id,start_date,end_date,duration_days,nifty_return_pct,matched')
    .eq('rule_id', ruleId)
    .lte('end_date', new Date().toISOString().slice(0, 10))
    .order('start_date', { ascending: false })
    .limit(20)
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

function ConfidenceSummary({ conf }: { conf: RuleConfidence }) {
  const cards = [
    {
      label: 'Historical Transits',
      value: conf.historical_transits != null ? String(conf.historical_transits) : '—',
      color: 'text-secondary',
    },
    {
      label: 'Matched',
      value: conf.matched_count != null && conf.total_occurrences != null
        ? `${conf.matched_count}/${conf.total_occurrences}`
        : conf.matched_count != null ? String(conf.matched_count) : '—',
      color: 'text-secondary',
    },
    {
      label: 'Confidence Score',
      value: conf.confidence_score != null ? `${conf.confidence_score.toFixed(1)}%` : '—',
      color: confidenceColor(conf.confidence_score),
    },
    {
      label: 'Avg Return',
      value: fmtPct(conf.avg_return_all),
      color: returnColor(conf.avg_return_all),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map(({ label, value, color }) => (
          <div key={label} className="flex flex-col items-center justify-center gap-1 py-4 rounded-xl border border-kd-border bg-kd-elevated/40 text-center">
            <span className={cn('text-2xl font-semibold tabular-nums', color)}>{value}</span>
            <span className="text-[11px] text-muted font-mono">{label}</span>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-kd-border bg-kd-elevated/20 px-4 py-3 space-y-3">
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Avg when matched', value: fmtPct(conf.avg_return_matched), color: returnColor(conf.avg_return_matched) },
            { label: 'Avg when not matched', value: fmtPct(conf.avg_return_unmatched), color: returnColor(conf.avg_return_unmatched) },
            { label: 'Avg duration', value: conf.avg_duration_days != null ? `${conf.avg_duration_days.toFixed(1)}d` : '—', color: 'text-secondary' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex flex-col items-center gap-0.5 text-center">
              <span className={cn('text-sm font-semibold tabular-nums', color)}>{value}</span>
              <span className="text-[10px] font-mono text-muted">{label}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4 pt-2 border-t border-kd-border/40">
          {[
            { label: 'Best transit', value: fmtPct(conf.best_return), color: returnColor(conf.best_return) },
            { label: 'Worst transit', value: fmtPct(conf.worst_return), color: returnColor(conf.worst_return) },
            { label: 'Total scored', value: conf.total_occurrences != null ? `${conf.total_occurrences} transits` : '—', color: 'text-muted' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex flex-col items-center gap-0.5 text-center">
              <span className={cn('text-sm font-semibold tabular-nums', color)}>{value}</span>
              <span className="text-[10px] font-mono text-muted">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function YearlyTable({ rows }: { rows: RuleConfidenceYearly[] }) {
  if (rows.length === 0) return null;
  const recent = rows.slice(0, 15);
  return (
    <div className="overflow-x-auto rounded-xl border border-kd-border">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-kd-border bg-kd-elevated/60">
            {['Year', 'Transits', 'Matched', 'Win%', 'Avg Return', 'Avg Days'].map(h => (
              <th key={h} className="text-left text-[11px] font-mono text-muted px-3 py-2.5 uppercase tracking-wider whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {recent.map(row => (
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
  );
}

function TransitTable({ transits, upcoming = false }: { transits: RuleTransit[]; upcoming?: boolean }) {
  if (transits.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-xl border border-kd-border">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-kd-border bg-kd-elevated/60">
            {['Start', 'End', 'Days', ...(upcoming ? [] : ['Return', 'Matched'])].map(h => (
              <th key={h} className="text-left text-[11px] font-mono text-muted px-3 py-2.5 uppercase tracking-wider whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {transits.map(t => (
            <tr key={t.id} className="border-b border-kd-border/40 hover:bg-kd-elevated/40 transition-colors">
              <td className="px-3 py-2 text-xs font-mono text-secondary whitespace-nowrap">{t.start_date}</td>
              <td className="px-3 py-2 text-xs font-mono text-secondary whitespace-nowrap">{t.end_date}</td>
              <td className="px-3 py-2 text-xs tabular-nums text-center text-muted">{t.duration_days}</td>
              {!upcoming && (
                <>
                  <td className="px-3 py-2 text-xs tabular-nums text-center">
                    <span className={returnColor(t.nifty_return_pct)}>{fmtPct(t.nifty_return_pct)}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-center">
                    <span className={t.matched === true ? 'text-risk-green' : t.matched === false ? 'text-risk-red/60' : 'text-muted'}>
                      {t.matched === true ? '✓' : t.matched === false ? '✗' : '—'}
                    </span>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UpcomingTransitCards({ transits }: { transits: RuleTransit[] }) {
  const shown = transits.slice(0, 3);
  if (shown.length === 0) {
    return <p className="text-xs text-muted px-1">No upcoming transits in data range</p>;
  }
  return (
    <div className="space-y-2">
      {shown.map(t => {
        const fmt = (iso: string) =>
          new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return (
          <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-kd-border bg-kd-elevated/40">
            <span className="text-sm font-mono text-secondary">{fmt(t.start_date)} – {fmt(t.end_date)}</span>
            <span className="text-xs text-muted">({t.duration_days} days)</span>
          </div>
        );
      })}
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
  // Track when a background discovery job is running for this page
  const [trackingDiscovery, setTrackingDiscovery] = useState(false);
  // Job ID of the discovery we started — used to avoid reacting to a stale cached status
  const [startedJobId, setStartedJobId] = useState<string | null>(null);
  // Signals pagination (0-indexed)
  const [signalsPage, setSignalsPage] = useState(0);

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
    const errors = discoveryStatus.errors.length;
    if (errors > 0) {
      toast('error', `Discovery finished with ${errors} error(s)`);
    } else {
      toast('success', `Discovery complete — ${inserted.toLocaleString()} signals inserted`);
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
              <h1 className="text-base font-semibold text-white leading-snug mt-1">{rule.display_name}</h1>
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
        <section>
          <h2 className="text-sm font-medium text-secondary mb-2">
            Backtesting
            {conf?.last_computed_at && (
              <span className="ml-2 text-[11px] font-mono text-muted font-normal">
                as of {conf.last_computed_at.slice(0, 10)}
              </span>
            )}
          </h2>
          {conf?.confidence_score != null ? (
            <ConfidenceSummary conf={conf} />
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

        {/* Year-by-year breakdown */}
        {yearlyConf.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-secondary mb-2">
              Year-by-Year
              <span className="ml-2 text-[11px] font-mono text-muted font-normal">last {Math.min(yearlyConf.length, 15)} years</span>
            </h2>
            <YearlyTable rows={yearlyConf} />
          </section>
        )}

        {/* Transit History */}
        <section>
          <h2 className="text-sm font-medium text-secondary mb-2">Historical Transits (last 20)</h2>
          {transits.length > 0 ? (
            <TransitTable transits={transits} />
          ) : (
            <div className="flex items-center justify-center h-20 rounded-xl border border-kd-border bg-kd-elevated/30 text-muted text-sm">
              No transits recorded — run discovery to populate
            </div>
          )}
        </section>

        {/* Upcoming transits */}
        <section>
          <h2 className="text-sm font-medium text-secondary mb-2">Upcoming</h2>
          <UpcomingTransitCards transits={upcomingTransits} />
        </section>

        {/* Historical occurrences (signals) */}
        <section>
          {(() => {
            const { rows: signals, total: signalsTotal } = signalsData;
            const totalPages = Math.ceil(signalsTotal / PAGE_SIZE);
            const startItem = signalsTotal === 0 ? 0 : signalsPage * PAGE_SIZE + 1;
            const endItem = Math.min((signalsPage + 1) * PAGE_SIZE, signalsTotal);

            return (
              <>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-medium text-secondary">Historical Occurrences</h2>
                  {signalsTotal > 0 && (
                    <span className="text-[11px] font-mono text-muted">
                      Showing {startItem.toLocaleString()}–{endItem.toLocaleString()} of {signalsTotal.toLocaleString()}
                    </span>
                  )}
                </div>

                {signals.length === 0 && signalsTotal === 0 ? (
                  <div className="flex items-center justify-center h-24 rounded-xl border border-kd-border bg-kd-elevated/30 text-muted text-sm">
                    No signals recorded — run rule discovery to populate
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="overflow-x-auto rounded-xl border border-kd-border">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="border-b border-kd-border bg-kd-elevated/60">
                            {['Date', 'Signal', 'Strength', 'Details', 'Matched'].map(h => (
                              <th key={h} className="text-left text-[11px] font-mono text-muted px-3 py-2.5 uppercase tracking-wider whitespace-nowrap">
                                {h}
                              </th>
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
                      <div className="flex items-center justify-between px-1">
                        <button
                          onClick={() => setSignalsPage(p => p - 1)}
                          disabled={signalsPage === 0}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs text-muted border border-kd-border rounded-lg hover:text-secondary hover:border-kd-border-active transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" /> Prev
                        </button>
                        <span className="text-[11px] font-mono text-muted">
                          Page {signalsPage + 1} of {totalPages}
                        </span>
                        <button
                          onClick={() => setSignalsPage(p => p + 1)}
                          disabled={signalsPage >= totalPages - 1}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs text-muted border border-kd-border rounded-lg hover:text-secondary hover:border-kd-border-active transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          Next <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            );
          })()}
        </section>

        {/* Upcoming signals */}
        <section>
          <h2 className="text-sm font-medium text-secondary mb-2">Upcoming Signals</h2>
          {upcomingSignals.length === 0 ? (
            <p className="text-xs text-muted px-1">No upcoming signals in data range</p>
          ) : (
            <div className="space-y-1">
              <p className="text-xs text-secondary px-1">
                Next occurrence:{' '}
                <span className="text-accent-indigo font-mono">
                  {new Date(upcomingSignals[0].date + 'T00:00:00').toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </span>
              </p>
              {upcomingSignals.length > 1 && (
                <p className="text-[11px] font-mono text-muted px-1">
                  +{upcomingSignals.length - 1} more within range:{' '}
                  {upcomingSignals.slice(1).map(s => s.date).join(', ')}
                </p>
              )}
            </div>
          )}
        </section>
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
