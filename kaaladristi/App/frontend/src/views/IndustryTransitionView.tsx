import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useIndustryTransition, useIndustryStocks } from '@/hooks/useIndustryRotation';
import { StockCard, FLOW_LABELS } from '@/components/domain/StockCard';
import type { IndustryTransitionItem } from '@/services/industryRotation';
import type { ScanStock } from '@/types';

// ── Filter Tabs ───────────────────────────────────────────────

type FilterTab = 'all' | 'rotating_in' | 'leading' | 'rotating_out';

const FILTER_TABS: { id: FilterTab; label: string; color: string }[] = [
  { id: 'all',          label: 'All',          color: 'text-accent-indigo border-accent-indigo/30 bg-accent-indigo/15' },
  { id: 'rotating_in',  label: 'Rotating In',  color: 'text-risk-green border-risk-green/30 bg-risk-green/15' },
  { id: 'leading',      label: 'Leading',      color: 'text-risk-amber border-risk-amber/30 bg-risk-amber/15' },
  { id: 'rotating_out', label: 'Rotating Out',  color: 'text-risk-red border-risk-red/30 bg-risk-red/15' },
];

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
  const color = improving ? 'var(--risk-green)' : 'var(--risk-red)';
  return (
    <svg className="w-[78px] h-[18px] shrink-0" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Convert IndustryStockRow to ScanStock for StockCard ────────

function toScanStock(s: any, industry: string): ScanStock {
  return {
    equity_id: s.equity_id,
    symbol: s.symbol,
    company_name: s.company_name,
    industry,
    exchange: s.exchange ?? null,
    close: s.close,
    pct_chng: s.pct_chng,
    rsi_14: s.rsi_14 ?? null,
    magic_rs: s.magic_rs,
    magic_rs_zone: s.magic_rs_zone,
    flow_type: s.flow_type,
    rvol: s.rvol,
    sniper_inst: s.sniper_inst ?? null,
    accum_distrib: null,
    rss_value: s.rss_value ?? null,
    rss_spread: s.rss_spread ?? null,
    sma_150: s.sma_150 ?? null,
    volume_divergence_flag: s.volume_divergence_flag ?? null,
    has_recent_svd: false,
    has_recent_sbd: false,
    has_recent_syd: false,
  };
}

// ── Industry Card (expandable, children = StockCards) ──────────

function IndustryCard({
  item,
  latestDate,
}: {
  item: IndustryTransitionItem;
  latestDate: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const { data: stocks, isLoading: stocksLoading } = useIndustryStocks(
    expanded ? item.industry : null,
    latestDate,
  );

  const improving = item.percentileChange > 0;
  const declining = item.percentileChange < 0;
  const flowConfig = FLOW_LABELS[item.dominant_flow_type ?? ''];

  return (
    <Card rounded="xxl" className="overflow-hidden">
      {/* Industry header — clickable */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-3 sm:p-4 hover:bg-kd-elevated/20 transition-colors"
      >
        {/* Row 1: Industry name + percentile */}
        <div className="flex items-start justify-between mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-bold text-[var(--text-primary)]">{item.industry}</span>
              {item.percentileChange >= 10 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-risk-green bg-risk-green/10 border border-risk-green/30 px-1.5 py-0.5 rounded">
                  <TrendingUp className="w-3 h-3" />
                  +{item.percentileChange}
                </span>
              )}
              {item.percentileChange <= -10 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-risk-red bg-risk-red/10 border border-risk-red/30 px-1.5 py-0.5 rounded">
                  <TrendingDown className="w-3 h-3" />
                  {item.percentileChange}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-muted font-mono">{item.stock_count} stocks</span>
              {flowConfig && (
                <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded', flowConfig.color, 'bg-kd-elevated/50')}>
                  {flowConfig.label}
                </span>
              )}
              <Sparkline values={item.sparkline} improving={improving} />
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-3">
            <div className="text-right">
              <span className="text-sm font-bold font-mono text-[var(--text-primary)]">
                {item.percentile}%ile
              </span>
              {item.prevPercentile != null && (
                <span className={cn(
                  'block text-[10px] font-mono',
                  improving ? 'text-risk-green' : declining ? 'text-risk-red' : 'text-muted',
                )}>
                  from {item.prevPercentile}%ile
                </span>
              )}
            </div>
            {expanded
              ? <ChevronUp className="w-4 h-4 text-muted" />
              : <ChevronDown className="w-4 h-4 text-muted" />
            }
          </div>
        </div>

        {/* Row 2: Industry-level metric pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="bg-kd-bg/40 rounded-lg px-2 py-1.5 border border-kd-border min-w-[56px]">
            <p className="text-[9px] text-muted uppercase tracking-wider leading-none mb-0.5">Avg RS</p>
            <p className="text-xs font-bold font-mono leading-none text-[var(--text-primary)]">
              {item.avg_magic_rs?.toFixed(1) ?? '—'}
            </p>
          </div>
          <div className="bg-kd-bg/40 rounded-lg px-2 py-1.5 border border-kd-border min-w-[56px]">
            <p className="text-[9px] text-muted uppercase tracking-wider leading-none mb-0.5">Bull %</p>
            <p className="text-xs font-bold font-mono leading-none text-risk-green">
              {item.pct_strong_bull?.toFixed(0) ?? '—'}%
            </p>
          </div>
          <div className="bg-kd-bg/40 rounded-lg px-2 py-1.5 border border-kd-border min-w-[56px]">
            <p className="text-[9px] text-muted uppercase tracking-wider leading-none mb-0.5">Accum</p>
            <p className="text-xs font-bold font-mono leading-none text-risk-green">
              {item.pct_accumulation?.toFixed(0) ?? '—'}%
            </p>
          </div>
          <div className="bg-kd-bg/40 rounded-lg px-2 py-1.5 border border-kd-border min-w-[56px]">
            <p className="text-[9px] text-muted uppercase tracking-wider leading-none mb-0.5">Smart $</p>
            <p className="text-xs font-bold font-mono leading-none text-[var(--text-primary)]">
              {item.avg_sniper_inst?.toFixed(1) ?? '—'}
            </p>
          </div>
          {(item.pct_with_recent_svd ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-risk-green">
              <span className="w-2.5 h-2.5 rounded-full bg-risk-green" />
              SVD {item.pct_with_recent_svd?.toFixed(0)}%
            </span>
          )}
          {(item.pct_with_recent_sbd ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-accent-cyan">
              <span className="w-2.5 h-2.5 rounded-full bg-accent-cyan" />
              SBD {item.pct_with_recent_sbd?.toFixed(0)}%
            </span>
          )}
          {(item.pct_with_recent_syd ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-risk-red">
              <span className="w-2.5 h-2.5 rounded-full bg-risk-red" />
              SYD {item.pct_with_recent_syd?.toFixed(0)}%
            </span>
          )}
        </div>
      </button>

      {/* Expanded: child stock cards */}
      {expanded && (
        <div className="border-t border-kd-border bg-kd-bg/30 p-2 sm:p-3 space-y-2">
          <p className="text-[10px] font-mono text-muted uppercase tracking-wider px-1 mb-1">
            Top 10 stocks by Magic RS
          </p>
          {stocksLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-4 h-4 animate-spin text-accent-indigo mr-2" />
              <span className="text-xs text-muted">Loading stocks...</span>
            </div>
          ) : stocks && stocks.length > 0 ? (
            stocks.map((s) => (
              <StockCard key={s.equity_id} stock={toScanStock(s, item.industry)} />
            ))
          ) : (
            <p className="text-xs text-muted py-4 text-center">No stock data available</p>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Main View ─────────────────────────────────────────────────

export default function IndustryTransitionView() {
  const { data, isLoading, error } = useIndustryTransition();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [minStocks, setMinStocks] = useState(5);

  const filtered = useMemo(() => {
    if (!data) return [];

    let items: IndustryTransitionItem[];
    switch (activeFilter) {
      case 'rotating_in':
        items = data.rotatingIn;
        break;
      case 'leading':
        items = data.leading;
        break;
      case 'rotating_out':
        items = data.rotatingOut;
        break;
      default:
        // "All" — combine all categories sorted by transition magnitude
        items = [
          ...data.rotatingIn,
          ...data.leading,
          ...data.rotatingOut,
          ...data.stable,
        ].sort((a, b) => Math.abs(b.percentileChange) - Math.abs(a.percentileChange));
    }

    return items.filter((i) => i.stock_count >= minStocks);
  }, [data, activeFilter, minStocks]);

  // Counts per tab
  const counts = useMemo(() => {
    if (!data) return { all: 0, rotating_in: 0, leading: 0, rotating_out: 0 };
    return {
      all: data.rotatingIn.length + data.leading.length + data.rotatingOut.length + data.stable.length,
      rotating_in: data.rotatingIn.length,
      leading: data.leading.length,
      rotating_out: data.rotatingOut.length,
    };
  }, [data]);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <header className="mb-4">
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
              5-day window · {data.totalIndustries} industries
            </span>
          )}
        </div>
      </header>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar mb-3">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id)}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border',
              activeFilter === tab.id
                ? tab.color
                : 'bg-kd-bg/40 text-muted border-kd-border hover:border-kd-border-active hover:text-[var(--text-secondary)]',
            )}
          >
            {tab.label}
            <span className="ml-1.5 text-[10px] opacity-70">
              {counts[tab.id]}
            </span>
          </button>
        ))}

        {/* Min stocks filter */}
        <div className="flex items-center gap-2 bg-kd-bg/40 border border-kd-border rounded-xl px-3 py-1.5 ml-auto shrink-0">
          <span className="text-[10px] text-muted uppercase tracking-wider">Min</span>
          <input
            type="range"
            min={5}
            max={20}
            value={minStocks}
            onChange={(e) => setMinStocks(Number(e.target.value))}
            className="w-14 accent-risk-amber"
          />
          <span className="text-[10px] font-mono text-[var(--text-primary)] w-4 text-right">{minStocks}</span>
        </div>
      </div>

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

      {/* Industry cards */}
      {!isLoading && !error && filtered.length > 0 && (
        <>
          <div className="space-y-2">
            {filtered.map((item) => (
              <IndustryCard
                key={item.industry}
                item={item}
                latestDate={data?.latestDate ?? null}
              />
            ))}
          </div>
          <div className="mt-3 text-center">
            <span className="text-[10px] text-muted font-mono">
              {filtered.length} industr{filtered.length !== 1 ? 'ies' : 'y'}
            </span>
          </div>
        </>
      )}

      {!isLoading && !error && filtered.length === 0 && data && (
        <Card rounded="xxl" className="py-16 text-center">
          <p className="text-sm text-muted">No industries match the current filter</p>
          <p className="text-xs text-muted mt-1">Try adjusting the min stocks threshold</p>
        </Card>
      )}
    </div>
  );
}
