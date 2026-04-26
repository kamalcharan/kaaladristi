import { useState } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea,
} from 'recharts';
import { useBreadthRoc } from '@/hooks';
import { Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BreadthRocDay } from '@/types';

// ── Config ────────────────────────────────────────────────────────────────────

const PERIODS = [
  { label: '22D', days: 22 },
  { label: '44D', days: 44 },
  { label: '66D', days: 66 },
] as const;
type PeriodLabel = typeof PERIODS[number]['label'];

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDate(d: string): string {
  const [, m, day] = d.split('-');
  return `${+day} ${MONTHS[+m - 1]}`;
}

function fmtRoc(v: number | null): string {
  return v == null ? '—' : (v >= 0 ? `+${v.toFixed(4)}` : v.toFixed(4));
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────

function RocTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as BreadthRocDay;
  if (!d) return null;

  const bias13 = (d.roc_13 ?? 0) >= 0;
  const bias55 = (d.roc_55 ?? 0) >= 0;

  return (
    <div className="glass-card rounded-xl p-3 text-[11px] border border-kd-border min-w-[170px]">
      <div className="font-bold text-[var(--text-primary)] mb-2">{fmtDate(d.trade_date)}</div>
      <div className="flex justify-between gap-4 mb-0.5">
        <span className="text-muted">ROC 13</span>
        <span className={cn('font-bold mono', bias13 ? 'text-risk-green' : 'text-risk-red')}>
          {fmtRoc(d.roc_13)}
        </span>
      </div>
      <div className="flex justify-between gap-4 mb-0.5">
        <span className="text-muted">ROC 55</span>
        <span className={cn('font-bold mono', bias55 ? 'text-risk-green' : 'text-risk-red')}>
          {fmtRoc(d.roc_55)}
        </span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted">SMA (5)</span>
        <span className="mono text-[var(--text-secondary)]">{fmtRoc(d.sma_breadth)}</span>
      </div>
    </div>
  );
}

// ── Sign-split helper (for dual-color area fill) ──────────────────────────────
// Recharts doesn't support split fills natively, so we use two overlapping Areas
// clipped by ReferenceArea zones — instead we just use opacity on positive/negative.

// ── Main component ────────────────────────────────────────────────────────────

export default function BreadthRocChart() {
  const [period, setPeriod] = useState<PeriodLabel>('66D');
  const days = PERIODS.find(p => p.label === period)!.days;

  const { data = [], isLoading, isError } = useBreadthRoc(days);
  const latest = data[data.length - 1];

  // 4-state ROC status based on crossover relationship
  const rocStatus = (() => {
    const r = latest?.roc_13 ?? 0;
    const s = latest?.sma_breadth ?? 0;
    if (r > 0 && r > s) return { label: 'Bull ✓',    style: { background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.4)' } };
    if (r > 0 && r <= s) return { label: 'Caution',  style: { background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.4)' } };
    if (r <= 0 && r > s)  return { label: 'Recovering', style: { background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.4)' } };
    return                       { label: 'Bear',     style: { background: 'rgba(239,68,68,0.12)',  color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)'  } };
  })();

  // Dynamic Y domain with some padding
  const allVals = data.flatMap(d => [d.roc_13, d.roc_55, d.sma_breadth].filter((v): v is number => v != null));
  const yMax = allVals.length ? Math.max(...allVals.map(Math.abs)) * 1.2 : 0.02;
  const yDomain: [number, number] = [-yMax, yMax];

  return (
    <div className="glass-card rounded-2xl p-4">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-[13px] font-bold text-[var(--text-primary)]">Breadth Momentum (ROC)</h3>
          {latest?.stock_count != null && (
            <p className="text-[10px] text-muted mt-0.5">
              {latest.stock_count.toLocaleString()}+ stocks · GroupAvg ROC oscillator
            </p>
          )}
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {/* Period buttons */}
          <div className="flex items-center gap-0.5 bg-kd-elevated rounded-lg p-0.5">
            {PERIODS.map(p => (
              <button
                key={p.label}
                onClick={() => setPeriod(p.label)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[10px] font-bold transition-all',
                  period === p.label
                    ? 'bg-accent-indigo text-white'
                    : 'text-muted hover:text-[var(--text-secondary)]',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Live readings */}
          {latest && (
            <div className="flex items-center gap-4 pl-2 border-l border-kd-border">
              <div className="text-center">
                <div className="text-[9px] text-muted font-bold uppercase tracking-wider mb-0.5">ROC 13</div>
                <div className={cn('text-[12px] font-bold mono', (latest.roc_13 ?? 0) >= 0 ? 'text-risk-green' : 'text-risk-red')}>
                  {fmtRoc(latest.roc_13)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[9px] text-muted font-bold uppercase tracking-wider mb-0.5">ROC 55</div>
                <div className={cn('text-[12px] font-bold mono', (latest.roc_55 ?? 0) >= 0 ? 'text-risk-green' : 'text-risk-red')}>
                  {fmtRoc(latest.roc_55)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[9px] text-muted font-bold uppercase tracking-wider mb-0.5">SMA 5</div>
                <div className={cn('text-[12px] font-bold mono', (latest.sma_breadth ?? 0) >= 0 ? 'text-risk-green' : 'text-risk-red')}>
                  {fmtRoc(latest.sma_breadth)}
                </div>
              </div>
            </div>
          )}

          {/* Bias badge */}
          {latest && (
            <span
              style={rocStatus.style}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider"
            >
              {rocStatus.label}
            </span>
          )}
        </div>
      </div>

      {/* ── Chart subtitle ── */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-[11px] font-bold text-[var(--text-secondary)]">Momentum Breadth Oscillator</div>
          <div className="text-[9px] text-muted">Above zero = avg stock accelerating up · Below zero = decelerating</div>
        </div>
      </div>

      {/* ── Chart ── */}
      {isLoading ? (
        <div className="flex items-center justify-center h-[200px] gap-2">
          <Loader2 className="w-4 h-4 text-accent-indigo animate-spin" />
          <span className="text-sm text-muted">Loading...</span>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center h-[200px] gap-2">
          <AlertCircle className="w-5 h-5 text-risk-red" />
          <p className="text-xs text-muted">Failed to load ROC data</p>
        </div>
      ) : data.length === 0 ? (
        <div className="flex items-center justify-center h-[200px]">
          <p className="text-xs text-muted text-center">
            No ROC data — run migration 021, then<br />
            <code className="text-accent-indigo">python compute_breadth_roc.py</code>
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="rocBullGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#10b981" stopOpacity={0.30} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="rocBearGrad" x1="0" y1="1" x2="0" y2="0">
                <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.30} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            {/* Zero-line background zones */}
            <ReferenceArea y1={0} y2={yDomain[1]}  fill="#10b981" fillOpacity={0.04} />
            <ReferenceArea y1={yDomain[0]} y2={0}  fill="#ef4444" fillOpacity={0.04} />

            <XAxis
              dataKey="trade_date"
              tickFormatter={fmtDate}
              tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={yDomain}
              tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => v.toFixed(3)}
            />

            {/* Zero reference */}
            <ReferenceLine
              y={0}
              stroke="var(--text-muted)"
              strokeDasharray="3 2"
              strokeOpacity={0.5}
            />

            <Tooltip content={<RocTooltip />} />

            {/* ROC 55 — slow structural line */}
            <Line
              dataKey="roc_55"
              stroke="#8b5cf6"
              strokeWidth={1}
              dot={false}
              strokeDasharray="4 2"
              strokeOpacity={0.7}
              activeDot={false}
            />

            {/* ROC 13 area — fast signal with dual-color fill */}
            <Area
              dataKey="roc_13"
              stroke="#6366f1"
              strokeWidth={1.5}
              fill="url(#rocBullGrad)"
              dot={false}
              activeDot={{ r: 3, fill: '#6366f1' }}
            />

            {/* SMA 5 — smoothed signal */}
            <Line
              dataKey="sma_breadth"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, fill: '#f59e0b' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {/* ── Legend ── */}
      <div className="flex items-center justify-center gap-5 mt-2">
        {[
          { color: 'bg-accent-indigo',  label: 'ROC 13 (fast)'    },
          { color: 'bg-risk-amber',     label: 'SMA 5 (smooth)'   },
          { color: 'bg-accent-violet',  label: 'ROC 55 (slow)'    },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={cn('w-2 h-2 rounded-full', color)} />
            <span className="text-[9px] text-muted">{label}</span>
          </div>
        ))}
      </div>

    </div>
  );
}
