import { Globe } from 'lucide-react';

export default function MarketsView() {
  return (
    <div className="animate-fade-in">
      <header className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Markets Overview</h1>
        <p className="text-secondary font-medium">Index risk profiles and sector analysis</p>
      </header>
      <div className="glass-card rounded-4xl p-16 flex flex-col items-center justify-center text-center">
        <Globe className="w-16 h-16 text-slate-600 mb-6" />
        <p className="text-lg font-semibold text-slate-400 mb-2">Markets view coming in Sprint 2</p>
        <p className="text-sm text-muted">Will display real-time index cards with risk scores from Supabase</p>
      </div>
    </div>
  );
}
