import { useState, useMemo } from 'react';
import { Loader2, X, TrendingUp, TrendingDown, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useScan } from '@/hooks/useScan';
import { SCAN_PRESETS, type ExchangeFilter } from '@/services/scanEngine';
import type { ScanStock } from '@/types';

const EXCHANGE_TABS: { id: ExchangeFilter; label: string }[] = [
  { id: 'combined', label: 'Combined' },
  { id: 'NSE', label: 'NSE' },
  { id: 'BSE', label: 'BSE' },
];

// ── Vocabulary mapping (KaalaDristi language) ──────────────────

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

// ── Exchange badge ─────────────────────────────────────────────

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

// ── Dot indicator ──────────────────────────────────────────────

function DotIndicator({ svd, sbd, syd }: { svd: boolean; sbd: boolean; syd: boolean }) {
  if (!svd && !sbd && !syd) return <span className="text-muted">—</span>;
  return (
    <div className="flex items-center gap-1">
      {svd && <span className="w-2 h-2 rounded-full bg-risk-green" title="Strong Volume Drive" />}
      {sbd && <span className="w-2 h-2 rounded-full bg-accent-cyan" title="Accumulation Signature" />}
      {syd && <span className="w-2 h-2 rounded-full bg-risk-red" title="Distribution Signal" />}
    </div>
  );
}

// ── Stock Detail Card (Modal) ──────────────────────────────────

function StockDetailCard({
  stock,
  onClose,
}: {
  stock: ScanStock;
  onClose: () => void;
}) {
  const zoneConfig = ZONE_LABELS[stock.magic_rs_zone ?? ''] ?? { label: stock.magic_rs_zone ?? '—', color: 'text-muted' };
  const flowConfig = FLOW_LABELS[stock.flow_type ?? ''] ?? { label: stock.flow_type ?? '—', color: 'text-muted' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <Card
        rounded="xxl"
        className="w-full max-w-md p-6 shadow-2xl animate-fade-in"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-accent-indigo font-mono">{stock.symbol}</h3>
            <p className="text-xs text-muted mt-0.5">{stock.company_name ?? stock.industry}</p>
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

        {/* Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <DetailRow label="Magic RS" value={stock.magic_rs?.toFixed(2) ?? '—'} color={zoneConfig.color} />
          <DetailRow label="Zone" value={zoneConfig.label} color={zoneConfig.color} />
          <DetailRow label="Flow Type" value={flowConfig.label} color={flowConfig.color} />
          <DetailRow label="RVOL" value={stock.rvol?.toFixed(2) ?? '—'} color={(stock.rvol ?? 0) > 2 ? 'text-risk-green' : 'text-muted'} />
          <DetailRow label="Smart Money" value={stock.sniper_inst?.toFixed(1) ?? '—'} />
          <DetailRow label="RSS" value={stock.rss_value?.toFixed(1) ?? '—'} />
          <DetailRow label="Accumulation" value={stock.accum_distrib ?? '—'} color={stock.accum_distrib === 'ACCUMULATION' ? 'text-risk-green' : stock.accum_distrib === 'DISTRIBUTION' ? 'text-risk-red' : 'text-muted'} />
          <DetailRow label="Industry" value={stock.industry ?? '—'} />
        </div>

        {/* Dot Signals */}
        <div className="mt-4 pt-3 border-t border-kd-border flex items-center gap-4 text-xs">
          <span className="text-muted">Recent Signals:</span>
          {stock.has_recent_svd && (
            <span className="flex items-center gap-1 text-risk-green">
              <span className="w-2 h-2 rounded-full bg-risk-green" /> Volume Drive
            </span>
          )}
          {stock.has_recent_sbd && (
            <span className="flex items-center gap-1 text-accent-cyan">
              <span className="w-2 h-2 rounded-full bg-accent-cyan" /> Accumulation
            </span>
          )}
          {stock.has_recent_syd && (
            <span className="flex items-center gap-1 text-risk-red">
              <span className="w-2 h-2 rounded-full bg-risk-red" /> Distribution
            </span>
          )}
          {!stock.has_recent_svd && !stock.has_recent_sbd && !stock.has_recent_syd && (
            <span className="text-muted">None</span>
          )}
        </div>
      </Card>
    </div>
  );
}

function DetailRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-kd-bg/40 rounded-xl px-3 py-2 border border-kd-border">
      <p className="text-[10px] text-muted uppercase tracking-wider mb-0.5">{label}</p>
      <p className={cn('font-bold font-mono', color ?? 'text-[var(--text-primary)]')}>{value}</p>
    </div>
  );
}

// ── Sortable Table ─────────────────────────────────────────────

type SortKey = 'symbol' | 'industry' | 'close' | 'pct_chng' | 'magic_rs' | 'rvol';
type SortDir = 'asc' | 'desc';

function ScanResultsTable({
  stocks,
  onSelect,
}: {
  stocks: ScanStock[];
  onSelect: (stock: ScanStock) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('magic_rs');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const sorted = useMemo(() => {
    const arr = [...stocks];
    arr.sort((a, b) => {
      let va: string | number = 0;
      let vb: string | number = 0;

      switch (sortKey) {
        case 'symbol':   va = a.symbol; vb = b.symbol; break;
        case 'industry': va = a.industry ?? ''; vb = b.industry ?? ''; break;
        case 'close':    va = a.close; vb = b.close; break;
        case 'pct_chng': va = a.pct_chng ?? 0; vb = b.pct_chng ?? 0; break;
        case 'magic_rs': va = a.magic_rs ?? 0; vb = b.magic_rs ?? 0; break;
        case 'rvol':     va = a.rvol ?? 0; vb = b.rvol ?? 0; break;
      }

      if (typeof va === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      }
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return arr;
  }, [stocks, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-muted/40" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-accent-indigo" />
      : <ArrowDown className="w-3 h-3 text-accent-indigo" />;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-kd-border">
            {[
              { key: 'symbol' as SortKey, label: 'Symbol', align: 'text-left' },
              { key: 'industry' as SortKey, label: 'Industry', align: 'text-left', hideOnMobile: true },
              { key: 'close' as SortKey, label: 'LTP', align: 'text-right' },
              { key: 'pct_chng' as SortKey, label: '% Chg', align: 'text-right' },
              { key: 'magic_rs' as SortKey, label: 'Magic RS', align: 'text-right' },
              { key: 'rvol' as SortKey, label: 'RVOL', align: 'text-right', hideOnMobile: true },
            ].map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-3 py-2.5 font-bold text-muted uppercase tracking-wider cursor-pointer hover:text-[var(--text-secondary)] transition-colors select-none whitespace-nowrap',
                  col.align,
                  col.hideOnMobile && 'hidden sm:table-cell',
                )}
                onClick={() => toggleSort(col.key)}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label} <SortIcon col={col.key} />
                </span>
              </th>
            ))}
            <th className="px-3 py-2.5 text-left font-bold text-muted uppercase tracking-wider whitespace-nowrap hidden md:table-cell">Flow</th>
            <th className="px-3 py-2.5 text-center font-bold text-muted uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">Signals</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((stock) => {
            const zoneColor = ZONE_LABELS[stock.magic_rs_zone ?? '']?.color ?? 'text-muted';
            const flowConfig = FLOW_LABELS[stock.flow_type ?? ''];
            return (
              <tr
                key={stock.equity_id}
                className="border-b border-kd-border/50 hover:bg-kd-elevated/20 cursor-pointer transition-colors"
                onClick={() => onSelect(stock)}
              >
                <td className="px-3 py-2.5">
                  <div>
                    <span className="font-mono font-bold text-accent-indigo">{stock.symbol}</span>
                    {' '}<ExchangeBadge exchange={stock.exchange} />
                    <span className="block text-[10px] text-muted truncate max-w-[120px] sm:max-w-[180px]">
                      {stock.company_name}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-muted truncate max-w-[120px] hidden sm:table-cell">{stock.industry}</td>
                <td className="px-3 py-2.5 text-right font-mono font-bold text-[var(--text-primary)]">
                  {stock.close.toFixed(1)}
                </td>
                <td className={cn('px-3 py-2.5 text-right font-mono font-bold', (stock.pct_chng ?? 0) >= 0 ? 'text-risk-green' : 'text-risk-red')}>
                  {(stock.pct_chng ?? 0) >= 0 ? '+' : ''}{(stock.pct_chng ?? 0).toFixed(1)}%
                </td>
                <td className={cn('px-3 py-2.5 text-right font-mono font-bold', zoneColor)}>
                  {stock.magic_rs?.toFixed(1) ?? '—'}
                </td>
                <td className="px-3 py-2.5 text-right font-mono hidden sm:table-cell">
                  {stock.rvol?.toFixed(1) ?? '—'}
                </td>
                <td className="px-3 py-2.5 hidden md:table-cell">
                  {flowConfig && (
                    <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', flowConfig.color + ' bg-kd-elevated/30')}>
                      {flowConfig.label}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 hidden lg:table-cell">
                  <div className="flex justify-center">
                    <DotIndicator svd={stock.has_recent_svd} sbd={stock.has_recent_sbd} syd={stock.has_recent_syd} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Mobile Card View ───────────────────────────────────────────

function ScanResultsMobile({
  stocks,
  onSelect,
}: {
  stocks: ScanStock[];
  onSelect: (stock: ScanStock) => void;
}) {
  return (
    <div className="space-y-2">
      {stocks.map((stock) => {
        const zoneColor = ZONE_LABELS[stock.magic_rs_zone ?? '']?.color ?? 'text-muted';
        return (
          <button
            key={stock.equity_id}
            onClick={() => onSelect(stock)}
            className="w-full text-left bg-kd-bg/40 border border-kd-border rounded-xl p-3 hover:border-kd-border-active transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono font-bold text-accent-indigo text-sm">{stock.symbol}</span>
              {' '}<ExchangeBadge exchange={stock.exchange} />
              <span className={cn('font-mono font-bold text-sm', (stock.pct_chng ?? 0) >= 0 ? 'text-risk-green' : 'text-risk-red')}>
                {(stock.pct_chng ?? 0) >= 0 ? '+' : ''}{(stock.pct_chng ?? 0).toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted truncate flex-1">{stock.industry}</span>
              <span className="font-mono font-bold text-[var(--text-primary)] mx-2">{stock.close.toFixed(1)}</span>
              <span className={cn('font-mono', zoneColor)}>RS {stock.magic_rs?.toFixed(0) ?? '—'}</span>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <DotIndicator svd={stock.has_recent_svd} sbd={stock.has_recent_sbd} syd={stock.has_recent_syd} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Main Scan View ─────────────────────────────────────────────

export default function ScanView() {
  const [activeScan, setActiveScan] = useState(SCAN_PRESETS[0].id);
  const [exchangeFilter, setExchangeFilter] = useState<ExchangeFilter>('combined');
  const [selectedStock, setSelectedStock] = useState<ScanStock | null>(null);
  const { data: stocks, isLoading, error } = useScan(activeScan, exchangeFilter);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <header className="mb-4">
        <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary)] mb-1">
          Market Scanner
        </h1>
        <p className="text-secondary font-medium text-sm">
          Identify high-probability setups across{' '}
          <span className="text-accent-indigo font-bold">industry rotation</span>
        </p>
      </header>

      {/* Scan Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar mb-4">
        {SCAN_PRESETS.map((scan) => (
          <button
            key={scan.id}
            onClick={() => setActiveScan(scan.id)}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border',
              activeScan === scan.id
                ? 'bg-accent-indigo/15 text-accent-indigo border-accent-indigo/40'
                : 'bg-kd-bg/40 text-muted border-kd-border hover:border-kd-border-active hover:text-[var(--text-secondary)]',
            )}
          >
            {scan.name}
          </button>
        ))}
      </div>

      {/* Exchange Tabs + Scan Description */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted pl-1 flex-1">
          {SCAN_PRESETS.find((s) => s.id === activeScan)?.description}
        </p>
        <div className="flex items-center gap-1 shrink-0 ml-4">
          {EXCHANGE_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setExchangeFilter(tab.id)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border',
                exchangeFilter === tab.id
                  ? 'bg-accent-indigo/15 text-accent-indigo border-accent-indigo/30'
                  : 'text-muted border-transparent hover:text-[var(--text-secondary)]',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <Card rounded="xxl" className="overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-accent-indigo mr-2" />
            <span className="text-sm text-muted">Scanning market...</span>
          </div>
        ) : error ? (
          <div className="py-12 text-center">
            <p className="text-xs text-risk-red">Failed to run scan. Check data connection.</p>
          </div>
        ) : stocks && stocks.length > 0 ? (
          <>
            {/* Desktop: table */}
            <div className="hidden sm:block">
              <ScanResultsTable stocks={stocks} onSelect={setSelectedStock} />
            </div>
            {/* Mobile: cards */}
            <div className="block sm:hidden p-3">
              <ScanResultsMobile stocks={stocks} onSelect={setSelectedStock} />
            </div>
            {/* Count */}
            <div className="px-4 py-2.5 border-t border-kd-border bg-kd-bg/30">
              <span className="text-[10px] text-muted font-mono">
                {stocks.length} result{stocks.length !== 1 ? 's' : ''}
              </span>
            </div>
          </>
        ) : (
          <div className="py-16 text-center">
            <p className="text-sm text-muted">No stocks match this scan criteria</p>
            <p className="text-xs text-muted mt-1">Try a different scan or check data availability</p>
          </div>
        )}
      </Card>

      {/* Stock Detail Modal */}
      {selectedStock && (
        <StockDetailCard stock={selectedStock} onClose={() => setSelectedStock(null)} />
      )}
    </div>
  );
}
