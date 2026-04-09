import { cn, getRiskColor, getRiskHex } from '@/lib/utils';
import type { WeekDay } from '@/types';

function riskLabel(score: number): string {
  if (score >= 75) return 'High';
  if (score >= 45) return 'Med';
  return 'Low';
}

export default function SevenDayStrip({ weekData, selectedDate }: { weekData: WeekDay[]; selectedDate: string }) {
  if (weekData.length === 0) return null;

  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-bold text-[var(--text-primary)]">7-Day Outlook</h3>
        <span className="text-[10px] text-muted">Bird's Eye</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {weekData.map(day => {
          const isToday = day.date === selectedDate;
          const color = getRiskHex(day.riskScore);
          const barH = Math.round((day.riskScore / 100) * 32);

          return (
            <div
              key={day.date}
              className={cn(
                'flex flex-col items-center gap-1 px-1 py-2 rounded-xl border transition-all',
                isToday
                  ? 'border-accent-indigo bg-accent-indigo/10'
                  : 'border-kd-border bg-kd-elevated/30 hover:border-kd-border-active',
              )}
            >
              {/* Day name */}
              <span className={cn('text-[9px] font-bold uppercase tracking-wider',
                isToday ? 'text-accent-indigo' : 'text-muted'
              )}>
                {day.dayName}
              </span>

              {/* Date */}
              <span className="text-[10px] text-[var(--text-secondary)] mono">
                {day.date.slice(8)}
              </span>

              {/* Risk bar */}
              <div className="w-4 h-8 flex items-end justify-center bg-kd-elevated/50 rounded overflow-hidden">
                <div
                  className="w-full rounded-sm transition-all duration-500"
                  style={{ height: `${barH}px`, background: color }}
                />
              </div>

              {/* Score */}
              <span className={cn('text-[11px] font-bold mono', getRiskColor(day.riskScore))}>
                {day.riskScore}
              </span>

              {/* Level */}
              <span className="text-[8px] text-muted uppercase tracking-wide">
                {riskLabel(day.riskScore)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
