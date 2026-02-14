import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import SymbolSwitcher from './SymbolSwitcher';

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-kd-bg text-[var(--text-primary)] selection:bg-indigo-500/30">
      <Sidebar />

      <main className="flex-1 ml-[var(--sidebar-width)] p-6 lg:p-12 relative">
        <div className="max-w-6xl mx-auto relative z-10">
          {/* Header */}
          <div className="mb-10 flex flex-wrap items-center justify-between gap-6 border-b border-kd-border pb-8">
            <div className="flex items-center gap-6">
              <SymbolSwitcher />
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-3 px-5 py-2.5 bg-slate-900/40 border border-kd-border rounded-2xl text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <div className="w-2 h-2 rounded-full bg-accent-indigo animate-pulse-live" />
                Temporal Feed Active
              </div>
            </div>
          </div>

          {/* Page content */}
          <div className="pb-32">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
