import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, TrendingUp, TrendingDown, ArrowUpDown, ArrowUp, ArrowDown, Eye } from 'lucide-react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useIndustryTransitionStocks } from '@/hooks/useIndustryRotation';
import { StockCard, MetricPill, SignalDots, ExchangeBadge, ZONE_LABELS, FLOW_LABELS } from '@/components/domain/StockCard';
import type { IndustryEnrichedStock } from '@/services/industryRotation';

// ── Filter Tabs ───────────────────────────────────────────────

type CategoryFilter = 'all' | 'rotating_in' | 'leading' | 'rotating_out';

const CATEGORY_TABS: { id: CategoryFilter; label: string; activeClass: string }[] = [
  { id: 'all',          label: 'All',          activeClass: 'bg-accent-indigo/15 text-accent-indigo border-accent-indigo/40' },
  { id: 'rotating_in',  label: 'Rotating In',  activeClass: 'bg-risk-green/15 text-risk-green border-risk-green/40' },
  { id: 'leading',      label: 'Leading',      activeClass: 'bg-risk-amber/15 text-risk-amber border-risk-amber/40' },
  { id: 'rotating_out', label: 'Rotating Out',  activeClass: 'bg-risk-red/15 text-risk-red border-risk-red/40' },
];

// ── Sort ──────────────────────────────────────────────────────

type SortKey = 'industryPercentile' | 'magic_rs' | 'rsi_14' | 'rss_value' | 'rvol' | 'pct_chng';
type SortDir = 'asc' | 'desc';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'industryPercentile', label: 'Industry %ile' },
  { key: 'magic_rs',           label: 'Magic RS' },
  { key: 'rsi_14',             label: 'RSI' },
  { key: 'rss_value',          label: 'RSS' },
  { key: 'rvol',               label: 'RVOL' },
  { key: 'pct_chng',           label: '% Chg' },
];

// ── Industry Tag (shown on each stock card) ───────────────────

function IndustryTag({ stock }: { stock: IndustryEnrichedStock }) {
  const catColor = stock.industryCategory === 'rotating_in'
    ? 'text-risk-green border-risk-green/30 bg-risk-green/10'
    : stock.industryCategory === 'rotating_out'
    ? 'text-risk-red border-risk-red/30 bg-risk-red/10'
    : stock.industryCategory === 'leading'
    ? 'text-risk-amber border-risk-amber/30 bg-risk-amber/10'
    : 'text-muted border-kd-border bg-kd-elevated/30';

  return (
    <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border inline-flex items-center gap-1', catColor)}>
      {stock.industry}
      <span className="font-mono">{stock.industryPercentile}%ile</span>
      {stock.industryPercentileChange > 0 && <TrendingUp className="w-2.5 h-2.5" />}
      {stock.industryPercentileChange < 0 && <TrendingDown className="w-2.5 h-2.5" />}
    </span>
  );
}

// ── Enriched Stock Card (reuses StockCard layout + adds industry tag) ──

function EnrichedStockCard({ stock }: { stock: IndustryEnrichedStock }) {
  const navigate = useNavigate();
  const zoneConfig = ZONE_LABELS[stock.magic_rs_zone ?? ''] ?? { label: '—', color: 'text-muted' };
  const flowConfig = FLOW_LABELS[stock.flow_type ?? ''];

  const isNumericSymbol = /^\d+$/.test(stock.symbol);
  const heroName = isNumericSymbol ? (stock.company_name ?? stock.symbol) : stock.symbol;
  const subName = isNumericSymbol ? null : stock.company_name;

  return (
    <Card
      rounded="xxl"
      hover="lift"
      className="p-3 sm:p-4 cursor-pointer group"
      onClick={() => navigate(`/pulse/equity/${stock.equity_id}`)}
    >
      {/* Row 1: Script name + Industry tag + Price */}
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-bold text-accent-indigo font-mono truncate">{heroName}</span>
            <ExchangeBadge exchange={stock.exchange} />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {subName && <span className="text-[10px] text-muted truncate">{subName}</span>}
            {subName && <span className="text-[10px] text-muted">·</span>}
            <IndustryTag stock={stock} />
            {flowConfig && (
              <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded', flowConfig.color, 'bg-kd-elevated/50')}>
                {flowConfig.label}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-start gap-2 shrink-0 ml-3">
          <div className="text-right">
            <p className="text-sm font-bold font-mono text-[var(--text-primary)] leading-tight">
              {stock.close.toFixed(2)}
            </p>
            <p className={cn(
              'text-[11px] font-bold font-mono',
              (stock.pct_chng ?? 0) >= 0 ? 'text-risk-green' : 'text-risk-red',
            )}>
              {(stock.pct_chng ?? 0) >= 0 ? '+' : ''}{(stock.pct_chng ?? 0).toFixed(2)}%
            </p>
          </div>
          <Eye className="w-3.5 h-3.5 text-muted mt-0.5 opacity-40 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      {/* Row 2: Metrics + Signals */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <MetricPill
          label="RS"
          value={stock.magic_rs != null ? `${stock.magic_rs.toFixed(1)} ${zoneConfig.label}` : '—'}
          color={zoneConfig.color}
        />
        <MetricPill
          label="RSI"
          value={stock.rsi_14?.toFixed(0) ?? '—'}
          color={(stock.rsi_14 ?? 50) > 70 ? 'text-risk-green' : (stock.rsi_14 ?? 50) < 30 ? 'text-risk-red' : undefined}
        />
        <MetricPill
          label="RSS"
          value={stock.rss_value != null ? stock.rss_value.toFixed(0) : '—'}
          color={(stock.rss_value ?? 50) > 75 ? 'text-risk-green' : (stock.rss_value ?? 50) < 25 ? 'text-risk-red' : undefined}
        />
        <MetricPill
          label="Spread"
          value={stock.rss_spread != null ? stock.rss_spread.toFixed(0) : '—'}
          color={(stock.rss_spread ?? 0) < -200 ? 'text-risk-red' : (stock.rss_spread ?? 0) > 0 ? 'text-risk-green' : undefined}
        />
        <MetricPill
          label="RVOL"
          value={stock.rvol?.toFixed(1) ?? '—'}
          color={(stock.rvol ?? 0) > 2 ? 'text-risk-green' : undefined}
        />
        <SignalDots svd={stock.has_recent_svd} sbd={stock.has_recent_sbd} syd={stock.has_recent_syd} />
      </div>
    </Card>
  );
}

// ── Main View ─────────────────────────────────────────────────

export default function IndustryTransitionView() {
  const { data, isLoading, error } = useIndustryTransitionStocks();

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('industryPercentile');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Metric filters
  const [minPercentile, setMinPercentile] = useState(0);
  const [minRsi, setMinRsi] = useState(0);
  const [minRss, setMinRss] = useState(0);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const filtered = useMemo(() => {
    if (!data) return [];

    return data.stocks
      .filter((s) => {
        // Category filter
        if (categoryFilter !== 'all' && s.industryCategory !== categoryFilter) return false;
        // Metric filters
        if (s.industryPercentile < minPercentile) return false;
        if (minRsi > 0 && (s.rsi_14 ?? 0) < minRsi) return false;
        if (minRss > 0 && (s.rss_value ?? 0) < minRss) return false;
        return true;
      })
      .sort((a, b) => {
        let va: number = 0, vb: number = 0;
        switch (sortKey) {
          case 'industryPercentile': va = a.industryPercentile; vb = b.industryPercentile; break;
          case 'magic_rs':  va = a.magic_rs ?? 0; vb = b.magic_rs ?? 0; break;
          case 'rsi_14':    va = a.rsi_14 ?? 0; vb = b.rsi_14 ?? 0; break;
          case 'rss_value': va = a.rss_value ?? 0; vb = b.rss_value ?? 0; break;
          case 'rvol':      va = a.rvol ?? 0; vb = b.rvol ?? 0; break;
          case 'pct_chng':  va = a.pct_chng ?? 0; vb = b.pct_chng ?? 0; break;
        }
        return sortDir === 'asc' ? va - vb : vb - va;
      })
      .slice(0, 100); // cap results for performance
  }, [data, categoryFilter, sortKey, sortDir, minPercentile, minRsi, minRss]);

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
              Stocks from {data.totalIndustries} qualifying industries · 5-day window
            </span>
          )}
        </div>
      </header>

      {/* Category filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar mb-3">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setCategoryFilter(tab.id)}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border',
              categoryFilter === tab.id
                ? tab.activeClass
                : 'bg-kd-bg/40 text-muted border-kd-border hover:border-kd-border-active hover:text-[var(--text-secondary)]',
            )}
          >
            {tab.label}
            {data && (
              <span className="ml-1.5 text-[10px] opacity-70">
                {data.industryCounts[tab.id === 'all' ? 'all' : tab.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Metric filters + Sort */}
      <Card rounded="xxl" className="px-4 py-3 mb-3 flex items-center gap-4 flex-wrap">
        <span className="text-[10px] text-muted uppercase tracking-wider shrink-0">Filters</span>

        {/* Percentile */}
        <div className="flex items-center gap-2 bg-kd-bg/40 border border-kd-border rounded-lg px-3 py-1.5">
          <span className="text-[10px] text-muted uppercase tracking-wider">%ile &gt;</span>
          <input type="range" min={0} max={90} step={10} value={minPercentile}
            onChange={(e) => setMinPercentile(Number(e.target.value))}
            className="w-14 accent-risk-amber" />
          <span className="text-[10px] font-mono text-[var(--text-primary)] w-6 text-right">
            {minPercentile || 'off'}
          </span>
        </div>

        {/* RSI */}
        <div className="flex items-center gap-2 bg-kd-bg/40 border border-kd-border rounded-lg px-3 py-1.5">
          <span className="text-[10px] text-muted uppercase tracking-wider">RSI &gt;</span>
          <input type="range" min={0} max={80} step={10} value={minRsi}
            onChange={(e) => setMinRsi(Number(e.target.value))}
            className="w-14 accent-risk-amber" />
          <span className="text-[10px] font-mono text-[var(--text-primary)] w-6 text-right">
            {minRsi || 'off'}
          </span>
        </div>

        {/* RSS */}
        <div className="flex items-center gap-2 bg-kd-bg/40 border border-kd-border rounded-lg px-3 py-1.5">
          <span className="text-[10px] text-muted uppercase tracking-wider">RSS &gt;</span>
          <input type="range" min={0} max={80} step={10} value={minRss}
            onChange={(e) => setMinRss(Number(e.target.value))}
            className="w-14 accent-risk-amber" />
          <span className="text-[10px] font-mono text-[var(--text-primary)] w-6 text-right">
            {minRss || 'off'}
          </span>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1 ml-auto overflow-x-auto no-scrollbar">
          <span className="text-[10px] text-muted uppercase tracking-wider shrink-0 mr-1">Sort</span>
          {SORT_OPTIONS.map((opt) => {
            const active = sortKey === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => toggleSort(opt.key)}
                className={cn(
                  'inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-bold transition-all border whitespace-nowrap',
                  active
                    ? 'bg-accent-indigo/15 text-accent-indigo border-accent-indigo/30'
                    : 'text-muted border-transparent hover:text-[var(--text-secondary)]',
                )}
              >
                {opt.label}
                {active && (sortDir === 'asc' ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />)}
                {!active && <ArrowUpDown className="w-2.5 h-2.5 opacity-30" />}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-accent-indigo mr-2" />
          <span className="text-sm text-muted">Loading stocks with industry context...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <Card rounded="xxl" className="py-12 text-center">
          <p className="text-xs text-risk-red">Failed to load industry transition data.</p>
        </Card>
      )}

      {/* Stock cards */}
      {!isLoading && !error && filtered.length > 0 && (
        <>
          <div className="space-y-2">
            {filtered.map((stock) => (
              <EnrichedStockCard key={stock.equity_id} stock={stock} />
            ))}
          </div>
          <div className="mt-3 text-center">
            <span className="text-[10px] text-muted font-mono">
              {filtered.length} stock{filtered.length !== 1 ? 's' : ''}
              {filtered.length === 100 ? ' (showing top 100)' : ''}
            </span>
          </div>
        </>
      )}

      {!isLoading && !error && filtered.length === 0 && data && (
        <Card rounded="xxl" className="py-16 text-center">
          <p className="text-sm text-muted">No stocks match the current filters</p>
          <p className="text-xs text-muted mt-1">Try relaxing the metric thresholds</p>
        </Card>
      )}
    </div>
  );
}
