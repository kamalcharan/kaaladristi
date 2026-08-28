/**
 * MagicRsLeaderboard — Top 10 Strongest / Bottom 10 Weakest by MagicRS
 * ======================================================================
 * Two side-by-side panels showing strongest and weakest equities
 * by magic_rs value. Each row: rank, symbol, zone badge, RS value,
 * flow label, RVOL.
 *
 * Clickable rows → /chart/equity/:id
 */

import { ACTIVE_UNIVERSE_CAP } from '@/services/equityUniverse';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { displaySymbol, navName as toNavName, bseTooltip } from '@/lib/symbolUtils';
import { Card } from '@/components/ui';
import { from } from '@/services/postgrest';
import { usePipelineStatus } from '@/hooks/usePipelineStatus';

// ── Types ──

interface LeaderboardStock {
  equity_id: number;
  symbol: string;
  company_name: string | null;
  exchange: string | null;
  magic_rs: number;
  magic_rs_zone: string | null;
  flow_type: string | null;
  rvol: number | null;
}

// ── Data fetching ──

async function fetchLeaderboard(): Promise<{ top: LeaderboardStock[]; bottom: LeaderboardStock[] }> {
  // Gate on ema_20 (indicator-complete), not just latest row — during the
  // daily pipeline window the raw-latest trade_date has prices but magic_rs
  // still computing for most stocks; ranking that date produces a partial,
  // arrival-order-biased leaderboard rather than an empty/stale-safe one.
  const { data: dateData } = await from('km_equity_eod')
    .select('trade_date')
    .notNull('ema_20')
    .order('trade_date', { ascending: false })
    .limit(1)
    .execute();

  if (!dateData || dateData.length === 0) return { top: [], bottom: [] };
  const latestDate = (dateData[0] as { trade_date: string }).trade_date;

  // Fetch top 10 and bottom 10 in parallel
  // Fetch top and bottom by magic_rs — overfetch to filter nulls/BSE dupes client-side
  const [topRes, bottomRes, symRes] = await Promise.all([
    from('km_equity_eod')
      .select('equity_id,magic_rs,magic_rs_zone,flow_type,rvol')
      .eq('trade_date', latestDate)
      .order('magic_rs', { ascending: false })
      .limit(40)
      .execute(),

    from('km_equity_eod')
      .select('equity_id,magic_rs,magic_rs_zone,flow_type,rvol')
      .eq('trade_date', latestDate)
      .order('magic_rs', { ascending: true })
      .limit(40)
      .execute(),

    from('km_equity_symbols')
      .select('id,symbol,company_name,exchange')
      .is('is_active', 'true')
      .limit(ACTIVE_UNIVERSE_CAP)
      .execute(),
  ]);

  const symbols = new Map<number, { symbol: string; company_name: string | null; exchange: string | null }>();
  for (const s of (symRes.data ?? []) as { id: number; symbol: string; company_name: string | null; exchange: string | null }[]) {
    symbols.set(s.id, s);
  }

  interface EodRow { equity_id: number; magic_rs: number | null; magic_rs_zone: string | null; flow_type: string | null; rvol: number | null }

  const mapRow = (r: EodRow): LeaderboardStock | null => {
    if (r.magic_rs == null) return null;
    const sym = symbols.get(r.equity_id);
    if (!sym) return null;
    // Skip BSE numeric codes — prefer NSE listing
    if (sym.exchange === 'BSE' && /^\d+$/.test(sym.symbol)) return null;
    return {
      equity_id: r.equity_id,
      symbol: sym.symbol,
      company_name: sym.company_name,
      exchange: sym.exchange ?? null,
      magic_rs: r.magic_rs,
      magic_rs_zone: r.magic_rs_zone,
      flow_type: r.flow_type,
      rvol: r.rvol,
    };
  };

  const top = ((topRes.data ?? []) as EodRow[]).map(mapRow).filter((r): r is LeaderboardStock => r != null).slice(0, 10);
  const bottom = ((bottomRes.data ?? []) as EodRow[]).map(mapRow).filter((r): r is LeaderboardStock => r != null).slice(0, 10);

  return { top, bottom };
}

// ── Zone badge ──

// Labels are the D39-neutral vocabulary (see signalScale ZONE_LABELS); only the
// badge color classes are component-local.
const ZONE_BADGE: Record<string, { label: string; color: string }> = {
  'Strong Bull':  { label: 'LEADING',   color: 'text-risk-green bg-risk-green/15 border-risk-green/30' },
  'Mild Bull':    { label: 'IMPROVING', color: 'text-risk-green/80 bg-risk-green/10 border-risk-green/20' },
  'Neutral Bull': { label: 'NEUTRAL',   color: 'text-risk-green/60 bg-risk-green/5 border-risk-green/15' },
  'Neutral':      { label: 'NEUTRAL',   color: 'text-muted bg-kd-elevated border-kd-border' },
  'Neutral Bear': { label: 'NEUTRAL',   color: 'text-risk-red/60 bg-risk-red/5 border-risk-red/15' },
  'Mild Bear':    { label: 'WEAKENING', color: 'text-risk-red/80 bg-risk-red/10 border-risk-red/20' },
  'Strong Bear':  { label: 'LAGGING',   color: 'text-risk-red bg-risk-red/15 border-risk-red/30' },
};

const FLOW_SHORT: Record<string, { label: string; color: string }> = {
  FRESH_LONGS:      { label: 'Fresh Longs',  color: 'text-risk-green' },
  FRESH_SHORTS:     { label: 'Fresh Shorts', color: 'text-risk-red' },
  SHORT_COVERING:   { label: 'Short Cover',  color: 'text-risk-amber' },
  LONG_LIQUIDATION: { label: 'Long Liq',     color: 'text-risk-red/80' },
  LOW_VOLUME:       { label: 'Low Vol',       color: 'text-muted' },
  MIXED:            { label: 'Mixed',         color: 'text-muted' },
};

// ── Row ──

function LeaderboardRow({ stock, rank, side }: { stock: LeaderboardStock; rank: number; side: 'top' | 'bottom' }) {
  const navigate = useNavigate();
  const zone = ZONE_BADGE[stock.magic_rs_zone ?? ''] ?? ZONE_BADGE.Neutral;
  const flow = FLOW_SHORT[stock.flow_type ?? ''];
  const rsColor = side === 'top' ? 'text-risk-green' : 'text-risk-red';
  const heroName = displaySymbol(stock);
  const tooltip = bseTooltip(stock);

  return (
    <button
      title={tooltip ?? undefined}
      onClick={() => navigate(`/chart/equity/${stock.equity_id}?name=${encodeURIComponent(toNavName(stock))}`)}
      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-kd-elevated/40 transition-colors text-left border-b border-kd-border/30 last:border-b-0"
    >
      <span className="text-[10px] font-mono text-muted w-5 text-right shrink-0">{rank}</span>
      <span className="text-xs font-bold font-mono text-primary truncate min-w-[70px] max-w-[100px]">
        {heroName}
      </span>
      <span className={cn('text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0', zone.color)}>
        {zone.label}
      </span>
      <span className="flex-1" />
      <span className={cn('text-xs font-bold font-mono shrink-0', rsColor)}>
        {stock.magic_rs >= 0 ? '+' : ''}{stock.magic_rs.toFixed(1)}
      </span>
      {flow && (
        <span className={cn('text-[9px] font-mono shrink-0 hidden sm:inline', flow.color)}>
          {flow.label}
        </span>
      )}
      {stock.rvol != null && stock.rvol > 0 && (
        <span className="text-[9px] font-mono text-muted shrink-0 w-8 text-right hidden sm:inline">
          {stock.rvol.toFixed(1)}x
        </span>
      )}
    </button>
  );
}

// ── Panel ──

function LeaderboardPanel({
  title,
  subtitle,
  subtitleColor,
  stocks,
  side,
}: {
  title: string;
  subtitle: string;
  subtitleColor: string;
  stocks: LeaderboardStock[];
  side: 'top' | 'bottom';
}) {
  return (
    <Card rounded="xxl" className="overflow-hidden flex-1 min-w-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-kd-border">
        <h3 className="text-[10px] font-bold text-muted uppercase tracking-[0.15em]">
          {title}
        </h3>
        <span className={cn('text-[9px] font-mono italic', subtitleColor)}>
          {subtitle}
        </span>
      </div>
      {stocks.length > 0 ? (
        <div>
          {stocks.map((stock, i) => (
            <LeaderboardRow key={stock.equity_id} stock={stock} rank={i + 1} side={side} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted text-center py-8">No data available</p>
      )}
    </Card>
  );
}

// ── Main ──

export default function MagicRsLeaderboard() {
  // Dashboard widget, commonly mounted for hours — same fix as
  // hooks/useScan.ts, so a day change refetches automatically.
  const { latestDataDate } = usePipelineStatus();
  const { data, isLoading } = useQuery({
    queryKey: ['magic-rs-leaderboard', latestDataDate ?? 'unknown'],
    queryFn: fetchLeaderboard,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-[400px] bg-kd-elevated/40 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <LeaderboardPanel
        title="Top 10 · Strongest MagicRS"
        subtitle="Outperforming CNX500"
        subtitleColor="text-risk-green"
        stocks={data?.top ?? []}
        side="top"
      />
      <LeaderboardPanel
        title="Bottom 10 · Weakest MagicRS"
        subtitle="Underperforming CNX500"
        subtitleColor="text-risk-red"
        stocks={data?.bottom ?? []}
        side="bottom"
      />
    </div>
  );
}
