import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import Sidebar from './Sidebar';
import DataFreshnessChip from './DataFreshnessChip';
import SearchStrip from './SearchStrip';
import VaNiChatPanel from './VaNiChatPanel';

export default function Layout() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('kd_sidebar_collapsed') === 'true'
  );
  const [vaniOpen, setVaniOpen] = useState(false);
  const location = useLocation();

  const toggle = () => setCollapsed(v => {
    localStorage.setItem('kd_sidebar_collapsed', String(!v));
    return !v;
  });

  // Chart pages need full width for the side panel
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
              onClick={() => setVaniOpen(v => !v)}
              title="Ask VaNi"
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all',
                'border',
                vaniOpen
                  ? 'bg-[var(--accent-indigo)]/15 border-[var(--accent-indigo)]/30 text-[var(--accent-indigo)]'
                  : 'bg-kd-surface border-kd-border text-[var(--text-muted)] hover:border-[var(--accent-indigo)]/30 hover:text-[var(--accent-indigo)]',
              )}
            >
              <Sparkles className="w-3 h-3" />
              <span>VaNi</span>
            </button>
            <DataFreshnessChip />
          </div>
        </div>

        <div className={`${isFullWidth ? 'max-w-full' : 'max-w-6xl mx-auto'} relative z-10 p-4 pb-8`}>
          <Outlet />
        </div>
      </main>

      <VaNiChatPanel open={vaniOpen} onClose={() => setVaniOpen(false)} />
    </div>
  );
}
