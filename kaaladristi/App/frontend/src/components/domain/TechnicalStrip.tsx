/**
 * TechnicalStrip — Horizontal bar of key technical indicators.
 *
 * Displays available data from the snapshot (market stats, volume) and
 * shows clear "—" placeholders for indicators that need a backend
 * data source (RSI, MFI, RVOL, TVOL, OBV, MagicRS).
 *
 * Inspired by the LuckyPop indicator's recommendation table.
 */

import { cn } from '@/lib/utils';
import type { SnapshotMarket } from '@/types';

interface TechnicalStripProps {
  market: SnapshotMarket | null;
}

interface IndicatorCellProps {
  label: string;
  value: string | number | null;
  status?: 'bullish' | 'bearish' | 'neutral' | 'unavailable';
  tooltip?: string;
}

function getStatusColor(status: IndicatorCellProps['status']): string {
  switch (status) {
    case 'bullish':     return 'text-risk-green';
    case 'bearish':     return 'text-risk-red';
    case 'neutral':     return 'text-risk-amber';
    case 'unavailable': return 'text-slate-600';
    default:            return 'text-slate-400';
  }
}

function getStatusDot(status: IndicatorCellProps['status']): string {
  switch (status) {
    case 'bullish':     return 'bg-risk-green';
    case 'bearish':     return 'bg-risk-red';
    case 'neutral':     return 'bg-risk-amber';
    case 'unavailable': return 'bg-slate-700';
    default:            return 'bg-slate-600';
  }
}

function IndicatorCell({ label, value, status = 'unavailable' }: IndicatorCellProps) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-3 py-2.5 min-w-[80px]">
      <div className="flex items-center gap-1.5">
        <div className={cn('w-1.5 h-1.5 rounded-full', getStatusDot(status))} />
        <span className="text-[10px] font-bold text-muted uppercase tracking-wider">{label}</span>
      </div>
      <span className={cn('text-sm font-bold mono', getStatusColor(status))}>
        {value ?? '—'}
      </span>
    </div>
  );
}

function formatVolume(vol: number | null | undefined): string {
  if (vol == null) return '—';
  if (vol >= 1e9) return `${(vol / 1e9).toFixed(1)}B`;
  if (vol >= 1e6) return `${(vol / 1e6).toFixed(1)}M`;
  if (vol >= 1e3) return `${(vol / 1e3).toFixed(0)}K`;
  return vol.toString();
}

export default function TechnicalStrip({ market }: TechnicalStripProps) {
  // Derive what we can from market data
  const volume = market?.volume;
  const dayRange = market && market.high != null && market.low != null
    ? ((market.high - market.low) / (market.low || 1) * 100).toFixed(2) + '%'
    : null;
  const changeStatus: IndicatorCellProps['status'] =
    market?.pct_change != null
      ? market.pct_change > 0 ? 'bullish' : market.pct_change < 0 ? 'bearish' : 'neutral'
      : 'unavailable';

  return (
    <div className="glass-card rounded-2xl border border-kd-border overflow-hidden">
      <div className="flex items-stretch divide-x divide-white/5 overflow-x-auto no-scrollbar">
        {/* Available from market data */}
        <IndicatorCell
          label="Volume"
          value={formatVolume(volume)}
          status={volume ? 'neutral' : 'unavailable'}
        />
        <IndicatorCell
          label="Day Range"
          value={dayRange}
          status={dayRange ? 'neutral' : 'unavailable'}
        />
        <IndicatorCell
          label="Change"
          value={market?.pct_change != null ? `${market.pct_change > 0 ? '+' : ''}${market.pct_change.toFixed(2)}%` : null}
          status={changeStatus}
        />

        {/* Separator */}
        <div className="w-px bg-white/10 self-stretch" />

        {/* Technical indicators — need backend data source */}
        <IndicatorCell label="RSI" value={null} status="unavailable" />
        <IndicatorCell label="MFI" value={null} status="unavailable" />
        <IndicatorCell label="RVOL" value={null} status="unavailable" />
        <IndicatorCell label="TVOL" value={null} status="unavailable" />
        <IndicatorCell label="OBV" value={null} status="unavailable" />
        <IndicatorCell label="MagicRS" value={null} status="unavailable" />
      </div>
    </div>
  );
}
