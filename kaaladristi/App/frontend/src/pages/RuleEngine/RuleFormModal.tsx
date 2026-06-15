import { useState, useCallback, useRef, type KeyboardEvent } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RuleInput } from './ruleService';
import { TagChip } from '@/constants/ruleTagColors';

// ── Constants ─────────────────────────────────────────────────────────────────

export const RULE_TYPE_OPTIONS = [
  { value: 'nakshatra_vara',       label: 'Nakshatra · Vara'    },
  { value: 'planet_transit',       label: 'Planet Transit'      },
  { value: 'planet_state',         label: 'Planet State'        },
  { value: 'planet_conjunction',   label: 'Conjunction'         },
  { value: 'planet_manifestation', label: 'Manifestation'       },
  { value: 'compound',             label: 'Compound'            },
  { value: 'tithi_alone',          label: 'Tithi'               },
  { value: 'eclipse',              label: 'Eclipse'             },
  { value: 'vedh',                 label: 'Vedh'                },
];

const OUTCOME_OPTIONS = ['bullish', 'bearish', 'volatile', 'turning'];

const PROB_OPTIONS = ['Very High', 'High', 'Reasonable', 'Low'];

const SCOPE_OPTIONS = [
  { value: 'market',         label: 'Market'          },
  { value: 'gold',           label: 'Gold'            },
  { value: 'silver',         label: 'Silver'          },
  { value: 'sector:Sun',     label: 'Sun Sectors'     },
  { value: 'sector:Moon',    label: 'Moon Sectors'    },
  { value: 'sector:Mars',    label: 'Mars Sectors'    },
  { value: 'sector:Mercury', label: 'Mercury Sectors' },
  { value: 'sector:Jupiter', label: 'Jupiter Sectors' },
  { value: 'sector:Venus',   label: 'Venus Sectors'   },
  { value: 'sector:Saturn',  label: 'Saturn Sectors'  },
  { value: 'sector:Rahu',    label: 'Rahu Sectors'    },
  { value: 'sector:Ketu',    label: 'Ketu Sectors'    },
];

const RULE_CODE_PATTERN = /^[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+$/;

// ── Form state ────────────────────────────────────────────────────────────────

export type FormMode = 'add' | 'edit' | 'clone';

export interface RuleFormValues {
  rule_code: string;
  rule_type: string;
  display_name: string;
  outcome: string;
  base_bias: string;
  scope: string[];
  probability_label: string;
  conditions_text: string;
  remarks: string;
  tags: string[];
  catalog_visible: boolean;
}

export function emptyForm(): RuleFormValues {
  return {
    rule_code: '',
    rule_type: '',
    display_name: '',
    outcome: '',
    base_bias: '',
    scope: ['market'],
    probability_label: '',
    conditions_text: '',
    remarks: '',
    tags: [],
    catalog_visible: false,
  };
}

export function ruleToForm(rule: {
  rule_code: string;
  rule_type: string;
  display_name: string;
  outcome: string | null;
  base_bias: string | null;
  scope: string[] | null;
  probability_label: string | null;
  conditions: Record<string, unknown> | null;
  remarks: string | null;
  tags?: string[];
  catalog_visible?: boolean;
}, mode: FormMode): RuleFormValues {
  return {
    rule_code:        mode === 'clone' ? '' : rule.rule_code,
    rule_type:        rule.rule_type,
    display_name:     mode === 'clone' ? `Copy of ${rule.display_name}` : rule.display_name,
    outcome:          rule.outcome ?? '',
    base_bias:        rule.base_bias ?? '',
    scope:            rule.scope ?? ['market'],
    probability_label: rule.probability_label ?? '',
    conditions_text:  rule.conditions ? JSON.stringify(rule.conditions, null, 2) : '',
    remarks:          rule.remarks ?? '',
    tags:             mode === 'clone' ? [] : (rule.tags ?? []),
    catalog_visible:  mode === 'clone' ? false : (rule.catalog_visible ?? false),
  };
}

export function formToInput(values: RuleFormValues): RuleInput {
  let conditions: Record<string, unknown> | null = null;
  if (values.conditions_text.trim()) {
    try {
      conditions = JSON.parse(values.conditions_text.trim());
    } catch {
      // Should not reach here — validated before submit
    }
  }
  return {
    rule_code:         values.rule_code.trim().toUpperCase(),
    rule_type:         values.rule_type,
    display_name:      values.display_name.trim(),
    outcome:           values.outcome,
    base_bias:         values.base_bias.trim() || null,
    scope:             values.scope.length > 0 ? values.scope : null,
    probability_label: values.probability_label || null,
    conditions,
    remarks:           values.remarks.trim() || null,
    tags:              values.tags,
    catalog_visible:   values.catalog_visible,
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

interface ValidationErrors {
  rule_code?: string;
  display_name?: string;
  rule_type?: string;
  outcome?: string;
  conditions?: string;
}

function validate(values: RuleFormValues, mode: FormMode): ValidationErrors {
  const errs: ValidationErrors = {};
  if (mode !== 'edit') {
    if (!values.rule_code.trim()) {
      errs.rule_code = 'Rule code is required';
    } else if (!RULE_CODE_PATTERN.test(values.rule_code.trim().toUpperCase())) {
      errs.rule_code = 'Must match pattern LETTERS-LETTERS-LETTERS (e.g. NAK-SUN-MON)';
    }
  }
  if (!values.display_name.trim()) {
    errs.display_name = 'Display name is required';
  } else if (values.display_name.trim().length > 100) {
    errs.display_name = 'Max 100 characters';
  }
  if (!values.rule_type) errs.rule_type = 'Rule type is required';
  if (!values.outcome) errs.outcome = 'Outcome is required';
  if (values.conditions_text.trim()) {
    try { JSON.parse(values.conditions_text.trim()); }
    catch { errs.conditions = 'Must be valid JSON'; }
  }
  return errs;
}

// ── UI helpers ────────────────────────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 bg-kd-elevated border border-kd-border rounded-xl text-sm text-[var(--text-primary)] placeholder:text-muted focus:outline-none focus:border-accent-indigo/60 transition-colors';
const labelCls = 'block text-[10px] uppercase tracking-widest font-bold text-muted mb-1.5';
const errorCls = 'text-[11px] text-risk-red mt-1';

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className={errorCls}>{msg}</p>;
}

// ── Admin tag chip input ──────────────────────────────────────────────────────

function AdminTagsField({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag || tags.includes(tag)) { setInput(''); return; }
    onChange([...tags, tag]);
    setInput('');
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div>
      <label className={labelCls}>Tags</label>
      <div
        className="flex flex-wrap gap-1.5 px-3 py-2 bg-kd-elevated border border-kd-border rounded-xl cursor-text min-h-[42px]"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map(tag => (
          <TagChip key={tag} tag={tag} onRemove={() => onChange(tags.filter(t => t !== tag))} />
        ))}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          onBlur={() => { if (input.trim()) addTag(input); }}
          placeholder={tags.length === 0 ? 'e.g. Mercury, Retrograde, Panchak' : ''}
          className="flex-1 min-w-[120px] bg-transparent text-sm text-[var(--text-primary)] placeholder:text-muted outline-none"
        />
      </div>
      <p className="text-[10px] text-muted mt-1">Press Enter or comma to add a tag</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface RuleFormModalProps {
  mode: FormMode;
  initial: RuleFormValues;
  onClose: () => void;
  onSave: (input: RuleInput) => void;
  isSaving: boolean;
  saveError: string | null;
}

export default function RuleFormModal({
  mode,
  initial,
  onClose,
  onSave,
  isSaving,
  saveError,
}: RuleFormModalProps) {
  const [form, setForm] = useState<RuleFormValues>(initial);
  const [touched, setTouched] = useState(false);

  const errors = touched ? validate(form, mode) : {};
  const isLocked = mode === 'edit';

  const set = useCallback(<K extends keyof RuleFormValues>(key: K, value: RuleFormValues[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const toggleScope = (value: string) => {
    setForm(prev => {
      const current = prev.scope;
      const next = current.includes(value)
        ? current.filter(s => s !== value)
        : [...current, value];
      return { ...prev, scope: next };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    const errs = validate(form, mode);
    if (Object.keys(errs).length > 0) return;
    onSave(formToInput(form));
  };

  const title = mode === 'add' ? 'Add Rule' : mode === 'clone' ? 'Clone Rule' : 'Edit Rule';
  const submitLabel = mode === 'edit' ? 'Save Changes' : 'Create Rule';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl bg-kd-surface border border-kd-border rounded-3xl shadow-2xl shadow-black/60 overflow-hidden flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-kd-border shrink-0">
          <div>
            <h2 className="text-base font-semibold text-white">{title}</h2>
            {mode === 'clone' && (
              <p className="text-xs text-muted mt-0.5">Enter a unique rule code for the clone</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-muted hover:bg-kd-elevated hover:text-secondary transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-7 py-6 space-y-5">

          {/* Row 1: rule_code + rule_type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>
                Rule Code <span className="text-risk-red">*</span>
              </label>
              {isLocked ? (
                <div className={cn(inputCls, 'text-muted cursor-not-allowed bg-kd-elevated/50')}>
                  {form.rule_code}
                </div>
              ) : (
                <input
                  type="text"
                  value={form.rule_code}
                  onChange={e => set('rule_code', e.target.value.toUpperCase())}
                  placeholder="e.g. NAK-SUN-MON"
                  className={cn(inputCls, errors.rule_code && 'border-risk-red/50')}
                  spellCheck={false}
                />
              )}
              <FieldError msg={errors.rule_code} />
              {!isLocked && !errors.rule_code && (
                <p className="text-[10px] text-muted mt-1 font-mono">Format: LETTERS-LETTERS-LETTERS</p>
              )}
            </div>

            <div>
              <label className={labelCls}>
                Rule Type <span className="text-risk-red">*</span>
              </label>
              {isLocked ? (
                <div className={cn(inputCls, 'text-muted cursor-not-allowed bg-kd-elevated/50')}>
                  {RULE_TYPE_OPTIONS.find(o => o.value === form.rule_type)?.label ?? form.rule_type}
                </div>
              ) : (
                <select
                  value={form.rule_type}
                  onChange={e => set('rule_type', e.target.value)}
                  className={cn(inputCls, errors.rule_type && 'border-risk-red/50')}
                >
                  <option value="">Select type…</option>
                  {RULE_TYPE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              )}
              <FieldError msg={errors.rule_type} />
            </div>
          </div>

          {/* display_name */}
          <div>
            <label className={labelCls}>
              Display Name <span className="text-risk-red">*</span>
            </label>
            <input
              type="text"
              value={form.display_name}
              onChange={e => set('display_name', e.target.value)}
              placeholder="e.g. Moon in Ardra on Tuesday"
              maxLength={100}
              className={cn(inputCls, errors.display_name && 'border-risk-red/50')}
            />
            <FieldError msg={errors.display_name} />
          </div>

          {/* Row 3: outcome + probability_label */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>
                Outcome <span className="text-risk-red">*</span>
              </label>
              <select
                value={form.outcome}
                onChange={e => set('outcome', e.target.value)}
                className={cn(inputCls, errors.outcome && 'border-risk-red/50')}
              >
                <option value="">Select outcome…</option>
                {OUTCOME_OPTIONS.map(o => (
                  <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
                ))}
              </select>
              <FieldError msg={errors.outcome} />
            </div>

            <div>
              <label className={labelCls}>Probability</label>
              <select
                value={form.probability_label}
                onChange={e => set('probability_label', e.target.value)}
                className={inputCls}
              >
                <option value="">Select…</option>
                {PROB_OPTIONS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Scope */}
          <div>
            <label className={labelCls}>Scope</label>
            <div className="grid grid-cols-3 gap-1.5 p-3 rounded-xl border border-kd-border bg-kd-elevated/40">
              {SCOPE_OPTIONS.map(opt => {
                const checked = form.scope.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors text-[12px]',
                      checked
                        ? 'bg-accent-indigo/15 text-accent-indigo border border-accent-indigo/25'
                        : 'text-muted hover:text-secondary border border-transparent',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleScope(opt.value)}
                      className="w-3 h-3 accent-indigo-400 shrink-0"
                    />
                    {opt.label}
                  </label>
                );
              })}
            </div>
          </div>

          {/* conditions JSON */}
          <div>
            <label className={labelCls}>Conditions (JSON)</label>
            <textarea
              value={form.conditions_text}
              onChange={e => set('conditions_text', e.target.value)}
              placeholder={'{\n  "vara": "Monday",\n  "nakshatra_lord": "Moon"\n}'}
              rows={5}
              className={cn(inputCls, 'resize-none font-mono text-xs leading-relaxed', errors.conditions && 'border-risk-red/50')}
              spellCheck={false}
            />
            <FieldError msg={errors.conditions} />
          </div>

          {/* base_bias */}
          <div>
            <label className={labelCls}>Base Bias (optional)</label>
            <input
              type="text"
              value={form.base_bias}
              onChange={e => set('base_bias', e.target.value)}
              placeholder="e.g. bullish"
              className={inputCls}
            />
          </div>

          {/* remarks */}
          <div>
            <label className={labelCls}>Remarks (optional)</label>
            <textarea
              value={form.remarks}
              onChange={e => set('remarks', e.target.value)}
              placeholder="Additional notes, source page references…"
              rows={3}
              className={cn(inputCls, 'resize-none')}
            />
          </div>

          {/* ── Admin section ── */}
          <div className="pt-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-kd-border" />
              <span className="text-[9px] font-mono uppercase tracking-widest text-muted px-1">Admin</span>
              <div className="flex-1 h-px bg-kd-border" />
            </div>

            {/* catalog_visible toggle */}
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="flex-1">
                <div className={labelCls}>Visible in Catalog</div>
                <p className="text-[11px] text-muted leading-relaxed">
                  When enabled, this rule appears in the user Catalog under Astro Rules.
                </p>
              </div>
              <button
                type="button"
                onClick={() => set('catalog_visible', !form.catalog_visible)}
                className={cn(
                  'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none mt-0.5',
                  form.catalog_visible ? 'bg-risk-green/60' : 'bg-kd-border',
                )}
              >
                <span className={cn(
                  'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
                  form.catalog_visible ? 'translate-x-4' : 'translate-x-0.5',
                )} />
              </button>
            </div>

            {/* tags chip input */}
            <AdminTagsField tags={form.tags} onChange={t => set('tags', t)} />
          </div>

          {/* Server error */}
          {saveError && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-risk-red/10 border border-risk-red/25">
              <AlertCircle className="w-4 h-4 text-risk-red shrink-0 mt-0.5" />
              <p className="text-sm text-risk-red">{saveError}</p>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-7 py-4 border-t border-kd-border shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm text-muted hover:text-secondary transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-5 py-2 text-sm font-medium bg-accent-indigo/20 border border-accent-indigo/40 rounded-xl text-accent-indigo hover:bg-accent-indigo/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-accent-indigo/30 border-t-accent-indigo rounded-full animate-spin" />
                Saving…
              </>
            ) : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
