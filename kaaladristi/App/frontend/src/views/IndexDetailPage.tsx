/**
 * IndexDetailPage — /sector-rotation/:indexId
 *
 * Two tabs: Overview | Chart
 * Overview shows metrics + 22D sparkline + full constituent list.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowUp, ArrowDown, ChevronUp, ChevronDown, LineChart as LineChartIcon } from 'lucide-react';
import { DristiQLoader } from '@/components/ui';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { FLOW_LABELS, ZONE_LABELS } from '@/constants/signalScale';
import { useIndexDetail, useIndexSparkline, useConstituentDetails, useConstituentFlowMap, useIndexBreadth, useIndexDateRange } from '@/hooks/useSectorRotation';
import WorkspaceChart from '@/components/workspace/WorkspaceChart';
import type { ChartOverlay } from '@/types/framework';

const EMPTY_OVERLAYS: ChartOverlay[] = [];
import { useIndexConstituents } from '@/hooks/useMasterData';
import { displaySymbol, isNumericSymbol } from '@/lib/symbolUtils';
import BookmarkToggle from '@/components/domain/BookmarkToggle';
import { BREADTH_MIN_N, BREADTH_SMALL_N, type SectorIndexRow, type RocBadge } from '@/services/sectorRotation';
import type { IndexBreadthResult, ConstituentDetail } from '@/services/sectorRotation';
import FlowIntensityMap from '@/components/domain/FlowIntensityMap';
import MarketBreadthChart, { resolveRegime } from '@/components/domain/MarketBreadthChart';
import BreadthHeatmap from '@/components/domain/BreadthHeatmap';
import BreadthRocHeatmap from '@/components/domain/BreadthRocHeatmap';
import BreadthRocChart from '@/components/domain/BreadthRocChart';
import VaNiInsight from '@/components/domain/VaNiInsight';
import { useSectorInsight } from '@/hooks/useDashboardExtras';
import MoveQualityCard, { type MoveBadge } from '@/components/domain/MoveQualityCard';
import { computeMoveQuality } from '@/services/moveQuality';

// ── Signal ────────────────────────────────────────────────────────────────────

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

const SIGNAL_CONDITIONS: Record<NonNullable<SignalType>, string[]> = {
  flow_entering:  ['5D return positive', 'Score 5D above Score 22D', 'Delivery amount up >15% vs 22D avg'],
  flow_exiting:   ['5D return negative', 'Score 5D below Score 22D', 'Delivery amount down >15% vs 22D avg'],
  sustained_flow: ['22D return above 5%', 'RSI 14 above 55'],
};

const CATEGORY_LABELS: Record<string, string> = {
  'index':                 'Index',
  'broad market index':    'Broad Market',
  'sectoral index':        'Sectoral',
  'thematic market index': 'Thematic',
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

// ── BSE exception chip ────────────────────────────────────────────────────────
// Constituents are NSE by default; BSE-only scrips (numeric symbol) get a small
// chip. isNumericSymbol is the codebase's BSE heuristic (see lib/symbolUtils).
function BseChip() {
  return (
    <span
      style={{
        ...MONO,
        fontSize: 8,
        fontWeight: 700,
        letterSpacing: '0.05em',
        color: 'var(--text-secondary)',
        background: 'color-mix(in srgb, var(--text-primary) 9%, transparent)',
        border: '1px solid color-mix(in srgb, var(--text-primary) 18%, transparent)',
        borderRadius: 3,
        padding: '1px 4px',
        marginLeft: 5,
        verticalAlign: 'middle',
        flexShrink: 0,
      }}
    >
      BSE
    </span>
  );
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

type SortKey = 'score_5d' | 'score_22d' | 'pct_chng' | 'ret_5d' | 'ret_22d' | 'ret_66d' | 'rsi_14' | 'magic_rs';
type SortDir = 'asc' | 'desc';

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronDown size={10} style={{ opacity: 0.25, marginLeft: 2 }} />;
  return sortDir === 'desc'
    ? <ChevronDown size={10} style={{ opacity: 0.8, marginLeft: 2, color: 'var(--gold-soft)' }} />
    : <ChevronUp size={10} style={{ opacity: 0.8, marginLeft: 2, color: 'var(--gold-soft)' }} />;
}

function ConstituentTable({
  indexId,
  tradeDate,
  onRowClick,
}: {
  indexId: number;
  tradeDate: string;
  onRowClick?: (equityId: number, name: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('score_5d');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const { data: constituents, isLoading: consLoading } = useIndexConstituents(indexId);

  const equityIds = useMemo(() => {
    if (!constituents) return [];
    return constituents.map((c) => c.equity_id);
  }, [constituents]);

  const { data: details, isLoading: detailLoading } = useConstituentDetails(equityIds, tradeDate);

  const isLoading = consLoading || detailLoading;

  const rows = useMemo(() => {
    if (!details || equityIds.length === 0) return [];
    return details;
  }, [details, equityIds]);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      return sortDir === 'desc' ? (bv as number) - (av as number) : (av as number) - (bv as number);
    });
  }, [rows, sortKey, sortDir]);

  function handleSort(col: SortKey) {
    if (col === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(col);
      setSortDir('desc');
    }
  }

  const thBase: React.CSSProperties = {
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
    userSelect: 'none',
    position: 'sticky',
    top: 0,
    zIndex: 2,
  };

  const thSortable: React.CSSProperties = {
    ...thBase,
    cursor: 'pointer',
  };

  if (isLoading) {
    return <DristiQLoader message="Loading constituents…" />;
  }

  if (sortedRows.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <span style={{ ...MONO, fontSize: 12, color: 'var(--text-faint)' }}>No constituent data</span>
      </div>
    );
  }

  return (
    // Own scroll region: overflow:auto gives horizontal reach to the right
    // columns (Flow/RSI/MagicRS were clipped with no scrollbar) while the
    // maxHeight keeps the sticky header working — sticky anchors to the
    // nearest scroll container, so an unbounded overflowX-only wrapper would
    // silently stop the header from sticking.
    <div style={{ overflow: 'auto', maxHeight: '70vh' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 12, minWidth: 980 }}>
        <thead>
          <tr>
            <th style={{ ...thBase, textAlign: 'center', width: 30 }} />
            <th style={{ ...thBase, textAlign: 'left', width: 150 }}>Symbol</th>
            <th style={{ ...thBase, textAlign: 'left' }}>Company</th>
            <th style={{ ...thBase, textAlign: 'right', width: 80 }}>Close</th>
            <th style={{ ...thSortable, textAlign: 'right', width: 76 }} onClick={() => handleSort('score_5d')}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                Score 5D<SortIcon col="score_5d" sortKey={sortKey} sortDir={sortDir} />
              </span>
            </th>
            <th style={{ ...thSortable, textAlign: 'right', width: 82 }} onClick={() => handleSort('score_22d')}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                Score 22D<SortIcon col="score_22d" sortKey={sortKey} sortDir={sortDir} />
              </span>
            </th>
            <th style={{ ...thSortable, textAlign: 'right', width: 60 }} onClick={() => handleSort('rsi_14')}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                RSI<SortIcon col="rsi_14" sortKey={sortKey} sortDir={sortDir} />
              </span>
            </th>
            <th style={{ ...thSortable, textAlign: 'right', width: 80 }} onClick={() => handleSort('magic_rs')}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                Magic RS<SortIcon col="magic_rs" sortKey={sortKey} sortDir={sortDir} />
              </span>
            </th>
            <th style={{ ...thSortable, textAlign: 'right', width: 72 }} onClick={() => handleSort('pct_chng')}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                1D %<SortIcon col="pct_chng" sortKey={sortKey} sortDir={sortDir} />
              </span>
            </th>
            <th style={{ ...thSortable, textAlign: 'right', width: 72 }} onClick={() => handleSort('ret_5d')}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                5D %<SortIcon col="ret_5d" sortKey={sortKey} sortDir={sortDir} />
              </span>
            </th>
            <th style={{ ...thSortable, textAlign: 'right', width: 72 }} onClick={() => handleSort('ret_22d')}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                22D %<SortIcon col="ret_22d" sortKey={sortKey} sortDir={sortDir} />
              </span>
            </th>
            <th style={{ ...thSortable, textAlign: 'right', width: 72 }} onClick={() => handleSort('ret_66d')}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                66D %<SortIcon col="ret_66d" sortKey={sortKey} sortDir={sortDir} />
              </span>
            </th>
            <th style={{ ...thBase, textAlign: 'left', width: 130 }}>Flow</th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, i) => {
            const isEven = i % 2 === 0;
            const flowInfo = row.flow_type ? (FLOW_LABELS[row.flow_type] ?? { label: row.flow_type, color: 'text-muted' }) : null;
            const flowColorVar = flowInfo?.color.replace('text-', '').replace('risk-', '--');
            return (
              <tr
                key={row.equity_id}
                onClick={onRowClick ? () => onRowClick(row.equity_id, displaySymbol({ symbol: row.symbol, company_name: row.company_name })) : undefined}
                style={{
                  background: isEven ? 'transparent' : 'color-mix(in srgb, var(--text-primary) 2.5%, transparent)',
                  borderBottom: '1px solid color-mix(in srgb, var(--text-primary) 4%, transparent)',
                  cursor: onRowClick ? 'pointer' : undefined,
                }}
                onMouseEnter={onRowClick ? (e) => { (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--gold-soft) 10%, transparent)'; } : undefined}
                onMouseLeave={onRowClick ? (e) => { (e.currentTarget as HTMLElement).style.background = isEven ? 'transparent' : 'color-mix(in srgb, var(--text-primary) 2.5%, transparent)'; } : undefined}
              >
                <td style={{ padding: '9px 6px 9px 12px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                  <BookmarkToggle equityId={row.equity_id} size={13} />
                </td>
                <td style={{ padding: '9px 12px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                  {displaySymbol({ symbol: row.symbol, company_name: row.company_name })}
                  {isNumericSymbol(row.symbol) && <BseChip />}
                </td>
                <td style={{ padding: '9px 12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.company_name}
                </td>
                <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                  {row.close != null ? '₹' + row.close.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'}
                </td>
                <td style={{ padding: '9px 12px', textAlign: 'right', color: scoreColor(row.score_5d) }}>
                  {row.score_5d != null ? row.score_5d.toFixed(1) : '—'}
                </td>
                <td style={{ padding: '9px 12px', textAlign: 'right', color: scoreColor(row.score_22d) }}>
                  {row.score_22d != null ? row.score_22d.toFixed(1) : '—'}
                </td>
                <td style={{ padding: '9px 12px', textAlign: 'right', color: rsiColor(row.rsi_14) }}>
                  {row.rsi_14 != null ? row.rsi_14.toFixed(1) : '—'}
                </td>
                <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                  {row.magic_rs != null ? fmt(row.magic_rs, 1) : '—'}
                </td>
                <td style={{ padding: '9px 12px', textAlign: 'right', color: pctColor(row.pct_chng) }}>
                  {fmtPct(row.pct_chng)}
                </td>
                <td style={{ padding: '9px 12px', textAlign: 'right', color: pctColor(row.ret_5d) }}>
                  {fmtPct(row.ret_5d)}
                </td>
                <td style={{ padding: '9px 12px', textAlign: 'right', color: pctColor(row.ret_22d) }}>
                  {fmtPct(row.ret_22d)}
                </td>
                <td style={{ padding: '9px 12px', textAlign: 'right', color: pctColor(row.ret_66d) }}>
                  {fmtPct(row.ret_66d)}
                </td>
                <td style={{ padding: '9px 12px' }}>
                  {flowInfo ? (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 500,
                        padding: '2px 6px',
                        borderRadius: 3,
                        background: 'color-mix(in srgb, var(--text-primary) 5%, transparent)',
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── B70: IndexScoreCard ───────────────────────────────────────────────────────

function IndexScoreCard({ row }: { row: SectorIndexRow }) {
  const signal = computeSignal(row);
  const signalStyle = signal ? SIGNAL_STYLE[signal] : null;
  const flowInfo = row.flow_type ? (FLOW_LABELS[row.flow_type] ?? null) : null;
  const flowColorVar = flowInfo?.color.replace('text-', '').replace('risk-', '--');
  const surge =
    row.avg_amt_5d != null && row.avg_amt_22d != null && row.avg_amt_22d > 0
      ? row.avg_amt_5d / row.avg_amt_22d
      : null;
  const scoreUp = (row.score_5d ?? 0) > (row.score_22d ?? 0);
  const zoneInfo = row.magic_rs_zone ? ZONE_LABELS[row.magic_rs_zone] : null;

  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '16px 20px',
      }}
    >
      {/* Top row: flow + signal */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        {flowInfo && (
          <span
            style={{
              ...MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
              textTransform: 'uppercase', padding: '4px 10px', borderRadius: 4,
              background: 'color-mix(in srgb, var(--text-primary) 6%, transparent)',
              color: `var(${flowColorVar}, var(--text-secondary))`,
              border: `1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)`,
            }}
          >
            {flowInfo.label}
          </span>
        )}
        {signal && signalStyle && (
          <span
            style={{
              ...MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.07em',
              textTransform: 'uppercase', padding: '3px 8px', borderRadius: 4,
              color: signalStyle.color, background: signalStyle.bg,
              border: `1px solid ${signalStyle.border}`,
            }}
          >
            {FLOW_LABELS[signal]?.label ?? signal}
          </span>
        )}
        {zoneInfo && (
          <span style={{ ...MONO, fontSize: 10, color: 'var(--text-faint)', marginLeft: 'auto' }}>
            RS ·{' '}
            <span
              style={{
                color:
                  zoneInfo.color.includes('risk-green') ? 'var(--bull)' :
                  zoneInfo.color.includes('risk-red')   ? 'var(--bear)' :
                  'var(--text-secondary)',
                opacity: zoneInfo.color.includes('/70') ? 0.7 : zoneInfo.color.includes('/40') ? 0.5 : 1,
              }}
            >
              {zoneInfo.label}
            </span>
          </span>
        )}
      </div>

      {/* Score + delivery row — scores first (owner doctrine), returns below */}
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ ...MONO, fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>Score</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ ...MONO, fontSize: 13, fontWeight: 600, color: scoreColor(row.score_5d) }}>
              {row.score_5d != null ? row.score_5d.toFixed(1) : '—'}
            </span>
            {scoreUp ? <ArrowUp size={11} color="var(--bull)" /> : <ArrowDown size={11} color="var(--bear)" />}
            <span style={{ ...MONO, fontSize: 11, color: 'var(--text-faint)' }}>
              {row.score_22d != null ? row.score_22d.toFixed(1) : '—'}
            </span>
            <span style={{ ...MONO, fontSize: 9, color: 'var(--text-faint)' }}>5D·22D</span>
          </div>
        </div>
        {surge != null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ ...MONO, fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>Delivery</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span
                style={{
                  ...MONO, fontSize: 13, fontWeight: 600,
                  color: surge >= 1.2 ? 'var(--bull)' : surge <= 0.8 ? 'var(--bear)' : 'var(--text-secondary)',
                }}
              >
                {surge.toFixed(2)}×
              </span>
              <span style={{ ...MONO, fontSize: 9, color: 'var(--text-faint)' }}>5D/22D</span>
            </div>
          </div>
        )}
        {row.sniper_inst != null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ ...MONO, fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>Smart Money</span>
            <span
              style={{
                ...MONO, fontSize: 13, fontWeight: 600,
                color: row.sniper_inst >= 30 ? 'var(--bull)' : row.sniper_inst >= 15 ? 'var(--gold)' : 'var(--text-secondary)',
              }}
            >
              {row.sniper_inst.toFixed(0)}
            </span>
          </div>
        )}
        {row.stock_count != null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginLeft: 'auto' }}>
            <span style={{ ...MONO, fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>Constituents</span>
            <span style={{ ...MONO, fontSize: 13, color: 'var(--text-secondary)' }}>{row.stock_count}</span>
          </div>
        )}
      </div>
      {/* Returns row */}
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {([['5D', row.ret_5d], ['22D', row.ret_22d], ['66D', row.ret_66d]] as [string, number | null][]).map(([label, v]) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ ...MONO, fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>{label} Ret</span>
            <span style={{ ...MONO, fontSize: 15, fontWeight: 700, color: pctColor(v) }}>{fmtPct(v)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ ...MONO, fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>RSI 14</span>
          <span style={{ ...MONO, fontSize: 15, fontWeight: 700, color: rsiColor(row.rsi_14) }}>
            {row.rsi_14 != null ? row.rsi_14.toFixed(1) : '—'}
          </span>
        </div>
      </div>

    </div>
  );
}

// ── Tab: Overview ─────────────────────────────────────────────────────────────

// Money-flow trend — the rotation story over time. When the 1-week score line
// crosses above the 1-month line, flow into this index is accelerating. This
// replaced a close-price sparkline that carried no rotation information (the
// Chart tab has the full price chart).
function FlowTrendCard({ indexId, height = 110 }: { indexId: number; height?: number }) {
  const { data: sparkline = [], isLoading } = useIndexSparkline(indexId);
  const hasScores = sparkline.some((p) => p.score_5d != null);

  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '14px 16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        <span style={{ ...MONO, fontSize: 9, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
          Money Flow Trend · 30 Sessions
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          Bright line above dim line = flow accelerating into this index
        </span>
      </div>
      {isLoading ? (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ ...MONO, fontSize: 11, color: 'var(--text-faint)' }}>Loading…</span>
        </div>
      ) : hasScores && sparkline.length > 1 ? (
        <>
          <ResponsiveContainer width="100%" height={height}>
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
                formatter={(v: any, name: any) => [
                  typeof v === 'number' ? v.toFixed(1) : v,
                  name === 'score_5d' ? 'Score 5D (1 week)' : 'Score 22D (1 month)',
                ]}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                labelFormatter={(l: any) => String(l)}
              />
              <Line type="monotone" dataKey="score_22d" stroke="var(--text-faint)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
              <Line type="monotone" dataKey="score_5d" stroke="var(--gold-soft)" strokeWidth={2} dot={false} activeDot={{ r: 3, fill: 'var(--gold-soft)' }} />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 14, height: 2, background: 'var(--gold-soft)', flexShrink: 0 }} />
              <span style={{ ...MONO, fontSize: 9, color: 'var(--text-muted)' }}>Score 5D — 1-week flow</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 14, height: 0, borderTop: '2px dashed var(--text-faint)', flexShrink: 0 }} />
              <span style={{ ...MONO, fontSize: 9, color: 'var(--text-muted)' }}>Score 22D — 1-month flow</span>
            </span>
          </div>
        </>
      ) : (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ ...MONO, fontSize: 11, color: 'var(--text-faint)' }}>No flow-score history yet for this index</span>
        </div>
      )}
    </div>
  );
}

// ── Synthesis strip (Overview) ─────────────────────────────────────────────────
// Real confluence signal takes priority (owner doctrine); otherwise an
// auto-composed one-liner reads the day — money flow, breadth regime, momentum.
// The astro-window segment is intentionally hidden pending a data source
// (tracked in CLAUDE.md: "Sector Rotation Overview — astro window pending").
const ROC_STRIP: Record<RocBadge, { label: string; color: string }> = {
  expanding:   { label: 'expanding',   color: 'var(--bull)' },
  slowing:     { label: 'slowing',     color: 'var(--risk-amber)' },
  turning:     { label: 'turning',     color: 'var(--risk-amber)' },
  contracting: { label: 'contracting', color: 'var(--bear)' },
  warming_up:  { label: 'warming up',  color: 'var(--text-muted)' },
};

function SynthesisStrip({
  row,
  breadth,
  inflowCount,
  totalCount,
}: {
  row: SectorIndexRow;
  breadth: IndexBreadthResult | undefined;
  inflowCount: number;
  totalCount: number;
}) {
  const signal = computeSignal(row);

  // Real confluence signal wins.
  if (signal) {
    const st = SIGNAL_STYLE[signal];
    const label = FLOW_LABELS[signal]?.label ?? signal;
    const conditions = SIGNAL_CONDITIONS[signal];
    return (
      <div
        style={{
          borderLeft: `2px solid ${st.color}`, background: st.bg, borderRadius: 6,
          padding: '10px 14px', marginBottom: 16, ...MONO, fontSize: 12.5,
          lineHeight: 1.6, color: 'var(--text-secondary)',
        }}
      >
        <span style={{ color: st.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 8 }}>
          {label}
        </span>
        {conditions.join('  ·  ')}
      </div>
    );
  }

  // Auto-composed read (breadth vocabulary matches MarketBreadthChart exactly).
  const latestScore = breadth?.data?.at(-1)?.breadth_score ?? null;
  const regime = latestScore != null ? resolveRegime(latestScore, breadth?.zoneMode, breadth?.percentileRank ?? undefined) : null;
  const roc = breadth?.rocBadge ? ROC_STRIP[breadth.rocBadge] : null;

  return (
    <div
      style={{
        borderLeft: '2px solid var(--gold-soft)',
        background: 'color-mix(in srgb, var(--gold-soft) 6%, transparent)',
        borderRadius: 6, padding: '10px 14px', marginBottom: 16, ...MONO,
        fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-secondary)',
      }}
    >
      Money flowing into{' '}
      <span style={{ color: 'var(--bull)', fontWeight: 600 }}>{inflowCount}/{totalCount}</span> stocks
      {regime && latestScore != null && (
        <>
          {'  ·  '}Breadth reads{' '}
          <span className={regime.color} style={{ fontWeight: 600 }}>{regime.label} ({latestScore.toFixed(1)})</span>
        </>
      )}
      {roc && (
        <>{'  ·  '}Momentum <span style={{ color: roc.color, fontWeight: 600 }}>{roc.label}</span></>
      )}
    </div>
  );
}

// ── Hero tiles (Overview) — top movers by Score 5D ─────────────────────────────
// Fixed top-8 by Score 5D (not reactive to table sort). Tile fill scales with
// score. Click → the stock's chart.
function HeroTiles({
  details,
  onPick,
}: {
  details: ConstituentDetail[] | undefined;
  onPick: (equityId: number, name: string) => void;
}) {
  const top = useMemo(() => {
    if (!details) return [];
    return [...details]
      .filter((d) => d.score_5d != null)
      .sort((a, b) => (b.score_5d ?? -Infinity) - (a.score_5d ?? -Infinity))
      .slice(0, 8);
  }, [details]);

  if (top.length === 0) return null;
  const max = Math.max(1, ...top.map((d) => d.score_5d ?? 0));

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8 }}>
        Top Movers · Score 5D · click to open chart
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
        {top.map((d) => {
          const t = Math.min(1, (d.score_5d ?? 0) / max);
          const name = displaySymbol({ symbol: d.symbol, company_name: d.company_name });
          return (
            <button
              key={d.equity_id}
              onClick={() => onPick(d.equity_id, name)}
              title={`${d.company_name} — open chart`}
              style={{
                display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left',
                border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px',
                cursor: 'pointer', font: 'inherit',
                background: `color-mix(in srgb, var(--bull) ${(12 + t * 33).toFixed(0)}%, transparent)`,
                transition: 'transform 0.1s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'none'; }}
            >
              <span style={{ display: 'flex', alignItems: 'center', minWidth: 0, ...MONO, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                {isNumericSymbol(d.symbol) && <BseChip />}
              </span>
              <span style={{ ...MONO, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                {(d.score_5d ?? 0).toFixed(1)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Layout (owner decision 2026-07-09): single stacked full-width flow — synthesis
// strip → hero tiles → full-width VaNi → compact stats+trend row → full-width
// constituents table → breadth. Giving the table the whole canvas removes the
// old horizontal scroll (it was squeezed into a half-width column, not
// column-count). Clicking a hero tile or a table row opens that stock's chart.
function OverviewTab({ row, indexId }: { row: SectorIndexRow; indexId: number }) {
  const navigate = useNavigate();
  const { data: breadthData, isLoading: breadthLoading } = useIndexBreadth(indexId, 66);
  const { data: sectorInsight, isLoading: insightLoading } = useSectorInsight(indexId, row.trade_date);

  // Constituent details — deduped with ConstituentTable's identical React Query
  // call (same queryKey). Feeds the hero tiles + the synthesis money-flow count.
  const { data: constituents } = useIndexConstituents(indexId);
  const equityIds = useMemo(() => (constituents ?? []).map((c) => c.equity_id), [constituents]);
  const { data: details } = useConstituentDetails(equityIds, row.trade_date);

  // "Flowing in" = positive Score 5D (the page's Score = money-flow framing).
  const inflowCount = useMemo(() => (details ?? []).filter((d) => (d.score_5d ?? 0) > 0).length, [details]);
  const totalCount = details?.length ?? equityIds.length;

  // Move-quality (Phase 2b) — summarises the constituents table below into a
  // broad/mixed/narrow verdict, and flags the trap when the index's own signal
  // is bullish while the population isn't. Pure derivation of data already here.
  const moveQuality = useMemo(
    () => computeMoveQuality(details, breadthData?.data?.at(-1)?.pct_above_20 ?? null),
    [details, breadthData],
  );
  const moveBadge = useMemo<MoveBadge | null>(() => {
    const sig = computeSignal(row);
    if (!sig) return null;
    return { label: FLOW_LABELS[sig]?.label ?? sig, bullish: sig === 'flow_entering' || sig === 'sustained_flow' };
  }, [row]);

  const goToChart = useCallback(
    (equityId: number, name: string) => navigate(`/chart/equity/${equityId}?name=${encodeURIComponent(name)}`),
    [navigate],
  );

  return (
    <div style={{ padding: '24px' }}>

      {/* 1. Synthesis strip — verdict or auto-composed read */}
      <SynthesisStrip row={row} breadth={breadthData} inflowCount={inflowCount} totalCount={totalCount} />

      {/* 1b. Move-quality verdict (Phase 2b) — the "is this move real?" read,
             directly above the constituents it summarises. */}
      {moveQuality && (
        <div style={{ marginBottom: 16 }}>
          <MoveQualityCard mq={moveQuality} badge={moveBadge} />
        </div>
      )}

      {/* 2. Hero tiles — top movers by Score 5D → stock chart on click */}
      <HeroTiles details={details} onPick={goToChart} />

      {/* 3. VaNi narrative — full width, chip-highlighted */}
      {(insightLoading || sectorInsight?.insight) && (
        <div style={{ marginBottom: 16 }}>
          <VaNiInsight
            insight={sectorInsight?.insight}
            isLoading={insightLoading}
            className="mt-0"
            highlightChips
          />
        </div>
      )}

      {/* 4. Compact row — numeric summary + money-flow trend side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 16, alignItems: 'stretch' }}>
        <IndexScoreCard row={row} />
        <FlowTrendCard indexId={indexId} height={80} />
      </div>

      {/* 5. Constituents — full width, all columns, click a row → the stock's chart */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '10px 14px', background: 'var(--card)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ ...MONO, fontSize: 9, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
            Constituents
          </span>
          <span style={{ ...MONO, fontSize: 9, color: 'var(--text-faint)', opacity: 0.7 }}>
            · click a row to open its chart
          </span>
        </div>
        <ConstituentTable indexId={indexId} tradeDate={row.trade_date} onRowClick={goToChart} />
      </div>

      {/* 6. Breadth context — needs a population: suppressed under 5
             constituents, small-sample caption from 5 to 7 (Breadth_ROC_Spec §4) */}
      {!breadthLoading && breadthData != null && breadthData.stockCount < BREADTH_MIN_N ? (
        <div
          style={{
            background: 'var(--card)',
            border: '1px dashed var(--border)',
            borderRadius: 8,
            padding: '18px 20px',
            marginBottom: 24,
          }}
        >
          <span style={{ ...MONO, fontSize: 9, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-faint)', display: 'block', marginBottom: 6 }}>
            Market Breadth · Breadth Momentum
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Breadth charts will be available once this index has at least {BREADTH_MIN_N} constituents
            (currently {breadthData.stockCount}). Breadth measures what fraction of a population is
            participating — it needs a population.
          </span>
        </div>
      ) : (
        <>
          {!breadthLoading && breadthData != null && breadthData.stockCount < BREADTH_SMALL_N && (
            <div style={{ marginBottom: 8 }}>
              <span style={{ ...MONO, fontSize: 10, color: 'var(--caution, var(--risk-amber))' }}>
                Small sample · {breadthData.stockCount} stocks — one constituent crossing an average
                moves this gauge noticeably
              </span>
            </div>
          )}
          {/* Side by side on wide screens; auto-stack below ~440px each */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: 16, marginBottom: 24, alignItems: 'start' }}>
            <MarketBreadthChart
              data={breadthData?.data}
              isLoading={breadthLoading}
              zoneMode={breadthData?.zoneMode}
              percentileRank={breadthData?.percentileRank ?? undefined}
              stockCount={breadthData?.stockCount}
            />
            <BreadthRocChart
              data={breadthData?.roc}
              isLoading={breadthLoading}
              rocBadge={breadthData?.rocBadge}
            />
          </div>
          {/* Heatmap + raw numbers — same components as the market-wide page,
              fed this index's per-constituent breadth. Mover rows self-hide on
              thin indexes via the heatmap's minMoverUniverse gate. */}
          {!breadthLoading && breadthData != null && breadthData.data.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
              <BreadthHeatmap data={breadthData.data} />
              <BreadthRocHeatmap data={breadthData.roc} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Momentum card (Chart tab) ─────────────────────────────────────────────────

function MomentumCard({ row, indexId }: { row: SectorIndexRow; indexId: number }) {
  const { data: sparkline = [], isLoading: sparkLoading } = useIndexSparkline(indexId);
  const signal = computeSignal(row);
  const signalStyle = signal ? SIGNAL_STYLE[signal] : null;
  const signalLabel = signal ? (FLOW_LABELS[signal]?.label ?? signal) : null;

  const pctAmtChg =
    row.avg_amt_5d != null && row.avg_amt_22d != null && row.avg_amt_22d !== 0
      ? ((row.avg_amt_5d - row.avg_amt_22d) / row.avg_amt_22d) * 100
      : null;

  const score5dHigher = (row.score_5d ?? 0) > (row.score_22d ?? 0);

  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        flexWrap: 'wrap',
        minHeight: 88,
      }}
    >
      {/* Mini sparkline */}
      <div style={{ width: 160, flexShrink: 0 }}>
        <span style={{ ...MONO, fontSize: 9, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-faint)', display: 'block', marginBottom: 4 }}>
          22D Close
        </span>
        {sparkLoading ? (
          <div style={{ height: 48, display: 'flex', alignItems: 'center' }}>
            <span style={{ ...MONO, fontSize: 10, color: 'var(--text-faint)' }}>…</span>
          </div>
        ) : sparkline.length > 1 ? (
          <ResponsiveContainer width="100%" height={48}>
            <LineChart data={sparkline} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
              <Line type="monotone" dataKey="close" stroke="var(--gold-soft)" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 48 }} />
        )}
      </div>

      {/* Score 5D vs 22D */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ ...MONO, fontSize: 9, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
          Score Momentum
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ ...MONO, fontSize: 14, fontWeight: 600, color: scoreColor(row.score_5d) }}>
            {row.score_5d != null ? row.score_5d.toFixed(1) : '—'}
          </span>
          {score5dHigher
            ? <ArrowUp size={12} color="var(--bull)" />
            : <ArrowDown size={12} color="var(--bear)" />}
          <span style={{ ...MONO, fontSize: 11, color: 'var(--text-faint)' }}>
            vs {row.score_22d != null ? row.score_22d.toFixed(1) : '—'}
          </span>
        </div>
        <span style={{ ...MONO, fontSize: 9, color: 'var(--text-faint)' }}>5D vs 22D</span>
      </div>

      {/* % Amt Change */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ ...MONO, fontSize: 9, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
          % Amt Chg
        </span>
        <span style={{ ...MONO, fontSize: 14, fontWeight: 600, color: pctColor(pctAmtChg) }}>
          {fmtPct(pctAmtChg)}
        </span>
        <span style={{ ...MONO, fontSize: 9, color: 'var(--text-faint)' }}>5D vs 22D avg</span>
      </div>

      {/* Signal badge */}
      {signal && signalStyle && (
        <div style={{ marginLeft: 'auto' }}>
          <span
            style={{
              ...MONO,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              color: signalStyle.color,
              background: signalStyle.bg,
              border: `1px solid ${signalStyle.border}`,
              borderRadius: 4,
              padding: '4px 10px',
            }}
          >
            {signalLabel}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Tab: Chart ────────────────────────────────────────────────────────────────

function ChartTab({ row, indexId }: { row: SectorIndexRow; indexId: number }) {
  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <MomentumCard row={row} indexId={indexId} />
      <div
        style={{
          height: 400,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <WorkspaceChart
          instrument={{ id: indexId, symbol: row.name, type: 'index' }}
          overlays={EMPTY_OVERLAYS}
          standalone
        />
      </div>
    </div>
  );
}

// ── FlowMap tab ───────────────────────────────────────────────────────────────

function FlowMapTab({ indexId, indexName }: { indexId: number; indexName: string }) {
  const navigate = useNavigate();
  const { data, isLoading, error } = useConstituentFlowMap(indexId);

  // BSE-only rows (numeric scrip) → BSE chip on the heatmap label.
  const bseRows = useMemo(() => {
    const s = new Set<string>();
    const meta = data?.rowMeta;
    if (meta) for (const [rowName, m] of Object.entries(meta)) if (isNumericSymbol(m.symbol)) s.add(rowName);
    return s;
  }, [data]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <DristiQLoader />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 24 }}>
        Unable to load flow data.
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 24px' }}>
      <FlowIntensityMap
        mode="constituent"
        rows={data?.rows ?? []}
        dates={data?.dates ?? []}
        cells={data?.cells ?? {}}
        title="Flow Intensity"
        subtitle={`${indexName} · Last 22 Sessions`}
        bseRows={bseRows}
        onRowClick={(rowName) => {
          const meta = data?.rowMeta?.[rowName];
          if (meta) navigate(`/chart/equity/${meta.equity_id}?name=${encodeURIComponent(rowName)}`);
        }}
      />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type DetailTab = 'overview' | 'chart' | 'flowmap';

const TAB_LABELS: Record<DetailTab, string> = {
  overview: 'Overview',
  chart:    'Chart',
  flowmap:  'Flow Map',
};

const DETAIL_TABS: DetailTab[] = ['overview', 'chart', 'flowmap'];

export default function IndexDetailPage() {
  const { indexId: indexIdStr } = useParams<{ indexId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  // Date picker — null tracks the latest session; a pinned date reads history.
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const indexId = indexIdStr ? parseInt(indexIdStr, 10) : undefined;
  const { data: row, isLoading, error } = useIndexDetail(indexId, selectedDate ?? undefined);
  const { earliestDate, latestDate } = useIndexDateRange();

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
          <h1 style={{ ...MONO, margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
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
          {row.stock_count != null && row.stock_count > 0 && (
            <span
              style={{
                ...MONO,
                fontSize: 9,
                letterSpacing: '0.06em',
                color: 'var(--text-faint)',
                background: 'color-mix(in srgb, var(--text-primary) 5%, transparent)',
                borderRadius: 3,
                padding: '1px 6px',
              }}
            >
              {row.stock_count} stocks
            </span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
            {/* Date picker — view this index on any past session (Overview data
                follows the pinned date). */}
            <input
              type="date"
              value={selectedDate ?? latestDate ?? row.trade_date}
              min={earliestDate ?? undefined}
              max={latestDate ?? undefined}
              onChange={(e) => {
                const v = e.target.value;
                setSelectedDate(!v || v === latestDate ? null : v);
              }}
              style={{
                ...MONO,
                fontSize: 11,
                color: 'var(--text-secondary)',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '3px 7px',
                colorScheme: 'dark light',
              }}
              title="View this index on a past session"
            />
            {selectedDate && (
              <button
                onClick={() => setSelectedDate(null)}
                style={{
                  ...MONO, fontSize: 10, color: 'var(--gold-soft)', background: 'none',
                  border: 'none', cursor: 'pointer', padding: 0,
                }}
              >
                latest
              </button>
            )}
            {/* Study — open the shared cockpit (verdict pillars + price × signal
                replay) for this index, same as a stock's Study page. */}
            <button
              onClick={() => navigate(`/chart/index/${indexId}?name=${encodeURIComponent(row.name)}`)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                ...MONO, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
                color: 'var(--accent, var(--gold-soft))',
                background: 'color-mix(in srgb, var(--accent, var(--gold-soft)) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--accent, var(--gold-soft)) 35%, transparent)',
                borderRadius: 5, padding: '4px 11px', cursor: 'pointer',
              }}
              title="Open Study — verdict pillars + price × signal replay"
            >
              <LineChartIcon size={12} />
              Study
            </button>
          </div>
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
        {activeTab === 'chart' && <ChartTab row={row} indexId={indexId!} />}
        {activeTab === 'flowmap' && <FlowMapTab indexId={indexId!} indexName={row.name} />}
      </div>
    </div>
  );
}
