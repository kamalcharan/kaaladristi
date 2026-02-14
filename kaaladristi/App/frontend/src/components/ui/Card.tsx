import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const cardVariants = cva(
  'border backdrop-blur-xl transition-all',
  {
    variants: {
      variant: {
        default:  'bg-kd-card border-kd-border',
        elevated: 'bg-kd-elevated border-kd-border',
        glass:    'bg-kd-card border-kd-border backdrop-blur-2xl',
        accent:   'bg-kd-card border-kd-border-active',
      },
      rounded: {
        md:  'rounded-2xl',
        lg:  'rounded-3xl',
        xl:  'rounded-4xl',
        xxl: 'rounded-5xl',
      },
      hover: {
        none:  '',
        lift:  'hover:-translate-y-0.5 hover:border-white/20 cursor-pointer',
        glow:  'hover:border-kd-border-active hover:shadow-lg hover:shadow-indigo-500/5 cursor-pointer',
      },
    },
    defaultVariants: {
      variant: 'default',
      rounded: 'lg',
      hover: 'none',
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  accentColor?: string;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, rounded, hover, accentColor, children, ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants({ variant, rounded, hover }), className)} {...props}>
      {accentColor && (
        <div className="h-1 rounded-t-inherit" style={{ background: accentColor }} />
      )}
      {children}
    </div>
  )
);
Card.displayName = 'Card';

const CardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('px-6 pt-6 pb-0', className)} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

const CardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';

export { Card, CardHeader, CardContent, cardVariants };
