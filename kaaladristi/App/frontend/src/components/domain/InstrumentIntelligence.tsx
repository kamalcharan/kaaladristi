import { useQuery } from '@tanstack/react-query';
import { Loader2, Zap, Users, BarChart3, Gauge, Activity, AlertTriangle } from 'lucide-react';
import { useInstrumentInsight } from '@/hooks';
import VaNiInsight from './VaNiInsight';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';

// ── Flow config ──────────────────────────────────────────────────────────────

const FLOW_STYLES: Record<string, { label: string; meaning: string; color: string; bg: string; border: string }> = {
  FRESH_LONGS:       { label: 'Fresh Longs',       meaning: 'Institutional buying conviction',  color: 'text-risk-green',   bg: 'bg-risk-green/10',   border: 'border-risk-green/30' },
  SHORT_COVERING:    { label: 'Short Covering',    meaning: 'Fragile upside — not real buying', color: 'text-risk-amber',   bg: 'bg-risk-amber/10',   border: 'border-risk-amber/30' },
  FRESH_SHORTS:      { label: 'Fresh Shorts',      meaning: 'Institutional selling pressure',   color: 'text-risk-red',     bg: 'bg-risk-red/10',     border: 'border-risk-red/30' },
  LONG_LIQUIDATION:  { label: 'Long Liquidation',  meaning: 'Forced exits — not fresh selling', color: 'text-orange-400',   bg: 'bg-orange-400/10',   border: 'border-orange-400/30' },
  MIXED:             { label: 'Mixed',             meaning: 'No clear directional signal',      color: 'text-[var(--text-muted)]', bg: 'bg-kd-elevated', border: 'border-kd-border' },
  LOW_VOLUME:        { label: 'Low Volume',        meaning: 'Insufficient participation',       color: 'text-[var(--text-muted)]', bg: 'bg-kd-elevated', border: 'border-kd-border' },
};

// ── Alignment config ─────────────────────────────────────────────────────────

const ALIGNMENT_STYLES: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
  confirmed:        { label: 'Cycle Confirms',    color: 'text-risk-green',    bg: 'bg-risk-green/10',    border: 'border-risk-green/30',    icon: '✓' },
  diverging:        { label: 'Cycle Diverging',   color: 'text-risk-red',      bg: 'bg-risk-red/10',      border: 'border-risk-red/30',      icon: '✗' },
  mixed:            { label: 'Mixed Signals',     color: 'text-risk-amber',    bg: 'bg-risk-amber/10',    border: 'border-risk-amber/30',    icon: '~' },
  neutral_cycle:    { label: 'Cycle Neutral',     color: 'text-[var(--text-muted)]', bg: 'bg-kd-elevated', border: 'border-kd-border',       icon: '—' },
  no_astro_event:   { label: 'No Cycle Event',    color: 'text-[var(--text-muted)]', bg: 'bg-kd-elevated', border: 'border-kd-border',       icon: '—' },
};

// ── Context types ────────────────────────────────────────────────────────────

interface InstrumentContext {
  instrument: { name: string; type: string };
  date: string;
  price: { close: number; prev_close: number; change_pct: number };
  flow: { type: string | null; vacuum: string | null; accum_distrib: string | null };
  participation: { institution: number | null; hot_money: number | null; rsi: number | null; profile: string };
  momentum: { rsi_14: number | null; mfi_14: number | null; alignment: string };
  relative_strength: { magic_rs: number | null; magic_ma: number | null; zone: string | null };
  volume: { rvol: number | null; tvol: number | null; character: string };
  dots: { svd_recent: boolean; sbd_recent: boolean; syd_recent: boolean };
  golden_line: { sma_150: number | null; bias: string; distance_pct: number | null };
  alignment: { astro_direction: string; tech_direction: string; status: string };
}

// ── Dimension card ───────────────────────────────────────────────────────────

function Dimension({
  icon: Icon, label, children, className,
}: {
  icon: React.ElementType; label: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn('p-3 rounded-xl border border-kd-border bg-kd-surface/50', className)}>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="w-3 h-3 text-accent-indigo" />
        <span className="text-[9px] font-bold uppercase tracking-widest text-muted">{label}</span>
      </div>
      {children}
    </div>
  );
}

// ── Momentum dots ────────────────────────────────────────────────────────────

function MomentumDots({ rsi, mfi, alignment }: { rsi: number | null; mfi: number | null; alignment: string }) {
  const rsiUp = rsi != null && rsi > 50;
  const mfiUp = mfi != null && mfi > 50;
  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <div className="flex items-center gap-1">
          <span className={cn('w-2 h-2 rounded-full', rsiUp ? 'bg-risk-green' : 'bg-risk-red')} />
          <span className="text-[10px] text-[var(--text-secondary)]">RSI</span>
        </div>
        <div className="flex items-center gap-1">
          <span className={cn('w-2 h-2 rounded-full', mfiUp ? 'bg-risk-green' : 'bg-risk-red')} />
          <span className="text-[10px] text-[var(--text-secondary)]">MFI</span>
        </div>
      </div>
      <div className={cn('text-[10px] font-bold',
        alignment === 'aligned_up' ? 'text-risk-green' :
        alignment === 'aligned_down' ? 'text-risk-red' : 'text-risk-amber'
      )}>
        {alignment === 'aligned_up' ? 'Aligned Up' :
         alignment === 'aligned_down' ? 'Aligned Down' : 'Mixed'}
      </div>
    </div>
  );
}

// ── RS spectrum bar ──────────────────────────────────────────────────────────

function RSBar({ zone }: { zone: string | null }) {
  // 7-point spectrum matching the pipeline's emitted bands (migration 069).
  // Neutral Bull/Bear are ~47% of the universe — a 5-point scale snapped both
  // to dead-center, erasing their bull/bear tilt.
  const zones = ['Strong Bear', 'Mild Bear', 'Neutral Bear', 'Neutral', 'Neutral Bull', 'Mild Bull', 'Strong Bull'];
  const idx = zones.indexOf(zone ?? 'Neutral');
  const pos = idx >= 0 ? idx : 3;
  const pct = (pos / (zones.length - 1)) * 100;

  return (
    <div>
      <div className="relative h-2 rounded-full bg-gradient-to-r from-risk-red via-risk-amber to-risk-green mb-1">
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-[var(--text-primary)] shadow"
          style={{ left: `${pct}%`, transform: `translate(-50%, -50%)` }}
        />
      </div>
      <div className={cn('text-[10px] font-bold text-center',
        (zone?.includes('Bull')) ? 'text-risk-green' :
        (zone?.includes('Bear')) ? 'text-risk-red' : 'text-risk-amber'
      )}>
        {zone || 'N/A'}
      </div>
    </div>
  );
}

// ── Volume character ─────────────────────────────────────────────────────────

function VolumeCharacter({ character, rvol }: { character: string; rvol: number | null }) {
  const config: Record<string, { label: string; color: string }> = {
    high_conviction: { label: 'High Conviction', color: 'text-risk-green' },
    moderate:        { label: 'Moderate',         color: 'text-risk-amber' },
    low:             { label: 'Low',              color: 'text-[var(--text-muted)]' },
    dead_day:        { label: 'Dead Day',         color: 'text-[var(--text-muted)]' },
    unknown:         { label: '—',                color: 'text-[var(--text-muted)]' },
  };
  const c = config[character] ?? config.unknown;
  return (
    <div>
      <div className={cn('text-[11px] font-bold', c.color)}>{c.label}</div>
      {rvol != null && (
        <div className="text-[9px] text-muted mt-0.5">RVOL {rvol.toFixed(2)}x</div>
      )}
    </div>
  );
}

// ── Context hook ─────────────────────────────────────────────────────────────

function useInstrumentContext(id: number, type: string, date?: string) {
  const pipelineUrl = (import.meta.env.VITE_PIPELINE_API_URL as string) ?? '';
  return useQuery({
    queryKey: ['instrument_ctx', type, id, date],
    queryFn: async (): Promise<InstrumentContext | null> => {
      const params = new URLSearchParams({ id: String(id), type });
      if (date) params.set('date', date);
      const res = await fetch(`${pipelineUrl}/api/context/instrument?${params}`);
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!id,
    retry: false,
  });
}

// ── Main Component ───────────────────────────────────────────────────────────

interface InstrumentIntelligenceProps {
  id: number;
  type: string;
  date?: string;
}

export default function InstrumentIntelligence({ id, type, date }: InstrumentIntelligenceProps) {
  const { data: ctx, isLoading: ctxLoading } = useInstrumentContext(id, type, date);
  const { data: aiData, isLoading: aiLoading } = useInstrumentInsight(id, type, date);

  if (ctxLoading) {
    return (
      <Card rounded="xxl" className="p-5 sm:p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-accent-indigo" />
          <h3 className="text-[13px] font-bold text-[var(--text-primary)]">Intelligence</h3>
        </div>
        <div className="flex items-center justify-center py-6 text-muted gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs">Assembling context...</span>
        </div>
      </Card>
    );
  }

  if (!ctx) return null;

  const flowCfg = FLOW_STYLES[ctx.flow.type ?? ''] ?? FLOW_STYLES.MIXED;
  const alignCfg = ALIGNMENT_STYLES[ctx.alignment.status] ?? ALIGNMENT_STYLES.no_astro_event;

  // Special alerts
  const alerts: string[] = [];
  if (ctx.dots.svd_recent) alerts.push('Institutional flow detected (SVD)');
  if (ctx.dots.sbd_recent) alerts.push('Rising flow detected (SBD)');
  if (ctx.dots.syd_recent) alerts.push('Falling flow detected (SYD)');
  if (ctx.flow.vacuum) alerts.push(
    ctx.flow.vacuum === 'VACUUM_UP'
      ? 'Vacuum move up — price rising on declining volume'
      : 'Vacuum move down — price falling on declining volume'
  );
  if (ctx.flow.accum_distrib === 'ACCUMULATION') alerts.push('Smart money activity at support');
  if (ctx.flow.accum_distrib === 'DISTRIBUTION') alerts.push('Smart money distribution at resistance');

  return (
    <Card rounded="xxl" className="p-5 sm:p-6 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-accent-indigo" />
          <h3 className="text-[13px] font-bold text-[var(--text-primary)]">Intelligence</h3>
        </div>
        {/* Alignment badge */}
        <div className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border',
          alignCfg.color, alignCfg.bg, alignCfg.border,
        )}>
          <span>{alignCfg.icon}</span>
          <span>{alignCfg.label}</span>
        </div>
      </div>

      {/* Flow banner */}
      <div className={cn(
        'flex items-center justify-between p-3 rounded-xl border mb-4',
        flowCfg.bg, flowCfg.border,
      )}>
        <div>
          <div className={cn('text-[13px] font-bold', flowCfg.color)}>{flowCfg.label}</div>
          <div className="text-[10px] text-[var(--text-secondary)]">{flowCfg.meaning}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-muted uppercase tracking-wider">GL Bias</div>
          <div className={cn('text-[11px] font-bold',
            ctx.golden_line.bias === 'bullish' ? 'text-risk-green' :
            ctx.golden_line.bias === 'bearish' ? 'text-risk-red' : 'text-risk-amber'
          )}>
            {ctx.golden_line.bias === 'bullish' ? 'Above GL' :
             ctx.golden_line.bias === 'bearish' ? 'Below GL' : 'At GL'}
            {ctx.golden_line.distance_pct != null && (
              <span className="text-[9px] text-muted ml-1">({ctx.golden_line.distance_pct > 0 ? '+' : ''}{ctx.golden_line.distance_pct}%)</span>
            )}
          </div>
        </div>
      </div>

      {/* 4-dimension grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Dimension icon={Users} label="Participation">
          <div className={cn('text-[11px] font-bold',
            ctx.participation.profile.includes('institution') ? 'text-risk-red' :
            ctx.participation.profile.includes('hot-money') ? 'text-risk-amber' : 'text-[var(--text-muted)]'
          )}>
            {ctx.participation.profile.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </div>
          {ctx.participation.institution != null && (
            <div className="text-[9px] text-muted mt-0.5">
              Inst: {ctx.participation.institution.toFixed(0)} · Hot$: {ctx.participation.hot_money?.toFixed(0) ?? '—'}
            </div>
          )}
        </Dimension>

        <Dimension icon={Activity} label="Momentum">
          <MomentumDots rsi={ctx.momentum.rsi_14} mfi={ctx.momentum.mfi_14} alignment={ctx.momentum.alignment} />
        </Dimension>

        <Dimension icon={Gauge} label="Relative Strength">
          <RSBar zone={ctx.relative_strength.zone} />
        </Dimension>

        <Dimension icon={BarChart3} label="Volume">
          <VolumeCharacter character={ctx.volume.character} rvol={ctx.volume.rvol} />
        </Dimension>
      </div>

      {/* Special alerts */}
      {alerts.length > 0 && (
        <div className="space-y-1.5 mb-4">
          {alerts.map((alert, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-risk-amber/5 border border-risk-amber/20">
              <AlertTriangle className="w-3 h-3 text-risk-amber shrink-0" />
              <span className="text-[10px] text-[var(--text-secondary)]">{alert}</span>
            </div>
          ))}
        </div>
      )}

      {/* VaNi Insight */}
      <VaNiInsight insight={aiData?.insight} isLoading={aiLoading} />
    </Card>
  );
}
