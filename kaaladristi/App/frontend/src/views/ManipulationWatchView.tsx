import { useState } from 'react';
import { Loader2, ShieldAlert, AlertTriangle, X, BookOpen } from 'lucide-react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useManipulationWatch } from '@/hooks/useManipulationWatch';
import type { ManipulationWatchStock } from '@/services/scanEngine';

// ── Vocabulary mapping (reused from ScanView) ────────────────

const ZONE_LABELS: Record<string, { label: string; color: string }> = {
  'Strong Bull': { label: 'Strong Bull', color: 'text-risk-green' },
  'Mild Bull':   { label: 'Mild Bull',   color: 'text-risk-green/70' },
  'Neutral':     { label: 'Neutral',     color: 'text-muted' },
  'Mild Bear':   { label: 'Mild Bear',   color: 'text-risk-red/70' },
  'Strong Bear': { label: 'Strong Bear', color: 'text-risk-red' },
};

const FLOW_LABELS: Record<string, { label: string; color: string }> = {
  FRESH_LONGS:      { label: 'Fresh Longs',      color: 'text-risk-green' },
  FRESH_SHORTS:     { label: 'Fresh Shorts',     color: 'text-risk-red' },
  SHORT_COVERING:   { label: 'Short Covering',   color: 'text-risk-amber' },
  LONG_LIQUIDATION: { label: 'Liquidation',      color: 'text-risk-red/80' },
  LOW_VOLUME:       { label: 'Low Volume',        color: 'text-muted' },
  MIXED:            { label: 'Mixed',             color: 'text-muted' },
};

// ── Exchange badge ────────────────────────────────────────────

function ExchangeBadge({ exchange }: { exchange: string | null }) {
  if (!exchange) return null;
  return (
    <span className={cn(
      'text-[8px] font-bold px-1 py-0.5 rounded border',
      exchange === 'NSE'
        ? 'text-accent-cyan border-accent-cyan/30 bg-accent-cyan/5'
        : 'text-risk-amber border-risk-amber/30 bg-risk-amber/5',
    )}>
      {exchange}
    </span>
  );
}

// ── Detail row (for modal) ────────────────────────────────────

function DetailRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-kd-bg/40 rounded-xl px-3 py-2 border border-kd-border">
      <p className="text-[10px] text-muted uppercase tracking-wider mb-0.5">{label}</p>
      <p className={cn('font-bold font-mono', color ?? 'text-[var(--text-primary)]')}>{value}</p>
    </div>
  );
}

// ── Stock Detail Modal ────────────────────────────────────────

function StockDetailModal({
  stock,
  variant,
  onClose,
}: {
  stock: ManipulationWatchStock;
  variant: 'pump' | 'dump';
  onClose: () => void;
}) {
  const zoneConfig = ZONE_LABELS[stock.magic_rs_zone ?? ''] ?? { label: stock.magic_rs_zone ?? '—', color: 'text-muted' };
  const flowConfig = FLOW_LABELS[stock.flow_type ?? ''] ?? { label: stock.flow_type ?? '—', color: 'text-muted' };
  const accentColor = variant === 'pump' ? 'text-risk-amber' : 'text-risk-red';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <Card
        rounded="xxl"
        className="w-full max-w-md p-6 shadow-2xl animate-fade-in"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className={cn('w-5 h-5 shrink-0', accentColor)} />
            <div>
              <h3 className={cn('text-lg font-bold font-mono', accentColor)}>{stock.symbol}</h3>
              <p className="text-xs text-muted mt-0.5">{stock.company_name ?? stock.industry}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-kd-elevated text-muted hover:text-[var(--text-primary)] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-3 mb-5">
          <span className="text-3xl font-bold font-mono text-[var(--text-primary)]">
            {stock.close.toFixed(2)}
          </span>
          <span className={cn(
            'text-sm font-bold font-mono',
            (stock.pct_chng ?? 0) >= 0 ? 'text-risk-green' : 'text-risk-red',
          )}>
            {(stock.pct_chng ?? 0) >= 0 ? '+' : ''}{(stock.pct_chng ?? 0).toFixed(2)}%
          </span>
        </div>

        {/* Why Flagged */}
        <div className={cn(
          'rounded-xl px-3 py-2.5 mb-4 border',
          variant === 'pump'
            ? 'bg-risk-amber/5 border-risk-amber/20'
            : 'bg-risk-red/5 border-risk-red/20',
        )}>
          <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Why Flagged</p>
          <p className={cn('text-xs font-medium', accentColor)}>
            {stock.whyFlagged.join(' + ')}
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <DetailRow label="Magic RS" value={stock.magic_rs?.toFixed(2) ?? '—'} color={zoneConfig.color} />
          <DetailRow label="Zone" value={zoneConfig.label} color={zoneConfig.color} />
          <DetailRow label="Flow Type" value={flowConfig.label} color={flowConfig.color} />
          <DetailRow label="RVOL" value={stock.rvol?.toFixed(2) ?? '—'} color={(stock.rvol ?? 0) > 2 ? 'text-risk-green' : 'text-muted'} />
          <DetailRow label="Smart Money" value={stock.sniper_inst?.toFixed(1) ?? '—'} />
          <DetailRow label="RSS" value={stock.rss_value?.toFixed(1) ?? '—'} />
          <DetailRow label="RSS Spread" value={stock.rss_spread?.toFixed(0) ?? '—'} />
          <DetailRow label="Industry" value={stock.industry ?? '—'} />
        </div>
      </Card>
    </div>
  );
}

// ── Suspect Stock Row ─────────────────────────────────────────

function SuspectRow({
  stock,
  variant,
  onSelect,
}: {
  stock: ManipulationWatchStock;
  variant: 'pump' | 'dump';
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full text-left px-4 py-3 transition-colors border-l-[3px]',
        variant === 'pump'
          ? 'bg-risk-amber/[0.06] border-l-risk-amber hover:bg-risk-amber/10'
          : 'bg-risk-red/[0.06] border-l-risk-red hover:bg-risk-red/10',
      )}
    >
      {/* Top line: symbol + price + change */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <AlertTriangle className={cn(
            'w-3.5 h-3.5 shrink-0',
            variant === 'pump' ? 'text-risk-amber' : 'text-risk-red',
          )} />
          <span className={cn(
            'font-mono font-bold text-sm',
            variant === 'pump' ? 'text-risk-amber' : 'text-risk-red',
          )}>
            {stock.symbol}
          </span>
          <ExchangeBadge exchange={stock.exchange} />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono font-bold text-sm text-[var(--text-primary)]">
            {stock.close.toFixed(2)}
          </span>
          <span className={cn(
            'font-mono font-bold text-xs',
            (stock.pct_chng ?? 0) >= 0 ? 'text-risk-green' : 'text-risk-red',
          )}>
            {(stock.pct_chng ?? 0) >= 0 ? '+' : ''}{(stock.pct_chng ?? 0).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Industry line */}
      <p className="text-[11px] text-muted mb-1.5 pl-[22px]">
        {stock.industry ?? 'Unknown industry'}
      </p>

      {/* Why flagged */}
      <p className={cn(
        'text-[11px] pl-[22px] leading-relaxed',
        variant === 'pump' ? 'text-risk-amber/80' : 'text-risk-red/80',
      )}>
        <span className="text-muted">Why flagged: </span>
        {stock.whyFlagged.join(' + ')}
      </p>
    </button>
  );
}

// ── Section Component ─────────────────────────────────────────

function SuspectSection({
  title,
  description,
  stocks,
  variant,
  onSelect,
}: {
  title: string;
  description: string;
  stocks: ManipulationWatchStock[];
  variant: 'pump' | 'dump';
  onSelect: (stock: ManipulationWatchStock) => void;
}) {
  const accentColor = variant === 'pump' ? 'text-risk-amber' : 'text-risk-red';
  const borderColor = variant === 'pump' ? 'border-risk-amber/30' : 'border-risk-red/30';

  return (
    <Card rounded="xxl" className={cn('overflow-hidden border', borderColor)}>
      {/* Section header */}
      <div className={cn(
        'px-4 py-3 border-b',
        borderColor,
        variant === 'pump' ? 'bg-risk-amber/[0.04]' : 'bg-risk-red/[0.04]',
      )}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className={cn('w-4 h-4', accentColor)} />
            <h2 className={cn('text-sm font-bold uppercase tracking-wide', accentColor)}>
              {title}
            </h2>
          </div>
          <span className={cn('text-xs font-bold font-mono', accentColor)}>
            {stocks.length} stock{stocks.length !== 1 ? 's' : ''}
          </span>
        </div>
        <p className="text-xs text-muted pl-6">{description}</p>
      </div>

      {/* Stock list */}
      {stocks.length > 0 ? (
        <div className="divide-y divide-kd-border/50">
          {stocks.map((stock) => (
            <SuspectRow
              key={stock.equity_id}
              stock={stock}
              variant={variant}
              onSelect={() => onSelect(stock)}
            />
          ))}
        </div>
      ) : (
        <div className="py-10 text-center">
          <p className="text-sm text-muted">No suspect activity detected today.</p>
        </div>
      )}
    </Card>
  );
}

// ── Educational Footer ────────────────────────────────────────

function EducationalFooter() {
  return (
    <Card rounded="xxl" className="overflow-hidden border border-kd-border mt-6">
      <div className="px-5 py-4 border-b border-kd-border bg-kd-elevated/30">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-muted" />
          <h2 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wide">
            How to read these signals
          </h2>
        </div>
      </div>

      <div className="px-5 py-4 text-xs text-[var(--text-secondary)] leading-relaxed space-y-4">
        <p>
          <strong className="text-risk-amber">Pump suspects</strong> show price moving up while
          the underlying signals weaken: short covering instead of fresh longs, volume fading even
          as price rises, RSS overbought beyond healthy structure. This pattern typically indicates
          an operator inflating the price to attract retail buyers, who then become exit liquidity.
        </p>

        <p>
          <strong className="text-risk-red">Dump suspects</strong> show the reverse: price
          collapsing while smart money quietly exits and volume fades. The &quot;panic&quot; is often
          manufactured to trigger retail stop losses, which the operator absorbs at a discount.
        </p>

        <p className="text-muted italic">
          These are not trade signals. Most retail traders should avoid both. Advanced traders may
          use the dump pattern to short, but only with strict risk controls.
        </p>

        <div className="border-t border-kd-border pt-4">
          <p className="font-bold text-[var(--text-secondary)] mb-2">The conditions detected here:</p>
          <ul className="space-y-1.5 text-muted">
            <li>
              <strong className="text-[var(--text-secondary)]">RSS overbought / oversold:</strong>{' '}
              Relative Strength Score above 75 or below 25 indicates extreme positioning
            </li>
            <li>
              <strong className="text-[var(--text-secondary)]">Spread broken:</strong>{' '}
              RSS spread below -200 means the underlying structure of the move is weak
            </li>
            <li>
              <strong className="text-[var(--text-secondary)]">Volume divergence:</strong>{' '}
              Price moving against declining volume — participation is fading even as price extends
            </li>
            <li>
              <strong className="text-[var(--text-secondary)]">Short covering:</strong>{' '}
              Buying that closes existing short positions rather than fresh demand
            </li>
            <li>
              <strong className="text-[var(--text-secondary)]">Long liquidation:</strong>{' '}
              Selling that closes existing long positions rather than fresh supply
            </li>
            <li>
              <strong className="text-[var(--text-secondary)]">Smart money exiting:</strong>{' '}
              Institutional indicator declining over multiple days
            </li>
          </ul>
        </div>
      </div>
    </Card>
  );
}

// ── Main View ─────────────────────────────────────────────────

export default function ManipulationWatchView() {
  const { data, isLoading, error } = useManipulationWatch();
  const [selectedStock, setSelectedStock] = useState<{ stock: ManipulationWatchStock; variant: 'pump' | 'dump' } | null>(null);

  return (
    <div className="animate-fade-in">
      {/* Header with warning accent */}
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-risk-amber/10 border border-risk-amber/30 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-risk-amber" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary)]">
              Manipulation Watch
            </h1>
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-secondary font-medium text-sm">
            Stocks showing artificial price movement signatures
          </p>
          {data?.latestDate && (
            <span className="text-[10px] text-muted font-mono shrink-0">
              Data as of {data.latestDate}
            </span>
          )}
        </div>
        {/* Warning accent bar */}
        <div className="mt-3 h-[2px] bg-gradient-to-r from-risk-amber/60 via-risk-red/40 to-transparent rounded-full" />
      </header>

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
      {data && !isLoading && (
        <div className="space-y-6">
          <SuspectSection
            title="Pump Suspects"
            description="Stocks rising on operator activity. Price moves up but underlying volume and structure don't support it."
            stocks={data.pumpSuspects}
            variant="pump"
            onSelect={(stock) => setSelectedStock({ stock, variant: 'pump' })}
          />

          <SuspectSection
            title="Dump Suspects"
            description="Stocks collapsing with smart money exiting and weakening volume. Distribution disguised as panic selling."
            stocks={data.dumpSuspects}
            variant="dump"
            onSelect={(stock) => setSelectedStock({ stock, variant: 'dump' })}
          />

          <EducationalFooter />
        </div>
      )}

      {/* Stock Detail Modal */}
      {selectedStock && (
        <StockDetailModal
          stock={selectedStock.stock}
          variant={selectedStock.variant}
          onClose={() => setSelectedStock(null)}
        />
      )}
    </div>
  );
}
