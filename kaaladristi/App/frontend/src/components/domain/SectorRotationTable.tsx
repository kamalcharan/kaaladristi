/**
 * SectorRotationTable
 * ===================
 * Shared table component for all three Sector Rotation tabs
 * (Broad Market / Sectoral / Thematic).
 *
 * Mandatory columns (always visible):
 *   Index name, Close, %Chg, 5D%, 22D%, 66D%, RSI, Score 5D,
 *   Score 22D, Avg Amt 5D, Avg Amt 22D, % Amt Chg (frontend-computed), Signal
 *
 * Sortable headers — click once for asc, again for desc.
 * Alternating row backgrounds, horizontal scroll on mobile.
 * Uses fieldConfig for all shared field labels, formatters, and colors.
 */

import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { formatValue, getColor } from '@/config/fieldConfig';
import type { SectorIndexRow } from '@/services/sectorRotation';

// ── Signal logic (spec Section 5) ────────────────────────────────────────────

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
  if ((row.ret_22d ?? 0) > 5 && (row.rsi_14 ?? 0) > 55 && !rotatingOut)
    return 'sustained_flow';
  return null;
}

const SIGNAL_LABEL: Record<NonNullable<SignalType>, string> = {
  flow_entering:  'Flow Entering',
  flow_exiting:   'Flow Exiting',
  sustained_flow: 'Sustained Flow',
};

const SIGNAL_STYLE: Record<NonNullable<SignalType>, { color: string; bg: string; border: string }> = {
  flow_entering:  { color: 'var(--bull)',  bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)' },
  flow_exiting:   { color: 'var(--bear)',  bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)' },
  sustained_flow: { color: 'var(--gold)',  bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.3)' },
};

// ── Column definition ─────────────────────────────────────────────────────────

type SortKey =
  | 'name' | 'close' | 'pct_chng'
  | 'ret_5d' | 'ret_22d' | 'ret_66d'
  | 'rsi_14' | 'score_5d' | 'score_22d'
  | 'avg_amt_5d' | 'avg_amt_22d' | 'pct_amt_chg'
  | 'signal';

interface ColDef {
  key: SortKey;
  label: string;
  tooltip: string;
  width: number;
  align?: 'left' | 'right';
  /** Resolve the raw sort value from a row (defaults to row[key]) */
  sortVal?: (row: SectorIndexRow & { pct_amt_chg: number | null; signal: SignalType }) => number | string | null;
}

const COLS: ColDef[] = [
  {
    key:     'name',
    label:   'Index',
    tooltip: 'NSE index name',
    width:   200,
    align:   'left',
    sortVal: (r) => r.name,
  },
  {
    key:     'close',
    label:   'Close',
    tooltip: 'Last traded close (₹)',
    width:   90,
    align:   'right',
    sortVal: (r) => r.close,
  },
  {
    key:     'pct_chng',
    label:   '%Chg',
    tooltip: 'Day % change',
    width:   72,
    align:   'right',
    sortVal: (r) => r.pct_chng,
  },
  {
    key:     'ret_5d',
    label:   '5D%',
    tooltip: '5-day price return (%)',
    width:   65,
    align:   'right',
    sortVal: (r) => r.ret_5d,
  },
  {
    key:     'ret_22d',
    label:   '22D%',
    tooltip: '22-day price return (%)',
    width:   65,
    align:   'right',
    sortVal: (r) => r.ret_22d,
  },
  {
    key:     'ret_66d',
    label:   '66D%',
    tooltip: '66-day price return (%)',
    width:   65,
    align:   'right',
    sortVal: (r) => r.ret_66d,
  },
  {
    key:     'rsi_14',
    label:   'RSI',
    tooltip: 'RSI(14). <40 red · 40–60 amber · >60 green.',
    width:   60,
    align:   'right',
    sortVal: (r) => r.rsi_14,
  },
  {
    key:     'score_5d',
    label:   'Score 5D',
    tooltip: 'Flow score (5D). surge²×25 when surge≥1, else 0.',
    width:   85,
    align:   'right',
    sortVal: (r) => r.score_5d,
  },
  {
    key:     'score_22d',
    label:   'Score 22D',
    tooltip: 'Flow score (22D). surge²×25 when surge≥1, else 0.',
    width:   85,
    align:   'right',
    sortVal: (r) => r.score_22d,
  },
  {
    key:     'avg_amt_5d',
    label:   'Avg Amt 5D',
    tooltip: 'Average turnover over 5 trading days (₹ Cr)',
    width:   95,
    align:   'right',
    sortVal: (r) => r.avg_amt_5d,
  },
  {
    key:     'avg_amt_22d',
    label:   'Avg Amt 22D',
    tooltip: 'Average turnover over 22 trading days (₹ Cr)',
    width:   100,
    align:   'right',
    sortVal: (r) => r.avg_amt_22d,
  },
  {
    key:     'pct_amt_chg',
    label:   '% Amt Chg',
    tooltip: 'Recent turnover vs baseline: (Avg5D − Avg22D) / Avg22D × 100. Green ≥15%, Red ≤−15%.',
    width:   90,
    align:   'right',
    sortVal: (r) => r.pct_amt_chg,
  },
  {
    key:     'signal',
    label:   'Signal',
    tooltip: 'Rotation signal. Flow Entering (green) · Sustained Flow (amber) · Flow Exiting (red).',
    width:   120,
    align:   'left',
    sortVal: (r) => r.signal ?? '',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPct(val: number | null): string {
  if (val == null || isNaN(val)) return '—';
  return `${val > 0 ? '+' : ''}${val.toFixed(1)}%`;
}

function fmtCr(val: number | null): string {
  if (val == null || isNaN(val)) return '—';
  return `${val.toFixed(1)} Cr`;
}

function fmtClose(val: number | null): string {
  if (val == null) return '—';
  return '₹' + val.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function fmtScore(val: number | null): string {
  if (val == null || isNaN(Number(val))) return '—';
  return Number(val).toFixed(1);
}

function rsiColor(val: number | null): string {
  if (val == null) return 'var(--text-secondary)';
  if (val < 40)  return 'var(--bear)';
  if (val <= 60) return 'var(--gold)';
  return 'var(--bull)';
}

function pctColor(val: number | null): string {
  if (val == null) return 'var(--text-secondary)';
  if (val > 0)  return 'var(--bull)';
  if (val < 0)  return 'var(--bear)';
  return 'var(--text-secondary)';
}

function pctAmtChgColor(val: number | null): string {
  if (val == null) return 'var(--text-secondary)';
  if (val >= 15)  return 'var(--bull)';
  if (val <= -15) return 'var(--bear)';
  return 'var(--gold)';
}

function scoreColor(val: number | null): string {
  if (val == null) return 'var(--text-secondary)';
  if (val >= 20) return 'var(--bull)';
  if (val > 0)   return 'var(--gold)';
  return 'var(--text-secondary)';
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  rows: SectorIndexRow[];
}

type SortDir = 'asc' | 'desc';

export default function SectorRotationTable({ rows }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('score_5d');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Enrich rows with computed fields
  const enriched = useMemo(() =>
    rows.map((row) => {
      const pct_amt_chg =
        row.avg_amt_5d != null && row.avg_amt_22d != null && row.avg_amt_22d !== 0
          ? ((row.avg_amt_5d - row.avg_amt_22d) / row.avg_amt_22d) * 100
          : null;
      return { ...row, pct_amt_chg, signal: computeSignal(row) };
    }),
  [rows]);

  const sorted = useMemo(() => {
    const col = COLS.find((c) => c.key === sortKey);
    if (!col) return enriched;
    return [...enriched].sort((a, b) => {
      const av = col.sortVal ? col.sortVal(a) : (a as any)[sortKey];
      const bv = col.sortVal ? col.sortVal(b) : (b as any)[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'string'
        ? av.localeCompare(bv as string)
        : (av as number) - (bv as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [enriched, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ colKey }: { colKey: SortKey }) => {
    if (colKey !== sortKey) return <ChevronsUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 opacity-80" />
      : <ChevronDown className="w-3 h-3 opacity-80" />;
  };

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No data for this tab.</p>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        overflowX: 'auto',
        overflowY: 'visible',
        /* Horizontal scroll without showing scrollbar on non-hover */
        scrollbarWidth: 'thin',
        scrollbarColor: 'var(--border) transparent',
      }}
    >
      <table
        style={{
          width: 'max-content',
          minWidth: '100%',
          borderCollapse: 'collapse',
          fontSize: 13,
          fontFamily: 'var(--font-mono)',
        }}
      >
        {/* ── Header ── */}
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {COLS.map((col) => (
              <th
                key={col.key}
                title={col.tooltip}
                onClick={() => handleSort(col.key)}
                style={{
                  width: col.width,
                  minWidth: col.width,
                  padding: '8px 10px',
                  textAlign: col.align ?? 'right',
                  fontSize: 11,
                  fontWeight: 600,
                  color: sortKey === col.key ? 'var(--text-primary)' : 'var(--text-faint)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                  background: 'var(--card)',
                  position: col.key === 'name' ? 'sticky' : undefined,
                  left: col.key === 'name' ? 0 : undefined,
                  zIndex: col.key === 'name' ? 2 : undefined,
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  {col.label}
                  <SortIcon colKey={col.key} />
                </span>
              </th>
            ))}
          </tr>
        </thead>

        {/* ── Body ── */}
        <tbody>
          {sorted.map((row, i) => {
            const isEven = i % 2 === 0;
            const rowBg = isEven ? 'transparent' : 'rgba(255,255,255,0.025)';

            return (
              <tr
                key={row.index_id}
                style={{ background: rowBg, borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = rowBg;
                }}
              >
                {/* Index name — sticky left */}
                <td
                  style={{
                    padding: '9px 10px',
                    color: 'var(--text-primary)',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    maxWidth: 200,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    position: 'sticky',
                    left: 0,
                    background: isEven ? 'var(--kd-bg, #0e1117)' : 'rgba(255,255,255,0.025)',
                    zIndex: 1,
                  }}
                  title={row.name}
                >
                  {row.name.length > 28 ? row.name.slice(0, 27) + '…' : row.name}
                </td>

                {/* Close */}
                <td style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--text-primary)' }}>
                  {fmtClose(row.close)}
                </td>

                {/* %Chg */}
                <td style={{ padding: '9px 10px', textAlign: 'right', color: pctColor(row.pct_chng) }}>
                  {fmtPct(row.pct_chng)}
                </td>

                {/* 5D% */}
                <td style={{ padding: '9px 10px', textAlign: 'right', color: pctColor(row.ret_5d) }}>
                  {fmtPct(row.ret_5d)}
                </td>

                {/* 22D% */}
                <td style={{ padding: '9px 10px', textAlign: 'right', color: pctColor(row.ret_22d) }}>
                  {fmtPct(row.ret_22d)}
                </td>

                {/* 66D% */}
                <td style={{ padding: '9px 10px', textAlign: 'right', color: pctColor(row.ret_66d) }}>
                  {fmtPct(row.ret_66d)}
                </td>

                {/* RSI */}
                <td style={{ padding: '9px 10px', textAlign: 'right', color: rsiColor(row.rsi_14) }}>
                  {row.rsi_14 != null ? row.rsi_14.toFixed(1) : '—'}
                </td>

                {/* Score 5D */}
                <td style={{ padding: '9px 10px', textAlign: 'right', color: scoreColor(row.score_5d) }}>
                  {fmtScore(row.score_5d)}
                </td>

                {/* Score 22D */}
                <td style={{ padding: '9px 10px', textAlign: 'right', color: scoreColor(row.score_22d) }}>
                  {fmtScore(row.score_22d)}
                </td>

                {/* Avg Amt 5D */}
                <td style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                  {fmtCr(row.avg_amt_5d)}
                </td>

                {/* Avg Amt 22D */}
                <td style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                  {fmtCr(row.avg_amt_22d)}
                </td>

                {/* % Amt Chg — frontend computed */}
                <td style={{ padding: '9px 10px', textAlign: 'right', color: pctAmtChgColor(row.pct_amt_chg) }}>
                  {fmtPct(row.pct_amt_chg)}
                </td>

                {/* Signal badge placeholder */}
                <td style={{ padding: '9px 10px' }}>
                  {row.signal ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: '0.04em',
                        whiteSpace: 'nowrap',
                        color:       SIGNAL_STYLE[row.signal].color,
                        background:  SIGNAL_STYLE[row.signal].bg,
                        border:      `1px solid ${SIGNAL_STYLE[row.signal].border}`,
                      }}
                    >
                      {SIGNAL_LABEL[row.signal]}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>—</span>
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
