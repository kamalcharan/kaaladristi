import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-kd-bg text-[var(--text-primary)] selection:bg-indigo-500/30">
      <Sidebar />

      <main className="flex-1 ml-[var(--sidebar-width)] p-6 lg:p-12 relative">
        <div className="max-w-6xl mx-auto relative z-10">
          {/* Page content */}
          <div className="pb-32">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
