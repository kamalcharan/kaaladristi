import { useState } from 'react';
import { useAppStore } from '@/stores/appStore';
import { dashboardDate } from '@/stores/appStore';
import { useDashboardPings } from '@/hooks/useDashboardPings';
import {
  TodaysSky,
  CurrentSkyRail,
  PingsColumn,
  SixDayOutlookCompact,
  AmbientGauges,
  SectorRotationFlow,
  DensityToggle,
  ActionIsland,
  MarketWeatherCard,
  type Density,
} from '@/components/domain/DashboardV3';
import TickerRail    from '@/components/domain/DashboardV3/TickerRail';
import NakVaraSignals from '@/components/domain/DashboardV3/NakVaraSignals';

// ── Main view ─────────────────────────────────────────────────────────────────

export default function DashboardV3View() {
  const [density, setDensity] = useState<Density>('terminal');
  const { selectedDate } = useAppStore();

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
            {new Date(displayDate + 'T00:00:00Z').toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            })}{' '}
            · End of Day
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
            <em style={{ color: 'var(--gold)', fontStyle: 'italic', fontWeight: 400 }}>
              Read
            </em>
          </h1>
        </div>
        <DensityToggle density={density} onChange={setDensity} />
      </div>

      {/* ── ROW 0: Ticker Rail — always visible ── */}
      <TickerRail date={displayDate} />

      {/* ── ROW 1: TodaysSky — always visible ── */}
      <TodaysSky date={displayDate} />

      {/* ── ROW 2: Hero 3-col — calm hidden ── */}
      {density !== 'calm' && (
        <div
          className="grid gap-4 mb-4"
          style={{ gridTemplateColumns: '320px 1fr 1fr' }}
        >
          <MarketWeatherCard date={displayDate} />
          <PingsColumn date={displayDate} />
          <SixDayOutlookCompact date={displayDate} />
        </div>
      )}

      {/* ── ROW 3: Sky Rail — calm hidden ── */}
      {density !== 'calm' && (
        <div className="mb-4">
          <CurrentSkyRail date={displayDate} />
        </div>
      )}

      {/* ── ROW 4: Breadth gauges + Sector Rotation — standard + terminal ── */}
      {density !== 'calm' && (
        <div
          className="grid gap-4 mb-4"
          style={{ gridTemplateColumns: '1fr 2fr' }}
        >
          <AmbientGauges />
          <SectorRotationFlow />
        </div>
      )}

      {/* ── ROW 5: Rule Signals (Nak-Vara first) — terminal only ── */}
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
