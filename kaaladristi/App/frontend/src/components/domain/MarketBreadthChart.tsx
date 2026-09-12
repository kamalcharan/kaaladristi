import { useMemo, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea,
} from 'recharts';
import { useMarketBreadth } from '@/hooks';
import { Loader2, AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MarketBreadthDay } from '@/types';

// ── Config ────────────────────────────────────────────────────────────────────

const PERIODS = [
  { label: '22D', days: 22 },
  { label: '44D', days: 44 },
  { label: '66D', days: 66 },
] as const;
type PeriodLabel = typeof PERIODS[number]['label'];
const MAX_PERIOD_DAYS = Math.max(...PERIODS.map(p => p.days));

const GREED_THRESHOLD = 55;
const FEAR_THRESHOLD  = 35;

/**
 * Which moving averages the incoming series was actually measured against.
 *
 * The two breadth pipelines do NOT agree. Market-wide (km_market_breadth,
 * compute_market_breadth.py) computes all three legs as EMAs. Per-index
 * (km_index_breadth / fetchIndexBreadth) uses ema_20 + sma_50 + sma_150 —
 * D40, and migration 203's own header. Labelling both "EMA" mis-states two
 * of the three legs on every per-index card; D44 fixed exactly this mislabel
 * for the market-wide chart and the per-index path reintroduced it.
 */
const MA_LABELS = {
  market: { m20: '20 EMA', m50: '50 EMA', m150: '150 EMA' },
  index:  { m20: '20 EMA', m50: '50 SMA', m150: '150 SMA' },
} as const;
export type MaBasis = keyof typeof MA_LABELS;
type MaLabels = typeof MA_LABELS[MaBasis];

// ── Props ─────────────────────────────────────────────────────────────────────

export interface MarketBreadthChartProps {
  researchMode?: boolean;
  periodDays?: 22 | 44 | 66;
  onPeriodChange?: (days: 22 | 44 | 66) => void;
  /** External data. When provided, the internal hook fetch is ignored. */
  data?: MarketBreadthDay[];
  isLoading?: boolean;
  isError?: boolean;
  /** Display name shown in the header instead of "Market Breadth". */
  indexName?: string;
  /** Override constituent count (used when data comes from an index slice). */
  stockCount?: number;
  /**
   * Which MA basis `data` was measured against, driving the stat labels.
   * Defaults from whether data was injected: the only producer of injected
   * series is the per-index path. Pass explicitly to override.
   */
  maBasis?: MaBasis;
  /**
   * Zone mode drives the regime badge logic:
   *   'absolute'    — NSE universe 35/55 thresholds (default)
   *   'percentile'  — relative to own history (pctRank252 required)
   *   'provisional' — percentile + "provisional" label (short history < 126 sessions)
   */
  zoneMode?: 'absolute' | 'percentile' | 'provisional';
  /** 0–1 percentile rank of today's breadth score in the index's own 252-day history. */
  percentileRank?: number;
}

// ── Regime helpers ────────────────────────────────────────────────────────────

type RegimeInfo = { label: string; color: string; bg: string; border: string };

function regimeAbsolute(score: number): RegimeInfo {
  if (score > GREED_THRESHOLD) return { label: 'Greed',   color: 'text-risk-red',   bg: 'bg-risk-red/10',   border: 'border-risk-red/40'   };
  if (score < FEAR_THRESHOLD)  return { label: 'Fear',    color: 'text-risk-green', bg: 'bg-risk-green/10', border: 'border-risk-green/40' };
  return                               { label: 'Neutral', color: 'text-risk-amber', bg: 'bg-risk-amber/10', border: 'border-risk-amber/40' };
}

function regimePercentile(pctRank: number, provisional: boolean): RegimeInfo {
  const suffix = provisional ? ' *' : '';
  if (pctRank >= 0.70) return { label: `Greed${suffix}`,   color: 'text-risk-red',   bg: 'bg-risk-red/10',   border: 'border-risk-red/40'   };
  if (pctRank <= 0.30) return { label: `Fear${suffix}`,    color: 'text-risk-green', bg: 'bg-risk-green/10', border: 'border-risk-green/40' };
  return                       { label: `Neutral${suffix}`, color: 'text-risk-amber', bg: 'bg-risk-amber/10', border: 'border-risk-amber/40' };
}

export function resolveRegime(
  score: number,
  zoneMode: MarketBreadthChartProps['zoneMode'],
  percentileRank: number | undefined,
): RegimeInfo {
  if (zoneMode === 'percentile' || zoneMode === 'provisional') {
    if (percentileRank != null) {
      return regimePercentile(percentileRank, zoneMode === 'provisional');
    }
  }
  return regimeAbsolute(score);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDate(d: string): string {
  const [, m, day] = d.split('-');
  return `${+day} ${MONTHS[+m - 1]}`;
}

function fmtPct(v: number | null): string {
  return v == null ? '—' : `${v.toFixed(1)}%`;
}

// ── EMA stat pill ─────────────────────────────────────────────────────────────

function EmaStat({ label, value, prev }: { label: string; value: number | null; prev: number | null }) {
  const up   = value != null && prev != null && value > prev;
  const down = value != null && prev != null && value < prev;
  return (
    <div className="text-center">
      <div className="text-[9px] text-muted font-bold uppercase tracking-wider mb-0.5">{label}</div>
      <div className={cn('text-[12px] font-bold mono flex items-center gap-0.5',
        up ? 'text-risk-green' : down ? 'text-risk-red' : 'text-[var(--text-primary)]'
      )}>
        {fmtPct(value)}
        {up   && <TrendingUp   className="w-2.5 h-2.5" />}
        {down && <TrendingDown className="w-2.5 h-2.5" />}
        {!up && !down && <Minus className="w-2.5 h-2.5 text-muted" />}
      </div>
    </div>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function BreadthTooltip({ active, payload, ma, researchMode }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as MarketBreadthDay;
  if (!d) return null;
  const r = regimeAbsolute(d.breadth_score ?? 0);
  return (
    <div className="glass-card rounded-xl p-3 text-[11px] border border-kd-border min-w-[160px]">
      <div className="font-bold text-[var(--text-primary)] mb-2">{fmtDate(d.trade_date)}</div>
      <div className="flex justify-between gap-4 mb-1">
        <span className="text-muted">Score</span>
        <span className={cn('font-bold mono', researchMode ? 'text-[var(--text-primary)]' : r.color)}>{d.breadth_score?.toFixed(1)} ({r.label})</span>
      </div>
      <div className="flex justify-between gap-4 mb-0.5">
        <span className="text-muted">Above {ma.m20}</span>
        <span className="mono text-[var(--text-secondary)]">{fmtPct(d.pct_above_20)}</span>
      </div>
      <div className="flex justify-between gap-4 mb-0.5">
        <span className="text-muted">Above {ma.m50}</span>
        <span className="mono text-[var(--text-secondary)]">{fmtPct(d.pct_above_50)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted">Above {ma.m150}</span>
        <span className="mono text-[var(--text-secondary)]">{fmtPct(d.pct_above_150)}</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MarketBreadthChart({
  data: dataProp,
  isLoading: isLoadingProp,
  isError: isErrorProp,
  indexName,
  stockCount: stockCountProp,
  zoneMode = 'absolute',
  percentileRank,
  maBasis: maBasisProp,
  periodDays, onPeriodChange, researchMode = false,
}: MarketBreadthChartProps = {}) {
  const [localPeriod, setPeriod] = useState<PeriodLabel>('66D');
  const period = periodDays ? `${periodDays}D` : localPeriod;
  const days = PERIODS.find(p => p.label === period)!.days;

  // Fetch the full window once and slice locally, rather than refetching per
  // period. The toggle lives in this component but injected data is fetched by
  // the parent — which passes a fixed window — so a refetch keyed on `days`
  // could never move an injected series: the toggle was inert on every page
  // that injects data. Slicing also makes the refetch redundant on the
  // self-fetching page, since rows are date-ordered and the newest `days` are
  // a subset of the newest MAX_PERIOD_DAYS.
  // `enabled` is false when data was injected — the hook must still be called
  // (React rules), but it previously fired a full market-wide query on every
  // such page and threw the result away.
  // Keyed on the CONTRACT, not on whether the data has arrived: an injecting
  // parent passes `isLoading` too, and on the first render its `data` is still
  // undefined — gating on `dataProp` alone let the market-wide query fire once
  // on every injecting page before the real series landed.
  const externallyFed = dataProp !== undefined || isLoadingProp !== undefined;
  const internal = useMarketBreadth(MAX_PERIOD_DAYS, !externallyFed);

  const source    = dataProp     ?? (internal.data    ?? []);
  const data      = useMemo(() => source.slice(-days), [source, days]);
  const isLoading = isLoadingProp ?? internal.isLoading;
  const isError   = isErrorProp   ?? internal.isError;

  // Only the per-index path produces an injected series, so its MA basis is
  // the honest default; an explicit prop overrides.
  const basis: MaBasis = maBasisProp ?? (externallyFed ? 'index' : 'market');
  const ma: MaLabels   = MA_LABELS[basis];

  const latest = data[data.length - 1];
  const prev   = data[data.length - 2];

  const displayStockCount = stockCountProp ?? latest?.stock_count ?? null;

  // Owner-defined minimum: five constituents; the sector page flags samples of 5–7.
  const tooSmall = displayStockCount != null && displayStockCount < 5;

  const r = latest?.breadth_score != null
    ? resolveRegime(latest.breadth_score, zoneMode, percentileRank)
    : null;

  const title = indexName ? `Breadth · ${indexName}` : 'Market Breadth';

  return (
    <div className="glass-card rounded-2xl p-4">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-[13px] font-bold text-[var(--text-primary)]">{title}</h3>
          {displayStockCount != null && (
            <p className="text-[10px] text-muted mt-0.5">
              {displayStockCount.toLocaleString()}+ stocks analyzed
            </p>
          )}
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {/* Period buttons */}
          <div className="flex items-center gap-0.5 bg-kd-elevated rounded-lg p-0.5">
            {PERIODS.map(p => (
              <button
                key={p.label}
                onClick={() => onPeriodChange ? onPeriodChange(p.days) : setPeriod(p.label)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[10px] font-bold transition-all',
                  period === p.label
                    ? 'bg-accent-indigo text-white'
                    : 'text-muted hover:text-[var(--text-secondary)]',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* EMA stats */}
          {!tooSmall && !researchMode && (
            <div className="flex items-center gap-4 pl-2 border-l border-kd-border">
              <EmaStat label={ma.m20}  value={latest?.pct_above_20  ?? null} prev={prev?.pct_above_20  ?? null} />
              <EmaStat label={ma.m50}  value={latest?.pct_above_50  ?? null} prev={prev?.pct_above_50  ?? null} />
              <EmaStat label={ma.m150} value={latest?.pct_above_150 ?? null} prev={prev?.pct_above_150 ?? null} />
            </div>
          )}

          {/* Regime badge */}
          {r && !tooSmall && (
            <span className={cn('px-2.5 py-1 rounded-lg text-[10px] font-bold border uppercase tracking-wider', researchMode ? 'text-muted border-kd-border' : [r.bg, r.color, r.border])}>
              {r.label}
            </span>
          )}
        </div>
      </div>

      {/* ── Chart title + current score ── */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-[11px] font-bold text-[var(--text-secondary)]">Breadth Score Trend</div>
          <div className="text-[9px] text-muted">50% Above {ma.m20} · 30% Above {ma.m50} · 20% Above {ma.m150}</div>
          {zoneMode === 'provisional' && (
            <div className="text-[9px] text-risk-amber mt-0.5">* Provisional — short index history</div>
          )}
        </div>
        {latest?.breadth_score != null && !tooSmall && (
          <div className="text-right">
            <div className={cn('text-[22px] font-bold mono leading-none', researchMode ? 'text-[var(--text-primary)]' : r?.color)}>
              {latest.breadth_score.toFixed(1)}
            </div>
            <div className="text-[9px] text-muted">{researchMode ? `Session score · ${fmtDate(latest.trade_date)}` : 'Current Score'}</div>
          </div>
        )}
      </div>

      {/* ── Chart ── */}
      {tooSmall ? (
        <div className="flex flex-col items-center justify-center h-[200px] gap-1">
          <AlertCircle className="w-4 h-4 text-muted" />
          <p className="text-xs text-muted text-center">
            Insufficient constituents ({displayStockCount}) — breadth requires ≥ 5 stocks
          </p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center h-[200px] gap-2">
          <Loader2 className="w-4 h-4 text-accent-indigo animate-spin" />
          <span className="text-sm text-muted">Loading...</span>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center h-[200px] gap-2">
          <AlertCircle className="w-5 h-5 text-risk-red" />
          <p className="text-xs text-muted">Failed to load breadth data</p>
        </div>
      ) : data.length === 0 ? (
        <div className="flex items-center justify-center h-[200px]">
          <p className="text-xs text-muted text-center">
            No breadth data is available for this selection.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 4, right: 70, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="breadthGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--accent)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.05} />
              </linearGradient>
            </defs>

            {/* Regime background zones */}
            <ReferenceArea y1={GREED_THRESHOLD} y2={100} fill={researchMode ? 'var(--text-muted)' : 'var(--bear)'} fillOpacity={0.06} />
            <ReferenceArea y1={FEAR_THRESHOLD}  y2={GREED_THRESHOLD} fill={researchMode ? 'var(--text-muted)' : 'var(--caution)'} fillOpacity={0.06} />
            <ReferenceArea y1={0}               y2={FEAR_THRESHOLD}  fill={researchMode ? 'var(--text-muted)' : 'var(--bull)'} fillOpacity={0.06} />

            <XAxis
              dataKey="trade_date"
              tickFormatter={fmtDate}
              tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={false}
            />

            {/* Threshold reference lines */}
            <ReferenceLine
              y={GREED_THRESHOLD}
              stroke={researchMode ? 'var(--text-muted)' : 'var(--bear)'}
              strokeDasharray="4 2"
              strokeOpacity={0.6}
              label={{ value: `Greed ${GREED_THRESHOLD}`, position: 'right', fontSize: 9, fill: researchMode ? 'var(--text-muted)' : 'var(--bear)' }}
            />
            <ReferenceLine
              y={FEAR_THRESHOLD}
              stroke={researchMode ? 'var(--text-muted)' : 'var(--bull)'}
              strokeDasharray="4 2"
              strokeOpacity={0.6}
              label={{ value: `Fear ${FEAR_THRESHOLD}`, position: 'right', fontSize: 9, fill: researchMode ? 'var(--text-muted)' : 'var(--bull)' }}
            />

            <Tooltip content={<BreadthTooltip ma={ma} researchMode={researchMode} />} />

            <Area
              dataKey="breadth_score"
              stroke="var(--accent)"
              strokeWidth={1.5}
              fill="url(#breadthGrad)"
              dot={false}
              activeDot={{ r: 3, fill: 'var(--accent)' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* ── Legend ── */}
      {!tooSmall && (
        <div className="flex items-center justify-center gap-5 mt-2">
          {[
            { color: 'bg-risk-red',   label: `Greed (>${GREED_THRESHOLD})` },
            { color: 'bg-risk-amber', label: `Neutral (${FEAR_THRESHOLD}-${GREED_THRESHOLD})` },
            { color: 'bg-risk-green', label: `Fear (<${FEAR_THRESHOLD})` },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={cn('w-2 h-2 rounded-full', researchMode ? 'bg-[var(--text-muted)]' : color)} />
              <span className="text-[9px] text-muted">{label}</span>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
