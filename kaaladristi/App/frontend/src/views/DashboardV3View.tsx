import { useState } from 'react';
import { useAppStore } from '@/stores/appStore';
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

// ── Main view ─────────────────────────────────────────────────────────────────

export default function DashboardV3View() {
  const [density, setDensity] = useState<Density>('standard');
  const { selectedDate } = useAppStore();
  const { pings } = useDashboardPings(selectedDate);

  return (
    <div className="animate-fade-in" style={{ paddingBottom: 100 }}>

      {/* ── Sub-header: date + density toggle ── */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.16em',
              color: 'var(--text-faint)',
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            {new Date(selectedDate + 'T00:00:00Z').toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            })}{' '}
            · End of Day
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 28,
              fontWeight: 500,
              letterSpacing: '-0.02em',
              lineHeight: 1.05,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Today&apos;s{' '}
            <em style={{ color: 'var(--gold)', fontStyle: 'italic', fontWeight: 400 }}>
              Read
            </em>
          </h1>
        </div>
        <DensityToggle density={density} onChange={setDensity} />
      </div>

      {/* ── TodaysSky — always visible ── */}
      <TodaysSky date={selectedDate} />

      {/* ── STANDARD + TERMINAL: 3-column signal row ── */}
      {density !== 'calm' && (
        <div
          className="grid gap-4 mb-4"
          style={{ gridTemplateColumns: '1fr 2fr 1fr' }}
        >
          <CurrentSkyRail date={selectedDate} />
          <PingsColumn date={selectedDate} />
          <SixDayOutlookCompact date={selectedDate} />
        </div>
      )}

      {/* ── Market Weather Card — always visible (sample data, layout approval) ── */}
      <div className="mb-4" style={{ maxWidth: 420 }}>
        <MarketWeatherCard />
      </div>

      {/* ── TERMINAL only: ambient gauges + sector rotation ── */}
      {density === 'terminal' && (
        <>
          <AmbientGauges />
          <SectorRotationFlow />
        </>
      )}

      {/* ── Action Island ── */}
      <ActionIsland pingCount={pings.length} />
    </div>
  );
}
