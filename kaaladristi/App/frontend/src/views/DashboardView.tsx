import { Shield, Activity, Zap, AlertTriangle, ChevronRight, CheckCircle2 } from 'lucide-react';
import type { DayRiskReport, HistoricalProof } from '@/types';
import { getRiskColor, getRiskHex, getRegimeColor } from '@/lib/utils';

interface DashboardViewProps {
  report: DayRiskReport;
  proofs: HistoricalProof[];
}

export default function DashboardView({ report, proofs }: DashboardViewProps) {
  return (
    <div className="space-y-10 animate-fade-in">
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

      {/* Hero Risk Gauge */}
      <section className="glass-card rounded-5xl p-10 flex flex-col lg:flex-row items-center gap-16 relative overflow-hidden group shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-indigo-600/10 transition-colors duration-700" />

        {/* Gauge */}
        <div className="relative w-[220px] h-[220px] shrink-0">
          <svg className="w-full h-full -rotate-90 scale-110" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" className="fill-none stroke-white/5" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="42"
              className="fill-none transition-all duration-1000 ease-out"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray="263.89"
              strokeDashoffset={263.89 - (report.riskScore / 100) * 263.89}
              stroke={getRiskHex(report.riskScore)}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-6xl font-bold font-mono tracking-tighter ${getRiskColor(report.riskScore)}`}>
              {report.riskScore}
            </span>
            <span className="text-[10px] font-bold text-muted uppercase tracking-[0.3em] mt-1">Stress idx</span>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 space-y-6 relative z-10">
          <div className="flex items-center gap-4">
            <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all duration-500 ${getRegimeColor(report.regime)}`}>
              {report.regime} Regime Active
            </span>
          </div>
          <p className="text-lg text-slate-300 leading-relaxed font-medium">
            {report.explanation}
          </p>
          <div className="flex items-center gap-2 text-sm font-bold text-muted bg-black/20 w-fit px-4 py-2 rounded-xl border border-kd-border">
            <Activity className="w-4 h-4 text-accent-indigo" /> {report.planetarySummary}
          </div>
        </div>
      </section>

      {/* Factor Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        {[
          { label: 'Structural', value: report.factors.structural, color: 'bg-accent-indigo', icon: Shield },
          { label: 'Momentum',   value: report.factors.momentum,   color: 'bg-risk-red',     icon: Activity },
          { label: 'Volatility', value: report.factors.volatility, color: 'bg-risk-amber',   icon: Zap },
          { label: 'Deception',  value: report.factors.deception,  color: 'bg-accent-violet', icon: AlertTriangle },
        ].map((dim) => (
          <div key={dim.label} className="glass-card p-6 rounded-3xl hover:border-white/20 transition-all hover:-translate-y-0.5 group">
            <div className="flex justify-between items-center mb-6">
              <div className="p-2.5 rounded-xl bg-slate-950/50 border border-kd-border group-hover:border-accent-indigo/30 transition-colors">
                <dim.icon className="w-5 h-5 text-slate-400 group-hover:text-indigo-400" />
              </div>
              <span className="font-mono text-xl font-bold text-slate-100">
                {dim.value}<span className="text-[10px] text-muted font-normal ml-1">/25</span>
              </span>
            </div>
            <p className="text-[11px] font-bold text-muted uppercase tracking-widest mb-3">{dim.label} Weight</p>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-kd-border">
              <div
                className={`h-full ${dim.color} shadow-[0_0_10px_rgba(0,0,0,0.5)] transition-all duration-1000 ease-out`}
                style={{ width: `${(dim.value / 25) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Historical Proofs */}
      <section className="glass-card rounded-5xl p-10 shadow-xl">
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
              className={`min-w-[200px] snap-center p-6 rounded-4xl border transition-all duration-300 hover:scale-[1.02] cursor-pointer ${
                i === 0
                  ? 'bg-indigo-500/10 border-indigo-500/40 ring-1 ring-indigo-500/20'
                  : 'bg-slate-950/40 border-kd-border hover:border-white/10'
              }`}
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
                <p className={`text-4xl font-bold font-mono tracking-tighter ${getRiskColor(p.score)}`}>{p.score}</p>
                <p className="text-[9px] font-bold text-muted uppercase mt-1 tracking-widest">Risk Index</p>
              </div>
              <div className="pt-4 border-t border-kd-border">
                <p className={`text-lg font-bold font-mono ${p.actualReturn < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {p.actualReturn > 0 ? '+' : ''}{p.actualReturn}%
                </p>
                <p className="text-[9px] font-bold text-muted uppercase mt-1 tracking-widest">Price Action</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
