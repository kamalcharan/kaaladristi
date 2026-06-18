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
import NakVaraSignals    from '@/components/domain/DashboardV3/NakVaraSignals';
import PanchangamCard    from '@/components/domain/PanchangamCard';
import MarketBreadthChart from '@/components/domain/MarketBreadthChart';
import BreadthRocChart   from '@/components/domain/BreadthRocChart';

// ── Main view ─────────────────────────────────────────────────────────────────

export default function DashboardV3View() {
  const [density, setDensity] = useState<Density>('terminal');
  useAppStore(); // keep store subscribed for future symbol use

  // After 7 PM IST use next trading day; weekends always show Monday
  const displayDate = dashboardDate();

  const { pings } = useDashboardPings(displayDate);

  return (
    <div className="animate-fade-in" style={{ paddingBottom: 100 }}>

      {/* ── Sub-header: date + density toggle ── */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.16em',
            color: 'var(--text-faint)',
            textTransform: 'uppercase',
            marginBottom: 4,
          }}>
            {fmtDate(displayDate)} · End of Day
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            fontWeight: 500,
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
            color: 'var(--text-primary)',
            margin: 0,
          }}>
            Today&apos;s{' '}
            <em style={{ color: 'var(--gold)', fontStyle: 'italic', fontWeight: 400 }}>Read</em>
          </h1>
        </div>
        <DensityToggle density={density} onChange={setDensity} />
      </div>

      {/* ── ROW 0: Ticker Rail — always visible ── */}
      <TickerRail date={displayDate} />

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
  );
}
