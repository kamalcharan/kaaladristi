import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2, AlertCircle } from 'lucide-react';
import { from } from '@/services/postgrest';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

interface AstroRuleFull {
  id: number;
  rule_code: string;
  rule_type: string;
  display_name: string;
  outcome: string | null;
  base_bias: string | null;
  scope: string[] | null;
  probability_label: string | null;
  probability: string | null;
  data_source: string | null;
  remarks: string | null;
  conditions: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

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
  conditions_snapshot: Record<string, unknown> | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const OUTCOME_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  bullish:  { bg: 'bg-risk-green/15',    text: 'text-risk-green',    border: 'border-risk-green/30'   },
  bearish:  { bg: 'bg-risk-red/15',      text: 'text-risk-red',      border: 'border-risk-red/30'     },
  volatile: { bg: 'bg-risk-amber/15',    text: 'text-risk-amber',    border: 'border-risk-amber/30'   },
  turning:  { bg: 'bg-accent-indigo/12', text: 'text-accent-indigo', border: 'border-accent-indigo/30'},
  neutral:  { bg: 'bg-kd-elevated',      text: 'text-secondary',     border: 'border-kd-border'       },
};

const RULE_TYPE_LABELS: Record<string, string> = {
  nakshatra_vara: 'Nakshatra·Vara',
  planet_transit: 'Planet Transit',
  planet_state: 'Planet State',
  planet_conjunction: 'Conjunction',
  planet_manifestation: 'Manifestation',
  compound: 'Compound',
  tithi_alone: 'Tithi',
  eclipse: 'Eclipse',
  vedh: 'Vedh',
  moon_position: 'Moon Position',
  tithi_vara: 'Tithi·Vara',
  tithi_nakshatra: 'Tithi·Nakshatra',
  planet_speed: 'Planet Speed',
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
    .select('id,date,signal,strength,details,matched,conditions_snapshot')
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
          <span
            key={s}
            className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] border border-kd-border bg-kd-elevated text-secondary font-mono"
          >
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
    {
      label: 'Occurrences',
      value: conf?.total_occurrences ?? null,
      fmt: (v: number) => v.toLocaleString(),
      color: 'text-secondary',
    },
    {
      label: 'Matched',
      value: conf?.matched_count ?? null,
      fmt: (v: number) => v.toLocaleString(),
      color: 'text-secondary',
    },
    {
      label: 'Confidence',
      value: conf?.confidence_score ?? null,
      fmt: (v: number) => {
        const pct = Math.round(v * 100);
        return `${pct}%`;
      },
      color: (v: number | null) => {
        if (v == null) return 'text-muted';
        const pct = Math.round(v * 100);
        return pct >= 65 ? 'text-risk-green' : pct >= 45 ? 'text-risk-amber' : 'text-risk-red/70';
      },
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map(({ label, value, fmt, color }) => {
        const textColor = typeof color === 'function' ? color(value as number | null) : color;
        return (
          <div
            key={label}
            className="flex flex-col items-center justify-center gap-1 py-4 rounded-xl border border-kd-border bg-kd-elevated/40 text-center"
          >
            <span className={cn('text-2xl font-semibold tabular-nums', textColor)}>
              {value != null ? fmt(value as number) : '—'}
            </span>
            <span className="text-[11px] text-muted font-mono">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function SignalRow({ sig }: { sig: RuleSignal }) {
  const matchedColor =
    sig.matched === true  ? 'text-risk-green' :
    sig.matched === false ? 'text-risk-red/60' :
    'text-muted';

  return (
    <tr className="border-b border-kd-border/40 hover:bg-kd-elevated/40 transition-colors">
      <td className="px-3 py-2 text-xs font-mono text-secondary whitespace-nowrap">{sig.date}</td>
      <td className="px-3 py-2 text-xs text-secondary capitalize">{sig.signal ?? '—'}</td>
      <td className="px-3 py-2 text-xs tabular-nums text-center">
        {sig.strength != null ? (
          <span className="text-risk-amber">{sig.strength}</span>
        ) : '—'}
      </td>
      <td className="px-3 py-2 text-xs text-muted max-w-[260px] truncate">{sig.details ?? '—'}</td>
      <td className="px-3 py-2 text-xs text-center">
        <span className={matchedColor}>
          {sig.matched === true ? '✓' : sig.matched === false ? '✗' : '—'}
        </span>
      </td>
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RuleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const ruleId = Number(id);

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
        <AlertCircle className="w-4 h-4" />
        {(error as Error)?.message ?? 'Rule not found'}
      </div>
    );
  }

  const outcome = effectiveOutcome(rule);

  return (
    <div className="space-y-5">
      {/* Back */}
      <button
        onClick={() => navigate('/rules')}
        className="flex items-center gap-1.5 text-sm text-muted hover:text-secondary transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Rule Engine
      </button>

      {/* Header card */}
      <div className="rounded-xl border border-kd-border bg-kd-card p-5 space-y-4">
        {/* Top row */}
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
            <h1 className="text-base font-semibold text-white leading-snug mt-1">
              {rule.display_name}
            </h1>
          </div>
          <OutcomeBadge outcome={outcome} />
        </div>

        {/* Metadata grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-kd-border/40">
          <div>
            <p className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1">Probability</p>
            <p className="text-sm text-secondary">{rule.probability_label ?? rule.probability ?? '—'}</p>
          </div>
          <div>
            <p className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1">Data Source</p>
            <span className={cn(
              'inline-flex items-center gap-1 text-sm',
              rule.data_source !== 'unavailable' ? 'text-risk-green/70' : 'text-muted'
            )}>
              <span className={cn(
                'w-1.5 h-1.5 rounded-full',
                rule.data_source !== 'unavailable' ? 'bg-risk-green/70' : 'bg-kd-border'
              )} />
              {rule.data_source ?? '—'}
            </span>
          </div>
          <div className="col-span-2">
            <p className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1">Scope</p>
            <ScopeChips scope={rule.scope} />
          </div>
        </div>

        {/* Remarks */}
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
            <span className="ml-2 text-[11px] font-mono text-muted font-normal">
              last {signals.length}
            </span>
          )}
        </h2>
        {signals.length === 0 ? (
          <div className="flex items-center justify-center h-24 rounded-xl border border-kd-border bg-kd-elevated/30 text-muted text-sm gap-2">
            No signals recorded — run rule discovery to populate
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-kd-border">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-kd-border bg-kd-elevated/60">
                  {['Date', 'Signal', 'Strength', 'Details', 'Matched'].map(h => (
                    <th
                      key={h}
                      className="text-left text-[11px] font-mono text-muted px-3 py-2.5 uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {signals.map(sig => (
                  <SignalRow key={sig.id} sig={sig} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
