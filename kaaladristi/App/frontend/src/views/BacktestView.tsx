import { History } from 'lucide-react';

export default function BacktestView() {
  return (
    <div className="animate-fade-in">
      <header className="mb-6 sm:mb-10">
        <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary)] mb-2">Backtest & History</h1>
        <p className="text-secondary font-medium">Historical correlation validation</p>
      </header>
      <div className="glass-card rounded-4xl p-8 sm:p-16 flex flex-col items-center justify-center text-center">
        <History className="w-16 h-16 text-muted mb-6" />
        <p className="text-lg font-semibold text-[var(--text-secondary)] mb-2">Backtest view coming in Sprint 3</p>
        <p className="text-sm text-muted">Will display historical accuracy and correlation data</p>
      </div>
    </div>
  );
}
