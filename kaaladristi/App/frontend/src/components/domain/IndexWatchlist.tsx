/**
 * IndexWatchlist — Enriched index tiles with correlation badge
 * =============================================================
 * Shows NIFTY 50, BANKNIFTY, NIFTY IT, NIFTY PHARMA as tiles
 * with price, change%, RSS zone, flow type chips.
 * Fetches latest EOD row per index for live signal data.
 */

import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui';
import { from } from '@/services/postgrest';
import { computeRssSignals, computePulseSnapshot, computeAstroScore, getCorrelationState, type PulseBar, type CorrelationState } from '@/services/visualPulseEngine';

// ── Config ──

const WATCHLIST_INDEXES = [
  { name: 'NIFTY 50', short: 'NIFTY 50' },
  { name: 'NIFTY BANK', short: 'BANKNIFTY' },
  { name: 'NIFTY IT', short: 'NIFTY IT' },
  { name: 'NIFTY PHARMA', short: 'NIFTY PHARMA' },
];

const PULSE_COLS = [
  'trade_date', 'open', 'high', 'low', 'close', 'volume',
  'rvol', 'tvol', 'rsi_14', 'mfi_14',
  'rss_value', 'rss_spread', 'sma_150',
  'sniper_inst', 'sniper_hot',
  'flow_type', 'vacuum_flag', 'volume_divergence_flag',
  'accum_distrib', 'magic_rs', 'magic_ma', 'magic_rs_zone',
].join(',');

interface IndexTileData {
  index_id: number;
  name: string;
  shortName: string;
  close: number;
  prev_close: number;
  pct_chng: number;
  rssValue: number | null;
  rssZone: string;
  flowType: string | null;
  corrState: CorrelationState;
}

// ── Fetch ──

async function fetchWatchlistData(): Promise<IndexTileData[]> {
  // 1. Get index IDs
  const { data: symData } = await from('km_index_symbols')
    .select('id,name')
    .in('name', WATCHLIST_INDEXES.map((w) => w.name))
    .execute();

  if (!symData || symData.length === 0) return [];

  const indexMap = new Map<number, { name: string; shortName: string }>();
  for (const s of symData as { id: number; name: string }[]) {
    const config = WATCHLIST_INDEXES.find((w) => w.name === s.name);
    if (config) indexMap.set(s.id, { name: s.name, shortName: config.short });
  }

  // 2. Fetch last 6 bars per index for RSS computation
  const ids = [...indexMap.keys()];
  const results: IndexTileData[] = [];

  for (const indexId of ids) {
    const { data: barData } = await from('km_index_eod')
      .select(PULSE_COLS + ',prev_close,pct_chng')
      .eq('index_id', indexId)
      .order('trade_date', { ascending: false })
      .limit(6)
      .execute();

    if (!barData || barData.length === 0) continue;

    const bars = (barData as (PulseBar & { prev_close: number | null; pct_chng: number | null })[]).reverse();
    const latest = bars[bars.length - 1];
    const idx = bars.length - 1;

    // Compute RSS
    const rss = computeRssSignals(bars, idx);

    // Simple correlation state from RSS + flow
    const corrState = deriveQuickCorrelation(latest, rss.zone);

    const meta = indexMap.get(indexId)!;
    results.push({
      index_id: indexId,
      name: meta.name,
      shortName: meta.shortName,
      close: latest.close,
      prev_close: latest.prev_close ?? latest.open,
      pct_chng: latest.pct_chng ?? 0,
      rssValue: rss.value,
      rssZone: rss.zone,
      flowType: latest.flow_type,
      corrState,
    });
  }

  // Sort by WATCHLIST_INDEXES order
  results.sort((a, b) => {
    const ai = WATCHLIST_INDEXES.findIndex((w) => w.name === a.name);
    const bi = WATCHLIST_INDEXES.findIndex((w) => w.name === b.name);
    return ai - bi;
  });

  return results;
}

function deriveQuickCorrelation(bar: PulseBar, rssZone: string): CorrelationState {
  let score = 0;
  // Flow
  if (bar.flow_type === 'FRESH_LONGS') score += 3;
  else if (bar.flow_type === 'SHORT_COVERING') score += 1;
  else if (bar.flow_type === 'FRESH_SHORTS') score -= 3;
  else if (bar.flow_type === 'LONG_LIQUIDATION') score -= 2;
  // RSS zone
  if (rssZone === 'OVERBOUGHT' || rssZone === 'BULLISH') score += 2;
  else if (rssZone === 'OVERSOLD' || rssZone === 'BEARISH') score -= 2;
  // Volume
  if ((bar.rvol ?? 0) > 2) score += 1;
  // Accumulation
  if (bar.accum_distrib === 'ACCUMULATION') score += 2;
  else if (bar.accum_distrib === 'DISTRIBUTION') score -= 2;

  return getCorrelationState(score, 'Balanced');
}

// ── Flow label mapping ──

const FLOW_SHORT: Record<string, { label: string; color: string }> = {
  FRESH_LONGS:      { label: 'Fresh Longs',    color: 'text-risk-green' },
  FRESH_SHORTS:     { label: 'Fresh Shorts',   color: 'text-risk-red' },
  SHORT_COVERING:   { label: 'Short Cover',    color: 'text-risk-amber' },
  LONG_LIQUIDATION: { label: 'Long Liq',       color: 'text-risk-red/80' },
  LOW_VOLUME:       { label: 'Low Vol',         color: 'text-muted' },
  MIXED:            { label: 'Mixed',           color: 'text-muted' },
};

const RSS_ZONE_COLOR: Record<string, string> = {
  OVERBOUGHT: 'text-risk-green',
  BULLISH:    'text-risk-green/80',
  NEUTRAL:    'text-muted',
  BEARISH:    'text-risk-red/80',
  OVERSOLD:   'text-risk-red',
};

const CORR_BADGE: Record<string, { bg: string; text: string }> = {
  Aligned:     { bg: 'bg-risk-green/15 border-risk-green/30', text: 'text-risk-green' },
  Converging:  { bg: 'bg-accent-gold/15 border-accent-gold/30', text: 'text-accent-gold' },
  Watch:       { bg: 'bg-accent-indigo/15 border-accent-indigo/30', text: 'text-accent-indigo' },
  Neutral:     { bg: 'bg-kd-elevated border-kd-border', text: 'text-muted' },
  Conflicting: { bg: 'bg-risk-red/15 border-risk-red/30', text: 'text-risk-red' },
};

// ── Tile Component ──

function IndexTile({ tile }: { tile: IndexTileData }) {
  const navigate = useNavigate();
  const positive = tile.pct_chng >= 0;
  const flow = FLOW_SHORT[tile.flowType ?? ''];
  const rssColor = RSS_ZONE_COLOR[tile.rssZone] ?? 'text-muted';
  const badge = CORR_BADGE[tile.corrState.state] ?? CORR_BADGE.Neutral;

  return (
    <Card
      rounded="xxl"
      hover="lift"
      className="px-4 py-3 cursor-pointer flex-1 min-w-[180px]"
      onClick={() => navigate(`/chart/index/${tile.index_id}?name=${encodeURIComponent(tile.name)}`)}
    >
      {/* Row 1: Name + Badge */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-bold text-primary uppercase tracking-wide">{tile.shortName}</span>
        <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider', badge.bg, badge.text)}>
          {tile.corrState.state}
        </span>
      </div>

      {/* Row 2: Price + Change */}
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-lg font-bold font-mono text-primary leading-none">
          {tile.close.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
      <div className="flex items-center gap-1.5 mb-2">
        <span className={cn('text-[11px] font-bold font-mono', positive ? 'text-risk-green' : 'text-risk-red')}>
          {positive ? '\u25B2' : '\u25BC'} {positive ? '+' : ''}{tile.pct_chng.toFixed(2)}%
        </span>
      </div>

      {/* Row 3: Signal chips */}
      <div className="flex items-center gap-2 flex-wrap text-[9px] font-mono">
        {tile.rssValue != null && (
          <span className={cn('font-bold', rssColor)}>
            RSS {tile.rssValue.toFixed(0)}
          </span>
        )}
        {tile.rssZone && tile.rssZone !== 'NEUTRAL' && (
          <span className={cn('font-bold', rssColor)}>
            {tile.rssZone === 'OVERBOUGHT' ? 'Overbought' : tile.rssZone === 'OVERSOLD' ? 'Oversold' : tile.rssZone === 'BULLISH' ? 'Bullish' : 'Bearish'}
          </span>
        )}
        {flow && (
          <>
            <span className="text-muted">&middot;</span>
            <span className={cn('font-bold', flow.color)}>{flow.label}</span>
          </>
        )}
      </div>
    </Card>
  );
}

// ── Main Component ──

export default function IndexWatchlist() {
  const { data: tiles, isLoading } = useQuery({
    queryKey: ['index-watchlist'],
    queryFn: fetchWatchlistData,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div>
      <p className="text-[10px] font-bold text-muted uppercase tracking-[0.2em] mb-2">
        Indices &middot; Watchlist
      </p>
      {isLoading ? (
        <div className="flex gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-1 h-[100px] bg-kd-elevated/40 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : tiles && tiles.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto no-scrollbar">
          {tiles.map((tile) => (
            <IndexTile key={tile.index_id} tile={tile} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted">No index data available</p>
      )}
    </div>
  );
}
