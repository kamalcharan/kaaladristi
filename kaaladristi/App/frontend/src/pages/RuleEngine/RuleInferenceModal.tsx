/**
 * RuleInferenceModal — theory-vs-evidence authoring surface (migration 134)
 * =============================================================================
 * Opened by the "Rule Inference" button on /rules/:id (which REPLACED the old
 * "Edit" button — owner 2026-07-07). Same form chrome as /inference
 * (InferenceView.tsx FormModal): fixed backdrop, max-w-4xl panel, labeled
 * fields.
 *
 * Flow (owner spec):
 *   1. User clicks "Rule Inference" → this modal.
 *   2. Two options: "Manual" (user fills the form) or "AI Inference".
 *   3. AI Inference → pick Claude or Qwen (same picker as Custom Index
 *      Discover) → Generate → draft fills the same editable form.
 *   4. Review/edit → Save. Outcome vs evidence is computed server-side.
 *
 * Rule METADATA editing (rule_code/tags/base_bias — the old Edit form) is
 * reachable via the small footer link only; it no longer has a toolbar button.
 */

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Trash2, Sparkles, Loader2, PenLine, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

const PIPELINE_API = import.meta.env.VITE_PIPELINE_API_URL ?? '';

type MarketImpact = 'bullish' | 'bearish' | 'volatile' | 'neutral' | 'mixed';
type Outcome = 'worked' | 'partial' | 'failed' | 'running' | 'turned' | 'inconclusive' | 'pending';
type Llm = 'claude' | 'qwen';
type Mode = 'choose' | 'manual' | 'ai';

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
}

const IMPACT_OPTIONS: { value: MarketImpact; label: string; color: string }[] = [
  { value: 'bullish',  label: 'Bullish',  color: 'var(--risk-green)' },
  { value: 'bearish',  label: 'Bearish',  color: 'var(--risk-red)' },
  { value: 'volatile', label: 'Volatile', color: 'var(--risk-amber)' },
  { value: 'neutral',  label: 'Neutral',  color: 'var(--text-faint)' },
  { value: 'mixed',    label: 'Mixed',    color: 'var(--accent-violet)' },
];

const OUTCOME_LABEL: Record<Outcome, { label: string; color: string }> = {
  worked:       { label: 'Worked',    color: 'var(--risk-green)' },
  partial:      { label: 'Partial',   color: 'var(--risk-amber)' },
  failed:       { label: 'Failed',    color: 'var(--risk-red)' },
  running:      { label: 'Running',   color: 'var(--risk-amber)' },
  turned:       { label: 'Turned',    color: 'var(--accent-cyan)' },
  inconclusive: { label: 'No Signal', color: 'var(--text-faint)' },
  pending:      { label: 'Pending',   color: 'var(--accent-indigo)' },
};

const inputCls = 'w-full px-4 py-3 bg-kd-elevated border border-kd-border rounded-xl text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent-indigo/60 transition-colors';
const labelCls = 'block text-[11px] uppercase tracking-widest font-bold text-muted mb-2';

async function fetchInference(ruleId: number): Promise<InferenceRow[]> {
  const res = await fetch(`${PIPELINE_API}/api/rules/${ruleId}/inference`);
  if (!res.ok) throw new Error(`inference ${res.status}`);
  const data = await res.json();
  return data.inferences ?? [];
}

export default function RuleInferenceModal({
  ruleId, ruleName, onClose, onEditMetadata,
}: {
  ruleId: number;
  ruleName: string;
  onClose: () => void;
  /** Opens the old rule-metadata form (rule_code/tags/base_bias) — footer link only. */
  onEditMetadata?: () => void;
}) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>('choose');
  const [text, setText] = useState('');
  const [impact, setImpact] = useState<MarketImpact | null>(null);
  const [pairRuleId, setPairRuleId] = useState('');
  const [llm, setLlm] = useState<Llm>('claude');
  const [generated, setGenerated] = useState(false);   // AI draft landed in the form
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['rule-inference', ruleId],
    queryFn: () => fetchInference(ruleId),
    staleTime: 60 * 1000,
  });

  function resetForm() {
    setText(''); setImpact(null); setPairRuleId(''); setGenerated(false); setError(null);
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`${PIPELINE_API}/api/rules/${ruleId}/inference/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ llm, pair_rule_id: pairRuleId ? Number(pairRuleId) : null }),
      });
      if (!res.ok) throw new Error(`generate failed (${res.status})`);
      const draft = await res.json();
      setText(draft.inference_text ?? '');
      setImpact((draft.market_impact ?? null) as MarketImpact | null);
      setGenerated(true);
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
          market_impact: impact,
          pair_rule_id: pairRuleId ? Number(pairRuleId) : null,
          source: mode === 'ai' && generated ? 'ai_generated' : 'manual',
        }),
      });
      if (!res.ok) throw new Error(`save failed (${res.status})`);
      resetForm();
      setMode('choose');
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

  // Shared editable form — both Manual and AI converge here. In AI mode the
  // form appears after Generate fills it; in Manual mode it's shown directly.
  const showForm = mode === 'manual' || (mode === 'ai' && generated);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-4xl bg-kd-surface border border-kd-border rounded-3xl shadow-2xl shadow-black/60 overflow-hidden">

        {/* Header — /inference FormModal chrome */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-kd-border">
          <div>
            <h2 className="text-lg font-bold text-white">Rule Inference</h2>
            <p className="text-xs text-muted mt-0.5">{ruleName} — expected behavior vs computed evidence</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-muted hover:bg-kd-elevated hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-8 py-6 max-h-[75vh] overflow-y-auto space-y-6">

          {/* Existing inferences with live outcome */}
          {isLoading ? (
            <p className="text-xs text-muted">Loading…</p>
          ) : rows.length > 0 && (
            <div className="space-y-2">
              {rows.map(row => {
                const outcome = OUTCOME_LABEL[row.outcome];
                return (
                  <div key={row.id} className="rounded-xl border border-kd-border bg-kd-elevated/40 p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-white leading-relaxed flex-1">
                        {row.inference_text}
                        {row.pair_rule_label && (
                          <span className="text-muted"> — combined with <strong>{row.pair_rule_label}</strong></span>
                        )}
                      </p>
                      <button onClick={() => handleDelete(row.id)} className="text-muted hover:text-risk-red shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono">
                      {row.market_impact && (
                        <span className="px-1.5 py-0.5 rounded border border-kd-border text-muted">
                          expected: {row.market_impact}
                        </span>
                      )}
                      <span style={{ color: outcome.color }}>{outcome.label}</span>
                      <span className="text-muted">{row.confidence_tier_live}</span>
                      <span className="text-muted">
                        n={row.evidence.n}{row.evidence.currently_active ? ' · active now' : ''}
                      </span>
                      <span className="text-muted ml-auto">
                        {row.source === 'ai_generated' ? '✦ AI Inference' : 'manual'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Step 1: the two options ─────────────────────────────────── */}
          {mode === 'choose' && (
            <div>
              <label className={labelCls}>New inference — choose how</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => { resetForm(); setMode('manual'); }}
                  className="rounded-2xl border border-kd-border bg-kd-elevated/40 p-5 text-left hover:border-accent-indigo/60 transition-all group"
                >
                  <PenLine className="w-5 h-5 text-accent-indigo mb-2" />
                  <p className="text-sm font-bold text-white group-hover:text-accent-indigo transition-colors">Manual</p>
                  <p className="text-xs text-muted mt-1">You write the expected behavior and pick the direction yourself.</p>
                </button>
                <button
                  onClick={() => { resetForm(); setMode('ai'); }}
                  className="rounded-2xl border border-kd-border bg-kd-elevated/40 p-5 text-left hover:border-accent-gold/60 transition-all group"
                >
                  <Sparkles className="w-5 h-5 text-accent-gold mb-2" />
                  <p className="text-sm font-bold text-white group-hover:text-accent-gold transition-colors">AI Inference</p>
                  <p className="text-xs text-muted mt-1">Claude or Qwen drafts it from the rule's mechanics — you review and edit before saving.</p>
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2 (both paths) ─────────────────────────────────────── */}
          {mode !== 'choose' && (
            <div className="space-y-5">
              <button
                onClick={() => { resetForm(); setMode('choose'); }}
                className="flex items-center gap-1 text-xs text-muted hover:text-white transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </button>

              {/* Pair rule — optional combination, both paths */}
              <div>
                <label className={labelCls}>Pair with rule id (optional — combination)</label>
                <input
                  type="text"
                  value={pairRuleId}
                  onChange={e => setPairRuleId(e.target.value)}
                  placeholder="e.g. Saturn rule's id, for a Saturn x Mercury combination"
                  className={inputCls}
                />
              </div>

              {/* AI path: model picker + generate (Custom Index Discover pattern) */}
              {mode === 'ai' && (
                <div>
                  <label className={labelCls}>Model</label>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-2 w-72">
                      {(['claude', 'qwen'] as Llm[]).map(v => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setLlm(v)}
                          className={cn(
                            'flex-1 py-2 text-xs rounded-lg border transition-all',
                            llm === v
                              ? 'font-semibold border-accent-indigo bg-accent-indigo/12 text-accent-indigo'
                              : 'border-kd-border text-muted hover:border-kd-border-active',
                          )}
                        >
                          {v === 'claude' ? 'Claude (Sonnet)' : 'Qwen3 (Local)'}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={handleGenerate}
                      disabled={generating}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-accent-gold/40 bg-accent-gold/10 text-xs text-accent-gold hover:bg-accent-gold/20 disabled:opacity-50 transition-all"
                    >
                      {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      {generating ? 'Generating…' : generated ? 'Regenerate' : 'Generate Inference'}
                    </button>
                  </div>
                </div>
              )}

              {/* The form — manual directly, or AI after the draft lands */}
              {showForm && (
                <>
                  <div>
                    <label className={labelCls}>
                      Inference{mode === 'ai' && <span className="text-accent-gold normal-case font-normal tracking-normal"> — ✦ AI draft, edit freely</span>}
                    </label>
                    <textarea
                      value={text}
                      onChange={e => setText(e.target.value)}
                      placeholder="What should this rule (or combination) mean for the market?"
                      rows={4}
                      className={cn(inputCls, 'resize-none')}
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Market impact</label>
                    <div className="flex flex-wrap gap-2">
                      {IMPACT_OPTIONS.map(o => {
                        const active = impact === o.value;
                        return (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => setImpact(active ? null : o.value)}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
                            style={active
                              ? { color: o.color, borderColor: o.color, background: `${o.color}1a` }
                              : { color: 'var(--text-muted)', borderColor: 'var(--kd-border)', background: 'var(--kd-elevated)' }}
                          >
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={handleSave}
                      disabled={saving || !text.trim()}
                      className="px-5 py-2.5 rounded-xl bg-accent-indigo/20 border border-accent-indigo/40 text-sm font-semibold text-accent-indigo hover:bg-accent-indigo/30 disabled:opacity-50 transition-all"
                    >
                      {saving ? 'Saving…' : 'Save Inference'}
                    </button>
                  </div>
                </>
              )}

              {error && <p className="text-xs text-risk-red">{error}</p>}
            </div>
          )}
        </div>

        {/* Footer — metadata editing lives here now, not on the toolbar */}
        {onEditMetadata && (
          <div className="px-8 py-3 border-t border-kd-border flex justify-end">
            <button
              onClick={() => { onClose(); onEditMetadata(); }}
              className="text-[11px] text-muted hover:text-secondary transition-colors underline underline-offset-2"
            >
              Edit rule metadata (code, tags, bias) →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
