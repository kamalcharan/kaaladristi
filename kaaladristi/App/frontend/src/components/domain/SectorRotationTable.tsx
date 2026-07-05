/**
 * SectorRotationTable
 * ===================
 * Shared table component for all four Sector Rotation tabs
 * (Broad Market / Sectoral / Thematic / Curated).
 *
 * COLUMN ORDER is NOT defined here — it lives in
 * src/constants/sectorRotationColumns.ts (constants-first rule). Both the
 * header and the body render from that single ordered list, so reordering
 * the table is a one-line constant edit and header/body can never drift.
 *
 * Column DEFINITIONS (label, tooltip, width, render) live below in COL_DEFS.
 *
 * Sortable headers — click once for desc, again for asc.
 * Alternating row backgrounds, horizontal scroll, sticky first column.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { Tooltip } from '@/components/ui';
import { formatValue, getColor } from '@/config/fieldConfig';
import { FLOW_LABELS } from '@/constants/signalScale';
import {
  SECTOR_ROTATION_COLUMN_ORDER,
  type SectorRotationColKey,
} from '@/constants/sectorRotationColumns';
import type { SectorIndexRow } from '@/services/sectorRotation';

// ── Signal logic (spec Section 5) ────────────────────────────────────────────

type SignalType = 'flow_entering' | 'flow_exiting' | 'sustained_flow' | null;

function computeSignal(row: SectorIndexRow): SignalType {
  const pctAmtChg =
    row.avg_amt_5d != null && row.avg_amt_22d != null && row.avg_amt_22d !== 0
      ? ((row.avg_amt_5d - row.avg_amt_22d) / row.avg_amt_22d) * 100
      : null;

  const rotatingIn =
    (row.ret_5d ?? 0) > 0 &&
    (row.score_5d ?? 0) > (row.score_22d ?? 0) &&
    pctAmtChg != null &&
    pctAmtChg > 15;

  const rotatingOut =
    (row.ret_5d ?? 0) < 0 &&
    (row.score_5d ?? 0) < (row.score_22d ?? 0) &&
    pctAmtChg != null &&
    pctAmtChg < -15;

  if (rotatingIn) return 'flow_entering';
  if (rotatingOut) return 'flow_exiting';
  if ((row.ret_22d ?? 0) > 5 && (row.rsi_14 ?? 0) > 55 && !rotatingOut)
    return 'sustained_flow';
  return null;
}

// Labels sourced from canonical FLOW_LABELS in signalScale.ts
const signalLabel = (sig: NonNullable<SignalType>): string =>
  FLOW_LABELS[sig]?.label ?? sig;

const SIGNAL_STYLE: Record<NonNullable<SignalType>, { color: string; bg: string; border: string }> = {
  flow_entering:  { color: 'var(--bull)',  bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)' },
  flow_exiting:   { color: 'var(--bear)',  bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)' },
  sustained_flow: { color: 'var(--gold)',  bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.3)' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPct(val: number | null): string {
  if (val == null || isNaN(val)) return '—';
  return `${val > 0 ? '+' : ''}${val.toFixed(1)}%`;
}

function fmtCr(val: number | null): string {
  if (val == null || isNaN(val)) return '—';
  return `${val.toFixed(1)} Cr`;
}

function fmtClose(val: number | null): string {
  if (val == null) return '—';
  return '₹' + val.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function fmtScore(val: number | null): string {
  if (val == null || isNaN(Number(val))) return '—';
  return Number(val).toFixed(1);
}

function rsiColor(val: number | null): string {
  if (val == null) return 'var(--text-secondary)';
  if (val < 40)  return 'var(--bear)';
  if (val <= 60) return 'var(--gold)';
  return 'var(--bull)';
}

function pctColor(val: number | null): string {
  if (val == null) return 'var(--text-secondary)';
  if (val > 0)  return 'var(--bull)';
  if (val < 0)  return 'var(--bear)';
  return 'var(--text-secondary)';
}

function pctAmtChgColor(val: number | null): string {
  if (val == null) return 'var(--text-secondary)';
  if (val >= 15)  return 'var(--bull)';
  if (val <= -15) return 'var(--bear)';
  return 'var(--gold)';
}

function scoreColor(val: number | null): string {
  if (val == null) return 'var(--text-secondary)';
  if (val >= 20) return 'var(--bull)';
  if (val > 0)   return 'var(--gold)';
  return 'var(--text-secondary)';
}

// ── Column definitions (order lives in sectorRotationColumns.ts) ─────────────

type EnrichedRow = SectorIndexRow & { pct_amt_chg: number | null; signal: SignalType };

interface ColDef {
  key: SectorRotationColKey;
  label: string;
  tooltip: string;
  width: number;
  align: 'left' | 'right' | 'center';
  sortable: boolean;
  sortVal?: (row: EnrichedRow) => number | string | null;
  render: (row: EnrichedRow) => React.ReactNode;
}

const COL_DEFS: Record<SectorRotationColKey, ColDef> = {
  name: {
    key: 'name', label: 'Index', tooltip: 'NSE index name', width: 200, align: 'left',
    sortable: true, sortVal: (r) => r.name,
    render: (r) => (r.name.length > 28 ? r.name.slice(0, 27) + '…' : r.name),
  },
  stock_count: {
    key: 'stock_count', label: 'Stocks', tooltip: 'Number of constituent stocks in this index.',
    width: 60, align: 'center', sortable: false,
    render: (r) => (
      <span style={{ color: 'var(--text-faint)' }}>{r.stock_count ?? '—'}</span>
    ),
  },
  close: {
    key: 'close', label: 'Close', tooltip: 'Last traded close (₹)', width: 90, align: 'right',
    sortable: true, sortVal: (r) => r.close,
    render: (r) => <span style={{ color: 'var(--text-primary)' }}>{fmtClose(r.close)}</span>,
  },
  pct_chng: {
    key: 'pct_chng', label: '1D%', tooltip: 'Price change today vs the previous close.',
    width: 72, align: 'right', sortable: true, sortVal: (r) => r.pct_chng,
    render: (r) => <span style={{ color: pctColor(r.pct_chng) }}>{fmtPct(r.pct_chng)}</span>,
  },
  ret_5d: {
    key: 'ret_5d', label: '5D%',
    tooltip: 'Price change over the last 5 trading days (~1 week). A dot next to this value means 5D is outrunning 22D — the index is gaining strength.',
    width: 72, align: 'right', sortable: true, sortVal: (r) => r.ret_5d,
    render: (r) => (
      <span style={{ color: pctColor(r.ret_5d), whiteSpace: 'nowrap' }}>
        {fmtPct(r.ret_5d)}
        {r.ret_5d != null && r.ret_22d != null && r.ret_5d > r.ret_22d && (
          <span
            style={{
              display: 'inline-block', width: 5, height: 5, borderRadius: '50%',
              background: 'var(--accent-indigo, #6366f1)', marginLeft: 4, verticalAlign: 'middle',
            }}
          />
        )}
      </span>
    ),
  },
  score_5d: {
    key: 'score_5d', label: 'Score 5D',
    tooltip: 'Money-flow score over ~1 week: combines the 5-day return with rising delivery turnover. Higher = stronger flow into this index. 0 when the return is negative.',
    width: 85, align: 'right', sortable: true, sortVal: (r) => r.score_5d,
    render: (r) => <span style={{ color: scoreColor(r.score_5d) }}>{fmtScore(r.score_5d)}</span>,
  },
  ret_22d: {
    key: 'ret_22d', label: '22D%', tooltip: 'Price change over the last 22 trading days (~1 month).',
    width: 65, align: 'right', sortable: true, sortVal: (r) => r.ret_22d,
    render: (r) => <span style={{ color: pctColor(r.ret_22d) }}>{fmtPct(r.ret_22d)}</span>,
  },
  score_22d: {
    key: 'score_22d', label: 'Score 22D',
    tooltip: 'Money-flow score over ~1 month. Compare with Score 5D: a higher 5D score means flow is accelerating recently.',
    width: 85, align: 'right', sortable: true, sortVal: (r) => r.score_22d,
    render: (r) => <span style={{ color: scoreColor(r.score_22d) }}>{fmtScore(r.score_22d)}</span>,
  },
  ret_66d: {
    key: 'ret_66d', label: '66D%', tooltip: 'Price change over the last 66 trading days (~3 months).',
    width: 65, align: 'right', sortable: true, sortVal: (r) => r.ret_66d,
    render: (r) => <span style={{ color: pctColor(r.ret_66d) }}>{fmtPct(r.ret_66d)}</span>,
  },
  rsi_14: {
    key: 'rsi_14', label: 'RSI',
    tooltip: 'Momentum gauge (RSI 14). Above 60 = strong, below 40 = weak, in between = neutral.',
    width: 60, align: 'right', sortable: true, sortVal: (r) => r.rsi_14,
    render: (r) => (
      <span style={{ color: rsiColor(r.rsi_14) }}>{r.rsi_14 != null ? r.rsi_14.toFixed(1) : '—'}</span>
    ),
  },
  avg_amt_5d: {
    key: 'avg_amt_5d', label: 'Avg Amt 5D',
    tooltip: 'Average daily delivery turnover over the last week (₹ Cr) — how much money is moving through this index now.',
    width: 95, align: 'right', sortable: true, sortVal: (r) => r.avg_amt_5d,
    render: (r) => <span style={{ color: 'var(--text-secondary)' }}>{fmtCr(r.avg_amt_5d)}</span>,
  },
  avg_amt_22d: {
    key: 'avg_amt_22d', label: 'Avg Amt 22D',
    tooltip: 'Average daily delivery turnover over the last month (₹ Cr) — the baseline to compare recent activity against.',
    width: 100, align: 'right', sortable: true, sortVal: (r) => r.avg_amt_22d,
    render: (r) => <span style={{ color: 'var(--text-secondary)' }}>{fmtCr(r.avg_amt_22d)}</span>,
  },
  pct_amt_chg: {
    key: 'pct_amt_chg', label: '% Amt Chg',
    tooltip: 'Recent turnover vs its 1-month norm. Green = 15%+ above normal (money arriving), red = 15%+ below (money leaving).',
    width: 90, align: 'right', sortable: true, sortVal: (r) => r.pct_amt_chg,
    render: (r) => <span style={{ color: pctAmtChgColor(r.pct_amt_chg) }}>{fmtPct(r.pct_amt_chg)}</span>,
  },
  signal: {
    key: 'signal', label: 'Signal',
    tooltip: 'Rotation state: money Entering (green), Sustained (amber), or Exiting (red) this index — based on returns, scores, and turnover together.',
    width: 120, align: 'left', sortable: true, sortVal: (r) => r.signal ?? '',
    render: (r) =>
      r.signal ? (
        <span
          style={{
            display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 4,
            fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', whiteSpace: 'nowrap',
            color:      SIGNAL_STYLE[r.signal].color,
            background: SIGNAL_STYLE[r.signal].bg,
            border:     `1px solid ${SIGNAL_STYLE[r.signal].border}`,
          }}
        >
          {signalLabel(r.signal)}
        </span>
      ) : null,
  },
};

// Ordered defs — the constant drives everything below.
const ORDERED_COLS: ColDef[] = SECTOR_ROTATION_COLUMN_ORDER.map((k) => COL_DEFS[k]);
// Optional picker columns insert before the last ordered column (Signal).
const MAIN_COLS = ORDERED_COLS.slice(0, -1);
const LAST_COL  = ORDERED_COLS[ORDERED_COLS.length - 1];

// ── Optional columns ──────────────────────────────────────────────────────────

type OptKey = 'open' | 'high' | 'low' | 'volume' | 'value_cr' | 'magic_rs' | 'avg_amt_66d';

interface OptColDef {
  key: OptKey;
  label: string;
  tooltip: string;
  width: number;
  align: 'left' | 'right';
  render: (row: SectorIndexRow) => string;
  color?: (row: SectorIndexRow) => string;
}

const OPT_COLS: OptColDef[] = [
  {
    key: 'open', label: 'Open', tooltip: 'Open price (₹)', width: 90, align: 'right',
    render: (r) => r.open != null ? '₹' + r.open.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—',
  },
  {
    key: 'high', label: 'High', tooltip: 'Day high (₹)', width: 90, align: 'right',
    render: (r) => r.high != null ? '₹' + r.high.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—',
  },
  {
    key: 'low', label: 'Low', tooltip: 'Day low (₹)', width: 90, align: 'right',
    render: (r) => r.low != null ? '₹' + r.low.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—',
  },
  {
    key: 'volume', label: 'Volume', tooltip: 'Volume (contracts)', width: 100, align: 'right',
    render: (r) => r.volume != null ? r.volume.toLocaleString('en-IN') : '—',
  },
  {
    key: 'value_cr', label: 'Turnover', tooltip: 'Turnover (₹ Cr)', width: 95, align: 'right',
    render: (r) => r.value_cr != null ? `₹${r.value_cr.toFixed(1)} Cr` : '—',
  },
  {
    key: 'magic_rs', label: 'Magic RS', tooltip: 'MagicRS — how this index performs relative to the broad NIFTY 500. Positive = outperforming the market.', width: 90, align: 'right',
    render: (r) => r.magic_rs != null ? formatValue('magic_rs', r.magic_rs) : '—',
    color: (r) => r.magic_rs != null ? getColor('magic_rs', r.magic_rs) : 'var(--text-secondary)',
  },
  {
    key: 'avg_amt_66d', label: '66D Avg Amt', tooltip: 'Average turnover over 66 trading days (₹ Cr)', width: 105, align: 'right',
    render: (r) => r.avg_amt_66d != null ? `${r.avg_amt_66d.toFixed(1)} Cr` : '—',
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  rows: SectorIndexRow[];
}

type SortDir = 'asc' | 'desc';

export default function SectorRotationTable({ rows }: Props) {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SectorRotationColKey>('score_5d');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Optional column picker
  const [visibleOpt, setVisibleOpt] = useState<Set<OptKey>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    function onMouseDown(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [pickerOpen]);

  function toggleOpt(key: OptKey) {
    setVisibleOpt((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const activeOptCols = OPT_COLS.filter((c) => visibleOpt.has(c.key));

  // Enrich rows with computed fields
  const enriched = useMemo(() =>
    rows.map((row) => {
      const pct_amt_chg =
        row.avg_amt_5d != null && row.avg_amt_22d != null && row.avg_amt_22d !== 0
          ? ((row.avg_amt_5d - row.avg_amt_22d) / row.avg_amt_22d) * 100
          : null;
      return { ...row, pct_amt_chg, signal: computeSignal(row) };
    }),
  [rows]);

  const sorted = useMemo(() => {
    const col = COL_DEFS[sortKey];
    if (!col?.sortVal) return enriched;
    return [...enriched].sort((a, b) => {
      const av = col.sortVal!(a);
      const bv = col.sortVal!(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'string'
        ? av.localeCompare(bv as string)
        : (av as number) - (bv as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [enriched, sortKey, sortDir]);

  const handleSort = (key: SectorRotationColKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ colKey }: { colKey: SectorRotationColKey }) => {
    if (colKey !== sortKey) return <ChevronsUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 opacity-80" />
      : <ChevronDown className="w-3 h-3 opacity-80" />;
  };

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No data for this tab.</p>
      </div>
    );
  }

  const thBase: React.CSSProperties = {
    padding: '8px 10px',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    background: 'var(--card)',
  };

  // Dotted underline signals "hover for explanation" — the header tooltips are
  // the primary comprehension affordance on this table.
  const HEADER_HINT: React.CSSProperties = {
    borderBottom: '1px dotted var(--text-faint)',
    cursor: 'help',
    paddingBottom: 1,
  };

  const renderTh = (col: ColDef) => (
    <th
      key={col.key}
      onClick={col.sortable ? () => handleSort(col.key) : undefined}
      style={{
        ...thBase,
        width: col.width,
        minWidth: col.width,
        textAlign: col.align,
        cursor: col.sortable ? 'pointer' : 'default',
        color: sortKey === col.key ? 'var(--text-primary)' : 'var(--text-faint)',
        position: col.key === 'name' ? 'sticky' : undefined,
        left: col.key === 'name' ? 0 : undefined,
        zIndex: col.key === 'name' ? 2 : undefined,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        <Tooltip content={col.tooltip} position={col.key === 'signal' ? 'left' : 'bottom'} maxWidth={260}>
          <span style={HEADER_HINT}>{col.label}</span>
        </Tooltip>
        {col.sortable && <SortIcon colKey={col.key} />}
      </span>
    </th>
  );

  return (
    <div style={{ width: '100%' }}>
      {/* ── Toolbar: column picker ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '8px 12px 4px',
        }}
      >
        <div ref={pickerRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setPickerOpen((o) => !o)}
            title="Choose columns"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 10px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: pickerOpen ? 'var(--accent-glow)' : 'transparent',
              color: pickerOpen ? 'var(--gold-soft)' : 'var(--text-muted)',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            ⊞ Columns {visibleOpt.size > 0 && `· ${visibleOpt.size}`}
          </button>

          {pickerOpen && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: 4,
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '8px 0',
                zIndex: 100,
                minWidth: 180,
                boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
              }}
            >
              <div
                style={{
                  padding: '4px 12px 6px',
                  fontSize: 9,
                  color: 'var(--text-faint)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                Optional Columns
              </div>
              {OPT_COLS.map((col) => {
                const enabled = visibleOpt.has(col.key);
                return (
                  <button
                    key={col.key}
                    onClick={() => toggleOpt(col.key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '7px 12px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 12,
                      color: enabled ? 'var(--text-primary)' : 'var(--text-muted)',
                      textAlign: 'left',
                      fontFamily: 'var(--font-mono)',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'var(--accent-glow)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        flexShrink: 0,
                        border: `1px solid ${enabled ? 'var(--gold-soft)' : 'var(--border)'}`,
                        background: enabled ? 'var(--gold-soft)' : 'transparent',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 9,
                        color: 'var(--kd-bg, #0e1117)',
                        lineHeight: 1,
                      }}
                    >
                      {enabled ? '✓' : ''}
                    </span>
                    {col.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div
        style={{
          width: '100%',
          overflowX: 'auto',
          overflowY: 'visible',
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--border) transparent',
        }}
      >
        <table
          style={{
            width: 'max-content',
            minWidth: '100%',
            borderCollapse: 'collapse',
            fontSize: 13,
            fontFamily: 'var(--font-mono)',
          }}
        >
          {/* ── Header — main cols in constant order, then optional, then last ── */}
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {MAIN_COLS.map(renderTh)}

              {activeOptCols.map((col) => (
                <th
                  key={col.key}
                  style={{
                    ...thBase,
                    width: col.width,
                    minWidth: col.width,
                    textAlign: col.align,
                    color: 'var(--text-faint)',
                    cursor: 'default',
                  }}
                >
                  <Tooltip content={col.tooltip} position="bottom" maxWidth={260}>
                    <span style={HEADER_HINT}>{col.label}</span>
                  </Tooltip>
                </th>
              ))}

              {renderTh(LAST_COL)}
            </tr>
          </thead>

          {/* ── Body — same ordered lists as the header, drift-proof ── */}
          <tbody>
            {sorted.map((row, i) => {
              const isEven = i % 2 === 0;
              const rowBg = isEven ? 'transparent' : 'rgba(255,255,255,0.025)';
              const stickyBg = isEven ? 'var(--kd-bg, #0e1117)' : 'rgba(255,255,255,0.025)';

              const renderTd = (col: ColDef) => (
                <td
                  key={col.key}
                  title={col.key === 'name' ? row.name : undefined}
                  style={{
                    padding: '9px 10px',
                    textAlign: col.align,
                    ...(col.key === 'name'
                      ? {
                          color: 'var(--text-primary)',
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                          maxWidth: 200,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          position: 'sticky' as const,
                          left: 0,
                          background: stickyBg,
                          zIndex: 1,
                        }
                      : {}),
                  }}
                >
                  {col.render(row)}
                </td>
              );

              return (
                <tr
                  key={row.index_id}
                  style={{
                    background: rowBg,
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    cursor: 'pointer',
                  }}
                  onClick={() => navigate(`/sector-rotation/${row.index_id}`)}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = rowBg;
                  }}
                >
                  {MAIN_COLS.map(renderTd)}

                  {activeOptCols.map((col) => (
                    <td
                      key={col.key}
                      style={{
                        padding: '9px 10px',
                        textAlign: col.align,
                        color: col.color ? col.color(row) : 'var(--text-secondary)',
                      }}
                    >
                      {col.render(row)}
                    </td>
                  ))}

                  {renderTd(LAST_COL)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
