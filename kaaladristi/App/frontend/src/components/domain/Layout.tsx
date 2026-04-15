import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import PipelineStatusDot from './PipelineStatusDot';

export default function Layout() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('kd_sidebar_collapsed') === 'true'
  );
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
        <div className="sticky top-0 z-40 flex items-center justify-end px-4 py-1.5 bg-kd-bg/80 backdrop-blur-sm border-b border-kd-border/30">
          <PipelineStatusDot />
        </div>

        <div className={`${isFullWidth ? 'max-w-full' : 'max-w-6xl mx-auto'} relative z-10 p-4 pb-8`}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
