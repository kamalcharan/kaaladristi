import { useQuery } from '@tanstack/react-query';
import { Loader2, Activity, TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';

// ── Flow badge config ────────────────────────────────────────────────────────

const FLOW_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  FRESH_LONGS:       { label: 'Fresh Longs',       color: 'text-risk-green',    bg: 'bg-risk-green/10',    border: 'border-risk-green/30' },
  SHORT_COVERING:    { label: 'Short Covering',    color: 'text-risk-amber',    bg: 'bg-risk-amber/10',    border: 'border-risk-amber/30' },
  FRESH_SHORTS:      { label: 'Fresh Shorts',      color: 'text-risk-red',      bg: 'bg-risk-red/10',      border: 'border-risk-red/30' },
  LONG_LIQUIDATION:  { label: 'Long Liquidation',  color: 'text-risk-red/80',   bg: 'bg-risk-red/10',      border: 'border-risk-red/30'    },
  MIXED:             { label: 'Mixed',             color: 'text-[var(--text-muted)]', bg: 'bg-kd-elevated',  border: 'border-kd-border'      },
  LOW_VOLUME:        { label: 'Low Volume',        color: 'text-[var(--text-muted)]', bg: 'bg-kd-elevated',  border: 'border-kd-border'      },
};

function FlowBadge({ flow }: { flow: string | null }) {
  const cfg = FLOW_CONFIG[flow ?? ''] ?? FLOW_CONFIG.MIXED;
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border',
      cfg.color, cfg.bg, cfg.border,
    )}>
      {cfg.label}
    </span>
  );
}

// ── Participation label ──────────────────────────────────────────────────────

function ParticipationLabel({ profile }: { profile: string }) {
  const config: Record<string, { label: string; color: string }> = {
    'institution-heavy':   { label: 'Inst',  color: 'text-risk-red' },
    'institution-leaning': { label: 'Inst',  color: 'text-risk-red/70' },
    'hot-money-driven':    { label: 'Hot$',  color: 'text-risk-amber' },
    'hot-money-leaning':   { label: 'Hot$',  color: 'text-risk-amber/70' },
    'balanced':            { label: 'Bal',   color: 'text-[var(--text-muted)]' },
    'unknown':             { label: '—',     color: 'text-[var(--text-muted)]' },
  };
  const c = config[profile] ?? config.unknown;
  return <span className={cn('text-[9px] font-bold uppercase tracking-wider', c.color)}>{c.label}</span>;
}

// ── Astro config ─────────────────────────────────────────────────────────────

const ASTRO_CONFIG: Record<string, { dot: string; label: string }> = {
  favorable: { dot: 'bg-risk-green',  label: 'Favorable' },
  adverse:   { dot: 'bg-risk-red',    label: 'Adverse' },
  neutral:   { dot: 'bg-risk-amber',  label: 'Neutral' },
  no_event:  { dot: 'bg-slate-500',   label: 'No Event' },
};

// ── Index row ────────────────────────────────────────────────────────────────

interface IndexSummary {
  name: string;
  close: number;
  change_pct: number;
  flow_type: string | null;
  participation: string;
  magic_rs_zone: string | null;
  rvol: number | null;
}

function IndexRow({ idx }: { idx: IndexSummary }) {
  const isUp = idx.change_pct >= 0;
  const shortName = idx.name.replace('NIFTY ', '').replace('Nifty ', '');

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-kd-elevated/40 transition-colors">
      <div className="w-20 shrink-0">
        <div className="text-[10px] font-bold text-accent-indigo uppercase tracking-wider truncate">{shortName}</div>
        <div className="text-[12px] font-bold mono text-[var(--text-primary)]">
          {idx.close.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </div>
      </div>

      <div className={cn('w-14 text-[11px] font-bold mono flex items-center gap-0.5',
        isUp ? 'text-risk-green' : 'text-risk-red'
      )}>
        {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {idx.change_pct >= 0 ? '+' : ''}{idx.change_pct.toFixed(1)}%
      </div>

      <div className="flex-1 min-w-0">
        <FlowBadge flow={idx.flow_type} />
      </div>

      <div className="w-10 text-center">
        <ParticipationLabel profile={idx.participation} />
      </div>

      <div className="w-16 text-right">
        {idx.magic_rs_zone ? (
          <span className={cn('text-[9px] font-bold uppercase',
            idx.magic_rs_zone.includes('Bull') ? 'text-risk-green' :
            idx.magic_rs_zone.includes('Bear') ? 'text-risk-red' :
            'text-[var(--text-muted)]'
          )}>
            {idx.magic_rs_zone}
          </span>
        ) : (
          <span className="text-[9px] text-muted">—</span>
        )}
      </div>
    </div>
  );
}

// ── Context hook ─────────────────────────────────────────────────────────────

interface MarketPulseContext {
  indexes: IndexSummary[];
  astro: { direction: string; day_score: number };
}

function useMarketPulseContext(date?: string) {
  const pipelineUrl = (import.meta.env.VITE_PIPELINE_API_URL as string) ?? 'http://localhost:8101';
  return useQuery({
    queryKey: ['market_pulse_ctx', date],
    queryFn: async (): Promise<MarketPulseContext | null> => {
      const params = date ? `?date=${encodeURIComponent(date)}` : '';
      const res = await fetch(`${pipelineUrl}/api/context/market-pulse${params}`);
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

// ── Main Component ───────────────────────────────────────────────────────────

interface MarketPulseCardProps {
  date?: string;
}

export default function MarketPulseCard({ date }: MarketPulseCardProps) {
  const { data: ctx, isLoading: ctxLoading } = useMarketPulseContext(date);
  const indexes = ctx?.indexes ?? [];
  const astroDir = ctx?.astro?.direction ?? 'no_event';
  const astroCfg = ASTRO_CONFIG[astroDir] ?? ASTRO_CONFIG.no_event;

  if (ctxLoading && indexes.length === 0) {
    return (
      <Card rounded="xxl" className="p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-accent-indigo" />
          <h3 className="text-[13px] font-bold text-[var(--text-primary)]">Market Pulse</h3>
        </div>
        <div className="flex items-center justify-center py-8 text-muted gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs">Loading market pulse...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card rounded="xxl" className="p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent-indigo" />
          <h3 className="text-[13px] font-bold text-[var(--text-primary)]">Market Pulse</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('w-2 h-2 rounded-full', astroCfg.dot)} />
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted">
            Cycle: {astroCfg.label}
          </span>
        </div>
      </div>

      {indexes.length > 0 && (
        <>
          <div className="flex items-center gap-3 px-3 mb-1 text-[8px] font-bold uppercase tracking-widest text-muted">
            <div className="w-20">Index</div>
            <div className="w-14">Chg</div>
            <div className="flex-1">Flow</div>
            <div className="w-10 text-center">Part</div>
            <div className="w-16 text-right">RS</div>
          </div>
          <div className="divide-y divide-kd-border/50">
            {indexes.map(idx => <IndexRow key={idx.name} idx={idx} />)}
          </div>
        </>
      )}

      {indexes.length === 0 && !ctxLoading && (
        <div className="text-center py-6 text-xs text-muted">No index data available</div>
      )}

    </Card>
  );
}
