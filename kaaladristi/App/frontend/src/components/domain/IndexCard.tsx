import { Card } from '@/components/ui/Card';
import RiskGauge from './RiskGauge';
import RegimeBadge from './RegimeBadge';
import { cn, getRegimeFromScore } from '@/lib/utils';

interface IndexCardProps {
  name: string;
  symbol: string;
  riskScore: number;
  change?: number;
  className?: string;
  onClick?: () => void;
}

export default function IndexCard({
  name,
  symbol,
  riskScore,
  change,
  className,
  onClick,
}: IndexCardProps) {
  const regime = getRegimeFromScore(riskScore);

  return (
    <Card hover="lift" className={cn('p-5', className)} onClick={onClick}>
      <div className="flex items-center gap-4">
        <RiskGauge score={riskScore} size="mini" label="" animated={false} />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{name}</p>
          <p className="text-[10px] font-mono text-muted uppercase tracking-wider mt-0.5">{symbol}</p>

          <div className="flex items-center gap-2 mt-2">
            <RegimeBadge regime={regime} showLabel={false} size="sm" />
            {change !== undefined && (
              <span className={cn(
                'text-[11px] font-mono font-bold',
                change >= 0 ? 'text-risk-green' : 'text-risk-red'
              )}>
                {change >= 0 ? '+' : ''}{change.toFixed(2)}%
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
