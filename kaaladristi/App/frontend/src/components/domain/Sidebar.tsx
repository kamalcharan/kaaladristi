import {
  LayoutDashboard,
  Globe,
  Calendar as CalendarIcon,
  Zap,
  History as HistoryIcon,
  Settings as SettingsIcon,
  LogOut,
  Shield,
} from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { signOut } from '@/services/auth';

const navItems = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/markets',      icon: Globe,           label: 'Markets' },
  { to: '/calendar',     icon: CalendarIcon,    label: 'Calendar' },
  { to: '/transmission', icon: Zap,             label: 'Risk Transmission' },
  { to: '/history',      icon: HistoryIcon,     label: 'Backtest' },
  { to: '/settings',     icon: SettingsIcon,    label: 'Settings' },
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

  const handleSignOut = async () => {
    try {
      await signOut();
      clear();
      navigate('/', { replace: true });
    } catch {
      // Force clear even if sign-out API fails
      clear();
      navigate('/', { replace: true });
    }
  };

  return (
    <nav className="w-[var(--sidebar-width)] bg-[#0f172a]/80 backdrop-blur-2xl border-r border-kd-border fixed h-full z-[100] flex flex-col items-center py-6">
      {/* Logo */}
      <div className="w-11 h-11 bg-gradient-to-br from-accent-indigo to-accent-violet rounded-[14px] flex items-center justify-center text-xl mb-8 shadow-lg shadow-indigo-500/20">
        &#x27E1;
      </div>

      {/* Nav Items */}
      <div className="flex flex-col gap-2 flex-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={item.label}
            className={({ isActive }) =>
              cn(
                'w-11 h-11 rounded-xl flex items-center justify-center transition-all',
                isActive
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'text-slate-500 hover:bg-slate-800/50 hover:text-slate-200'
              )
            }
          >
            <item.icon className="w-[22px] h-[22px]" />
          </NavLink>
        ))}
      </div>

      {/* Bottom: User section */}
      <div className="mt-auto flex flex-col items-center gap-3">
        {/* Sign out */}
        <button
          onClick={handleSignOut}
          title="Sign out"
          className="w-11 h-11 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-800/50 hover:text-slate-200 transition-all"
        >
          <LogOut className="w-[20px] h-[20px]" />
        </button>

        {/* User avatar */}
        <div className="relative" title={profile?.display_name || profile?.full_name || profile?.email || 'User'}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-500 flex items-center justify-center font-bold text-xs text-white">
            {profile ? getInitials(profile) : '?'}
          </div>
          {isAdmin && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-accent-violet rounded-full flex items-center justify-center" title="Admin">
              <Shield className="w-2.5 h-2.5 text-white" />
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
