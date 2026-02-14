import { motion } from 'framer-motion';
import { cn, getRiskColor, getRiskHex } from '@/lib/utils';

interface RiskGaugeProps {
  score: number;
  size?: 'hero' | 'summary' | 'mini' | 'tiny';
  label?: string;
  animated?: boolean;
  className?: string;
}

const sizeConfig = {
  hero:    { px: 220, stroke: 8,  r: 42, fontSize: 'text-6xl',  labelSize: 'text-[10px]' },
  summary: { px: 120, stroke: 7,  r: 42, fontSize: 'text-3xl',  labelSize: 'text-[9px]' },
  mini:    { px: 80,  stroke: 6,  r: 42, fontSize: 'text-xl',   labelSize: 'text-[8px]' },
  tiny:    { px: 56,  stroke: 6,  r: 22, fontSize: 'text-base', labelSize: 'text-[7px]' },
};

export default function RiskGauge({
  score,
  size = 'hero',
  label = 'Stress idx',
  animated = true,
  className,
}: RiskGaugeProps) {
  const cfg = sizeConfig[size];
  const viewBox = size === 'tiny' ? '0 0 56 56' : '0 0 100 100';
  const cx = size === 'tiny' ? 28 : 50;
  const cy = size === 'tiny' ? 28 : 50;
  const circumference = 2 * Math.PI * cfg.r;
  const offset = circumference - (score / 100) * circumference;
  const color = getRiskHex(score);

  return (
    <div className={cn('relative shrink-0', className)} style={{ width: cfg.px, height: cfg.px }}>
      <svg
        className="w-full h-full -rotate-90"
        viewBox={viewBox}
        style={{ transform: `rotate(-90deg) ${size === 'hero' ? 'scale(1.1)' : ''}` }}
      >
        {/* Track */}
        <circle
          cx={cx} cy={cy} r={cfg.r}
          className="fill-none stroke-white/5"
          strokeWidth={cfg.stroke}
        />
        {/* Fill */}
        {animated ? (
          <motion.circle
            cx={cx} cy={cy} r={cfg.r}
            className="fill-none"
            strokeWidth={cfg.stroke}
            strokeLinecap="round"
            stroke={color}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        ) : (
          <circle
            cx={cx} cy={cy} r={cfg.r}
            className="fill-none transition-all duration-1000 ease-out"
            strokeWidth={cfg.stroke}
            strokeLinecap="round"
            stroke={color}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        )}
      </svg>

      {/* Center value */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('font-bold font-mono tracking-tighter', cfg.fontSize, getRiskColor(score))}>
          {score}
        </span>
        {size !== 'tiny' && (
          <span className={cn('font-bold text-muted uppercase tracking-[0.3em] mt-0.5', cfg.labelSize)}>
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
