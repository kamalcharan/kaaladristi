/**
 * StockFlowHeatmap — single-stock money-flow heatmap (Study).
 *
 * Reuses FlowIntensityMap in constituent mode with ONE row (this stock), so it
 * inherits the exact cell style, 5-state flowSignal coloring, MicroTrend, and
 * tooltip from the Sector Rotation heatmap. A 5D / 22D / 66D toggle controls how
 * many trailing sessions are shown (slice only — no refetch). Daily bars only.
 */

import { useState } from 'react';
import FlowIntensityMap, { type CellData } from './FlowIntensityMap';

// Loose row shape — equity EOD rows carry these at runtime (fetchEquityEodById
// selects the extra columns) even though IndicatorRow doesn't declare them, same
// pattern StatStrip uses.
interface FlowRow {
  trade_date: string;
  score_5d?: number | null;
  score_22d?: number | null;
  ret_5d?: number | null;
  ret_22d?: number | null;
  pct_chng?: number | null;
  value_cr?: number | null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(d: string): string {
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]}`;
}

const WINDOWS = [5, 22, 66] as const;
type Win = (typeof WINDOWS)[number];

export default function StockFlowHeatmap({ label, rows }: { label: string; rows: FlowRow[] }) {
  const [win, setWin] = useState<Win>(22);

  // Newest-first (column 0 = latest) — same orientation FlowIntensityMap /
  // fetchConstituentFlowMap use; MicroTrend un-reverses for its chronological read.
  const rev = [...rows.slice(-win)].reverse();
  const dates = rev.map((r) => fmtDate(r.trade_date));
  const cells: CellData[] = rev.map((r) => ({
    d1: r.pct_chng ?? 0,
    amt: r.value_cr ?? 0,
    ret_5d: r.ret_5d ?? undefined,
    ret_22d: r.ret_22d ?? undefined,
    s5: r.score_5d ?? undefined,
    s22: r.score_22d ?? undefined,
  }));

  if (rev.length === 0) return null;

  return (
    <div className="mt-2">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
        <div style={{ display: 'inline-flex', background: 'color-mix(in srgb, var(--text-primary) 4%, transparent)', borderRadius: 6, padding: 2, gap: 2 }}>
          {WINDOWS.map((w) => (
            <button
              key={w}
              onClick={() => setWin(w)}
              style={{
                padding: '3px 9px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 11,
                fontWeight: win === w ? 600 : 400,
                background: win === w ? 'color-mix(in srgb, var(--text-primary) 8%, transparent)' : 'transparent',
                color: win === w ? 'var(--text-primary)' : 'var(--text-muted)',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {w}D
            </button>
          ))}
        </div>
      </div>
      <FlowIntensityMap
        mode="constituent"
        rows={[label]}
        dates={dates}
        cells={{ [label]: cells }}
        title="Flow Heatmap"
        subtitle={`Last ${win} sessions · money-flow conviction`}
      />
    </div>
  );
}
