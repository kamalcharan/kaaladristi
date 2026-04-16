import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVaNiStore } from '@/stores/vaniStore';
import Sidebar from './Sidebar';
import DataFreshnessChip from './DataFreshnessChip';
import SearchStrip from './SearchStrip';
import VaNiChatPanel from './VaNiChatPanel';

export default function Layout() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('kd_sidebar_collapsed') === 'true'
  );
  const { open: vaniOpen, toggle: toggleVani } = useVaNiStore();
  const location = useLocation();

  const toggle = () => setCollapsed(v => {
    localStorage.setItem('kd_sidebar_collapsed', String(!v));
    return !v;
  });

  const isFullWidth = location.pathname.startsWith('/chart/') || location.pathname.startsWith('/pulse/');

  return (
    <div className="flex min-h-screen bg-kd-bg text-[var(--text-primary)] selection:bg-accent-indigo/30">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <main
        className="flex-1 relative transition-[margin-left] duration-300"
        style={{ marginLeft: collapsed ? '52px' : '220px' }}
      >
        {/* Global status bar */}
        <div className="sticky top-0 z-40 flex items-center gap-3 px-4 py-1.5 bg-kd-bg/80 backdrop-blur-sm border-b border-kd-border/30">
          <SearchStrip />
          <div className="ml-auto shrink-0 flex items-center gap-2">
            <button
              onClick={toggleVani}
              title="Ask VaNi"
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                'border shadow-sm',
                vaniOpen
                  ? 'bg-gradient-to-r from-[var(--accent-indigo)] to-[var(--accent-violet)] border-transparent text-white shadow-indigo-500/20'
                  : 'bg-gradient-to-r from-[var(--accent-indigo)]/10 to-[var(--accent-violet)]/10 border-[var(--accent-indigo)]/25 text-[var(--accent-indigo)] hover:from-[var(--accent-indigo)]/20 hover:to-[var(--accent-violet)]/20',
              )}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>VaNi</span>
              <span className="text-[9px] opacity-70 font-normal">· वाणी</span>
            </button>
            <DataFreshnessChip />
          </div>
        </div>

        <div className={`${isFullWidth ? 'max-w-full' : 'max-w-6xl mx-auto'} relative z-10 p-4 pb-8`}>
          <Outlet />
        </div>
      </main>

      <VaNiChatPanel />
    </div>
  );
}
