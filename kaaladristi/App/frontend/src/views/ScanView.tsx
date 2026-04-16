import { useState, useMemo } from 'react';
import { Loader2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
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

// ── Signal Dots (bigger, with labels) ─────────────────────────

function SignalDots({ svd, sbd, syd }: { svd: boolean; sbd: boolean; syd: boolean }) {
  if (!svd && !sbd && !syd) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {svd && (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-risk-green">
          <span className="w-2.5 h-2.5 rounded-full bg-risk-green shrink-0" />
          Volume Drive
        </span>
      )}
      {sbd && (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-accent-cyan">
          <span className="w-2.5 h-2.5 rounded-full bg-accent-cyan shrink-0" />
          Accumulation
        </span>
      )}
      {syd && (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-risk-red">
          <span className="w-2.5 h-2.5 rounded-full bg-risk-red shrink-0" />
          Distribution
        </span>
      )}
    </div>
  );
}

// ── Metric Pill ───────────────────────────────────────────────

function MetricPill({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-kd-bg/40 rounded-lg px-2 py-1.5 border border-kd-border min-w-[56px]">
      <p className="text-[9px] text-muted uppercase tracking-wider leading-none mb-0.5">{label}</p>
      <p className={cn('text-xs font-bold font-mono leading-none', color ?? 'text-[var(--text-primary)]')}>{value}</p>
    </div>
  );
}

// ── Stock Card ────────────────────────────────────────────────

function StockCard({ stock }: { stock: ScanStock }) {
  const zoneConfig = ZONE_LABELS[stock.magic_rs_zone ?? ''] ?? { label: '—', color: 'text-muted' };
  const flowConfig = FLOW_LABELS[stock.flow_type ?? ''];

  return (
    <div className="bg-kd-bg/40 border border-kd-border rounded-xl p-3 sm:p-4 hover:border-kd-border-active transition-colors">
      {/* Row 1: Symbol + Company + Price + Change */}
      <div className="flex items-start justify-between mb-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm sm:text-base font-bold text-accent-indigo font-mono">{stock.symbol}</span>
            <ExchangeBadge exchange={stock.exchange} />
            {flowConfig && (
              <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', flowConfig.color, 'bg-kd-elevated/30')}>
                {flowConfig.label}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted truncate">
            {stock.company_name ?? '—'}{stock.industry ? ` · ${stock.industry}` : ''}
          </p>
        </div>
        <div className="text-right shrink-0 ml-3">
          <p className="text-sm sm:text-base font-bold font-mono text-[var(--text-primary)]">
            {stock.close.toFixed(2)}
          </p>
          <p className={cn(
            'text-xs font-bold font-mono',
            (stock.pct_chng ?? 0) >= 0 ? 'text-risk-green' : 'text-risk-red',
          )}>
            {(stock.pct_chng ?? 0) >= 0 ? '+' : ''}{(stock.pct_chng ?? 0).toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Row 2: Metric pills */}
      <div className="flex gap-1.5 flex-wrap mb-2.5">
        <MetricPill
          label="Magic RS"
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
      </div>

      {/* Row 3: Signal dots */}
      <SignalDots svd={stock.has_recent_svd} sbd={stock.has_recent_sbd} syd={stock.has_recent_syd} />
    </div>
  );
}

// ── Sort Controls ─────────────────────────────────────────────

type SortKey = 'symbol' | 'pct_chng' | 'magic_rs' | 'rsi_14' | 'rss_value' | 'rvol';
type SortDir = 'asc' | 'desc';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'magic_rs',  label: 'Magic RS' },
  { key: 'rsi_14',    label: 'RSI' },
  { key: 'rss_value', label: 'RSS' },
  { key: 'rvol',      label: 'RVOL' },
  { key: 'pct_chng',  label: '% Chg' },
  { key: 'symbol',    label: 'Symbol' },
];

function SortBar({
  sortKey,
  sortDir,
  onSort,
}: {
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
      <span className="text-[10px] text-muted uppercase tracking-wider shrink-0 mr-1">Sort</span>
      {SORT_OPTIONS.map((opt) => {
        const active = sortKey === opt.key;
        return (
          <button
            key={opt.key}
            onClick={() => onSort(opt.key)}
            className={cn(
              'inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-bold transition-all border whitespace-nowrap',
              active
                ? 'bg-accent-indigo/15 text-accent-indigo border-accent-indigo/30'
                : 'text-muted border-transparent hover:text-[var(--text-secondary)]',
            )}
          >
            {opt.label}
            {active && (sortDir === 'asc'
              ? <ArrowUp className="w-2.5 h-2.5" />
              : <ArrowDown className="w-2.5 h-2.5" />
            )}
            {!active && <ArrowUpDown className="w-2.5 h-2.5 opacity-30" />}
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
  const [sortKey, setSortKey] = useState<SortKey>('magic_rs');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const { data: stocks, isLoading, error } = useScan(activeScan, exchangeFilter);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sorted = useMemo(() => {
    if (!stocks) return [];
    const arr = [...stocks];
    arr.sort((a, b) => {
      let va: string | number = 0;
      let vb: string | number = 0;

      switch (sortKey) {
        case 'symbol':    va = a.symbol; vb = b.symbol; break;
        case 'pct_chng':  va = a.pct_chng ?? 0; vb = b.pct_chng ?? 0; break;
        case 'magic_rs':  va = a.magic_rs ?? 0; vb = b.magic_rs ?? 0; break;
        case 'rsi_14':    va = a.rsi_14 ?? 0; vb = b.rsi_14 ?? 0; break;
        case 'rss_value': va = a.rss_value ?? 0; vb = b.rss_value ?? 0; break;
        case 'rvol':      va = a.rvol ?? 0; vb = b.rvol ?? 0; break;
      }

      if (typeof va === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      }
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return arr;
  }, [stocks, sortKey, sortDir]);

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
            title={scan.tooltip}
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

      {/* Description + Exchange Tabs */}
      <div className="flex items-center justify-between mb-3">
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

      {/* Sort Controls */}
      {stocks && stocks.length > 0 && (
        <div className="mb-3">
          <SortBar sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
        </div>
      )}

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-accent-indigo mr-2" />
          <span className="text-sm text-muted">Scanning market...</span>
        </div>
      ) : error ? (
        <Card rounded="xxl" className="py-12 text-center">
          <p className="text-xs text-risk-red">Failed to run scan. Check data connection.</p>
        </Card>
      ) : sorted.length > 0 ? (
        <>
          <div className="space-y-2">
            {sorted.map((stock) => (
              <StockCard key={stock.equity_id} stock={stock} />
            ))}
          </div>
          {/* Count */}
          <div className="mt-3 text-center">
            <span className="text-[10px] text-muted font-mono">
              {sorted.length} result{sorted.length !== 1 ? 's' : ''}
            </span>
          </div>
        </>
      ) : (
        <Card rounded="xxl" className="py-16 text-center">
          <p className="text-sm text-muted">No stocks match this scan criteria</p>
          <p className="text-xs text-muted mt-1">Try a different scan or check data availability</p>
        </Card>
      )}
    </div>
  );
}
