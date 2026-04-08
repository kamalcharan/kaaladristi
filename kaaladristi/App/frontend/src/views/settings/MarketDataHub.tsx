import { useState } from 'react';
import { ArrowLeft, BarChart3, TrendingUp, Package, ChevronRight } from 'lucide-react';
import IndexCatalog from './IndexCatalog';
import EquityCatalog from './EquityCatalog';
import CommodityCatalog from './CommodityCatalog';

type Section = 'index' | 'equity' | 'commodity';

interface SectionCard {
  id: Section;
  title: string;
  description: string;
  meta: string;
  icon: typeof BarChart3;
  iconColor: string;
}

const SECTIONS: SectionCard[] = [
  {
    id: 'index',
    title: 'Index Data',
    description: 'NSE indices — broad market, sectoral, thematic, TRI variants',
    meta: '93 indexes',
    icon: BarChart3,
    iconColor: 'text-accent-indigo bg-accent-indigo/15',
  },
  {
    id: 'equity',
    title: 'Equities',
    description: 'NSE and BSE equity symbols — EOD data ranges, active toggle, index membership',
    meta: 'NSE + BSE',
    icon: TrendingUp,
    iconColor: 'text-risk-green bg-risk-green/15',
  },
  {
    id: 'commodity',
    title: 'Commodities',
    description: 'MCX commodity symbols — crude oil, gold, metals, agriculture',
    meta: 'MCX · NCDEX',
    icon: Package,
    iconColor: 'text-risk-amber bg-risk-amber/15',
  },
];

export default function MarketDataHub({ onBack }: { onBack: () => void }) {
  const [activeSection, setActiveSection] = useState<Section | null>(null);

  if (activeSection === 'index') {
    return <IndexCatalog onBack={() => setActiveSection(null)} />;
  }
  if (activeSection === 'equity') {
    return <EquityCatalog onBack={() => setActiveSection(null)} />;
  }
  if (activeSection === 'commodity') {
    return <CommodityCatalog onBack={() => setActiveSection(null)} />;
  }

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-muted hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Settings
      </button>

      <header className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-white mb-1">Market Data</h2>
        <p className="text-sm text-secondary">Symbol catalogs — data ranges, record counts, active status</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className="group bg-kd-card border border-kd-border rounded-2xl p-6 text-left hover:border-accent-indigo/40 hover:shadow-[0_0_30px_rgba(99,102,241,0.08)] transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.iconColor}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <ChevronRight className="w-4 h-4 text-muted group-hover:text-accent-indigo transition-colors" />
            </div>
            <h3 className="text-sm font-semibold mb-1">{s.title}</h3>
            <p className="text-xs text-muted leading-relaxed mb-3">{s.description}</p>
            <span className="text-[10px] mono text-slate-500 uppercase tracking-wider">{s.meta}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
