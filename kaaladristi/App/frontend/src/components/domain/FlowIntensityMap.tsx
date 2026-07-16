// REUSE:
// 1. IndexDetailPage Tab 4 — constituent mode (Sprint 10)
// 2. SectorRotationPage Heat toggle — index mode (Sprint 10)
// 3. CustomIndex detail — constituent mode (Sprint 12)
// 4. Visual Pulse peer view — constituent mode (Post-MVP)
//
// Both modes render identically (owner decision 2026-07-05: the constituent
// Flow Map is the sector heatmap one level down) — score-based 5-state cells,
// micro-trend bars, portal tooltip. The only mode differences are the label
// column width, the tooltip amount labels, and the STRONG score cut, because
// index scores (ret + capped surge, ~0–80) and equity scores (surge² × 25,
// ~0–300) live on different scales and MUST NOT share a threshold.

import { useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Card } from '@/components/ui/Card';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CellData {
  d1: number;        // 1D price % (sign → border color)
  amt: number;       // ₹ Cr traded value
  amt_5d?: number;   // avg_amt_5d
  amt_22d?: number;  // avg_amt_22d
  ret_5d?: number;   // 5D return % (cell top edge + tooltip)
  ret_22d?: number;  // 22D return % (tooltip only)
  s5?: number;       // score_5d  — money-flow conviction (drives cell color + text)
  s22?: number;      // score_22d — 1-month conviction baseline
}

interface FlowIntensityMapProps {
  mode: 'constituent' | 'index';
  rows: string[];
  dates: string[];
  cells: Record<string, CellData[]>;
  title?: string;
  subtitle?: string;
  dayWindow?: 5 | 22 | 66;             // index only
  onDayWindowChange?: (d: 5 | 22 | 66) => void;
  cellWidth?: number;                   // default 92
  onRowClick?: (row: string) => void;   // row label click → drill-down
  bseRows?: Set<string>;                // constituent mode: rows that are BSE-only scrips → show a BSE chip
  bare?: boolean;                       // embed inside another card: drop the Card wrapper + header + footer
  hideRowLabels?: boolean;              // drop the left name column (caller already shows the identity)
}

// ── Color constants ────────────────────────────────────────────────────────────
// #166534 is the only token not covered by CSS vars (per SKILL.md)

const DARK_GREEN = '#166534';
const NO_DATA    = '#1e293b';

// ── 5-state SCORE-based signal ────────────────────────────────────────────────
// Owner decision 2026-07-05: cells encode money-flow CONVICTION (score_5d),
// not price % — "scores start moving first; Score is the real moat".
// Score is floored at 0 for negative returns, so the downside states come
// from outflow evidence instead.
//
// INDEX cut = 25 ≈ p90 of positive index score_5d days (calibrated
// 2026-07-05: p50=4.1, p75=12.7, p90=26.8, p97=39.8).
//
// EQUITY cut = 28 ≈ p90 of positive equity score_5d days (calibrated
// 2026-07-05 on 2026 YTD: p50=4.7, p75=10.8, p90=27.5, p97=86.0). The two
// distributions land close at p90 despite different formulas because most
// positive equity-score days sit on the return-only branch; the surge²×25
// branch produces the long tail (p97=86), which STRONG deliberately catches.

export const STRONG_SCORE_CUT_INDEX  = 25;
const STRONG_SCORE_CUT_EQUITY = 28;

export type FlowSignal = 'STRONG' | 'BUILDING' | 'FADING' | 'OUTFLOW' | 'QUIET';

export function flowSignal(c: CellData, strongCut: number): FlowSignal {
  const s5  = c.s5  ?? 0;
  const s22 = c.s22 ?? 0;
  if (s5 > 0 && s5 >= s22) return s5 >= strongCut ? 'STRONG' : 'BUILDING';
  if (s5 > 0 && s5 < s22)  return 'FADING';
  const outflow = (c.amt_5d ?? 0) < (c.amt_22d ?? 0) && (c.ret_5d ?? 0) < 0;
  return outflow ? 'OUTFLOW' : 'QUIET';
}

const QUIET_BG = '#334155';  // slate — distinguishable from NO_DATA (#1e293b)

const SIGNAL_COLOR: Record<FlowSignal, string> = {
  STRONG:   DARK_GREEN,
  BUILDING: 'var(--risk-green)',
  FADING:   'var(--risk-amber)',
  OUTFLOW:  'var(--risk-red)',
  QUIET:    QUIET_BG,
};

// Cell text must contrast with the cell background, not encode return sign
// (the background already encodes the signal).
const SIGNAL_TEXT: Record<FlowSignal, string> = {
  STRONG:   '#f8fafc',  // near-white on dark green
  BUILDING: '#0b1220',  // near-black on bright green
  FADING:   '#0b1220',  // near-black on amber
  OUTFLOW:  '#fef2f2',  // near-white on red
  QUIET:    '#94a3b8',  // muted on slate
};

const SIGNAL_LABEL: Record<FlowSignal, string> = {
  STRONG:   'Strong Conviction',
  BUILDING: 'Building',
  FADING:   'Fading',
  OUTFLOW:  'Outflow',
  QUIET:    'Quiet',
};

// ── Tooltip state ─────────────────────────────────────────────────────────────

interface TooltipState {
  cx: number;      // cell horizontal center (viewport coords)
  top: number;     // cell top edge
  bottom: number;  // cell bottom edge
  row: string;
  date: string;
  cell: CellData;
  signal: FlowSignal;
}

// ── Fixed sizing ──────────────────────────────────────────────────────────────

const HEADER_ROW_H = 28;  // date header row
const CELL_H       = 56;  // sized for glanceability — one score line per cell
const GAP          = 2;
const LABEL_W_CON  = 130;  // constituent mode — symbols / short BSE display names
const LABEL_W_IDX  = 220;  // index mode — full index names, no harsh truncation
const TREND_W      = 72;   // micro-trend bars between name and cells

// ── Helpers ───────────────────────────────────────────────────────────────────

function trunc(s: string, n: number) {
  if (!s) return s;
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function fmtPct(v: number | undefined) {
  if (v == null) return '—';
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}

function fmtCr(v: number) {
  return '₹' + v.toFixed(1) + ' Cr';
}

// ── Micro-trend bars: CONVICTION trajectory ───────────────────────────────────
// One bar per session = that day's score_5d, chronological left -> right
// (the heat grid runs newest-first, but a trend shape must read oldest ->
// newest — hence the reversed order and the title hint). Bars grow from a
// bottom baseline (scores are never negative); green = accelerating
// (score_5d above score_22d that day), amber = fading. The row reads as a
// conviction timeline — the drill-down's flow-trend chart is its zoom-in.

export function MicroTrend({ rowData, height }: { rowData: CellData[]; height: number }) {
  const cells = [...rowData].reverse();
  if (cells.length === 0) return <div style={{ width: TREND_W }} />;

  const vals = cells.map((c) => c?.s5 ?? 0);
  const maxVal = Math.max(1, ...vals);
  const innerH = height - 14;
  const barW = Math.max(1, Math.floor((TREND_W - 8) / cells.length) - 1);
  const step = (TREND_W - 8) / cells.length;

  return (
    <svg
      width={TREND_W}
      height={innerH}
      style={{ display: 'block' }}
    >
      <line x1={0} y1={innerH - 0.5} x2={TREND_W - 8} y2={innerH - 0.5} stroke="color-mix(in srgb, var(--text-primary) 8%, transparent)" strokeWidth={1} />
      {cells.map((c, i) => {
        const s5 = c?.s5 ?? 0;
        if (s5 <= 0) return null;
        const h = Math.max(1, (s5 / maxVal) * (innerH - 2));
        const accelerating = s5 >= (c?.s22 ?? 0);
        return (
          <rect
            key={i}
            x={i * step}
            y={innerH - h}
            width={barW}
            height={h}
            fill={accelerating ? 'var(--risk-green)' : 'var(--risk-amber)'}
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
    background: active ? 'color-mix(in srgb, var(--text-primary) 8%, transparent)' : 'transparent',
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
  dayWindow,
  onDayWindowChange,
  cellWidth,
  onRowClick,
  bseRows,
  bare = false,
  hideRowLabels = false,
}: FlowIntensityMapProps) {
  const cellW = cellWidth ?? 92;
  const labelW = mode === 'index' ? LABEL_W_IDX : LABEL_W_CON;
  const strongCut = mode === 'index' ? STRONG_SCORE_CUT_INDEX : STRONG_SCORE_CUT_EQUITY;

  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const signalFor = useCallback(
    (c: CellData): FlowSignal => flowSignal(c, strongCut),
    [strongCut],
  );

  const borderColor = useCallback(
    (c: CellData): string => ((c.ret_5d ?? 0) >= 0 ? 'var(--risk-green)' : 'var(--risk-red)'),
    [],
  );

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent, row: string, date: string, c: CellData) => {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setTooltip({ cx: r.left + r.width / 2, top: r.top, bottom: r.bottom, row, date, cell: c, signal: signalFor(c) });
    },
    [signalFor],
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  // Amount labels differ by mode: index amounts are the 5D/22D delivery
  // averages; the equity tooltip says whose baseline it is.
  const amtLabels = useMemo(
    () => (mode === 'index'
      ? { a5: 'Avg 5D Amt', a22: 'Avg 22D Amt' }
      : { a5: 'Avg 5D Delivery', a22: 'Avg 22D Delivery' }),
    [mode],
  );

  if (rows.length === 0 || dates.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 24 }}>
        No flow data available.
      </div>
    );
  }

  const totalCellW = dates.length * (cellW + GAP) - GAP;

  const inner = (
    <>

      {/* ── Header (chrome only — hidden when embedded bare) ── */}
      {!bare && (
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

          {/* Index toggle: 5D | 22D | 66D */}
          {mode === 'index' && onDayWindowChange && (
            <div style={{ display: 'inline-flex', background: 'color-mix(in srgb, var(--text-primary) 4%, transparent)', borderRadius: 6, padding: 2, gap: 2 }}>
              {([5, 22, 66] as const).map((d) => (
                <button key={d} style={toggleBtnStyle(dayWindow === d)} onClick={() => onDayWindowChange(d)}>
                  {d}D
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Grid ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>

        {/* Label column */}
        {!hideRowLabels && (
        <div style={{ flexShrink: 0, width: labelW }}>
          {/* Spacer for date header row */}
          <div style={{ height: HEADER_ROW_H + GAP }} />
          {rows.map((row) => (
            <div
              key={row}
              title={row}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={{
                height: CELL_H,
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
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {mode === 'index' ? trunc(row, 30) : trunc(row, 17)}
              </span>
              {bseRows?.has(row) && (
                <span
                  style={{
                    fontSize: 8, fontWeight: 700, letterSpacing: '0.05em',
                    color: 'var(--text-secondary)',
                    background: 'color-mix(in srgb, var(--text-primary) 9%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--text-primary) 18%, transparent)',
                    borderRadius: 3, padding: '1px 4px', marginLeft: 5, flexShrink: 0,
                  }}
                >
                  BSE
                </span>
              )}
            </div>
          ))}
        </div>
        )}

        {/* Micro-trend column */}
        <div style={{ flexShrink: 0, width: TREND_W, paddingRight: 8 }}>
          <div style={{
            height: HEADER_ROW_H + GAP,
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
              title="Score 5D (conviction) per session, oldest → newest. Green = accelerating vs its 1-month pace, amber = fading."
              style={{
                height: CELL_H,
                marginBottom: GAP,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <MicroTrend rowData={cells[row] ?? []} height={CELL_H} />
            </div>
          ))}
        </div>

        {/* Scrollable cell area — minWidth:0 is required so this flex item
            actually scrolls horizontally instead of stretching its parent
            (without it, a wide grid overflows the page to the right). */}
        <div style={{ overflowX: 'auto', flex: 1, minWidth: 0 }}>

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
                  height: HEADER_ROW_H,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
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
                          height: CELL_H,
                          flexShrink: 0,
                          borderRadius: 3,
                          background: NO_DATA,
                        }}
                      />
                    );
                  }

                  const sig = signalFor(c);

                  return (
                    <div
                      key={dateStr}
                      onMouseEnter={(e) => handleMouseEnter(e, row, dateStr, c)}
                      onMouseLeave={handleMouseLeave}
                      style={{
                        width: cellW,
                        height: CELL_H,
                        flexShrink: 0,
                        borderRadius: 3,
                        background: SIGNAL_COLOR[sig],
                        borderTop: `2.5px solid ${borderColor(c)}`,
                        cursor: 'default',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 1,
                        padding: '0 2px',
                      }}
                    >
                      <div style={{
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: 'monospace',
                        lineHeight: 1.2,
                        textAlign: 'center',
                        color: SIGNAL_TEXT[sig],
                      }}>
                        {c.s5 != null ? Math.round(c.s5) : '—'}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Footer (chrome only — hidden when embedded bare) ── */}
      {!bare && (
        <div style={{ marginTop: 12, color: 'var(--text-muted)', fontSize: 10, lineHeight: 1.5 }}>
          Cell fill = money-flow conviction (Score 5D vs its 1-month pace). Cell number = Score 5D. Top edge = price direction that session.
          {onRowClick && (mode === 'index' ? ' Click an index name to open its detail.' : ' Click a symbol to open its detail.')}
        </div>
      )}

      {/* ── Cell tooltip ──
          Anchored immediately ABOVE the hovered cell (falls below it only
          when the cell is at the very top of the viewport). Rendered through
          a portal to document.body so no transformed/filtered ancestor can
          re-anchor position:fixed and push it off-screen. */}
      {tooltip && createPortal((() => {
        const TT_W = 210;
        const ttH  = 250;
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
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Traded Value</span>
            <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-primary)', textAlign: 'right' }}>
              {fmtCr(tooltip.cell.amt)}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{amtLabels.a5}</span>
            <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-primary)', textAlign: 'right' }}>
              {tooltip.cell.amt_5d != null ? fmtCr(tooltip.cell.amt_5d) : '—'}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{amtLabels.a22}</span>
            <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-primary)', textAlign: 'right' }}>
              {tooltip.cell.amt_22d != null ? fmtCr(tooltip.cell.amt_22d) : '—'}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Score 5D</span>
            <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-primary)', textAlign: 'right' }}>
              {tooltip.cell.s5 != null ? tooltip.cell.s5.toFixed(1) : '—'}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Score 22D</span>
            <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-primary)', textAlign: 'right' }}>
              {tooltip.cell.s22 != null ? tooltip.cell.s22.toFixed(1) : '—'}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>1D Change</span>
            <span style={{
              fontSize: 10, fontFamily: 'monospace', textAlign: 'right',
              color: tooltip.cell.d1 >= 0 ? 'var(--risk-green)' : 'var(--risk-red)',
            }}>
              {fmtPct(tooltip.cell.d1)}
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
              {SIGNAL_LABEL[tooltip.signal]}
            </span>
          </div>
        </div>
        );
      })(), document.body)}
    </>
  );

  if (bare) return inner;
  return (
    <Card variant="default" className="p-5">
      {inner}
    </Card>
  );
}
