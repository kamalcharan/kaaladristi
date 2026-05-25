import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut, Shield, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { signOut } from '@/services/auth';

// ── Nav definition ──────────────────────────────────────────────────────────
// Glyphs are Fraunces/Unicode characters, matching dashboard-LOCKED.html
type NavItem = { to: string; glyph: string; label: string; adminOnly?: boolean };
type NavSection = { heading: string; items: NavItem[]; adminHeading?: boolean };

const navSections: NavSection[] = [
  {
    heading: 'View',
    items: [
      { to: '/workspace',      glyph: '⊞', label: 'Workspace' },
      { to: '/dashboard',      glyph: '◉', label: 'Dashboard' },
      { to: '/scanner',        glyph: '⊙', label: 'Scanner' },
      { to: '/market-structure', glyph: '⊞', label: 'Market Structure' },
      { to: '/planetary-intel', glyph: '☽', label: 'Planetary Intel' },
    ],
  },
  {
    heading: 'Admin',
    adminHeading: true,
    items: [
      { to: '/markets',             glyph: '◎', label: 'Markets',             adminOnly: true },
      { to: '/industry-transition', glyph: '⇌', label: 'Industry Transition', adminOnly: true },
      { to: '/manipulation-watch',  glyph: '⊘', label: 'Manipulation Watch',  adminOnly: true },
      { to: '/panchang',            glyph: '☿', label: 'Panchang',            adminOnly: true },
      { to: '/pulse/1',             glyph: '◌', label: 'Visual Pulse',        adminOnly: true },
      { to: '/intraday/1',          glyph: '◐', label: 'Intraday',             adminOnly: true },
      { to: '/inference',           glyph: '✎', label: 'Inference DB',        adminOnly: true },
      { to: '/rule-eval',           glyph: '⊛', label: 'Rule Eval',           adminOnly: true },
      { to: '/transmission',        glyph: '⇝', label: 'Risk Transmission',   adminOnly: true },
      { to: '/history',             glyph: '↺', label: 'Backtest',            adminOnly: true },
      { to: '/settings',            glyph: '◈', label: 'Settings',            adminOnly: true },
      { to: '/data-pipeline',       glyph: '▦', label: 'Data Pipeline',       adminOnly: true },
      { to: '/admin/panchang',      glyph: '⊟', label: 'Panchang Admin',      adminOnly: true },
      { to: '/rules',               glyph: '⊠', label: 'Rule Engine',         adminOnly: true },
    ],
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(profile: { full_name?: string | null; display_name?: string | null; email?: string | null }): string {
  const name = profile.display_name || profile.full_name || profile.email || '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatFooterDate(): string {
  const now = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[now.getDay()]} · ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
}

function marketStatus(): string {
  // NSE: Mon–Fri 09:15–15:30 IST (UTC+5:30)
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  const day = ist.getUTCDay();
  const h = ist.getUTCHours();
  const m = ist.getUTCMinutes();
  const mins = h * 60 + m;
  if (day === 0 || day === 6) return 'Market closed · Weekend';
  if (mins < 9 * 60 + 15) return 'Pre-market';
  if (mins <= 15 * 60 + 30) return 'Market open';
  return 'Market closed';
}

// ── Component ────────────────────────────────────────────────────────────────

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { profile, isAdmin, clear } = useAuthStore();
  const navigate = useNavigate();

  const handleSignOut = () => {
    clear();
    navigate('/', { replace: true });
    signOut().catch(() => {});
  };

  return (
    <nav
      className={cn(
        'fixed h-full z-[100] flex flex-col overflow-hidden transition-all duration-300',
      )}
      style={{
        width: collapsed ? '52px' : '220px',
        background: 'rgba(11,17,32,0.6)',
        borderRight: '1px solid var(--border)',
        padding: collapsed ? '28px 8px' : '28px 16px',
      }}
    >
      {/* ── Brand ── */}
      {!collapsed ? (
        <>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '24px',
              fontWeight: 500,
              padding: '0 12px 4px',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            Dristi<em style={{ color: 'var(--gold)', fontStyle: 'italic', fontWeight: 400 }}>Q</em>
          </div>
          <div
            style={{
              padding: '0 12px',
              fontSize: '11px',
              color: 'var(--text-faint)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-mono)',
              marginBottom: '28px',
            }}
          >
            Market Weather
          </div>
        </>
      ) : (
        /* Collapsed: show expand chevron */
        <button
          onClick={onToggle}
          title="Expand sidebar"
          className="mx-auto mb-6 flex items-center justify-center transition-colors"
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            color: 'var(--text-faint)',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-faint)')}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* ── Collapse toggle (visible when expanded) ── */}
      {!collapsed && (
        <button
          onClick={onToggle}
          title="Collapse sidebar"
          className="absolute top-[28px] right-[12px] flex items-center justify-center transition-colors"
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '4px',
            color: 'var(--text-faint)',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-faint)')}
        >
          {/* ‹ chevron pointing left */}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 2L4 6l4 4" />
          </svg>
        </button>
      )}

      {/* ── Nav sections ── */}
      <div className="flex flex-col flex-1 overflow-y-auto no-scrollbar" style={{ gap: '0' }}>
        {navSections.map((section, si) => {
          const visibleItems = section.items.filter(item => !item.adminOnly || isAdmin);
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.heading} style={{ marginTop: si > 0 ? '24px' : '0' }}>
              {/* Section heading */}
              {!collapsed && (
                <div
                  style={{
                    padding: '0 12px 8px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    color: section.adminHeading ? 'var(--indigo)' : 'var(--text-faint)',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    opacity: section.adminHeading ? 0.8 : 1,
                  }}
                >
                  {section.heading}
                </div>
              )}

              {/* Nav items */}
              {visibleItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  title={item.label}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: collapsed ? 0 : '11px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    padding: collapsed ? '9px 0' : '9px 12px',
                    borderRadius: '8px',
                    color: isActive
                      ? (section.adminHeading ? 'var(--indigo)' : 'var(--gold-soft)')
                      : 'var(--text-muted)',
                    fontSize: '13.5px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.18s',
                    marginBottom: '1px',
                    background: isActive
                      ? (section.adminHeading ? 'rgba(99,102,241,0.12)' : 'var(--gold-bg)')
                      : 'transparent',
                    textDecoration: 'none',
                  })}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.background = section.adminHeading
                      ? 'rgba(99,102,241,0.08)'
                      : 'rgba(255,255,255,0.04)';
                    el.style.color = 'var(--text-secondary)';
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.background = 'transparent';
                    el.style.color = 'var(--text-muted)';
                  }}
                >
                  {({ isActive }) => (
                    <>
                      <span
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '14px',
                          width: '16px',
                          textAlign: 'center',
                          opacity: isActive ? 1 : 0.75,
                          flexShrink: 0,
                        }}
                      >
                        {item.glyph}
                      </span>
                      {!collapsed && (
                        <span className="truncate leading-none">{item.label}</span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          );
        })}
      </div>

      {/* ── Footer: user + date ── */}
      <div
        style={{
          marginTop: 'auto',
          paddingTop: '14px',
          paddingBottom: '4px',
          paddingLeft: collapsed ? '0' : '12px',
          paddingRight: collapsed ? '0' : '12px',
          borderTop: '1px solid var(--border)',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          color: 'var(--text-faint)',
        }}
      >
        {collapsed ? (
          /* Collapsed footer: just sign-out icon */
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: 'var(--gold-bg)', color: 'var(--gold-soft)', fontSize: '10px', fontWeight: 700 }}
              title={profile?.display_name || profile?.full_name || profile?.email || 'User'}
            >
              {profile ? getInitials(profile) : '?'}
            </div>
            <button
              onClick={handleSignOut}
              title="Sign out"
              className="flex items-center justify-center transition-colors"
              style={{ color: 'var(--text-faint)', width: '20px', height: '20px' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-primary)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-faint)')}
            >
              <LogOut className="w-3 h-3" />
            </button>
          </div>
        ) : (
          /* Expanded footer: user row + date line */
          <>
            <div className="flex items-center gap-2 mb-2">
              <div className="relative shrink-0">
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center"
                  style={{ background: 'var(--gold-bg)', color: 'var(--gold-soft)', fontSize: '10px', fontWeight: 700 }}
                  title={profile?.display_name || profile?.full_name || profile?.email || 'User'}
                >
                  {profile ? getInitials(profile) : '?'}
                </div>
                {isAdmin && (
                  <div
                    className="absolute -top-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--indigo)' }}
                    title="Admin"
                  >
                    <Shield className="w-1.5 h-1.5 text-white" />
                  </div>
                )}
              </div>
              <span className="flex-1 truncate" style={{ color: 'var(--text-faint)', fontSize: '11px' }}>
                {profile?.display_name || profile?.full_name || profile?.email || 'User'}
              </span>
              <button
                onClick={handleSignOut}
                title="Sign out"
                className="flex items-center justify-center transition-colors shrink-0"
                style={{ color: 'var(--text-faint)', width: '20px', height: '20px' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-primary)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-faint)')}
              >
                <LogOut className="w-3 h-3" />
              </button>
            </div>
            <div style={{ lineHeight: 1.5 }}>
              {formatFooterDate()}<br />
              {marketStatus()}
            </div>
          </>
        )}
      </div>
    </nav>
  );
}
