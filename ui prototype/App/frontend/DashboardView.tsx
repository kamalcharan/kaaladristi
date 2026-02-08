
import React from 'react';
import { Shield, Activity, Zap, AlertTriangle, ChevronRight, CheckCircle2 } from 'lucide-react';
import { DayRiskReport, HistoricalProof } from './types.ts';

interface DashboardViewProps {
  report: DayRiskReport;
  proofs: HistoricalProof[];
}

const DashboardView: React.FC<DashboardViewProps> = ({ report, proofs }) => {
  const getRiskColor = (score: number) => {
    if (score > 70) return 'text-red-500';
    if (score > 40) return 'text-amber-500';
    return 'text-emerald-500';
  };

  const getRiskStroke = (score: number) => {
    if (score > 70) return '#ef4444';
    if (score > 40) return '#f59e0b';
    return '#10b981';
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Cycle Intelligence</h1>
          <p className="text-slate-400 font-medium">Deterministic risk assessment for <span className="text-indigo-400 font-bold">{report.symbol}</span></p>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-[10px] mono text-slate-500 uppercase tracking-widest font-bold">Current Cycle Date</p>
          <p className="text-xl font-bold mono text-slate-200">{report.date}</p>
        </div>
      </header>

      <section className="bg-slate-900/40 border border-white/10 rounded-[2.5rem] p-10 flex flex-col lg:flex-row items-center gap-16 backdrop-blur-xl relative overflow-hidden group shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-indigo-600/10 transition-colors duration-700" />
        
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
              stroke={getRiskStroke(report.riskScore)}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-6xl font-bold mono tracking-tighter ${getRiskColor(report.riskScore)}`}>{report.riskScore}</span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">Stress idx</span>
          </div>
        </div>
        
        <div className="flex-1 space-y-6 relative z-10">
          <div className="flex items-center gap-4">
            <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all duration-500 ${report.riskScore > 70 ? 'bg-red-500/10 border-red-500/30 text-red-500' : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'}`}>
              {report.regime} Regime Active
            </span>
          </div>
          <p className="text-lg text-slate-300 leading-relaxed font-medium">
            {report.explanation}
          </p>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-500 bg-black/20 w-fit px-4 py-2 rounded-xl border border-white/5">
            <Activity className="w-4 h-4 text-indigo-500" /> {report.planetarySummary}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        {[
          { label: 'Structural', value: report.factors.structural, color: 'bg-indigo-500', icon: Shield },
          { label: 'Momentum', value: report.factors.momentum, color: 'bg-red-500', icon: Activity },
          { label: 'Volatility', value: report.factors.volatility, color: 'bg-amber-500', icon: Zap },
          { label: 'Deception', value: report.factors.deception, color: 'bg-violet-500', icon: AlertTriangle }
        ].map(dim => (
          <div key={dim.label} className="bg-slate-900/40 border border-white/10 p-6 rounded-3xl hover:border-white/20 transition-all hover:translate-y-[-2px] backdrop-blur-sm group">
            <div className="flex justify-between items-center mb-6">
              <div className="p-2.5 rounded-xl bg-slate-950/50 border border-white/5 group-hover:border-indigo-500/30 transition-colors">
                <dim.icon className="w-5 h-5 text-slate-400 group-hover:text-indigo-400" />
              </div>
              <span className="mono text-xl font-bold text-slate-100">{dim.value}<span className="text-[10px] text-slate-600 font-normal ml-1">/25</span></span>
            </div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">{dim.label} Weight</p>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
              <div className={`h-full ${dim.color} shadow-[0_0_10px_rgba(0,0,0,0.5)] transition-all duration-1000 ease-out`} style={{ width: `${(dim.value/25)*100}%` }} />
            </div>
          </div>
        ))}
      </div>

      <section className="bg-slate-900/40 border border-white/10 rounded-[2.5rem] p-10 shadow-xl backdrop-blur-md">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h3 className="text-xl font-bold text-white">Historical Convergence</h3>
            <p className="text-sm text-slate-500 mt-1">Correlation between intelligence and market reality</p>
          </div>
          <button className="text-indigo-400 text-xs font-bold uppercase tracking-widest hover:text-indigo-300 flex items-center gap-2 group p-2">
            Verification Suite <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
        <div className="flex gap-6 overflow-x-auto pb-6 no-scrollbar snap-x">
          {proofs.map((p, i) => (
            <div key={i} className={`min-w-[200px] snap-center p-6 rounded-[2rem] border transition-all duration-300 hover:scale-[1.02] cursor-pointer ${i === 0 ? 'bg-indigo-500/10 border-indigo-500/40 ring-1 ring-indigo-500/20' : 'bg-slate-950/40 border-white/5 hover:border-white/10'}`}>
              <div className="flex justify-between items-start mb-6">
                <span className="text-[10px] font-bold text-slate-500 uppercase mono tracking-tighter">{p.date}</span>
                {p.isCorrect ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <div className="w-4 h-4 rounded-full border border-slate-700" />}
              </div>
              <div className="mb-6">
                <p className={`text-4xl font-bold mono tracking-tighter ${p.score > 70 ? 'text-red-500' : 'text-amber-500'}`}>{p.score}</p>
                <p className="text-[9px] font-bold text-slate-600 uppercase mt-1 tracking-widest">Risk Index</p>
              </div>
              <div className="pt-4 border-t border-white/5">
                <p className={`text-lg font-bold mono ${p.actualReturn < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {p.actualReturn > 0 ? '+' : ''}{p.actualReturn}%
                </p>
                <p className="text-[9px] font-bold text-slate-600 uppercase mt-1 tracking-widest">Price Action</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default DashboardView;
