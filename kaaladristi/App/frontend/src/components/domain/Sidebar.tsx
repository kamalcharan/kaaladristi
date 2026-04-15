import {
  LayoutDashboard,
  Globe,
  Calendar as CalendarIcon,
  CalendarDays,
  Zap,
  History as HistoryIcon,
  Settings as SettingsIcon,
  LogOut,
  Shield,
  Sparkles,
  Activity,
  Eye,
  ChevronLeft,
  ScanSearch,
  ShieldAlert,
} from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { signOut } from '@/services/auth';

type NavItem = {
  to: string;
  icon: React.ElementType;
  label: string;
};

type NavSection = {
  heading?: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/markets',   icon: Globe,           label: 'Markets' },
    ],
  },
  {
    heading: 'ANALYSIS',
    items: [
      { to: '/astro-calendar', icon: CalendarDays, label: 'Planetary Intel' },
      { to: '/inference',      icon: Sparkles,     label: 'Inference DB' },
      { to: '/rule-eval',      icon: Activity,     label: 'Rule Eval'    },
      { to: '/pulse/1',         icon: Eye,          label: 'Visual Pulse' },
      { to: '/scan',            icon: ScanSearch,   label: 'Scanner' },
      { to: '/manipulation-watch', icon: ShieldAlert, label: 'Manipulation Watch' },
      { to: '/calendar',       icon: CalendarIcon, label: 'Risk Calendar' },
      { to: '/transmission',   icon: Zap,          label: 'Risk Transmission' },
    ],
  },
  {
    heading: 'RESEARCH',
    items: [
      { to: '/history',   icon: HistoryIcon,  label: 'Backtest' },
      { to: '/settings',  icon: SettingsIcon, label: 'Settings' },
    ],
  },
];

function getInitials(profile: { full_name?: string | null; display_name?: string | null; email?: string | null }): string {
  const name = profile.display_name || profile.full_name || profile.email || '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

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
        'bg-kd-bg/80 backdrop-blur-2xl border-r border-kd-border fixed h-full z-[100] flex flex-col py-4 overflow-hidden transition-all duration-300',
        collapsed ? 'w-[52px]' : 'w-[220px]'
      )}
    >
      {/* ── Logo + Collapse Toggle ── */}
      <div className={cn('flex items-center mb-5 shrink-0 px-3', collapsed ? 'justify-center' : 'gap-2')}>
        <div className="w-8 h-8 shrink-0 bg-gradient-to-br from-accent-indigo to-accent-violet rounded-[10px] flex items-center justify-center text-base shadow-lg shadow-indigo-500/20">
          &#x27E1;
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold tracking-tight text-[var(--text-primary)] leading-tight flex-1 truncate">
            Kāla-Drishti
          </span>
        )}
        <button
          onClick={onToggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:bg-kd-elevated hover:text-[var(--text-secondary)] transition-all shrink-0',
            collapsed && 'hidden'
          )}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Expand button (only visible when collapsed) */}
      {collapsed && (
        <button
          onClick={onToggle}
          title="Expand sidebar"
          className="mx-auto mb-2 w-8 h-5 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:bg-kd-elevated hover:text-[var(--text-secondary)] transition-all"
        >
          <ChevronLeft className="w-3.5 h-3.5 rotate-180" />
        </button>
      )}

      {/* ── Nav Sections ── */}
      <div className="flex flex-col flex-1 overflow-y-auto no-scrollbar gap-0.5">
        {navSections.map((section, si) => (
          <div key={si}>
            {si > 0 && (
              <div className="mt-2 mb-0.5">
                <div className="mx-3 border-t border-kd-border mb-1.5" />
                {section.heading && !collapsed && (
                  <p className="text-[9px] uppercase tracking-[0.2em] text-[var(--text-muted)] font-bold px-4 py-0.5">
                    {section.heading}
                  </p>
                )}
              </div>
            )}

            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={item.label}
                className={({ isActive }) =>
                  cn(
                    'group relative flex items-center mx-2 px-2 py-2 rounded-lg transition-all duration-150 text-sm',
                    collapsed ? 'justify-center' : 'gap-3',
                    isActive
                      ? 'bg-accent-indigo/10 text-accent-indigo border-l-[3px] border-accent-indigo'
                      : 'text-[var(--text-muted)] hover:bg-kd-elevated hover:text-[var(--text-secondary)] border-l-[3px] border-transparent'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className={cn(
                        'w-[18px] h-[18px] shrink-0',
                        isActive ? 'text-accent-indigo' : 'text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]'
                      )}
                    />
                    {!collapsed && <span className="truncate leading-none">{item.label}</span>}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </div>

      {/* ── User Section ── */}
      <div className="mt-auto pt-3 border-t border-kd-border shrink-0">
        <div className={cn('flex items-center px-3 py-1.5', collapsed ? 'flex-col gap-2' : 'gap-3')}>
          <div
            className="relative shrink-0"
            title={profile?.display_name || profile?.full_name || profile?.email || 'User'}
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent-cyan to-accent-indigo flex items-center justify-center font-bold text-[10px] text-[var(--text-primary)]">
              {profile ? getInitials(profile) : '?'}
            </div>
            {isAdmin && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent-violet rounded-full flex items-center justify-center" title="Admin">
                <Shield className="w-1.5 h-1.5 text-white" />
              </div>
            )}
          </div>

          {!collapsed && (
            <span className="flex-1 text-xs text-[var(--text-secondary)] truncate leading-none">
              {profile?.display_name || profile?.full_name || profile?.email || 'User'}
            </span>
          )}

          <button
            onClick={handleSignOut}
            title="Sign out"
            className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:bg-kd-elevated hover:text-[var(--text-primary)] transition-all shrink-0"
          >
            <LogOut className="w-[13px] h-[13px]" />
          </button>
        </div>
      </div>
    </nav>
  );
}
