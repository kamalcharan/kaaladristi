import { Shield, Activity, Zap, AlertTriangle, ChevronRight, CheckCircle2 } from 'lucide-react';
import type { DayRiskReport, HistoricalProof } from '@/types';
import { cn, getRiskColor, getRiskHex } from '@/lib/utils';
import { Card } from '@/components/ui';
import {
  RiskGauge, FactorCard, RegimeBadge,
  PanchangamCard, ActiveIndexScroll, MarketBreadthChart, BreadthRocChart, SevenDayStrip,
  MarketPulseCard, IndustryRotationPanel,
} from '@/components/domain';

interface DashboardViewProps {
  report: DayRiskReport;
  proofs: HistoricalProof[];
}

export default function DashboardView({ report, proofs }: DashboardViewProps) {
  return (
    <div className="animate-fade-in">
      {/* Header */}
      <header className="mb-4">
        <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary)] mb-1">
          Cycle Intelligence
        </h1>
        <p className="text-secondary font-medium text-sm">
          Deterministic risk assessment for{' '}
          <span className="text-accent-indigo font-bold">{report.symbol}</span>
        </p>
      </header>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5 items-start">

        {/* ── LEFT COLUMN ── */}
        <div className="space-y-5 min-w-0">

          {/* Hero Risk Gauge */}
          <Card rounded="xxl" className="p-6 sm:p-8 flex flex-col lg:flex-row items-center gap-8 relative overflow-hidden group shadow-xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent-indigo/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-accent-indigo/10 transition-colors duration-700" />
            <RiskGauge score={report.riskScore} size="hero" />
            <div className="flex-1 space-y-4 relative z-10">
              <RegimeBadge regime={report.regime} />
              <p className="text-base text-[var(--text-secondary)] leading-relaxed font-medium">
                {report.explanation}
              </p>
              <div className="flex items-center gap-2 text-sm font-bold text-muted bg-kd-elevated/40 w-fit px-4 py-2 rounded-xl border border-kd-border">
                <Activity className="w-4 h-4 text-accent-indigo" /> {report.planetarySummary}
              </div>
            </div>
          </Card>

          {/* Active Indexes */}
          <ActiveIndexScroll />

          {/* 6-Day Outlook */}
          <SevenDayStrip selectedDate={report.date} />

          {/* Market Pulse — flow + participation + cycle alignment */}
          <MarketPulseCard date={report.date} />

          {/* Market Breadth — EMA positioning */}
          <MarketBreadthChart />

          {/* Breadth Momentum — ROC oscillator */}
          <BreadthRocChart />

          {/* Factor Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <FactorCard label="Structural" value={report.factors.structural} icon={Shield}        color="bg-accent-indigo" />
            <FactorCard label="Momentum"   value={report.factors.momentum}   icon={Activity}      color="bg-risk-red" />
            <FactorCard label="Volatility" value={report.factors.volatility} icon={Zap}           color="bg-risk-amber" />
            <FactorCard label="Deception"  value={report.factors.deception}  icon={AlertTriangle} color="bg-accent-violet" />
          </div>

          {/* Industry Rotation — between sector tiles and breadth panels */}
          <IndustryRotationPanel />

          {/* Sector Impact */}
          {report.sectorImpacts.length > 0 && (
            <Card rounded="xxl" className="p-5 sm:p-8">
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-5">Sector Sensitivity</h3>
              <div className="space-y-3">
                {report.sectorImpacts.map((s) => (
                  <div key={s.sector} className="flex items-center gap-4">
                    <span className="text-xs text-secondary w-24 shrink-0">{s.sector}</span>
                    <div className="flex-1 h-2 bg-kd-elevated/30 rounded-full overflow-hidden border border-kd-border">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${s.sensitivity}%`, background: getRiskHex(s.sensitivity) }}
                      />
                    </div>
                    <span className={cn('text-xs font-mono font-bold w-8 text-right', getRiskColor(s.sensitivity))}>
                      {s.sensitivity}
                    </span>
                    <span className="text-[10px] text-muted font-mono w-12 text-right">{s.weight}%</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Historical Convergence */}
          <Card rounded="xxl" className="p-5 sm:p-8 shadow-xl">
            <div className="flex justify-between items-center mb-6 sm:mb-8">
              <div>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">Historical Convergence</h3>
                <p className="text-sm text-muted mt-1">Correlation between intelligence and market reality</p>
              </div>
              <button className="text-accent-indigo text-xs font-bold uppercase tracking-widest hover:opacity-80 flex items-center gap-2 group p-2">
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
                      ? 'bg-accent-indigo/10 border-accent-indigo/40 ring-1 ring-accent-indigo/20'
                      : 'bg-kd-bg/40 border-kd-border hover:border-kd-border-active'
                  )}
                >
                  <div className="flex justify-between items-start mb-5">
                    <span className="text-[10px] font-bold text-muted uppercase font-mono tracking-tighter">{p.date}</span>
                    {p.isCorrect
                      ? <CheckCircle2 className="w-4 h-4 text-risk-green" />
                      : <div className="w-4 h-4 rounded-full border border-kd-border" />
                    }
                  </div>
                  <div className="mb-5">
                    <p className={cn('text-4xl font-bold font-mono tracking-tighter', getRiskColor(p.score))}>{p.score}</p>
                    <p className="text-[9px] font-bold text-muted uppercase mt-1 tracking-widest">Risk Index</p>
                  </div>
                  <div className="pt-3 border-t border-kd-border">
                    <p className={cn('text-lg font-bold font-mono', p.actualReturn < 0 ? 'text-risk-red' : 'text-risk-green')}>
                      {p.actualReturn > 0 ? '+' : ''}{p.actualReturn}%
                    </p>
                    <p className="text-[9px] font-bold text-muted uppercase mt-1 tracking-widest">Price Action</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

      {/* ── RIGHT COLUMN ── */}
        <div className="space-y-4 lg:sticky lg:top-4">

          {/* Panchangam */}
          <PanchangamCard date={report.date} />
        </div>
      </div>
    </div>
  );
}
