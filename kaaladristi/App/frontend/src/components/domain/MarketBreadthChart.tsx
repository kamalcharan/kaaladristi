import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea,
} from 'recharts';
import { useMarketBreadth } from '@/hooks';
import { Loader2, AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MarketBreadthDay } from '@/types';

// ── Config ────────────────────────────────────────────────────────────────────

const PERIODS = [
  { label: '22D', days: 22 },
  { label: '44D', days: 44 },
  { label: '66D', days: 66 },
] as const;
type PeriodLabel = typeof PERIODS[number]['label'];

const GREED_THRESHOLD = 55;
const FEAR_THRESHOLD  = 35;

function regime(score: number): { label: string; color: string; bg: string; border: string } {
  if (score > GREED_THRESHOLD) return { label: 'Greed',   color: 'text-risk-red',   bg: 'bg-risk-red/10',   border: 'border-risk-red/40'   };
  if (score < FEAR_THRESHOLD)  return { label: 'Fear',    color: 'text-risk-green', bg: 'bg-risk-green/10', border: 'border-risk-green/40' };
  return                               { label: 'Neutral', color: 'text-risk-amber', bg: 'bg-risk-amber/10', border: 'border-risk-amber/40' };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDate(d: string): string {
  const [, m, day] = d.split('-');
  return `${+day} ${MONTHS[+m - 1]}`;
}

function fmtPct(v: number | null): string {
  return v == null ? '—' : `${v.toFixed(1)}%`;
}

// ── EMA stat pill ─────────────────────────────────────────────────────────────

function EmaStat({ label, value, prev }: { label: string; value: number | null; prev: number | null }) {
  const up   = value != null && prev != null && value > prev;
  const down = value != null && prev != null && value < prev;
  return (
    <div className="text-center">
      <div className="text-[9px] text-muted font-bold uppercase tracking-wider mb-0.5">{label}</div>
      <div className={cn('text-[12px] font-bold mono flex items-center gap-0.5',
        up ? 'text-risk-green' : down ? 'text-risk-red' : 'text-[var(--text-primary)]'
      )}>
        {fmtPct(value)}
        {up   && <TrendingUp   className="w-2.5 h-2.5" />}
        {down && <TrendingDown className="w-2.5 h-2.5" />}
        {!up && !down && <Minus className="w-2.5 h-2.5 text-muted" />}
      </div>
    </div>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function BreadthTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as MarketBreadthDay;
  if (!d) return null;
  const r = regime(d.breadth_score ?? 0);
  return (
    <div className="glass-card rounded-xl p-3 text-[11px] border border-kd-border min-w-[160px]">
      <div className="font-bold text-[var(--text-primary)] mb-2">{fmtDate(d.trade_date)}</div>
      <div className="flex justify-between gap-4 mb-1">
        <span className="text-muted">Score</span>
        <span className={cn('font-bold mono', r.color)}>{d.breadth_score?.toFixed(1)} ({r.label})</span>
      </div>
      <div className="flex justify-between gap-4 mb-0.5">
        <span className="text-muted">Above 20 EMA</span>
        <span className="mono text-[var(--text-secondary)]">{fmtPct(d.pct_above_20)}</span>
      </div>
      <div className="flex justify-between gap-4 mb-0.5">
        <span className="text-muted">Above 50 EMA</span>
        <span className="mono text-[var(--text-secondary)]">{fmtPct(d.pct_above_50)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted">Above 150 EMA</span>
        <span className="mono text-[var(--text-secondary)]">{fmtPct(d.pct_above_150)}</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MarketBreadthChart() {
  const [period, setPeriod] = useState<PeriodLabel>('66D');
  const days = PERIODS.find(p => p.label === period)!.days;

  const { data = [], isLoading, isError } = useMarketBreadth(days);
  const latest = data[data.length - 1];
  const prev   = data[data.length - 2];
  const r      = latest?.breadth_score != null ? regime(latest.breadth_score) : null;

  return (
    <div className="glass-card rounded-2xl p-4">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-[13px] font-bold text-[var(--text-primary)]">Market Breadth</h3>
          {latest?.stock_count != null && (
            <p className="text-[10px] text-muted mt-0.5">
              {latest.stock_count.toLocaleString()}+ stocks analyzed
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

          {/* EMA stats */}
          <div className="flex items-center gap-4 pl-2 border-l border-kd-border">
            <EmaStat label="20 EMA"  value={latest?.pct_above_20  ?? null} prev={prev?.pct_above_20  ?? null} />
            <EmaStat label="50 EMA"  value={latest?.pct_above_50  ?? null} prev={prev?.pct_above_50  ?? null} />
            <EmaStat label="150 EMA" value={latest?.pct_above_150 ?? null} prev={prev?.pct_above_150 ?? null} />
          </div>

          {/* Regime badge */}
          {r && (
            <span className={cn('px-2.5 py-1 rounded-lg text-[10px] font-bold border uppercase tracking-wider', r.bg, r.color, r.border)}>
              {r.label}
            </span>
          )}
        </div>
      </div>

      {/* ── Chart title + current score ── */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-[11px] font-bold text-[var(--text-secondary)]">Breadth Score Trend</div>
          <div className="text-[9px] text-muted">50% Above 20 EMA · 30% Above 50 EMA · 20% Above 150 EMA</div>
        </div>
        {latest?.breadth_score != null && (
          <div className="text-right">
            <div className={cn('text-[22px] font-bold mono leading-none', r?.color)}>
              {latest.breadth_score.toFixed(1)}
            </div>
            <div className="text-[9px] text-muted">Current Score</div>
          </div>
        )}
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
          <p className="text-xs text-muted">Failed to load breadth data</p>
        </div>
      ) : data.length === 0 ? (
        <div className="flex items-center justify-center h-[200px]">
          <p className="text-xs text-muted text-center">
            No breadth data — run migration 020, then<br />
            <code className="text-accent-indigo">python compute_market_breadth.py</code>
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 4, right: 40, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="breadthGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
              </linearGradient>
            </defs>

            {/* Regime background zones */}
            <ReferenceArea y1={GREED_THRESHOLD} y2={100} fill="#ef4444" fillOpacity={0.06} />
            <ReferenceArea y1={FEAR_THRESHOLD}  y2={GREED_THRESHOLD} fill="#f59e0b" fillOpacity={0.06} />
            <ReferenceArea y1={0}               y2={FEAR_THRESHOLD}  fill="#10b981" fillOpacity={0.06} />

            <XAxis
              dataKey="trade_date"
              tickFormatter={fmtDate}
              tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={false}
            />

            {/* Threshold reference lines */}
            <ReferenceLine
              y={GREED_THRESHOLD}
              stroke="#ef4444"
              strokeDasharray="4 2"
              strokeOpacity={0.6}
              label={{ value: `Greed ${GREED_THRESHOLD}`, position: 'right', fontSize: 9, fill: '#ef4444' }}
            />
            <ReferenceLine
              y={FEAR_THRESHOLD}
              stroke="#10b981"
              strokeDasharray="4 2"
              strokeOpacity={0.6}
              label={{ value: `Fear ${FEAR_THRESHOLD}`, position: 'right', fontSize: 9, fill: '#10b981' }}
            />

            <Tooltip content={<BreadthTooltip />} />

            <Area
              dataKey="breadth_score"
              stroke="#6366f1"
              strokeWidth={1.5}
              fill="url(#breadthGrad)"
              dot={false}
              activeDot={{ r: 3, fill: '#6366f1' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* ── Legend ── */}
      <div className="flex items-center justify-center gap-5 mt-2">
        {[
          { color: 'bg-risk-red',   label: `Greed (>${GREED_THRESHOLD})` },
          { color: 'bg-risk-amber', label: `Neutral (${FEAR_THRESHOLD}-${GREED_THRESHOLD})` },
          { color: 'bg-risk-green', label: `Fear (<${FEAR_THRESHOLD})` },
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
