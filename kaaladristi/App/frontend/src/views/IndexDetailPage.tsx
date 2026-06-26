/**
 * IndexDetailPage — /sector-rotation/:indexId
 *
 * Two tabs: Overview | Chart
 * Overview shows metrics + 22D sparkline + full constituent list.
 */

import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowUp, ArrowDown, ChevronUp, ChevronDown } from 'lucide-react';
import { DristiQLoader } from '@/components/ui';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { FLOW_LABELS } from '@/constants/signalScale';
import { useIndexDetail, useIndexSparkline, useConstituentDetails } from '@/hooks/useSectorRotation';
import WorkspaceChart from '@/components/workspace/WorkspaceChart';
import type { ChartOverlay } from '@/types/framework';

const EMPTY_OVERLAYS: ChartOverlay[] = [];
import { useIndexConstituents } from '@/hooks/useMasterData';
import { displaySymbol } from '@/lib/symbolUtils';
import type { SectorIndexRow } from '@/services/sectorRotation';

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

// ── Signal explanation card ───────────────────────────────────────────────────

function SignalCard({ row }: { row: SectorIndexRow }) {
  const signal = computeSignal(row);
  const signalStyle = signal ? SIGNAL_STYLE[signal] : null;
  const signalLabel = signal ? (FLOW_LABELS[signal]?.label ?? signal) : null;
  const conditions = signal ? SIGNAL_CONDITIONS[signal] : null;

  return (
    <div
      style={{
        border: `1px solid ${signal && signalStyle ? signalStyle.border : 'var(--border)'}`,
        borderRadius: 8,
        background: signal && signalStyle ? signalStyle.bg : 'var(--card)',
        padding: '14px 16px',
        marginBottom: 20,
      }}
    >
      {signal && signalStyle ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span
              style={{
                ...MONO,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                color: signalStyle.color,
              }}
            >
              {signalLabel}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {conditions!.map((c) => (
              <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: signalStyle.color, flexShrink: 0, opacity: 0.8 }} />
                <span style={{ ...MONO, fontSize: 11, color: 'var(--text-secondary)' }}>{c}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <span style={{ ...MONO, fontSize: 12, color: 'var(--text-faint)' }}>
          No confluence signal today
        </span>
      )}
    </div>
  );
}

// ── Constituent table ─────────────────────────────────────────────────────────

type SortKey = 'score_5d' | 'pct_chng' | 'ret_5d' | 'ret_22d' | 'ret_66d' | 'rsi_14' | 'magic_rs';
type SortDir = 'asc' | 'desc';

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronDown size={10} style={{ opacity: 0.25, marginLeft: 2 }} />;
  return sortDir === 'desc'
    ? <ChevronDown size={10} style={{ opacity: 0.8, marginLeft: 2, color: 'var(--gold-soft)' }} />
    : <ChevronUp size={10} style={{ opacity: 0.8, marginLeft: 2, color: 'var(--gold-soft)' }} />;
}

function ConstituentTable({ indexId, tradeDate }: { indexId: number; tradeDate: string }) {
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
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ ...thBase, textAlign: 'left', width: 36 }}>#</th>
            <th style={{ ...thBase, textAlign: 'left', width: 110 }}>Symbol</th>
            <th style={{ ...thBase, textAlign: 'left' }}>Company</th>
            <th style={{ ...thBase, textAlign: 'right', width: 80 }}>Close</th>
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
            <th style={{ ...thSortable, textAlign: 'right', width: 60 }} onClick={() => handleSort('rsi_14')}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                RSI<SortIcon col="rsi_14" sortKey={sortKey} sortDir={sortDir} />
              </span>
            </th>
            <th style={{ ...thSortable, textAlign: 'right', width: 76 }} onClick={() => handleSort('score_5d')}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                Score 5D<SortIcon col="score_5d" sortKey={sortKey} sortDir={sortDir} />
              </span>
            </th>
            <th style={{ ...thSortable, textAlign: 'right', width: 80 }} onClick={() => handleSort('magic_rs')}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                Magic RS<SortIcon col="magic_rs" sortKey={sortKey} sortDir={sortDir} />
              </span>
            </th>
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
                style={{
                  background: isEven ? 'transparent' : 'rgba(255,255,255,0.025)',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <td style={{ padding: '9px 12px', color: 'var(--text-faint)' }}>{i + 1}</td>
                <td style={{ padding: '9px 12px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                  {displaySymbol({ symbol: row.symbol, company_name: row.company_name })}
                </td>
                <td style={{ padding: '9px 12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.company_name}
                </td>
                <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                  {row.close != null ? '₹' + row.close.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'}
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
                        background: 'rgba(255,255,255,0.05)',
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
                  {row.magic_rs != null ? fmt(row.magic_rs, 1) : '—'}
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

  const metrics: Array<{ label: string; value: string; color?: string }> = [
    { label: 'Close',       value: '₹' + (row.close ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }), color: 'var(--text-primary)' },
    { label: '% Chg',       value: fmtPct(row.pct_chng),    color: pctColor(row.pct_chng) },
    { label: 'RSI 14',      value: fmt(row.rsi_14, 1),       color: rsiColor(row.rsi_14) },
    { label: '5D Return',   value: fmtPct(row.ret_5d),       color: pctColor(row.ret_5d) },
    { label: '22D Return',  value: fmtPct(row.ret_22d),      color: pctColor(row.ret_22d) },
    { label: '66D Return',  value: fmtPct(row.ret_66d),      color: pctColor(row.ret_66d) },
    { label: 'Score 5D',    value: fmt(row.score_5d, 1),     color: scoreColor(row.score_5d) },
    { label: 'Score 22D',   value: fmt(row.score_22d, 1),    color: scoreColor(row.score_22d) },
    { label: 'Avg Amt 5D',  value: row.avg_amt_5d != null ? `${row.avg_amt_5d.toFixed(1)} Cr` : '—' },
    { label: 'Avg Amt 22D', value: row.avg_amt_22d != null ? `${row.avg_amt_22d.toFixed(1)} Cr` : '—' },
    { label: '% Amt Chg',   value: fmtPct(pctAmtChg),       color: pctColor(pctAmtChg) },
    { label: 'Magic RS',    value: fmt(row.magic_rs, 1) },
  ];

  return (
    <div style={{ padding: '24px' }}>

      {/* Signal explanation */}
      <SignalCard row={row} />

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
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
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
                background: 'rgba(255,255,255,0.05)',
                borderRadius: 3,
                padding: '1px 6px',
              }}
            >
              {row.stock_count} stocks
            </span>
          )}
          <span style={{ ...MONO, fontSize: 10, color: 'var(--text-faint)', marginLeft: 'auto' }}>
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
        {activeTab === 'chart' && <ChartTab row={row} indexId={indexId!} />}
      </div>
    </div>
  );
}
