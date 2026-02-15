import { cn, getRiskHex } from '@/lib/utils';
import { useAppStore } from '@/stores/appStore';
import type { WeekDay } from '@/types';

interface CalendarStripProps {
  weekData: WeekDay[];
}

export default function CalendarStrip({ weekData }: CalendarStripProps) {
  const { selectedDate, setDate } = useAppStore();

  if (weekData.length === 0) return null;

  return (
    <div className="flex gap-2">
      {weekData.map((day) => {
        const isToday = day.date === selectedDate;
        const riskHex = getRiskHex(day.riskScore);

        return (
          <button
            key={day.date}
            onClick={() => setDate(day.date)}
            className={cn(
              'flex-1 text-center py-3 px-2 rounded-xl border transition-all duration-200 cursor-pointer',
              isToday
                ? 'border-accent-indigo bg-indigo-500/10'
                : 'border-transparent bg-white/[0.03] hover:border-white/10 hover:bg-white/[0.05]'
            )}
          >
            <div className="text-[10px] font-medium text-muted mb-1">{day.dayName}</div>
            <div className={cn(
              'text-sm font-bold mb-2',
              isToday ? 'text-white' : 'text-slate-300'
            )}>
              {day.date.slice(8)}
            </div>
            <div
              className="w-2.5 h-2.5 rounded-full mx-auto"
              style={{
                background: riskHex,
                boxShadow: `0 0 8px ${riskHex}40`,
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
