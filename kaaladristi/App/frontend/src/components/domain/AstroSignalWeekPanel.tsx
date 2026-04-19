import { useAstroWeek, useAstroTransits } from '@/hooks';
import { signalColor, signalLabel, addDays, daysBetween } from '@/lib/astroSignalUtils';
import type { AstroSignal, AstroTransit } from '@/types';

function dayName(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

function dayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function TransitBar({ transit, weekStart }: { transit: AstroTransit; weekStart: string }) {
  const weekEnd = addDays(weekStart, 6);
  const color = signalColor(transit.market_impact);

  const startOffset = daysBetween(weekStart, transit.start_date);
  const endOffset   = transit.end_date ? daysBetween(weekStart, transit.end_date) : 6;

  const clampedStart = Math.max(0, startOffset);
  const clampedEnd   = Math.min(6, endOffset);
  const leftPct  = (clampedStart / 7) * 100;
  const widthPct = ((clampedEnd - clampedStart + 1) / 7) * 100;

  const showLeftDot  = startOffset >= 0 && startOffset <= 6;
  const showRightDot = !!transit.end_date && endOffset >= 0 && endOffset <= 6;

  return (
    <div
      className="relative h-5 w-full"
      title={transit.inference ? `${transit.display_name}: ${transit.inference}` : transit.display_name}
    >
      {/* bar track */}
      <div
        className="absolute top-1/2 h-[7px] rounded-full"
        style={{
          left: `${leftPct}%`,
          width: `${widthPct}%`,
          backgroundColor: color.bg,
          opacity: 0.72,
          transform: 'translateY(-50%)',
        }}
      />

      {/* label inside bar */}
      <span
        className="absolute top-1/2 text-[8px] font-semibold truncate pointer-events-none select-none"
        style={{
          left: `calc(${leftPct}% + 6px)`,
          maxWidth: `calc(${widthPct}% - 12px)`,
          transform: 'translateY(-50%)',
          color: color.text,
        }}
      >
        {transit.display_name}
      </span>

      {/* start dot */}
      {showLeftDot && (
        <div
          className="absolute w-2.5 h-2.5 rounded-full z-10"
          style={{
            left: `${leftPct}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: color.bg,
            boxShadow: `0 0 0 1.5px var(--bg-primary, #0c0e14)`,
          }}
        />
      )}

      {/* end dot */}
      {showRightDot && (
        <div
          className="absolute w-2.5 h-2.5 rounded-full z-10"
          style={{
            left: `${leftPct + widthPct}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: color.bg,
            boxShadow: `0 0 0 1.5px var(--bg-primary, #0c0e14)`,
          }}
        />
      )}
    </div>
  );
}

function DayCard({ signal, isToday }: { signal: AstroSignal; isToday: boolean }) {
  const color = signalColor(signal.net_signal);
  const score = signal.net_score > 0 ? `+${signal.net_score}` : `${signal.net_score}`;

  return (
    <div
      className={[
        'flex flex-col items-center gap-0.5 px-1 py-2 rounded-lg flex-1 text-center min-w-[52px]',
        isToday
          ? 'border-2 border-accent-indigo/60 bg-accent-indigo/5'
          : 'border border-kd-border',
      ].join(' ')}
    >
      <span className={['text-[10px] font-bold uppercase tracking-widest leading-tight', isToday ? 'text-accent-indigo' : 'text-muted'].join(' ')}>
        {dayName(signal.trade_date)}
      </span>
      <span className="text-[9px] text-muted leading-tight">{dayDate(signal.trade_date)}</span>
      <span
        className="mt-0.5 px-1 py-0.5 rounded text-[9px] font-bold w-full text-center leading-tight"
        style={{ backgroundColor: color.bg, color: color.text }}
      >
        {signal.turning_date ? '↕' : signalLabel(signal.net_signal)}
      </span>
      <span className="text-[10px] font-mono font-semibold text-[var(--text-secondary)]">{score}</span>
    </div>
  );
}

export default function AstroSignalWeekPanel({ date }: { date: string }) {
  const weekEnd = addDays(date, 6);

  const { data: signals = [], isLoading, isError } = useAstroWeek(date);
  const { data: transits = [] } = useAstroTransits(date, weekEnd);

  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">🔭</span>
        <h3 className="text-[13px] font-bold text-[var(--text-primary)]">Astro Signal — Week Ahead</h3>
      </div>

      {/* Transit bars */}
      {transits.length > 0 && (
        <div className="flex flex-col gap-0.5 mb-2 px-0.5">
          {transits.map(t => (
            <TransitBar key={t.id} transit={t} weekStart={date} />
          ))}
        </div>
      )}

      {/* Day cards */}
      {isLoading ? (
        <div className="flex gap-1.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex-1 h-20 bg-kd-elevated rounded-lg animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-[11px] text-muted text-center py-4">Astro data unavailable</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex gap-1.5 min-w-max sm:min-w-0">
            {signals.map(signal => (
              <DayCard
                key={signal.trade_date}
                signal={signal}
                isToday={signal.trade_date === date}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
