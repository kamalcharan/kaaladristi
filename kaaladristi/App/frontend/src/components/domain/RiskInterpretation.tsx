import { MessageCircle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getRegimeIntel } from '@/lib/regimeIntel';
import { Badge } from '@/components/ui/Badge';

interface RiskInterpretationProps {
  regime: string;
  riskScore: number;
  explanation: string;
  planetarySummary: string;
  onAskAI?: () => void;
}

function getRegimeVariant(regime: string) {
  switch (regime) {
    case 'Capital Protection': return 'red' as const;
    case 'Distribution':       return 'amber' as const;
    case 'Expansion':          return 'cyan' as const;
    case 'Accumulation':       return 'green' as const;
    default:                   return 'default' as const;
  }
}

export default function RiskInterpretation({ regime, riskScore, explanation, planetarySummary, onAskAI }: RiskInterpretationProps) {
  const intel = getRegimeIntel(regime);

  return (
    <div className="flex-1 space-y-4 relative z-10">
      {/* Row 1: Regime badge + Posture label */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant={getRegimeVariant(regime)} size="md">
          {regime} Regime Active
        </Badge>
        <span className={cn('text-sm font-bold', intel.postureColor)}>
          Posture: {intel.posture}
        </span>
      </div>

      {/* Row 2: Plain-English explanation — the core "what does this mean" */}
      <p className="text-[15px] text-slate-300 leading-relaxed">
        {explanation}
      </p>

      {/* Row 3: Actionable guidance cards — the "what should I do" */}
      <div className="grid grid-cols-2 gap-2">
        <div className="px-3 py-2.5 rounded-xl bg-white/[0.03] border border-kd-border">
          <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Position Sizing</p>
          <p className={cn('text-xs font-semibold', intel.postureColor)}>
            {intel.deploymentIntensity}
          </p>
        </div>
        <div className="px-3 py-2.5 rounded-xl bg-white/[0.03] border border-kd-border">
          <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Regime Duration</p>
          <p className="text-xs font-semibold text-slate-300">
            {intel.persistence}
          </p>
        </div>
      </div>

      {/* Row 4: Planetary context + Ask AI */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-muted bg-black/20 px-3 py-2 rounded-xl border border-kd-border">
          <div className="w-1.5 h-1.5 rounded-full bg-accent-indigo shrink-0" />
          <span className="font-medium">{planetarySummary}</span>
        </div>

        {onAskAI && (
          <button
            onClick={onAskAI}
            className="flex items-center gap-2 text-xs font-bold text-accent-indigo hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/15 px-3.5 py-2 rounded-xl border border-indigo-500/20 hover:border-indigo-500/30 transition-all group"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Ask AI
            <ArrowRight className="w-3 h-3 opacity-0 -ml-1 group-hover:opacity-100 group-hover:ml-0 transition-all" />
          </button>
        )}
      </div>
    </div>
  );
}
