import { useMemo, useState } from 'react';
import type { BreadthRocDay } from '@/types';

/**
 * BreadthRocHeatmap — companion to BreadthHeatmap showing breadth MOMENTUM
 * (rate-of-change) day by day. Same visual language (vivid solid cells, navy
 * base, 22/44/66 filter, today-left). Shared: fed the market-wide km_breadth_roc
 * rows or a single index's per-constituent ROC (both are BreadthRocDay[]).
 *
 * ROC is a signed oscillator centred on zero, so colouring is diverging around
 * 0: positive = expanding participation momentum (green), negative = contracting
 * (red), ~flat = navy. Intensity = |value| vs the row's window peak.
 */

const NAVY = '#1e293b';   // base fill — matches FlowIntensityMap / BreadthHeatmap

interface BreadthRocHeatmapProps {
  data: BreadthRocDay[];
  title?: string;
}

interface RowDef {
  key: string;
  label: string;
  value: (d: BreadthRocDay) => number | null;
}

const ROWS: RowDef[] = [
  { key: 'roc13', label: 'ROC-13 (short)',  value: d => d.roc_13 },
  { key: 'roc55', label: 'ROC-55 (long)',   value: d => d.roc_55 },
  { key: 'sma',   label: 'ROC Signal (5)',  value: d => d.sma_breadth },
];

const PERIODS = [22, 44, 66] as const;
type Period = typeof PERIODS[number];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(d: string): string {
  const [, m, day] = d.split('-');
  return `${+day} ${MONTHS[+m - 1]}`;
}

/** Diverging around zero — expanding (green) vs contracting (red); navy ≈ flat. */
function rocBg(v: number | null, peakAbs: number): string {
  if (v == null) return NAVY;
  const level = Math.min(1, Math.abs(v) / peakAbs);
  if (level < 0.08) return NAVY;                                   // essentially flat
  const color = v >= 0 ? 'var(--risk-green)' : 'var(--risk-red)';
  return level >= 0.6 ? `color-mix(in srgb, ${color} 70%, white)` : color;
}

export default function BreadthRocHeatmap({
  data,
  title = 'Breadth Momentum (ROC) Heatmap',
}: BreadthRocHeatmapProps) {
  const [period, setPeriod] = useState<Period>(22);

  const { rows, cols } = useMemo(() => {
    const ordered = [...data.slice(-period)].reverse();           // newest → oldest
    const active = ROWS
      .filter(r => ordered.some(d => r.value(d) != null))
      .map(r => {
        const vals = ordered.map(r.value);
        const peakAbs = vals.reduce<number>((mx, v) => (v != null && Math.abs(v) > mx ? Math.abs(v) : mx), 0);
        return { ...r, vals, peakAbs: peakAbs > 0 ? peakAbs : 1 };
      });
    return { rows: active, cols: ordered };
  }, [data, period]);

  if (data.length === 0 || rows.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-4">
        <h3 className="text-[13px] font-bold text-[var(--text-primary)] mb-1">{title}</h3>
        <p className="text-[11px] text-muted">No breadth-momentum data available for this view.</p>
      </div>
    );
  }

  const newest = cols[0]?.trade_date;
  const mid    = cols[Math.floor(cols.length / 2)]?.trade_date;
  const oldest = cols[cols.length - 1]?.trade_date;

  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <div>
          <h3 className="text-[13px] font-bold text-[var(--text-primary)]">{title}</h3>
          <span className="text-[10px] text-muted">Momentum turns before level — spot inflections and cross-horizon divergence</span>
        </div>
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

      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 620 }}>
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
                  return (
                    <div
                      key={d.trade_date}
                      title={`${fmtDate(d.trade_date)} · ${row.label}: ${v != null ? v.toFixed(4) : 'n/a'}`}
                      style={{ flex: 1, minWidth: 6, height: 20, borderRadius: 2, background: rocBg(v, row.peakAbs),
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
        Green = expanding breadth momentum · red = contracting · navy ≈ flat · intensity vs window peak
      </div>
    </div>
  );
}
