import { Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Shield } from 'lucide-react';
import Sidebar from './Sidebar';
import SymbolSwitcher from './SymbolSwitcher';
import { useAuthStore } from '@/stores/authStore';
import { signOut } from '@/services/auth';

export default function Layout() {
  const { profile, isAdmin, clear } = useAuthStore();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      clear();
      navigate('/', { replace: true });
    } catch {
      clear();
      navigate('/', { replace: true });
    }
  };

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

              {/* User info + Sign out */}
              <div className="flex items-center gap-3 pl-4 border-l border-kd-border">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-[13px] font-medium leading-tight">
                    {profile?.display_name || profile?.full_name || 'User'}
                  </span>
                  <span className="text-[11px] text-muted leading-tight flex items-center gap-1">
                    {isAdmin && <Shield className="w-3 h-3 text-accent-violet" />}
                    {profile?.email}
                  </span>
                </div>
                <button
                  onClick={handleSignOut}
                  title="Sign out"
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden md:inline text-[12px]">Log Off</span>
                </button>
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
