import { useState } from 'react';
import { Shield, Activity, Zap, AlertTriangle, ChevronRight, CheckCircle2, CalendarDays, BarChart3, AlertCircle } from 'lucide-react';
import type {
  DayRiskReport, HistoricalProof, WeekDay,
  SnapshotPanchang, SnapshotEvent, SnapshotAspect, SnapshotSignals, SnapshotMarket,
  ChartDataPoint, IndexStats, TimeRange,
} from '@/types';
import { cn, getRiskColor, getRiskHex } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { Card, Skeleton } from '@/components/ui';
import {
  FactorCard, PanchangStrip, EventsBanner, SignalPanel,
  AIChatWidget, CalendarStrip, IndexPriceChart,
  MarketHeader, TechnicalStrip, RecommendationPanel, TechnicalCards,
} from '@/components/domain';

interface DashboardViewProps {
  report: DayRiskReport;
  proofs: HistoricalProof[];
  weekData: WeekDay[];
  panchang: SnapshotPanchang | null;
  events: SnapshotEvent[];
  aspects: SnapshotAspect[];
  signals: SnapshotSignals | null;
  market: SnapshotMarket | null;
  chartData: ChartDataPoint[];
  chartStats: IndexStats | null;
  chartRange: TimeRange;
  onChartRangeChange: (r: TimeRange) => void;
  chartLoading: boolean;
  chartError: string | null;
}

export default function DashboardView({
  report, proofs, weekData,
  panchang, events, aspects, signals, market,
  chartData, chartStats, chartRange, onChartRangeChange,
  chartLoading, chartError,
}: DashboardViewProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const { isAdmin } = useAuthStore();
  const sortedSectors = [...report.sectorImpacts].sort((a, b) => b.sensitivity - a.sensitivity);
  const isPositive = (market?.pct_change ?? chartStats?.changePct ?? 0) >= 0;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ═══ 1. HEADER — Symbol, Price, Change, Regime Badge, Stats ═══ */}
      <MarketHeader
        symbol={report.symbol}
        date={report.date}
        regime={report.regime}
        market={market}
      />

      {/* ═══ 2. PANCHANG STRIP ═══ */}
      {panchang && <PanchangStrip panchang={panchang} />}

      {/* ═══ 3. TECHNICAL STRIP — Key indicators bar ═══ */}
      <TechnicalStrip market={market} />

      {/* ═══ 4. MAIN CONTENT — Chart (left) + Recommendation (right) ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">

        {/* Left: Price Chart */}
        <Card rounded="xxl" className="p-6">
          {chartLoading ? (
            <div className="space-y-4">
              <div className="flex gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-12 rounded-lg" />
                ))}
              </div>
              <Skeleton className="h-[380px] w-full rounded-2xl" />
            </div>
          ) : chartError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="w-10 h-10 text-risk-red mb-3" />
              <p className="text-sm font-semibold text-slate-400 mb-1">Chart unavailable</p>
              <p className="text-xs text-muted">{chartError}</p>
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BarChart3 className="w-10 h-10 text-slate-600 mb-3" />
              <p className="text-sm font-semibold text-slate-400">No price data</p>
              <p className="text-xs text-muted mt-1">EOD data not yet loaded for this index</p>
            </div>
          ) : (
            <IndexPriceChart
              data={chartData}
              range={chartRange}
              onRangeChange={onChartRangeChange}
              isPositive={isPositive}
            />
          )}
        </Card>

        {/* Right: Recommendation + Risk Signal */}
        <div className="space-y-5">
          <RecommendationPanel
            riskScore={report.riskScore}
            regime={report.regime}
            signals={signals}
            explanation={report.explanation}
          />

          {/* 7-Day Outlook */}
          <Card rounded="xxl" className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <CalendarDays className="w-4 h-4 text-accent-indigo" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wide">7-Day Outlook</h3>
            </div>
            {weekData.length > 0 ? (
              <CalendarStrip weekData={weekData} />
            ) : (
              <p className="text-xs text-muted py-4 text-center">Loading outlook...</p>
            )}
          </Card>
        </div>
      </div>

      {/* ═══ 5. FACTOR CARDS — Astro risk breakdown ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <FactorCard label="Structural" value={report.factors.structural} icon={Shield}        color="bg-accent-indigo" />
        <FactorCard label="Momentum"   value={report.factors.momentum}   icon={Activity}      color="bg-risk-red" />
        <FactorCard label="Volatility" value={report.factors.volatility} icon={Zap}           color="bg-risk-amber" />
        <FactorCard label="Deception"  value={report.factors.deception}  icon={AlertTriangle} color="bg-accent-violet" />
      </div>

      {/* ═══ 6. TECHNICAL CARDS — Indicator panels ═══ */}
      <div>
        <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wide">Technical Confluence</h3>
        <TechnicalCards signals={signals} />
      </div>

      {/* ═══ 7. PLANETARY EVENTS (admin) ═══ */}
      {isAdmin && <EventsBanner events={events} aspects={aspects} />}

      {/* ═══ 8. SIGNAL PANEL (admin) ═══ */}
      {isAdmin && signals && <SignalPanel signals={signals} />}

      {/* ═══ 9. SECTOR SENSITIVITY ═══ */}
      {sortedSectors.length > 0 && (
        <Card rounded="xxl" className="p-8">
          <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-wide">Sector Sensitivity</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {sortedSectors.map((s) => (
              <div key={s.sector} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-kd-border hover:border-white/10 transition-colors">
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-slate-300 font-medium block truncate">{s.sector}</span>
                  <div className="mt-2 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(s.sensitivity, 100)}%`, background: getRiskHex(s.sensitivity) }}
                    />
                  </div>
                </div>
                <span className={cn('text-sm font-bold font-mono', getRiskColor(s.sensitivity))}>
                  {s.sensitivity}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ═══ 10. HISTORICAL PROOFS ═══ */}
      {proofs.length > 0 && (
        <Card rounded="xxl" className="p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-lg font-bold text-white">Historical Convergence</h3>
              <p className="text-xs text-muted mt-1">Correlation between intelligence and market reality</p>
            </div>
            <button className="text-indigo-400 text-xs font-bold uppercase tracking-widest hover:text-indigo-300 flex items-center gap-2 group p-2">
              Verification Suite <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
          <div className="flex gap-5 overflow-x-auto pb-4 no-scrollbar snap-x">
            {proofs.map((p, i) => (
              <div
                key={i}
                className={cn(
                  'min-w-[180px] snap-center p-5 rounded-3xl border transition-all duration-300 hover:scale-[1.02] cursor-pointer',
                  i === 0
                    ? 'bg-indigo-500/10 border-indigo-500/40 ring-1 ring-indigo-500/20'
                    : 'bg-slate-950/40 border-kd-border hover:border-white/10'
                )}
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[10px] font-bold text-muted uppercase font-mono tracking-tighter">{p.date}</span>
                  {p.isCorrect ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-700" />
                  )}
                </div>
                <div className="mb-4">
                  <p className={cn('text-3xl font-bold font-mono tracking-tighter', getRiskColor(p.score))}>{p.score}</p>
                  <p className="text-[9px] font-bold text-muted uppercase mt-1 tracking-widest">Risk Index</p>
                </div>
                <div className="pt-3 border-t border-kd-border">
                  <p className={cn('text-base font-bold font-mono', p.actualReturn < 0 ? 'text-red-400' : 'text-emerald-400')}>
                    {p.actualReturn > 0 ? '+' : ''}{p.actualReturn}%
                  </p>
                  <p className="text-[9px] font-bold text-muted uppercase mt-1 tracking-widest">Price Action</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ═══ AI Chat Widget ═══ */}
      <AIChatWidget
        regime={report.regime}
        riskScore={report.riskScore}
        symbol={report.symbol}
        externalOpen={chatOpen}
        onExternalOpenChange={setChatOpen}
      />
    </div>
  );
}
