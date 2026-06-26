import { useState, useRef, useCallback, useMemo } from 'react';

export interface CellData {
  amt: number;   // ₹ Cr traded value
  sx: number;    // surge multiple vs 66D avg baseline
  d1: number;    // 1D price % change (sign → border color)
}

interface FlowIntensityMapProps {
  rows: string[];
  dates: string[];
  cells: Record<string, CellData[]>;
  title?: string;
  subtitle?: string;
  mode?: 'sx' | 'amt';
}

// ── Per-row percentile coloring ───────────────────────────────────────────────
// Color = where a cell sits within THAT STOCK'S OWN distribution, not global.
// Guarantees every row shows the full color range regardless of absolute volume.
// CSS vars: --risk-green=#10b981  --risk-amber=#f59e0b  --risk-red=#ef4444
// Hardcoded: dark green #166534 (no token), light pink #f87171 (no token)
const NO_DATA_COLOR = '#1e293b';

interface RowCuts { p20: number; p40: number; p60: number; p80: number }
type CutsMap = Record<string, RowCuts>;

function computeRowCuts(
  rows: string[],
  cells: Record<string, CellData[]>,
  field: 'sx' | 'amt',
): CutsMap {
  const result: CutsMap = {};
  for (const sym of rows) {
    const vals: number[] = [];
    for (const c of (cells[sym] ?? [])) {
      const v = field === 'sx' ? c.sx : c.amt;
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

function discreteColor(val: number, cuts: RowCuts): string {
  if (val <= 0)          return NO_DATA_COLOR;
  if (val >= cuts.p80)   return '#166534';             // top 20% for this stock
  if (val >= cuts.p60)   return 'var(--risk-green)';  // 60–80th pct
  if (val >= cuts.p40)   return 'var(--risk-amber)';  // 40–60th pct
  if (val >= cuts.p20)   return '#f87171';            // 20–40th pct
  return 'var(--risk-red)';                           // bottom 20%
}

// ── Keyframe injection (singleton) ───────────────────────────────────────────
let _keyframeInjected = false;
function ensureKeyframe() {
  if (_keyframeInjected) return;
  _keyframeInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fim-cell-in {
      from { opacity: 0; transform: scale(0.7); }
      to   { opacity: 1; transform: scale(1); }
    }
  `;
  document.head.appendChild(style);
}

// ── Tooltip state ─────────────────────────────────────────────────────────────
interface TooltipState {
  x: number;
  y: number;
  symbol: string;
  date: string;
  amt: number;
  sx: number;
  d1: number;
}

const CELL = 28;
const GAP  = 2;
const LABEL_W = 100;

export default function FlowIntensityMap({
  rows,
  dates,
  cells,
  title = 'Flow Intensity',
  subtitle,
  mode: initMode = 'sx',
}: FlowIntensityMapProps) {
  ensureKeyframe();

  const [mode, setMode] = useState<'sx' | 'amt'>(initMode);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Per-row percentile cuts — recomputed only when data changes
  const sxCuts  = useMemo(() => computeRowCuts(rows, cells, 'sx'),  [rows, cells]);
  const amtCuts = useMemo(() => computeRowCuts(rows, cells, 'amt'), [rows, cells]);

  const cellColor = useCallback(
    (sym: string, c: CellData) => {
      const cuts = mode === 'sx' ? sxCuts[sym] : amtCuts[sym];
      if (!cuts) return NO_DATA_COLOR;
      return discreteColor(mode === 'sx' ? c.sx : c.amt, cuts);
    },
    [mode, sxCuts, amtCuts],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent, sym: string, dateStr: string, c: CellData) => {
      setTooltip({ x: e.clientX, y: e.clientY, symbol: sym, date: dateStr, amt: c.amt, sx: c.sx, d1: c.d1 });
    },
    [],
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  if (rows.length === 0 || dates.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 24 }}>
        No flow data available.
      </div>
    );
  }

  const totalCellW = dates.length * (CELL + GAP) - GAP;

  return (
    <div style={{ fontFamily: 'inherit', userSelect: 'none' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <span style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}>{title}</span>
          {subtitle && (
            <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 8 }}>{subtitle}</span>
          )}
        </div>
        {/* Toggle */}
        <div
          style={{
            display: 'flex',
            background: 'var(--kd-elevated, rgba(255,255,255,0.05))',
            borderRadius: 6,
            padding: 2,
            gap: 2,
          }}
        >
          {(['sx', 'amt'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: '3px 10px',
                borderRadius: 4,
                border: 'none',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 500,
                background: mode === m ? 'rgba(16,185,129,0.15)' : 'transparent',
                color: mode === m ? 'var(--risk-green)' : 'var(--text-muted)',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {m === 'sx' ? 'Surge×' : '₹ Cr'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div ref={containerRef} style={{ display: 'flex', alignItems: 'flex-start' }}>
        {/* Label column */}
        <div style={{ flexShrink: 0, width: LABEL_W }}>
          {/* Date header spacer */}
          <div style={{ height: CELL + GAP }} />
          {rows.map((sym) => (
            <div
              key={sym}
              style={{
                height: CELL,
                marginBottom: GAP,
                display: 'flex',
                alignItems: 'center',
                paddingRight: 8,
                color: 'var(--text-muted)',
                fontSize: 11,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontFamily: 'monospace',
              }}
            >
              {sym}
            </div>
          ))}
        </div>

        {/* Scrollable cells */}
        <div style={{ overflowX: 'auto', flex: 1 }}>
          {/* Date row */}
          <div style={{ display: 'flex', gap: GAP, marginBottom: GAP, width: totalCellW }}>
            {dates.map((d) => (
              <div
                key={d}
                style={{
                  width: CELL,
                  flexShrink: 0,
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: 9,
                  lineHeight: '1',
                  paddingTop: 4,
                  overflow: 'hidden',
                }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Data rows */}
          {rows.map((sym, rowIdx) => {
            const rowData = cells[sym] ?? [];
            return (
              <div key={sym} style={{ display: 'flex', gap: GAP, marginBottom: GAP }}>
                {dates.map((dateStr, colIdx) => {
                  const c = rowData[colIdx];
                  if (!c) {
                    return (
                      <div
                        key={dateStr}
                        style={{ width: CELL, height: CELL, flexShrink: 0, borderRadius: 3, background: NO_DATA_COLOR }}
                      />
                    );
                  }
                  const bg = cellColor(sym, c);
                  const borderColor = c.d1 >= 0 ? 'var(--risk-green)' : 'var(--risk-red)';
                  const delay = colIdx * 14 + rowIdx * 40;
                  return (
                    <div
                      key={dateStr}
                      onMouseMove={(e) => handleMouseMove(e, sym, dateStr, c)}
                      onMouseLeave={handleMouseLeave}
                      style={{
                        width: CELL,
                        height: CELL,
                        flexShrink: 0,
                        borderRadius: 3,
                        background: bg,
                        borderTop: `2.5px solid ${borderColor}`,
                        cursor: 'default',
                        animation: `fim-cell-in 0.2s ease both`,
                        animationDelay: `${delay}ms`,
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 10, color: 'var(--text-muted)', fontSize: 10, lineHeight: 1.5 }}>
        Bright cells indicate above-average flow for that stock's own history. Edge color shows price direction.
      </div>

      {/* Custom tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x + 12,
            top: tooltip.y - 10,
            zIndex: 9999,
            background: 'var(--kd-elevated, #1a2030)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 6,
            padding: '7px 10px',
            pointerEvents: 'none',
            minWidth: 150,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 12, marginBottom: 4, fontFamily: 'monospace' }}>
            {tooltip.symbol}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 2 }}>
            {tooltip.date}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px', marginTop: 5 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>Traded Value</span>
            <span style={{ color: 'var(--text-primary)', fontSize: 10, textAlign: 'right', fontFamily: 'monospace' }}>
              ₹{tooltip.amt.toFixed(1)} Cr
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>vs 66D Avg</span>
            <span style={{ color: 'var(--text-primary)', fontSize: 10, textAlign: 'right', fontFamily: 'monospace' }}>
              {tooltip.sx.toFixed(2)}×
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>1D Change</span>
            <span
              style={{
                fontSize: 10,
                textAlign: 'right',
                fontFamily: 'monospace',
                color: tooltip.d1 >= 0 ? 'var(--risk-green)' : 'var(--risk-red)',
              }}
            >
              {tooltip.d1 >= 0 ? '+' : ''}{tooltip.d1.toFixed(2)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
