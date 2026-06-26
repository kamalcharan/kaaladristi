import { useState, useRef, useCallback } from 'react';

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

// ── Amber ramp (7 stops, log scale) ──────────────────────────────────────────
const RAMP: Array<[number, [number, number, number]]> = [
  [0.00, [19,  25,  34]],
  [0.16, [42,  36,  21]],
  [0.34, [92,  67,  24]],
  [0.55, [165, 110, 28]],
  [0.74, [224, 151, 42]],
  [0.89, [246, 196, 87]],
  [1.00, [252, 232, 184]],
];

function interpolateRamp(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  let lo = RAMP[0];
  let hi = RAMP[RAMP.length - 1];
  for (let i = 0; i < RAMP.length - 1; i++) {
    if (clamped >= RAMP[i][0] && clamped <= RAMP[i + 1][0]) {
      lo = RAMP[i];
      hi = RAMP[i + 1];
      break;
    }
  }
  const span = hi[0] - lo[0];
  const f = span === 0 ? 0 : (clamped - lo[0]) / span;
  const r = Math.round(lo[1][0] + f * (hi[1][0] - lo[1][0]));
  const g = Math.round(lo[1][1] + f * (hi[1][1] - lo[1][1]));
  const b = Math.round(lo[1][2] + f * (hi[1][2] - lo[1][2]));
  return `rgb(${r},${g},${b})`;
}

function logNorm(val: number, min: number, max: number): number {
  if (max <= min || val <= 0) return 0;
  const lv = Math.log(Math.max(val, 1e-6));
  const lmin = Math.log(Math.max(min, 1e-6));
  const lmax = Math.log(Math.max(max, 1e-6));
  if (lmax === lmin) return 0;
  return Math.max(0, Math.min(1, (lv - lmin) / (lmax - lmin)));
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

  // Compute domain for log normalization
  const { minVal, maxVal } = (() => {
    let mn = Infinity, mx = 0;
    for (const sym of rows) {
      const row = cells[sym];
      if (!row) continue;
      for (const c of row) {
        const v = mode === 'sx' ? c.sx : c.amt;
        if (v > 0) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
      }
    }
    return { minVal: mn === Infinity ? 0 : mn, maxVal: mx };
  })();

  const cellColor = useCallback(
    (c: CellData) => {
      const v = mode === 'sx' ? c.sx : c.amt;
      const t = logNorm(v, minVal, maxVal);
      return interpolateRamp(t);
    },
    [mode, minVal, maxVal],
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
                background: mode === m ? 'rgba(246,196,87,0.18)' : 'transparent',
                color: mode === m ? 'rgb(246,196,87)' : 'var(--text-muted)',
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
                        style={{ width: CELL, height: CELL, flexShrink: 0, borderRadius: 3, background: 'rgb(19,25,34)' }}
                      />
                    );
                  }
                  const bg = cellColor(c);
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
        Bright cells indicate above-average traded value for that session. Edge color shows price direction.
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
