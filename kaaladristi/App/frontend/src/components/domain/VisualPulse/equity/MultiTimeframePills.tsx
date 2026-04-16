/**
 * MultiTimeframePills — 1D / 1W / 1M RS momentum dots
 * =====================================================
 * Shows Magic RS change over 1-day, 5-day, 20-day periods.
 * Green dot = improving, Red = declining, Grey = insufficient data.
 * All-green cluster gets a subtle green glow.
 */

import React, { useState } from 'react';

interface MultiTimeframePillsProps {
  rsChange1d: number | null;
  rsChange5d: number | null;
  rsChange20d: number | null;
  currentRs: number | null;
  benchmarkLabel: string;
}

interface PillProps {
  label: string;
  delta: number | null;
  currentRs: number | null;
}

function Pill({ label, delta, currentRs }: PillProps) {
  const [hovered, setHovered] = useState(false);

  const isNull = delta == null;
  const isPositive = !isNull && delta > 0;
  const isNegative = !isNull && delta < 0;

  const dotColor = isNull
    ? 'bg-slate-500'
    : isPositive
    ? 'bg-risk-green'
    : 'bg-risk-red';

  const priorVal = currentRs != null && delta != null ? currentRs - delta : null;

  return (
    <div
      className="relative flex items-center gap-1.5 cursor-default"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="text-[10px] font-mono text-secondary">{label}</span>
      <span className={`w-2 h-2 rounded-full ${dotColor}`} />

      {/* Tooltip */}
      {hovered && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-md bg-kd-elevated border border-kd-border shadow-lg z-50 whitespace-nowrap">
          <span className="text-[10px] font-mono text-primary">
            {isNull ? (
              'Insufficient data'
            ) : (
              <>
                {label}{' '}
                <span className={isPositive ? 'text-risk-green' : 'text-risk-red'}>
                  {isPositive ? '+' : ''}{delta.toFixed(1)}
                </span>
                {priorVal != null && currentRs != null && (
                  <span className="text-muted ml-1">
                    ({priorVal.toFixed(1)} → {currentRs.toFixed(1)})
                  </span>
                )}
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

export default function MultiTimeframePills({
  rsChange1d,
  rsChange5d,
  rsChange20d,
  currentRs,
  benchmarkLabel,
}: MultiTimeframePillsProps) {
  const allGreen =
    rsChange1d != null && rsChange1d > 0 &&
    rsChange5d != null && rsChange5d > 0 &&
    rsChange20d != null && rsChange20d > 0;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-[11px] font-serif font-semibold text-primary">
        Magic RS vs {benchmarkLabel}
      </span>
      <div
        className={`flex items-center gap-3 px-2 py-0.5 rounded-md transition-all ${
          allGreen
            ? 'bg-risk-green/10 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
            : ''
        }`}
      >
        <Pill label="1D" delta={rsChange1d} currentRs={currentRs} />
        <Pill label="1W" delta={rsChange5d} currentRs={currentRs} />
        <Pill label="1M" delta={rsChange20d} currentRs={currentRs} />
      </div>
    </div>
  );
}
