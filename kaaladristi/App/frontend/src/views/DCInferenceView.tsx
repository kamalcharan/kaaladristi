import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X, ChevronDown, ChevronUp, AlertCircle, Loader2, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorBoundary } from '@/components/ui';
import {
  fetchInferences,
  createInference,
  updateInference,
  deleteInference,
} from '@/services/dcInference';
import type { DcInference, DcInferenceInput } from '@/types';
import { MARKET_STATUS, MARKET_STATUS_MAP, STATUS_COLOR_CLASSES } from '@/constants/marketStatus';

// ── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const EMPTY_FORM: DcInferenceInput = {
  astro_event:   '',
  start_date:    '',
  start_time:    null,
  end_date:      null,
  end_time:      null,
  inference:     null,
  market_impact: null,
  confidence:    null,
  notes:         null,
  created_by:    null,
};

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
  const from = row.start_time ? `${row.start_date} ${row.start_time.slice(0, 5)}` : row.start_date;
  if (!row.end_date) return `${from} → ongoing`;
  const to = row.end_time ? `${row.end_date} ${row.end_time.slice(0, 5)}` : row.end_date;
  return `${from} → ${to}`;
}

// ── Form Modal ────────────────────────────────────────────────────────────────

interface FormModalProps {
  initial: DcInferenceInput;
  editId: number | null;
  onClose: () => void;
  onSave: (data: DcInferenceInput) => void;
  isSaving: boolean;
  saveError: string | null;
}

function FormModal({ initial, editId, onClose, onSave, isSaving, saveError }: FormModalProps) {
  const [form, setForm] = useState<DcInferenceInput>(initial);

  const set = (field: keyof DcInferenceInput, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value || null }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.astro_event.trim() || !form.start_date) return;
    onSave({ ...form, astro_event: form.astro_event.trim() });
  };

  const isValid = form.astro_event.trim() && form.start_date;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-[#0f172a] border border-kd-border rounded-3xl shadow-2xl shadow-black/60 overflow-hidden">

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

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-6 max-h-[80vh] overflow-y-auto">

          {/* Astro Event */}
          <div>
            <label className="block text-[11px] uppercase tracking-widest font-bold text-muted mb-2">
              Astro Event <span className="text-risk-red">*</span>
            </label>
            <input
              type="text"
              value={form.astro_event}
              onChange={e => setForm(p => ({ ...p, astro_event: e.target.value }))}
              placeholder="e.g. Rahu Mars in same sign, Neptune conjuncts Mars"
              className="w-full px-4 py-3 bg-slate-900/60 border border-kd-border rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-accent-indigo/60 transition-colors"
              required
            />
          </div>

          {/* Date + Time range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] uppercase tracking-widest font-bold text-muted mb-2">
                Start Date <span className="text-risk-red">*</span>
              </label>
              <input
                type="date"
                value={form.start_date}
                onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-900/60 border border-kd-border rounded-xl text-sm text-white focus:outline-none focus:border-accent-indigo/60 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-widest font-bold text-muted mb-2">
                Start Time <span className="text-slate-600">(optional)</span>
              </label>
              <input
                type="time"
                value={form.start_time ?? ''}
                onChange={e => set('start_time', e.target.value)}
                className="w-full px-4 py-3 bg-slate-900/60 border border-kd-border rounded-xl text-sm text-white focus:outline-none focus:border-accent-indigo/60 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-widest font-bold text-muted mb-2">
                End Date <span className="text-slate-600">(optional)</span>
              </label>
              <input
                type="date"
                value={form.end_date ?? ''}
                onChange={e => setForm(p => ({ ...p, end_date: e.target.value || null }))}
                min={form.start_date || undefined}
                className="w-full px-4 py-3 bg-slate-900/60 border border-kd-border rounded-xl text-sm text-white focus:outline-none focus:border-accent-indigo/60 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-widest font-bold text-muted mb-2">
                End Time <span className="text-slate-600">(optional)</span>
              </label>
              <input
                type="time"
                value={form.end_time ?? ''}
                onChange={e => set('end_time', e.target.value)}
                className="w-full px-4 py-3 bg-slate-900/60 border border-kd-border rounded-xl text-sm text-white focus:outline-none focus:border-accent-indigo/60 transition-colors"
              />
            </div>
          </div>

          {/* Inference */}
          <div>
            <label className="block text-[11px] uppercase tracking-widest font-bold text-muted mb-2">
              Inference
            </label>
            <textarea
              value={form.inference ?? ''}
              onChange={e => set('inference', e.target.value)}
              placeholder="What does this planetary event mean for markets? What did you observe or expect?"
              rows={3}
              className="w-full px-4 py-3 bg-slate-900/60 border border-kd-border rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-accent-indigo/60 transition-colors resize-none"
            />
          </div>

          {/* Market Impact */}
          <div>
            <label className="block text-[11px] uppercase tracking-widest font-bold text-muted mb-2">
              Market Impact
            </label>
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
                      'px-4 py-2 rounded-xl text-xs font-semibold border transition-all',
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

          {/* Confidence */}
          <div>
            <label className="block text-[11px] uppercase tracking-widest font-bold text-muted mb-2">
              Confidence
            </label>
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

          {/* Notes */}
          <div>
            <label className="block text-[11px] uppercase tracking-widest font-bold text-muted mb-2">
              Notes <span className="text-slate-600">(optional)</span>
            </label>
            <textarea
              value={form.notes ?? ''}
              onChange={e => set('notes', e.target.value)}
              placeholder="Additional context, sources, references..."
              rows={2}
              className="w-full px-4 py-3 bg-slate-900/60 border border-kd-border rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-accent-indigo/60 transition-colors resize-none"
            />
          </div>

          {/* Error */}
          {saveError && (
            <div className="flex items-start gap-3 p-4 bg-risk-red/10 border border-risk-red/30 rounded-xl">
              <AlertCircle className="w-4 h-4 text-risk-red mt-0.5 shrink-0" />
              <p className="text-xs text-risk-red">{saveError}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-kd-border">
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

// ── Row component (expandable) ────────────────────────────────────────────────

function InferenceRow({
  row,
  onEdit,
  onDelete,
}: {
  row: DcInference;
  onEdit: (row: DcInference) => void;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr className="border-t border-kd-border hover:bg-slate-900/30 transition-colors group">
        {/* Astro Event */}
        <td className="px-5 py-4">
          <p className="text-sm font-semibold text-white leading-snug">{row.astro_event}</p>
          {row.notes && (
            <p className="text-[11px] text-muted mt-0.5 line-clamp-1">{row.notes}</p>
          )}
        </td>

        {/* Month */}
        <td className="px-5 py-4 whitespace-nowrap">
          <span className="text-[12px] mono text-slate-300">
            {row.month ? MONTH_NAMES[row.month - 1] : '—'}
          </span>
        </td>

        {/* Year */}
        <td className="px-5 py-4 whitespace-nowrap">
          <span className="text-[12px] mono text-slate-300">{row.year ?? '—'}</span>
        </td>

        {/* Period */}
        <td className="px-5 py-4 whitespace-nowrap">
          <span className="text-[12px] mono text-slate-300">{formatDateRange(row)}</span>
        </td>

        {/* Impact */}
        <td className="px-5 py-4">
          <ImpactBadge impact={row.market_impact} />
        </td>

        {/* Confidence */}
        <td className="px-5 py-4">
          <ConfidenceDots value={row.confidence} />
        </td>

        {/* Expand / Actions */}
        <td className="px-5 py-4">
          <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            {row.inference && (
              <button
                onClick={() => setExpanded(v => !v)}
                title="Toggle inference"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-all"
              >
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
            <button
              onClick={() => onEdit(row)}
              title="Edit"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-accent-indigo hover:bg-accent-indigo/10 transition-all"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(row.id)}
              title="Delete"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-risk-red hover:bg-risk-red/10 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded inference */}
      {expanded && row.inference && (
        <tr className="border-t border-kd-border/50">
          <td colSpan={7} className="px-5 pb-4 pt-2">
            <div className="pl-3 border-l-2 border-accent-indigo/40">
              <p className="text-[11px] uppercase tracking-widest font-bold text-muted mb-1.5">Inference</p>
              <p className="text-sm text-slate-300 leading-relaxed">{row.inference}</p>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────

export default function DCInferenceView() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow] = useState<DcInference | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [filterMonth, setFilterMonth] = useState<number | null>(null);
  const [filterYear, setFilterYear] = useState<number | null>(null);

  const { data: rows = [], isLoading, isError, error } = useQuery({
    queryKey: ['dc_inference'],
    queryFn: fetchInferences,
    staleTime: 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: { id: number | null; data: DcInferenceInput }) => {
      if (payload.id) {
        return updateInference(payload.id, payload.data);
      }
      return createInference(payload.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dc_inference'] });
      setShowForm(false);
      setEditRow(null);
      setSaveError(null);
    },
    onError: (err: Error) => setSaveError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteInference,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dc_inference'] });
      setDeleteConfirm(null);
    },
  });

  const handleEdit = (row: DcInference) => {
    setEditRow(row);
    setShowForm(true);
    setSaveError(null);
  };

  const handleClose = () => {
    setShowForm(false);
    setEditRow(null);
    setSaveError(null);
  };

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

  // Unique years from data for the year filter
  const availableYears = useMemo(() =>
    [...new Set(rows.map(r => r.year).filter(Boolean) as number[])].sort((a, b) => b - a),
    [rows]
  );

  // Filtered rows
  const filtered = useMemo(() => rows.filter(r =>
    (filterMonth === null || r.month === filterMonth) &&
    (filterYear  === null || r.year  === filterYear)
  ), [rows, filterMonth, filterYear]);

  // Derive April 2026 entries count for context
  const aprilCount = rows.filter(r => r.month === 4 && r.year === 2026).length;

  const formInitial: DcInferenceInput = editRow
    ? {
        astro_event:   editRow.astro_event,
        start_date:    editRow.start_date,
        start_time:    editRow.start_time,
        end_date:      editRow.end_date ?? null,
        end_time:      editRow.end_time,
        inference:     editRow.inference,
        market_impact: editRow.market_impact,
        confidence:    editRow.confidence,
        notes:         editRow.notes,
        created_by:    editRow.created_by,
      }
    : { ...EMPTY_FORM };

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
            {aprilCount > 0 && <StatPill label="April 2026" value={String(aprilCount)} accent />}
            <StatPill
              label="Bearish"
              value={String(rows.filter(r => r.market_impact === 'bearish').length)}
            />
            <StatPill
              label="Bullish"
              value={String(rows.filter(r => r.market_impact === 'bullish').length)}
            />
            <StatPill
              label="Volatile"
              value={String(rows.filter(r => r.market_impact === 'volatile').length)}
            />
          </div>
        )}

        {/* Filter bar */}
        {rows.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center gap-1.5 text-muted">
              <Filter className="w-3.5 h-3.5" />
              <span className="text-[11px] uppercase tracking-widest font-bold">Filter</span>
            </div>

            {/* Month filter */}
            <select
              value={filterMonth ?? ''}
              onChange={e => setFilterMonth(e.target.value ? Number(e.target.value) : null)}
              className="px-3 py-1.5 bg-slate-900/60 border border-kd-border rounded-xl text-xs text-slate-300 focus:outline-none focus:border-accent-indigo/60 transition-colors"
            >
              <option value="">All Months</option>
              {MONTH_NAMES.map((name, i) => (
                <option key={i + 1} value={i + 1}>{name}</option>
              ))}
            </select>

            {/* Year filter */}
            <select
              value={filterYear ?? ''}
              onChange={e => setFilterYear(e.target.value ? Number(e.target.value) : null)}
              className="px-3 py-1.5 bg-slate-900/60 border border-kd-border rounded-xl text-xs text-slate-300 focus:outline-none focus:border-accent-indigo/60 transition-colors"
            >
              <option value="">All Years</option>
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            {(filterMonth !== null || filterYear !== null) && (
              <button
                onClick={() => { setFilterMonth(null); setFilterYear(null); }}
                className="px-3 py-1.5 text-xs text-risk-amber hover:text-white border border-risk-amber/30 hover:border-white/20 rounded-xl transition-all"
              >
                Clear
              </button>
            )}

            {(filterMonth !== null || filterYear !== null) && (
              <span className="text-xs text-muted ml-1">
                {filtered.length} of {rows.length}
              </span>
            )}
          </div>
        )}

        {/* Content */}
        <div className="glass-card rounded-3xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-24 gap-3">
              <Loader2 className="w-5 h-5 text-accent-indigo animate-spin" />
              <span className="text-sm text-muted">Loading inference data...</span>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="w-14 h-14 rounded-2xl bg-risk-red/10 border border-risk-red/30 flex items-center justify-center mb-5">
                <AlertCircle className="w-7 h-7 text-risk-red" />
              </div>
              <p className="text-base font-semibold text-white mb-2">Failed to Load</p>
              <p className="text-sm text-muted max-w-sm">
                {error instanceof Error ? error.message : 'Could not connect to database.'}
              </p>
              <p className="text-xs text-muted mt-3 mono">
                Run km_migration_004_dc_inference.sql on your PostgreSQL database first.
              </p>
            </div>
          ) : rows.length === 0 ? (
            <EmptyState onAdd={() => setShowForm(true)} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-muted">
                    <th className="px-5 py-4 text-left font-bold">Astro Event</th>
                    <th className="px-5 py-4 text-left font-bold">Month</th>
                    <th className="px-5 py-4 text-left font-bold">Year</th>
                    <th className="px-5 py-4 text-left font-bold">Period</th>
                    <th className="px-5 py-4 text-left font-bold">Impact</th>
                    <th className="px-5 py-4 text-left font-bold">Confidence</th>
                    <th className="px-5 py-4 text-right font-bold"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(row => (
                    <InferenceRow
                      key={row.id}
                      row={row}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Delete confirm hint */}
        {deleteConfirm && (
          <p className="text-xs text-risk-amber text-center mt-3">
            Click delete again to confirm removal
          </p>
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
          editId={editRow?.id ?? null}
          onClose={handleClose}
          onSave={handleSave}
          isSaving={saveMutation.isPending}
          saveError={saveError}
        />
      )}
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
    <div className="flex flex-col items-center justify-center py-24 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-accent-indigo/10 border border-accent-indigo/20 flex items-center justify-center mb-6 text-2xl">
        ✦
      </div>
      <p className="text-lg font-semibold text-white mb-2">No Inference Data Yet</p>
      <p className="text-sm text-secondary max-w-md mb-2 leading-relaxed">
        Start by entering planetary events for <span className="text-white font-medium">April 2026</span> — what
        astrological conditions are active and what market behavior do you expect or observe?
      </p>
      <p className="text-xs text-muted max-w-sm mb-8 leading-relaxed">
        Examples: <span className="text-slate-400">"Rahu Mars in same sign"</span>, <span className="text-slate-400">"Saturn retrograde"</span>,{' '}
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
  );
}
