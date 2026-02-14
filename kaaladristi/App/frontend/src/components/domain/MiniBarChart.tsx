import { cn, getRiskHex } from '@/lib/utils';

interface MiniBarChartProps {
  data: number[];   // Array of risk scores (0-100)
  labels?: string[];
  height?: number;
  className?: string;
}

export default function MiniBarChart({
  data,
  labels,
  height = 48,
  className,
}: MiniBarChartProps) {
  const maxVal = Math.max(...data, 1);

  return (
    <div className={cn('flex items-end gap-1', className)} style={{ height }}>
      {data.map((val, i) => {
        const barHeight = Math.max(4, (val / maxVal) * height);
        const color = getRiskHex(val);

        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t transition-all duration-500 ease-out min-w-[6px]"
              style={{
                height: barHeight,
                background: color,
                opacity: 0.8,
              }}
              title={`${val}`}
            />
            {labels && labels[i] && (
              <span className="text-[7px] text-muted font-mono uppercase">{labels[i]}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
