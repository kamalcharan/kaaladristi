
import React from 'react';
import { ArrowRight } from 'lucide-react';
import { DayRiskReport } from './types.ts';

interface TransmissionViewProps {
  report: DayRiskReport;
}

const TransmissionView: React.FC<TransmissionViewProps> = ({ report }) => {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Risk Transmission</h1>
        <p className="text-slate-400 mt-1">Tracing how planetary factors flow into index weights</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_60px_1fr_60px_1fr] gap-0 items-stretch">
        <div className="flex flex-col gap-4">
          <div className="text-[10px] uppercase font-bold tracking-[0.2em] text-slate-500 bg-white/5 py-3 px-4 rounded-t-xl text-center">Planetary Factors</div>
          <div className="bg-slate-900/40 border-l-4 border-red-500 p-5 rounded-2xl border border-white/5">
             <span className="font-bold text-slate-200">Mercury Retrograde</span>
             <p className="text-[11px] text-slate-500 mt-2">73% Correlation to down days in IT.</p>
          </div>
        </div>
        <div className="flex items-center justify-center opacity-30"><ArrowRight /></div>
        <div className="flex flex-col gap-4">
          <div className="text-[10px] uppercase font-bold tracking-[0.2em] text-slate-500 bg-white/5 py-3 px-4 rounded-t-xl text-center">Sector Sensitivity</div>
          <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5">
             <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-2"><span>IT Services</span><span>85%</span></div>
             <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden border border-white/5">
                <div className="h-full bg-red-500" style={{ width: '85%' }} />
             </div>
          </div>
        </div>
        <div className="flex items-center justify-center opacity-30"><ArrowRight /></div>
        <div className="flex flex-col gap-4">
          <div className="text-[10px] uppercase font-bold tracking-[0.2em] text-slate-500 bg-white/5 py-3 px-4 rounded-t-xl text-center">Net Contribution</div>
          <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-6 text-center">
            <div className="text-4xl font-bold mono text-red-500 mb-2">+28</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest">Points Contribution</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransmissionView;
