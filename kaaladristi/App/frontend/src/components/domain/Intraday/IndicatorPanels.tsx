/**
 * IndicatorPanels — 4 collapsible wrappers stacked below the chart.
 *
 * Per spec §12 Option A:
 *   1 Confluence    → CorrelationCard (style toggle, LP slot empty)
 *   2 Order Flow    → OrderFlowCard + DivergenceCard
 *   3 Smart Money   → SmartMoneyCard
 *   4 Magic RS      → MagicRsSubchart in index mode
 *
 * Collapsed by default. Expanded sections render the existing
 * Visual Pulse cards verbatim — no copies, just composition.
 */

import { useState, useMemo } from 'react';
import {
  CorrelationCard, OrderFlowCard, SmartMoneyCard, DivergenceCard,
  MagicRsSubchart,
} from '@/components/domain/VisualPulse';
import type { TradingStyle, PulseSnapshot, PulseBar } from '@/services/visualPulseEngine';
import type { SmartMoneyBar } from '@/components/domain/VisualPulse/SmartMoneyCard';
import type { MagicRsDataPoint } from '@/components/domain/VisualPulse/MagicRsSubchart';

interface IndicatorPanelsProps {
  snapshot: PulseSnapshot | null;
  bars: PulseBar[];
  effectiveIdx: number;
  selectedStyle: TradingStyle;
  onStyleChange: (s: TradingStyle) => void;
  smHistory: SmartMoneyBar[];
  rssHistory: number[];
  priceHistory: number[];
  rsiHistory: number[];
  symbolName: string;
}

interface PanelShellProps {
  title: string;
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  accentColor?: string;
}

function PanelShell({ title, summary, defaultOpen = false, children, accentColor = 'var(--text-muted)' }: PanelShellProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      borderTop: '1px solid var(--kd-border)',
      background: 'var(--kd-bg)',
    }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 14px',
          cursor: 'pointer', userSelect: 'none',
          background: 'rgba(255,255,255,0.015)',
          borderBottom: open ? '1px solid var(--kd-border)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{
            width: 3, height: 14, background: accentColor,
            borderRadius: 2, flexShrink: 0,
          }} />
          <span style={{
            fontFamily: 'var(--font-mono, monospace)', fontSize: 10,
            fontWeight: 700, color: 'var(--text-primary)',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            flexShrink: 0,
          }}>{title}</span>
          {summary && (
            <span style={{
              fontFamily: 'var(--font-mono, monospace)', fontSize: 9,
              color: 'var(--text-muted)', marginLeft: 6,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{summary}</span>
          )}
        </div>
        <span style={{
          color: 'var(--text-muted)', fontSize: 10,
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s',
        }}>▼</span>
      </div>
      {open && (
        <div style={{ padding: 12 }}>
          {children}
        </div>
      )}
    </div>
  );
}

export default function IndicatorPanels({
  snapshot, bars, effectiveIdx,
  selectedStyle, onStyleChange,
  smHistory, rssHistory, priceHistory, rsiHistory,
  symbolName,
}: IndicatorPanelsProps) {

  // Panel 4 needs MagicRsDataPoint[]
  const magicData: MagicRsDataPoint[] = useMemo(() => {
    return bars.map(b => ({
      trade_date:    b.trade_date,
      magic_rs:      (b as PulseBar & { magic_rs?: number | null }).magic_rs ?? null,
      magic_ma:      (b as PulseBar & { magic_ma?: number | null }).magic_ma ?? null,
      magic_rs_zone: (b as PulseBar & { magic_rs_zone?: string | null }).magic_rs_zone ?? null,
    }));
  }, [bars]);

  if (!snapshot) {
    return null;
  }

  const flowSummary = snapshot.bar.flow_type ?? '—';
  const rssVal = snapshot.rss?.value ?? null;
  const smVal  = snapshot.bar.sniper_inst ?? 0;
  const dotSummary = snapshot.dots.isSVD ? 'SVD'
                  : snapshot.dots.isSBD ? 'SBD'
                  : snapshot.dots.isSYD ? 'SYD' : '—';
  const zone = magicData[effectiveIdx]?.magic_rs_zone ?? '—';
  const magicRs = magicData[effectiveIdx]?.magic_rs;

  return (
    <div>
      {/* Panel 1 — Confluence */}
      <PanelShell
        title="Confluence"
        accentColor="var(--accent-teal, #40B8C8)"
        summary={`${snapshot.corrState} · astro ${snapshot.astroScore.toFixed(1)} · tech ${snapshot.techScore.toFixed(1)} · sm ${snapshot.smScore.toFixed(1)}`}
      >
        <CorrelationCard
          astroScore={snapshot.astroScore}
          techScore={snapshot.techScore}
          smScore={snapshot.smScore}
          corrState={snapshot.corrState}
          selectedStyle={selectedStyle}
          onStyleChange={onStyleChange}
        />
      </PanelShell>

      {/* Panel 2 — Order Flow / RSSI */}
      <PanelShell
        title="Order Flow / RSSI"
        accentColor="var(--risk-amber)"
        summary={`flow ${flowSummary}${rssVal !== null ? ` · rss ${rssVal.toFixed(0)}` : ''}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <OrderFlowCard
            bar={snapshot.bar}
            rss={snapshot.rss}
            rssHistory={rssHistory}
            narrative=""
          />
          <DivergenceCard
            divergence={snapshot.divergence}
            rsiHistory={rsiHistory}
            priceHistory={priceHistory}
          />
        </div>
      </PanelShell>

      {/* Panel 3 — Smart Money */}
      <PanelShell
        title="Smart Money"
        accentColor="var(--accent-violet, #9B6BC0)"
        summary={`sniper ${typeof smVal === 'number' ? smVal.toFixed(0) : smVal} · dot ${dotSummary}`}
      >
        <SmartMoneyCard
          smHistory={smHistory}
          sm={snapshot.sm}
          dots={[snapshot.dots]}
          narrative=""
        />
      </PanelShell>

      {/* Panel 4 — Magic RS */}
      <PanelShell
        title="Magic RS"
        accentColor="var(--risk-green)"
        summary={`zone ${zone}${magicRs != null ? ` · ${magicRs.toFixed(2)}%` : ''}`}
      >
        <MagicRsSubchart
          data={magicData}
          activeIndex={effectiveIdx}
          benchmarkLabel={symbolName === 'NIFTY 50' ? 'CNX 500' : 'NIFTY 50'}
        />
      </PanelShell>
    </div>
  );
}
