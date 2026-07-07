/**
 * RuleInferencePanel — theory-vs-evidence layer (migration 134)
 * =================================================================
 * "Expected" (authored — manual or VaNi-drafted) next to "Evidence"
 * (computed — km_rule_confidence for single-rule rows, the correlation
 * engine for pair/combination rows). Owner directive 2026-07-07: scope
 * is single-rule OR a pair of two rules (Saturn x Mercury style), not a
 * new stats pipeline — this reuses what already exists.
 *
 * Viewing is open to everyone on /rules/:id; authoring (add/generate/
 * delete) is admin-only, same convention as PatternStudyButton.
 */

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Trash2, Plus } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';

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
  confidence_tier: string;
  confidence_tier_live: string;
  outcome: Outcome;
  evidence: { n: number; bullish_count?: number; bearish_count?: number; currently_active?: boolean };
  pair_rule_code?: string;
  pair_rule_label?: string;
  created_at: string;
}

const IMPACT_OPTIONS: MarketImpact[] = ['bullish', 'bearish', 'volatile', 'neutral', 'mixed'];

const OUTCOME_LABEL: Record<Outcome, { label: string; color: string }> = {
  worked:       { label: '✓ Worked',    color: 'var(--risk-green)' },
  partial:      { label: '◐ Partial',   color: 'var(--risk-amber)' },
  failed:       { label: '✗ Failed',    color: 'var(--risk-red)' },
  running:      { label: '● Running',  color: 'var(--risk-amber)' },
  turned:       { label: '↻ Turned',   color: 'var(--accent-cyan)' },
  inconclusive: { label: '— No Signal', color: 'var(--text-faint)' },
  pending:      { label: '◦ Pending',   color: 'var(--accent-indigo)' },
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
  return data.inferences ?? [];
}

export default function RuleInferencePanel({ ruleId, autoOpen }: { ruleId: number; autoOpen?: boolean }) {
  const qc = useQueryClient();
  const { isAdmin } = useAuthStore();
  const [formOpen, setFormOpen] = useState(!!autoOpen);
  const [text, setText] = useState('');
  const [impact, setImpact] = useState<MarketImpact | ''>('');
  const [pairRuleId, setPairRuleId] = useState('');
  const [source, setSource] = useState<'manual' | 'ai_generated'>('manual');
  const [generating, setGenerating] = useState(false);
  const [genLlm, setGenLlm] = useState<'qwen' | 'claude'>('qwen');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['rule-inference', ruleId],
    queryFn: () => fetchInference(ruleId),
    enabled: !isNaN(ruleId),
    staleTime: 5 * 60 * 1000,
  });

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`${PIPELINE_API}/api/rules/${ruleId}/inference/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          llm: genLlm,
          pair_rule_id: pairRuleId ? Number(pairRuleId) : null,
        }),
      });
      if (!res.ok) throw new Error(`generate ${res.status}`);
      const draft = await res.json();
      setText(draft.inference_text ?? '');
      setImpact((draft.market_impact ?? '') as MarketImpact | '');
      setSource('ai_generated');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'generation failed');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!text.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${PIPELINE_API}/api/rules/${ruleId}/inference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inference_text: text.trim(),
          market_impact: impact || null,
          pair_rule_id: pairRuleId ? Number(pairRuleId) : null,
          source,
        }),
      });
      if (!res.ok) throw new Error(`save ${res.status}`);
      setText(''); setImpact(''); setPairRuleId(''); setSource('manual'); setFormOpen(false);
      qc.invalidateQueries({ queryKey: ['rule-inference', ruleId] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    await fetch(`${PIPELINE_API}/api/rules/inference/${id}`, { method: 'DELETE' });
    qc.invalidateQueries({ queryKey: ['rule-inference', ruleId] });
  }

  if (isLoading) return null;
  if (rows.length === 0 && !isAdmin) return null;

  return (
    <div className="rounded-xl border border-kd-border bg-kd-elevated/40 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted">
          Expected vs Evidence
        </span>
        {isAdmin && (
          <button
            onClick={() => setFormOpen(v => !v)}
            className="flex items-center gap-1 text-[10px] font-mono text-accent-gold hover:text-accent-gold/80"
          >
            <Plus size={11} /> Add inference
          </button>
        )}
      </div>

      {rows.length === 0 && (
        <p className="text-xs text-muted italic">
          No expert inference recorded for this rule yet.
        </p>
      )}

      {rows.map(row => {
        const outcome = OUTCOME_LABEL[row.outcome];
        const tierColor = TIER_COLOR[row.confidence_tier_live] ?? TIER_COLOR.UNVALIDATED;
        return (
          <div key={row.id} className="rounded-lg border border-kd-border/60 p-2.5 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-white leading-relaxed flex-1">
                {row.inference_text}
                {row.pair_rule_label && (
                  <span className="text-muted"> — combined with <strong>{row.pair_rule_label}</strong></span>
                )}
              </p>
              {isAdmin && (
                <button onClick={() => handleDelete(row.id)} className="text-muted hover:text-risk-red shrink-0">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
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

      {isAdmin && formOpen && (
        <div className="rounded-lg border border-accent-gold/30 bg-accent-gold/5 p-2.5 space-y-2">
          <div className="flex items-center gap-2">
            <input
              value={pairRuleId}
              onChange={e => setPairRuleId(e.target.value)}
              placeholder="pair rule id (optional — combination)"
              className="flex-1 bg-kd-elevated border border-kd-border rounded px-2 py-1 text-[11px] text-white font-mono"
            />
            <select
              value={genLlm}
              onChange={e => setGenLlm(e.target.value as 'qwen' | 'claude')}
              className="bg-kd-elevated border border-kd-border rounded px-2 py-1 text-[11px] text-white font-mono"
            >
              <option value="qwen">Qwen (free)</option>
              <option value="claude">Sonnet</option>
            </select>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1 px-2 py-1 rounded border border-accent-gold/40 text-[11px] text-accent-gold disabled:opacity-50"
            >
              <Sparkles size={11} className={cn(generating && 'animate-pulse')} />
              {generating ? 'Drafting…' : 'Generate with VaNi'}
            </button>
          </div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Expected behavior — what should this rule (or combination) mean for the market?"
            rows={3}
            className="w-full bg-kd-elevated border border-kd-border rounded px-2 py-1.5 text-xs text-white"
          />
          <div className="flex items-center gap-2">
            <select
              value={impact}
              onChange={e => setImpact(e.target.value as MarketImpact)}
              className="bg-kd-elevated border border-kd-border rounded px-2 py-1 text-[11px] text-white font-mono"
            >
              <option value="">expected direction…</option>
              {IMPACT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <button
              onClick={handleSave}
              disabled={saving || !text.trim()}
              className="ml-auto px-3 py-1 rounded bg-accent-gold/20 border border-accent-gold/40 text-[11px] text-accent-gold disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
          {error && <p className="text-[10px] text-risk-red">{error}</p>}
        </div>
      )}
    </div>
  );
}
