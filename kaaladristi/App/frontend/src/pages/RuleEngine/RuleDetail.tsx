import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2, AlertCircle, Pencil, Copy, Trash2, Lock, Play } from 'lucide-react';
import { from } from '@/services/postgrest';
import { useAuthStore } from '@/stores/authStore';
import { useToast, ToastContainer } from '@/components/ui';
import { cn } from '@/lib/utils';
import RuleFormModal, { ruleToForm, formToInput, type FormMode } from './RuleFormModal';
import { updateRule, softDeleteRule, createRule, type AstroRuleFull } from './ruleService';
import { runRuleDiscovery } from './discoveryService';

// ── Types ────────────────────────────────────────────────────────────────────

interface RuleConfidence {
  rule_id: number;
  total_occurrences: number | null;
  matched_count: number | null;
  confidence_score: number | null;
  last_computed_at: string | null;
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
    .select('rule_id,total_occurrences,matched_count,confidence_score,last_computed_at')
    .eq('rule_id', ruleId)
    .maybeSingle()
    .execute();
  if (error) throw new Error(error.message);
  return (data as unknown as RuleConfidence) ?? null;
}

async function fetchRuleSignals(ruleId: number): Promise<RuleSignal[]> {
  const { data, error } = await from('km_rule_signals')
    .select('id,date,signal,strength,details,matched')
    .eq('rule_id', ruleId)
    .order('date', { ascending: false })
    .limit(50)
    .execute();
  if (error) throw new Error(error.message);
  return (data as RuleSignal[]) ?? [];
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

function ConfidenceCards({ conf }: { conf: RuleConfidence | null }) {
  const items = [
    { label: 'Occurrences', value: conf?.total_occurrences ?? null, fmt: (v: number) => v.toLocaleString(), color: (_v: number | null) => 'text-secondary' },
    { label: 'Matched',     value: conf?.matched_count ?? null,     fmt: (v: number) => v.toLocaleString(), color: (_v: number | null) => 'text-secondary' },
    {
      label: 'Confidence',
      value: conf?.confidence_score ?? null,
      fmt:  (v: number) => `${Math.round(v * 100)}%`,
      color: (v: number | null) => {
        if (v == null) return 'text-muted';
        const pct = Math.round(v * 100);
        return pct >= 65 ? 'text-risk-green' : pct >= 45 ? 'text-risk-amber' : 'text-risk-red/70';
      },
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map(({ label, value, fmt, color }) => (
        <div key={label} className="flex flex-col items-center justify-center gap-1 py-4 rounded-xl border border-kd-border bg-kd-elevated/40 text-center">
          <span className={cn('text-2xl font-semibold tabular-nums', color(value as number | null))}>
            {value != null ? fmt(value as number) : '—'}
          </span>
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

  const { data: signals = [] } = useQuery({
    queryKey: ['rule-engine', 'signals', ruleId],
    queryFn: () => fetchRuleSignals(ruleId),
    enabled: !isNaN(ruleId),
    staleTime: 5 * 60 * 1000,
  });

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
    onSuccess: () => {
      toast('success', 'Discovery started for this rule');
      qc.invalidateQueries({ queryKey: ['rule-engine', 'signals', ruleId] });
      qc.invalidateQueries({ queryKey: ['rule-engine', 'signal-counts'] });
    },
    onError: (err: Error) => toast('error', err.message),
  });

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
        {/* Back + action buttons */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={() => navigate('/rules')}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-secondary transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Rule Engine
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Run Discovery */}
            <button
              onClick={() => discoverMutation.mutate()}
              disabled={discoverMutation.isPending}
              title="Run discovery for this rule only"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-risk-amber border border-risk-amber/30 bg-risk-amber/10 rounded-lg hover:bg-risk-amber/20 transition-all disabled:opacity-50"
            >
              {discoverMutation.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Play className="w-3.5 h-3.5" />}
              Run Discovery
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

        {/* Confidence */}
        <section>
          <h2 className="text-sm font-medium text-secondary mb-2">
            Backtesting
            {conf?.last_computed_at && (
              <span className="ml-2 text-[11px] font-mono text-muted font-normal">
                as of {conf.last_computed_at.slice(0, 10)}
              </span>
            )}
          </h2>
          <ConfidenceCards conf={conf} />
          {!conf && (
            <p className="text-xs text-muted text-center mt-2">
              Run <span className="font-mono">rule_discovery.py</span> to populate backtesting data
            </p>
          )}
        </section>

        {/* Occurrences */}
        <section>
          <h2 className="text-sm font-medium text-secondary mb-2">
            Recent Occurrences
            {signals.length > 0 && (
              <span className="ml-2 text-[11px] font-mono text-muted font-normal">last {signals.length}</span>
            )}
          </h2>
          {signals.length === 0 ? (
            <div className="flex items-center justify-center h-24 rounded-xl border border-kd-border bg-kd-elevated/30 text-muted text-sm">
              No signals recorded — run rule discovery to populate
            </div>
          ) : (
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
