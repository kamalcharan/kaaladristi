import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { useMarketBreadth } from '@/hooks';
import { Loader2, AlertCircle } from 'lucide-react';

function fmt(d: string) {
  // "2024-12-16" → "16 Dec"
  const [, m, day] = d.split('-');
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(day)} ${MONTHS[parseInt(m) - 1]}`;
}

export default function MarketBreadthChart({ days = 60 }: { days?: number }) {
  const { data = [], isLoading, isError } = useMarketBreadth(days);

  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[13px] font-bold text-[var(--text-primary)]">Market Breadth</h3>
          <p className="text-[10px] text-muted mt-0.5">NSE equity advances vs declines</p>
        </div>
        {data.length > 0 && (
          <div className="text-right">
            <div className="text-[11px] text-muted">Latest A/D</div>
            <div className="text-[13px] font-bold mono">
              <span className="text-risk-green">{data[data.length - 1]?.advances ?? 0}</span>
              <span className="text-muted mx-1">/</span>
              <span className="text-risk-red">{data[data.length - 1]?.declines ?? 0}</span>
            </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-[180px] gap-2">
          <Loader2 className="w-4 h-4 text-accent-indigo animate-spin" />
          <span className="text-sm text-muted">Loading breadth data...</span>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center h-[180px] gap-2">
          <AlertCircle className="w-5 h-5 text-risk-red" />
          <p className="text-xs text-muted">Failed to load breadth data</p>
        </div>
      ) : data.length === 0 ? (
        <div className="flex items-center justify-center h-[180px]">
          <p className="text-xs text-muted">No breadth data available yet</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--kd-border)" vertical={false} />
            <XAxis
              dataKey="trade_date"
              tickFormatter={fmt}
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
              formatter={(value: number, name: string) => {
                if (name === 'advance_pct') return [`${value}%`, 'Advance %'];
                if (name === 'advances') return [value, 'Advances'];
                if (name === 'declines') return [value, 'Declines'];
                return [value, name];
              }}
              labelFormatter={fmt}
            />
            <Bar yAxisId="count" dataKey="advances" fill="#10b981" opacity={0.75} radius={[2, 2, 0, 0]} maxBarSize={12} />
            <Bar yAxisId="count" dataKey="declines" fill="#ef4444" opacity={0.75} radius={[2, 2, 0, 0]} maxBarSize={12} />
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
    </div>
  );
}
