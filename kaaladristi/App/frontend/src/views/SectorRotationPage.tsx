import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, LayoutGrid, Table2 } from 'lucide-react';
import { useSectorIndices, useIndexFlowMap, useVix, useIndexDateRange } from '@/hooks/useSectorRotation';
import { FLOW_LABELS } from '@/constants/signalScale';
import { SECTOR_TAB_LABELS, type SectorTab, type SectorIndexRow } from '@/services/sectorRotation';
import SectorRotationTable from '@/components/domain/SectorRotationTable';
import { DristiQLoader } from '@/components/ui';
import WorkspaceChart from '@/components/workspace/WorkspaceChart';
import type { ChartOverlay } from '@/types/framework';
import FlowIntensityMap from '@/components/domain/FlowIntensityMap';

const EMPTY_OVERLAYS: ChartOverlay[] = [];

const TABS: SectorTab[] = ['broad', 'sectoral', 'thematic'];
type ViewMode = 'table' | 'chart' | 'heat';

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

// ── Signal (mirrors SectorRotationTable) ─────────────────────────────────────

type SignalType = 'flow_entering' | 'flow_exiting' | 'sustained_flow' | null;

function computeSignal(row: SectorIndexRow): SignalType {
  const pctAmtChg =
    row.avg_amt_5d != null && row.avg_amt_22d != null && row.avg_amt_22d !== 0
      ? ((row.avg_amt_5d - row.avg_amt_22d) / row.avg_amt_22d) * 100
      : null;
  const rotatingIn =
    (row.ret_5d ?? 0) > 0 &&
    (row.score_5d ?? 0) > (row.score_22d ?? 0) &&
    pctAmtChg != null && pctAmtChg > 15;
  const rotatingOut =
    (row.ret_5d ?? 0) < 0 &&
    (row.score_5d ?? 0) < (row.score_22d ?? 0) &&
    pctAmtChg != null && pctAmtChg < -15;
  if (rotatingIn) return 'flow_entering';
  if (rotatingOut) return 'flow_exiting';
  if ((row.ret_22d ?? 0) > 5 && (row.rsi_14 ?? 0) > 55 && !rotatingOut) return 'sustained_flow';
  return null;
}

const SIGNAL_LABEL: Record<NonNullable<SignalType>, string> = {
  flow_entering:  'Flow In',
  flow_exiting:   'Flow Out',
  sustained_flow: 'Sustained',
};

const SIGNAL_COLOR: Record<NonNullable<SignalType>, string> = {
  flow_entering:  'var(--bull)',
  flow_exiting:   'var(--bear)',
  sustained_flow: 'var(--gold)',
};

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
  return (
    <div style={{ display: 'inline-flex', gap: 3 }}>
      {([5, 22, 66] as const).map((d) => (
        <button key={d} style={btnStyle(days === d)} onClick={() => onChange(d)}>
          {d === 5 ? '5D' : d === 22 ? '22D' : '66D'}
        </button>
      ))}
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
        <VixStat label="1M"  value={fmtPct(vix.ret_22d)} color={pctColor(vix.ret_22d)} />
        <VixStat label="3M"  value={fmtPct(vix.ret_66d)} color={pctColor(vix.ret_66d)} />
      </span>
      <span style={{ ...MONO, fontSize: '10px', color: 'var(--text-faint)', marginLeft: 'auto' }}>
        {vix.trade_date}
      </span>
    </div>
  );
}

// ── Index card (chart view) ───────────────────────────────────────────────────

function RetPill({ label, value }: { label: string; value: number | null }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
      <span style={{ ...MONO, fontSize: 9, color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ ...MONO, fontSize: 11, fontWeight: 600, color: pctColor(value) }}>
        {fmtPct(value)}
      </span>
    </div>
  );
}

function RsiBar({ value }: { value: number | null }) {
  if (value == null) return null;
  const w = Math.min(100, Math.max(0, value));
  const color = value >= 60 ? 'var(--bull)' : value <= 40 ? 'var(--bear)' : 'var(--gold-soft)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ ...MONO, fontSize: 9, color: 'var(--text-faint)', letterSpacing: '0.06em', flexShrink: 0 }}>RSI</span>
      <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${w}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.3s' }} />
      </div>
      <span style={{ ...MONO, fontSize: 10, color, minWidth: 28, textAlign: 'right' }}>{value.toFixed(0)}</span>
    </div>
  );
}

function IndexCard({
  row,
  onClick,
}: {
  row: SectorIndexRow;
  onClick: () => void;
}) {
  const signal = computeSignal(row);
  const flowInfo = row.flow_type ? (FLOW_LABELS[row.flow_type] ?? null) : null;
  const flowColorVar = flowInfo?.color.replace('text-risk-', '--risk-').replace('text-', '--') ?? null;
  const instrument = useMemo(
    () => ({ id: row.index_id, symbol: row.name, type: 'index' as const }),
    [row.index_id, row.name],
  );

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '14px 16px 12px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        transition: 'border-color 0.15s',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.18)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
    >
      {/* Header: name + signal badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
        <span
          style={{
            ...MONO,
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-primary)',
            flex: 1,
            lineHeight: 1.35,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {row.name}
        </span>
        {signal && (
          <span
            style={{
              ...MONO,
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: SIGNAL_COLOR[signal],
              border: `1px solid ${SIGNAL_COLOR[signal]}`,
              borderRadius: 3,
              padding: '1px 5px',
              flexShrink: 0,
              opacity: 0.9,
              whiteSpace: 'nowrap',
            }}
          >
            {SIGNAL_LABEL[signal]}
          </span>
        )}
      </div>

      {/* Close + %Chg + flow badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ ...MONO, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
          {row.close != null
            ? '₹' + row.close.toLocaleString('en-IN', { maximumFractionDigits: 2 })
            : '—'}
        </span>
        <span style={{ ...MONO, fontSize: 11, color: pctColor(row.pct_chng) }}>
          {fmtPct(row.pct_chng)}
        </span>
        {flowInfo && flowColorVar && (
          <span
            style={{
              ...MONO,
              fontSize: 9,
              fontWeight: 500,
              letterSpacing: '0.05em',
              color: `var(${flowColorVar}, var(--text-faint))`,
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 3,
              padding: '1px 5px',
              marginLeft: 'auto',
              whiteSpace: 'nowrap',
            }}
          >
            {flowInfo.label}
          </span>
        )}
      </div>

      {/* OHLC candlestick — display only, clicks bubble up to card */}
      <div style={{ height: 200, pointerEvents: 'none', marginBottom: 10, borderRadius: 4, overflow: 'hidden' }}>
        <WorkspaceChart instrument={instrument} overlays={EMPTY_OVERLAYS} standalone />
      </div>

      {/* RSI bar */}
      <div style={{ marginBottom: 10 }}>
        <RsiBar value={row.rsi_14} />
      </div>

      {/* 5D / 22D / 66D returns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 0,
          background: 'rgba(255,255,255,0.03)',
          borderRadius: 5,
          border: '1px solid rgba(255,255,255,0.05)',
          overflow: 'hidden',
        }}
      >
        {([['5D', row.ret_5d], ['22D', row.ret_22d], ['66D', row.ret_66d]] as [string, number | null][]).map(([label, val], i) => (
          <div
            key={label}
            style={{
              padding: '7px 0',
              textAlign: 'center',
              borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            }}
          >
            <RetPill label={label} value={val} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Chart grid ────────────────────────────────────────────────────────────────

function ChartGrid({ rows }: { rows: SectorIndexRow[] }) {
  const navigate = useNavigate();

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 12,
        padding: '20px 24px',
      }}
    >
      {rows.map((row) => (
        <IndexCard
          key={row.index_id}
          row={row}
          onClick={() => navigate(`/sector-rotation/${row.index_id}`)}
        />
      ))}
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
  const { data: rows = [], isLoading, error } = useSectorIndices(tab, forDate);
  const { data: heatData } = useIndexFlowMap(tab, heatDays);

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
        />
        <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
          {([
            { color: '#166534',           label: 'Strong Flow',   desc: 'Flow rising + return > 1.5%' },
            { color: 'var(--risk-green)', label: 'Moderate Flow', desc: 'Flow rising + return > 0.5%' },
            { color: 'var(--risk-amber)', label: 'Weak Flow',     desc: 'Mixed or flat signal' },
            { color: 'var(--risk-red)',   label: 'Low Flow',      desc: 'Outflow + negative return' },
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

  if (view === 'chart') return <ChartGrid rows={rows} />;
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
      <button style={btnStyle(view === 'chart')} onClick={() => onChange('chart')}>
        <LayoutGrid size={13} />
        Chart
      </button>
      <button style={btnStyle(view === 'heat')} onClick={() => onChange('heat')}>
        <Flame size={13} />
        Heat
      </button>
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

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
        <TabContent tab={activeTab} view={view} forDate={selectedDate || undefined} heatDays={heatDays} />
      </div>
    </div>
  );
}
