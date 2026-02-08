
import React from 'react';
import { 
  LayoutDashboard, 
  Globe, 
  Calendar as CalendarIcon, 
  Zap, 
  History as HistoryIcon, 
  Settings as SettingsIcon, 
  Shield 
} from 'lucide-react';
import { ViewType } from './types.ts';

interface SidebarProps {
  active: ViewType;
  onSelect: (v: ViewType) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ active, onSelect }) => {
  const items = [
    { id: 'dashboard' as ViewType, icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'markets' as ViewType, icon: Globe, label: 'Markets' },
    { id: 'calendar' as ViewType, icon: CalendarIcon, label: 'Calendar' },
    { id: 'transmission' as ViewType, icon: Zap, label: 'Risk Transmission' },
    { id: 'history' as ViewType, icon: HistoryIcon, label: 'Backtest' },
    { id: 'settings' as ViewType, icon: SettingsIcon, label: 'Settings' }
  ];

  return (
    <nav className="w-[72px] bg-[#0f172a]/80 backdrop-blur-2xl border-r border-white/5 fixed h-full z-[100] flex flex-col items-center py-6">
      <div className="w-11 h-11 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-[14px] flex items-center justify-center text-xl mb-8 shadow-lg shadow-indigo-500/20">
        ⟡
      </div>
      <div className="flex flex-col gap-2 flex-1">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            title={item.label}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all group ${active === item.id ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-500 hover:bg-slate-800/50 hover:text-slate-200'}`}
          >
            <item.icon className="w-[22px] h-[22px]" />
          </button>
        ))}
      </div>
      <div className="mt-auto">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-500 flex items-center justify-center font-bold text-xs">R</div>
      </div>
    </nav>
  );
};

export default Sidebar;
