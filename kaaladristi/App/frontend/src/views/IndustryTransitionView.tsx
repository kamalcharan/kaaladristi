import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Crown, ChevronDown, ChevronUp, Loader2, Minus } from 'lucide-react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useIndustryTransition, useIndustryStocks } from '@/hooks/useIndustryRotation';
import type { IndustryTransitionItem } from '@/services/industryRotation';

// ── Reusable vocabulary (same as IndustryRotationPanel) ───────

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

// ── Sparkline SVG ─────────────────────────────────────────────

function Sparkline({ values, improving }: { values: number[]; improving: boolean }) {
  if (values.length < 2) return null;
  const w = 78, h = 18, p = 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = p + i * ((w - 2 * p) / (values.length - 1));
    const y = h - p - ((v - min) / range) * (h - 2 * p);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  // Lower percentile = better, so "improving" means line going down
  const color = improving ? 'var(--risk-green)' : 'var(--risk-red)';
  return (
    <svg className="w-[78px] h-[18px] shrink-0" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Flow Chip ─────────────────────────────────────────────────

function FlowChip({ flowType }: { flowType: string | null }) {
  if (!flowType) return null;
  const config = FLOW_LABELS[flowType] ?? { label: flowType, color: 'text-muted bg-kd-elevated/30' };
  return (
    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-md', config.color)}>
      {config.label}
    </span>
  );
}

// ── Delta Badge ───────────────────────────────────────────────

function DeltaBadge({ item, variant }: { item: IndustryTransitionItem; variant: 'in' | 'lead' | 'out' }) {
  if (variant === 'in') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-risk-green bg-risk-green/10 border border-risk-green/30 px-2 py-1 rounded">
        <TrendingUp className="w-3 h-3" />
        from {item.prevPercentile}%ile
      </span>
    );
  }
  if (variant === 'out') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-risk-red bg-risk-red/10 border border-risk-red/30 px-2 py-1 rounded">
        <TrendingDown className="w-3 h-3" />
        from {item.prevPercentile}%ile
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-risk-amber bg-risk-amber/10 border border-risk-amber/30 px-2 py-1 rounded">
      Top quartile
    </span>
  );
}

// ── Industry Row (expandable, reuses useIndustryStocks) ───────

function TransitionRow({
  item,
  variant,
  latestDate,
}: {
  item: IndustryTransitionItem;
  variant: 'in' | 'lead' | 'out' | 'stable';
  latestDate: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const { data: stocks, isLoading: stocksLoading } = useIndustryStocks(
    expanded ? item.industry : null,
    latestDate,
  );

  const improving = item.percentileChange > 0;

  return (
    <div className={cn(
      'border border-transparent rounded-xl transition-all',
      expanded ? 'bg-kd-bg/60 border-kd-border' : 'hover:bg-kd-bg/40 hover:border-kd-border',
    )}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-3 py-2.5 flex items-center gap-3"
      >
        {/* Industry name + meta */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--text-primary)] truncate leading-tight">
            {item.industry}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px] text-muted font-mono">{item.stock_count} stocks</span>
            <FlowChip flowType={item.dominant_flow_type} />
            <Sparkline values={item.sparkline} improving={improving} />
          </div>
        </div>

        {/* Percentile */}
        <div className="text-right shrink-0">
          <span className="text-sm font-bold font-mono text-[var(--text-primary)]">
            {item.percentile}%ile
          </span>
          {item.prevPercentile != null && (
            <span className="block text-[10px] font-mono text-muted">
              from {item.prevPercentile}%ile
            </span>
          )}
        </div>

        {/* Delta badge */}
        {variant !== 'stable' && (
          <div className="shrink-0 hidden sm:block">
            <DeltaBadge item={item} variant={variant === 'in' ? 'in' : variant === 'out' ? 'out' : 'lead'} />
          </div>
        )}

        {/* Chevron */}
        {expanded
          ? <ChevronUp className="w-3.5 h-3.5 text-muted shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-muted shrink-0 opacity-0 group-hover:opacity-100" />
        }
      </button>

      {/* Expanded: top stocks */}
      {expanded && (
        <div className="mx-3 mb-3 bg-kd-bg/80 border border-kd-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-kd-border">
            <span className="text-[10px] font-mono text-muted uppercase tracking-wider">Top stocks by Magic RS</span>
            <span className="text-[10px] font-mono text-muted">{stocks?.length ?? 0} shown</span>
          </div>
          {stocksLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-accent-indigo" />
            </div>
          ) : stocks && stocks.length > 0 ? (
            <div className="divide-y divide-kd-border/50">
              {stocks.map((s) => (
                <div key={s.equity_id} className="flex items-center gap-3 px-3 py-2 text-xs">
                  <span className="font-mono font-bold text-accent-indigo w-24 shrink-0 truncate">{s.symbol}</span>
                  <span className="text-muted flex-1 truncate">{s.company_name}</span>
                  <span className="font-mono font-bold text-[var(--text-primary)] w-16 text-right">{s.close?.toFixed(1)}</span>
                  <span className={cn('font-mono font-bold w-14 text-right', (s.pct_chng ?? 0) >= 0 ? 'text-risk-green' : 'text-risk-red')}>
                    {(s.pct_chng ?? 0) >= 0 ? '+' : ''}{(s.pct_chng ?? 0).toFixed(1)}%
                  </span>
                  <span className={cn('w-14 text-right font-mono', ZONE_COLORS[s.magic_rs_zone ?? ''] ?? 'text-muted')}>
                    RS {s.magic_rs?.toFixed(1) ?? '—'}
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

// ── Column ────────────────────────────────────────────────────

function TransitionColumn({
  title,
  accentColor,
  badgeText,
  items,
  variant,
  latestDate,
}: {
  title: string;
  accentColor: string;
  badgeText: string;
  items: IndustryTransitionItem[];
  variant: 'in' | 'lead' | 'out';
  latestDate: string | null;
}) {
  return (
    <Card rounded="xxl" className="flex flex-col min-h-[400px]">
      {/* Column header */}
      <div className="px-4 py-3 border-b border-kd-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('w-2 h-2 rounded-full shadow-lg', accentColor)} />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-[10px] font-mono font-bold px-2 py-0.5 rounded border',
            variant === 'in' ? 'text-risk-green bg-risk-green/10 border-risk-green/30' :
            variant === 'out' ? 'text-risk-red bg-risk-red/10 border-risk-red/30' :
            'text-risk-amber bg-risk-amber/10 border-risk-amber/30',
          )}>
            {badgeText}
          </span>
          <span className="text-[10px] font-mono text-muted">{items.length}</span>
        </div>
      </div>

      {/* Column body */}
      <div className="flex-1 overflow-auto p-2 space-y-0.5">
        {items.length > 0 ? (
          items.map((item) => (
            <TransitionRow key={item.industry} item={item} variant={variant} latestDate={latestDate} />
          ))
        ) : (
          <p className="text-xs text-muted py-8 text-center italic">No industries in this category</p>
        )}
      </div>
    </Card>
  );
}

// ── Stable Section (collapsible) ──────────────────────────────

function StableSection({ items, latestDate }: { items: IndustryTransitionItem[]; latestDate: string | null }) {
  const [open, setOpen] = useState(false);

  return (
    <Card rounded="xxl" className="mt-6">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <Minus className="w-4 h-4 text-muted" />
          <span className="text-sm font-bold text-muted">{items.length} industries unchanged this week</span>
        </div>
        <span className="text-[10px] font-mono text-muted">
          {open ? 'Collapse' : 'Expand'} {open ? '▴' : '▾'}
        </span>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-kd-border">
          <p className="text-[11px] font-mono text-muted py-3">
            |Δ%ile| &lt; 10 over last 5 sessions. Useful for spotting what is NOT moving.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {items.map((item) => (
              <div
                key={item.industry}
                className="flex items-center justify-between px-3 py-2 border border-kd-border rounded-lg"
              >
                <span className="text-xs font-medium text-[var(--text-primary)] truncate">{item.industry}</span>
                <span className="text-[11px] font-mono text-muted shrink-0 ml-2">{item.percentile}%ile</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Filters Bar ───────────────────────────────────────────────

function FiltersBar({
  minStocks,
  onMinStocksChange,
  exchangeFilter,
  onExchangeChange,
}: {
  minStocks: number;
  onMinStocksChange: (v: number) => void;
  exchangeFilter: string;
  onExchangeChange: (v: string) => void;
}) {
  return (
    <Card rounded="xxl" className="px-4 py-3 mb-4 flex items-center gap-4 flex-wrap">
      <span className="text-[10px] font-mono text-muted uppercase tracking-wider">Filters</span>

      {/* Min stocks */}
      <div className="flex items-center gap-2 bg-kd-bg/40 border border-kd-border rounded-lg px-3 py-1.5">
        <span className="text-[10px] text-muted uppercase tracking-wider">Min stocks</span>
        <input
          type="range"
          min={5}
          max={20}
          value={minStocks}
          onChange={(e) => onMinStocksChange(Number(e.target.value))}
          className="w-16 accent-risk-amber"
        />
        <span className="text-xs font-mono text-[var(--text-primary)] w-4 text-right">{minStocks}</span>
      </div>

      {/* Exchange */}
      <div className="flex bg-kd-bg/40 border border-kd-border rounded-lg overflow-hidden">
        {['Combined', 'NSE', 'BSE'].map((ex) => (
          <button
            key={ex}
            onClick={() => onExchangeChange(ex)}
            className={cn(
              'px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider transition-colors',
              exchangeFilter === ex
                ? 'bg-kd-elevated text-[var(--text-primary)]'
                : 'text-muted hover:text-[var(--text-secondary)]',
            )}
          >
            {ex}
          </button>
        ))}
      </div>

      <span className="ml-auto text-[10px] font-mono text-muted">Sort: by transition magnitude</span>
    </Card>
  );
}

// ── Main View ─────────────────────────────────────────────────

export default function IndustryTransitionView() {
  const { data, isLoading, error } = useIndustryTransition();
  const [minStocks, setMinStocks] = useState(5);
  const [exchangeFilter, setExchangeFilter] = useState('Combined');

  // Filter items by min stocks
  const filtered = useMemo(() => {
    if (!data) return null;
    const filter = (items: IndustryTransitionItem[]) =>
      items.filter((i) => i.stock_count >= minStocks);
    return {
      ...data,
      rotatingIn: filter(data.rotatingIn),
      leading: filter(data.leading),
      rotatingOut: filter(data.rotatingOut),
      stable: filter(data.stable),
    };
  }, [data, minStocks]);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary)] mb-2">
          Industry Transition
        </h1>
        <div className="flex items-center gap-3 flex-wrap">
          {data?.nseAsOfDate && (
            <span className="text-[10px] font-mono text-risk-green bg-risk-green/10 border border-risk-green/30 px-2 py-1 rounded">
              NSE {data.nseAsOfDate}
            </span>
          )}
          {data?.bseAsOfDate && (
            <span className={cn(
              'text-[10px] font-mono px-2 py-1 rounded border',
              data.bseAsOfDate === data.nseAsOfDate
                ? 'text-risk-green bg-risk-green/10 border-risk-green/30'
                : 'text-risk-amber bg-risk-amber/10 border-risk-amber/30',
            )}>
              BSE {data.bseAsOfDate}{data.bseAsOfDate !== data.nseAsOfDate ? ' · delayed' : ''}
            </span>
          )}
          {data && (
            <span className="text-[10px] text-muted font-mono">
              5-day rotation window · {data.totalIndustries} industries qualifying
            </span>
          )}
        </div>
      </header>

      {/* Filters */}
      <FiltersBar
        minStocks={minStocks}
        onMinStocksChange={setMinStocks}
        exchangeFilter={exchangeFilter}
        onExchangeChange={setExchangeFilter}
      />

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-accent-indigo mr-2" />
          <span className="text-sm text-muted">Loading industry data...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <Card rounded="xxl" className="py-12 text-center">
          <p className="text-xs text-risk-red">Failed to load industry transition data.</p>
        </Card>
      )}

      {/* 3-column layout */}
      {filtered && !isLoading && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <TransitionColumn
              title="Rotating In"
              accentColor="bg-risk-green shadow-risk-green/40"
              badgeText="Δ ≥ +10%ile"
              items={filtered.rotatingIn}
              variant="in"
              latestDate={data?.latestDate ?? null}
            />
            <TransitionColumn
              title="Leading"
              accentColor="bg-risk-amber shadow-risk-amber/40"
              badgeText="Top 25% by RS"
              items={filtered.leading}
              variant="lead"
              latestDate={data?.latestDate ?? null}
            />
            <TransitionColumn
              title="Rotating Out"
              accentColor="bg-risk-red shadow-risk-red/40"
              badgeText="Δ ≤ −10%ile"
              items={filtered.rotatingOut}
              variant="out"
              latestDate={data?.latestDate ?? null}
            />
          </div>

          {/* Stable section */}
          {filtered.stable.length > 0 && (
            <StableSection items={filtered.stable} latestDate={data?.latestDate ?? null} />
          )}
        </>
      )}
    </div>
  );
}
