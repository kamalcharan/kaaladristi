import { useState, useEffect } from 'react';
import { RefreshCcw, Shield } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { getDailyRiskReport, getHistoricalProofs } from '@/services/geminiService';
import type { DayRiskReport, HistoricalProof } from '@/types';
import DashboardView from './DashboardView';

export default function DashboardPage() {
  const { selectedSymbol } = useAppStore();
  const [report, setReport] = useState<DayRiskReport | null>(null);
  const [proofs, setProofs] = useState<HistoricalProof[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    const fetchData = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const [newReport, newProofs] = await Promise.all([
          getDailyRiskReport(selectedSymbol, today),
          getHistoricalProofs(selectedSymbol),
        ]);
        if (!cancelled) {
          setReport(newReport);
          setProofs(newProofs);
        }
      } catch (err) {
        console.error('[Dashboard] Fetch error:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [selectedSymbol]);

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-8 animate-fade-in">
        <div className="relative scale-125">
          <RefreshCcw className="w-16 h-16 text-indigo-500/30 animate-spin" />
          <Shield className="w-6 h-6 text-indigo-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <div className="text-center space-y-2">
          <p className="text-xl font-medium tracking-tight text-slate-300">Calibrating Planetary Cycles</p>
          <p className="text-[10px] font-mono text-slate-600 uppercase tracking-[0.5em]">Synchronizing Lahiri Ayanamsa</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center">
        <p className="text-lg text-slate-400">No data available</p>
        <p className="text-sm text-muted mt-2">Unable to load risk report for {selectedSymbol}</p>
      </div>
    );
  }

  return <DashboardView report={report} proofs={proofs} />;
}
