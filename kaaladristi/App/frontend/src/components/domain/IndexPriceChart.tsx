import { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import type { ChartDataPoint, TimeRange } from '@/types';
import { cn } from '@/lib/utils';

const TIME_RANGES: TimeRange[] = ['1M', '3M', '6M', '1Y', '5Y', 'MAX'];

interface IndexPriceChartProps {
  data: ChartDataPoint[];
  range: TimeRange;
  onRangeChange: (r: TimeRange) => void;
  isPositive: boolean;
}

function formatYAxis(value: number): string {
  if (value >= 100000) return `${(value / 1000).toFixed(0)}k`;
  if (value >= 10000) return `${(value / 1000).toFixed(1)}k`;
  return value.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as ChartDataPoint;
  return (
    <div className="glass-card rounded-xl px-4 py-3 shadow-2xl text-xs space-y-1.5">
      <p className="font-semibold text-white">
        {format(parseISO(d.date), 'dd MMM yyyy')}
      </p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-slate-300">
        <span>Open</span>  <span className="text-right mono">{d.open.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        <span>High</span>  <span className="text-right mono">{d.high.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        <span>Low</span>   <span className="text-right mono">{d.low.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        <span>Close</span> <span className="text-right mono font-bold text-white">{d.close.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
      </div>
      {d.volume > 0 && (
        <p className="text-slate-500 pt-1 border-t border-white/5">
          Vol: {(d.volume / 1e6).toFixed(1)}M
        </p>
      )}
    </div>
  );
}

export default function IndexPriceChart({
  data,
  range,
  onRangeChange,
  isPositive,
}: IndexPriceChartProps) {
  // Downsample for very large datasets to keep rendering smooth
  const chartData = useMemo(() => {
    if (data.length <= 500) return data;
    const step = Math.ceil(data.length / 500);
    return data.filter((_, i) => i % step === 0 || i === data.length - 1);
  }, [data]);

  const color = isPositive ? 'var(--risk-green)' : 'var(--risk-red)';
  const gradientId = isPositive ? 'chartGradientGreen' : 'chartGradientRed';

  // Calculate Y domain with padding
  const [yMin, yMax] = useMemo(() => {
    if (!chartData.length) return [0, 100];
    const closes = chartData.map((d) => d.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const pad = (max - min) * 0.05 || 100;
    return [Math.floor(min - pad), Math.ceil(max + pad)];
  }, [chartData]);

  // Format X-axis based on range
  const xTickFormat = useMemo(() => {
    switch (range) {
      case '1M':  return 'dd MMM';
      case '3M':  return 'dd MMM';
      case '6M':  return 'MMM yy';
      case '1Y':  return 'MMM yy';
      case '5Y':  return 'MMM yyyy';
      case 'MAX': return 'yyyy';
    }
  }, [range]);

  return (
    <div>
      {/* Time range selector */}
      <div className="flex items-center gap-1.5 mb-6">
        {TIME_RANGES.map((r) => (
          <button
            key={r}
            onClick={() => onRangeChange(r)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all duration-200',
              range === r
                ? 'bg-accent-indigo/20 text-accent-indigo border border-accent-indigo/30'
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            )}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.04)"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => {
                try { return format(parseISO(d), xTickFormat); }
                catch { return d; }
              }}
              tick={{ fontSize: 10, fill: '#64748b' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              domain={[yMin, yMax]}
              tickFormatter={formatYAxis}
              tick={{ fontSize: 10, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="close"
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#${gradientId})`}
              dot={false}
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
