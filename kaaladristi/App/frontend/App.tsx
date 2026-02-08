
import React, { useState, useEffect } from 'react';
import { Activity, RefreshCcw, Shield, Info } from 'lucide-react';
import { MarketSymbol, DayRiskReport, ViewType, HistoricalProof } from './types.ts';
import { getDailyRiskReport, getHistoricalProofs } from './geminiService.ts';

// Modular Imports
import Sidebar from './Sidebar.tsx';
import DashboardView from './DashboardView.tsx';
import MarketsView from './MarketsView.tsx';
import CalendarView from './CalendarView.tsx';
import TransmissionView from './TransmissionView.tsx';
import BacktestView from './BacktestView.tsx';
import SettingsView from './SettingsView.tsx';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [symbol, setSymbol] = useState<MarketSymbol>('NIFTY');
  const [report, setReport] = useState<DayRiskReport | null>(null);
  const [proofs, setProofs] = useState<HistoricalProof[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const fetchAppData = async () => {
    setIsLoading(true);
    // Check if we are in demo mode
    const hasKey = process.env.API_KEY && process.env.API_KEY.length > 5;
    setIsDemoMode(!hasKey);

    try {
      const today = new Date().toISOString().split('T')[0];
      const [newReport, newProofs] = await Promise.all([
        getDailyRiskReport(symbol, today),
        getHistoricalProofs(symbol)
      ]);
      setReport(newReport);
      setProofs(newProofs);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAppData();
  }, [symbol]);

  return (
    <div className="flex min-h-screen bg-[#030712] text-slate-100 selection:bg-indigo-500/30">
      <Sidebar active={activeView} onSelect={setActiveView} />
      
      <main className="flex-1 ml-[72px] p-6 lg:p-12 relative">
        <div className="max-w-6xl mx-auto relative z-10">
          
          {/* Header Area */}
          <div className="mb-10 flex flex-wrap items-center justify-between gap-6 border-b border-white/5 pb-8">
            <div className="flex items-center gap-6">
               <div className="bg-slate-900/60 border border-white/10 p-1.5 rounded-2xl flex backdrop-blur-md shadow-2xl">
                 {(['NIFTY', 'BANKNIFTY', 'NIFTYIT', 'NIFTYFMCG'] as MarketSymbol[]).map((s) => (
                   <button 
                    key={s}
                    onClick={() => setSymbol(s)}
                    className={`px-6 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-300 ${symbol === s ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}
                   >
                     {s}
                   </button>
                 ))}
               </div>

               {isDemoMode && (
                 <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[10px] font-bold text-amber-500 uppercase tracking-[0.2em] animate-pulse">
                   <Info className="w-3 h-3" /> Previewing Mock Intelligence
                 </div>
               )}
            </div>

            <div className="flex items-center gap-4">
               <div className="hidden md:flex items-center gap-3 px-5 py-2.5 bg-slate-900/40 border border-white/5 rounded-2xl text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                 <div className="w-2 h-2 rounded-full bg-indigo-500 live-dot" /> 
                 Temporal Feed Active
               </div>
            </div>
          </div>

          {isLoading ? (
            <div className="h-[60vh] flex flex-col items-center justify-center space-y-8 animate-in fade-in duration-700">
              <div className="relative scale-125">
                <RefreshCcw className="w-16 h-16 text-indigo-500/30 animate-spin" />
                <Shield className="w-6 h-6 text-indigo-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-xl font-medium tracking-tight text-slate-300">Calibrating Planetary Cycles</p>
                <p className="text-[10px] mono text-slate-600 uppercase tracking-[0.5em]">Synchronizing Lahiri Ayanamsa</p>
              </div>
            </div>
          ) : report && (
            <div className="pb-32">
              {activeView === 'dashboard' && <DashboardView report={report} proofs={proofs} />}
              {activeView === 'markets' && <MarketsView />}
              {activeView === 'calendar' && <CalendarView symbol={symbol} />}
              {activeView === 'transmission' && <TransmissionView report={report} />}
              {activeView === 'history' && <BacktestView />}
              {activeView === 'settings' && <SettingsView />}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
