/**
 * SectorRotationStrip — Compact 3-column rotation summary
 * =========================================================
 * Shows top 3 industry names per category (Leading, Rotating In, Rotating Out).
 * No equities, no expansion. Just a glance-level strip.
 */

import { TrendingUp, TrendingDown, Crown, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useIndustryRotation } from '@/hooks/useIndustryRotation';
import type { IndustryRotationItem } from '@/types';

function CategoryColumn({
  title,
  icon: Icon,
  iconColor,
  items,
}: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  items: IndustryRotationItem[];
}) {
  const top3 = items.slice(0, 3);
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className={cn('w-3 h-3', iconColor)} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-secondary">
          {title}
        </span>
      </div>
      {top3.length > 0 ? (
        <div className="space-y-1">
          {top3.map((item) => (
            <div key={item.industry} className="flex items-center gap-2">
              <span className="text-[11px] text-primary truncate">{item.industry}</span>
              {item.rank_change !== 0 && (
                <span className={cn(
                  'text-[9px] font-mono font-bold shrink-0',
                  item.rank_change > 0 ? 'text-risk-green' : 'text-risk-red',
                )}>
                  {item.rank_change > 0 ? '+' : ''}{item.rank_change}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-muted italic">None</p>
      )}
    </div>
  );
}

export default function SectorRotationStrip() {
  const { data, isLoading, error } = useIndustryRotation();

  if (error) return null;

  return (
    <Card rounded="xxl" className="px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-primary uppercase tracking-wider">Sector Rotation</h3>
        <Link
          to="/industry-transition"
          className="text-[10px] font-mono text-accent-indigo hover:underline"
        >
          Full view &rarr;
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-accent-indigo" />
        </div>
      ) : data ? (
        <div className="grid grid-cols-3 gap-4">
          <CategoryColumn title="Leading" icon={Crown} iconColor="text-accent-gold" items={data.leading} />
          <CategoryColumn title="Rotating In" icon={TrendingUp} iconColor="text-risk-green" items={data.rotatingIn} />
          <CategoryColumn title="Rotating Out" icon={TrendingDown} iconColor="text-risk-red" items={data.rotatingOut} />
        </div>
      ) : null}
    </Card>
  );
}
