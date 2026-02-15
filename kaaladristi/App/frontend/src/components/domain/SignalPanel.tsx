import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { SnapshotSignals, SnapshotFiredRule } from '@/types';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui';

interface SignalPanelProps {
  signals: SnapshotSignals;
}

function SignalMeter({ score, classification }: { score: number; classification: string }) {
  // score ranges from about -5 to +5; normalize to 0-100 for the bar
  const pct = Math.max(0, Math.min(100, ((score + 5) / 10) * 100));
  const isBullish = score > 0;
  const isBearish = score < 0;

  const label = classification.replace(/_/g, ' ');
  const labelClass = isBullish ? 'text-risk-green' : isBearish ? 'text-risk-red' : 'text-slate-400';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted">Daily Signal</h4>
        <div className="flex items-center gap-1.5">
          {isBullish ? <TrendingUp className="w-3.5 h-3.5 text-risk-green" />
            : isBearish ? <TrendingDown className="w-3.5 h-3.5 text-risk-red" />
            : <Minus className="w-3.5 h-3.5 text-slate-400" />}
          <span className={cn('text-xs font-bold font-mono capitalize', labelClass)}>
            {label}
          </span>
        </div>
      </div>

      {/* Meter bar */}
      <div className="relative">
        <div className="h-2 bg-white/5 rounded-full border border-kd-border overflow-hidden">
          <div
            className="absolute top-0 left-0 h-full rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: isBullish ? 'var(--risk-green)' : isBearish ? 'var(--risk-red)' : 'var(--text-muted)',
            }}
          />
        </div>
        {/* Center mark */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-4 bg-white/20 rounded-full" />

        <div className="flex justify-between mt-2">
          <span className="text-[9px] font-mono text-muted">-5 Bearish</span>
          <span className={cn('text-xs font-bold font-mono', labelClass)}>
            {score > 0 ? '+' : ''}{score.toFixed(1)}
          </span>
          <span className="text-[9px] font-mono text-muted">+5 Bullish</span>
        </div>
      </div>
    </div>
  );
}

function RuleItem({ rule }: { rule: SnapshotFiredRule }) {
  const isBullish = rule.signal === 'bullish';
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5 transition-colors">
      <div className="flex items-center gap-2">
        {isBullish
          ? <TrendingUp className="w-3 h-3 text-risk-green" />
          : <TrendingDown className="w-3 h-3 text-risk-red" />
        }
        <span className="text-xs text-slate-300">{rule.name}</span>
      </div>
      <span className={cn(
        'text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border',
        isBullish
          ? 'text-risk-green bg-risk-green/10 border-risk-green/20'
          : 'text-risk-red bg-risk-red/10 border-risk-red/20'
      )}>
        {rule.strength}
      </span>
    </div>
  );
}

export default function SignalPanel({ signals }: SignalPanelProps) {
  return (
    <Card rounded="xl" className="p-6 space-y-6">
      <SignalMeter score={signals.net_score} classification={signals.classification} />

      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted">Rules Fired</h4>
          <span className="text-[10px] font-mono text-muted">
            {signals.fired_count} of {signals.total_rules}
          </span>
        </div>

        {signals.rules.length > 0 ? (
          <div className="space-y-1 max-h-48 overflow-y-auto no-scrollbar">
            {signals.rules.map((rule) => (
              <RuleItem key={rule.code} rule={rule} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted text-center py-4">No rules fired today</p>
        )}
      </div>
    </Card>
  );
}
