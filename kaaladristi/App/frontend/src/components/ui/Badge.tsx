import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 font-bold uppercase tracking-widest border transition-all',
  {
    variants: {
      variant: {
        default:    'bg-accent-indigo/10 border-accent-indigo/30 text-accent-indigo',
        green:      'bg-risk-green/10 border-risk-green/30 text-risk-green',
        amber:      'bg-risk-amber/10 border-risk-amber/30 text-risk-amber',
        red:        'bg-risk-red/10 border-risk-red/30 text-risk-red',
        violet:     'bg-accent-violet/10 border-accent-violet/30 text-accent-violet',
        cyan:       'bg-accent-cyan/10 border-accent-cyan/30 text-accent-cyan',
        muted:      'bg-slate-800/50 border-kd-border text-muted',
      },
      size: {
        sm: 'px-2.5 py-1 text-[9px] rounded-lg',
        md: 'px-3.5 py-1.5 text-[10px] rounded-full',
        lg: 'px-4 py-2 text-[11px] rounded-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ variant, size }), className)} {...props} />
  )
);
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
