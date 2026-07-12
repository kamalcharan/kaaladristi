/**
 * IndexDrawer — right-side slide-in panel triggered by clicking a row
 * in SectorRotationTable. Shows key metrics, a 22-day sparkline,
 * and the top 10 constituent equities for the selected index.
 */

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { X } from 'lucide-react';
import { formatValue, getColor } from '@/config/fieldConfig';
import { FLOW_LABELS } from '@/constants/signalScale';
import { useIndexConstituents } from '@/hooks/useMasterData';
import { useIndexSparkline, useConstituentDetails } from '@/hooks/useSectorRotation';
import { displaySymbol } from '@/lib/symbolUtils';
import type { SectorIndexRow } from '@/services/sectorRotation';

// ── Signal (mirrors SectorRotationTable — not exported from there) ─────────────

type SignalType = 'flow_entering' | 'flow_exiting' | 'sustained_flow' | null;

function computeSignal(row: SectorIndexRow): SignalType {
  const pctAmtChg =
    row.avg_amt_5d != null && row.avg_amt_22d != null && row.avg_amt_22d !== 0
      ? ((row.avg_amt_5d - row.avg_amt_22d) / row.avg_amt_22d) * 100
      : null;
  const rotatingIn =
    (row.ret_5d ?? 0) > 0 &&
    (row.score_5d ?? 0) > (row.score_22d ?? 0) &&
    pctAmtChg != null &&
    pctAmtChg > 15;
  const rotatingOut =
    (row.ret_5d ?? 0) < 0 &&
    (row.score_5d ?? 0) < (row.score_22d ?? 0) &&
    pctAmtChg != null &&
    pctAmtChg < -15;
  if (rotatingIn) return 'flow_entering';
  if (rotatingOut) return 'flow_exiting';
  if ((row.ret_22d ?? 0) > 5 && (row.rsi_14 ?? 0) > 55 && !rotatingOut) return 'sustained_flow';
  return null;
}

const SIGNAL_STYLE: Record<NonNullable<SignalType>, { color: string; bg: string; border: string }> = {
  flow_entering:  { color: 'var(--bull)',  bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)' },
  flow_exiting:   { color: 'var(--bear)',  bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)' },
  sustained_flow: { color: 'var(--gold)',  bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.3)' },
};

// ── Category display label ─────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  'index':                'Index',
  'broad market index':   'Broad Market',
  'sectoral index':       'Sectoral',
  'thematic market index':'Thematic',
};

function categoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat.toLowerCase()] ?? cat;
}

// ── Inline helpers ─────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined, decimals = 2): string {
  if (v == null) return '—';
  return v.toFixed(decimals);
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—';
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}

function rsiColor(v: number | null): string {
  if (v == null) return 'var(--text-faint)';
  if (v >= 60) return 'var(--bull)';
  if (v <= 40) return 'var(--bear)';
  return 'var(--text-secondary)';
}

function pctColor(v: number | null): string {
  if (v == null) return 'var(--text-faint)';
  if (v > 0) return 'var(--bull)';
  if (v < 0) return 'var(--bear)';
  return 'var(--text-faint)';
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface IndexDrawerProps {
  indexId: number | null;
  row: SectorIndexRow | null;
  onClose: () => void;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricCell({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: 'var(--text-faint)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          fontWeight: 600,
          color: color ?? 'var(--text-primary)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function FlowChip({ flowType }: { flowType: string | null }) {
  if (!flowType) return <span style={{ color: 'var(--text-faint)', fontSize: '11px' }}>—</span>;
  const info = FLOW_LABELS[flowType] ?? { label: flowType, color: 'text-muted' };
  const colorVar = info.color.replace('text-', '').replace('risk-', '--');
  const style: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    fontWeight: 500,
    padding: '1px 5px',
    borderRadius: '3px',
    background: 'var(--panel-recess)',
    color: `var(${colorVar}, var(--text-secondary))`,
    whiteSpace: 'nowrap',
  };
  return <span style={style}>{info.label}</span>;
}

// ── Constituent list ───────────────────────────────────────────────────────────

function ConstituentList({
  indexId,
  tradeDate,
}: {
  indexId: number;
  tradeDate: string;
}) {
  const { data: constituents, isLoading: consLoading } = useIndexConstituents(indexId);

  const top10Ids = useMemo(() => {
    if (!constituents) return [];
    return [...constituents]
      .sort((a, b) => (b.weight_pct ?? 0) - (a.weight_pct ?? 0))
      .slice(0, 10)
      .map((c) => c.equity_id);
  }, [constituents]);

  const { data: details, isLoading: detailLoading } = useConstituentDetails(top10Ids, tradeDate);

  const isLoading = consLoading || detailLoading;

  const rows = useMemo(() => {
    if (!details || top10Ids.length === 0) return [];
    const map = new Map(details.map((d) => [d.equity_id, d]));
    return top10Ids.map((id) => map.get(id)).filter(Boolean) as typeof details;
  }, [details, top10Ids]);

  const rowStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 80px 48px 56px',
    gap: '0 8px',
    alignItems: 'center',
    padding: '6px 16px',
    borderBottom: '1px solid var(--border)',
  };

  const monoSm: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
  };

  if (isLoading) {
    return (
      <div style={{ padding: '16px', textAlign: 'center' }}>
        <span style={{ ...monoSm, color: 'var(--text-faint)' }}>Loading constituents…</span>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div style={{ padding: '16px', textAlign: 'center' }}>
        <span style={{ ...monoSm, color: 'var(--text-faint)' }}>No constituent data</span>
      </div>
    );
  }

  return (
    <>
      {/* Header row */}
      <div
        style={{
          ...rowStyle,
          background: 'var(--card)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {['Symbol', 'Flow', 'Scr5D', 'RSI'].map((h) => (
          <span key={h} style={{ ...monoSm, color: 'var(--text-faint)', fontSize: '9px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {h}
          </span>
        ))}
      </div>
      {rows.map((row) => (
        <div key={row.equity_id} style={rowStyle}>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...monoSm, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displaySymbol({ symbol: row.symbol, company_name: row.company_name })}
            </div>
            <div style={{ ...monoSm, fontSize: '10px', color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {row.company_name}
            </div>
          </div>
          <FlowChip flowType={row.flow_type} />
          <span style={{ ...monoSm, color: 'var(--text-secondary)', textAlign: 'right' }}>
            {row.score_5d != null ? row.score_5d.toFixed(1) : '—'}
          </span>
          <span style={{ ...monoSm, color: rsiColor(row.rsi_14), textAlign: 'right' }}>
            {row.rsi_14 != null ? row.rsi_14.toFixed(1) : '—'}
          </span>
        </div>
      ))}
    </>
  );
}

// ── Main Drawer ────────────────────────────────────────────────────────────────

export default function IndexDrawer({ indexId, row, onClose }: IndexDrawerProps) {
  const navigate = useNavigate();
  const open = indexId != null && row != null;

  const { data: sparkline = [], isLoading: sparkLoading } = useIndexSparkline(open ? indexId : null);

  const signal = row ? computeSignal(row) : null;
  const signalStyle = signal ? SIGNAL_STYLE[signal] : null;
  const signalText = signal ? (FLOW_LABELS[signal]?.label ?? signal) : null;

  const pctAmtChg =
    row?.avg_amt_5d != null && row?.avg_amt_22d != null && row.avg_amt_22d !== 0
      ? ((row.avg_amt_5d - row.avg_amt_22d) / row.avg_amt_22d) * 100
      : null;

  const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.35)', // theme-agnostic: drawer scrim, black in both modes by design
          zIndex: 190,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity .25s',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: 52,
          right: 0,
          bottom: 0,
          width: 380,
          background: 'var(--bg)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform .25s cubic-bezier(.4,0,.2,1)',
          overflowY: 'auto',
        }}
      >
        {row && (
          <>
            {/* ── Header ── */}
            <div
              style={{
                padding: '16px 16px 12px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--card)',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2
                    style={{
                      ...MONO,
                      fontSize: '14px',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      margin: 0,
                      lineHeight: 1.3,
                      wordBreak: 'break-word',
                    }}
                  >
                    {row.name}
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {/* Category badge */}
                    <span
                      style={{
                        ...MONO,
                        fontSize: '9px',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: 'var(--text-faint)',
                        border: '1px solid var(--border)',
                        borderRadius: '3px',
                        padding: '1px 5px',
                      }}
                    >
                      {categoryLabel(row.category)}
                    </span>
                    {/* Signal badge */}
                    {signal && signalStyle && (
                      <span
                        style={{
                          ...MONO,
                          fontSize: '9px',
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color: signalStyle.color,
                          background: signalStyle.bg,
                          border: `1px solid ${signalStyle.border}`,
                          borderRadius: '3px',
                          padding: '1px 5px',
                        }}
                      >
                        {signalText}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-faint)',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* ── Key Metrics Strip ── */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1px',
                background: 'var(--border)',
                borderBottom: '1px solid var(--border)',
                flexShrink: 0,
              }}
            >
              {[
                { label: 'Close',      value: fmt(row.close, 2),          color: 'var(--text-primary)' },
                { label: 'Score 5D',   value: fmt(row.score_5d, 1),       color: 'var(--text-secondary)' },
                { label: '1D%',        value: fmtPct(row.pct_chng),       color: pctColor(row.pct_chng) },
                { label: 'RSI',        value: fmt(row.rsi_14, 1),         color: rsiColor(row.rsi_14) },
                { label: 'Avg Amt 5D', value: row.avg_amt_5d != null ? `${row.avg_amt_5d.toFixed(2)} Cr` : '—', color: 'var(--text-secondary)' },
                { label: '% Amt Chg', value: pctAmtChg != null ? fmtPct(pctAmtChg) : '—', color: pctColor(pctAmtChg) },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  style={{
                    background: 'var(--card)',
                    padding: '10px 12px',
                  }}
                >
                  <MetricCell label={label} value={value} color={color} />
                </div>
              ))}
            </div>

            {/* ── Sparkline ── */}
            <div
              style={{
                padding: '12px 16px 8px',
                borderBottom: '1px solid var(--border)',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  ...MONO,
                  fontSize: '9px',
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: 'var(--text-faint)',
                  display: 'block',
                  marginBottom: '8px',
                }}
              >
                Close · 22D
              </span>
              {sparkLoading ? (
                <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ ...MONO, fontSize: '11px', color: 'var(--text-faint)' }}>Loading…</span>
                </div>
              ) : sparkline.length > 1 ? (
                <ResponsiveContainer width="100%" height={60}>
                  <LineChart data={sparkline} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                    <Tooltip
                      contentStyle={{
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        color: 'var(--text-primary)',
                      }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(v: any) => [typeof v === 'number' ? v.toFixed(2) : v, 'Close']}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      labelFormatter={(l: any) => String(l)}
                    />
                    <Line
                      type="monotone"
                      dataKey="close"
                      stroke="var(--gold-soft)"
                      strokeWidth={1.5}
                      dot={false}
                      activeDot={{ r: 3, fill: 'var(--gold-soft)' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ ...MONO, fontSize: '11px', color: 'var(--text-faint)' }}>No data</span>
                </div>
              )}
            </div>

            {/* ── Top Constituents ── */}
            <div style={{ flexShrink: 0 }}>
              <div
                style={{
                  padding: '10px 16px 6px',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <span
                  style={{
                    ...MONO,
                    fontSize: '9px',
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase',
                    color: 'var(--text-faint)',
                  }}
                >
                  Top Constituents
                </span>
              </div>
              <ConstituentList indexId={indexId!} tradeDate={row.trade_date} />
            </div>

            {/* ── Action ── */}
            <div
              style={{
                marginTop: 'auto',
                padding: '16px',
                borderTop: '1px solid var(--border)',
                background: 'var(--card)',
                flexShrink: 0,
              }}
            >
              <button
                onClick={() => navigate(`/workspace?index=${indexId}`)}
                style={{
                  width: '100%',
                  background: 'var(--gold-soft)',
                  color: 'var(--bg)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '10px 16px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                }}
              >
                View Chart →
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
