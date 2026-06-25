import { useState } from 'react';
import { useSectorIndices, useVix } from '@/hooks/useSectorRotation';
import { SECTOR_TAB_LABELS, type SectorTab } from '@/services/sectorRotation';
import SectorRotationTable from '@/components/domain/SectorRotationTable';

const TABS: SectorTab[] = ['broad', 'sectoral', 'thematic'];

function VixBand() {
  const { data: vix, isLoading } = useVix();

  if (isLoading) {
    return (
      <div
        style={{
          height: '36px',
          background: 'var(--card)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          gap: '10px',
        }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-faint)' }}>
          India VIX · loading…
        </span>
      </div>
    );
  }

  if (!vix) return null;

  const close = vix.close;
  const color =
    close < 15 ? 'var(--risk-green)' :
    close <= 20 ? 'var(--risk-amber)' :
    'var(--risk-red)';

  const label =
    close < 15 ? 'Low Volatility' :
    close <= 20 ? 'Elevated Volatility' :
    'High Volatility';

  return (
    <div
      style={{
        height: '36px',
        background: 'var(--card)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        gap: '10px',
      }}
    >
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-faint)' }}>
        India VIX
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          fontWeight: 600,
          color,
        }}
      >
        {close.toFixed(2)}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          color,
          opacity: 0.8,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-faint)', marginLeft: 'auto' }}>
        as of {vix.trade_date}
      </span>
    </div>
  );
}

function TabContent({ tab }: { tab: SectorTab }) {
  const { data: rows = [], isLoading, error } = useSectorIndices(tab);

  if (isLoading) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-faint)' }}>
          Loading {SECTOR_TAB_LABELS[tab]} indices…
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--risk-red)' }}>
          Failed to load data — {error.message}
        </span>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-faint)' }}>
          No {SECTOR_TAB_LABELS[tab]} indices found.
        </span>
      </div>
    );
  }

  return <SectorRotationTable rows={rows} />;
}

export default function SectorRotationPage() {
  const [activeTab, setActiveTab] = useState<SectorTab>('broad');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Page header */}
      <div
        style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'baseline',
          gap: '12px',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '22px',
            fontWeight: 500,
            color: 'var(--text-primary)',
            margin: 0,
            letterSpacing: '-0.01em',
          }}
        >
          Sector Rotation
        </h1>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--text-faint)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          NSE Index Flow
        </span>
      </div>

      {/* VIX band */}
      <VixBand />

      {/* Tab strip */}
      <div
        style={{
          display: 'flex',
          gap: '2px',
          padding: '12px 24px 0',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg)',
        }}
      >
        {TABS.map((tab) => {
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--gold-soft)' : 'var(--text-muted)',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--gold-soft)' : '2px solid transparent',
                padding: '8px 16px',
                cursor: 'pointer',
                transition: 'all 0.15s',
                letterSpacing: '0.04em',
                marginBottom: '-1px',
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
              }}
            >
              {SECTOR_TAB_LABELS[tab]}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
        <TabContent tab={activeTab} />
      </div>
    </div>
  );
}
