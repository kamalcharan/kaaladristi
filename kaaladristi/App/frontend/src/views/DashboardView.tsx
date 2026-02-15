import { Shield, Activity, Zap, AlertTriangle, ChevronRight, CheckCircle2 } from 'lucide-react';
import type { DayRiskReport, HistoricalProof, WeekDay, SnapshotPanchang, SnapshotEvent, SnapshotAspect, SnapshotSignals } from '@/types';
import { cn, getRiskColor, getRiskHex } from '@/lib/utils';
import { Card } from '@/components/ui';
import {
  FactorCard, MiniBarChart,
  PostureHero, RegimeContext, ExpandableSection,
  PanchangStrip, EventsBanner, SignalPanel,
} from '@/components/domain';

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

  return (
    <div className="space-y-8 animate-fade-in">

      {/* ═══════════════════════════════════════════════
          HERO: Posture → Risk → Context (5-second rule)
          ═══════════════════════════════════════════════ */}
      <Card rounded="xxl" className="p-8 lg:p-10">
        <PostureHero riskScore={report.riskScore} regime={report.regime} />

        {/* Regime intelligence — emotional reinforcement layer */}
        <div className="mt-8 pt-8 border-t border-kd-border">
          <RegimeContext regime={report.regime} />
        </div>

        {/* ── Expandable details (hide complexity) ── */}
        <div className="mt-6 space-y-0">
          {/* Planetary events — only shows when there ARE events */}
          {(events.length > 0 || aspects.some(a => a.exact)) && (
            <ExpandableSection title="Active Planetary Events">
              <EventsBanner events={events} aspects={aspects} />
            </ExpandableSection>
          )}

          {/* Panchang */}
          {panchang && (
            <ExpandableSection title="Panchang Details">
              <PanchangStrip panchang={panchang} />
            </ExpandableSection>
          )}

          {/* Signal intelligence */}
          {signals && (
            <ExpandableSection title="Signal Intelligence">
              <SignalPanel signals={signals} />
            </ExpandableSection>
          )}

          {/* Risk factors */}
          <ExpandableSection title="Risk Factor Breakdown">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FactorCard label="Structural" value={report.factors.structural} icon={Shield}        color="bg-accent-indigo" />
              <FactorCard label="Momentum"   value={report.factors.momentum}   icon={Activity}      color="bg-risk-red" />
              <FactorCard label="Volatility" value={report.factors.volatility} icon={Zap}           color="bg-risk-amber" />
              <FactorCard label="Deception"  value={report.factors.deception}  icon={AlertTriangle} color="bg-accent-violet" />
            </div>
          </ExpandableSection>

          {/* Sector sensitivity */}
          {sortedSectors.length > 0 && (
            <ExpandableSection title="Sector Sensitivity">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sortedSectors.map((s) => (
                  <div key={s.sector} className="flex items-center gap-3 py-2">
                    <span className="text-xs text-slate-400 w-24 shrink-0 truncate">{s.sector}</span>
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(s.sensitivity, 100)}%`, background: getRiskHex(s.sensitivity) }}
                      />
                    </div>
                    <span className={cn('text-xs font-mono font-bold w-8 text-right', getRiskColor(s.sensitivity))}>
                      {s.sensitivity}
                    </span>
                  </div>
                ))}
              </div>
            </ExpandableSection>
          )}
        </div>
      </Card>

      {/* ═══════════════════════════════
          OUTLOOK: Quiet 7-day strip
          ═══════════════════════════════ */}
      {weekData.length > 0 && (
        <Card rounded="xxl" className="p-6 lg:p-8">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted mb-5">7-Day Outlook</h3>
          <MiniBarChart
            data={weekData.map(d => d.riskScore)}
            labels={weekData.map(d => d.dayName)}
            height={64}
            className="mb-4"
          />
          <div className="space-y-1">
            {weekData.map((day) => (
              <div key={day.date} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-muted w-7">{day.dayName}</span>
                  <span className="text-[10px] font-mono text-slate-500">{day.date.slice(5)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('text-xs font-bold font-mono', getRiskColor(day.riskScore))}>
                    {day.riskScore}
                  </span>
                  <div className="w-10 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${day.riskScore}%`, background: getRiskHex(day.riskScore) }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ═══════════════════════════════
          HISTORICAL: Proof of accuracy
          ═══════════════════════════════ */}
      {proofs.length > 0 && (
        <Card rounded="xxl" className="p-8 lg:p-10">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-sm font-bold text-white">Historical Convergence</h3>
              <p className="text-xs text-muted mt-1">Intelligence vs. market reality</p>
            </div>
            <button className="text-slate-500 text-[10px] font-bold uppercase tracking-widest hover:text-slate-300 flex items-center gap-1.5 group">
              View All <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar snap-x">
            {proofs.map((p, i) => (
              <div
                key={i}
                className={cn(
                  'min-w-[180px] snap-center p-5 rounded-2xl border transition-colors',
                  i === 0
                    ? 'bg-white/[0.03] border-white/10'
                    : 'bg-transparent border-kd-border hover:border-white/8'
                )}
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[10px] font-mono text-muted">{p.date}</span>
                  {p.isCorrect ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-risk-green" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-slate-700" />
                  )}
                </div>
                <p className={cn('text-2xl font-bold font-mono tracking-tighter', getRiskColor(p.score))}>{p.score}</p>
                <p className="text-[9px] text-muted mt-1">Risk Score</p>
                <div className="mt-3 pt-3 border-t border-kd-border">
                  <p className={cn('text-sm font-bold font-mono', p.actualReturn < 0 ? 'text-risk-red' : 'text-risk-green')}>
                    {p.actualReturn > 0 ? '+' : ''}{p.actualReturn}%
                  </p>
                  <p className="text-[9px] text-muted mt-0.5">Actual Return</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
