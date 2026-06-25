import React, { useState } from 'react';
import { useSectorIndices, useVix } from '@/hooks/useSectorRotation';
import { SECTOR_TAB_LABELS, type SectorTab } from '@/services/sectorRotation';
import SectorRotationTable from '@/components/domain/SectorRotationTable';
import { DristiQLoader } from '@/components/ui';

const TABS: SectorTab[] = ['broad', 'sectoral', 'thematic'];

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

function fmt(v: number | null | undefined, decimals = 2): string {
  if (v == null) return '—';
  return v.toFixed(decimals);
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—';
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}

function pctColor(v: number | null | undefined): string {
  if (v == null) return 'var(--text-faint)';
  if (v > 0) return 'var(--risk-green)';
  if (v < 0) return 'var(--risk-red)';
  return 'var(--text-faint)';
}

function VixStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: '1px', minWidth: '52px' }}>
      <span style={{ ...MONO, fontSize: '9px', color: 'var(--text-faint)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ ...MONO, fontSize: '12px', fontWeight: 500, color: color ?? 'var(--text-secondary)' }}>
        {value}
      </span>
    </span>
  );
}

function VixBand() {
  const { data: vix, isLoading } = useVix();

  const bandStyle: React.CSSProperties = {
    background: 'var(--card)',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '0 20px',
    padding: '6px 24px',
    minHeight: '44px',
  };

  if (isLoading) {
    return (
      <div style={bandStyle}>
        <span style={{ ...MONO, fontSize: '11px', color: 'var(--text-faint)' }}>
          India VIX · loading…
        </span>
      </div>
    );
  }

  if (!vix) return null;

  const closeColor =
    vix.close < 15 ? 'var(--risk-green)' :
    vix.close <= 20 ? 'var(--risk-amber)' :
    'var(--risk-red)';

  const regime =
    vix.close < 15 ? 'Low Vol' :
    vix.close <= 20 ? 'Elevated' :
    'High Vol';

  return (
    <div style={bandStyle}>
      {/* Label + regime badge */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <span style={{ ...MONO, fontSize: '11px', color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          India VIX
        </span>
        <span
          style={{
            ...MONO,
            fontSize: '9px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: closeColor,
            border: `1px solid ${closeColor}`,
            borderRadius: '3px',
            padding: '1px 5px',
            opacity: 0.85,
          }}
        >
          {regime}
        </span>
      </span>

      {/* Divider */}
      <span style={{ width: '1px', height: '24px', background: 'var(--border)', flexShrink: 0 }} />

      {/* OHLC */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <VixStat label="Open"  value={fmt(vix.open)} />
        <VixStat label="High"  value={fmt(vix.high)} color="var(--risk-green)" />
        <VixStat label="Low"   value={fmt(vix.low)}  color="var(--risk-red)" />
        <VixStat label="Close" value={fmt(vix.close)} color={closeColor} />
        <VixStat label="Chng%" value={fmtPct(vix.pct_chng)} color={pctColor(vix.pct_chng)} />
      </span>

      {/* Divider */}
      <span style={{ width: '1px', height: '24px', background: 'var(--border)', flexShrink: 0 }} />

      {/* Returns */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <VixStat label="5D"  value={fmtPct(vix.ret_5d)}  color={pctColor(vix.ret_5d)} />
        <VixStat label="1M"  value={fmtPct(vix.ret_22d)} color={pctColor(vix.ret_22d)} />
        <VixStat label="3M"  value={fmtPct(vix.ret_66d)} color={pctColor(vix.ret_66d)} />
      </span>

      {/* Trade date — pushed right */}
      <span style={{ ...MONO, fontSize: '10px', color: 'var(--text-faint)', marginLeft: 'auto' }}>
        {vix.trade_date}
      </span>
    </div>
  );
}

function TabContent({ tab }: { tab: SectorTab }) {
  const { data: rows = [], isLoading, error } = useSectorIndices(tab);

  if (isLoading) {
    return <DristiQLoader message={`Loading ${SECTOR_TAB_LABELS[tab]} indices…`} />;
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
