import { cn } from '@/lib/utils';
import { getRegimeIntel } from '@/lib/regimeIntel';

interface PostureHeroProps {
  riskScore: number;
  regime: string;
}

export default function PostureHero({ riskScore, regime }: PostureHeroProps) {
  const intel = getRegimeIntel(regime);

  return (
    <div className="space-y-6">
      {/* Posture — THE thing they see first */}
      <div className="flex items-baseline gap-5">
        <h2 className={cn('text-5xl lg:text-6xl font-bold tracking-tight', intel.postureColor)}>
          {intel.posture}
        </h2>
        <span className={cn(
          'text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full border',
          intel.postureBg, intel.postureColor, `border-current/20`
        )}>
          {regime}
        </span>
      </div>

      {/* Risk score — secondary, not hero */}
      <div className="flex items-center gap-6">
        <div className="flex items-baseline gap-2">
          <span className={cn('text-3xl font-bold font-mono tracking-tighter', intel.postureColor)}>
            {riskScore}
          </span>
          <span className="text-xs text-muted font-mono">/100</span>
        </div>

        {/* Minimal horizontal bar — no circular gauge */}
        <div className="flex-1 max-w-xs">
          <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-kd-border">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${riskScore}%`,
                background: `var(${riskScore > 70 ? '--risk-red' : riskScore > 40 ? '--risk-amber' : '--risk-green'})`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Briefing — risk desk tone */}
      <p className="text-base text-slate-400 leading-relaxed max-w-2xl">
        {intel.briefing}
      </p>
    </div>
  );
}
