/**
 * RuleInferenceModal — theory-vs-evidence authoring (migrations 134+135)
 * =============================================================================
 * The /inference form design applied to a RULE (owner spec 2026-07-07 final):
 *
 *   * Astro event + dates are AUTO — from the rule and its almanac windows
 *     (served by GET /api/rules/{id}/inference) — displayed read-only,
 *     never typed, never AI-generated.
 *   * Captured: inference text, market impact (the FULL /inference
 *     vocabulary from constants/marketStatus.ts), expert confidence 1-10
 *     (always manual), Applies To (SAME AppliesTo component as /inference —
 *     extracted to components/domain/AppliesToSelector.tsx; sectors list =
 *     Sector Rotation's sectoral + curated indices), notes.
 *   * Two paths: Manual (user fills everything) or AI Inference (Claude or
 *     Qwen drafts ONLY inference text + impact; user reviews, sets
 *     confidence/applicability, saves).
 *   * Stored in km_rule_inference — dc_inference is untouched; only the UI
 *     design is borrowed. Non-directional inferences are first-class
 *     ("Mercury retrograde is a turning point — Pattern shows how it works").
 */

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Trash2, Sparkles, Loader2, PenLine, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { from } from '@/services/postgrest';
import { fetchLookupByCategory } from '@/services/dcLookup';
import { MARKET_STATUS, MARKET_STATUS_MAP, STATUS_COLOR_CLASSES } from '@/constants/marketStatus';
import {
  AppliesTo, DEFAULT_APPL, applToInput, type ApplForm, type AppliesToItem,
} from '@/components/domain/AppliesToSelector';

const PIPELINE_API = import.meta.env.VITE_PIPELINE_API_URL ?? '';

type Outcome = 'worked' | 'partial' | 'failed' | 'running' | 'turned' | 'inconclusive' | 'pending';
type Llm = 'claude' | 'qwen';
type Mode = 'choose' | 'manual' | 'ai';

interface InferenceRow {
  id: number;
  rule_a_id: number;
  rule_b_id: number | null;
  inference_text: string;
  market_impact: string | null;
  source: 'manual' | 'ai_generated';
  confidence: number | null;
  confidence_tier_live: string;
  outcome: Outcome;
  evidence: { n: number; currently_active?: boolean };
  pair_rule_label?: string;
  notes: string | null;
  created_at: string;
  /** Versioning (migration 136): 'active' = hypothesis of record;
   * 'superseded' = history with a frozen verdict. */
  status?: 'active' | 'superseded';
  superseded_at?: string | null;
}

interface InferenceResponse {
  rule_id: number;
  rule: { rule_code: string; display_name: string; base_bias: string | null } | null;
  window: { start_date: string; end_date: string; status: 'active' | 'upcoming' | 'past' } | null;
  inferences: InferenceRow[];
}

const OUTCOME_LABEL: Record<Outcome, { label: string; color: string }> = {
  worked:       { label: 'Worked',    color: 'var(--risk-green)' },
  partial:      { label: 'Partial',   color: 'var(--risk-amber)' },
  failed:       { label: 'Failed',    color: 'var(--risk-red)' },
  running:      { label: 'Running',   color: 'var(--risk-amber)' },
  turned:       { label: 'Turned',    color: 'var(--accent-cyan)' },
  inconclusive: { label: 'No Signal', color: 'var(--text-faint)' },
  pending:      { label: 'Pending',   color: 'var(--accent-indigo)' },
};

const inputCls = 'w-full px-4 py-3 bg-kd-elevated border border-kd-border rounded-xl text-sm text-[var(--text-primary)] placeholder:text-muted focus:outline-none focus:border-accent-indigo/60 transition-colors';
const labelCls = 'block text-[11px] uppercase tracking-widest font-bold text-muted mb-2';

async function fetchInference(ruleId: number): Promise<InferenceResponse> {
  const res = await fetch(`${PIPELINE_API}/api/rules/${ruleId}/inference`);
  if (!res.ok) throw new Error(`inference ${res.status}`);
  return res.json();
}

/** Sector Rotation's sectors (sectoral + curated indices) as Applies-To items. */
async function fetchSectorItems(): Promise<AppliesToItem[]> {
  const { data, error } = await from('km_index_symbols')
    .select('name,category')
    .in('category', ['sectoral index', 'custom'])
    .is('is_active', 'true')
    .order('name', { ascending: true })
    .execute();
  if (error) throw new Error(error.message);
  return ((data ?? []) as { name: string; category: string }[])
    .map(r => ({ code: r.name, label: r.category === 'custom' ? `${r.name} · curated` : r.name }));
}

/** Broad/original indices as Applies-To items. */
async function fetchIndexItems(): Promise<AppliesToItem[]> {
  const { data, error } = await from('km_index_symbols')
    .select('name')
    .in('category', ['index', 'broad market index'])
    .is('is_active', 'true')
    .order('name', { ascending: true })
    .execute();
  if (error) throw new Error(error.message);
  return ((data ?? []) as { name: string }[]).map(r => ({ code: r.name, label: r.name }));
}

function fmtWindow(w: InferenceResponse['window']): string {
  if (!w) return 'no windows on record';
  const tag = w.status === 'active' ? 'active now' : w.status === 'upcoming' ? 'next window' : 'last window';
  return `${w.start_date} → ${w.end_date} (${tag})`;
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
  const [impact, setImpact] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [appl, setAppl] = useState<ApplForm>(DEFAULT_APPL);
  const [notes, setNotes] = useState('');
  const [pairRuleId, setPairRuleId] = useState('');
  const [llm, setLlm] = useState<Llm>('claude');
  const [generated, setGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['rule-inference', ruleId],
    queryFn: () => fetchInference(ruleId),
    staleTime: 60 * 1000,
  });
  const rows = Array.isArray(data?.inferences) ? data.inferences : [];

  // Applies-To item sources — sectors from Sector Rotation (sectoral +
  // curated), indexes = broad/original, commodities from dc_lookup.
  const { data: sectorItems = [] } = useQuery({
    queryKey: ['appliesto', 'sectors'], queryFn: fetchSectorItems, staleTime: 300_000,
  });
  const { data: indexItems = [] } = useQuery({
    queryKey: ['appliesto', 'indexes'], queryFn: fetchIndexItems, staleTime: 300_000,
  });
  const { data: commodityItems = [] } = useQuery({
    queryKey: ['appliesto', 'commodities'],
    queryFn: async () => (await fetchLookupByCategory('commodity')).map(c => ({ code: c.code, label: c.label })),
    staleTime: 300_000,
  });

  function resetForm() {
    setText(''); setImpact(null); setConfidence(null); setAppl(DEFAULT_APPL);
    setNotes(''); setPairRuleId(''); setGenerated(false); setError(null);
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
      // AI produces ONLY these two fields — confidence + applicability stay manual.
      setText(draft.inference_text ?? '');
      setImpact(draft.market_impact ?? null);
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
      const applPayload = applToInput(appl);
      const res = await fetch(`${PIPELINE_API}/api/rules/${ruleId}/inference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inference_text: text.trim(),
          market_impact: impact,
          pair_rule_id: pairRuleId ? Number(pairRuleId) : null,
          source: mode === 'ai' && generated ? 'ai_generated' : 'manual',
          confidence,
          applicability_scope: applPayload.applicability_scope,
          applicability: applPayload.applicability,
          notes: notes.trim() || null,
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

  const showForm = mode === 'manual' || (mode === 'ai' && generated);

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />

      {/* Slide-in panel from the right — owner: 'landslide' design */}
      <div
        className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-2xl bg-kd-surface border-l border-kd-border shadow-2xl shadow-black/60 flex flex-col"
        style={{ animation: 'kd-slide-in .25s ease-out' }}
      >
        <style>{'@keyframes kd-slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }'}</style>

        {/* Header — /inference FormModal chrome */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-kd-border shrink-0">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Rule Inference</h2>
            <p className="text-xs text-muted mt-0.5">Expert planetary rule observation — evidence computed by Discovery &amp; Correlation</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-muted hover:bg-kd-elevated hover:text-[var(--text-primary)] transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 flex-1 overflow-y-auto space-y-6">

          {/* ── Auto from DB — event + window, never captured ─────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Astro Event · auto</label>
              <div className={cn(inputCls, 'opacity-80 cursor-default select-text')}>
                <div className="text-[var(--text-primary)]">{data?.rule?.display_name ?? ruleName}</div>
                <div className="text-muted font-mono text-[11px] mt-0.5">{data?.rule?.rule_code ?? ''}</div>
              </div>
            </div>
            <div>
              <label className={labelCls}>Window · auto from almanac</label>
              <div className={cn(inputCls, 'opacity-80 cursor-default font-mono text-xs flex items-center')}>
                {fmtWindow(data?.window ?? null)}
              </div>
            </div>
          </div>

          {/* ── Existing inferences with live outcome ─────────────────────── */}
          {isLoading ? (
            <p className="text-xs text-muted">Loading…</p>
          ) : rows.length > 0 && (
            <div className="space-y-2">
              {rows.map(row => {
                const outcome = OUTCOME_LABEL[row.outcome];
                const s = row.market_impact ? MARKET_STATUS_MAP.get(row.market_impact) : null;
                const c = STATUS_COLOR_CLASSES[s?.color ?? 'slate'];
                const superseded = row.status === 'superseded';
                return (
                  <div
                    key={row.id}
                    className={cn(
                      'rounded-xl border p-3 space-y-1.5',
                      superseded
                        ? 'border-kd-border/50 bg-kd-elevated/20 opacity-60'
                        : 'border-kd-border bg-kd-elevated/40',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-[var(--text-primary)] leading-relaxed flex-1">
                        {row.inference_text}
                        {row.pair_rule_label && (
                          <span className="text-muted"> — combined with <strong>{row.pair_rule_label}</strong></span>
                        )}
                      </p>
                      {!superseded && (
                        <button onClick={() => handleDelete(row.id)} className="text-muted hover:text-risk-red shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono">
                      {superseded ? (
                        <span className="px-1.5 py-0.5 rounded border border-kd-border text-muted">
                          superseded{row.superseded_at ? ` ${String(row.superseded_at).slice(0, 10)}` : ''} — verdict frozen
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded border border-risk-green/40 text-risk-green">
                          active
                        </span>
                      )}
                      {s && (
                        <span className={cn('px-2 py-0.5 rounded-lg font-semibold border', c.bg, c.text, c.border)}>
                          {s.label}
                        </span>
                      )}
                      <span style={{ color: outcome.color }}>{outcome.label}</span>
                      <span className="text-muted">{row.confidence_tier_live}</span>
                      {row.confidence != null && <span className="text-muted">expert {row.confidence}/10</span>}
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

          {/* ── Step 1: the two options ───────────────────────────────────── */}
          {mode === 'choose' && (
            <div>
              <label className={labelCls}>New inference — choose how</label>
              <p className="text-[10px] text-muted mb-3 -mt-1">
                Saving replaces the current active inference for this scope; the previous one is
                kept as history with its verdict frozen at that moment.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => { resetForm(); setMode('manual'); }}
                  className="rounded-2xl border border-kd-border bg-kd-elevated/40 p-5 text-left hover:border-accent-indigo/60 transition-all group"
                >
                  <PenLine className="w-5 h-5 text-accent-indigo mb-2" />
                  <p className="text-sm font-bold text-[var(--text-primary)] group-hover:text-accent-indigo transition-colors">Manual</p>
                  <p className="text-xs text-muted mt-1">You write the inference and set impact, confidence, and applicability yourself.</p>
                </button>
                <button
                  onClick={() => { resetForm(); setMode('ai'); }}
                  className="rounded-2xl border border-kd-border bg-kd-elevated/40 p-5 text-left hover:border-accent-gold/60 transition-all group"
                >
                  <Sparkles className="w-5 h-5 text-accent-gold mb-2" />
                  <p className="text-sm font-bold text-[var(--text-primary)] group-hover:text-accent-gold transition-colors">AI Inference</p>
                  <p className="text-xs text-muted mt-1">Claude or Qwen drafts the inference and impact only — confidence and applicability stay yours.</p>
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2 (both paths converge on the /inference form) ──────── */}
          {mode !== 'choose' && (
            <div className="space-y-5">
              <button
                onClick={() => { resetForm(); setMode('choose'); }}
                className="flex items-center gap-1 text-xs text-muted hover:text-[var(--text-primary)] transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </button>

              {/* AI path: model picker + generate */}
              {mode === 'ai' && (
                <div>
                  <label className={labelCls}>Model</label>
                  <div className="flex items-center gap-3 flex-wrap">
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

              {showForm && (
                <div className="grid grid-cols-1 gap-6">
                  {/* ── Left panel — inference + impact (the captured/AI part) ── */}
                  <div className="space-y-5">
                    <div>
                      <label className={labelCls}>
                        Inference
                        {mode === 'ai' && <span className="text-accent-gold normal-case font-normal tracking-normal"> — ✦ AI draft, edit freely</span>}
                      </label>
                      <textarea
                        value={text}
                        onChange={e => setText(e.target.value)}
                        placeholder="What does this rule mean for markets? Non-directional is valid — e.g. a turning point where the Pattern decides direction."
                        rows={4}
                        className={cn(inputCls, 'resize-none')}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Market Impact</label>
                      <div className="flex flex-wrap gap-2">
                        {MARKET_STATUS.map(s => {
                          const active = impact === s.value;
                          const c = STATUS_COLOR_CLASSES[s.color];
                          return (
                            <button
                              key={s.value}
                              type="button"
                              onClick={() => setImpact(active ? null : s.value)}
                              className={cn(
                                'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
                                active
                                  ? cn(c.bg, c.text, c.border)
                                  : 'bg-kd-elevated text-muted border-kd-border hover:border-kd-border-active hover:text-[var(--text-secondary)]'
                              )}
                            >
                              {s.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className={labelCls}>Pair with rule id (optional — combination)</label>
                      <input
                        type="text"
                        value={pairRuleId}
                        onChange={e => setPairRuleId(e.target.value)}
                        placeholder="e.g. Saturn rule's id, for a Saturn × Mercury combination"
                        className={inputCls}
                      />
                    </div>
                  </div>

                  {/* ── Right panel — confidence + applies-to + notes (always manual) ── */}
                  <div className="space-y-5">
                    <div>
                      <label className={labelCls}>Confidence</label>
                      <div className="flex flex-wrap gap-1.5">
                        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
                          const active = confidence === n;
                          return (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setConfidence(active ? null : n)}
                              className={cn(
                                'w-9 h-9 rounded-xl text-xs font-mono font-semibold border transition-all',
                                active
                                  ? 'bg-accent-indigo/20 text-accent-indigo border-accent-indigo/50'
                                  : 'bg-kd-elevated text-muted border-kd-border hover:border-kd-border-active'
                              )}
                            >
                              {n}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className={labelCls}>Applies To</label>
                      <AppliesTo
                        appl={appl}
                        onChange={setAppl}
                        sectors={sectorItems}
                        indexes={indexItems}
                        commodities={commodityItems}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Notes (optional)</label>
                      <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Additional context, sources, references..."
                        rows={3}
                        className={cn(inputCls, 'resize-none')}
                      />
                    </div>
                  </div>
                </div>
              )}

              {error && <p className="text-xs text-risk-red">{error}</p>}

              {showForm && (
                <div className="flex justify-end gap-3 pt-2 border-t border-kd-border">
                  <button
                    onClick={() => { resetForm(); setMode('choose'); }}
                    className="px-5 py-2.5 rounded-xl text-sm text-muted hover:text-[var(--text-primary)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !text.trim()}
                    className="px-5 py-2.5 rounded-xl bg-accent-indigo/20 border border-accent-indigo/40 text-sm font-semibold text-accent-indigo hover:bg-accent-indigo/30 disabled:opacity-50 transition-all"
                  >
                    {saving ? 'Saving…' : 'Add Entry'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — metadata editing lives here, not on the toolbar */}
        {onEditMetadata && (
          <div className="px-6 py-3 border-t border-kd-border flex justify-end shrink-0">
            <button
              onClick={() => { onClose(); onEditMetadata(); }}
              className="text-[11px] text-muted hover:text-secondary transition-colors underline underline-offset-2"
            >
              Edit rule metadata (code, tags, bias) →
            </button>
          </div>
        )}
      </div>
    </>
  );
}
