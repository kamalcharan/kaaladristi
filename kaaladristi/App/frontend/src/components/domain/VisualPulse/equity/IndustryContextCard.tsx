/**
 * IndustryContextCard — Industry rotation context for this stock
 * ===============================================================
 * Shows industry name, rotation status, percentile, and stock's
 * rank within its industry.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Factory, TrendingUp, TrendingDown, Crown, Minus } from 'lucide-react';
import type { IndustryContext } from '@/hooks/useEquityVisualPulse';

interface IndustryContextCardProps {
  industry: string | null;
  context: IndustryContext | null;
}

const CATEGORY_CONFIG = {
  rotating_in: {
    label: 'Rotating In',
    icon: TrendingUp,
    color: 'text-risk-green',
    bg: 'bg-risk-green/10',
    arrow: '\u2191',
  },
  leading: {
    label: 'Leading',
    icon: Crown,
    color: 'text-accent-gold',
    bg: 'bg-accent-gold/10',
    arrow: '',
  },
  rotating_out: {
    label: 'Rotating Out',
    icon: TrendingDown,
    color: 'text-risk-red',
    bg: 'bg-risk-red/10',
    arrow: '\u2193',
  },
  stable: {
    label: 'Stable',
    icon: Minus,
    color: 'text-muted',
    bg: 'bg-kd-elevated',
    arrow: '',
  },
};

export default function IndustryContextCard({ industry, context }: IndustryContextCardProps) {
  if (!industry || !context) return null;

  const config = CATEGORY_CONFIG[context.category];
  const Icon = config.icon;

  const percentileStr = `${context.percentile}%ile`;
  const prevStr = context.prevPercentile != null
    ? `, was ${context.prevPercentile}%ile`
    : '';

  return (
    <div className="rounded-lg bg-kd-card border border-kd-border p-3">
      <div className="flex items-center gap-2 mb-2">
        <Factory className="w-3.5 h-3.5 text-accent-indigo" />
        <span className="text-[11px] font-serif font-semibold text-primary tracking-wide">
          Industry Context
        </span>
      </div>

      <div className="space-y-2">
        {/* Industry name — tappable */}
        <Link
          to={`/industry-transition?expand=${encodeURIComponent(industry)}`}
          className="text-xs font-serif text-primary hover:text-accent-indigo transition-colors"
        >
          {industry}
        </Link>

        {/* Status badge */}
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono ${config.color} ${config.bg}`}>
            <Icon className="w-3 h-3" />
            {config.arrow && <span>{config.arrow}</span>}
            {config.label}
          </span>
          <span className="text-[10px] font-mono text-secondary">
            ({percentileStr}{prevStr})
          </span>
        </div>

        {/* Stock rank within industry */}
        {context.stockRank != null && context.industryStockCount > 0 && (
          <div className="text-[10px] font-mono text-muted">
            Position: {context.stockRank}{ordinal(context.stockRank)} of {context.industryStockCount} stocks by RS
          </div>
        )}
      </div>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
