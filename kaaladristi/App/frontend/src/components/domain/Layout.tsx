import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';

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
        className="flex-1 p-4 relative transition-[margin-left] duration-300"
        style={{ marginLeft: collapsed ? '52px' : '220px' }}
      >
        <div className={`${isFullWidth ? 'max-w-full' : 'max-w-6xl mx-auto'} relative z-10 pb-8`}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
