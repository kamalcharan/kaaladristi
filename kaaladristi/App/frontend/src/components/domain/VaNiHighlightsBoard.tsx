/**
 * VaNiHighlightsBoard — Workspace · Discovery
 *
 * The actual ✦ set: union of VaNi Highlights across ALL scanners, deduped,
 * two sibling cards — Strength | Caution — both always visible (owner
 * decision 2026-07-06: the caution side stays OPEN; showing strength while
 * hiding risk is exactly the asymmetry to avoid). Chips name the scans that
 * flagged each stock; more than one chip = cross-scan confluence, which is
 * why both sides rank flag-count first.
 *
 * Replaces the three per-scan preview widgets (those remain available as
 * My Space catalog widgets for users who want a specific scan pinned).
 */

import { useNavigate } from 'react-router-dom';
import { useVaniHighlights } from '@/hooks/useScan';
import { displaySymbol } from '@/lib/symbolUtils';
import type { VaniHighlightRow } from '@/services/scanEngine';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono, monospace)' };
const MAX_ROWS = 8;

function ScanChips({ scans }: { scans: string[] }) {
  const shown = scans.slice(0, 2);
  const extra = scans.length - shown.length;
  return (
    <span style={{ display: 'inline-flex', gap: 4, flexShrink: 0 }}>
      {shown.map((s) => (
        <span
          key={s}
          style={{
            ...MONO, fontSize: 8.5, letterSpacing: '.04em',
            padding: '1px 5px', borderRadius: 3,
            background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)',
            whiteSpace: 'nowrap',
          }}
        >
          {s}
        </span>
      ))}
      {extra > 0 && (
        <span style={{ ...MONO, fontSize: 8.5, color: 'var(--text-faint)' }}>+{extra}</span>
      )}
    </span>
  );
}

function HighlightRow({
  row, metric, onClick,
}: {
  row: VaniHighlightRow;
  metric: string;
  onClick: () => void;
}) {
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
      <span style={{ fontSize: 10, color: 'var(--gold)', flexShrink: 0 }}>✦</span>
      <span
        title={row.company_name ?? row.symbol}
        style={{
          ...MONO, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)',
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {displaySymbol({ symbol: row.symbol, company_name: row.company_name ?? '' })}
      </span>
      <span style={{ ...MONO, fontSize: 10, color: 'var(--text-secondary)', flexShrink: 0, width: 34, textAlign: 'right' }}>
        {metric}
      </span>
      <ScanChips scans={row.scans} />
    </div>
  );
}

function HighlightCard({
  title, color, rows, total, metricOf, viewAllPreset, emptyText,
}: {
  title: string;
  color: string;
  rows: VaniHighlightRow[];
  total: number;
  metricOf: (r: VaniHighlightRow) => string;
  viewAllPreset: string;
  emptyText: string;
}) {
  const navigate = useNavigate();
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderTop: `2px solid ${color}`,
        borderRadius: 8,
        padding: '10px 10px 8px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ ...MONO, fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color }}>
          {title}
        </span>
        <span style={{ ...MONO, fontSize: 10, color: 'var(--text-faint)' }}>· {total}</span>
        <button
          onClick={() => navigate(`/scanner/${viewAllPreset}`)}
          style={{
            ...MONO, marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}
        >
          view all →
        </button>
      </div>
      {rows.length === 0 ? (
        <div style={{ ...MONO, fontSize: 10, color: 'var(--text-faint)', padding: '6px 6px 8px' }}>
          {emptyText}
        </div>
      ) : (
        rows.slice(0, MAX_ROWS).map((row) => (
          <HighlightRow
            key={row.equity_id}
            row={row}
            metric={metricOf(row)}
            onClick={() => navigate(`/pulse/equity/${row.equity_id}`)}
          />
        ))
      )}
    </div>
  );
}

export default function VaNiHighlightsBoard() {
  const { data, isLoading } = useVaniHighlights();

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ ...MONO, fontSize: 11, color: 'var(--text-faint)', letterSpacing: '.06em', textTransform: 'uppercase' }}>
          ✦ VaNi Highlights
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          Names where the most scan conditions align today — observations, not recommendations · chips = which scans flagged it
        </span>
      </div>

      {isLoading ? (
        <div style={{ ...MONO, fontSize: 11, color: 'var(--text-faint)', padding: '12px 0' }}>
          Running scanners…
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
          <HighlightCard
            title="Strength"
            color="var(--bull)"
            rows={data?.strength ?? []}
            total={data?.strengthTotal ?? 0}
            metricOf={(r) => (r.score_5d != null ? String(Math.round(r.score_5d)) : '—')}
            viewAllPreset="power_buy"
            emptyText="no strength highlights today"
          />
          <HighlightCard
            title="Caution"
            color="var(--bear)"
            rows={data?.caution ?? []}
            total={data?.cautionTotal ?? 0}
            metricOf={(r) => (r.rs_percentile != null ? `RS ${Math.round(r.rs_percentile)}` : '—')}
            viewAllPreset="power_sell"
            emptyText="no caution flags today — the distribution and weakness signals are naturally sparse"
          />
        </div>
      )}
    </div>
  );
}
