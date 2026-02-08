
import React from 'react';
import { ArrowUp, ArrowDown, Activity, ShieldCheck, TrendingDown, TrendingUp } from 'lucide-react';

const MarketsView: React.FC = () => {
  const indices = [
    { id: 'NIFTY', name: 'NIFTY 50', change: '-0.24%', score: 68, regime: 'Distribution', trend: 'down' },
    { id: 'BANKNIFTY', name: 'BANKNIFTY', change: '-0.68%', score: 82, regime: 'Protection', trend: 'down' },
    { id: 'NIFTYIT', name: 'NIFTY IT', change: '-1.12%', score: 45, regime: 'Expansion', trend: 'down' },
    { id: 'NIFTYFMCG', name: 'NIFTY FMCG', change: '+0.32%', score: 25, regime: 'Accumulation', trend: 'up' }
  ];

  const getScoreColor = (score: number) => {
    if (score > 70) return 'text-red-500 border-red-500/30 bg-red-500/10';
    if (score > 40) return 'text-amber-500 border-amber-500/30 bg-amber-500/10';
    return 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10';
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Market Topology</h1>
          <p className="text-slate-400 font-medium italic">Relative temporal stress across key benchmarks</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {indices.map(idx => (
          <div key={idx.id} className={`bg-slate-900/40 border rounded-[2rem] p-8 transition-all hover:border-indigo-500/30 group cursor-pointer backdrop-blur-sm relative overflow-hidden ${idx.score > 70 ? 'border-red-500/10' : 'border-white/5 shadow-xl'}`}>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="font-bold text-xl text-white group-hover:text-indigo-300 transition-colors mb-1">{idx.name}</h3>
                <div className="flex items-center gap-1.5">
                  {idx.trend === 'up' ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <TrendingDown className="w-3 h-3 text-red-500" />}
                  <p className={`text-xs mono font-bold ${idx.change.startsWith('-') ? 'text-red-500' : 'text-emerald-500'}`}>{idx.change}</p>
                </div>
              </div>
              <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center border transition-all duration-500 ${getScoreColor(idx.score)}`}>
                <span className="text-xl font-bold mono leading-none">{idx.score}</span>
                <span className="text-[7px] font-bold uppercase tracking-tighter mt-0.5">Risk</span>
              </div>
            </div>

            <div className="space-y-4">
              <span className={`inline-block px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest border ${idx.score > 70 ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'}`}>
                {idx.regime}
              </span>
              
              <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Active Influence</p>
                <div className="flex -space-x-1.5">
                  {[1,2,3].map(i => <div key={i} className="w-4 h-4 rounded-full bg-slate-800 border border-slate-950" />)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <section className="bg-slate-900/40 border border-white/10 rounded-[2.5rem] p-10 backdrop-blur-xl">
        <div className="flex items-center gap-3 mb-12">
          <ShieldCheck className="w-6 h-6 text-indigo-500" />
          <h3 className="text-xl font-bold text-white uppercase tracking-tight">Sector Heatmap Convergence</h3>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
          <div className="space-y-8">
            <h4 className="text-[10px] font-bold text-red-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500" /> High Vulnerability Clusters
            </h4>
            {[
              { sector: 'IT Services', weight: 14.2, sensitivity: 85, color: 'bg-red-500', icon: '0x01' },
              { sector: 'Private Banks', weight: 21.5, sensitivity: 78, color: 'bg-red-500', icon: '0x02' },
              { sector: 'Energy/Oil', weight: 11.2, sensitivity: 55, color: 'bg-amber-500', icon: '0x03' }
            ].map(s => (
               <div key={s.sector} className="group">
                 <div className="flex justify-between items-end mb-3">
                   <div className="flex items-center gap-3">
                     <span className="mono text-[10px] text-slate-700 font-bold">{s.icon}</span>
                     <span className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">{s.sector}</span>
                   </div>
                   <div className="text-right">
                     <span className="mono text-xs font-bold text-slate-500 mr-3">{s.weight}% Weight</span>
                     <span className={`mono text-xs font-bold ${s.sensitivity > 70 ? 'text-red-500' : 'text-amber-500'}`}>{s.sensitivity}% Stress</span>
                   </div>
                 </div>
                 <div className="h-2.5 bg-slate-950 rounded-full overflow-hidden border border-white/5 flex p-[1px]">
                    <div className={`${s.color} h-full rounded-full transition-all duration-1000 group-hover:opacity-80`} style={{ width: s.sensitivity + '%' }} />
                 </div>
               </div>
            ))}
          </div>

          <div className="hidden lg:flex flex-col items-center justify-center p-8 bg-black/20 rounded-[2rem] border border-white/5 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/5 to-transparent" />
            <Activity className="w-12 h-12 text-indigo-500/20 mb-6 group-hover:scale-110 transition-transform duration-700" />
            <p className="text-center text-slate-400 text-sm max-w-xs leading-relaxed font-medium">
              Intelligence suggest that <span className="text-white font-bold">Banking</span> is currently the primary vector for temporal risk transmission into NIFTY 50.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default MarketsView;
