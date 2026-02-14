import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Progress } from '@/components/ui/Progress';
import { cn } from '@/lib/utils';

interface FactorCardProps {
  label: string;
  value: number;
  max?: number;
  icon: LucideIcon;
  color: string;     // Tailwind bg class, e.g. 'bg-accent-indigo'
  details?: string[];
  className?: string;
}

export default function FactorCard({
  label,
  value,
  max = 25,
  icon: Icon,
  color,
  details,
  className,
}: FactorCardProps) {
  return (
    <Card hover="lift" className={cn('p-6', className)}>
      {/* Icon + Score */}
      <div className="flex justify-between items-center mb-6">
        <div className="p-2.5 rounded-xl bg-slate-950/50 border border-kd-border group-hover:border-accent-indigo/30 transition-colors">
          <Icon className="w-5 h-5 text-slate-400 group-hover:text-indigo-400" />
        </div>
        <span className="font-mono text-xl font-bold text-slate-100">
          {value}<span className="text-[10px] text-muted font-normal ml-1">/{max}</span>
        </span>
      </div>

      {/* Label */}
      <p className="text-[11px] font-bold text-muted uppercase tracking-widest mb-3">
        {label} Weight
      </p>

      {/* Bar */}
      <Progress value={value} max={max} color={color} />

      {/* Detail chips */}
      {details && details.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {details.map((d) => (
            <span key={d} className="text-[9px] px-2 py-0.5 rounded bg-slate-800/60 text-secondary border border-kd-border">
              {d}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
