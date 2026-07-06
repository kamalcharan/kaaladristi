/**
 * SectorPulse — Workspace · Discovery
 *
 * The rotation verdict without the trip to /sector-rotation: three semantic
 * buckets driven by the same 5-state money-flow signal as the sector heatmap
 * (flowSignal, STRONG cut 25 — single source of truth, imported). Sectoral +
 * curated indices together. Replaces the old industry-rank rotation panel
 * (owner decision 2026-07-06 — one taxonomy, the stable one).
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSectorPulse } from '@/hooks/useSectorRotation';
import {
  flowSignal,
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
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      <span
        title={row.name}
        style={{
          ...MONO, fontSize: 11, color: 'var(--text-secondary)',
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
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
  const navigate = useNavigate();
  const { data = [], isLoading } = useSectorPulse();

  const buckets = useMemo(() => {
    const b: Record<Bucket, SectorPulseRow[]> = { entering: [], fading: [], leaving: [] };
    for (const row of data) {
      const latest = row.cells[0];
      if (!latest) continue;
      const bucket = bucketOf(flowSignal(latest, STRONG_SCORE_CUT_INDEX));
      if (bucket) b[bucket].push(row);
    }
    // Entering/fading: conviction first. Leaving: worst 5D return first.
    b.entering.sort((x, y) => (y.cells[0]?.s5 ?? 0) - (x.cells[0]?.s5 ?? 0));
    b.fading.sort((x, y) => (y.cells[0]?.s5 ?? 0) - (x.cells[0]?.s5 ?? 0));
    b.leaving.sort((x, y) => (x.cells[0]?.ret_5d ?? 0) - (y.cells[0]?.ret_5d ?? 0));
    return b;
  }, [data]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ ...MONO, fontSize: 11, color: 'var(--text-faint)', letterSpacing: '.06em', textTransform: 'uppercase' }}>
          Sector Pulse
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          Money-flow verdict per sector · bars = 22-session conviction trend
        </span>
        <button
          onClick={() => navigate('/sector-rotation')}
          style={{
            ...MONO, marginLeft: 'auto', fontSize: 10, color: 'var(--gold)',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}
        >
          full rotation →
        </button>
      </div>

      {isLoading ? (
        <div style={{ ...MONO, fontSize: 11, color: 'var(--text-faint)', padding: '12px 0' }}>Loading sector pulse…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {(Object.keys(BUCKET_META) as Bucket[]).map((bucket) => {
            const meta = BUCKET_META[bucket];
            const rows = buckets[bucket];
            const overflow = rows.length - MAX_PER_BUCKET;
            return (
              <div
                key={bucket}
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderTop: `2px solid ${meta.color}`,
                  borderRadius: 8,
                  padding: '10px 10px 8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color }} />
                  <span style={{ ...MONO, fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: meta.color }}>
                    {meta.title}
                  </span>
                  <span style={{ ...MONO, fontSize: 10, color: 'var(--text-faint)', marginLeft: 'auto' }}>
                    {rows.length}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 6px 4px', borderBottom: '1px solid var(--border)', marginBottom: 2 }}>
                  <span style={{ ...MONO, fontSize: 9, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text-faint)', flex: 1 }}>Sector</span>
                  <span style={{ ...MONO, fontSize: 9, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text-faint)', width: 28, textAlign: 'right', flexShrink: 0 }}>5D</span>
                  <span style={{ ...MONO, fontSize: 9, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text-faint)', width: 28, textAlign: 'right', flexShrink: 0 }}>22D</span>
                  <span style={{ ...MONO, fontSize: 9, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text-faint)', width: 72, flexShrink: 0 }}>Trend</span>
                </div>
                {rows.length === 0 ? (
                  <div style={{ ...MONO, fontSize: 10, color: 'var(--text-faint)', padding: '6px 6px 8px' }}>
                    none today
                  </div>
                ) : (
                  <>
                    {rows.slice(0, MAX_PER_BUCKET).map((row) => (
                      <PulseRow key={row.id} row={row} onClick={() => navigate(`/sector-rotation/${row.id}`)} />
                    ))}
                    {overflow > 0 && (
                      <button
                        onClick={() => navigate('/sector-rotation')}
                        style={{
                          ...MONO, fontSize: 10, color: 'var(--text-muted)', background: 'none',
                          border: 'none', cursor: 'pointer', padding: '4px 6px',
                        }}
                      >
                        +{overflow} more →
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
