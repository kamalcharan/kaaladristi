import { useState } from 'react';
import { Globe, ChevronRight, type LucideIcon } from 'lucide-react';
import SectorLordsDetail from './settings/SectorLordsDetail';

// ── Card config for each settings section ──
interface SettingsCard {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  iconColor: string;
  ready: boolean;
}

const cards: SettingsCard[] = [
  {
    id: 'sector-lords',
    title: 'Sector Lords',
    description: 'Planet-to-sector rulership mappings (126 sectors, 12 planets)',
    icon: Globe,
    iconColor: 'text-accent-indigo bg-accent-indigo/15',
    ready: true,
  },
];

export default function SettingsView() {
  const [activeCard, setActiveCard] = useState<string | null>(null);

  return (
    <div className="animate-fade-in">
      <header className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Settings</h1>
        <p className="text-secondary font-medium">Master data reference tables</p>
      </header>

      {/* Detail view or card grid */}
      {activeCard === 'sector-lords' ? (
        <SectorLordsDetail onBack={() => setActiveCard(null)} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => (
            <button
              key={card.id}
              onClick={() => card.ready && setActiveCard(card.id)}
              disabled={!card.ready}
              className="group bg-kd-card border border-kd-border rounded-2xl p-6 text-left hover:border-accent-indigo/40 hover:shadow-[0_0_30px_rgba(99,102,241,0.08)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.iconColor}`}>
                  <card.icon className="w-5 h-5" />
                </div>
                {card.ready && (
                  <ChevronRight className="w-4 h-4 text-muted group-hover:text-accent-indigo transition-colors" />
                )}
              </div>
              <h3 className="text-sm font-semibold mb-1">{card.title}</h3>
              <p className="text-xs text-muted leading-relaxed">{card.description}</p>
              {!card.ready && (
                <span className="inline-block mt-3 text-[10px] uppercase tracking-wider text-muted">Coming soon</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
