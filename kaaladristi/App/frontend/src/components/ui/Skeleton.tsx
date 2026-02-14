import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl bg-slate-800/60',
        className
      )}
      {...props}
    />
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('bg-kd-card border border-kd-border rounded-3xl p-6 space-y-4', className)}>
      <div className="flex justify-between items-center">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <Skeleton className="h-6 w-16" />
      </div>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-1.5 w-full" />
    </div>
  );
}

export function SkeletonGauge({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <Skeleton className="h-[200px] w-[200px] rounded-full" />
      <Skeleton className="h-4 w-24" />
    </div>
  );
}
