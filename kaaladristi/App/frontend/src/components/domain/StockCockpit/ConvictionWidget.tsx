/**
 * ConvictionWidget — the "Widget" face of the Conviction SignalFlipCard.
 * Score 5D vs 22D (money-flow conviction) + Accelerating/Fading + delivery
 * surge, from the latest row. Same numbers the header StatStrip used to show,
 * now consolidated here so Conviction isn't rendered twice.
 */

import { cn } from '@/lib/utils';

interface ConvictionWidgetProps {
  score5d: number | null;
  score22d: number | null;
  delivSurge?: number | null;
}

function scoreTone(v: number | null): string {
  return v == null || v <= 0 ? 'text-muted' : v >= 25 ? 'text-risk-green' : 'text-[var(--gold,#d4a84b)]';
}

export default function ConvictionWidget({ score5d, score22d, delivSurge }: ConvictionWidgetProps) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className={cn('text-2xl font-mono font-bold', scoreTone(score5d))}>
          {score5d != null ? Math.round(score5d) : '—'}
        </span>
        <span className="text-[10px] text-muted">Score 5D</span>
        {score5d != null && score22d != null && (
          <span className={cn('ml-auto text-[9px] font-mono font-bold px-1.5 py-0.5 rounded',
            score5d >= score22d ? 'text-risk-green bg-risk-green/10' : 'text-risk-amber bg-risk-amber/10')}>
            {score5d >= score22d ? 'Accelerating' : 'Fading'}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between text-[10px] font-mono mb-1">
        <span className="text-muted">Score 22D</span>
        <span className={scoreTone(score22d)}>{score22d != null ? Math.round(score22d) : '—'}</span>
      </div>
      <div className="flex items-center justify-between text-[10px] font-mono">
        <span className="text-muted">Delivery Surge</span>
        <span className={delivSurge != null && delivSurge >= 1.2 ? 'text-risk-green' : 'text-[var(--text-secondary)]'}>
          {delivSurge != null ? `${delivSurge.toFixed(2)}×` : '—'}
        </span>
      </div>
    </div>
  );
}
