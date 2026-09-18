import ScannerCompanionDock from './VaNi/ScannerCompanionDock'
import VaNiPanelRail from './VaNi/VaNiPanelRail'
import { useVaNiPanelOpen } from '@/stores/vaniPanelStore'
import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVaNiStore } from '@/stores/vaniStore';
import Sidebar from './Sidebar';
import DataFreshnessChip from './DataFreshnessChip';
import SearchStrip from './SearchStrip';
import VaNiChatPanel from './VaNiChatPanel';
import StockAskPopover from './VaNi/StockAskPopover';
import JobMonitor from './JobMonitor';
import { NoiseOverlay } from '@/components/ui';
import PageTour from '@/components/ui/PageTour';

// Topbar "Ask VaNi" pill — hidden for launch (owner 2026-09-07).
const SHOW_ASK_VANI = false

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

  // VaNi is docked as a column on Workspace instead of opening as an overlay.
  // The rail is forced narrow while it is: a 220px rail plus a 360px pane
  // leaves a 1440 laptop only 860px of canvas for a 12-column grid, where the
  // 52px rail leaves 1028. The stored preference is untouched — it applies
  // again on every other route.
  const pathname = useLocation().pathname;
  const structureDocked = pathname.startsWith('/market-structure');
  const scannerDocked = /^\/scanner\/(breakout_surge|weekly_movers|monthly_movers|weekly_decliners|monthly_decliners|breakdown_watch|gl_breakout|gl_retest|flower_pot_burst|stage_2_watch|stage_2_leaders|stage_3_watch|stage_4_leaders|vani_exit_watch|conviction_flow|power_buy|volume_drive|waking_giants|wg_ascent|wg_stirring|power_sell|smart_money|quiet_accumulation|distribution_warning)\/?$/.test(pathname);
  const sectorDocked = pathname.startsWith('/sector-rotation');
  const vaniDocked = pathname.startsWith('/workspace') || structureDocked || sectorDocked;

  // The companion is collapsible from its own header and from Account →
  // Appearance; both write one stored preference (constants/vaniPanel.ts).
  // Every companion route funnels through the two slots below, so this is the
  // only place that has to know about the closed state.
  //
  // `scannerDocked` decides who owns the COLUMN when open (only the 24 preset
  // routes get one). The rail has to cover more than that: ScanView also
  // renders on /scanner and /scanners/:presetId, where the companion falls
  // back to rendering inline in the page, and ScannerCompanionShell returns
  // null while the panel is closed. Without the wider test those two routes
  // would lose VaNi with nothing to bring it back.
  const scannerRoute = pathname.startsWith('/scanner');
  const companionOpen = useVaNiPanelOpen();
  const companionShown = (vaniDocked || scannerDocked) && companionOpen;
  const railShown = (vaniDocked || scannerRoute) && !companionOpen;

  // The nav rail is forced narrow only to make room for the companion. With
  // the companion collapsed that justification is gone, so the user's own
  // stored sidebar preference applies again.
  const railCollapsed = collapsed || companionShown;

  return (
    <div
      className="flex min-h-screen"
      style={{
        background: 'var(--bg)',
        color: 'var(--text-primary)',
        // On the wrapper, not on <main>: the docked pane is main's sibling and
        // has to read the rail width to sit beside it.
        '--sidebar-w': railCollapsed ? '52px' : '220px',
        '--vani-w': vaniDocked && companionOpen ? '360px' : '0px',
        '--topbar-h': '75px',
      } as React.CSSProperties}
    >
      <NoiseOverlay />
      <Sidebar
        collapsed={railCollapsed}
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
          style={{ minWidth: 0 }}
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

            {/* VaNi button — indigo-bg, indigo border, pill.
                Hidden for launch (owner 2026-09-07); flip SHOW_ASK_VANI to restore.
                The per-card ✦ triggers and the drawer itself stay wired. */}
            {SHOW_ASK_VANI && <button
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
            </button>}
          </div>
        </header>

        {/* Page content. The docked pane lives INSIDE this row, below the
            topbar — as a sibling of <main> it split the topbar in two and the
            screen read as two applications stitched together. */}
        <div className={`relative z-10 flex gap-4 p-4 pb-8 ${!companionShown ? '' : sectorDocked || scannerDocked ? 'flex-col xl:flex-row' : structureDocked ? 'flex-col lg:flex-row' : ''}`}>
          {railShown && <VaNiPanelRail />}
          {scannerDocked && companionOpen && <ScannerCompanionDock presetId={pathname.split('/')[2]} />}
          {vaniDocked && companionOpen && <VaNiChatPanel docked />}
          <div className="flex-1 min-w-0">
            <Outlet />
          </div>
        </div>
      </main>

      {!vaniDocked && <VaNiChatPanel />}
      <StockAskPopover />
      <JobMonitor />
    </div>
  );
}
