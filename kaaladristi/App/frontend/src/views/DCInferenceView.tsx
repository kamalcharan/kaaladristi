import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X, AlertCircle, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorBoundary, KaalaLoader, ToastContainer, useToast } from '@/components/ui';
import { fetchInferences, createInference, updateInference, deleteInference } from '@/services/dcInference';
import { fetchLookupByCategory } from '@/services/dcLookup';
import type { DcInference, DcInferenceInput, DcLookupItem } from '@/types';
import { MARKET_STATUS, MARKET_STATUS_MAP, STATUS_COLOR_CLASSES } from '@/constants/marketStatus';
import { MONTH_ABBR, fmtDate } from '@/lib/dateUtils';

// ── Constants ────────────────────────────────────────────────────────────────

const EMPTY_FORM: DcInferenceInput = {
  astro_event:        '',
  start_date:         '',
  start_time:         null,
  end_date:           null,
  end_time:           null,
  inference:          null,
  market_impact:      null,
  confidence:         null,
  notes:              null,
  created_by:         null,
  applicability_scope: null,
  applicability:       null,
};

const SCOPE_OPTIONS = [
  { value: '', label: 'All Scopes' },
  { value: 'equity', label: 'Equity' },
  { value: 'index', label: 'Index' },
  { value: 'commodity', label: 'Commodity' },
];

// ── Applicability form types ─────────────────────────────────────────────────

interface ScopeSection { enabled: boolean; all: boolean; codes: string[] }
interface ApplForm { equity: ScopeSection; index: ScopeSection; commodity: ScopeSection }

const DEFAULT_APPL: ApplForm = {
  equity:    { enabled: true,  all: true,  codes: [] },
  index:     { enabled: false, all: false, codes: [] },
  commodity: { enabled: false, all: false, codes: [] },
};

function applFromRow(row: DcInference): ApplForm {
  const ap = (row.applicability ?? {}) as Record<string, any>;
  return {
    equity: {
      enabled: row.applicability_scope?.includes('equity') ?? true,
      all:     ap.equity?.all_sectors ?? true,
      codes:   ap.equity?.sectors ?? [],
    },
    index: {
      enabled: row.applicability_scope?.includes('index') ?? false,
      all:     ap.index?.all ?? false,
      codes:   ap.index?.list ?? [],
    },
    commodity: {
      enabled: row.applicability_scope?.includes('commodity') ?? false,
      all:     ap.commodity?.all ?? false,
      codes:   ap.commodity?.list ?? [],
    },
  };
}

function applToInput(appl: ApplForm): Pick<DcInferenceInput, 'applicability_scope' | 'applicability'> {
  const scope = (Object.entries(appl) as [string, ScopeSection][])
    .filter(([, v]) => v.enabled)
    .map(([k]) => k);

  const applicability: Record<string, unknown> = {};
  if (appl.equity.enabled)    applicability.equity    = { all_sectors: appl.equity.all, sectors: appl.equity.codes };
  if (appl.index.enabled)     applicability.index     = { all: appl.index.all, list: appl.index.codes };
  if (appl.commodity.enabled) applicability.commodity  = { all: appl.commodity.all, list: appl.commodity.codes };

  return {
    applicability_scope: scope.length ? scope : null,
    applicability: Object.keys(applicability).length ? applicability : null,
  };
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function ImpactBadge({ impact }: { impact: string | null }) {
  if (!impact) return <span className="text-muted text-xs">—</span>;
  const s = MARKET_STATUS_MAP.get(impact);
  const c = STATUS_COLOR_CLASSES[s?.color ?? 'slate'];
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-semibold border', c.bg, c.text, c.border)}>
      {s?.label ?? impact}
    </span>
  );
}

function ConfidenceDots({ value }: { value: number | null }) {
  if (!value) return <span className="text-muted text-xs">—</span>;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className={cn('w-1.5 h-1.5 rounded-full', i < value ? 'bg-accent-indigo' : 'bg-slate-700')}
        />
      ))}
      <span className="ml-1.5 text-[11px] text-muted mono">{value}/10</span>
    </div>
  );
}

function formatDateRange(row: DcInference): string {
  const startFmt = fmtDate(row.start_date);
  const from = row.start_time ? `${startFmt} ${row.start_time.slice(0, 5)}` : startFmt;
  if (!row.end_date) return `${from} → ongoing`;
  const endFmt = fmtDate(row.end_date);
  const to = row.end_time ? `${endFmt} ${row.end_time.slice(0, 5)}` : endFmt;
  return `${from} → ${to}`;
}

function getScopeLabels(row: DcInference): string[] {
  const ap = (row.applicability ?? {}) as Record<string, any>;
  const out: string[] = [];
  if (row.applicability_scope?.includes('equity')) {
    if (ap.equity?.all_sectors) out.push('All Sectors');
    else (ap.equity?.sectors ?? []).slice(0, 2).forEach((s: string) => out.push(s));
  }
  if (row.applicability_scope?.includes('index')) {
    if (ap.index?.all) out.push('All Indexes');
    else (ap.index?.list ?? []).slice(0, 2).forEach((s: string) => out.push(s));
  }
  if (row.applicability_scope?.includes('commodity')) {
    if (ap.commodity?.all) out.push('All Commodities');
    else (ap.commodity?.list ?? []).slice(0, 2).forEach((s: string) => out.push(s));
  }
  return out;
}

function borderColorForImpact(impact: string | null): string {
  if (!impact) return 'border-l-slate-700';
  const s = MARKET_STATUS_MAP.get(impact);
  const map: Record<string, string> = {
    green: 'border-l-risk-green', red: 'border-l-risk-red', amber: 'border-l-risk-amber',
    violet: 'border-l-accent-violet', blue: 'border-l-accent-indigo', slate: 'border-l-slate-500',
  };
  return map[s?.color ?? 'slate'] ?? 'border-l-slate-700';
}

// ── Applies To Panel ─────────────────────────────────────────────────────────

function AppliesToPanel({
  label, items, section, onChange,
}: {
  label: string;
  items: DcLookupItem[];
  section: ScopeSection;
  onChange: (s: ScopeSection) => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = items.filter(it => it.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={section.enabled}
          onChange={e => onChange({ ...section, enabled: e.target.checked })}
          className="accent-accent-indigo w-3.5 h-3.5"
        />
        <span className="text-xs font-semibold text-white">{label}</span>
      </label>

      {section.enabled && (
        <div className="pl-5 space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={section.all}
              onChange={e => onChange({ ...section, all: e.target.checked, codes: e.target.checked ? [] : section.codes })}
              className="accent-accent-indigo w-3 h-3"
            />
            <span className="text-[11px] text-slate-300">All {label}</span>
          </label>

          {!section.all && (
            <>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={`Search ${label.toLowerCase()}...`}
                  className="w-full pl-7 pr-3 py-1.5 bg-slate-900/60 border border-kd-border rounded-lg text-[11px] text-white placeholder:text-slate-600 focus:outline-none focus:border-accent-indigo/60"
                />
              </div>
              <div className="max-h-36 overflow-y-auto space-y-0.5 pr-1">
                {filtered.map(it => (
                  <label key={it.code} className="flex items-center gap-2 py-0.5 cursor-pointer hover:bg-slate-800/40 rounded px-1">
                    <input
                      type="checkbox"
                      checked={section.codes.includes(it.code)}
                      onChange={e => {
                        const codes = e.target.checked
                          ? [...section.codes, it.code]
                          : section.codes.filter(c => c !== it.code);
                        onChange({ ...section, codes });
                      }}
                      className="accent-accent-indigo w-3 h-3"
                    />
                    <span className="text-[11px] text-slate-300">{it.label}</span>
                  </label>
                ))}
                {filtered.length === 0 && (
                  <p className="text-[10px] text-muted py-2 text-center">No matches</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Form Modal (two-panel) ───────────────────────────────────────────────────

interface FormModalProps {
  initial: DcInferenceInput;
  initialAppl: ApplForm;
  editId: number | null;
  onClose: () => void;
  onSave: (data: DcInferenceInput) => void;
  isSaving: boolean;
  saveError: string | null;
}

function FormModal({ initial, initialAppl, editId, onClose, onSave, isSaving, saveError }: FormModalProps) {
  const [form, setForm] = useState<DcInferenceInput>(initial);
  const [appl, setAppl] = useState<ApplForm>(initialAppl);

  const { data: lookups } = useQuery({
    queryKey: ['dc_lookup_all'],
    queryFn: () => Promise.all([
      fetchLookupByCategory('sector'),
      fetchLookupByCategory('index'),
      fetchLookupByCategory('commodity'),
    ]),
    staleTime: 300_000,
  });
  const [sectors, indexes, commodities] = lookups ?? [[], [], []];

  const set = (field: keyof DcInferenceInput, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value || null }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.astro_event.trim() || !form.start_date) return;
    onSave({ ...form, astro_event: form.astro_event.trim(), ...applToInput(appl) });
  };

  const isValid = form.astro_event.trim() && form.start_date;

  const inputCls = 'w-full px-4 py-3 bg-slate-900/60 border border-kd-border rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-accent-indigo/60 transition-colors';
  const labelCls = 'block text-[11px] uppercase tracking-widest font-bold text-muted mb-2';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-4xl bg-[#0f172a] border border-kd-border rounded-3xl shadow-2xl shadow-black/60 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-kd-border">
          <div>
            <h2 className="text-lg font-bold text-white">
              {editId ? 'Edit Inference' : 'New Inference Entry'}
            </h2>
            <p className="text-xs text-muted mt-0.5">Expert planetary event observation</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-800 hover:text-slate-200 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form — two columns */}
        <form onSubmit={handleSubmit} className="px-8 py-6 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

            {/* ── Left Panel ── */}
            <div className="space-y-5">
              {/* Astro Event */}
              <div>
                <label className={labelCls}>Astro Event <span className="text-risk-red">*</span></label>
                <input
                  type="text"
                  value={form.astro_event}
                  onChange={e => setForm(p => ({ ...p, astro_event: e.target.value }))}
                  placeholder="e.g. Rahu Mars in same sign"
                  className={inputCls}
                  required
                />
              </div>

              {/* Start date + time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Start Date <span className="text-risk-red">*</span></label>
                  <input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} className={inputCls} required />
                </div>
                <div>
                  <label className={labelCls}>Start Time</label>
                  <input type="time" value={form.start_time ?? ''} onChange={e => set('start_time', e.target.value)} className={inputCls} />
                </div>
              </div>

              {/* End date + time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>End Date</label>
                  <input type="date" value={form.end_date ?? ''} onChange={e => setForm(p => ({ ...p, end_date: e.target.value || null }))} min={form.start_date || undefined} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>End Time</label>
                  <input type="time" value={form.end_time ?? ''} onChange={e => set('end_time', e.target.value)} className={inputCls} />
                </div>
              </div>

              {/* Inference */}
              <div>
                <label className={labelCls}>Inference</label>
                <textarea
                  value={form.inference ?? ''}
                  onChange={e => set('inference', e.target.value)}
                  placeholder="What does this planetary event mean for markets?"
                  rows={4}
                  className={cn(inputCls, 'resize-none')}
                />
              </div>

              {/* Market Impact */}
              <div>
                <label className={labelCls}>Market Impact</label>
                <div className="flex flex-wrap gap-2">
                  {MARKET_STATUS.map(s => {
                    const active = form.market_impact === s.value;
                    const c = STATUS_COLOR_CLASSES[s.color];
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, market_impact: active ? null : s.value }))}
                        className={cn(
                          'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
                          active
                            ? cn(c.bg, c.text, c.border)
                            : 'bg-slate-900/40 text-slate-500 border-white/5 hover:border-white/20 hover:text-slate-300'
                        )}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Right Panel ── */}
            <div className="space-y-5">
              {/* Confidence */}
              <div>
                <label className={labelCls}>Confidence</label>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
                    const active = form.confidence === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, confidence: active ? null : n }))}
                        className={cn(
                          'w-9 h-9 rounded-lg text-sm font-bold border transition-all mono',
                          active
                            ? 'bg-accent-indigo/20 text-accent-indigo border-accent-indigo/50'
                            : 'bg-slate-900/40 text-slate-500 border-white/5 hover:border-white/20 hover:text-slate-300'
                        )}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Applies To */}
              <div>
                <label className={labelCls}>Applies To</label>
                <div className="p-4 bg-slate-900/40 border border-kd-border rounded-xl space-y-4">
                  <AppliesToPanel
                    label="Sectors"
                    items={sectors}
                    section={appl.equity}
                    onChange={s => setAppl(p => ({ ...p, equity: s }))}
                  />
                  <AppliesToPanel
                    label="Indexes"
                    items={indexes}
                    section={appl.index}
                    onChange={s => setAppl(p => ({ ...p, index: s }))}
                  />
                  <AppliesToPanel
                    label="Commodities"
                    items={commodities}
                    section={appl.commodity}
                    onChange={s => setAppl(p => ({ ...p, commodity: s }))}
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className={labelCls}>Notes <span className="text-slate-600">(optional)</span></label>
                <textarea
                  value={form.notes ?? ''}
                  onChange={e => set('notes', e.target.value)}
                  placeholder="Additional context, sources, references..."
                  rows={3}
                  className={cn(inputCls, 'resize-none')}
                />
              </div>
            </div>
          </div>

          {/* Error */}
          {saveError && (
            <div className="flex items-start gap-3 p-4 mt-6 bg-risk-red/10 border border-risk-red/30 rounded-xl">
              <AlertCircle className="w-4 h-4 text-risk-red mt-0.5 shrink-0" />
              <p className="text-xs text-risk-red">{saveError}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-6 mt-6 border-t border-kd-border">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid || isSaving}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-accent-indigo/20 border border-accent-indigo/40 rounded-xl text-sm font-semibold text-accent-indigo hover:bg-accent-indigo/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editId ? 'Save Changes' : 'Add Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Inference Card ───────────────────────────────────────────────────────────

function InferenceCard({
  row, onEdit, onDelete, deleteConfirmId,
}: {
  row: DcInference;
  onEdit: (row: DcInference) => void;
  onDelete: (id: number) => void;
  deleteConfirmId: number | null;
}) {
  const scopeLabels = getScopeLabels(row);
  const isConfirming = deleteConfirmId === row.id;

  return (
    <div className={cn(
      'border-l-4 rounded-2xl bg-slate-900/40 border border-kd-border p-5 transition-all hover:bg-slate-900/60',
      borderColorForImpact(row.market_impact),
    )}>
      {/* Top: event + date range */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-sm font-bold text-white leading-snug">{row.astro_event}</p>
        <span className="text-[11px] mono text-slate-400 whitespace-nowrap shrink-0">
          {formatDateRange(row)}
        </span>
      </div>

      {/* Middle: badges row */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <ImpactBadge impact={row.market_impact} />
        <ConfidenceDots value={row.confidence} />
        {scopeLabels.map(lbl => (
          <span key={lbl} className="px-2 py-0.5 rounded-md bg-slate-800/80 border border-white/5 text-[10px] text-slate-400 font-medium">
            {lbl}
          </span>
        ))}
      </div>

      {/* Body: inference text */}
      {row.inference && (
        <p className="text-sm text-slate-300 leading-relaxed line-clamp-2 mb-3">{row.inference}</p>
      )}

      {/* Footer: scope badges + actions */}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {(row.applicability_scope ?? []).map(s => (
            <span key={s} className="px-2 py-0.5 rounded-md bg-accent-indigo/10 border border-accent-indigo/20 text-[10px] text-accent-indigo font-semibold uppercase tracking-wider">
              {s}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(row)}
            title="Edit"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-accent-indigo hover:bg-accent-indigo/10 transition-all"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(row.id)}
            title={isConfirming ? 'Click again to confirm' : 'Delete'}
            className={cn(
              'h-8 rounded-lg flex items-center justify-center transition-all text-xs font-medium',
              isConfirming
                ? 'px-3 bg-risk-red/20 text-risk-red border border-risk-red/40'
                : 'w-8 text-slate-500 hover:text-risk-red hover:bg-risk-red/10'
            )}
          >
            {isConfirming ? 'Confirm?' : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────

export default function DCInferenceView() {
  const qc = useQueryClient();
  const { toasts, toast, dismiss } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow] = useState<DcInference | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filterImpact, setFilterImpact] = useState('');
  const [filterMonth, setFilterMonth] = useState<number | null>(null);
  const [filterYear, setFilterYear] = useState<number | null>(null);
  const [filterScope, setFilterScope] = useState('');

  const { data: rows = [], isLoading, isError, error } = useQuery({
    queryKey: ['dc_inference'],
    queryFn: fetchInferences,
    staleTime: 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: { id: number | null; data: DcInferenceInput }) => {
      if (payload.id) return updateInference(payload.id, payload.data);
      return createInference(payload.data);
    },
    onSuccess: (_data, payload) => {
      qc.invalidateQueries({ queryKey: ['dc_inference'] });
      setShowForm(false);
      setEditRow(null);
      setSaveError(null);
      toast('success', payload.id ? 'Entry updated.' : 'Entry saved.');
    },
    onError: (err: Error) => {
      setSaveError(err.message);
      toast('error', `Save failed: ${err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteInference,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dc_inference'] });
      setDeleteConfirm(null);
      toast('success', 'Entry deleted.');
    },
    onError: (err: Error) => toast('error', `Delete failed: ${err.message}`),
  });

  const handleEdit = (row: DcInference) => {
    setEditRow(row);
    setShowForm(true);
    setSaveError(null);
  };

  const handleClose = () => { setShowForm(false); setEditRow(null); setSaveError(null); };

  const handleSave = (data: DcInferenceInput) => {
    setSaveError(null);
    saveMutation.mutate({ id: editRow?.id ?? null, data });
  };

  const handleDelete = (id: number) => {
    if (deleteConfirm === id) {
      deleteMutation.mutate(id);
    } else {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  // Derived filter options from data
  const availableYears = useMemo(() =>
    [...new Set(rows.map(r => r.year).filter(Boolean) as number[])].sort((a, b) => b - a),
    [rows]
  );

  const availableMonths = useMemo(() =>
    [...new Set(rows.map(r => r.month).filter(Boolean) as number[])].sort((a, b) => a - b),
    [rows]
  );

  // Filtered rows
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(r => {
      if (q && !(
        r.astro_event.toLowerCase().includes(q) ||
        (r.inference ?? '').toLowerCase().includes(q) ||
        (r.notes ?? '').toLowerCase().includes(q)
      )) return false;
      if (filterImpact && r.market_impact !== filterImpact) return false;
      if (filterMonth !== null && r.month !== filterMonth) return false;
      if (filterYear !== null && r.year !== filterYear) return false;
      if (filterScope && !(r.applicability_scope ?? []).includes(filterScope)) return false;
      return true;
    });
  }, [rows, search, filterImpact, filterMonth, filterYear, filterScope]);

  const isFiltered = search || filterImpact || filterMonth !== null || filterYear !== null || filterScope;

  const clearFilters = () => {
    setSearch(''); setFilterImpact(''); setFilterMonth(null); setFilterYear(null); setFilterScope('');
  };

  const formInitial: DcInferenceInput = editRow
    ? {
        astro_event:         editRow.astro_event,
        start_date:          editRow.start_date,
        start_time:          editRow.start_time,
        end_date:            editRow.end_date ?? null,
        end_time:            editRow.end_time,
        inference:           editRow.inference,
        market_impact:       editRow.market_impact,
        confidence:          editRow.confidence,
        notes:               editRow.notes,
        created_by:          editRow.created_by,
        applicability_scope: editRow.applicability_scope,
        applicability:       editRow.applicability,
      }
    : { ...EMPTY_FORM };

  const formAppl = editRow ? applFromRow(editRow) : { ...DEFAULT_APPL };

  const selectCls = 'px-3 py-2 bg-slate-900/60 border border-kd-border rounded-xl text-xs text-slate-300 focus:outline-none focus:border-accent-indigo/60 transition-colors';

  return (
    <ErrorBoundary>
      <div className="animate-fade-in">

        {/* Header */}
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-white mb-2">DC Inference</h1>
            <p className="text-secondary font-medium">
              Expert planetary event annotations — the seed data for correlation &amp; rule discovery
            </p>
          </div>
          <button
            onClick={() => { setShowForm(true); setEditRow(null); setSaveError(null); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-indigo/20 border border-accent-indigo/40 rounded-xl text-sm font-semibold text-accent-indigo hover:bg-accent-indigo/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            New Entry
          </button>
        </header>

        {/* Stats strip */}
        {rows.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-6">
            <StatPill label="Total Entries" value={String(rows.length)} />
            <StatPill label="Bearish" value={String(rows.filter(r => r.market_impact === 'bearish').length)} />
            <StatPill label="Bullish" value={String(rows.filter(r => r.market_impact === 'bullish').length)} />
            <StatPill label="Volatile" value={String(rows.filter(r => r.market_impact === 'volatile').length)} />
          </div>
        )}

        {/* Filter bar */}
        {rows.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 mb-6">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search events, inferences, notes..."
                className="w-full pl-9 pr-3 py-2 bg-slate-900/60 border border-kd-border rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-accent-indigo/60 transition-colors"
              />
            </div>

            {/* Impact */}
            <select value={filterImpact} onChange={e => setFilterImpact(e.target.value)} className={selectCls}>
              <option value="">All Impacts</option>
              {MARKET_STATUS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>

            {/* Month — only months present in data */}
            <select
              value={filterMonth ?? ''}
              onChange={e => setFilterMonth(e.target.value ? Number(e.target.value) : null)}
              className={selectCls}
            >
              <option value="">All Months</option>
              {availableMonths.map(m => (
                <option key={m} value={m}>{MONTH_ABBR[m - 1]}</option>
              ))}
            </select>

            {/* Year */}
            <select
              value={filterYear ?? ''}
              onChange={e => setFilterYear(e.target.value ? Number(e.target.value) : null)}
              className={selectCls}
            >
              <option value="">All Years</option>
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            {/* Scope */}
            <select value={filterScope} onChange={e => setFilterScope(e.target.value)} className={selectCls}>
              {SCOPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            {/* Clear + count */}
            {isFiltered && (
              <>
                <button
                  onClick={clearFilters}
                  className="px-3 py-2 text-xs text-risk-amber hover:text-white border border-risk-amber/30 hover:border-white/20 rounded-xl transition-all"
                >
                  Clear
                </button>
                <span className="text-xs text-muted">
                  {filtered.length} of {rows.length}
                </span>
              </>
            )}
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24 gap-3">
            <Loader2 className="w-5 h-5 text-accent-indigo animate-spin" />
            <span className="text-sm text-muted">Loading inference data...</span>
          </div>
        ) : isError ? (
          <div className="glass-card rounded-3xl overflow-hidden">
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="w-14 h-14 rounded-2xl bg-risk-red/10 border border-risk-red/30 flex items-center justify-center mb-5">
                <AlertCircle className="w-7 h-7 text-risk-red" />
              </div>
              <p className="text-base font-semibold text-white mb-2">Failed to Load</p>
              <p className="text-sm text-muted max-w-sm">
                {error instanceof Error ? error.message : 'Could not connect to database.'}
              </p>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState onAdd={() => setShowForm(true)} />
        ) : (
          <div className="grid gap-4">
            {filtered.map(row => (
              <InferenceCard
                key={row.id}
                row={row}
                onEdit={handleEdit}
                onDelete={handleDelete}
                deleteConfirmId={deleteConfirm}
              />
            ))}
            {filtered.length === 0 && isFiltered && (
              <div className="text-center py-16">
                <p className="text-sm text-muted">No entries match your filters.</p>
                <button onClick={clearFilters} className="text-xs text-accent-indigo hover:underline mt-2">
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer note */}
        {rows.length > 0 && (
          <p className="text-[10px] text-muted mt-3 text-right mono">
            {rows.length} entries &middot; Rule Engine correlation coming soon
          </p>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <FormModal
          initial={formInitial}
          initialAppl={formAppl}
          editId={editRow?.id ?? null}
          onClose={handleClose}
          onSave={handleSave}
          isSaving={saveMutation.isPending}
          saveError={saveError}
        />
      )}

      {/* Loader overlay */}
      {(saveMutation.isPending || deleteMutation.isPending) && (
        <KaalaLoader
          message={deleteMutation.isPending ? 'Removing Entry' : editRow ? 'Updating Entry' : 'Saving Entry'}
          subtext="writing to inference database..."
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ErrorBoundary>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatPill({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn(
      'px-4 py-2 rounded-xl border text-xs',
      accent
        ? 'bg-accent-indigo/10 border-accent-indigo/30 text-accent-indigo'
        : 'bg-slate-900/50 border-white/5 text-slate-400'
    )}>
      <span className="text-muted">{label}: </span>
      <span className={cn('font-bold mono', accent ? 'text-accent-indigo' : 'text-white')}>{value}</span>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="glass-card rounded-3xl overflow-hidden">
      <div className="flex flex-col items-center justify-center py-24 text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-accent-indigo/10 border border-accent-indigo/20 flex items-center justify-center mb-6 text-2xl">
          ✦
        </div>
        <p className="text-lg font-semibold text-white mb-2">No Inference Data Yet</p>
        <p className="text-sm text-secondary max-w-md mb-2 leading-relaxed">
          Start by entering planetary events — what astrological conditions are active
          and what market behavior do you expect or observe?
        </p>
        <p className="text-xs text-muted max-w-sm mb-8 leading-relaxed">
          Examples: <span className="text-slate-400">"Rahu Mars in same sign"</span>,{' '}
          <span className="text-slate-400">"Saturn retrograde"</span>,{' '}
          <span className="text-slate-400">"Jupiter conjuncts Sun"</span>
        </p>
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-2 px-6 py-3 bg-accent-indigo/20 border border-accent-indigo/40 rounded-xl text-sm font-semibold text-accent-indigo hover:bg-accent-indigo/30 transition-all"
        >
          <Plus className="w-4 h-4" />
          Add First Entry
        </button>
      </div>
    </div>
  );
}
