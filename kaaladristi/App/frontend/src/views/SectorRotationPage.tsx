import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, Table2 } from 'lucide-react';
import { useSectorIndices, useIndexFlowMap, useVix, useIndexDateRange } from '@/hooks/useSectorRotation';
import { SECTOR_TAB_LABELS, type SectorTab } from '@/services/sectorRotation';
import SectorRotationTable from '@/components/domain/SectorRotationTable';
import { DristiQLoader } from '@/components/ui';
import FlowIntensityMap from '@/components/domain/FlowIntensityMap';

// All four tabs are visible to every user: 'custom' indices are admin-CURATED
// baskets (creation is admin-only elsewhere), but the resulting indices are
// content for everyone — labeled "Curated" in SECTOR_TAB_LABELS.
const TABS: SectorTab[] = ['broad', 'sectoral', 'thematic', 'custom'];
type ViewMode = 'table' | 'heat';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Day-window toggle (heat view) ────────────────────────────────────────────

function DayToggle({ days, onChange }: { days: 5 | 22 | 66; onChange: (d: 5 | 22 | 66) => void }) {
  const btnStyle = (active: boolean): React.CSSProperties => ({
    ...MONO,
    fontSize: 11,
    fontWeight: active ? 600 : 400,
    color: active ? 'var(--text-primary)' : 'var(--text-muted)',
    background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
    border: '1px solid',
    borderColor: active ? 'rgba(255,255,255,0.15)' : 'var(--border)',
    borderRadius: 4,
    padding: '4px 9px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    letterSpacing: '0.03em',
  });
  // Labels say "sessions" deliberately: this toggle changes how many days of
  // HISTORY are shown — it does NOT switch the metric (cells always show
  // Score 5D). "5D/22D/66D" labels here misread as a metric switch.
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      {([5, 22, 66] as const).map((d) => (
        <button key={d} style={btnStyle(days === d)} onClick={() => onChange(d)}>
          {d}
        </button>
      ))}
      <span style={{ ...MONO, fontSize: 9, color: 'var(--text-faint)', letterSpacing: '0.05em', textTransform: 'uppercase', marginLeft: 4 }}>
        sessions
      </span>
    </div>
  );
}

// ── VIX band ──────────────────────────────────────────────────────────────────

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
        <span style={{ ...MONO, fontSize: '11px', color: 'var(--text-faint)' }}>India VIX · loading…</span>
      </div>
    );
  }

  if (!vix) return null;

  const closeColor =
    vix.close < 15  ? 'var(--risk-green)' :
    vix.close <= 20 ? 'var(--risk-amber)' :
    'var(--risk-red)';

  const regime =
    vix.close < 15  ? 'Low Vol' :
    vix.close <= 20 ? 'Elevated' :
    'High Vol';

  return (
    <div style={bandStyle}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <span style={{ ...MONO, fontSize: '11px', color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          India VIX
        </span>
        <span style={{ ...MONO, fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase', color: closeColor, border: `1px solid ${closeColor}`, borderRadius: '3px', padding: '1px 5px', opacity: 0.85 }}>
          {regime}
        </span>
      </span>
      <span style={{ width: '1px', height: '24px', background: 'var(--border)', flexShrink: 0 }} />
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <VixStat label="Open"  value={fmt(vix.open)} />
        <VixStat label="High"  value={fmt(vix.high)}  color="var(--risk-green)" />
        <VixStat label="Low"   value={fmt(vix.low)}   color="var(--risk-red)" />
        <VixStat label="Close" value={fmt(vix.close)} color={closeColor} />
        <VixStat label="Chng%" value={fmtPct(vix.pct_chng)} color={pctColor(vix.pct_chng)} />
      </span>
      <span style={{ width: '1px', height: '24px', background: 'var(--border)', flexShrink: 0 }} />
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <VixStat label="5D"  value={fmtPct(vix.ret_5d)}  color={pctColor(vix.ret_5d)} />
        <VixStat label="22D" value={fmtPct(vix.ret_22d)} color={pctColor(vix.ret_22d)} />
        <VixStat label="66D" value={fmtPct(vix.ret_66d)} color={pctColor(vix.ret_66d)} />
      </span>
      <span style={{ ...MONO, fontSize: '10px', color: 'var(--text-faint)', marginLeft: 'auto' }}>
        {vix.trade_date}
      </span>
    </div>
  );
}

// ── Tab content ───────────────────────────────────────────────────────────────

function TabContent({ tab, view, forDate, heatDays }: {
  tab: SectorTab;
  view: ViewMode;
  forDate?: string;
  heatDays: 5 | 22 | 66;
}) {
  const navigate = useNavigate();
  const { data: rows = [], isLoading, error } = useSectorIndices(tab, forDate);
  const { data: heatData } = useIndexFlowMap(tab, heatDays);

  // Heat rows are index NAMES; map back to ids so row labels can drill down
  // to the same detail page the table rows navigate to.
  const nameToId = useMemo(
    () => new Map(rows.map((r) => [r.name, r.index_id])),
    [rows],
  );

  if (view === 'heat') {
    return (
      <div style={{ padding: '20px 24px' }}>
        <FlowIntensityMap
          mode="index"
          rows={heatData?.rows ?? []}
          dates={heatData?.dates ?? []}
          cells={heatData?.cells ?? {}}
          dayWindow={heatDays}
          subtitle={`${SECTOR_TAB_LABELS[tab]} · Last ${heatDays} Sessions`}
          onRowClick={(name) => {
            const id = nameToId.get(name);
            if (id != null) navigate(`/sector-rotation/${id}`);
          }}
        />
        <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
          {([
            { color: '#166534',           label: 'Strong Conviction', desc: 'Score 25+ and rising — exceptional money flow' },
            { color: 'var(--risk-green)', label: 'Building',          desc: 'Score rising vs its 1-month pace — money arriving' },
            { color: 'var(--risk-amber)', label: 'Fading',            desc: 'Score below its 1-month pace — conviction slipping' },
            { color: 'var(--risk-red)',   label: 'Outflow',           desc: 'Money leaving + price falling' },
            { color: '#334155',           label: 'Quiet',             desc: 'No conviction signal' },
          ] as const).map(({ color, label, desc }) => (
            <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
              <span style={{ ...MONO, fontSize: 10, color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</strong>
                {' '}— {desc}
              </span>
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <DristiQLoader message={`Loading ${SECTOR_TAB_LABELS[tab]} indices…`} />;
  }

  if (error) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center' }}>
        <span style={{ ...MONO, fontSize: '12px', color: 'var(--risk-red)' }}>
          Failed to load data — {error.message}
        </span>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center' }}>
        <span style={{ ...MONO, fontSize: '12px', color: 'var(--text-faint)' }}>
          {forDate
            ? `No data for ${forDate} — market may have been closed on this date.`
            : `No ${SECTOR_TAB_LABELS[tab]} indices found.`}
        </span>
      </div>
    );
  }

  return <SectorRotationTable rows={rows} />;
}

// ── Date picker ───────────────────────────────────────────────────────────────

function DatePicker({
  value,
  onChange,
  min,
  max,
}: {
  value: string;
  onChange: (date: string) => void;
  min?: string;
  max?: string;
}) {
  return (
    <input
      type="date"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(e.target.value)}
      style={{
        ...MONO,
        fontSize: 11,
        color: 'var(--text-secondary)',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: '4px 8px',
        cursor: 'pointer',
        outline: 'none',
        colorScheme: 'dark',
        letterSpacing: '0.03em',
      }}
    />
  );
}

// ── View toggle ───────────────────────────────────────────────────────────────

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  const btnStyle = (active: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    ...MONO,
    fontSize: 11,
    fontWeight: active ? 600 : 400,
    color: active ? 'var(--text-primary)' : 'var(--text-muted)',
    background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
    border: '1px solid',
    borderColor: active ? 'rgba(255,255,255,0.15)' : 'var(--border)',
    borderRadius: 4,
    padding: '4px 10px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    letterSpacing: '0.03em',
  });

  return (
    <div style={{ display: 'inline-flex', gap: 4 }}>
      <button style={btnStyle(view === 'table')} onClick={() => onChange('table')}>
        <Table2 size={13} />
        Table
      </button>
      <button style={btnStyle(view === 'heat')} onClick={() => onChange('heat')}>
        <Flame size={13} />
        Heat
      </button>
    </div>
  );
}

// ── Explainer strip ───────────────────────────────────────────────────────────
// The one place the 5D/22D/66D concept is stated in plain language, plus a
// legend for the signal colors and the "gaining strength" dot. Always visible —
// this audience needs the repetition more than power users need the pixels.

function ExplainerStrip({ view }: { view: ViewMode }) {
  const chip = (color: string, label: string, dot = false) => (
    <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
      <span style={{
        width: dot ? 5 : 8, height: dot ? 5 : 8,
        borderRadius: dot ? '50%' : 2, background: color, flexShrink: 0,
      }} />
      <span style={{ ...MONO, fontSize: 10, color: 'var(--text-muted)' }}>{label}</span>
    </span>
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '6px 20px',
        padding: '7px 24px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--card)',
      }}
    >
      <span style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        <strong style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>5D / 22D / 66D</strong>
        {' '}= price change over ~1 week / ~1 month / ~3 months.
      </span>
      {view === 'table' && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          {chip('var(--bull)', 'Flow Entering')}
          {chip('var(--gold)', 'Sustained')}
          {chip('var(--bear)', 'Flow Exiting')}
          {chip('var(--accent-indigo, #6366f1)', '5D outrunning 22D — gaining strength', true)}
        </span>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SectorRotationPage() {
  const [activeTab, setActiveTab] = useState<SectorTab>('broad');
  const [view, setView] = useState<ViewMode>('table');
  const [heatDays, setHeatDays] = useState<5 | 22 | 66>(22);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const { latestDate, earliestDate } = useIndexDateRange();
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (latestDate && !selectedDate) setSelectedDate(latestDate);
  }, [latestDate, selectedDate]);

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
        <span style={{ ...MONO, fontSize: '11px', color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          NSE Index Flow
        </span>
      </div>

      {/* VIX band */}
      <VixBand />

      {/* Tab strip + view toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          padding: '12px 24px 0',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg)',
        }}
      >
        <div style={{ display: 'flex', gap: '2px' }}>
          {TABS.map((tab) => {
            const isActive = tab === activeTab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  ...MONO,
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8 }}>
          {view === 'heat'
            ? <DayToggle days={heatDays} onChange={setHeatDays} />
            : selectedDate && (
                <DatePicker
                  value={selectedDate}
                  onChange={setSelectedDate}
                  min={earliestDate ?? undefined}
                  max={today}
                />
              )
          }
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      {/* Explainer + legend */}
      <ExplainerStrip view={view} />

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
        <TabContent tab={activeTab} view={view} forDate={selectedDate || undefined} heatDays={heatDays} />
      </div>
    </div>
  );
}
