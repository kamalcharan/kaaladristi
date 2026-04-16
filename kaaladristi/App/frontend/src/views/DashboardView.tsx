import { useNavigate } from 'react-router-dom';
import { Activity, BarChart3, Loader2 } from 'lucide-react';
import type { DayRiskReport, HistoricalProof, IndexCatalogItem } from '@/types';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui';
import {
  RegimeBadge,
  PanchangamCard, ActiveIndexScroll, MarketBreadthChart, BreadthRocChart, SevenDayStrip,
  SectorRotationStrip,
} from '@/components/domain';
import { useActiveIndexes } from '@/hooks';

// ── NIFTY / BANKNIFTY hero tiles ────────────────────────────────

const HERO_INDEXES = ['NIFTY 50', 'NIFTY BANK'];

function HeroIndexTile({ item }: { item: IndexCatalogItem }) {
  const navigate = useNavigate();
  const close = item.last_close;
  const shortName = item.name.replace('NIFTY ', '').replace('Nifty ', '');

  return (
    <button
      onClick={() => navigate(`/chart/index/${item.id}?name=${encodeURIComponent(item.name)}`)}
      className={cn(
        'flex-1 min-w-[160px] px-4 py-3 rounded-xl border text-left transition-all',
        'bg-kd-surface border-kd-border hover:border-accent-indigo/40 hover:bg-accent-indigo/5',
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-accent-indigo uppercase tracking-wider">
          {shortName}
        </span>
        <BarChart3 className="w-3.5 h-3.5 text-muted" />
      </div>
      <div className="text-lg font-bold mono text-primary">
        {close != null
          ? close.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : '—'}
      </div>
    </button>
  );
}

function IndexTilesSection() {
  const { data: indexes = [], isLoading } = useActiveIndexes();

  if (isLoading) {
    return (
      <div className="flex gap-3">
        <div className="flex-1 h-[72px] bg-kd-elevated/40 rounded-xl animate-pulse" />
        <div className="flex-1 h-[72px] bg-kd-elevated/40 rounded-xl animate-pulse" />
      </div>
    );
  }

  const heroes = HERO_INDEXES
    .map((name) => indexes.find((i) => i.name === name))
    .filter((i): i is IndexCatalogItem => i != null);

  return (
    <div className="flex gap-3">
      {heroes.map((item) => (
        <HeroIndexTile key={item.id} item={item} />
      ))}
    </div>
  );
}

// ── Dashboard ───────────────────────────────────────────────────

interface DashboardViewProps {
  report: DayRiskReport;
  proofs: HistoricalProof[];
}

export default function DashboardView({ report }: DashboardViewProps) {
  return (
    <div className="animate-fade-in">
      {/* Header */}
      <header className="mb-4">
        <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-primary mb-1">
          Cycle Intelligence
        </h1>
        <p className="text-secondary font-medium text-sm">
          Deterministic risk assessment for{' '}
          <span className="text-accent-indigo font-bold">{report.symbol}</span>
        </p>
      </header>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5 items-start">

        {/* ── LEFT COLUMN ── */}
        <div className="space-y-5 min-w-0">

          {/* 1. Cycle Intelligence — Regime badge only */}
          <Card rounded="xxl" className="px-5 py-4 flex items-center gap-4">
            <RegimeBadge regime={report.regime} />
            <div className="flex items-center gap-2 text-sm text-secondary bg-kd-elevated/40 px-3 py-1.5 rounded-lg border border-kd-border">
              <Activity className="w-3.5 h-3.5 text-accent-indigo shrink-0" />
              <span className="text-xs">{report.planetarySummary}</span>
            </div>
          </Card>

          {/* 2. Index tiles — NIFTY + BANKNIFTY */}
          <IndexTilesSection />

          {/* 3. 6-Day Outlook */}
          <SevenDayStrip selectedDate={report.date} />

          {/* 4. Sector Rotation — compact 3-name strip */}
          <SectorRotationStrip />

          {/* 5. Market Breadth — EMA positioning */}
          <MarketBreadthChart />

          {/* 6. Breadth Momentum — ROC oscillator */}
          <BreadthRocChart />
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="space-y-4 lg:sticky lg:top-14">
          {/* Panchangam */}
          <PanchangamCard date={report.date} />
        </div>
      </div>
    </div>
  );
}
