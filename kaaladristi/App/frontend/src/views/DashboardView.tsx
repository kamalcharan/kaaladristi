import { useState } from 'react';
import { Shield, Activity, Zap, AlertTriangle, ChevronRight, CheckCircle2, CalendarDays } from 'lucide-react';
import type { DayRiskReport, HistoricalProof, WeekDay, SnapshotPanchang, SnapshotEvent, SnapshotAspect, SnapshotSignals } from '@/types';
import { cn, getRiskColor, getRiskHex } from '@/lib/utils';
import { Card } from '@/components/ui';
import { RiskGauge, FactorCard, MiniBarChart, PanchangStrip, EventsBanner, SignalPanel, RiskInterpretation, AIChatWidget } from '@/components/domain';

interface DashboardViewProps {
  report: DayRiskReport;
  proofs: HistoricalProof[];
  weekData: WeekDay[];
  panchang: SnapshotPanchang | null;
  events: SnapshotEvent[];
  aspects: SnapshotAspect[];
  signals: SnapshotSignals | null;
}

export default function DashboardView({ report, proofs, weekData, panchang, events, aspects, signals }: DashboardViewProps) {
  const sortedSectors = [...report.sectorImpacts].sort((a, b) => b.sensitivity - a.sensitivity);
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Cycle Intelligence</h1>
          <p className="text-secondary font-medium">
            Deterministic risk assessment for <span className="text-accent-indigo font-bold">{report.symbol}</span>
          </p>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-[10px] font-mono text-muted uppercase tracking-widest font-bold">Current Cycle Date</p>
          <p className="text-xl font-bold font-mono text-slate-200">{report.date}</p>
        </div>
      </header>

      {/* ── Panchang Strip ── */}
      {panchang && <PanchangStrip panchang={panchang} />}

      {/* ── Planetary Events Banner ── */}
      <EventsBanner events={events} aspects={aspects} />

      {/* ── Two-Column Layout: Left (Gauge + Factors) | Right (Explanation + Signals) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Hero Risk Gauge */}
          <Card rounded="xxl" className="p-10 flex flex-col md:flex-row items-center gap-12 relative overflow-hidden group shadow-2xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-indigo-600/10 transition-colors duration-700" />
            <RiskGauge score={report.riskScore} size="hero" />
            <RiskInterpretation
              regime={report.regime}
              riskScore={report.riskScore}
              explanation={report.explanation}
              planetarySummary={report.planetarySummary}
              onAskAI={() => setChatOpen(true)}
            />
          </Card>

          {/* Factor Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <FactorCard label="Structural" value={report.factors.structural} icon={Shield}        color="bg-accent-indigo" />
            <FactorCard label="Momentum"   value={report.factors.momentum}   icon={Activity}      color="bg-risk-red" />
            <FactorCard label="Volatility" value={report.factors.volatility} icon={Zap}           color="bg-risk-amber" />
            <FactorCard label="Deception"  value={report.factors.deception}  icon={AlertTriangle} color="bg-accent-violet" />
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* 7-Day Outlook */}
          <Card rounded="xxl" className="p-6 flex flex-col">
            <div className="flex items-center gap-2 mb-5">
              <CalendarDays className="w-4 h-4 text-accent-indigo" />
              <h3 className="text-sm font-bold text-white">7-Day Outlook</h3>
            </div>

            {weekData.length > 0 ? (
              <>
                <MiniBarChart
                  data={weekData.map(d => d.riskScore)}
                  labels={weekData.map(d => d.dayName)}
                  height={72}
                  className="mb-4"
                />
                <div className="space-y-1.5">
                  {weekData.map((day) => (
                    <div key={day.date} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[10px] font-mono text-muted w-7">{day.dayName}</span>
                        <span className="text-[10px] font-mono text-secondary">{day.date.slice(5)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn('text-xs font-bold font-mono', getRiskColor(day.riskScore))}>
                          {day.riskScore}
                        </span>
                        <div className="w-8 h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${day.riskScore}%`, background: getRiskHex(day.riskScore) }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center py-8">
                <p className="text-xs text-muted">Loading week data...</p>
              </div>
            )}
          </Card>

          {/* Signal Intelligence Panel */}
          {signals && <SignalPanel signals={signals} />}
        </div>
      </div>

      {/* ── Bottom Row: Sector Sensitivity + Historical Proofs ── */}

      {/* Sector Impact - Grid Layout */}
      {sortedSectors.length > 0 && (
        <Card rounded="xxl" className="p-8">
          <h3 className="text-sm font-bold text-white mb-6">Sector Sensitivity</h3>
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

      {/* Historical Proofs */}
      <Card rounded="xxl" className="p-10 shadow-xl">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h3 className="text-xl font-bold text-white">Historical Convergence</h3>
            <p className="text-sm text-muted mt-1">Correlation between intelligence and market reality</p>
          </div>
          <button className="text-indigo-400 text-xs font-bold uppercase tracking-widest hover:text-indigo-300 flex items-center gap-2 group p-2">
            Verification Suite <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
        <div className="flex gap-6 overflow-x-auto pb-6 no-scrollbar snap-x">
          {proofs.map((p, i) => (
            <div
              key={i}
              className={cn(
                'min-w-[200px] snap-center p-6 rounded-4xl border transition-all duration-300 hover:scale-[1.02] cursor-pointer',
                i === 0
                  ? 'bg-indigo-500/10 border-indigo-500/40 ring-1 ring-indigo-500/20'
                  : 'bg-slate-950/40 border-kd-border hover:border-white/10'
              )}
            >
              <div className="flex justify-between items-start mb-6">
                <span className="text-[10px] font-bold text-muted uppercase font-mono tracking-tighter">{p.date}</span>
                {p.isCorrect ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-slate-700" />
                )}
              </div>
              <div className="mb-6">
                <p className={cn('text-4xl font-bold font-mono tracking-tighter', getRiskColor(p.score))}>{p.score}</p>
                <p className="text-[9px] font-bold text-muted uppercase mt-1 tracking-widest">Risk Index</p>
              </div>
              <div className="pt-4 border-t border-kd-border">
                <p className={cn('text-lg font-bold font-mono', p.actualReturn < 0 ? 'text-red-400' : 'text-emerald-400')}>
                  {p.actualReturn > 0 ? '+' : ''}{p.actualReturn}%
                </p>
                <p className="text-[9px] font-bold text-muted uppercase mt-1 tracking-widest">Price Action</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── AI Chat Widget ── */}
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
