import { useAppStore } from '@/stores/appStore';
import { useDayRisk, useWeekRisk, useHistoricalProofs } from '@/hooks';
import DashboardView from './DashboardView';
import { SkeletonGauge, SkeletonCard } from '@/components/ui';
import { AlertTriangle } from 'lucide-react';

export default function DashboardPage() {
  const { selectedSymbol, selectedDate } = useAppStore();

  const dayRisk  = useDayRisk(selectedDate, selectedSymbol);
  const weekRisk = useWeekRisk(selectedDate, selectedSymbol);
  const proofs   = useHistoricalProofs(selectedSymbol);

  // ── Loading ──
  if (dayRisk.isLoading) {
    return (
      <div className="space-y-10 animate-fade-in">
        <header className="flex justify-between items-end">
          <div>
            <div className="h-10 w-72 bg-slate-800/60 rounded-xl animate-pulse" />
            <div className="h-5 w-48 bg-slate-800/40 rounded-lg animate-pulse mt-3" />
          </div>
        </header>
        <div className="glass-card rounded-5xl p-10 flex flex-col lg:flex-row items-center gap-16">
          <SkeletonGauge />
          <div className="flex-1 space-y-4 w-full">
            <div className="h-6 w-40 bg-slate-800/60 rounded-full animate-pulse" />
            <div className="h-5 w-full bg-slate-800/40 rounded-lg animate-pulse" />
            <div className="h-5 w-3/4 bg-slate-800/40 rounded-lg animate-pulse" />
            <div className="h-8 w-64 bg-slate-800/40 rounded-xl animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  // ── Error ──
  if (dayRisk.isError) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center animate-fade-in">
        <AlertTriangle className="w-16 h-16 text-risk-amber mb-6" />
        <p className="text-lg font-semibold text-slate-300 mb-2">Unable to load risk data</p>
        <p className="text-sm text-muted mb-6">{(dayRisk.error as Error)?.message || 'Unknown error'}</p>
        <button
          onClick={() => dayRisk.refetch()}
          className="px-6 py-2.5 bg-accent-indigo/20 border border-accent-indigo/40 rounded-xl text-sm font-medium text-accent-indigo hover:bg-accent-indigo/30 transition-all"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Empty ──
  if (!dayRisk.data) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center">
        <p className="text-lg text-slate-400">No data available</p>
        <p className="text-sm text-muted mt-2">No risk report for {selectedSymbol} on {selectedDate}</p>
      </div>
    );
  }

  return (
    <DashboardView
      report={dayRisk.data}
      proofs={proofs.data ?? []}
      weekData={weekRisk.data ?? []}
    />
  );
}
