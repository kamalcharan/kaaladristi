import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVaNiStore } from '@/stores/vaniStore';
import Sidebar from './Sidebar';
import DataFreshnessChip from './DataFreshnessChip';
import SearchStrip from './SearchStrip';
import VaNiChatPanel from './VaNiChatPanel';
import JobMonitor from './JobMonitor';
import { NoiseOverlay } from '@/components/ui';
import PageTour from '@/components/ui/PageTour';

export default function Layout() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('kd_sidebar_collapsed') === 'true'
  );
  // Mobile off-canvas drawer state — entirely separate from `collapsed`
  // (the desktop icon-only/full-label toggle). Below the `md` breakpoint the
  // sidebar is hidden by default and slides in over the content on request;
  // `collapsed` still tracks the desktop preference underneath, unaffected.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { open: vaniOpen, toggle: toggleVani } = useVaNiStore();

  const toggle = () => setCollapsed(v => {
    localStorage.setItem('kd_sidebar_collapsed', String(!v));
    return !v;
  });

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
      <NoiseOverlay />
      <Sidebar
        collapsed={collapsed}
        onToggle={toggle}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      {/* No left margin below `md` — the sidebar is an overlay there, not a
          pushed column, so it never reserves fixed screen width on a phone.
          `--sidebar-w` (set inline, since it's dynamic) only takes effect
          via the `md:ml-[var(--sidebar-w)]` class below — an inline `style`
          would win over any class unconditionally and break the mobile
          `ml-0`, so the actual margin is class-driven, referencing the var. */}
      <main
        className="flex-1 relative transition-[margin-left] duration-300 ml-0 md:ml-[var(--sidebar-w)]"
        style={{ '--sidebar-w': collapsed ? '52px' : '220px', minWidth: 0 } as React.CSSProperties}
      >
        {/* ── Topbar — matches dashboard-LOCKED.html .topbar ── */}
        <header
          className="sticky top-0 z-40 flex items-center justify-between border-b gap-3 px-4 py-3.5 md:px-10 md:py-[18px]"
          style={{
            background: 'var(--card)',
            backdropFilter: 'blur(10px)',
            borderBottomColor: 'var(--border)',
          }}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Hamburger — mobile only, opens the off-canvas sidebar */}
            <button
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
              className="md:hidden flex items-center justify-center shrink-0"
              style={{
                width: '34px', height: '34px', borderRadius: '8px',
                color: 'var(--text-secondary)', border: '1px solid var(--border)',
              }}
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Search pill — full flex-1 on mobile (no room for a fixed
                280px column there), fixed width from md up like before. */}
            <div className="min-w-0 flex-1 md:flex-none md:w-[280px]">
              <SearchStrip />
            </div>
          </div>

          {/* Right cluster — PageTour/DataFreshnessChip hidden below md:
              on a phone-width topbar, search + nav + Ask VaNi are the three
              affordances that actually need to fit; a page-tour walkthrough
              and the freshness chip are desktop conveniences, still fully
              present there. */}
          <div className="flex items-center shrink-0" style={{ gap: '10px' }}>
            <div className="hidden md:flex items-center" style={{ gap: '14px' }}>
              <PageTour />
              <DataFreshnessChip />
            </div>

            {/* VaNi button — indigo-bg, indigo border, pill */}
            <button
              onClick={toggleVani}
              className={cn(
                'inline-flex items-center cursor-pointer transition-all shrink-0',
                vaniOpen
                  ? 'text-white'
                  : ''
              )}
              style={{
                gap: '8px',
                padding: '8px 14px',
                background: vaniOpen ? 'var(--indigo)' : 'var(--indigo-bg)',
                border: '1px solid var(--border-indigo)',
                color: vaniOpen ? '#fff' : 'var(--indigo)',
                borderRadius: '100px',
                fontSize: '13px',
                fontWeight: 500,
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ fontSize: '13px' }}>✦</span>
              <span className="hidden sm:inline">Ask VaNi</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <div className="relative z-10 p-4 pb-8">
          <Outlet />
        </div>
      </main>

      <VaNiChatPanel />
      <JobMonitor />
    </div>
  );
}
