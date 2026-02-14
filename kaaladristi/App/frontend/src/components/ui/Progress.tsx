import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;   // 0-100
  max?: number;
  color?: string;  // Tailwind bg class, e.g. 'bg-accent-indigo'
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'h-1',
  md: 'h-1.5',
  lg: 'h-2.5',
};

const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, max = 100, color = 'bg-accent-indigo', size = 'md', ...props }, ref) => {
    const pct = Math.min(100, Math.max(0, (value / max) * 100));

    return (
      <div
        ref={ref}
        className={cn(
          'w-full bg-white/5 rounded-full overflow-hidden border border-kd-border',
          sizeMap[size],
          className
        )}
        {...props}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(0,0,0,0.5)]',
            color
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    );
  }
);
Progress.displayName = 'Progress';

export { Progress };
