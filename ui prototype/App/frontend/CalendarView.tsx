
import React from 'react';
import { MarketSymbol } from './types.ts';

interface CalendarViewProps {
  symbol: MarketSymbol;
}

const CalendarView: React.FC<CalendarViewProps> = ({ symbol }) => {
  const days = [
    { d: 'Mon', dt: 16, s: 68, r: 'Distribution', today: true },
    { d: 'Tue', dt: 17, s: 80, r: 'Protection', today: false },
    { d: 'Wed', dt: 18, s: 60, r: 'Distribution', today: false },
    { d: 'Thu', dt: 19, s: 40, r: 'Expansion', today: false },
    { d: 'Fri', dt: 20, s: 34, r: 'Accumulation', today: false },
    { d: 'Sat', dt: 21, s: 30, r: 'Accumulation', today: false },
    { d: 'Sun', dt: 22, s: 50, r: 'Expansion', today: false }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Temporal Calendar</h1>
        <p className="text-slate-400 mt-1">Strategic 7-day risk horizon for {symbol}</p>
      </header>
      <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
        {days.map(d => (
          <div key={d.dt} className={`bg-slate-900/40 border rounded-[2rem] p-6 flex flex-col items-center gap-4 transition-all ${d.today ? 'border-indigo-500 bg-indigo-500/5' : 'border-white/5'}`}>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{d.d}</span>
            <span className={`text-4xl font-bold mono ${d.today ? 'text-indigo-400' : 'text-slate-300'}`}>{d.dt}</span>
            <div className={`w-2.5 h-2.5 rounded-full ${d.s > 70 ? 'bg-red-500' : d.s > 40 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            <span className="text-[9px] font-bold text-slate-400 uppercase text-center">{d.r}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CalendarView;
