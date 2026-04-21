import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
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

  const isFullWidth = location.pathname.startsWith('/chart/')
    || location.pathname.startsWith('/pulse/')
    || location.pathname.startsWith('/scanner');

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
      <Sidebar collapsed={collapsed} onToggle={toggle} />

      <main
        className="flex-1 relative transition-[margin-left] duration-300"
        style={{ marginLeft: collapsed ? '52px' : '220px' }}
      >
        {/* ── Topbar — matches dashboard-LOCKED.html .topbar ── */}
        <header
          className="sticky top-0 z-40 flex items-center justify-between border-b"
          style={{
            padding: '18px 40px',
            background: 'rgba(11,17,32,0.75)',
            backdropFilter: 'blur(10px)',
            borderBottomColor: 'var(--border)',
          }}
        >
          {/* Search pill */}
          <div className="w-[280px] shrink-0">
            <SearchStrip />
          </div>

          {/* Right cluster */}
          <div className="flex items-center" style={{ gap: '14px' }}>
            <DataFreshnessChip />

            {/* VaNi button — indigo-bg, indigo border, pill */}
            <button
              onClick={toggleVani}
              className={cn(
                'inline-flex items-center cursor-pointer transition-all',
                vaniOpen
                  ? 'text-white'
                  : ''
              )}
              style={{
                gap: '8px',
                padding: '8px 16px',
                background: vaniOpen ? 'var(--indigo)' : 'var(--indigo-bg)',
                border: '1px solid var(--border-indigo)',
                color: vaniOpen ? '#fff' : 'var(--indigo)',
                borderRadius: '100px',
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              <span style={{ fontSize: '13px' }}>✦</span>
              <span>Ask VaNi</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <div
          className={`relative z-10 p-4 pb-8 ${isFullWidth ? 'max-w-full' : 'max-w-6xl mx-auto'}`}
        >
          <Outlet />
        </div>
      </main>

      <VaNiChatPanel />
    </div>
  );
}
