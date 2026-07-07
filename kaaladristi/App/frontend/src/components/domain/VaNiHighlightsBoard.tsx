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

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVaniHighlights } from '@/hooks/useScan';
import { displaySymbol } from '@/lib/symbolUtils';
import type { VaniHighlightRow, VaniHighlights } from '@/services/scanEngine';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono, monospace)' };
const MAX_ROWS = 8;

// ── "New today" tracking ──────────────────────────────────────────────────────
// The highlight set is legitimately sticky (multi-scan confluence = slow
// states), which made the board LOOK frozen (owner, 2026-07-07). Two cues fix
// that: the as-of trade date in the header, and a badge on names that entered
// since the previous trade date. Previous-day membership is kept in
// localStorage — two snapshots (prev/cur) so the badge survives reloads and
// stays stable for the whole trading day.

const SEEN_KEY = 'kd_vani_highlights_seen_v1';

interface SeenSnapshot {
  prevDate: string | null;
  prev: { strength: number[]; caution: number[] };
  curDate: string;
  cur: { strength: number[]; caution: number[] };
}

/** Roll the stored snapshots forward for `asOf` and return the ids that were
 * NOT present on the previous trade date (per side). First-ever visit has no
 * baseline — nothing is badged rather than badging everything. */
function computeNewIds(data: VaniHighlights): { strength: Set<number>; caution: Set<number> } {
  const empty = { strength: new Set<number>(), caution: new Set<number>() };
  if (!data.asOf) return empty;
  const ids = {
    strength: data.strength.map(r => r.equity_id),
    caution: data.caution.map(r => r.equity_id),
  };
  let snap: SeenSnapshot | null = null;
  try { snap = JSON.parse(localStorage.getItem(SEEN_KEY) ?? 'null'); } catch { /* corrupt — reset */ }

  if (!snap || snap.curDate !== data.asOf) {
    const next: SeenSnapshot = snap && snap.curDate < data.asOf
      ? { prevDate: snap.curDate, prev: snap.cur, curDate: data.asOf, cur: ids }
      : { prevDate: null, prev: { strength: [], caution: [] }, curDate: data.asOf, cur: ids };
    snap = next;
  } else {
    // Same trade date — refresh membership (new scan results intra-day) but
    // keep the previous-day baseline untouched.
    snap = { ...snap, cur: ids };
  }
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(snap)); } catch { /* storage full — cosmetic feature, skip */ }

  if (!snap.prevDate) return empty;
  return {
    strength: new Set(ids.strength.filter(id => !snap!.prev.strength.includes(id))),
    caution: new Set(ids.caution.filter(id => !snap!.prev.caution.includes(id))),
  };
}

function fmtAsOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

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
  row, metric, isNew, onClick,
}: {
  row: VaniHighlightRow;
  metric: string;
  isNew: boolean;
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
      {isNew && (
        <span
          title="Entered the highlights since the previous trading day"
          style={{
            ...MONO, fontSize: 8, fontWeight: 700, letterSpacing: '.06em',
            padding: '1px 4px', borderRadius: 3, flexShrink: 0,
            color: 'var(--accent-indigo)', border: '1px solid var(--accent-indigo)',
            background: 'rgba(99,102,241,0.10)', textTransform: 'uppercase',
          }}
        >
          new
        </span>
      )}
      <span style={{ ...MONO, fontSize: 10, color: 'var(--text-secondary)', flexShrink: 0, width: 34, textAlign: 'right' }}>
        {metric}
      </span>
      <ScanChips scans={row.scans} />
    </div>
  );
}

function HighlightCard({
  title, color, rows, total, metricOf, metricLabel, viewAllPreset, emptyText, newIds,
}: {
  title: string;
  color: string;
  rows: VaniHighlightRow[];
  total: number;
  metricOf: (r: VaniHighlightRow) => string;
  metricLabel: string;
  viewAllPreset: string;
  emptyText: string;
  newIds: Set<number>;
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 6px 4px', borderBottom: '1px solid var(--border)', marginBottom: 2 }}>
        <span style={{ width: 10, flexShrink: 0 }} />
        <span style={{ ...MONO, fontSize: 9, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text-faint)', flex: 1 }}>Stock</span>
        <span style={{ ...MONO, fontSize: 9, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text-faint)', width: 34, textAlign: 'right', flexShrink: 0 }}>{metricLabel}</span>
        <span style={{ ...MONO, fontSize: 9, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text-faint)', flexShrink: 0 }}>Flagged By</span>
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
            isNew={newIds.has(row.equity_id)}
            onClick={() => navigate(`/pulse/equity/${row.equity_id}`)}
          />
        ))
      )}
    </div>
  );
}

export default function VaNiHighlightsBoard() {
  const { data, isLoading } = useVaniHighlights();

  const newIds = useMemo(
    () => data ? computeNewIds(data) : { strength: new Set<number>(), caution: new Set<number>() },
    [data],
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ ...MONO, fontSize: 11, color: 'var(--text-faint)', letterSpacing: '.06em', textTransform: 'uppercase' }}>
          ✦ VaNi Highlights
        </span>
        {data?.asOf && (
          <span style={{ ...MONO, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '.04em' }}>
            as of {fmtAsOf(data.asOf)} close
          </span>
        )}
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          Names where the most scan conditions align — persistent names are the point (multi-scan
          agreement builds over days) · chips = which scans flagged it · observations, not recommendations
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
            metricLabel="Score"
            viewAllPreset="power_buy"
            emptyText="no strength highlights today"
            newIds={newIds.strength}
          />
          <HighlightCard
            title="Caution"
            color="var(--bear)"
            rows={data?.caution ?? []}
            total={data?.cautionTotal ?? 0}
            metricOf={(r) => (r.rs_percentile != null ? String(Math.round(r.rs_percentile)) : '—')}
            metricLabel="RS %ile"
            viewAllPreset="power_sell"
            emptyText="no caution flags today — the distribution and weakness signals are naturally sparse"
            newIds={newIds.caution}
          />
        </div>
      )}
    </div>
  );
}
