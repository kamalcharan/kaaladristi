import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Globe, BarChart3, Activity, ChevronRight, type LucideIcon } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import SectorLordsDetail from './settings/SectorLordsDetail';
import MarketDataHub from './settings/MarketDataHub';
import PipelineDashboard from './settings/PipelineDashboard';
import { PageHeader } from '@/components/ui';

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
  {
    id: 'market-data',
    title: 'Market Data',
    description: 'Indexes, equities and commodities — data ranges, record counts, active status',
    icon: BarChart3,
    iconColor: 'text-risk-green bg-risk-green/15',
    ready: true,
  },
  {
    id: 'pipeline',
    title: 'Data Pipeline',
    description: 'Daily EOD downloads, indicator computation, sync status',
    icon: Activity,
    iconColor: 'text-risk-amber bg-risk-amber/15',
    ready: true,
  },
];

export default function SettingsView() {
  const { isAdmin } = useAuthStore();
  const [activeCard, setActiveCard] = useState<string | null>(null);

  // Admin-gated: these are master-data reference tables. Non-admins (who can no
  // longer see Settings in the nav) land on their Account page instead.
  if (!isAdmin) return <Navigate to="/account" replace />;

  return (
    <div className="animate-fade-in">
      <PageHeader eyebrow="Settings" title="Settings" meta="Master data reference tables" />

      <div className="pt-6">
      {/* Theme selection moved to Account → Appearance. This page is hidden from
          the nav and holds the admin data-reference cards only. */}

      {/* Detail view or card grid */}
      {activeCard === 'sector-lords' ? (
        <SectorLordsDetail onBack={() => setActiveCard(null)} />
      ) : activeCard === 'market-data' ? (
        <MarketDataHub onBack={() => setActiveCard(null)} />
      ) : activeCard === 'pipeline' ? (
        <PipelineDashboard onBack={() => setActiveCard(null)} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => (
            <button
              key={card.id}
              onClick={() => card.ready && setActiveCard(card.id)}
              disabled={!card.ready}
              className="group bg-kd-surface border-2 border-kd-border rounded-2xl p-6 text-left hover:border-accent-indigo/40 hover:[box-shadow:0_0_30px_color-mix(in_srgb,var(--accent-indigo)_8%,transparent)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.iconColor}`}>
                  <card.icon className="w-5 h-5" />
                </div>
                {card.ready && (
                  <ChevronRight className="w-4 h-4 text-muted group-hover:text-accent-indigo transition-colors" />
                )}
              </div>
              <h3 className="text-sm font-semibold mb-1 text-[var(--text-primary)]">{card.title}</h3>
              <p className="text-xs text-muted leading-relaxed">{card.description}</p>
              {!card.ready && (
                <span className="inline-block mt-3 text-[10px] uppercase tracking-wider text-muted">Coming soon</span>
              )}
            </button>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
