import { useState } from 'react';
import { TrendingUp, TrendingDown, Crown, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useIndustryRotation, useIndustryStocks } from '@/hooks/useIndustryRotation';
import type { IndustryRotationItem } from '@/types';

// ── Flow type display mapping (KaalaDristi vocabulary) ────────

const FLOW_LABELS: Record<string, { label: string; color: string }> = {
  FRESH_LONGS:      { label: 'Fresh Longs',      color: 'text-risk-green bg-risk-green/10' },
  FRESH_SHORTS:     { label: 'Fresh Shorts',     color: 'text-risk-red bg-risk-red/10' },
  SHORT_COVERING:   { label: 'Short Covering',   color: 'text-risk-amber bg-risk-amber/10' },
  LONG_LIQUIDATION: { label: 'Liquidation',      color: 'text-risk-red bg-risk-red/10' },
  LOW_VOLUME:       { label: 'Low Volume',        color: 'text-muted bg-kd-elevated/30' },
  MIXED:            { label: 'Mixed',             color: 'text-muted bg-kd-elevated/30' },
};

const ZONE_COLORS: Record<string, string> = {
  'Strong Bull': 'text-risk-green',
  'Mild Bull':   'text-risk-green/70',
  'Neutral':     'text-muted',
  'Mild Bear':   'text-risk-red/70',
  'Strong Bear': 'text-risk-red',
};

// ── Flow Chip ──────────────────────────────────────────────────

function FlowChip({ flowType }: { flowType: string | null }) {
  if (!flowType) return null;
  const config = FLOW_LABELS[flowType] ?? { label: flowType, color: 'text-muted bg-kd-elevated/30' };
  return (
    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-md', config.color)}>
      {config.label}
    </span>
  );
}

// ── Industry Row ───────────────────────────────────────────────

function IndustryRow({
  item,
  latestDate,
}: {
  item: IndustryRotationItem;
  latestDate: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const { data: stocks, isLoading: stocksLoading } = useIndustryStocks(
    expanded ? item.industry : null,
    latestDate,
  );

  const rankUp = item.rank_change > 0;
  const rankDown = item.rank_change < 0;

  return (
    <div className="border-b border-kd-border last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-kd-elevated/30 transition-colors text-left group"
      >
        {/* Rank + Change */}
        <div className="w-8 text-center shrink-0">
          <span className="text-xs font-mono font-bold text-muted">#{item.industry_rank}</span>
        </div>

        {/* Rank change arrow */}
        <div className="w-10 shrink-0 flex items-center justify-center">
          {item.rank_change !== 0 && (
            <span className={cn(
              'text-[11px] font-bold flex items-center gap-0.5',
              rankUp ? 'text-risk-green' : rankDown ? 'text-risk-red' : 'text-muted'
            )}>
              {rankUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(item.rank_change)}
            </span>
          )}
        </div>

        {/* Industry name */}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-[var(--text-primary)] truncate block">
            {item.industry}
          </span>
          <span className="text-[10px] text-muted">{item.stock_count} stocks</span>
        </div>

        {/* Flow chip */}
        <FlowChip flowType={item.dominant_flow_type} />

        {/* Expand chevron */}
        {expanded
          ? <ChevronUp className="w-3.5 h-3.5 text-muted shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-muted shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        }
      </button>

      {/* Expanded stock list */}
      {expanded && (
        <div className="bg-kd-bg/40 border-t border-kd-border">
          {stocksLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-accent-indigo" />
            </div>
          ) : stocks && stocks.length > 0 ? (
            <div className="divide-y divide-kd-border/50">
              {stocks.map((s) => (
                <div key={s.equity_id} className="flex items-center gap-3 px-4 py-2 text-xs">
                  <span className="font-mono font-bold text-accent-indigo w-24 shrink-0 truncate">{s.symbol}</span>
                  <span className="text-muted flex-1 truncate">{s.company_name}</span>
                  <span className="font-mono font-bold text-[var(--text-primary)] w-16 text-right">
                    {s.close?.toFixed(1)}
                  </span>
                  <span className={cn(
                    'font-mono font-bold w-14 text-right',
                    (s.pct_chng ?? 0) >= 0 ? 'text-risk-green' : 'text-risk-red'
                  )}>
                    {(s.pct_chng ?? 0) >= 0 ? '+' : ''}{(s.pct_chng ?? 0).toFixed(1)}%
                  </span>
                  <span className={cn('w-16 text-right font-mono', ZONE_COLORS[s.magic_rs_zone ?? ''] ?? 'text-muted')}>
                    {s.magic_rs?.toFixed(1) ?? '—'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted py-3 text-center">No data available</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Column ─────────────────────────────────────────────────────

function RotationColumn({
  title,
  icon: Icon,
  iconColor,
  items,
  latestDate,
  emptyText,
}: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  items: IndustryRotationItem[];
  latestDate: string | null;
  emptyText: string;
}) {
  return (
    <div className="flex flex-col min-w-0">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-kd-border">
        <Icon className={cn('w-4 h-4', iconColor)} />
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
          {title}
        </h4>
        <span className="text-[10px] text-muted ml-auto">{items.length}</span>
      </div>
      {items.length > 0 ? (
        <div className="flex-1">
          {items.map((item) => (
            <IndustryRow key={item.industry} item={item} latestDate={latestDate} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted py-6 text-center">{emptyText}</p>
      )}
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────

export default function IndustryRotationPanel() {
  const { data, isLoading, error } = useIndustryRotation();

  if (error) {
    return (
      <Card rounded="xxl" className="p-5">
        <p className="text-xs text-risk-red">Failed to load industry rotation data</p>
      </Card>
    );
  }

  return (
    <Card rounded="xxl" className="overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Industry Rotation</h3>
            <p className="text-[11px] text-muted mt-0.5">5-day rank change across market industries</p>
          </div>
          {data?.latestDate && (
            <span className="text-[10px] font-mono text-muted bg-kd-elevated/40 px-2 py-1 rounded-lg border border-kd-border">
              {data.latestDate}
            </span>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-accent-indigo" />
        </div>
      ) : data ? (
        /* Three columns: stack vertically on mobile */
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-kd-border">
          <RotationColumn
            title="Rotating In"
            icon={TrendingUp}
            iconColor="text-risk-green"
            items={data.rotatingIn}
            latestDate={data.latestDate}
            emptyText="No industries rotating in"
          />
          <RotationColumn
            title="Leading"
            icon={Crown}
            iconColor="text-risk-amber"
            items={data.leading}
            latestDate={data.latestDate}
            emptyText="No leading industries"
          />
          <RotationColumn
            title="Rotating Out"
            icon={TrendingDown}
            iconColor="text-risk-red"
            items={data.rotatingOut}
            latestDate={data.latestDate}
            emptyText="No industries rotating out"
          />
        </div>
      ) : null}
    </Card>
  );
}
