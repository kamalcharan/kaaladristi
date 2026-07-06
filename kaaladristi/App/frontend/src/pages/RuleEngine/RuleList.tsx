import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, AlertCircle, Database, Plus, Lock } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/components/ui';
import { ToastContainer } from '@/components/ui';
import { cn } from '@/lib/utils';
import PatternStudyButton from './PatternStudyButton';
import RuleFormModal, { emptyForm, type FormMode } from './RuleFormModal';
import { createRule, toggleRuleActive, toggleCatalogVisible, fetchRules, fetchConfidence, fetchTransitDates, type AstroRuleFull, type AstroRule, type RuleConfidence, type TransitDateInfo } from './ruleService';
import DiscoveryPanel from './DiscoveryPanel';
import { fetchSignalCounts } from './discoveryService';
import { IMPACT_OPTIONS, SIGNAL_LABELS } from '@/constants/signalScale';
import { TagChip } from '@/constants/ruleTagColors';

// ── Constants ────────────────────────────────────────────────────────────────

export const RULE_TYPE_LABELS: Record<string, string> = {
  nakshatra_vara:       'Nak·Vara',
  planet_transit:       'Transit',
  planet_state:         'P·State',
  planet_conjunction:   'Conjunct',
  planet_manifestation: 'Manifest',
  compound:             'Compound',
  tithi_alone:          'Tithi',
  eclipse:              'Eclipse',
  vedh:                 'Vedh',
  moon_position:        'Moon',
  tithi_vara:           'T·Vara',
  tithi_nakshatra:      'T·Nak',
  planet_speed:         'Speed',
};

const OUTCOME_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  strong_bullish: { bg: 'bg-risk-green/20',    text: 'text-risk-green',    border: 'border-risk-green/40'    },
  bullish:        { bg: 'bg-risk-green/15',    text: 'text-risk-green',    border: 'border-risk-green/30'    },
  mild_bullish:   { bg: 'bg-risk-green/8',     text: 'text-risk-green/70', border: 'border-risk-green/20'    },
  neutral:        { bg: 'bg-kd-elevated',      text: 'text-secondary',     border: 'border-kd-border'        },
  turning:        { bg: 'bg-risk-amber/12',    text: 'text-risk-amber',    border: 'border-risk-amber/30'    },
  mild_bearish:   { bg: 'bg-risk-red/8',       text: 'text-risk-red/70',   border: 'border-risk-red/20'      },
  bearish:        { bg: 'bg-risk-red/15',      text: 'text-risk-red',      border: 'border-risk-red/30'      },
  strong_bearish: { bg: 'bg-risk-red/20',      text: 'text-risk-red',      border: 'border-risk-red/40'      },
  volatile:       { bg: 'bg-risk-amber/15',    text: 'text-risk-amber',    border: 'border-risk-amber/30'    },
};

// Prefix symbols for each outcome (shown in filter dropdown + badge)
const OUTCOME_PREFIX: Record<string, string> = {
  strong_bullish: '▲▲',
  bullish:        '▲',
  mild_bullish:   '△',
  neutral:        '·',
  turning:        '◈',
  mild_bearish:   '▽',
  bearish:        '▼',
  strong_bearish: '▼▼',
  volatile:       '⚡',
};

// All outcome values in display order (calendar 8 + volatile for rule-engine)
const ALL_OUTCOMES = [...IMPACT_OPTIONS, 'volatile'] as const;

function outcomeLabel(outcome: string): string {
  return SIGNAL_LABELS[outcome] ?? (outcome.charAt(0).toUpperCase() + outcome.slice(1));
}

// Confidence score bands
const CONFIDENCE_BANDS = [
  { value: '',        label: 'All Confidence' },
  { value: '76-100',  label: '76 – 100  Strong' },
  { value: '51-75',   label: '51 – 75   Moderate' },
  { value: '26-50',   label: '26 – 50   Weak' },
  { value: '0-25',    label: '0 – 25    Inverse?' },
  { value: 'unscored',label: 'Not Scored' },
] as const;

export const PROB_STYLES: Record<string, string> = {
  'Very High': 'text-risk-green',
  'High':      'text-risk-green/70',
  'Reasonable':'text-risk-amber',
  'Low':       'text-muted',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function fmtTransitDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1]} '${y.slice(2)}`;
}

function effectiveOutcome(rule: AstroRule): string {
  return rule.outcome || rule.base_bias || 'neutral';
}

export function OutcomeBadge({ outcome }: { outcome: string }) {
  const s = OUTCOME_STYLES[outcome] ?? OUTCOME_STYLES.neutral;
  const prefix = OUTCOME_PREFIX[outcome];
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border', s.bg, s.text, s.border)}>
      {prefix && <span className="opacity-70 text-[9px]">{prefix}</span>}
      {outcomeLabel(outcome)}
    </span>
  );
}

export function TypeChip({ ruleType }: { ruleType: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono border border-kd-border bg-kd-elevated text-muted">
      {RULE_TYPE_LABELS[ruleType] ?? ruleType}
    </span>
  );
}

export function ConfidenceCell({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-muted text-xs font-mono">Not scored</span>;
  // score is already 0-100 (confidence_score column)
  const pct = Math.round(score);
  const { label, color } =
    pct >= 70 ? { label: 'Strong',   color: 'text-risk-green' }
    : pct >= 60 ? { label: 'Moderate', color: 'text-risk-amber' }
    : pct >= 50 ? { label: 'Weak',     color: 'text-yellow-400' }
    :             { label: 'Inverse?', color: 'text-risk-red/80' };
  return (
    <span className={cn('text-xs font-mono tabular-nums', color)}>
      {pct}% <span className="opacity-60">{label}</span>
    </span>
  );
}

function SignalsBadge({ count, isUnavailable }: { count: number | undefined; isUnavailable: boolean }) {
  if (isUnavailable) return <span className="text-muted text-xs font-mono">N/A</span>;
  if (count === undefined) return <span className="text-muted text-xs">—</span>;
  const style = count === 0
    ? 'bg-kd-elevated text-muted border-kd-border'
    : count >= 100
    ? 'bg-risk-green/15 text-risk-green border-risk-green/30'
    : 'bg-risk-amber/15 text-risk-amber border-risk-amber/30';
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono border tabular-nums', style)}>
      {count.toLocaleString()}
    </span>
  );
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

function ActiveToggle({
  ruleId,
  isActive,
  onToggle,
}: {
  ruleId: number;
  isActive: boolean;
  onToggle: (id: number, next: boolean) => void;
}) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onToggle(ruleId, !isActive); }}
      title={isActive ? 'Deactivate rule' : 'Activate rule'}
      className={cn(
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none shrink-0',
        isActive ? 'bg-risk-green/60' : 'bg-kd-border',
      )}
    >
      <span
        className={cn(
          'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
          isActive ? 'translate-x-4' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────

interface Filters {
  search: string;
  ruleType: string;
  outcome: string;
  probability: string;
  dataSource: string;
  confidenceRange: string;
  tag: string;
  catalogVisible: string; // '' | 'yes' | 'no'
}

const EMPTY_FILTERS: Filters = {
  search: '', ruleType: '', outcome: '', probability: '',
  dataSource: '', confidenceRange: '', tag: '', catalogVisible: '',
};

function FilterBar({ filters, onChange, allTags }: {
  filters: Filters;
  onChange: (f: Filters) => void;
  allTags: string[];
}) {
  const set = (key: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...filters, [key]: e.target.value });

  const selStyle: React.CSSProperties = {
    background: 'var(--kd-elevated, #0f1626)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    color: 'var(--text-secondary)',
    fontSize: '12px',
    padding: '6px 10px',
    outline: 'none',
    minWidth: '120px',
  };

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
        <input
          type="text"
          placeholder="Search rules…"
          value={filters.search}
          onChange={set('search')}
          className="pl-8 pr-3 py-1.5 text-sm bg-kd-elevated border border-kd-border rounded-lg text-secondary placeholder:text-muted focus:outline-none focus:border-kd-border-active transition-colors"
          style={{ minWidth: '200px' }}
        />
      </div>
      <select value={filters.ruleType} onChange={set('ruleType')} style={selStyle}>
        <option value="">All Types</option>
        {Object.entries(RULE_TYPE_LABELS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
      <select value={filters.tag} onChange={set('tag')} style={selStyle}>
        <option value="">All Tags</option>
        {allTags.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <select value={filters.outcome} onChange={set('outcome')} style={selStyle}>
        <option value="">All Outcomes</option>
        {ALL_OUTCOMES.map(o => (
          <option key={o} value={o}>
            {(OUTCOME_PREFIX[o] ?? '')} {outcomeLabel(o)}
          </option>
        ))}
      </select>
      <select value={filters.probability} onChange={set('probability')} style={selStyle}>
        <option value="">All Probabilities</option>
        {['Very High', 'High', 'Reasonable', 'Low'].map(p => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      <select value={filters.confidenceRange} onChange={set('confidenceRange')} style={selStyle}>
        {CONFIDENCE_BANDS.map(b => (
          <option key={b.value} value={b.value}>{b.label}</option>
        ))}
      </select>
      <select value={filters.dataSource} onChange={set('dataSource')} style={selStyle}>
        <option value="">All Sources</option>
        <option value="available">Available</option>
        <option value="unavailable">Unavailable</option>
        <option value="user_defined">User Defined</option>
      </select>
      <select value={filters.catalogVisible} onChange={set('catalogVisible')} style={{ ...selStyle, minWidth: '130px' }}>
        <option value="">Catalog: All</option>
        <option value="yes">Catalog: Visible</option>
        <option value="no">Catalog: Hidden</option>
      </select>
      {Object.values(filters).some(v => v !== '') && (
        <button
          onClick={() => onChange(EMPTY_FILTERS)}
          className="text-xs text-muted hover:text-secondary transition-colors px-2 py-1.5 rounded border border-kd-border hover:border-kd-border-active"
        >
          Clear
        </button>
      )}
    </div>
  );
}

// ── Stats bar ─────────────────────────────────────────────────────────────────

function StatsBar({ rules }: { rules: AstroRule[] }) {
  const counts = useMemo(() => {
    const out = { total: rules.length, bullish: 0, bearish: 0, volatile: 0, turning: 0 };
    for (const r of rules) {
      const o = effectiveOutcome(r);
      if (o === 'bullish') out.bullish++;
      else if (o === 'bearish') out.bearish++;
      else if (o === 'volatile') out.volatile++;
      else if (o === 'turning') out.turning++;
    }
    return out;
  }, [rules]);

  return (
    <div className="flex gap-5 flex-wrap">
      {[
        { label: 'Total',    value: counts.total,    color: 'text-secondary' },
        { label: 'Bullish',  value: counts.bullish,  color: 'text-risk-green' },
        { label: 'Bearish',  value: counts.bearish,  color: 'text-risk-red' },
        { label: 'Volatile', value: counts.volatile,  color: 'text-risk-amber' },
        { label: 'Turning',  value: counts.turning,  color: 'text-accent-indigo' },
      ].map(({ label, value, color }) => (
        <div key={label} className="flex flex-col">
          <span className={cn('text-xl font-semibold tabular-nums', color)}>{value}</span>
          <span className="text-[11px] text-muted font-mono">{label}</span>
        </div>
      ))}
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

export default function RuleList() {
  const navigate = useNavigate();
  const { isAdmin } = useAuthStore();
  const { toasts, toast, dismiss } = useToast();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<'rules' | 'discovery'>('rules');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [modalOpen, setModalOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: rules = [], isLoading, isError, error } = useQuery({
    queryKey: ['rule-engine', 'rules'],
    queryFn: fetchRules,
    staleTime: 5 * 60 * 1000,
  });

  const { data: confidence = [] } = useQuery({
    queryKey: ['rule-engine', 'confidence'],
    queryFn: fetchConfidence,
    staleTime: 10 * 60 * 1000,
  });

  const { data: signalCounts = [] } = useQuery({
    queryKey: ['rule-engine', 'signal-counts'],
    queryFn: fetchSignalCounts,
    staleTime: 60 * 1000,
  });

  const { data: transitDates = [] } = useQuery({
    queryKey: ['rule-engine', 'transit-dates'],
    queryFn: fetchTransitDates,
    staleTime: 5 * 60 * 1000,
  });

  const confMap = useMemo(() => {
    const m = new Map<number, RuleConfidence>();
    for (const c of confidence) m.set(c.rule_id, c);
    return m;
  }, [confidence]);

  const signalMap = useMemo(() => {
    const m = new Map<number, number>();
    for (const sc of signalCounts) m.set(sc.rule_id, sc.count);
    return m;
  }, [signalCounts]);

  const transitMap = useMemo(() => {
    const m = new Map<number, TransitDateInfo>();
    for (const t of transitDates) m.set(t.rule_id, t);
    return m;
  }, [transitDates]);

  // ── Create mutation ──
  const createMutation = useMutation({
    mutationFn: createRule,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rule-engine', 'rules'] });
      setModalOpen(false);
      setSaveError(null);
      toast('success', 'Rule created successfully');
    },
    onError: (err: Error) => {
      setSaveError(err.message);
      toast('error', err.message);
    },
  });

  // ── Toggle active mutation (optimistic) ──
  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      toggleRuleActive(id, isActive),
    onMutate: async ({ id, isActive }) => {
      await qc.cancelQueries({ queryKey: ['rule-engine', 'rules'] });
      const prev = qc.getQueryData<AstroRule[]>(['rule-engine', 'rules']);
      qc.setQueryData<AstroRule[]>(['rule-engine', 'rules'], old =>
        old?.map(r => r.id === id ? { ...r, is_active: isActive } : r) ?? []
      );
      return { prev };
    },
    onError: (err: Error, _vars, ctx) => {
      qc.setQueryData(['rule-engine', 'rules'], ctx?.prev);
      toast('error', `Toggle failed: ${err.message}`);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['rule-engine', 'rules'] });
    },
  });

  // ── Toggle catalog visibility mutation (optimistic) ──
  const toggleVisibleMutation = useMutation({
    mutationFn: ({ id, visible }: { id: number; visible: boolean }) =>
      toggleCatalogVisible(id, visible),
    onMutate: async ({ id, visible }) => {
      await qc.cancelQueries({ queryKey: ['rule-engine', 'rules'] });
      const prev = qc.getQueryData<AstroRule[]>(['rule-engine', 'rules']);
      qc.setQueryData<AstroRule[]>(['rule-engine', 'rules'], old =>
        old?.map(r => r.id === id ? { ...r, catalog_visible: visible } : r) ?? []
      );
      // Also invalidate the catalog query so CatalogAstroSection refreshes
      qc.invalidateQueries({ queryKey: ['rule-engine', 'catalog-rules'] });
      return { prev };
    },
    onError: (err: Error, _vars, ctx) => {
      qc.setQueryData(['rule-engine', 'rules'], ctx?.prev);
      toast('error', `Catalog visibility update failed: ${err.message}`);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['rule-engine', 'rules'] });
      qc.invalidateQueries({ queryKey: ['rule-engine', 'catalog-rules'] });
    },
  });

  const allTags = useMemo(
    () => Array.from(new Set(rules.flatMap(r => r.tags ?? []))).sort(),
    [rules],
  );

  const filtered = useMemo(() => {
    let list = rules;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(r =>
        r.display_name.toLowerCase().includes(q) || r.rule_code.toLowerCase().includes(q)
      );
    }
    if (filters.ruleType) list = list.filter(r => r.rule_type === filters.ruleType);
    if (filters.tag) list = list.filter(r => (r.tags ?? []).includes(filters.tag));
    if (filters.outcome)  list = list.filter(r => effectiveOutcome(r) === filters.outcome);
    if (filters.probability) list = list.filter(r => r.probability_label === filters.probability);
    if (filters.dataSource) list = list.filter(r => r.data_source === filters.dataSource);
    if (filters.catalogVisible === 'yes') list = list.filter(r => r.catalog_visible);
    if (filters.catalogVisible === 'no')  list = list.filter(r => !r.catalog_visible);
    if (filters.confidenceRange) {
      list = list.filter(r => {
        const score = confMap.get(r.id)?.confidence_score;
        if (filters.confidenceRange === 'unscored') return score == null;
        if (score == null) return false;
        const [lo, hi] = filters.confidenceRange.split('-').map(Number);
        return score >= lo && score <= hi;
      });
    }
    return list;
  }, [rules, filters, confMap]);

  if (!isAdmin) return <AdminGuard />;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 gap-2 text-muted text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading rules…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-48 gap-2 text-risk-red text-sm">
        <AlertCircle className="w-4 h-4" /> {(error as Error)?.message ?? 'Failed to load rules'}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <header className="pb-3 border-b border-kd-border/30 flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div>
              <h1 className="text-lg font-semibold text-white">Rules Engine</h1>
              <p className="text-xs text-muted mt-0.5">
                Vedic astro-market rules — click any rule to view detail &amp; occurrence history
              </p>
            </div>
            {activeTab === 'rules' && <StatsBar rules={filtered} />}
          </div>
          {activeTab === 'rules' && (
            <div className="flex items-start gap-2 shrink-0">
              <PatternStudyButton />
              <button
                onClick={() => { setSaveError(null); setModalOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-accent-indigo/20 border border-accent-indigo/40 rounded-xl text-accent-indigo hover:bg-accent-indigo/30 transition-all shrink-0"
              >
                <Plus className="w-4 h-4" /> Add Rule
              </button>
            </div>
          )}
        </header>

        {/* Tab switcher */}
        <div className="flex gap-0 border-b border-kd-border/50 -mt-2">
          {(['rules', 'discovery'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px capitalize',
                activeTab === tab
                  ? 'border-accent-indigo text-accent-indigo'
                  : 'border-transparent text-muted hover:text-secondary',
              )}
            >
              {tab === 'rules' ? 'Rules' : 'Discovery'}
            </button>
          ))}
        </div>

        {/* Rules tab */}
        {activeTab === 'rules' && (
          <>
            {/* Filters */}
            <FilterBar filters={filters} onChange={setFilters} allTags={allTags} />

            {/* Table */}
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted text-sm border border-kd-border rounded-xl bg-kd-elevated/30">
                <Database className="w-5 h-5 opacity-40" />
                {rules.length === 0 ? 'No rules in database' : 'No rules match the current filters'}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-kd-border">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-kd-border bg-kd-elevated/60">
                      {['Active', 'Code', 'Rule', 'Type', 'Outcome', 'Probability', 'Confidence', 'Last', 'Next', 'Signals', 'Source', 'Tags', 'Catalog'].map(h => (
                        <th key={h} className="text-left text-[11px] font-mono text-muted px-3 py-2.5 uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((rule, i) => {
                      const outcome = effectiveOutcome(rule);
                      const conf = confMap.get(rule.id);
                      const isAvailable = rule.data_source !== 'unavailable';
                      return (
                        <tr
                          key={rule.id}
                          onClick={() => navigate(`/rules/${rule.id}`)}
                          className={cn(
                            'border-b border-kd-border/50 cursor-pointer transition-colors',
                            i % 2 === 0 ? 'bg-transparent' : 'bg-kd-elevated/20',
                            'hover:bg-kd-elevated/60',
                            !rule.is_active && 'opacity-50',
                          )}
                        >
                          {/* Toggle */}
                          <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                            <ActiveToggle
                              ruleId={rule.id}
                              isActive={rule.is_active}
                              onToggle={(id, next) => toggleMutation.mutate({ id, isActive: next })}
                            />
                          </td>

                          {/* Code + catalog dot */}
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-accent-indigo/80 bg-accent-indigo/10 border border-accent-indigo/20 px-1.5 py-0.5 rounded">
                              <span
                                title={rule.catalog_visible ? 'Visible in Catalog' : 'Hidden from Catalog'}
                                className={cn(
                                  'w-1.5 h-1.5 rounded-full shrink-0',
                                  rule.catalog_visible ? 'bg-risk-green' : 'bg-kd-border',
                                )}
                              />
                              {rule.rule_code}
                            </span>
                          </td>

                          {/* Name */}
                          <td className="px-3 py-2.5 max-w-[260px]">
                            <span className="text-secondary leading-tight line-clamp-2">{rule.display_name}</span>
                          </td>

                          {/* Type */}
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <TypeChip ruleType={rule.rule_type} />
                          </td>

                          {/* Outcome */}
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <OutcomeBadge outcome={outcome} />
                          </td>

                          {/* Probability */}
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {rule.probability_label ? (
                              <span className={cn('text-xs', PROB_STYLES[rule.probability_label] ?? 'text-muted')}>
                                {rule.probability_label}
                              </span>
                            ) : <span className="text-muted text-xs">—</span>}
                          </td>

                          {/* Confidence */}
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <ConfidenceCell score={conf?.confidence_score} />
                          </td>

                          {/* Last transit */}
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className="text-xs font-mono text-muted tabular-nums">
                              {fmtTransitDate(transitMap.get(rule.id)?.last_end)}
                            </span>
                          </td>

                          {/* Next transit */}
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {(() => {
                              const next = transitMap.get(rule.id)?.next_start;
                              if (!next) return <span className="text-xs font-mono text-muted">—</span>;
                              const daysAway = Math.round((new Date(next).getTime() - Date.now()) / 86400000);
                              const urgent = daysAway <= 14;
                              return (
                                <span className={cn('text-xs font-mono tabular-nums', urgent ? 'text-risk-amber' : 'text-secondary')}>
                                  {fmtTransitDate(next)}
                                  {urgent && (
                                    <span className="ml-1 text-[10px] opacity-70">({daysAway}d)</span>
                                  )}
                                </span>
                              );
                            })()}
                          </td>

                          {/* Signals */}
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <SignalsBadge
                              count={signalMap.get(rule.id)}
                              isUnavailable={rule.data_source === 'unavailable'}
                            />
                          </td>

                          {/* Source */}
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className={cn('inline-flex items-center gap-1 text-[11px]', isAvailable ? 'text-risk-green/70' : 'text-muted')}>
                              <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', isAvailable ? 'bg-risk-green/70' : 'bg-kd-border')} />
                              {rule.data_source === 'user_defined' ? 'Custom' : isAvailable ? 'Available' : 'N/A'}
                            </span>
                          </td>

                          {/* Tags */}
                          <td className="px-3 py-2.5">
                            {rule.tags?.length > 0 ? (
                              <div className="flex items-center gap-1 flex-wrap">
                                {rule.tags.slice(0, 3).map(tag => (
                                  <TagChip key={tag} tag={tag} />
                                ))}
                                {rule.tags.length > 3 && (
                                  <span className="text-[10px] text-muted font-mono">+{rule.tags.length - 3}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted text-xs">—</span>
                            )}
                          </td>

                          {/* Catalog visibility toggle */}
                          <td className="px-3 py-2.5 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => toggleVisibleMutation.mutate({ id: rule.id, visible: !rule.catalog_visible })}
                              title={rule.catalog_visible ? 'Hide from Catalog' : 'Show in Catalog'}
                              className={cn(
                                'text-[11px] font-mono px-2 py-0.5 rounded border transition-colors',
                                rule.catalog_visible
                                  ? 'bg-risk-green/15 text-risk-green border-risk-green/30 hover:bg-risk-green/25'
                                  : 'bg-kd-elevated text-muted border-kd-border hover:border-kd-border-active hover:text-secondary',
                              )}
                            >
                              {rule.catalog_visible ? 'YES' : 'NO'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-[11px] text-muted text-right font-mono">
              {filtered.length} of {rules.length} rules
            </p>
          </>
        )}

        {/* Discovery tab */}
        {activeTab === 'discovery' && <DiscoveryPanel />}
      </div>

      {/* Add Rule Modal */}
      {modalOpen && (
        <RuleFormModal
          mode="add"
          initial={emptyForm()}
          onClose={() => { setModalOpen(false); setSaveError(null); }}
          onSave={input => createMutation.mutate(input)}
          isSaving={createMutation.isPending}
          saveError={saveError}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
