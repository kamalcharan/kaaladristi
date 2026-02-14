import {
  LayoutDashboard,
  Globe,
  Calendar as CalendarIcon,
  Zap,
  History as HistoryIcon,
  Settings as SettingsIcon,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/markets',      icon: Globe,           label: 'Markets' },
  { to: '/calendar',     icon: CalendarIcon,    label: 'Calendar' },
  { to: '/transmission', icon: Zap,             label: 'Risk Transmission' },
  { to: '/history',      icon: HistoryIcon,     label: 'Backtest' },
  { to: '/settings',     icon: SettingsIcon,    label: 'Settings' },
];

export default function Sidebar() {
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

      {/* User avatar */}
      <div className="mt-auto">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-500 flex items-center justify-center font-bold text-xs">
          K
        </div>
      </div>
    </nav>
  );
}
