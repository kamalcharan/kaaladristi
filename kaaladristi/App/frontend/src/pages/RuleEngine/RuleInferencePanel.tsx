/**
 * RuleInferencePanel — theory-vs-evidence read-only display (migration 134)
 * =============================================================================
 * "Expected" (authored — manual or VaNi-drafted) next to "Evidence"
 * (computed — km_rule_confidence for single-rule rows, the correlation
 * engine for pair/combination rows). Viewing is open to everyone on
 * /rules/:id. Authoring lives in RuleInferenceModal (opened from the
 * "Rule Inference" header button) — this component only renders results.
 */

import { useQuery } from '@tanstack/react-query';

const PIPELINE_API = import.meta.env.VITE_PIPELINE_API_URL ?? '';

type MarketImpact = 'bullish' | 'bearish' | 'volatile' | 'neutral' | 'mixed';
// Same vocabulary as RuleEvalView.tsx's OUTCOME_STYLES/OUTCOME_ORDER
// (evaluate_dc_inferences) — one outcome vocabulary across the platform.
type Outcome = 'worked' | 'partial' | 'failed' | 'running' | 'turned' | 'inconclusive' | 'pending';

interface InferenceRow {
  id: number;
  rule_a_id: number;
  rule_b_id: number | null;
  inference_text: string;
  market_impact: MarketImpact | null;
  source: 'manual' | 'ai_generated';
  confidence_tier_live: string;
  outcome: Outcome;
  evidence: { n: number; bullish_count?: number; bearish_count?: number; currently_active?: boolean };
  pair_rule_label?: string;
  created_at: string;
  status?: 'active' | 'superseded';
}

const OUTCOME_LABEL: Record<Outcome, { label: string; color: string }> = {
  worked:       { label: '✓ Worked',     color: 'var(--risk-green)' },
  partial:      { label: '◐ Partial',    color: 'var(--risk-amber)' },
  failed:       { label: '✗ Failed',     color: 'var(--risk-red)' },
  running:      { label: '● Running',    color: 'var(--risk-amber)' },
  turned:       { label: '↻ Turned',     color: 'var(--accent-cyan)' },
  inconclusive: { label: '— No Signal',  color: 'var(--text-faint)' },
  pending:      { label: '◦ Pending',    color: 'var(--accent-indigo)' },
};

const TIER_COLOR: Record<string, string> = {
  VALIDATED:   'var(--risk-green)',
  INDICATIVE:  'var(--risk-amber)',
  UNVALIDATED: 'var(--text-faint)',
};

async function fetchInference(ruleId: number): Promise<InferenceRow[]> {
  const res = await fetch(`${PIPELINE_API}/api/rules/${ruleId}/inference`);
  if (!res.ok) throw new Error(`inference ${res.status}`);
  const data = await res.json();
  const rows: InferenceRow[] = Array.isArray(data?.inferences) ? data.inferences : [];
  // The Patterns tab shows only the hypothesis of record — superseded
  // history lives in the Rule Inference drawer, not here.
  return rows.filter(r => r.status !== 'superseded');
}

export default function RuleInferencePanel({ ruleId }: { ruleId: number }) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['rule-inference', ruleId],
    queryFn: () => fetchInference(ruleId),
    enabled: !isNaN(ruleId),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading || rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-kd-border bg-kd-elevated/40 p-3 space-y-2.5">
      <span className="text-[10px] font-mono uppercase tracking-wider text-muted">
        Expected vs Evidence
      </span>

      {rows.map(row => {
        const outcome = OUTCOME_LABEL[row.outcome];
        const tierColor = TIER_COLOR[row.confidence_tier_live] ?? TIER_COLOR.UNVALIDATED;
        return (
          <div key={row.id} className="rounded-lg border border-kd-border/60 p-2.5 space-y-1.5">
            <p className="text-xs text-white leading-relaxed">
              {row.inference_text}
              {row.pair_rule_label && (
                <span className="text-muted"> — combined with <strong>{row.pair_rule_label}</strong></span>
              )}
            </p>
            <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono">
              {row.market_impact && (
                <span className="px-1.5 py-0.5 rounded border border-kd-border text-muted">
                  expected: {row.market_impact}
                </span>
              )}
              <span style={{ color: outcome.color }}>{outcome.label}</span>
              <span style={{ color: tierColor }}>{row.confidence_tier_live}</span>
              <span className="text-muted">
                n={row.evidence.n}
                {row.evidence.currently_active ? ' · active now' : ''}
              </span>
              <span className="text-muted ml-auto">
                {row.source === 'ai_generated' ? '✦ VaNi draft' : 'manual'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
