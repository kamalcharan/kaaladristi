import { useMemo, useState } from 'react';
import type { MarketBreadthDay } from '@/types';

/**
 * BreadthHeatmap — day-by-day grid of breadth dimensions to surface thrust days,
 * panic clusters, and trend shifts. Shared component: fed either the market-wide
 * km_market_breadth rows or a single index's per-constituent breadth (both emit
 * the same MarketBreadthDay shape). Each row is GATED on data presence, so a
 * feeder that doesn't supply the mover fields simply renders fewer rows.
 *
 * Newest-left → oldest-right (today first), matching the Sector Rotation /
 * Flow Intensity heatmap. 22/44/66-session window like the breadth chart.
 *
 * Colour semantics:
 *  - Participation rows (% above MA): DIVERGING and absolute — low % = red
 *    (weak, few stocks above their averages), high % = green (healthy). So a
 *    falling market reads RED, not green.
 *  - Mover rows: single-hue intensity relative to the window peak — up = green
 *    (thrust), down = red (panic).
 */

const NAVY = '#1e293b';   // base fill — matches FlowIntensityMap's cell base

interface BreadthHeatmapProps {
  data: MarketBreadthDay[];
  title?: string;
  /**
   * Minimum universe for the mover rows to be meaningful. Below this the mover
   * rows are hidden (on a tiny index one stock = a huge %). Participation rows
   * still show. Default 10.
   */
  minMoverUniverse?: number;
}

type Scale = 'diverging' | 'up' | 'down';

interface RowDef {
  key: string;
  label: string;
  scale: Scale;
  mover: boolean;                                  // true → gated by minMoverUniverse
  value: (d: MarketBreadthDay) => number | null;   // 0–100 %, or null if absent
}

function ratio(count: number | null | undefined, universe: number | null | undefined): number | null {
  if (count == null || universe == null || universe <= 0) return null;
  return (count / universe) * 100;
}

const ROWS: RowDef[] = [
  { key: 'a20',  label: '% Above 20 EMA',    scale: 'diverging', mover: false, value: d => d.pct_above_20 },
  { key: 'a50',  label: '% Above 50 SMA',    scale: 'diverging', mover: false, value: d => d.pct_above_50 },
  { key: 'a150', label: '% Above 150 SMA',   scale: 'diverging', mover: false, value: d => d.pct_above_150 },
  { key: 'up5',  label: '% Up >5% Today',    scale: 'up',        mover: true,  value: d => ratio(d.up_5pct, d.universe_count) },
  { key: 'dn5',  label: '% Down >5% Today',  scale: 'down',      mover: true,  value: d => ratio(d.down_5pct, d.universe_count) },
  { key: 'up20', label: '% Up >20% (5D)',    scale: 'up',        mover: true,  value: d => ratio(d.up_20pct_5d, d.universe_count) },
  { key: 'dn20', label: '% Down >20% (5D)',  scale: 'down',      mover: true,  value: d => ratio(d.down_20pct_5d, d.universe_count) },
];

const PERIODS = [22, 44, 66] as const;
type Period = typeof PERIODS[number];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(d: string): string {
  const [, m, day] = d.split('-');
  return `${+day} ${MONTHS[+m - 1]}`;
}

// Vivid, fully-saturated cells (like FlowIntensityMap) — navy is used ONLY for
// empty/zero cells, never blended into a live value (that's what muddied them).

/** Participation: absolute diverging bands — low % = red … high % = green. */
function divergingBg(v: number | null): string {
  if (v == null) return NAVY;
  if (v >= 60) return 'var(--risk-green)';                                       // healthy
  if (v >= 50) return 'color-mix(in srgb, var(--risk-green) 70%, var(--risk-amber))'; // yellow-green
  if (v >= 42) return 'var(--risk-amber)';                                       // neutral
  if (v >= 33) return 'color-mix(in srgb, var(--risk-red) 60%, var(--risk-amber))';   // orange
  return 'var(--risk-red)';                                                      // weak
}

/** Mover: solid green/red — navy when zero, a brighter step on strong days. */
function intensityBg(v: number | null, peak: number, scale: 'up' | 'down'): string {
  if (v == null || v <= 0) return NAVY;
  const color = scale === 'up' ? 'var(--risk-green)' : 'var(--risk-red)';
  const level = Math.min(1, v / peak);
  return level >= 0.6 ? `color-mix(in srgb, ${color} 70%, white)` : color;
}

export default function BreadthHeatmap({
  data,
  title = 'Breadth Heatmap',
  minMoverUniverse = 10,
}: BreadthHeatmapProps) {
  const [period, setPeriod] = useState<Period>(22);

  const { rows, cols, maxUniverse } = useMemo(() => {
    // Slice to the selected window (most-recent N), then newest → oldest.
    const windowed = data.slice(-period);
    const ordered = [...windowed].reverse();
    const maxU = ordered.reduce((mx, d) => Math.max(mx, d.universe_count ?? 0), 0);

    const active = ROWS
      .filter(r => {
        if (r.mover && maxU < minMoverUniverse) return false;         // gate mover rows on a real universe
        return ordered.some(d => r.value(d) != null);                 // gate on having data
      })
      .map(r => {
        const vals = ordered.map(r.value);
        const peak = vals.reduce<number>((mx, v) => (v != null && v > mx ? v : mx), 0);
        return { ...r, vals, peak: peak > 0 ? peak : 1 };
      });

    return { rows: active, cols: ordered, maxUniverse: maxU };
  }, [data, period, minMoverUniverse]);

  if (data.length === 0 || rows.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-4">
        <h3 className="text-[13px] font-bold text-[var(--text-primary)] mb-1">{title}</h3>
        <p className="text-[11px] text-muted">No breadth data available for this view.</p>
      </div>
    );
  }

  const newest = cols[0]?.trade_date;                          // today (left)
  const mid    = cols[Math.floor(cols.length / 2)]?.trade_date;
  const oldest = cols[cols.length - 1]?.trade_date;            // oldest (right)

  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <div>
          <h3 className="text-[13px] font-bold text-[var(--text-primary)]">{title}</h3>
          <span className="text-[10px] text-muted">Identify thrust days, panic clusters, and trend shifts</span>
        </div>
        {/* Period filter — same 22/44/66 as the breadth chart */}
        <div className="flex items-center gap-0.5 bg-kd-elevated rounded-lg p-0.5">
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={
                'px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ' +
                (period === p ? 'bg-accent-indigo text-white' : 'text-muted hover:text-[var(--text-secondary)]')
              }
            >
              {p}D
            </button>
          ))}
        </div>
      </div>

      {/* Scroll container — wide grids scroll here, page never scrolls sideways */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 620 }}>
          {/* Date axis (today left → oldest right) */}
          <div style={{ display: 'flex', marginLeft: 150, justifyContent: 'space-between',
            fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginBottom: 6 }}>
            <span>{newest && fmtDate(newest)}</span>
            <span>{mid && fmtDate(mid)}</span>
            <span>{oldest && fmtDate(oldest)}</span>
          </div>

          {rows.map(row => (
            <div key={row.key} style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ width: 150, flexShrink: 0, fontFamily: 'var(--font-body)', fontSize: 10,
                color: 'var(--text-secondary)', paddingRight: 8 }}>
                {row.label}
              </div>
              <div style={{ display: 'flex', gap: 2, flex: 1 }}>
                {row.vals.map((v, i) => {
                  const d = cols[i];
                  const bg = row.scale === 'diverging'
                    ? divergingBg(v)
                    : intensityBg(v, row.peak, row.scale);
                  return (
                    <div
                      key={d.trade_date}
                      title={`${fmtDate(d.trade_date)} · ${row.label}: ${v != null ? v.toFixed(1) + '%' : 'n/a'}`}
                      style={{ flex: 1, minWidth: 6, height: 20, borderRadius: 2, background: bg,
                        border: '1px solid color-mix(in srgb, var(--text-primary) 7%, transparent)' }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 text-[9px] text-muted" style={{ marginLeft: 150 }}>
        Participation rows: red = weak (few above average) · green = healthy. Mover rows: intensity vs window peak · universe ≈ {maxUniverse.toLocaleString()} stocks
        {rows.every(r => !r.mover) && ' · mover rows hidden (universe too small)'}
      </div>
    </div>
  );
}
