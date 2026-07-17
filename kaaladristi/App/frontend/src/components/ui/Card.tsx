import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const cardVariants = cva(
  // blur-lg = 16px, the Glass UX & Theme Standard's card blur scale (§5.4).
  // Was blur-xl/2xl (24-40px) — over-blurring smeared far more of whatever
  // sits behind a card than the recipe calls for, part of the light-mode
  // "muddy" look reported across all 3 themes.
  'border backdrop-blur-lg kd-card-shadow transition-all ease-[cubic-bezier(0.16,1,0.3,1)]',
  {
    variants: {
      variant: {
        // bg-[var(--kd-card)] (not the bg-kd-card Tailwind class, which maps
        // to the solid --card) — --kd-card is the actual translucent
        // surface.glass value applyTheme() sets. A backdrop-blur over a
        // 100%-opaque background is a no-op; this is what makes it real.
        default:  'bg-[var(--kd-card)] border-kd-border',
        elevated: 'bg-[var(--kd-elevated)] border-kd-border',
        glass:    'bg-[var(--kd-card)] border-kd-border',
        accent:   'bg-[var(--kd-card)] border-kd-border-active',
      },
      rounded: {
        md:  'rounded-2xl',
        lg:  'rounded-3xl',
        xl:  'rounded-4xl',
        xxl: 'rounded-5xl',
      },
      hover: {
        none:  '',
        lift:  'hover:-translate-y-0.5 hover:border-kd-border-active cursor-pointer',
        glow:  'hover:border-kd-border-active hover:shadow-lg hover:shadow-[color-mix(in_srgb,var(--accent-indigo)_5%,transparent)] cursor-pointer',
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
