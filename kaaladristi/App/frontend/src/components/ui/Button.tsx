import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-indigo/50 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:   'bg-gradient-to-r from-accent-indigo to-accent-violet text-[var(--text-primary)] shadow-[0_4px_20px_color-mix(in_srgb,var(--accent-indigo)_30%,transparent)] hover:-translate-y-0.5 hover:shadow-[0_8px_30px_color-mix(in_srgb,var(--accent-indigo)_40%,transparent)]',
        secondary: 'bg-kd-card border border-kd-border text-[var(--text-primary)] hover:bg-kd-elevated hover:border-kd-border-active',
        ghost:     'text-secondary hover:text-[var(--text-primary)] hover:bg-kd-elevated',
        danger:    'bg-risk-red/10 border border-risk-red/30 text-risk-red hover:bg-risk-red/20',
      },
      size: {
        sm:   'h-8 px-3 text-xs rounded-lg',
        md:   'h-10 px-5 text-sm rounded-xl',
        lg:   'h-12 px-6 text-base rounded-xl',
        icon: 'h-10 w-10 rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
