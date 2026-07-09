import { useMemo } from 'react';
import type { MarketBreadthDay } from '@/types';

/**
 * BreadthHeatmap — day-by-day grid of breadth dimensions to surface thrust days,
 * panic clusters, and trend shifts. Shared component: fed either the market-wide
 * km_market_breadth rows or a single index's per-constituent breadth (both emit
 * the same MarketBreadthDay shape). Each row is GATED on data presence, so a
 * feeder that doesn't supply the mover fields simply renders fewer rows.
 *
 * Chronological, oldest-left → newest-right (matches the score chart above it).
 */

interface BreadthHeatmapProps {
  data: MarketBreadthDay[];
  /** Header label; defaults to a generic title. */
  title?: string;
  /**
   * Minimum universe for the mover rows to be meaningful. Below this the mover
   * rows are hidden (on a tiny index one stock = a huge %). Participation rows
   * still show. Default 10.
   */
  minMoverUniverse?: number;
}

type Tone = 'bull' | 'bear';

interface RowDef {
  key: string;
  label: string;
  tone: Tone;
  mover: boolean;                              // true → gated by minMoverUniverse
  value: (d: MarketBreadthDay) => number | null;  // 0–100 %, or null if absent
}

function ratio(count: number | null | undefined, universe: number | null | undefined): number | null {
  if (count == null || universe == null || universe <= 0) return null;
  return (count / universe) * 100;
}

const ROWS: RowDef[] = [
  { key: 'a20',  label: '% > 20 EMA',       tone: 'bull', mover: false, value: d => d.pct_above_20 },
  { key: 'a50',  label: '% > 50 SMA',       tone: 'bull', mover: false, value: d => d.pct_above_50 },
  { key: 'a150', label: '% > 150 SMA',      tone: 'bull', mover: false, value: d => d.pct_above_150 },
  { key: 'up5',  label: '% Up >5% Today',   tone: 'bull', mover: true,  value: d => ratio(d.up_5pct, d.universe_count) },
  { key: 'dn5',  label: '% Down >5% Today', tone: 'bear', mover: true,  value: d => ratio(d.down_5pct, d.universe_count) },
  { key: 'up20', label: '% Up >20% (5D)',   tone: 'bull', mover: true,  value: d => ratio(d.up_20pct_5d, d.universe_count) },
  { key: 'dn20', label: '% Down >20% (5D)', tone: 'bear', mover: true,  value: d => ratio(d.down_20pct_5d, d.universe_count) },
];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(d: string): string {
  const [, m, day] = d.split('-');
  return `${+day} ${MONTHS[+m - 1]}`;
}

export default function BreadthHeatmap({
  data,
  title = 'Breadth Heatmap',
  minMoverUniverse = 10,
}: BreadthHeatmapProps) {
  const { rows, maxUniverse } = useMemo(() => {
    const maxU = data.reduce((mx, d) => Math.max(mx, d.universe_count ?? 0), 0);

    const active = ROWS
      .filter(r => {
        // Gate mover rows on a meaningful universe
        if (r.mover && maxU < minMoverUniverse) return false;
        // Gate every row on having at least one real value in the window
        return data.some(d => r.value(d) != null);
      })
      .map(r => {
        const vals = data.map(r.value);
        const peak = vals.reduce<number>((mx, v) => (v != null && v > mx ? v : mx), 0);
        return { ...r, vals, peak: peak > 0 ? peak : 1 };
      });

    return { rows: active, maxUniverse: maxU };
  }, [data, minMoverUniverse]);

  if (data.length === 0 || rows.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-4">
        <h3 className="text-[13px] font-bold text-[var(--text-primary)] mb-1">{title}</h3>
        <p className="text-[11px] text-muted">No breadth data available for this view.</p>
      </div>
    );
  }

  const first = data[0]?.trade_date;
  const mid   = data[Math.floor(data.length / 2)]?.trade_date;
  const last  = data[data.length - 1]?.trade_date;

  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-[13px] font-bold text-[var(--text-primary)]">{title}</h3>
        <span className="text-[10px] text-muted">Identify thrust days, panic clusters, and trend shifts</span>
      </div>

      {/* Scroll container — wide grids scroll here, page never scrolls sideways */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 620 }}>
          {/* Date axis */}
          <div style={{ display: 'flex', marginLeft: 140, justifyContent: 'space-between',
            fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginBottom: 6 }}>
            <span>{first && fmtDate(first)}</span>
            <span>{mid && fmtDate(mid)}</span>
            <span>{last && fmtDate(last)}</span>
          </div>

          {rows.map(row => (
            <div key={row.key} style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ width: 140, flexShrink: 0, fontFamily: 'var(--font-sans)', fontSize: 10,
                color: 'var(--text-secondary)', paddingRight: 8 }}>
                {row.label}
              </div>
              <div style={{ display: 'flex', gap: 1, flex: 1 }}>
                {row.vals.map((v, i) => {
                  const d = data[i];
                  // Same tokens as the Sector Rotation heatmap (FlowIntensityMap):
                  // --risk-green / --risk-red (identical values to --bull/--bear).
                  const baseColor = row.tone === 'bull' ? 'var(--risk-green)' : 'var(--risk-red)';
                  let bg = 'color-mix(in srgb, var(--text-primary) 5%, transparent)';
                  if (v != null) {
                    const intensity = Math.max(0.10, Math.min(1, v / row.peak));
                    bg = `color-mix(in srgb, ${baseColor} ${Math.round(intensity * 100)}%, transparent)`;
                  }
                  return (
                    <div
                      key={d.trade_date}
                      title={`${fmtDate(d.trade_date)} · ${row.label}: ${v != null ? v.toFixed(1) + '%' : 'n/a'}`}
                      style={{ flex: 1, minWidth: 5, height: 18, borderRadius: 2, background: bg }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 text-[9px] text-muted" style={{ marginLeft: 140 }}>
        Cell intensity = value relative to its row's peak over the window · universe ≈ {maxUniverse.toLocaleString()} stocks
        {rows.every(r => !r.mover) && ' · mover rows hidden (universe too small)'}
      </div>
    </div>
  );
}
