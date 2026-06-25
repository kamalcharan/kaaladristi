/**
 * IndexDetailPage — /sector-rotation/:indexId
 *
 * Two tabs: Overview | Chart
 * Overview shows metrics + 22D sparkline + full constituent list.
 */

import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { DristiQLoader } from '@/components/ui';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { FLOW_LABELS } from '@/constants/signalScale';
import { useIndexDetail, useIndexSparkline, useConstituentDetails } from '@/hooks/useSectorRotation';
import { useIndexConstituents } from '@/hooks/useMasterData';
import { displaySymbol } from '@/lib/symbolUtils';
import type { SectorIndexRow } from '@/services/sectorRotation';

// ── Signal (mirrors SectorRotationTable) ──────────────────────────────────────

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

const CATEGORY_LABELS: Record<string, string> = {
  'index':                'Index',
  'broad market index':   'Broad Market',
  'sectoral index':       'Sectoral',
  'thematic market index':'Thematic',
};

// ── Formatting helpers ────────────────────────────────────────────────────────

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

function fmt(v: number | null | undefined, dec = 2): string {
  if (v == null) return '—';
  return v.toFixed(dec);
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—';
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}

function pctColor(v: number | null | undefined): string {
  if (v == null) return 'var(--text-faint)';
  if (v > 0) return 'var(--bull)';
  if (v < 0) return 'var(--bear)';
  return 'var(--text-faint)';
}

function rsiColor(v: number | null): string {
  if (v == null) return 'var(--text-faint)';
  if (v >= 60) return 'var(--bull)';
  if (v <= 40) return 'var(--bear)';
  return 'var(--text-secondary)';
}

function scoreColor(v: number | null): string {
  if (v == null) return 'var(--text-secondary)';
  if (v >= 20) return 'var(--bull)';
  if (v > 0) return 'var(--gold)';
  return 'var(--text-secondary)';
}

// ── MetricCell ────────────────────────────────────────────────────────────────

function MetricCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ ...MONO, fontSize: 9, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
        {label}
      </span>
      <span style={{ ...MONO, fontSize: 14, fontWeight: 600, color: color ?? 'var(--text-primary)' }}>
        {value}
      </span>
    </div>
  );
}

// ── Constituent table ─────────────────────────────────────────────────────────

function ConstituentTable({ indexId, tradeDate }: { indexId: number; tradeDate: string }) {
  const { data: constituents, isLoading: consLoading } = useIndexConstituents(indexId);

  const sortedIds = useMemo(() => {
    if (!constituents) return [];
    return [...constituents]
      .sort((a, b) => (b.weight_pct ?? 0) - (a.weight_pct ?? 0))
      .map((c) => c.equity_id);
  }, [constituents]);

  const { data: details, isLoading: detailLoading } = useConstituentDetails(sortedIds, tradeDate);

  const isLoading = consLoading || detailLoading;

  const rows = useMemo(() => {
    if (!details || sortedIds.length === 0) return [];
    const map = new Map(details.map((d) => [d.equity_id, d]));
    return sortedIds.map((id) => map.get(id)).filter(Boolean) as typeof details;
  }, [details, sortedIds]);

  const thStyle: React.CSSProperties = {
    ...MONO,
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--text-faint)',
    padding: '10px 12px',
    background: 'var(--card)',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
  };

  if (isLoading) {
    return <DristiQLoader message="Loading constituents…" />;
  }

  if (rows.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <span style={{ ...MONO, fontSize: 12, color: 'var(--text-faint)' }}>No constituent data</span>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
        }}
      >
        <thead>
          <tr>
            <th style={{ ...thStyle, textAlign: 'left' }}>#</th>
            <th style={{ ...thStyle, textAlign: 'left', width: 110 }}>Symbol</th>
            <th style={{ ...thStyle, textAlign: 'left' }}>Company</th>
            <th style={{ ...thStyle, textAlign: 'left', width: 130 }}>Flow</th>
            <th style={{ ...thStyle, textAlign: 'right', width: 64 }}>RSI</th>
            <th style={{ ...thStyle, textAlign: 'right', width: 72 }}>Score 5D</th>
            <th style={{ ...thStyle, textAlign: 'right', width: 80 }}>Magic RS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isEven = i % 2 === 0;
            const flowInfo = row.flow_type ? (FLOW_LABELS[row.flow_type] ?? { label: row.flow_type, color: 'text-muted' }) : null;
            const flowColorVar = flowInfo?.color.replace('text-', '').replace('risk-', '--');
            return (
              <tr
                key={row.equity_id}
                style={{
                  background: isEven ? 'transparent' : 'rgba(255,255,255,0.025)',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <td style={{ padding: '9px 12px', color: 'var(--text-faint)', width: 36 }}>
                  {i + 1}
                </td>
                <td style={{ padding: '9px 12px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                  {displaySymbol({ symbol: row.symbol, company_name: row.company_name })}
                </td>
                <td style={{ padding: '9px 12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
                  {row.company_name}
                </td>
                <td style={{ padding: '9px 12px' }}>
                  {flowInfo ? (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 500,
                        padding: '2px 6px',
                        borderRadius: 3,
                        background: 'var(--card-alt, rgba(255,255,255,0.05))',
                        color: `var(${flowColorVar}, var(--text-secondary))`,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {flowInfo.label}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-faint)' }}>—</span>
                  )}
                </td>
                <td style={{ padding: '9px 12px', textAlign: 'right', color: rsiColor(row.rsi_14) }}>
                  {row.rsi_14 != null ? row.rsi_14.toFixed(1) : '—'}
                </td>
                <td style={{ padding: '9px 12px', textAlign: 'right', color: scoreColor(row.score_5d) }}>
                  {row.score_5d != null ? row.score_5d.toFixed(1) : '—'}
                </td>
                <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                  {row.magic_rs != null ? row.magic_rs.toFixed(1) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Tab: Overview ─────────────────────────────────────────────────────────────

function OverviewTab({ row, indexId }: { row: SectorIndexRow; indexId: number }) {
  const { data: sparkline = [], isLoading: sparkLoading } = useIndexSparkline(indexId);

  const pctAmtChg =
    row.avg_amt_5d != null && row.avg_amt_22d != null && row.avg_amt_22d !== 0
      ? ((row.avg_amt_5d - row.avg_amt_22d) / row.avg_amt_22d) * 100
      : null;

  const signal = computeSignal(row);
  const signalStyle = signal ? SIGNAL_STYLE[signal] : null;
  const signalLabel = signal ? (FLOW_LABELS[signal]?.label ?? signal) : null;

  const metrics: Array<{ label: string; value: string; color?: string }> = [
    { label: 'Close',      value: '₹' + (row.close ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }), color: 'var(--text-primary)' },
    { label: '% Chg',      value: fmtPct(row.pct_chng),    color: pctColor(row.pct_chng) },
    { label: 'RSI 14',     value: fmt(row.rsi_14, 1),       color: rsiColor(row.rsi_14) },
    { label: '5D Return',  value: fmtPct(row.ret_5d),       color: pctColor(row.ret_5d) },
    { label: '22D Return', value: fmtPct(row.ret_22d),      color: pctColor(row.ret_22d) },
    { label: '66D Return', value: fmtPct(row.ret_66d),      color: pctColor(row.ret_66d) },
    { label: 'Score 5D',   value: fmt(row.score_5d, 1),     color: scoreColor(row.score_5d) },
    { label: 'Score 22D',  value: fmt(row.score_22d, 1),    color: scoreColor(row.score_22d) },
    { label: 'Avg Amt 5D', value: row.avg_amt_5d != null ? `${row.avg_amt_5d.toFixed(1)} Cr` : '—' },
    { label: 'Avg Amt 22D',value: row.avg_amt_22d != null ? `${row.avg_amt_22d.toFixed(1)} Cr` : '—' },
    { label: '% Amt Chg',  value: fmtPct(pctAmtChg),       color: pctColor(pctAmtChg) },
    { label: 'Magic RS',   value: fmt(row.magic_rs, 1) },
  ];

  return (
    <div style={{ padding: '24px', maxWidth: 860 }}>
      {/* Signal badge */}
      {signal && signalStyle && (
        <div style={{ marginBottom: 18 }}>
          <span
            style={{
              ...MONO,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: signalStyle.color,
              background: signalStyle.bg,
              border: `1px solid ${signalStyle.border}`,
              borderRadius: 4,
              padding: '4px 12px',
            }}
          >
            {signalLabel}
          </span>
        </div>
      )}

      {/* Metrics grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
          gap: 1,
          background: 'var(--border)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          overflow: 'hidden',
          marginBottom: 20,
        }}
      >
        {metrics.map(({ label, value, color }) => (
          <div key={label} style={{ background: 'var(--card)', padding: '13px 16px' }}>
            <MetricCell label={label} value={value} color={color} />
          </div>
        ))}
      </div>

      {/* Sparkline */}
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '14px 16px',
          marginBottom: 24,
        }}
      >
        <span style={{ ...MONO, fontSize: 9, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-faint)', display: 'block', marginBottom: 10 }}>
          Close · 22 Trading Days
        </span>
        {sparkLoading ? (
          <div style={{ height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ ...MONO, fontSize: 11, color: 'var(--text-faint)' }}>Loading…</span>
          </div>
        ) : sparkline.length > 1 ? (
          <ResponsiveContainer width="100%" height={72}>
            <LineChart data={sparkline} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
              <Tooltip
                contentStyle={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--text-primary)',
                }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any) => [typeof v === 'number' ? v.toFixed(2) : v, 'Close']}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                labelFormatter={(l: any) => String(l)}
              />
              <Line type="monotone" dataKey="close" stroke="var(--gold-soft)" strokeWidth={2} dot={false} activeDot={{ r: 3, fill: 'var(--gold-soft)' }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ ...MONO, fontSize: 11, color: 'var(--text-faint)' }}>No data</span>
          </div>
        )}
      </div>

      {/* Constituents */}
      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '10px 14px', background: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
          <span style={{ ...MONO, fontSize: 9, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
            Constituents
          </span>
        </div>
        <ConstituentTable indexId={indexId} tradeDate={row.trade_date} />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type DetailTab = 'overview' | 'chart';

const TAB_LABELS: Record<DetailTab, string> = {
  overview: 'Overview',
  chart:    'Chart',
};

const DETAIL_TABS: DetailTab[] = ['overview', 'chart'];

export default function IndexDetailPage() {
  const { indexId: indexIdStr } = useParams<{ indexId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');

  const indexId = indexIdStr ? parseInt(indexIdStr, 10) : undefined;
  const { data: row, isLoading, error } = useIndexDetail(indexId);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <DristiQLoader message="Loading index…" />
      </div>
    );
  }

  if (error || !row) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <span style={{ ...MONO, fontSize: 12, color: 'var(--risk-red)' }}>
          {error?.message ?? 'Index not found'}
        </span>
      </div>
    );
  }

  const catLabel = CATEGORY_LABELS[row.category?.toLowerCase() ?? ''] ?? row.category;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      {/* ── Header ── */}
      <div
        style={{
          padding: '14px 24px 12px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--card)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => navigate('/sector-rotation')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-faint)',
            ...MONO,
            fontSize: 11,
            letterSpacing: '0.04em',
            padding: '0 0 10px 0',
          }}
        >
          <ArrowLeft size={13} />
          Sector Rotation
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h1
            style={{
              ...MONO,
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
            }}
          >
            {row.name}
          </h1>
          {catLabel && (
            <span
              style={{
                ...MONO,
                fontSize: 9,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-faint)',
                border: '1px solid var(--border)',
                borderRadius: 3,
                padding: '1px 6px',
              }}
            >
              {catLabel}
            </span>
          )}
          <span style={{ ...MONO, fontSize: 11, color: 'var(--text-faint)', marginLeft: 'auto' }}>
            {row.trade_date}
          </span>
        </div>
      </div>

      {/* ── Tab strip ── */}
      <div
        style={{
          display: 'flex',
          gap: 2,
          padding: '0 24px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg)',
          flexShrink: 0,
        }}
      >
        {DETAIL_TABS.map((tab) => {
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                ...MONO,
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--gold-soft)' : 'var(--text-muted)',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--gold-soft)' : '2px solid transparent',
                padding: '10px 16px',
                cursor: 'pointer',
                transition: 'all 0.15s',
                letterSpacing: '0.04em',
                marginBottom: '-1px',
              }}
            >
              {TAB_LABELS[tab]}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ── */}
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
        {activeTab === 'overview' && <OverviewTab row={row} indexId={indexId!} />}
        {activeTab === 'chart' && (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <span style={{ ...MONO, fontSize: 13, color: 'var(--text-faint)' }}>Coming soon</span>
          </div>
        )}
      </div>
    </div>
  );
}
