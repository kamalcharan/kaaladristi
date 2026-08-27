import React, { useMemo, useRef, useState, useEffect } from 'react';
import type { ScanStock } from '@/types';
import { DOT_OPTIONS } from '@/constants/signalScale';

// ─── Interface ────────────────────────────────────────────────────────────────

export interface ScanFilters {
  mcapMin?: number;
  mcapMax?: number;
  industries?: string[];
  move5dMax?: number;
  move22dMax?: number;
  move66dMax?: number;
  surgeMin?: number;
  deliveryPctMin?: number;
  rvolMin?: number;
  pctFromBreakoutMin?: number;
  pctFromBreakoutMax?: number;
  /** Minimum Score 5D — money-flow conviction (equity scale: median ≈ 5, top decile ≈ 28). */
  score5dMin?: number;
  /** Minimum Score 22D. */
  score22dMin?: number;
  /** Doctrine filter: Score 5D > 0 AND Score 5D ≥ Score 22D (conviction building). */
  accelerating?: boolean;
  // ── Flower Pot Burst-specific ──
  /** Release direction / phase: all | burst (up) | shatter (down) | coiling (watchlist). */
  fpbPhase?: 'all' | 'burst' | 'shatter' | 'coiling';
  /** Minimum compression tightness (fpb_compression_score). */
  tightnessMin?: number;
  /** Minimum consecutive coiled days in the last 22 sessions (fpb_setup_days). */
  coiledDaysMin?: number;
  // ── Volume Drive-specific ──
  /** Which dot signals to keep. Empty/undefined = all. Values: 'SVD' | 'SBD' | 'SYD'. */
  dots?: string[];
  // ── Waking Giants-specific ──
  /** Only wakes within this many days. 90 | 120 | 150; 150 is also the hard
   *  fetch cap in scanEngine — beyond it nothing is loaded at all. */
  wakeWindowDays?: number;
}

export const EMPTY_FILTERS: ScanFilters = {};

// Flower Pot Burst starts with NO market-cap floor — genuine coils are common in
// small caps, and the compression gate already enforces a ₹20 price floor. The
// generic ₹100 Cr default silently dropped them (the "no data" report).
export const FPB_DEFAULT_FILTERS: ScanFilters = {};

// Applied on load / preset switch (owner request 2026-07-12): a gentle ₹100 Cr
// market-cap floor. Note it only bites stocks with a KNOWN mcap (mostly NSE) —
// BSE mcap is ~88% missing, so most BSE stocks have no mcap and still show
// (see applyFilters: mcap filters skip unknown-mcap rows).
export const DEFAULT_FILTERS: ScanFilters = { mcapMin: 100 };

// The Waking Giants pool already enforces its own market-cap and combined-ADV
// floors, so the generic Rs 100 Cr default would be a second, redundant gate.
// What these tabs open with instead is the wake window.
export const JOURNEY_DEFAULT_FILTERS: ScanFilters = { wakeWindowDays: 90 };

// Waking ONLY. Ascent is deliberately excluded: a stock there has woken AND
// confirmed, so a wake eight months old is the success case, not staleness --
// filtering Ascent by wake age would throw away exactly the journeys that
// worked. Stirring has no wake_date at all.
const JOURNEY_WAKE_PRESETS = new Set(['waking_giants']);

const STAGE_PRESETS = new Set([
  'stage_2_leaders', 'stage_2_watch',
  'stage_3_watch', 'stage_4_leaders', 'vani_exit_watch',
]);

type FilterGroup = 'stage' | 'conviction' | 'breakout' | 'fpb' | 'drive' | 'journey' | 'standard';

function getFilterGroup(presetId: string): FilterGroup {
  if (JOURNEY_WAKE_PRESETS.has(presetId)) return 'journey';
  if (STAGE_PRESETS.has(presetId)) return 'stage';
  if (presetId === 'conviction_flow') return 'conviction';
  if (presetId === 'breakout_surge') return 'breakout';
  if (presetId === 'flower_pot_burst') return 'fpb';
  if (presetId === 'volume_drive') return 'drive';
  return 'standard';
}

// ─── Pure filter logic (used by ScanView) ─────────────────────────────────────

export function applyFilters(stocks: ScanStock[], filters: ScanFilters): ScanStock[] {
  const { mcapMin, mcapMax, industries, move5dMax, move22dMax, move66dMax,
    surgeMin, deliveryPctMin, rvolMin, pctFromBreakoutMin, pctFromBreakoutMax,
    score5dMin, score22dMin, accelerating,
    fpbPhase, tightnessMin, coiledDaysMin, dots, wakeWindowDays } = filters;

  if (
    mcapMin == null && mcapMax == null &&
    (!industries || industries.length === 0) &&
    move5dMax == null && move22dMax == null && move66dMax == null &&
    surgeMin == null && deliveryPctMin == null && rvolMin == null &&
    pctFromBreakoutMin == null && pctFromBreakoutMax == null &&
    score5dMin == null && score22dMin == null && !accelerating &&
    (!fpbPhase || fpbPhase === 'all') && tightnessMin == null && coiledDaysMin == null &&
    (!dots || dots.length === 0) && wakeWindowDays == null
  ) return stocks;

  return stocks.filter((s) => {
    // mcap filters apply only to stocks with a KNOWN market cap. BSE mcap is
    // ~88% missing; treating null as 0/∞ would wrongly hide most of BSE.
    if (mcapMin != null && s.mcap_cr != null && s.mcap_cr < mcapMin) return false;
    if (mcapMax != null && s.mcap_cr != null && s.mcap_cr > mcapMax) return false;
    if (industries && industries.length > 0 && !industries.includes(s.industry ?? '')) return false;
    if (move5dMax != null && s.ret_5d != null && Math.abs(s.ret_5d) > move5dMax) return false;
    if (move22dMax != null && s.ret_22d != null && Math.abs(s.ret_22d) > move22dMax) return false;
    if (move66dMax != null && s.ret_66d != null && Math.abs(s.ret_66d) > move66dMax) return false;
    if (surgeMin != null && (s.delivery_surge_x ?? 0) < surgeMin) return false;
    if (deliveryPctMin != null && (s.delivery_pct ?? 0) < deliveryPctMin) return false;
    if (rvolMin != null && (s.rvol ?? 0) < rvolMin) return false;
    if (pctFromBreakoutMin != null && s.pct_from_breakout != null && s.pct_from_breakout < pctFromBreakoutMin) return false;
    if (pctFromBreakoutMax != null && s.pct_from_breakout != null && s.pct_from_breakout > pctFromBreakoutMax) return false;
    if (score5dMin  != null && (s.score_5d  ?? -1) < score5dMin)  return false;
    if (score22dMin != null && (s.score_22d ?? -1) < score22dMin) return false;
    if (accelerating && !((s.score_5d ?? 0) > 0 && (s.score_5d ?? 0) >= (s.score_22d ?? 0))) return false;
    if (tightnessMin != null && (s.fpb_compression_score ?? 0) < tightnessMin) return false;
    if (coiledDaysMin != null && (s.fpb_setup_days ?? 0) < coiledDaysMin) return false;
    // Dot filter: a row with no dot is excluded whenever any dot is selected —
    // the point of the control is "show me only these signals".
    if (dots && dots.length > 0 && !dots.includes(s.dot_signal ?? '')) return false;
    // Wake window. A row with no wake_date (Stirring, or a journey that has
    // not woken) is KEPT — the window narrows wakes, it does not demand one.
    if (wakeWindowDays != null && s.wake_date) {
      const cutoff = new Date(Date.now() - wakeWindowDays * 86400000)
        .toISOString().slice(0, 10);
      if (s.wake_date < cutoff) return false;
    }
    if (fpbPhase && fpbPhase !== 'all') {
      const want = fpbPhase === 'burst' ? 'BURST' : fpbPhase === 'shatter' ? 'SHATTER' : 'SETUP';
      if (s.fpb_phase !== want) return false;
    }
    return true;
  });
}

export function hasActiveFilters(f: ScanFilters): boolean {
  return !!(
    f.mcapMin != null || f.mcapMax != null ||
    (f.industries && f.industries.length > 0) ||
    f.move5dMax != null || f.move22dMax != null || f.move66dMax != null ||
    f.surgeMin != null || f.deliveryPctMin != null || f.rvolMin != null ||
    f.pctFromBreakoutMin != null || f.pctFromBreakoutMax != null ||
    f.score5dMin != null || f.score22dMin != null || !!f.accelerating ||
    (f.fpbPhase != null && f.fpbPhase !== 'all') || f.tightnessMin != null || f.coiledDaysMin != null ||
    (f.dots != null && f.dots.length > 0) ||
    (f.wakeWindowDays != null && f.wakeWindowDays !== 90)
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-muted)',
  marginBottom: '4px',
  fontFamily: 'var(--font-mono)',
};

const inputStyle: React.CSSProperties = {
  width: '72px',
  padding: '4px 7px',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: '5px',
  color: 'var(--text-primary)',
  fontSize: '12px',
  fontFamily: 'var(--font-mono)',
  outline: 'none',
};

const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', minWidth: 0 };

function NumInput({
  label, value, onChange, placeholder, wide,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  wide?: boolean;
}) {
  return (
    <div style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      <input
        type="number"
        placeholder={placeholder ?? '—'}
        value={value ?? ''}
        onChange={(e) => {
          const v = e.target.value === '' ? undefined : Number(e.target.value);
          onChange(v);
        }}
        style={{ ...inputStyle, width: wide ? '90px' : '72px' }}
      />
    </div>
  );
}

function IndustryMultiSelect({
  options,
  selected,
  onChange,
  label: fieldLabel = 'Industry',
}: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  /** Field caption. Defaults to 'Industry' — the original sole use. */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const label = selected.length === 0
    ? 'All'
    : selected.length === 1
    ? selected[0].length > 14 ? selected[0].slice(0, 13) + '…' : selected[0]
    : `${selected.length} selected`;

  const toggle = (ind: string) => {
    onChange(selected.includes(ind) ? selected.filter((s) => s !== ind) : [...selected, ind]);
  };

  return (
    <div style={fieldStyle}>
      <span style={labelStyle}>{fieldLabel}</span>
      <div ref={ref} style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen((o) => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '4px 8px', width: '120px',
            background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: '5px', color: selected.length > 0 ? 'var(--text-primary)' : 'var(--text-faint)',
            fontSize: '12px', fontFamily: 'var(--font-body)', cursor: 'pointer',
            textAlign: 'left', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
          }}
        >
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
          <span style={{ flexShrink: 0, fontSize: '10px', color: 'var(--text-muted)' }}>▾</span>
        </button>

        {open && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 400,
            marginTop: '4px', width: '200px', maxHeight: '220px',
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: '8px', overflowY: 'auto',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          }}>
            {selected.length > 0 && (
              <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)' }}>
                <button
                  onClick={() => onChange([])}
                  style={{
                    fontSize: '11px', color: 'var(--text-muted)', background: 'none',
                    border: 'none', cursor: 'pointer', padding: 0,
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  Clear selection
                </button>
              </div>
            )}
            {options.map((ind) => {
              const checked = selected.includes(ind);
              return (
                <label
                  key={ind}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '6px 10px', cursor: 'pointer', fontSize: '12px',
                    color: checked ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontFamily: 'var(--font-body)',
                    background: checked ? 'var(--card-soft)' : 'transparent',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(ind)}
                    style={{ accentColor: 'var(--accent)', flexShrink: 0 }}
                  />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ind}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

interface ScanFilterBarProps {
  presetId: string;
  stocks: ScanStock[];
  filters: ScanFilters;
  onFiltersChange: (f: ScanFilters) => void;
}

const FILTERS_OPEN_KEY = 'kd_scan_filters_open';

export function ScanFilterBar({ presetId, stocks, filters, onFiltersChange }: ScanFilterBarProps) {
  // Open state persists across scans and reloads (owner request 2026-07-06);
  // active filters force it open so applied criteria are never hidden.
  const [open, setOpenState] = useState<boolean>(() => {
    // Open by default (owner request 2026-07-12). A user's explicit collapse is
    // still remembered (stored 'false'); active filters always force it open.
    try {
      const stored = localStorage.getItem(FILTERS_OPEN_KEY);
      if (stored === null) return true;
      return stored === 'true' || hasActiveFilters(filters);
    }
    catch { return true; }
  });
  const setOpen = (updater: (o: boolean) => boolean) => {
    setOpenState((o) => {
      const next = updater(o);
      try { localStorage.setItem(FILTERS_OPEN_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  };
  const group = getFilterGroup(presetId);

  const industries = useMemo(() => {
    const set = new Set<string>();
    for (const s of stocks) if (s.industry) set.add(s.industry);
    return [...set].sort();
  }, [stocks]);

  const active = hasActiveFilters(filters);
  const set = <K extends keyof ScanFilters>(k: K, v: ScanFilters[K]) =>
    onFiltersChange({ ...filters, [k]: v });

  return (
    // Fragment (not a wrapper div) so the toggle button and the open panel are
    // direct flex children of the parent Filters bar. The panel gets
    // order/flexBasis below to drop onto its own full-width line — which keeps
    // the Filters button and the right-aligned export controls together on the
    // top row instead of the export controls wrapping below the panel.
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '5px 10px', borderRadius: '6px', fontSize: '11px',
          color: active ? 'var(--accent)' : 'var(--text-muted)',
          border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
          background: active ? 'color-mix(in srgb, var(--accent) 7%, transparent)' : 'var(--card)',
          cursor: 'pointer', fontFamily: 'var(--font-body)',
          transition: 'all 0.15s',
        }}
      >
        <span>{open ? '⊟' : '⊞'}</span>
        <span>Filters{active ? ` · ${countActive(filters)}` : ''}</span>
      </button>

      {/* Filter bar — full-width row of its own, ordered after the export
          controls so those stay on the top line with the Filters button. */}
      {open && (
        <div style={{
          order: 99,
          flexBasis: '100%',
          width: '100%',
          marginTop: '8px',
          marginBottom: '4px',
          padding: '12px 20px',
          background: 'var(--card-soft)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'flex-end',
          gap: '16px',
          flexWrap: 'wrap',
        }}>
          {/* MCap range — all groups */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <NumInput
              label="MCap Min (Cr)"
              value={filters.mcapMin}
              onChange={(v) => set('mcapMin', v)}
              placeholder="0"
              wide
            />
            <NumInput
              label="MCap Max (Cr)"
              value={filters.mcapMax}
              onChange={(v) => set('mcapMax', v)}
              placeholder="∞"
              wide
            />
          </div>

          <div style={{ width: '1px', height: '36px', background: 'var(--border)', flexShrink: 0 }} />

          {/* Industry — all groups */}
          <IndustryMultiSelect
            options={industries}
            selected={filters.industries ?? []}
            onChange={(v) => set('industries', v.length > 0 ? v : undefined)}
          />

          {/* Scores — momentum groups only (owner doctrine: scores lead). Hidden
              for FPB, where a coil deliberately has low scores. Placeholders carry
              the calibrated equity-scale landmarks (median ≈ 5, top decile ≈ 28). */}
          {group !== 'fpb' && (
            <>
              <NumInput label="Score 5D Min" value={filters.score5dMin} onChange={(v) => set('score5dMin', v)} placeholder="p90≈28" />
              <NumInput label="Score 22D Min" value={filters.score22dMin} onChange={(v) => set('score22dMin', v)} placeholder="—" />
              <div style={fieldStyle}>
                <span style={labelStyle}>Accelerating</span>
                <label style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px', height: '26px',
                  fontSize: '11px', color: filters.accelerating ? 'var(--text-primary)' : 'var(--text-muted)',
                  cursor: 'pointer', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap',
                }}>
                  <input
                    type="checkbox"
                    checked={!!filters.accelerating}
                    onChange={(e) => set('accelerating', e.target.checked || undefined)}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  5D ≥ 22D
                </label>
              </div>

              <div style={{ width: '1px', height: '36px', background: 'var(--border)', flexShrink: 0 }} />
            </>
          )}

          {/* Group-specific filters */}
          {(group === 'stage' || group === 'standard') && (
            <>
              <NumInput label="5D Move <" value={filters.move5dMax} onChange={(v) => set('move5dMax', v)} placeholder="%" />
              <NumInput label="22D Move <" value={filters.move22dMax} onChange={(v) => set('move22dMax', v)} placeholder="%" />
              <NumInput label="66D Move <" value={filters.move66dMax} onChange={(v) => set('move66dMax', v)} placeholder="%" />
            </>
          )}

          {group === 'conviction' && (
            <>
              <NumInput label="Surge× Min" value={filters.surgeMin} onChange={(v) => set('surgeMin', v)} placeholder="1.5" />
              <NumInput label="Delivery% Min" value={filters.deliveryPctMin} onChange={(v) => set('deliveryPctMin', v)} placeholder="%" />
              <NumInput label="5D Move <" value={filters.move5dMax} onChange={(v) => set('move5dMax', v)} placeholder="%" />
              <NumInput label="22D Move <" value={filters.move22dMax} onChange={(v) => set('move22dMax', v)} placeholder="%" />
            </>
          )}

          {group === 'drive' && (
            <>
              <IndustryMultiSelect
                label="Dot"
                options={DOT_OPTIONS as unknown as string[]}
                selected={filters.dots ?? []}
                onChange={(v) => set('dots', v.length ? v : undefined)}
              />
              <NumInput label="Delivery% Min" value={filters.deliveryPctMin} onChange={(v) => set('deliveryPctMin', v)} placeholder="50" />
              <NumInput label="RVOL Min" value={filters.rvolMin} onChange={(v) => set('rvolMin', v)} placeholder="1.0" />
            </>
          )}

          {group === 'breakout' && (
            <>
              <NumInput label="RVOL Min" value={filters.rvolMin} onChange={(v) => set('rvolMin', v)} placeholder="1.0" />
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                <NumInput label="% From Brk Min" value={filters.pctFromBreakoutMin} onChange={(v) => set('pctFromBreakoutMin', v)} placeholder="%" />
                <NumInput label="% From Brk Max" value={filters.pctFromBreakoutMax} onChange={(v) => set('pctFromBreakoutMax', v)} placeholder="%" />
              </div>
              <NumInput label="5D Move <" value={filters.move5dMax} onChange={(v) => set('move5dMax', v)} placeholder="%" />
            </>
          )}

          {group === 'journey' && (
            <>
              <div style={fieldStyle}>
                <span style={labelStyle}>Woke Within</span>
                <select
                  value={filters.wakeWindowDays ?? 90}
                  onChange={(e) => set('wakeWindowDays', Number(e.target.value))}
                  style={{ ...inputStyle, width: '108px', height: '26px', cursor: 'pointer' }}
                >
                  <option value={90}>90 days</option>
                  <option value={120}>120 days</option>
                  <option value={150}>150 days</option>
                </select>
              </div>
              <NumInput label="MCap Min (Cr)" value={filters.mcapMin} onChange={(v) => set('mcapMin', v)} placeholder="Cr" />
              <NumInput label="Delivery% Min" value={filters.deliveryPctMin} onChange={(v) => set('deliveryPctMin', v)} placeholder="%" />
            </>
          )}

          {group === 'fpb' && (
            <>
              <div style={fieldStyle}>
                <span style={labelStyle}>Phase</span>
                <select
                  value={filters.fpbPhase ?? 'all'}
                  onChange={(e) => set('fpbPhase', e.target.value === 'all' ? undefined : (e.target.value as ScanFilters['fpbPhase']))}
                  style={{ ...inputStyle, width: '108px', height: '26px', cursor: 'pointer' }}
                >
                  <option value="all">All</option>
                  <option value="burst">🌸 Bursts</option>
                  <option value="shatter">💥 Shatters</option>
                  <option value="coiling">Coiling</option>
                </select>
              </div>
              <NumInput label="Tightness Min" value={filters.tightnessMin} onChange={(v) => set('tightnessMin', v)} placeholder="1.0" />
              <NumInput label="Coiled Days Min" value={filters.coiledDaysMin} onChange={(v) => set('coiledDaysMin', v)} placeholder="d" />
              <NumInput label="Delivery% Min" value={filters.deliveryPctMin} onChange={(v) => set('deliveryPctMin', v)} placeholder="%" />
            </>
          )}

          <div style={{ marginLeft: 'auto' }}>
            <button
              onClick={() => onFiltersChange(EMPTY_FILTERS)}
              style={{
                padding: '5px 12px', borderRadius: '6px', fontSize: '11px',
                color: 'var(--text-muted)', border: '1px solid var(--border)',
                background: 'transparent', cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                opacity: active ? 1 : 0.4,
              }}
              disabled={!active}
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function countActive(f: ScanFilters): number {
  let n = 0;
  if (f.mcapMin != null) n++;
  if (f.mcapMax != null) n++;
  if (f.industries && f.industries.length > 0) n++;
  if (f.move5dMax != null) n++;
  if (f.move22dMax != null) n++;
  if (f.move66dMax != null) n++;
  if (f.surgeMin != null) n++;
  if (f.deliveryPctMin != null) n++;
  if (f.rvolMin != null) n++;
  if (f.pctFromBreakoutMin != null) n++;
  if (f.pctFromBreakoutMax != null) n++;
  if (f.score5dMin != null) n++;
  if (f.score22dMin != null) n++;
  if (f.accelerating) n++;
  if (f.fpbPhase != null && f.fpbPhase !== 'all') n++;
  if (f.tightnessMin != null) n++;
  if (f.coiledDaysMin != null) n++;
  return n;
}
