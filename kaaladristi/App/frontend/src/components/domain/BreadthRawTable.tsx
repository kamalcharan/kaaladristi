import { useMemo, useState } from 'react';
import type { MarketBreadthDay } from '@/types';

/**
 * BreadthRawTable — the numbers behind the breadth score, newest-first, sortable.
 * Shared: fed market-wide km_market_breadth rows or a single index's per-index
 * breadth (same MarketBreadthDay shape). Count columns are gated on presence, so
 * a feeder without movers shows only the score/participation columns.
 */

interface BreadthRawTableProps {
  data: MarketBreadthDay[];
  title?: string;
  /** How many most-recent sessions to show. Default 22. */
  rows?: number;
}

type SortKey =
  | 'trade_date' | 'universe_count' | 'above_20' | 'above_50' | 'above_150'
  | 'up_5pct' | 'down_5pct' | 'up_20pct_5d' | 'down_20pct_5d' | 'breadth_score';

interface Col {
  key: SortKey;
  label: string;
  mover: boolean;                                   // gated on data presence
  get: (d: MarketBreadthDay) => number | string | null;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(d: string): string {
  const [, m, day] = d.split('-');
  return `${+day} ${MONTHS[+m - 1]}`;
}

/** below-count helper: universe − above (both must be present) */
function below(d: MarketBreadthDay, above: number | null | undefined): number | null {
  if (above == null || d.universe_count == null) return null;
  return d.universe_count - above;
}

const COLS: Col[] = [
  { key: 'trade_date',     label: 'Date',       mover: false, get: d => d.trade_date },
  { key: 'universe_count', label: 'Universe',   mover: true,  get: d => d.universe_count ?? null },
  { key: 'above_20',       label: 'Above 20',   mover: true,  get: d => d.above_20 ?? null },
  { key: 'above_50',       label: 'Above 50',   mover: true,  get: d => d.above_50 ?? null },
  { key: 'above_150',      label: 'Above 150',  mover: true,  get: d => d.above_150 ?? null },
  { key: 'up_5pct',        label: 'Up 5%',      mover: true,  get: d => d.up_5pct ?? null },
  { key: 'down_5pct',      label: 'Down 5%',    mover: true,  get: d => d.down_5pct ?? null },
  { key: 'up_20pct_5d',    label: 'Up 20% 5D',  mover: true,  get: d => d.up_20pct_5d ?? null },
  { key: 'down_20pct_5d',  label: 'Down 20% 5D',mover: true,  get: d => d.down_20pct_5d ?? null },
  { key: 'breadth_score',  label: 'Score',      mover: false, get: d => d.breadth_score },
];

function scoreColor(v: number | null): string {
  if (v == null) return 'var(--text-muted)';
  if (v > 55) return 'var(--bear)';       // Greed (inverted, matches breadth chart)
  if (v < 35) return 'var(--bull)';       // Fear
  return 'var(--caution)';
}

export default function BreadthRawTable({ data, title = 'Raw Breadth Data', rows = 22 }: BreadthRawTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('trade_date');
  const [asc, setAsc] = useState(false);

  // Only show mover columns if the data actually has them
  const cols = useMemo(
    () => COLS.filter(c => !c.mover || data.some(d => c.get(d) != null)),
    [data],
  );

  const sorted = useMemo(() => {
    const recent = data.slice(-rows);
    const dir = asc ? 1 : -1;
    return [...recent].sort((a, b) => {
      const av = sortKey === 'trade_date' ? a.trade_date : (a[sortKey] ?? -Infinity);
      const bv = sortKey === 'trade_date' ? b.trade_date : (b[sortKey] ?? -Infinity);
      if (av < bv) return -1 * dir;
      if (av > bv) return  1 * dir;
      return 0;
    });
  }, [data, rows, sortKey, asc]);

  function onSort(k: SortKey) {
    if (k === sortKey) setAsc(a => !a);
    else { setSortKey(k); setAsc(k === 'trade_date' ? false : false); }
  }

  if (data.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-4">
        <h3 className="text-[13px] font-bold text-[var(--text-primary)] mb-1">{title}</h3>
        <p className="text-[11px] text-muted">No breadth data available.</p>
      </div>
    );
  }

  const th: React.CSSProperties = {
    fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase',
    color: 'var(--text-muted)', padding: '7px 10px', textAlign: 'right', cursor: 'pointer',
    whiteSpace: 'nowrap', userSelect: 'none', borderBottom: '1px solid color-mix(in srgb, var(--text-primary) 8%, transparent)',
  };
  const td: React.CSSProperties = {
    fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)',
    padding: '6px 10px', textAlign: 'right', whiteSpace: 'nowrap',
  };

  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-[13px] font-bold text-[var(--text-primary)]">{title}</h3>
        <span className="text-[10px] text-muted">Last {Math.min(rows, data.length)} sessions · click headers to sort</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 560 }}>
          <thead>
            <tr>
              {cols.map((c, i) => (
                <th key={c.key} onClick={() => onSort(c.key)}
                  style={{ ...th, textAlign: i === 0 ? 'left' : 'right' }}>
                  {c.label}{sortKey === c.key ? (asc ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(d => (
              <tr key={d.trade_date}
                style={{ borderBottom: '1px solid color-mix(in srgb, var(--text-primary) 4%, transparent)' }}>
                {cols.map((c, i) => {
                  if (c.key === 'trade_date') {
                    return <td key={c.key} style={{ ...td, textAlign: 'left', color: 'var(--text-primary)' }}>{fmtDate(d.trade_date)}</td>;
                  }
                  if (c.key === 'breadth_score') {
                    return <td key={c.key} style={{ ...td, color: scoreColor(d.breadth_score), fontWeight: 700 }}>
                      {d.breadth_score != null ? d.breadth_score.toFixed(1) : '—'}
                    </td>;
                  }
                  const v = c.get(d) as number | null;
                  return <td key={c.key} style={{ ...td, textAlign: i === 0 ? 'left' : 'right' }}>
                    {v != null ? v.toLocaleString() : '—'}
                  </td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
