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

export default function Sidebar() {
  const { profile, isAdmin, clear } = useAuthStore();
  const navigate = useNavigate();

  const handleSignOut = () => {
    // Clear local state and navigate first, then sign out from Supabase
    // (avoids race where onAuthStateChange unmounts component before navigate runs)
    clear();
    navigate('/', { replace: true });
    signOut().catch(() => {});
  };

  return (
    <nav className="w-[var(--sidebar-width)] bg-[#0f172a]/80 backdrop-blur-2xl border-r border-kd-border fixed h-full z-[100] flex flex-col py-5 overflow-hidden">

      {/* ── Logo + Brand ── */}
      <div className="flex items-center gap-3 px-4 mb-6 shrink-0">
        <div className="w-9 h-9 shrink-0 bg-gradient-to-br from-accent-indigo to-accent-violet rounded-[10px] flex items-center justify-center text-lg shadow-lg shadow-indigo-500/20">
          &#x27E1;
        </div>
        <span className="text-sm font-semibold tracking-tight text-slate-100 leading-tight">
          Kāla-Drishti
        </span>
      </div>

      {/* ── Nav Sections ── */}
      <div className="flex flex-col flex-1 overflow-y-auto no-scrollbar gap-1">
        {navSections.map((section, si) => (
          <div key={si}>
            {/* Divider + section heading */}
            {si > 0 && (
              <div className="mt-3 mb-1">
                <div className="mx-4 border-t border-white/[0.05] mb-2" />
                {section.heading && (
                  <p className="text-[9px] uppercase tracking-[0.2em] text-slate-600 font-bold px-4 py-1">
                    {section.heading}
                  </p>
                )}
              </div>
            )}

            {/* Items */}
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={item.label}
                className={({ isActive }) =>
                  cn(
                    'group relative flex items-center gap-3 mx-2 px-3 py-2 rounded-lg transition-all duration-150 text-sm',
                    isActive
                      ? 'bg-indigo-500/10 text-indigo-400 border-l-[3px] border-indigo-500 pl-[9px]'
                      : 'text-slate-500 hover:bg-slate-800/40 hover:text-slate-300 border-l-[3px] border-transparent pl-[9px]'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className={cn(
                        'w-[18px] h-[18px] shrink-0',
                        isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'
                      )}
                    />
                    <span className="truncate leading-none">{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </div>

      {/* ── User Section ── */}
      <div className="mt-auto pt-3 border-t border-white/[0.05] shrink-0">
        {/* User row */}
        <div className="flex items-center gap-3 px-4 py-2">
          {/* Avatar */}
          <div
            className="relative shrink-0"
            title={profile?.display_name || profile?.full_name || profile?.email || 'User'}
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-500 flex items-center justify-center font-bold text-[11px] text-white">
              {profile ? getInitials(profile) : '?'}
            </div>
            {isAdmin && (
              <div
                className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-accent-violet rounded-full flex items-center justify-center"
                title="Admin"
              >
                <Shield className="w-2 h-2 text-white" />
              </div>
            )}
          </div>

          {/* Name */}
          <span className="flex-1 text-xs text-slate-400 truncate leading-none">
            {profile?.display_name || profile?.full_name || profile?.email || 'User'}
          </span>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-800/50 hover:text-slate-200 transition-all shrink-0"
          >
            <LogOut className="w-[15px] h-[15px]" />
          </button>
        </div>
      </div>
    </nav>
  );
}
