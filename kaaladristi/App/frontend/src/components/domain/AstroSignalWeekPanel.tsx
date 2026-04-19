import { useState } from 'react';
import { useAstroWeek } from '@/hooks';
import { signalColor, signalLabel, formatScore } from '@/lib/astroSignalUtils';
import type { AstroSignal } from '@/types';

function dayName(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

function dayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function BullBearBar({ s }: { s: AstroSignal }) {
  const bull  = s.strong_bullish_count + s.bullish_count + s.minor_bullish_count;
  const bear  = s.minor_bearish_count + s.bearish_count + s.strong_bearish_count;
  const total = bull + bear + s.neutral_count;
  const bullPct = total > 0 ? (bull / total) * 100 : 50;
  const neutPct = total > 0 ? (s.neutral_count / total) * 100 : 0;
  const bearPct = 100 - bullPct - neutPct;
  return (
    <div className="w-full h-1 rounded-full overflow-hidden flex mt-0.5">
      <div style={{ width: `${bullPct}%`, backgroundColor: '#1a8a4a' }} />
      <div style={{ width: `${neutPct}%`, backgroundColor: '#6c757d' }} />
      <div style={{ width: `${bearPct}%`, backgroundColor: '#c0392b' }} />
    </div>
  );
}

function DayColumn({
  signal,
  isToday,
  isExpanded,
  onToggle,
}: {
  signal: AstroSignal;
  isToday: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const color = signalColor(signal.net_signal);
  const label = signalLabel(signal.net_signal);
  const score = formatScore(Number(signal.net_score));

  return (
    <button
      onClick={onToggle}
      className={[
        'flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl transition-colors text-center',
        'min-w-[80px] flex-1',
        isToday
          ? 'border-2 border-accent-indigo/60 bg-accent-indigo/5'
          : 'border border-kd-border hover:bg-kd-elevated/40',
      ].join(' ')}
    >
      <span className={[
        'text-[10px] font-bold uppercase tracking-widest',
        isToday ? 'text-accent-indigo' : 'text-muted',
      ].join(' ')}>
        {dayName(signal.trade_date)}
      </span>

      <span className="text-[10px] text-muted">
        {dayDate(signal.trade_date)}
      </span>

      <span
        className="px-1.5 py-0.5 rounded text-[9px] font-bold w-full text-center leading-tight"
        style={{ backgroundColor: color.bg, color: color.text }}
      >
        {signal.turning_date ? '⚡ ' : ''}{label}
      </span>

      <span className="text-[11px] font-mono font-semibold text-[var(--text-secondary)]">
        {score}
      </span>

      {isExpanded && (
        <div className="flex flex-col gap-1 w-full pt-2 border-t border-kd-border">
          {signal.primary_event && (
            <p className="text-[9px] text-[var(--text-primary)] leading-tight">
              {signal.primary_event}
            </p>
          )}
          {signal.secondary_event && (
            <p className="text-[9px] text-muted leading-tight">{signal.secondary_event}</p>
          )}
          <BullBearBar s={signal} />
          <span className="text-[9px] text-muted">
            {signal.active_event_count} event{signal.active_event_count !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </button>
  );
}

export default function AstroSignalWeekPanel({ date }: { date: string }) {
  const { data: signals = [], isLoading, isError } = useAstroWeek(date);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const toggle = (d: string) => setExpandedDate(prev => (prev === d ? null : d));

  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">🔭</span>
        <h3 className="text-[13px] font-bold text-[var(--text-primary)]">Astro Signal — Week Ahead</h3>
      </div>

      {isLoading ? (
        <div className="flex gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex-1 min-w-[80px] h-24 bg-kd-elevated rounded-xl animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-[11px] text-muted text-center py-4">Astro data unavailable</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex gap-2 min-w-max sm:min-w-0 sm:flex-wrap">
            {signals.map(signal => (
              <DayColumn
                key={signal.trade_date}
                signal={signal}
                isToday={signal.trade_date === date}
                isExpanded={expandedDate === signal.trade_date}
                onToggle={() => toggle(signal.trade_date)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
