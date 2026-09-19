import { sectorSignal } from '@/lib/sectorFlow';
/**
 * SectorPulse — Workspace · Discovery
 *
 * The rotation verdict without the trip to /sector-rotation: three semantic
 * buckets driven by the same 5-state money-flow signal as the sector heatmap
 * (flowSignal, STRONG cut 25 — single source of truth, imported). Sectoral +
 * curated indices together. Replaces the old industry-rank rotation panel
 * (owner decision 2026-07-06 — one taxonomy, the stable one).
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSectorPulse } from '@/hooks/useSectorRotation';
import {
  MicroTrend,
  STRONG_SCORE_CUT_INDEX,
  type FlowSignal,
} from '@/components/domain/FlowIntensityMap';
import type { SectorPulseRow } from '@/services/sectorRotation';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono, monospace)' };
const MAX_PER_BUCKET = 6;

type Bucket = 'entering' | 'fading' | 'leaving';

const BUCKET_META: Record<Bucket, { title: string; color: string }> = {
  entering: { title: 'Money Entering', color: 'var(--bull)' },
  fading:   { title: 'Fading',         color: 'var(--caution, var(--risk-amber))' },
  leaving:  { title: 'Money Leaving',  color: 'var(--bear)' },
};

function bucketOf(sig: FlowSignal): Bucket | null {
  if (sig === 'STRONG' || sig === 'BUILDING') return 'entering';
  if (sig === 'FADING') return 'fading';
  if (sig === 'OUTFLOW') return 'leaving';
  return null; // QUIET — nothing to report
}

function scoreColor(v: number | null | undefined): string {
  if (v == null || v <= 0) return 'var(--text-faint)';
  return v >= STRONG_SCORE_CUT_INDEX ? 'var(--bull)' : 'var(--gold)';
}

function PulseRow({ row, onClick }: { row: SectorPulseRow; onClick: () => void }) {
  const latest = row.cells[0];
  const s5 = latest?.s5 ?? null;
  const s22 = latest?.s22 ?? null;
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '5px 6px', borderRadius: 6, cursor: 'pointer',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--text-primary) 4%, transparent)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      <span
        title={row.name}
        style={{
          ...MONO, fontSize: 11, color: 'var(--text-secondary)',
          flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {row.name.replace(/^NIFTY /, '')}
      </span>
      <span style={{ ...MONO, fontSize: 12, fontWeight: 600, color: scoreColor(s5), flexShrink: 0, width: 28, textAlign: 'right' }}>
        {s5 != null ? Math.round(s5) : '—'}
      </span>
      <span style={{ ...MONO, fontSize: 11, color: 'var(--text-faint)', flexShrink: 0, width: 28, textAlign: 'right' }}>
        {s22 != null ? Math.round(s22) : '—'}
      </span>
      <div style={{ flexShrink: 0 }}>
        <MicroTrend rowData={row.cells} height={30} />
      </div>
    </div>
  );
}

export default function SectorPulse() {
  const { data = [], isLoading } = useSectorPulse();
  return <SectorPulseContent data={data} isLoading={isLoading} />;
}

export function SectorPulseContent({ data, isLoading = false, embedded = false }: {
  data: SectorPulseRow[]; isLoading?: boolean; embedded?: boolean;
}) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<Bucket[]>([]);

  const buckets = useMemo(() => {
    const b: Record<Bucket, SectorPulseRow[]> = { entering: [], fading: [], leaving: [] };
    for (const row of data) {
      const latest = row.cells[0];
      if (!latest) continue;
      const signal = sectorSignal({ score_5d: latest.s5 ?? null, score_22d: latest.s22 ?? null, avg_amt_5d: latest.amt_5d ?? null, avg_amt_22d: latest.amt_22d ?? null, ret_5d: latest.ret_5d ?? null });
      const bucket = signal ? bucketOf(signal) : null;
      if (bucket) b[bucket].push(row);
    }
    // Entering/fading: conviction first. Leaving: worst 5D return first.
    b.entering.sort((x, y) => (y.cells[0]?.s5 ?? 0) - (x.cells[0]?.s5 ?? 0) || x.name.localeCompare(y.name));
    b.fading.sort((x, y) => (y.cells[0]?.s5 ?? 0) - (x.cells[0]?.s5 ?? 0) || x.name.localeCompare(y.name));
    b.leaving.sort((x, y) => (x.cells[0]?.ret_5d ?? 0) - (y.cells[0]?.ret_5d ?? 0) || x.name.localeCompare(y.name));
    return b;
  }, [data]);

  return (
    <div aria-label="Sector flow snapshot">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ ...MONO, fontSize: 11, color: 'var(--text-faint)', letterSpacing: '.06em', textTransform: 'uppercase' }}>
          Sector Pulse
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          Money-flow verdict per sector · bars = 22-session conviction trend
        </span>
        {!embedded && <button
          onClick={() => navigate('/sector-rotation')}
          style={{
            ...MONO, marginLeft: 'auto', fontSize: 10, color: 'var(--gold)',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}
        >
          full rotation →
        </button>}
      </div>

      {isLoading ? (
        <div style={{ ...MONO, fontSize: 11, color: 'var(--text-faint)', padding: '12px 0' }}>Loading sector pulse…</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {(Object.keys(BUCKET_META) as Bucket[]).map((bucket) => <span key={bucket} style={{
              ...MONO, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 9px',
              borderRadius: 999, border: '1px solid var(--border)', background: 'var(--card)',
              color: BUCKET_META[bucket].color, fontSize: 9, textTransform: 'uppercase', letterSpacing: '.06em',
            }}><b style={{ fontSize: 14 }}>{buckets[bucket].length}</b>{BUCKET_META[bucket].title}</span>)}
          </div>
          <div className="sector-pulse-layout" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          {(Object.keys(BUCKET_META) as Bucket[]).map((bucket) => {
            const meta = BUCKET_META[bucket];
            const rows = buckets[bucket];
            const all = expanded.includes(bucket);
            const overflow = rows.length - MAX_PER_BUCKET;
            const shown = rows.slice(0, all ? rows.length : MAX_PER_BUCKET);
            const splitAt = bucket === 'entering' ? Math.ceil(shown.length / 2) : shown.length;
            const columns = bucket === 'entering' ? [shown.slice(0, splitAt), shown.slice(splitAt)] : [shown];
            return (
              <div
                key={bucket}
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderTop: `2px solid ${meta.color}`,
                  borderRadius: 12,
                  padding: bucket === 'entering' ? '16px 16px 12px' : '12px 12px 10px',
                  gridColumn: bucket === 'entering' ? '1 / -1' : undefined,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color }} />
                  <span role="heading" aria-level={4} style={{ ...MONO, fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: meta.color }}>
                    {meta.title}
                  </span>
                  <span style={{ ...MONO, fontSize: 10, color: 'var(--text-faint)', marginLeft: 'auto' }}>
                    {rows.length}
                  </span>
                </div>
                {rows.length === 0 ? (
                  <div style={{ ...MONO, fontSize: 10, color: 'var(--text-faint)', padding: '6px 6px 8px' }}>none today</div>
                ) : (
                  <>
                    <div className={bucket === 'entering' ? 'sector-pulse-entering-grid' : undefined} style={{ display: 'grid', gridTemplateColumns: bucket === 'entering' ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap: bucket === 'entering' ? 18 : 0 }}>
                      {columns.map((column, columnIndex) => <div key={columnIndex}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 6px 4px', borderBottom: '1px solid var(--border)', marginBottom: 2 }}>
                          <span style={{ ...MONO, fontSize: 9, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text-faint)', flex: 1 }}>Sector</span>
                          <span style={{ ...MONO, fontSize: 9, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text-faint)', width: 28, textAlign: 'right', flexShrink: 0 }}>5D</span>
                          <span style={{ ...MONO, fontSize: 9, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text-faint)', width: 28, textAlign: 'right', flexShrink: 0 }}>22D</span>
                          <span style={{ ...MONO, fontSize: 9, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text-faint)', width: 72, flexShrink: 0 }}>Trend</span>
                        </div>
                        {column.map((row) => <PulseRow key={row.id} row={row} onClick={() => navigate(`/sector-rotation/${row.id}`)} />)}
                      </div>)}
                    </div>
                    {overflow > 0 && (
                      <button
                        onClick={() => embedded ? setExpanded(current => all ? current.filter(b => b !== bucket) : [...current, bucket]) : navigate('/sector-rotation')}
                        aria-expanded={embedded ? all : undefined}
                        style={{ ...MONO, fontSize: 10, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '7px 6px 2px' }}
                      >{all ? 'Show fewer' : `+${overflow} more →`}</button>
                    )}
                  </>
                )}
              </div>
            );
          })}
          </div>
        </>
      )}
    </div>
  );
}
