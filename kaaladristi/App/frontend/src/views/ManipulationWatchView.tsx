import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ShieldAlert, AlertTriangle, BarChart3, BookOpen } from 'lucide-react';
import { Card, PageHeader } from '@/components/ui';
import { cn } from '@/lib/utils';
import { displaySymbol, displaySubName, navName as toNavName, bseTooltip } from '@/lib/symbolUtils';
import { useManipulationWatch } from '@/hooks/useManipulationWatch';
import { ZONE_LABELS, FLOW_LABELS, ExchangeBadge, MetricPill } from '@/components/domain/StockCard';
import type { ManipulationWatchStock } from '@/services/scanEngine';

// ── Suspect Card ─────────────────────────────────────────────

function SuspectCard({ stock, variant }: { stock: ManipulationWatchStock; variant: 'pump' | 'dump' }) {
  const navigate = useNavigate();
  const zoneConfig = ZONE_LABELS[stock.magic_rs_zone ?? ''] ?? { label: '—', color: 'text-muted' };
  const flowConfig = FLOW_LABELS[stock.flow_type ?? ''];

  const heroName = displaySymbol(stock);
  const subName = displaySubName(stock);
  const tooltip = bseTooltip(stock);

  const accentColor = variant === 'pump' ? 'text-risk-amber' : 'text-risk-red';
  const borderColor = variant === 'pump' ? 'border-l-risk-amber' : 'border-l-risk-red';

  return (
    <Card
      rounded="xxl"
      hover="lift"
      className={cn('p-3 sm:p-4 cursor-pointer group border-l-[3px]', borderColor)}
      title={tooltip ?? undefined}
      onClick={() => navigate(`/chart/equity/${stock.equity_id}?name=${encodeURIComponent(toNavName(stock))}`)}
    >
      {/* Row 1: Name + trigger count + price + chart icon */}
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <AlertTriangle className={cn('w-3.5 h-3.5 shrink-0', accentColor)} />
            <span className={cn('text-sm font-bold font-mono truncate', accentColor)}>{heroName}</span>
            <ExchangeBadge exchange={stock.exchange} />
            {stock.triggerCount > 1 && (
              <span className={cn(
                'text-[9px] font-bold px-1.5 py-0.5 rounded',
                variant === 'pump'
                  ? 'bg-risk-amber/15 text-risk-amber'
                  : 'bg-risk-red/15 text-risk-red',
              )}>
                {stock.triggerCount}x in range
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap pl-[22px]">
            {subName && <span className="text-[10px] text-muted truncate">{subName}</span>}
            {subName && stock.industry && <span className="text-[10px] text-muted">·</span>}
            {stock.industry && <span className="text-[10px] text-muted">{stock.industry}</span>}
            {flowConfig && (
              <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded', flowConfig.color, 'bg-kd-elevated/50')}>
                {flowConfig.label}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-start gap-2 shrink-0 ml-3">
          <div className="text-right">
            <p className="text-sm font-bold font-mono text-primary leading-tight">
              {stock.close != null ? stock.close.toFixed(2) : '—'}
            </p>
            <p className={cn(
              'text-[11px] font-bold font-mono',
              (stock.pct_chng ?? 0) >= 0 ? 'text-risk-green' : 'text-risk-red',
            )}>
              {(stock.pct_chng ?? 0) >= 0 ? '+' : ''}{(stock.pct_chng ?? 0).toFixed(2)}%
            </p>
          </div>
          <BarChart3 className="w-3.5 h-3.5 text-muted mt-0.5 opacity-40 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      {/* Row 2: Why flagged */}
      <div className={cn(
        'text-[10px] leading-relaxed pl-[22px] mb-2',
        variant === 'pump' ? 'text-risk-amber/80' : 'text-risk-red/80',
      )}>
        {stock.whyFlagged.join(' + ')}
      </div>

      {/* Row 3: Metrics */}
      <div className="flex items-center gap-1.5 flex-wrap pl-[22px]">
        <MetricPill
          label="RS"
          value={stock.magic_rs != null ? `${stock.magic_rs.toFixed(1)} ${zoneConfig.label}` : '—'}
          color={zoneConfig.color}
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
        <span className="text-[9px] font-mono text-muted ml-auto">{stock.latestTrigger}</span>
      </div>
    </Card>
  );
}

// ── Educational Footer ────────────────────────────────────────

function EducationalFooter() {
  return (
    <Card rounded="xxl" className="overflow-hidden border border-kd-border mt-4">
      <div className="px-5 py-3 border-b border-kd-border bg-kd-elevated/30">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-muted" />
          <h2 className="text-xs font-bold text-secondary uppercase tracking-wide">
            How to read these signals
          </h2>
        </div>
      </div>
      <div className="px-5 py-4 text-xs text-secondary leading-relaxed space-y-3">
        <p>
          <strong className="text-risk-amber">Pump suspects</strong> show price rising while structure weakens:
          RSS overbought beyond healthy levels, broken spread, short covering instead of fresh demand,
          volume diverging up.
        </p>
        <p>
          <strong className="text-risk-red">Dump suspects</strong> show price collapsing under distribution:
          RSS oversold, long liquidation flow, volume diverging down.
        </p>
        <p className="text-muted italic">
          These are observational signals, not trade recommendations. Most retail traders should avoid both patterns.
        </p>
      </div>
    </Card>
  );
}

// ── Lookback + Tab config ─────────────────────────────────────

const LOOKBACK_OPTIONS = [
  { days: 7, label: '7d' },
  { days: 14, label: '14d' },
  { days: 30, label: '30d' },
  { days: 60, label: '60d' },
];

type ActiveTab = 'pump' | 'dump';

// ── Main View ─────────────────────────────────────────────────

export default function ManipulationWatchView() {
  const [lookbackDays, setLookbackDays] = useState(30);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dump');
  const { data, isLoading, error } = useManipulationWatch(lookbackDays);

  const pumpCount = data?.pumpSuspects.length ?? 0;
  const dumpCount = data?.dumpSuspects.length ?? 0;
  const stocks = activeTab === 'pump' ? (data?.pumpSuspects ?? []) : (data?.dumpSuspects ?? []);

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Manipulation Watch"
        title={
          <span className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-risk-amber/10 border border-risk-amber/30 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-risk-amber" />
            </span>
            Manipulation Watch
          </span>
        }
        meta="Stocks showing artificial price movement signatures"
      />

      <div className="pt-4">
      {/* Controls: Tabs + Lookback */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        {/* Pump / Dump tabs */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('pump')}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-bold transition-all border',
              activeTab === 'pump'
                ? 'bg-risk-amber/15 text-risk-amber border-risk-amber/40'
                : 'bg-kd-bg/40 text-muted border-kd-border hover:text-secondary',
            )}
          >
            Pump Suspects
            {!isLoading && <span className="ml-1.5 text-[10px] opacity-70">{pumpCount}</span>}
          </button>
          <button
            onClick={() => setActiveTab('dump')}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-bold transition-all border',
              activeTab === 'dump'
                ? 'bg-risk-red/15 text-risk-red border-risk-red/40'
                : 'bg-kd-bg/40 text-muted border-kd-border hover:text-secondary',
            )}
          >
            Dump Suspects
            {!isLoading && <span className="ml-1.5 text-[10px] opacity-70">{dumpCount}</span>}
          </button>
        </div>

        {/* Lookback + date */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {LOOKBACK_OPTIONS.map((opt) => (
              <button
                key={opt.days}
                onClick={() => setLookbackDays(opt.days)}
                className={cn(
                  'px-2 py-1 rounded-lg text-[10px] font-bold transition-all border',
                  lookbackDays === opt.days
                    ? 'bg-risk-amber/15 text-risk-amber border-risk-amber/30'
                    : 'text-muted border-transparent hover:text-secondary',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {data?.latestDate && (
            <span className="text-[10px] text-muted font-mono">as of {data.latestDate}</span>
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-risk-amber mr-2" />
          <span className="text-sm text-muted">Scanning for manipulation signals...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <Card rounded="xxl" className="py-12 text-center">
          <p className="text-xs text-risk-red">Failed to run manipulation scan. Check data connection.</p>
        </Card>
      )}

      {/* Results */}
      {!isLoading && !error && data && (
        <>
          {stocks.length > 0 ? (
            <div className="space-y-2">
              {stocks.map((stock) => (
                <SuspectCard key={stock.equity_id} stock={stock} variant={activeTab} />
              ))}
              <div className="mt-2 text-center">
                <span className="text-[10px] text-muted font-mono">
                  {stocks.length} suspect{stocks.length !== 1 ? 's' : ''} in last {lookbackDays} trading days
                </span>
              </div>
            </div>
          ) : (
            <Card rounded="xxl" className="py-16 text-center">
              <p className="text-sm text-muted">
                {activeTab === 'pump'
                  ? 'No pump suspects detected in the last ' + lookbackDays + ' trading days.'
                  : 'No dump suspects detected in the last ' + lookbackDays + ' trading days.'}
              </p>
            </Card>
          )}

          <EducationalFooter />
        </>
      )}
      </div>
    </div>
  );
}
