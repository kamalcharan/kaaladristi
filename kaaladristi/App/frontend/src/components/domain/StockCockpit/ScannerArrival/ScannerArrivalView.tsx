/**
 * ScannerArrivalView — Phase 4 shell for the Scanner Story Page.
 *
 * Rendered inside ThesisTab when the URL carries ?setup=<preset>.
 * Composes the four Phase 2-3 cards:
 *
 *   ┌───────────────────────────────────────────────┐
 *   │  AnnotatedWeeklyChart      │  SetupSummary    │
 *   ├────────────────────────────┴──────────────────┤
 *   │  PersonaEntries           │  WhatConfirms     │
 *   └───────────────────────────────────────────────┘
 *
 * All data comes from useSetupData → adapter → SetupData. No preset
 * branching here. Adding Waking Giants / Flower Pot Burst = new
 * adapter file + one line in services/thesis/adapters/index.ts.
 *
 * See: docs/claude/scanner-story-page-poa.md · Phase 4.
 */

import { Loader2 } from 'lucide-react';
import { useSetupData } from '@/hooks/useSetupData';
import AnnotatedWeeklyChart from './AnnotatedWeeklyChart';
import SetupSummary from './SetupSummary';
import PersonaEntriesCard from './PersonaEntries';
import WhatConfirms from './WhatConfirms';

interface Props {
  equityId: number;
  setupKey: string;
}

export default function ScannerArrivalView({ equityId, setupKey }: Props) {
  const { data, weekly, isLoading, error } = useSetupData(equityId, setupKey);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 border border-kd-border rounded-xl bg-kd-elevated/10">
        <Loader2 className="w-4 h-4 animate-spin text-accent-indigo" />
        <span className="ml-2 text-xs text-muted">Building thesis view…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-risk-red/30 bg-risk-red/10 p-4">
        <p className="text-xs text-risk-red font-semibold mb-1">
          Couldn't build the setup view for this stock.
        </p>
        <p className="text-[11px] text-muted leading-relaxed">
          {error?.message ?? 'No data returned. If this stock is a fresh listing or the setup key is unknown, refreshing later usually resolves it.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header strip — symbol + phase pill + %chg */}
      <ScannerArrivalHeader data={data} />

      {/* Row 1: Chart (2/3) + Setup Summary (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <AnnotatedWeeklyChart
            bars={weekly}
            annotations={data.chartAnnotations}
            personas={{
              ltInvestor:  data.personas.ltInvestor.map((e) => ({ entryNo: e.entryNo, price: e.price, label: e.label })),
              swingTrader: data.personas.swingTrader.map((e) => ({ entryNo: e.entryNo, price: e.price, label: e.label })),
            }}
          />
        </div>
        <div>
          <SetupSummary
            setupLabel={data.setupLabel}
            keyLevels={data.keyLevels}
            currentSituation={data.currentSituation}
            investorTip={data.investorTip}
          />
        </div>
      </div>

      {/* Row 2: Personas (2/3) + What Confirms (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <PersonaEntriesCard personas={data.personas} />
        </div>
        <div>
          <WhatConfirms items={data.whatConfirms} />
        </div>
      </div>
    </div>
  );
}

function ScannerArrivalHeader({ data }: { data: NonNullable<ReturnType<typeof useSetupData>['data']> }) {
  const h = data.header;
  const toneClass = h.phaseTone === 'bull'
    ? 'text-risk-green bg-risk-green/10 border-risk-green/30'
    : h.phaseTone === 'bear'
      ? 'text-risk-red bg-risk-red/10 border-risk-red/30'
      : 'text-muted bg-kd-elevated/40 border-kd-border';
  const chgClass = (h.pctChng ?? 0) >= 0 ? 'text-risk-green' : 'text-risk-red';

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap px-3 py-2 rounded-xl border border-kd-border bg-kd-elevated/20">
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        <span className="text-[11px] font-bold uppercase tracking-wider text-accent-indigo">
          {data.setupLabel}
        </span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${toneClass}`}>
          {h.phase}
        </span>
        {h.industry && (
          <span className="text-[10px] text-muted truncate">· {h.industry}</span>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs shrink-0">
        {h.rsPercentile != null && (
          <span className="font-mono text-muted">
            RS %ile <span className="text-[var(--text-primary)] font-bold">{h.rsPercentile.toFixed(0)}</span>
          </span>
        )}
        <span className="font-mono font-bold text-sm text-[var(--text-primary)]">
          ₹{h.close.toFixed(2)}
        </span>
        <span className={`font-mono font-bold text-[11px] ${chgClass}`}>
          {(h.pctChng ?? 0) >= 0 ? '+' : ''}{(h.pctChng ?? 0).toFixed(2)}%
        </span>
      </div>
    </div>
  );
}
