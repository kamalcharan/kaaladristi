/**
 * SectorMembershipCard — Study cockpit rail (POA Phase 1.3).
 * Which indices/themes this stock belongs to: official NSE indices from
 * km_equity_symbols.index_names[], curated themes from km_index_constituents.
 * Each chip links to the sector drilldown and carries that sector's live
 * pulse signal dot (same flowSignal as the heatmap / Sector Pulse) — "this
 * stock sits in a Money-Entering sector" at a glance.
 */

import { Link } from 'react-router-dom';
import { Layers } from 'lucide-react';
import { useStockMembership, useSectorPulse } from '@/hooks/useSectorRotation';
import {
  flowSignal,
  STRONG_SCORE_CUT_INDEX,
  type FlowSignal,
} from '@/components/domain/FlowIntensityMap';

const SIGNAL_DOT: Record<FlowSignal, { color: string; label: string; short: string }> = {
  STRONG:   { color: '#166534',           label: 'Strong Conviction', short: 'Strong' },
  BUILDING: { color: 'var(--risk-green)', label: 'Building',           short: 'Building' },
  FADING:   { color: 'var(--risk-amber)', label: 'Fading',             short: 'Fading' },
  OUTFLOW:  { color: 'var(--risk-red)',   label: 'Outflow',            short: 'Outflow' },
  QUIET:    { color: '#64748b',           label: 'Quiet',              short: 'Quiet' },
};

export default function SectorMembershipCard(
  { equityId, exchange }: { equityId: number; exchange?: string | null },
) {
  const { data: memberships = [], isLoading } = useStockMembership(equityId);
  // Sector Pulse data is shared+cached (5 min) — attach a live signal dot to
  // every membership we have cells for (sectoral + curated indices).
  const { data: pulse = [] } = useSectorPulse();
  const signalById = new Map<number, FlowSignal>(
    pulse
      .filter((p) => p.cells[0])
      .map((p) => [p.id, flowSignal(p.cells[0], STRONG_SCORE_CUT_INDEX)]),
  );

  // Rendering NOTHING on an empty list is what made this section look broken:
  // the header expanded onto blank space, and "in no index" was indistinguishable
  // from "we never loaded it". Say which.
  //
  // 6,580 of 6,615 active BSE rows and 2,376 of 3,797 NSE rows land here. On BSE
  // that is mostly correct — NIFTY indices do not contain BSE scrips, and the 35
  // BSE stocks that DO appear are in curated indices, which this card reads from
  // km_index_constituents alongside the official ones. On NSE it is a real gap:
  // the membership seeder last ran on 2026-02-14, so nothing registered since
  // has index_names at all.
  if (isLoading) return null;
  if (memberships.length === 0) {
    return (
      <div className="rounded-lg bg-kd-card border border-kd-border p-3">
        <div className="flex items-center gap-2 mb-1.5">
          <Layers className="w-3.5 h-3.5 text-[var(--text-faint)]" />
          <span className="text-[11px] font-serif font-semibold text-primary tracking-wide">
            Member Of
          </span>
        </div>
        <p className="text-[10px] font-mono text-muted leading-relaxed">
          {exchange === 'BSE'
            ? 'Not in any tracked index. NSE indices cover NSE listings — check this company\u2019s NSE line, or add it to a curated index.'
            : 'Not in any tracked index.'}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-kd-card border border-kd-border p-3">
      <div className="flex items-center gap-2 mb-2">
        <Layers className="w-3.5 h-3.5 text-accent-indigo" />
        <span className="text-[11px] font-serif font-semibold text-primary tracking-wide">
          Member Of
        </span>
        <span className="ml-auto text-[9px] font-mono text-muted">{memberships.length}</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {memberships.map((m) => {
          const sig = signalById.get(m.id);
          const dot = sig ? SIGNAL_DOT[sig] : null;
          return (
            <Link
              key={m.id}
              to={`/sector-rotation/${m.id}`}
              title={dot ? `${m.name} — sector signal: ${dot.label}` : m.name}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-kd-border bg-kd-elevated hover:border-accent-indigo/50 transition-colors"
            >
              {dot && (
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: dot.color }}
                />
              )}
              <span className="text-[10px] font-mono text-[var(--text-secondary)]">
                {m.name.replace(/^NIFTY /, '')}
              </span>
              {dot && (
                <span
                  className="text-[8px] font-mono font-bold uppercase tracking-wider"
                  style={{ color: dot.color }}
                >
                  {dot.short}
                </span>
              )}
              {m.isCurated && (
                <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-[var(--gold,#d4a84b)]">
                  Curated
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
