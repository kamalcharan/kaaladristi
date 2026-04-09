import { useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { useMarketBreadth } from '@/hooks';
import { Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Range config ──────────────────────────────────────────────────────────────

const RANGES = [
  { label: '1M',  days: 30,   resolution: 'daily'   },
  { label: '3M',  days: 90,   resolution: 'daily'   },
  { label: '6M',  days: 180,  resolution: 'daily'   },
  { label: '1Y',  days: 365,  resolution: 'daily'   },
  { label: '5Y',  days: 1825, resolution: 'weekly'  },
  { label: 'MAX', days: 0,    resolution: 'monthly' },
] as const;

type RangeLabel = typeof RANGES[number]['label'];

// ── Tick formatter ────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtTick(d: string, resolution: string): string {
  const [y, m, day] = d.split('-');
  if (resolution === 'monthly') return `${MONTHS[+m - 1]} ${y.slice(2)}`;
  if (resolution === 'weekly')  return `${+day} ${MONTHS[+m - 1]}`;
  return `${+day} ${MONTHS[+m - 1]}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MarketBreadthChart() {
  const [range, setRange] = useState<RangeLabel>('3M');
  const cfg = RANGES.find(r => r.label === range)!;
  const resolution = cfg.resolution as 'daily' | 'weekly' | 'monthly';

  const { data = [], isLoading, isError } = useMarketBreadth(cfg.days, resolution);

  const latest = data[data.length - 1];

  return (
    <div className="glass-card rounded-2xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-[13px] font-bold text-[var(--text-primary)]">Market Breadth</h3>
          <p className="text-[10px] text-muted mt-0.5">NSE equity advances vs declines</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Latest A/D */}
          {latest && (
            <div className="text-right">
              <div className="text-[10px] text-muted">Latest A/D</div>
              <div className="text-[13px] font-bold mono">
                <span className="text-risk-green">{latest.advances}</span>
                <span className="text-muted mx-1">/</span>
                <span className="text-risk-red">{latest.declines}</span>
              </div>
            </div>
          )}

          {/* Range selector */}
          <div className="flex items-center gap-0.5 bg-kd-elevated rounded-lg p-0.5">
            {RANGES.map(r => (
              <button
                key={r.label}
                onClick={() => setRange(r.label)}
                className={cn(
                  'px-2 py-1 rounded-md text-[10px] font-bold transition-all',
                  range === r.label
                    ? 'bg-accent-indigo text-white'
                    : 'text-muted hover:text-[var(--text-secondary)]',
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      {isLoading ? (
        <div className="flex items-center justify-center h-[180px] gap-2">
          <Loader2 className="w-4 h-4 text-accent-indigo animate-spin" />
          <span className="text-sm text-muted">Loading...</span>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center h-[180px] gap-2">
          <AlertCircle className="w-5 h-5 text-risk-red" />
          <p className="text-xs text-muted">Failed to load breadth data</p>
        </div>
      ) : data.length === 0 ? (
        <div className="flex items-center justify-center h-[180px]">
          <p className="text-xs text-muted">No breadth data available — run migration 020</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--kd-border)" vertical={false} />
            <XAxis
              dataKey="trade_date"
              tickFormatter={d => fmtTick(d, resolution)}
              tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="count"
              tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="pct"
              orientation="right"
              domain={[0, 100]}
              tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--kd-surface)',
                border: '1px solid var(--kd-border)',
                borderRadius: 10,
                fontSize: 11,
                color: 'var(--text-primary)',
              }}
              labelFormatter={d => fmtTick(d, resolution)}
              formatter={(value: number, name: string) => {
                if (name === 'advance_pct') return [`${value}%`, 'Advance %'];
                if (name === 'advances')    return [value.toLocaleString(), 'Advances'];
                if (name === 'declines')    return [value.toLocaleString(), 'Declines'];
                return [value, name];
              }}
            />
            <Bar yAxisId="count" dataKey="advances" fill="#10b981" opacity={0.75} radius={[2,2,0,0]} maxBarSize={12} />
            <Bar yAxisId="count" dataKey="declines" fill="#ef4444" opacity={0.75} radius={[2,2,0,0]} maxBarSize={12} />
            <Line
              yAxisId="pct"
              dataKey="advance_pct"
              stroke="#6366f1"
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="4 2"
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 justify-center">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#10b981] opacity-75" />
          <span className="text-[9px] text-muted">Advances</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#ef4444] opacity-75" />
          <span className="text-[9px] text-muted">Declines</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-0 border-t-2 border-dashed border-[#6366f1]" />
          <span className="text-[9px] text-muted">Advance %</span>
        </div>
      </div>
    </div>
  );
}
