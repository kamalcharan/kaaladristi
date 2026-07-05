// REUSE:
// 1. IndexDetailPage Tab 4 — constituent mode (Sprint 10)
// 2. SectorRotationPage Heat toggle — index mode (Sprint 10)
// 3. CustomIndex detail — constituent mode (Sprint 12)
// 4. Visual Pulse peer view — constituent mode (Post-MVP)

import { useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Card } from '@/components/ui/Card';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CellData {
  d1: number;        // 1D price % (sign → border color)
  amt: number;       // ₹ Cr traded value
  sx?: number;       // surge× vs 66D baseline (constituent mode)
  amt_5d?: number;   // avg_amt_5d (index mode)
  amt_22d?: number;  // avg_amt_22d (index mode)
  ret_5d?: number;   // 5D return % (index mode)
  ret_22d?: number;  // 22D return % (index mode, tooltip only)
}

interface FlowIntensityMapProps {
  mode: 'constituent' | 'index';
  rows: string[];
  dates: string[];
  cells: Record<string, CellData[]>;
  title?: string;
  subtitle?: string;
  surgeToggle?: 'sx' | 'amt';          // constituent only — controlled externally or internal
  dayWindow?: 5 | 22 | 66;             // index only
  onDayWindowChange?: (d: 5 | 22 | 66) => void;
  cellWidth?: number;                   // default 28 for constituent, 52 for index
  onRowClick?: (row: string) => void;   // row label click → drill-down
}

// ── Color constants ────────────────────────────────────────────────────────────
// #166534 and #f87171 are the only tokens not covered by CSS vars (per SKILL.md)

const DARK_GREEN = '#166534';
const PINK       = '#f87171';
const NO_DATA    = '#1e293b';

// ── Constituent mode: per-row percentile cuts ─────────────────────────────────

interface RowCuts { p20: number; p40: number; p60: number; p80: number }

function computeRowCuts(
  rows: string[],
  cells: Record<string, CellData[]>,
  field: 'sx' | 'amt',
): Record<string, RowCuts> {
  const result: Record<string, RowCuts> = {};
  for (const sym of rows) {
    const vals: number[] = [];
    for (const c of cells[sym] ?? []) {
      const v = field === 'sx' ? (c.sx ?? 0) : c.amt;
      if (v > 0) vals.push(v);
    }
    if (vals.length === 0) {
      result[sym] = { p20: 0, p40: 0, p60: 0, p80: 0 };
      continue;
    }
    vals.sort((a, b) => a - b);
    const pct = (p: number) => vals[Math.floor((vals.length - 1) * p / 100)];
    result[sym] = { p20: pct(20), p40: pct(40), p60: pct(60), p80: pct(80) };
  }
  return result;
}

function constituentColor(val: number, cuts: RowCuts): string {
  if (val <= 0)        return NO_DATA;
  if (val >= cuts.p80) return DARK_GREEN;
  if (val >= cuts.p60) return 'var(--risk-green)';
  if (val >= cuts.p40) return 'var(--risk-amber)';
  if (val >= cuts.p20) return PINK;
  return 'var(--risk-red)';
}

// ── Index mode: 4-state composite signal ─────────────────────────────────────

type IndexSignal = 'STRONG' | 'MODERATE' | 'WEAK' | 'LOW_FLOW';

function indexSignal(c: CellData): IndexSignal {
  const flowUp = (c.amt_5d ?? 0) > (c.amt_22d ?? 0);
  const ret    = c.ret_5d ?? 0;
  if (flowUp  && ret >  1.5) return 'STRONG';
  if (flowUp  && ret >= 0.5) return 'MODERATE';
  if (!flowUp && ret <  0)   return 'LOW_FLOW';
  return 'WEAK';
}

const SIGNAL_COLOR: Record<IndexSignal, string> = {
  STRONG:   DARK_GREEN,
  MODERATE: 'var(--risk-green)',
  WEAK:     'var(--risk-amber)',
  LOW_FLOW: 'var(--risk-red)',
};

// Cell text must contrast with the cell background, not encode return sign
// (the background already encodes the signal; sign is visible in the +/-).
const SIGNAL_TEXT: Record<IndexSignal, string> = {
  STRONG:   '#f8fafc',  // near-white on dark green
  MODERATE: '#0b1220',  // near-black on bright green
  WEAK:     '#0b1220',  // near-black on amber
  LOW_FLOW: '#fef2f2',  // near-white on red
};

const SIGNAL_LABEL: Record<IndexSignal, string> = {
  STRONG:   'Strong Flow',
  MODERATE: 'Moderate Flow',
  WEAK:     'Weak Flow',
  LOW_FLOW: 'Low Flow',
};

// ── Tooltip state ─────────────────────────────────────────────────────────────

interface TooltipState {
  cx: number;      // cell horizontal center (viewport coords)
  top: number;     // cell top edge
  bottom: number;  // cell bottom edge
  row: string;
  date: string;
  cell: CellData;
  signal?: IndexSignal;
}

// ── Fixed sizing ──────────────────────────────────────────────────────────────

const CELL_H_CON = 28;  // constituent mode — color block only, no text
const CELL_H_IDX = 56;  // index mode — single % line; sized for glanceability
const GAP        = 2;
const LABEL_W_CON = 104;  // constituent mode — short symbols
const LABEL_W_IDX = 220;  // index mode — full index names, no harsh truncation
const TREND_W     = 72;   // index mode — micro-trend bars between name and cells

// ── Helpers ───────────────────────────────────────────────────────────────────

function trunc(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function fmtPct(v: number | undefined) {
  if (v == null) return '—';
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}

function fmtCr(v: number) {
  return '₹' + v.toFixed(1) + ' Cr';
}

// ── Micro-trend bars (index mode) ─────────────────────────────────────────────
// One tiny bar per session, chronological left -> right (NOTE: the heat grid
// runs newest-first, but a trend shape must read oldest -> newest or users
// misread the direction — hence the reversed order and the title hint).
// Answers "what is this row's trend shape" without integrating 22 cell colors.

function MicroTrend({ rowData, height }: { rowData: CellData[]; height: number }) {
  const vals = [...rowData].reverse().map((c) => c?.d1 ?? 0);
  if (vals.length === 0) return <div style={{ width: TREND_W }} />;

  const maxAbs = Math.max(0.5, ...vals.map((v) => Math.abs(v)));
  const innerH = height - 14;
  const mid = innerH / 2;
  const barW = Math.max(1, Math.floor((TREND_W - 8) / vals.length) - 1);
  const step = (TREND_W - 8) / vals.length;

  return (
    <svg
      width={TREND_W}
      height={innerH}
      style={{ display: 'block' }}
    >
      <line x1={0} y1={mid} x2={TREND_W - 8} y2={mid} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
      {vals.map((v, i) => {
        const h = Math.max(1, (Math.abs(v) / maxAbs) * mid);
        return (
          <rect
            key={i}
            x={i * step}
            y={v >= 0 ? mid - h : mid}
            width={barW}
            height={h}
            fill={v >= 0 ? 'var(--risk-green)' : 'var(--risk-red)'}
            opacity={0.85}
          />
        );
      })}
    </svg>
  );
}

// ── Toggle button shared style ────────────────────────────────────────────────

function toggleBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '3px 9px',
    borderRadius: 4,
    border: 'none',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: active ? 600 : 400,
    background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-muted)',
    transition: 'background 0.15s, color 0.15s',
  };
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function FlowIntensityMap({
  mode,
  rows,
  dates,
  cells,
  title = 'Flow Intensity',
  subtitle,
  surgeToggle: surgeToggleProp,
  dayWindow,
  onDayWindowChange,
  cellWidth,
  onRowClick,
}: FlowIntensityMapProps) {
  // Cell width: caller-overridable; defaults differ by mode
  const cellW = cellWidth ?? (mode === 'index' ? 92 : 28);
  const cellH = mode === 'index' ? CELL_H_IDX : CELL_H_CON;

  // Constituent surge toggle — uncontrolled when surgeToggleProp not passed
  const [internalSurge, setInternalSurge] = useState<'sx' | 'amt'>('sx');
  const surgeField = surgeToggleProp ?? internalSurge;

  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  // Per-row percentile cuts (constituent mode only)
  const sxCuts  = useMemo(() => computeRowCuts(rows, cells, 'sx'),  [rows, cells]);
  const amtCuts = useMemo(() => computeRowCuts(rows, cells, 'amt'), [rows, cells]);

  const cellColor = useCallback(
    (row: string, c: CellData): string => {
      if (mode === 'index') return SIGNAL_COLOR[indexSignal(c)];
      const cuts = surgeField === 'sx' ? sxCuts[row] : amtCuts[row];
      if (!cuts) return NO_DATA;
      return constituentColor(surgeField === 'sx' ? (c.sx ?? 0) : c.amt, cuts);
    },
    [mode, surgeField, sxCuts, amtCuts],
  );

  const borderColor = useCallback(
    (c: CellData): string => {
      const sign = mode === 'index' ? (c.ret_5d ?? 0) : c.d1;
      return sign >= 0 ? 'var(--risk-green)' : 'var(--risk-red)';
    },
    [mode],
  );

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent, row: string, date: string, c: CellData) => {
      const sig = mode === 'index' ? indexSignal(c) : undefined;
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setTooltip({ cx: r.left + r.width / 2, top: r.top, bottom: r.bottom, row, date, cell: c, signal: sig });
    },
    [mode],
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  if (rows.length === 0 || dates.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 24 }}>
        No flow data available.
      </div>
    );
  }

  const totalCellW = dates.length * (cellW + GAP) - GAP;

  return (
    <Card variant="default" className="p-5">

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <span style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}>
            {title}
          </span>
          {subtitle && (
            <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 8 }}>
              {subtitle}
            </span>
          )}
        </div>

        {/* Constituent toggle: Surge× | ₹ Cr */}
        {mode === 'constituent' && !surgeToggleProp && (
          <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: 2, gap: 2 }}>
            {(['sx', 'amt'] as const).map((m) => (
              <button key={m} style={toggleBtnStyle(surgeField === m)} onClick={() => setInternalSurge(m)}>
                {m === 'sx' ? 'Surge×' : '₹ Cr'}
              </button>
            ))}
          </div>
        )}

        {/* Index toggle: 5D | 22D | 66D */}
        {mode === 'index' && onDayWindowChange && (
          <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: 2, gap: 2 }}>
            {([5, 22, 66] as const).map((d) => (
              <button key={d} style={toggleBtnStyle(dayWindow === d)} onClick={() => onDayWindowChange(d)}>
                {d}D
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Grid ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>

        {/* Label column */}
        <div style={{ flexShrink: 0, width: mode === 'index' ? LABEL_W_IDX : LABEL_W_CON }}>
          {/* Spacer for date header row */}
          <div style={{ height: CELL_H_CON + GAP }} />
          {rows.map((row) => (
            <div
              key={row}
              title={row}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={{
                height: cellH,
                marginBottom: GAP,
                display: 'flex',
                alignItems: 'center',
                paddingRight: 10,
                color: 'var(--text-secondary)',
                fontSize: 12,
                fontFamily: 'monospace',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                cursor: onRowClick ? 'pointer' : undefined,
              }}
              onMouseEnter={onRowClick ? (e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; } : undefined}
              onMouseLeave={onRowClick ? (e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.textDecoration = 'none'; } : undefined}
            >
              {mode === 'index' ? trunc(row, 30) : trunc(row, 14)}
            </div>
          ))}
        </div>

        {/* Micro-trend column — index mode only */}
        {mode === 'index' && (
          <div style={{ flexShrink: 0, width: TREND_W, paddingRight: 8 }}>
            <div style={{
              height: CELL_H_CON + GAP,
              display: 'flex',
              alignItems: 'center',
              color: 'var(--text-muted)',
              fontSize: 9,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontFamily: 'monospace',
            }}>
              Trend
            </div>
            {rows.map((row) => (
              <div
                key={row}
                title="Daily % change across the window, oldest → newest"
                style={{
                  height: cellH,
                  marginBottom: GAP,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <MicroTrend rowData={cells[row] ?? []} height={cellH} />
              </div>
            ))}
          </div>
        )}

        {/* Scrollable cell area */}
        <div style={{ overflowX: 'auto', flex: 1 }}>

          {/* Date header row */}
          <div style={{ display: 'flex', gap: GAP, marginBottom: GAP, width: totalCellW }}>
            {dates.map((d) => (
              <div
                key={d}
                style={{
                  width: cellW,
                  flexShrink: 0,
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: 10,
                  overflow: 'hidden',
                }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Data rows */}
          {rows.map((row) => {
            const rowData = cells[row] ?? [];
            return (
              <div key={row} style={{ display: 'flex', gap: GAP, marginBottom: GAP }}>
                {dates.map((dateStr, colIdx) => {
                  const c = rowData[colIdx];
                  if (!c) {
                    return (
                      <div
                        key={dateStr}
                        style={{
                          width: cellW,
                          height: cellH,
                          flexShrink: 0,
                          borderRadius: 3,
                          background: NO_DATA,
                        }}
                      />
                    );
                  }

                  const bg     = cellColor(row, c);
                  const border = borderColor(c);

                  return (
                    <div
                      key={dateStr}
                      onMouseEnter={(e) => handleMouseEnter(e, row, dateStr, c)}
                      onMouseLeave={handleMouseLeave}
                      style={{
                        width: cellW,
                        height: cellH,
                        flexShrink: 0,
                        borderRadius: 3,
                        background: bg,
                        borderTop: `2.5px solid ${border}`,
                        cursor: 'default',
                        overflow: 'hidden',
                        ...(mode === 'index' ? {
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 1,
                          padding: '0 2px',
                        } : {}),
                      }}
                    >
                      {mode === 'index' && (
                        <div style={{
                          fontSize: 13,
                          fontWeight: 600,
                          fontFamily: 'monospace',
                          lineHeight: 1.2,
                          textAlign: 'center',
                          color: SIGNAL_TEXT[indexSignal(c)],
                        }}>
                          {fmtPct(c.ret_5d)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ marginTop: 12, color: 'var(--text-muted)', fontSize: 10, lineHeight: 1.5 }}>
        Cell color reflects flow relative to baseline. Edge indicates price direction for that session.
        {onRowClick && ' Click an index name to open its detail.'}
      </div>

      {/* ── Cell tooltip ──
          Anchored immediately ABOVE the hovered cell (falls below it only
          when the cell is at the very top of the viewport). Rendered through
          a portal to document.body so no transformed/filtered ancestor can
          re-anchor position:fixed and push it off-screen. */}
      {tooltip && createPortal((() => {
        const TT_W = 210;
        const ttH  = mode === 'index' ? 200 : 130;
        const left = Math.min(Math.max(8, tooltip.cx - TT_W / 2), window.innerWidth - TT_W - 8);
        const fitsAbove = tooltip.top - ttH - 10 >= 8;
        const top = fitsAbove ? tooltip.top - ttH - 10 : tooltip.bottom + 10;
        return (
        <div
          style={{
            position: 'fixed',
            left,
            top,
            width: TT_W,
            zIndex: 9999,
            background: 'var(--card)',
            border: '1px solid var(--border-strong)',
            borderRadius: 6,
            padding: '8px 11px',
            pointerEvents: 'none',
            minWidth: 165,
            boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
          }}
        >
          <div style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 12, color: 'var(--text-primary)', marginBottom: 4 }}>
            {tooltip.row}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>
            {tooltip.date}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 12px' }}>
            {mode === 'constituent' ? (
              <>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Traded Value</span>
                <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-primary)', textAlign: 'right' }}>
                  {fmtCr(tooltip.cell.amt)}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>vs 66D Avg</span>
                <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-primary)', textAlign: 'right' }}>
                  {(tooltip.cell.sx ?? 0).toFixed(2)}×
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>1D Change</span>
                <span style={{
                  fontSize: 10, fontFamily: 'monospace', textAlign: 'right',
                  color: tooltip.cell.d1 >= 0 ? 'var(--risk-green)' : 'var(--risk-red)',
                }}>
                  {fmtPct(tooltip.cell.d1)}
                </span>
              </>
            ) : (
              <>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Traded Value</span>
                <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-primary)', textAlign: 'right' }}>
                  {fmtCr(tooltip.cell.amt)}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Avg 5D Amt</span>
                <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-primary)', textAlign: 'right' }}>
                  {tooltip.cell.amt_5d != null ? fmtCr(tooltip.cell.amt_5d) : '—'}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Avg 22D Amt</span>
                <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-primary)', textAlign: 'right' }}>
                  {tooltip.cell.amt_22d != null ? fmtCr(tooltip.cell.amt_22d) : '—'}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>5D Return</span>
                <span style={{
                  fontSize: 10, fontFamily: 'monospace', textAlign: 'right',
                  color: (tooltip.cell.ret_5d ?? 0) >= 0 ? 'var(--risk-green)' : 'var(--risk-red)',
                }}>
                  {fmtPct(tooltip.cell.ret_5d)}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>22D Return</span>
                <span style={{
                  fontSize: 10, fontFamily: 'monospace', textAlign: 'right',
                  color: (tooltip.cell.ret_22d ?? 0) >= 0 ? 'var(--risk-green)' : 'var(--risk-red)',
                }}>
                  {fmtPct(tooltip.cell.ret_22d)}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Flow Signal</span>
                <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-primary)', textAlign: 'right' }}>
                  {SIGNAL_LABEL[tooltip.signal!]}
                </span>
              </>
            )}
          </div>
        </div>
        );
      })(), document.body)}
    </Card>
  );
}
