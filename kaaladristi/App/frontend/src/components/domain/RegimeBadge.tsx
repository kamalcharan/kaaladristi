import { Badge } from '@/components/ui/Badge';
import type { VariantProps } from 'class-variance-authority';
import type { badgeVariants } from '@/components/ui/Badge';

interface RegimeBadgeProps {
  regime: string;
  showLabel?: boolean;
  size?: VariantProps<typeof badgeVariants>['size'];
  className?: string;
}

function getRegimeVariant(regime: string): VariantProps<typeof badgeVariants>['variant'] {
  switch (regime) {
    case 'Capital Protection': return 'red';
    case 'Distribution':       return 'amber';
    case 'Expansion':          return 'cyan';
    case 'Accumulation':       return 'green';
    default:                   return 'default';
  }
}

export default function RegimeBadge({ regime, showLabel = true, size = 'md', className }: RegimeBadgeProps) {
  return (
    <Badge variant={getRegimeVariant(regime)} size={size} className={className}>
      {regime}{showLabel && ' Regime Active'}
    </Badge>
  );
}
