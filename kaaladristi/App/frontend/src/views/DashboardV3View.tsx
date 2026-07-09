import { useState } from 'react';
import { fmtDate } from '@/lib/dateUtils';
import { useAppStore } from '@/stores/appStore';
import { dashboardDate } from '@/stores/appStore';
import { useDashboardPings } from '@/hooks/useDashboardPings';
import {
  CurrentSkyRail,
  PingsColumn,
  SixDayOutlookCompact,
  SectorRotationFlow,
  DensityToggle,
  ActionIsland,
  MarketWeatherCard,
  type Density,
} from '@/components/domain/DashboardV3';
import TickerRail        from '@/components/domain/DashboardV3/TickerRail';
import PlanetRegimeStrip from '@/components/domain/DashboardV3/PlanetRegimeStrip';
import NakVaraSignals    from '@/components/domain/DashboardV3/NakVaraSignals';
import PanchangamCard    from '@/components/domain/PanchangamCard';
import MarketBreadthChart from '@/components/domain/MarketBreadthChart';
import BreadthRocChart   from '@/components/domain/BreadthRocChart';
import { PageHeader } from '@/components/ui';

// ── Main view ─────────────────────────────────────────────────────────────────

export default function DashboardV3View() {
  const [density, setDensity] = useState<Density>('terminal');
  useAppStore(); // keep store subscribed for future symbol use

  // After 7 PM IST use next trading day; weekends always show Monday
  const displayDate = dashboardDate();

  const { pings } = useDashboardPings(displayDate);

  return (
    <div className="animate-fade-in" style={{ paddingBottom: 100 }}>

      <PageHeader
        eyebrow={`${fmtDate(displayDate)} · End of Day`}
        title="Today's"
        titleEm="Read"
        actions={<DensityToggle density={density} onChange={setDensity} />}
      />

      <div className="pt-6">

      {/* ── ROW 0: Ticker Rail — always visible ── */}
      <TickerRail date={displayDate} />

      {/* ── ROW 0.5: Sky Regime — the four-planet engine, always visible ── */}
      <PlanetRegimeStrip />

      {/* ── ROW 1: Astro-Technical Alignment (65%) + Panchangam (35%) — always visible ── */}
      <div
        className="grid gap-4 mb-4"
        style={{ gridTemplateColumns: '65fr 35fr' }}
      >
        <MarketWeatherCard date={displayDate} />
        <PanchangamCard date={displayDate} />
      </div>

      {/* ── ROW 2: Market Breadth + ROC charts — calm hidden ── */}
      {density !== 'calm' && (
        <div
          className="grid gap-4 mb-4"
          style={{ gridTemplateColumns: '1fr 1fr' }}
        >
          <MarketBreadthChart />
          <BreadthRocChart />
        </div>
      )}

      {/* ── ROW 3: Pings + 6-Day Outlook — calm hidden ── */}
      {density !== 'calm' && (
        <div
          className="grid gap-4 mb-4"
          style={{ gridTemplateColumns: '1fr 1fr' }}
        >
          <PingsColumn date={displayDate} />
          <SixDayOutlookCompact date={displayDate} />
        </div>
      )}

      {/* ── ROW 4: Sky Rail — standard + terminal ── */}
      {density !== 'calm' && (
        <div className="mb-4">
          <CurrentSkyRail date={displayDate} />
        </div>
      )}

      {/* ── ROW 5: Sector Rotation full-width — standard + terminal ── */}
      {density !== 'calm' && (
        <div className="mb-4">
          <SectorRotationFlow />
        </div>
      )}

      {/* ── ROW 6: Rule Signals (Nak-Vara first) — terminal only ── */}
      {density === 'terminal' && (
        <div className="mb-4">
          <NakVaraSignals date={displayDate} />
        </div>
      )}

      {/* ── Action Island ── */}
      <ActionIsland pingCount={pings.length} />
      </div>
    </div>
  );
}
