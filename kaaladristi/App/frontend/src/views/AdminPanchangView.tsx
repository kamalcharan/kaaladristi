import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, ChevronRight, Loader2, AlertCircle, Plus, Trash2, Check, X, Moon, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MONTH_FULL } from '@/lib/dateUtils';
import {
  fetchPanchangCalendar,
  fetchSectors,
  createPanchangNote,
  updatePanchangNote,
  deletePanchangNote,
  generatePanchangMonth,
  type PanchangRow,
  type PanchangNote,
  type NotePayload,
  type MarketImpact,
  type PanchangScope,
  IMPACT_OPTIONS,
  SIGNAL_LABELS,
  impactToColor,
  SIGNAL_CLASSES,
  SCOPE_OPTIONS,
} from '@/services/panchangService';

// ── Label pill ────────────────────────────────────────────────────────────────

function LabelPill({ label }: { label: MarketImpact }) {
  const cls = SIGNAL_CLASSES[impactToColor(label)];
  return (
    <span className={cn(
      'text-[10px] font-semibold px-1.5 py-0.5 rounded border leading-none shrink-0',
      cls.text, cls.bg, cls.border,
    )}>
      {SIGNAL_LABELS[label] ?? label}
    </span>
  );
}

// ── Label select ──────────────────────────────────────────────────────────────

function LabelSelect({ value, onChange }: { value: MarketImpact; onChange: (v: MarketImpact) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as MarketImpact)}
      className="text-xs bg-slate-800 border border-white/10 rounded px-2 py-1.5 text-white focus:outline-none focus:border-accent-indigo/50"
    >
      {IMPACT_OPTIONS.map(opt => (
        <option key={opt} value={opt}>{SIGNAL_LABELS[opt]}</option>
      ))}
    </select>
  );
}

// ── Sector multi-select ───────────────────────────────────────────────────────

function SectorSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: sectors = [] } = useQuery<string[]>({
    queryKey: ['sectors_list'],
    queryFn: fetchSectors,
    staleTime: 60 * 60 * 1000,
  });

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="text-xs bg-slate-800 border border-white/10 rounded px-2 py-1.5 text-white w-48 focus:outline-none focus:border-accent-indigo/50"
    >
      <option value="">— select sector —</option>
      {sectors.map(s => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}

// ── Editable note row ─────────────────────────────────────────────────────────

interface NoteRowProps {
  note: PanchangNote;
  onSave: (id: number, payload: NotePayload) => void;
  onDelete: (id: number) => void;
  saving: boolean;
}

function NoteRow({ note, onSave, onDelete, saving }: NoteRowProps) {
  const [editing, setEditing]       = useState(false);
  const [label, setLabel]           = useState<MarketImpact>(note.calendar_label);
  const [scope, setScope]           = useState<PanchangScope>(note.scope);
  const [scopeVal, setScopeVal]     = useState(note.scope_value ?? '');
  const [annotation, setAnnotation] = useState(note.annotation ?? '');

  function save() {
    onSave(note.id, {
      trade_date:     note.trade_date,
      calendar_label: label,
      scope,
      scope_value:  scopeVal || null,
      annotation:   annotation || null,
      sort_order:   note.sort_order,
    });
    setEditing(false);
  }

  function cancel() {
    setLabel(note.calendar_label);
    setScope(note.scope);
    setScopeVal(note.scope_value ?? '');
    setAnnotation(note.annotation ?? '');
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex items-start gap-2 p-2 rounded border border-white/8 bg-white/[0.02] text-xs">
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <LabelPill label={note.calendar_label} />
            {note.scope !== 'market' && (
              <span className="text-[10px] text-muted uppercase tracking-wide">
                {note.scope}:
              </span>
            )}
            {note.scope_value && (
              <span className="text-secondary text-[11px] font-medium">{note.scope_value}</span>
            )}
          </div>
          {note.annotation && (
            <span className="text-muted italic text-[11px] leading-snug">{note.annotation}</span>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => setEditing(true)}
            className="text-[10px] text-muted hover:text-white px-1.5 py-0.5 rounded border border-white/10 hover:bg-white/10 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(note.id)}
            disabled={saving}
            className="p-0.5 text-muted hover:text-risk-red transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  // Edit mode
  return (
    <div className="flex flex-col gap-2 p-2.5 rounded border border-accent-indigo/30 bg-accent-indigo/5">
      <div className="flex gap-2 flex-wrap items-center">
        <LabelSelect value={label} onChange={setLabel} />
        <select
          value={scope}
          onChange={e => { setScope(e.target.value as PanchangScope); setScopeVal(''); }}
          className="text-xs bg-slate-800 border border-white/10 rounded px-2 py-1.5 text-white focus:outline-none focus:border-accent-indigo/50"
        >
          {SCOPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {scope === 'sector'    && <SectorSelect value={scopeVal} onChange={setScopeVal} />}
        {scope !== 'market' && scope !== 'sector' && (
          <input
            type="text"
            value={scopeVal}
            onChange={e => setScopeVal(e.target.value)}
            placeholder={
              scope === 'commodity' ? 'Gold, Silver, Crude…' :
              scope === 'planet'    ? 'Jupiter, Venus…'       :
                                     'USDINR, EURINR…'
            }
            className="text-xs bg-slate-800 border border-white/10 rounded px-2 py-1.5 text-white w-40 focus:outline-none focus:border-accent-indigo/50"
          />
        )}
      </div>
      <input
        type="text"
        value={annotation}
        onChange={e => setAnnotation(e.target.value)}
        placeholder="Note…"
        className="text-xs bg-slate-800 border border-white/10 rounded px-2 py-1.5 text-white w-full focus:outline-none focus:border-accent-indigo/50"
      />
      <div className="flex gap-1.5">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-risk-green/20 border border-risk-green/40 text-risk-green hover:bg-risk-green/30 transition-colors"
        >
          <Check className="w-3 h-3" /> Save
        </button>
        <button onClick={cancel} className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-slate-800 border border-white/10 text-muted hover:text-white transition-colors">
          <X className="w-3 h-3" /> Cancel
        </button>
      </div>
    </div>
  );
}

// ── New note form (always expanded inline) ────────────────────────────────────

interface NewNoteFormProps {
  tradeDate: string;
  onAdd: (payload: NotePayload) => void;
  saving: boolean;
}

function NewNoteForm({ tradeDate, onAdd, saving }: NewNoteFormProps) {
  const [label, setLabel]           = useState<MarketImpact>('neutral');
  const [scope, setScope]           = useState<PanchangScope>('market');
  const [scopeVal, setScopeVal]     = useState('');
  const [annotation, setAnnotation] = useState('');

  function submit() {
    onAdd({
      trade_date:     tradeDate,
      calendar_label: label,
      scope,
      scope_value:  scopeVal || null,
      annotation:   annotation || null,
    });
    setScopeVal('');
    setAnnotation('');
  }

  const canAdd = scope === 'market' || Boolean(scopeVal);

  return (
    <div className="flex flex-col gap-1.5 p-2 rounded border border-white/[0.06] bg-white/[0.02] mt-1">
      <div className="flex gap-1.5 flex-wrap items-center">
        <LabelSelect value={label} onChange={setLabel} />
        <select
          value={scope}
          onChange={e => { setScope(e.target.value as PanchangScope); setScopeVal(''); }}
          className="text-xs bg-slate-800 border border-white/10 rounded px-2 py-1.5 text-white focus:outline-none focus:border-accent-indigo/50"
        >
          {SCOPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {scope === 'sector' && <SectorSelect value={scopeVal} onChange={setScopeVal} />}
        {scope !== 'market' && scope !== 'sector' && (
          <input
            type="text"
            value={scopeVal}
            onChange={e => setScopeVal(e.target.value)}
            placeholder={
              scope === 'commodity' ? 'Gold, Silver, Crude…' :
              scope === 'planet'    ? 'Jupiter, Venus…'       :
                                     'USDINR, EURINR…'
            }
            className="text-xs bg-slate-800 border border-white/10 rounded px-2 py-1.5 text-white w-40 focus:outline-none focus:border-accent-indigo/50"
          />
        )}
        <input
          type="text"
          value={annotation}
          onChange={e => setAnnotation(e.target.value)}
          placeholder="Note (optional)…"
          className="text-xs bg-slate-800 border border-white/10 rounded px-2 py-1.5 text-white flex-1 min-w-[140px] focus:outline-none focus:border-accent-indigo/50"
          onKeyDown={e => e.key === 'Enter' && canAdd && submit()}
        />
        <button
          onClick={submit}
          disabled={saving || !canAdd}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded bg-accent-indigo/20 border border-accent-indigo/40 text-accent-indigo hover:bg-accent-indigo/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>
    </div>
  );
}

// ── Panchang row in spreadsheet ───────────────────────────────────────────────

function AdminPanchangRow({ row, onAddNote, onSaveNote, onDeleteNote, saving }: {
  row: PanchangRow;
  onAddNote: (payload: NotePayload) => void;
  onSaveNote: (id: number, payload: NotePayload) => void;
  onDeleteNote: (id: number) => void;
  saving: boolean;
}) {
  const weekend = row.weekday === 'Saturday' || row.weekday === 'Sunday';
  const parts   = row.trade_date.split('-');
  const dd      = parts[2];
  const mmm     = MONTH_FULL[parseInt(parts[1]) - 1]?.slice(0, 3);

  function nakStr() {
    const endSuffix = row.nakshatra_end_time ? ` (till ${row.nakshatra_end_time})` : '';
    if (row.nakshatra_next && row.nakshatra_change_time)
      return `${row.nakshatra} → ${row.nakshatra_next} ${row.nakshatra_change_time}${endSuffix}`;
    if (row.nakshatra_next) return `${row.nakshatra} → ${row.nakshatra_next}${endSuffix}`;
    return `${row.nakshatra}${endSuffix}`;
  }

  function rashiStr() {
    if (row.moon_rashi_next && row.moon_rashi_change_time)
      return `${row.moon_rashi} → ${row.moon_rashi_next} ${row.moon_rashi_change_time}`;
    if (row.moon_rashi_next) return `${row.moon_rashi} → ${row.moon_rashi_next}`;
    return row.moon_rashi;
  }

  return (
    <tr className={cn('border-b border-white/5', weekend && 'opacity-40')}>
      {/* Date */}
      <td className="px-3 py-2 align-top whitespace-nowrap w-20">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-white">{dd} {mmm}</span>
          <span className="text-[10px] text-muted">{row.weekday.slice(0, 3)}</span>
        </div>
      </td>

      {/* Tithi */}
      <td className="px-3 py-2 align-top w-44">
        <span className="text-xs text-secondary leading-relaxed">{
          row.tithi_end_time
            ? `${row.tithi} (till ${row.tithi_end_time})`
            : row.tithi
        }</span>
      </td>

      {/* Moon Rashi */}
      <td className="px-3 py-2 align-top w-44">
        <span className="text-xs text-secondary">{rashiStr()}</span>
      </td>

      {/* Nakshatra */}
      <td className="px-3 py-2 align-top w-52">
        <span className="text-xs text-secondary">{nakStr()}</span>
        <div className="text-[10px] text-muted mt-0.5">{row.nak_lord}</div>
      </td>

      {/* Signals / Annotations */}
      <td className="px-3 py-2 align-top">
        <div className="flex flex-col gap-1.5">
          {row.notes.map(n => (
            <NoteRow
              key={n.id}
              note={n}
              onSave={onSaveNote}
              onDelete={onDeleteNote}
              saving={saving}
            />
          ))}
          <NewNoteForm
            tradeDate={row.trade_date}
            onAdd={onAddNote}
            saving={saving}
          />
        </div>
      </td>
    </tr>
  );
}

// ── Main admin view ───────────────────────────────────────────────────────────

export default function AdminPanchangView() {
  const today   = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [genMsg, setGenMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const qc = useQueryClient();

  const cacheKey = ['panchang_calendar', year, month];

  const { data, isLoading, error } = useQuery<PanchangRow[]>({
    queryKey: cacheKey,
    queryFn:  () => fetchPanchangCalendar(year, month),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const createMut = useMutation({
    mutationFn: createPanchangNote,
    onSuccess: () => qc.invalidateQueries({ queryKey: cacheKey }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: NotePayload }) =>
      updatePanchangNote(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: cacheKey }),
  });

  const deleteMut = useMutation({
    mutationFn: deletePanchangNote,
    onSuccess: () => qc.invalidateQueries({ queryKey: cacheKey }),
  });

  const generateMut = useMutation({
    mutationFn: () => generatePanchangMonth(year, month),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: cacheKey });
      const errText = result.errors.length > 0 ? ` (${result.errors.length} errors)` : '';
      setGenMsg({ ok: result.errors.length === 0, text: `Generated ${result.upserted} days${errText}` });
      setTimeout(() => setGenMsg(null), 5000);
    },
    onError: (e) => {
      setGenMsg({ ok: false, text: e instanceof Error ? e.message : 'Generation failed' });
      setTimeout(() => setGenMsg(null), 8000);
    },
  });

  const saving = createMut.isPending || updateMut.isPending || deleteMut.isPending;

  function prev() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function next() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Moon className="w-4 h-4 text-accent-indigo" />
          <h1 className="text-base font-semibold text-white">Panchang Admin</h1>
          <span className="text-xs text-muted bg-accent-indigo/10 border border-accent-indigo/30 rounded px-2 py-0.5">
            Admin
          </span>
        </div>
        <div className="flex items-center gap-3">
          {saving && <Loader2 className="w-3.5 h-3.5 text-accent-indigo animate-spin" />}

          {/* Generate button */}
          <button
            onClick={() => generateMut.mutate()}
            disabled={generateMut.isPending}
            title={`Generate panchang for ${MONTH_FULL[month - 1]} ${year}`}
            className={cn(
              'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all',
              generateMut.isPending
                ? 'opacity-50 cursor-not-allowed border-white/10 text-muted'
                : 'border-accent-indigo/40 text-accent-indigo hover:bg-accent-indigo/10 hover:border-accent-indigo/60',
            )}
          >
            {generateMut.isPending
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <RefreshCw className="w-3 h-3" />
            }
            Generate
          </button>

          {/* Status flash */}
          {genMsg && (
            <span className={cn(
              'text-xs px-2 py-1 rounded border',
              genMsg.ok
                ? 'text-risk-green bg-risk-green/10 border-risk-green/30'
                : 'text-risk-amber bg-risk-amber/10 border-risk-amber/30',
            )}>
              {genMsg.text}
            </span>
          )}

          <div className="flex items-center gap-1">
            <button onClick={prev} className="p-1.5 rounded-lg hover:bg-white/10 text-secondary transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <select
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
              className="text-sm bg-slate-800/80 border border-white/10 rounded-lg px-2 py-1 text-white focus:outline-none focus:border-accent-indigo/50"
            >
              {MONTH_FULL.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
            <input
              type="number"
              value={year}
              onChange={e => { const v = Number(e.target.value); if (v >= 1900 && v <= 2100) setYear(v); }}
              className="w-20 text-sm bg-slate-800/80 border border-white/10 rounded-lg px-2 py-1 text-white text-center focus:outline-none focus:border-accent-indigo/50"
            />
            <button onClick={next} className="p-1.5 rounded-lg hover:bg-white/10 text-secondary transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 py-3">
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-accent-indigo animate-spin" />
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 text-risk-red text-sm py-8 justify-center">
            <AlertCircle className="w-4 h-4" />
            {error instanceof Error ? error.message : 'Failed to load panchang data'}
          </div>
        )}
        {!isLoading && !error && (!data || data.length === 0) && (
          <div className="text-center py-16 text-muted text-sm">
            No panchang data for {MONTH_FULL[month - 1]} {year}.
            <br />
            <span className="text-xs opacity-60 block mt-2">
              Click <strong className="text-accent-indigo">Generate</strong> above to compute and load this month.
            </span>
          </div>
        )}
        {!isLoading && data && data.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10">
                  {['Date', 'Tithi', 'Moon Rashi', 'Nakshatra / Lord', 'Signals / Annotations'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-[11px] font-semibold text-muted uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map(row => (
                  <AdminPanchangRow
                    key={row.trade_date}
                    row={row}
                    onAddNote={payload => createMut.mutate(payload)}
                    onSaveNote={(id, payload) => updateMut.mutate({ id, payload })}
                    onDeleteNote={id => deleteMut.mutate(id)}
                    saving={saving}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
