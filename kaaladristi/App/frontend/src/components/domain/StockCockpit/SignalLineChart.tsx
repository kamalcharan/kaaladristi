/**
 * SignalLineChart — the shared line-chart body used by the Study signal cards
 * (the "Chart" face of a SignalFlipCard) and the standalone Momentum panel.
 * One rendering path so Smart Money / Magic RS / Conviction / Momentum charts
 * all look identical.
 */

import {
  LineChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, YAxis,
} from 'recharts';

export interface SignalSeries {
  key: string;
  color: string;
  label: string;
  dashed?: boolean;
}

interface SignalLineChartProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>[];
  series: SignalSeries[];
  refLines?: { y: number }[];
  domain?: [number | 'auto', number | 'auto'];
  height?: number;
}

export default function SignalLineChart({
  data, series, refLines, domain = ['auto', 'auto'], height = 110,
}: SignalLineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 6, right: 4, bottom: 2, left: 4 }}>
        <YAxis
          domain={domain}
          width={30}
          tick={{ fontSize: 9, fill: 'var(--text-faint)' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 10,
          }}
          labelFormatter={(l: unknown, payload: unknown) => {
            const p = payload as Array<{ payload?: { trade_date?: string } }>;
            return p?.[0]?.payload?.trade_date ?? String(l);
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(v: any, name: any) => [typeof v === 'number' ? v.toFixed(1) : v, name]}
        />
        {(refLines ?? []).map((rl) => (
          <ReferenceLine key={rl.y} y={rl.y} stroke="color-mix(in srgb, var(--text-primary) 12%, transparent)" strokeDasharray="3 3" />
        ))}
        {series.map((sr) => (
          <Line
            key={sr.key}
            type="monotone"
            dataKey={sr.key}
            name={sr.label}
            stroke={sr.color}
            strokeWidth={1.5}
            strokeDasharray={sr.dashed ? '4 3' : undefined}
            dot={false}
            // NOT connectNulls. It bridges an interior gap with a straight
            // segment that is indistinguishable from real data — on a stock
            // whose indicator history has holes, that draws a trend nobody
            // computed. A break in the line is the honest rendering of a break
            // in the series.
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
