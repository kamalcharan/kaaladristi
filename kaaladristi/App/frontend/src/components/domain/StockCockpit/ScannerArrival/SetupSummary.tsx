/**
 * SetupSummary — right-column card in the ScannerArrivalView.
 *
 * Renders the Key Levels table + Current Situation narrative. Every value
 * comes from SetupData; the card renders `—` where fields are null. Zero
 * preset-specific logic — same card serves Stage 2, Waking Giants, etc.
 *
 * See: docs/claude/scanner-story-page-poa.md · Phase 3.
 */

import type { KeyLevels, CurrentSituation } from '@/services/thesis/setupAdapter';

const TONE_CLASS: Record<'bull' | 'bear' | 'neutral', string> = {
  bull:    'text-risk-green bg-risk-green/10 border-risk-green/30',
  bear:    'text-risk-red bg-risk-red/10 border-risk-red/30',
  neutral: 'text-muted bg-kd-elevated/40 border-kd-border',
};

interface Props {
  setupLabel: string;                // "Stage 2 Leaders"
  keyLevels: KeyLevels;
  currentSituation: CurrentSituation;
  investorTip?: string;
}

export default function SetupSummary({ setupLabel, keyLevels, currentSituation, investorTip }: Props) {
  return (
    <div className="rounded-xl border border-kd-border bg-kd-elevated/10 p-4 space-y-4">
      {/* Setup label + verdict pill */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted">
          {setupLabel}
        </h3>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${TONE_CLASS[currentSituation.verdictTone]}`}
          title="Overall verdict from the What-Confirms checklist"
        >
          {currentSituation.verdict}
        </span>
      </div>

      {/* Key levels table */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2">Key Levels</p>
        <div className="space-y-1 text-xs">
          <LevelRow label="Major Resistance"      value={keyLevels.majorResistance}     tone="bear" />
          <LevelRow label="Immediate Resistance"  value={keyLevels.immediateResistance} tone="bear" />
          <LevelRow label="Pivot"                 value={keyLevels.pivot}               tone="neutral" />
          <LevelRow label="50 EMA (weekly)"       value={keyLevels.ema50Weekly}         tone="neutral" />
          <LevelRow label="Immediate Support"     value={keyLevels.immediateSupport}    tone="bull" />
          <LevelRow label="Strong Support"        value={keyLevels.strongSupport}       tone="bull" />
        </div>
      </div>

      {/* Current Situation narrative */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">Current Situation</p>
        <p className="text-xs leading-relaxed text-[var(--text-primary)]">
          {currentSituation.narrative}
        </p>
      </div>

      {/* Optional investor tip */}
      {investorTip && (
        <div className="rounded-lg border border-risk-green/30 bg-risk-green/10 p-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-risk-green mb-0.5">Investor Tip</p>
          <p className="text-[11px] text-[var(--text-primary)] leading-snug">{investorTip}</p>
        </div>
      )}
    </div>
  );
}

function LevelRow({ label, value, tone }: { label: string; value: number | null; tone: 'bull' | 'bear' | 'neutral' }) {
  const toneClass = tone === 'bull' ? 'text-risk-green' : tone === 'bear' ? 'text-risk-red' : 'text-[var(--text-primary)]';
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted">{label}</span>
      <span className={`font-mono font-bold ${toneClass}`}>
        {value == null || !Number.isFinite(value) ? '—' : `₹${value.toFixed(2)}`}
      </span>
    </div>
  );
}
