/**
 * Shared Stock Card Components
 * ============================
 * Reusable card components for displaying stock data across
 * Scanner, Industry Transition, and Manipulation Watch.
 */

import { cn } from '@/lib/utils';
import { Card } from '@/components/ui';
import type { ScanStock } from '@/types';

// ── Vocabulary mapping (KaalaDristi language) ──────────────────

export const ZONE_LABELS: Record<string, { label: string; color: string }> = {
  'Strong Bull': { label: 'Strong Bull', color: 'text-risk-green' },
  'Mild Bull':   { label: 'Mild Bull',   color: 'text-risk-green/70' },
  'Neutral':     { label: 'Neutral',     color: 'text-muted' },
  'Mild Bear':   { label: 'Mild Bear',   color: 'text-risk-red/70' },
  'Strong Bear': { label: 'Strong Bear', color: 'text-risk-red' },
};

export const FLOW_LABELS: Record<string, { label: string; color: string }> = {
  FRESH_LONGS:      { label: 'Fresh Longs',      color: 'text-risk-green' },
  FRESH_SHORTS:     { label: 'Fresh Shorts',     color: 'text-risk-red' },
  SHORT_COVERING:   { label: 'Short Covering',   color: 'text-risk-amber' },
  LONG_LIQUIDATION: { label: 'Liquidation',      color: 'text-risk-red/80' },
  LOW_VOLUME:       { label: 'Low Volume',        color: 'text-muted' },
  MIXED:            { label: 'Mixed',             color: 'text-muted' },
};

// ── Exchange Badge ────────────────────────────────────────────

export function ExchangeBadge({ exchange }: { exchange: string | null }) {
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

export function SignalDots({ svd, sbd, syd }: { svd: boolean; sbd: boolean; syd: boolean }) {
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

export function MetricPill({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-kd-bg/40 rounded-lg px-2 py-1.5 border border-kd-border min-w-[56px]">
      <p className="text-[9px] text-muted uppercase tracking-wider leading-none mb-0.5">{label}</p>
      <p className={cn('text-xs font-bold font-mono leading-none', color ?? 'text-[var(--text-primary)]')}>{value}</p>
    </div>
  );
}

// ── Stock Card ────────────────────────────────────────────────

export function StockCard({ stock }: { stock: ScanStock }) {
  const zoneConfig = ZONE_LABELS[stock.magic_rs_zone ?? ''] ?? { label: '—', color: 'text-muted' };
  const flowConfig = FLOW_LABELS[stock.flow_type ?? ''];

  const isNumericSymbol = /^\d+$/.test(stock.symbol);
  const heroName = isNumericSymbol ? (stock.company_name ?? stock.symbol) : stock.symbol;
  const subName = isNumericSymbol ? null : stock.company_name;

  return (
    <Card rounded="xxl" hover="lift" className="p-3 sm:p-4">
      {/* Row 1: Script name + Price */}
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-bold text-accent-indigo font-mono truncate">{heroName}</span>
            <ExchangeBadge exchange={stock.exchange} />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {subName && (
              <span className="text-[10px] text-muted truncate">{subName}</span>
            )}
            {subName && stock.industry && <span className="text-[10px] text-muted">·</span>}
            {stock.industry && (
              <span className="text-[10px] text-muted">{stock.industry}</span>
            )}
            {flowConfig && (
              <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded', flowConfig.color, 'bg-kd-elevated/50')}>
                {flowConfig.label}
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0 ml-3">
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
      </div>

      {/* Row 2: Metrics + Signals inline */}
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
