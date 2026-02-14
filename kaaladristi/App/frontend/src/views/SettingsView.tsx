import { Settings } from 'lucide-react';

export default function SettingsView() {
  return (
    <div className="animate-fade-in">
      <header className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Settings</h1>
        <p className="text-secondary font-medium">Application preferences and configuration</p>
      </header>
      <div className="glass-card rounded-4xl p-16 flex flex-col items-center justify-center text-center">
        <Settings className="w-16 h-16 text-slate-600 mb-6" />
        <p className="text-lg font-semibold text-slate-400 mb-2">Settings coming in Sprint 3</p>
        <p className="text-sm text-muted">Will include Supabase connection status and engine configuration</p>
      </div>
    </div>
  );
}
