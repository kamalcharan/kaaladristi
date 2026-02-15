/**
 * RecommendationPanel — Displays the astro-risk regime as an actionable signal.
 *
 * Maps the risk score + regime + signals into a LuckyPop-style recommendation
 * display (BUY / SELL / HOLD / AVOID / etc.) based on the astro risk engine.
 *
 * Technical indicators (RVOL, TVOL, RSI, MFI, IB30, Order Flow) will be
 * incorporated once their backend data sources are connected.
 */

import { cn } from '@/lib/utils';
import { RiskGauge } from '@/components/domain';
import type { SnapshotSignals } from '@/types';

interface RecommendationPanelProps {
  riskScore: number;
  regime: string;
  signals: SnapshotSignals | null;
  explanation: string;
}

interface SignalConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

function getSignalFromRegime(regime: string, riskScore: number): SignalConfig {
  if (riskScore >= 80) return {
    label: 'AVOID',
    color: 'text-risk-red',
    bgColor: 'bg-risk-red/10',
    borderColor: 'border-risk-red/30',
  };
  if (regime === 'Capital Protection') return {
    label: 'CAUTION',
    color: 'text-risk-red',
    bgColor: 'bg-risk-red/10',
    borderColor: 'border-risk-red/30',
  };
  if (regime === 'Distribution') return {
    label: 'BOOK FAST',
    color: 'text-risk-amber',
    bgColor: 'bg-risk-amber/10',
    borderColor: 'border-risk-amber/30',
  };
  if (regime === 'Expansion') return {
    label: 'BUY',
    color: 'text-risk-green',
    bgColor: 'bg-risk-green/10',
    borderColor: 'border-risk-green/30',
  };
  // Accumulation
  return {
    label: 'ACCUMULATE',
    color: 'text-accent-cyan',
    bgColor: 'bg-accent-cyan/10',
    borderColor: 'border-accent-cyan/30',
  };
}

function getBiasFromRegime(regime: string): { label: string; color: string } {
  switch (regime) {
    case 'Capital Protection': return { label: 'DEFENSIVE', color: 'text-risk-red' };
    case 'Distribution':       return { label: 'CAUTIOUS',  color: 'text-risk-amber' };
    case 'Expansion':          return { label: 'BULLISH',   color: 'text-risk-green' };
    case 'Accumulation':       return { label: 'NEUTRAL',   color: 'text-accent-cyan' };
    default:                   return { label: 'SCANNING',  color: 'text-slate-400' };
  }
}

export default function RecommendationPanel({ riskScore, regime, signals, explanation }: RecommendationPanelProps) {
  const signal = getSignalFromRegime(regime, riskScore);
  const bias = getBiasFromRegime(regime);

  return (
    <div className="glass-card rounded-3xl p-6 space-y-5">
      {/* Signal + Gauge */}
      <div className="flex items-center gap-5">
        <RiskGauge score={riskScore} size="summary" />
        <div className="flex-1 min-w-0">
          {/* Main signal */}
          <div className={cn(
            'inline-flex items-center px-4 py-2 rounded-xl border text-lg font-bold tracking-wide',
            signal.bgColor, signal.borderColor, signal.color,
          )}>
            {signal.label}
          </div>
          {/* Bias */}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Bias</span>
            <span className={cn('text-xs font-bold', bias.color)}>{bias.label}</span>
          </div>
        </div>
      </div>

      {/* Regime info */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Cycle Intelligence</p>
        <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{explanation}</p>
      </div>

      {/* Signal stats from backend */}
      {signals && (
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-kd-border">
          <div className="text-center">
            <p className="text-lg font-bold mono text-white">{signals.net_score}</p>
            <p className="text-[9px] text-muted font-bold uppercase">Net Score</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold mono text-white">{signals.fired_count}</p>
            <p className="text-[9px] text-muted font-bold uppercase">Fired</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold mono text-white">{signals.total_rules}</p>
            <p className="text-[9px] text-muted font-bold uppercase">Total Rules</p>
          </div>
        </div>
      )}

      {/* Awaiting tech data notice */}
      <div className="px-3 py-2 rounded-lg bg-slate-900/40 border border-dashed border-white/10">
        <p className="text-[10px] text-slate-500 text-center">
          Technical confluence (RSI, MFI, RVOL, IB30) will enhance this signal
        </p>
      </div>
    </div>
  );
}
