import { Activity } from 'lucide-react';
import type { DayRiskReport, HistoricalProof } from '@/types';
import { Card } from '@/components/ui';
import {
  RegimeBadge,
  PanchangamCard, MarketBreadthChart, BreadthRocChart,
  SectorRotationStrip, IndexWatchlist, MagicRsLeaderboard,
  AstroSignalBadge, AstroSignalWeekPanel,
} from '@/components/domain';
import MajorTransitBanner from '@/components/astro/MajorTransitBanner';
import MinorTransitBar    from '@/components/astro/MinorTransitBar';
import DailyEventStrip    from '@/components/astro/DailyEventStrip';

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

      {/* ═══ Row 1: Cycle Intelligence (left) + Panchangam (right) ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 mb-5">
        {/* Cycle Intelligence — regime badge + planetary + astro badge */}
        <Card rounded="xxl" className="px-5 py-4 flex items-center gap-4 flex-wrap">
          <RegimeBadge regime={report.regime} />
          <div className="flex items-center gap-2 text-sm text-secondary bg-kd-elevated/40 px-3 py-1.5 rounded-lg border border-kd-border">
            <Activity className="w-3.5 h-3.5 text-accent-indigo shrink-0" />
            <span className="text-xs">{report.planetarySummary}</span>
          </div>
          <AstroSignalBadge date={report.date} />
        </Card>

        {/* Panchangam */}
        <PanchangamCard date={report.date} />
      </div>

      {/* ═══ Row 1b: Astro Signal — Week Ahead (full width) ═══ */}
      <div className="mb-5">
        <AstroSignalWeekPanel date={report.date} />
      </div>

      {/* ═══ Row 1c: Major transits (>30 days) — only renders if active ═══ */}
      <MajorTransitBanner />

      {/* ═══ Row 1d: Minor transits (1–30 days) — only renders if active ═══ */}
      <div className="mb-5">
        <MinorTransitBar />
      </div>

      {/* ═══ Row 2: Index Watchlist (full width) ═══ */}
      <div className="mb-5">
        <IndexWatchlist />
      </div>

      {/* ═══ Row 3: 7-Day Outlook (full width) ═══ */}
      <div className="mb-5">
        <DailyEventStrip selectedDate={report.date} />
      </div>

      {/* ═══ Row 4: Sector Rotation (full width) ═══ */}
      <div className="mb-5">
        <SectorRotationStrip />
      </div>

      {/* ═══ Row 5: Top 10 + Bottom 10 MagicRS (side by side) ═══ */}
      <div className="mb-5">
        <MagicRsLeaderboard />
      </div>

      {/* ═══ Row 6: Market Breadth + Breadth ROC (side by side) ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MarketBreadthChart />
        <BreadthRocChart />
      </div>
    </div>
  );
}
