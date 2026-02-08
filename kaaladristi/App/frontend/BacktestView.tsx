
import React from 'react';

const BacktestView: React.FC = () => {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Predictive Backtest</h1>
        <p className="text-slate-400 mt-1">Correlation verification: Risk Score vs Actual Price Action</p>
      </header>

      <section className="bg-slate-900/40 border border-white/5 rounded-[2.5rem] p-10 h-[500px] flex flex-col relative overflow-hidden">
         <div className="flex-1 flex items-end gap-2 relative">
            {[40, 55, 78, 62, 35, 42, 68, 82, 74, 50, 38, 45, 60, 75, 80, 68, 45, 30, 22, 55].map((v, i) => (
              <div key={i} className="flex-1 bg-indigo-500/20 rounded-t-lg transition-all" style={{ height: v + '%' }}>
                <div className={`w-full bg-indigo-500 rounded-t-lg`} style={{ height: '30%' }} />
              </div>
            ))}
         </div>
         <p className="text-center text-[10px] text-slate-500 uppercase mt-12 tracking-[0.5em] font-bold">Nov 2024 — Dec 2024 Verification Suite</p>
      </section>
    </div>
  );
};

export default BacktestView;
