import { useState } from 'react';
import { useAstroSignal } from '@/hooks';
import { signalColor, signalLabel, formatScore } from '@/lib/astroSignalUtils';
import type { AstroSignal } from '@/types';

function BullBearBar({ s }: { s: AstroSignal }) {
  const bull = s.strong_bullish_count + s.bullish_count + s.minor_bullish_count;
  const bear = s.minor_bearish_count + s.bearish_count + s.strong_bearish_count;
  const total = bull + bear + s.neutral_count;
  const bullPct = total > 0 ? (bull / total) * 100 : 50;
  const neutPct = total > 0 ? (s.neutral_count / total) * 100 : 0;
  const bearPct = 100 - bullPct - neutPct;
  return (
    <div className="flex items-center gap-1.5 w-full">
      <span className="text-[9px] font-mono" style={{ color: '#1a8a4a' }}>{bull}↑</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden flex bg-kd-elevated">
        <div style={{ width: `${bullPct}%`, backgroundColor: '#1a8a4a' }} />
        <div style={{ width: `${neutPct}%`, backgroundColor: '#6c757d' }} />
        <div style={{ width: `${bearPct}%`, backgroundColor: '#c0392b' }} />
      </div>
      <span className="text-[9px] font-mono" style={{ color: '#c0392b' }}>{bear}↓</span>
    </div>
  );
}

export default function AstroSignalBadge({ date }: { date: string }) {
  const { data: signal, isLoading, isError } = useAstroSignal(date);
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return <div className="h-7 w-44 rounded-full bg-kd-elevated animate-pulse" />;
  }

  if (isError || !signal) {
    return (
      <span className="text-[11px] text-muted px-2.5 py-1 rounded-full border border-kd-border">
        Astro data unavailable
      </span>
    );
  }

  const color    = signalColor(signal.net_signal);
  const label    = signalLabel(signal.net_signal);
  const score    = formatScore(Number(signal.net_score));
  const event    = signal.primary_event
    ? signal.primary_event.length > 30 ? signal.primary_event.slice(0, 30) + '…' : signal.primary_event
    : null;

  return (
    <button
      onClick={() => setExpanded(e => !e)}
      className="flex flex-col gap-1.5 text-left"
      aria-expanded={expanded}
    >
      {/* Collapsed row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0"
          style={{ backgroundColor: color.bg, color: color.text }}
        >
          {signal.turning_date && '⚡ '}{label}
        </span>
        <span className="text-[11px] font-mono font-semibold text-[var(--text-secondary)]">
          {score}
        </span>
        {event && (
          <span className="text-[11px] text-muted max-w-[160px] truncate">{event}</span>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="flex flex-col gap-1.5 pl-0.5 pt-1.5 border-t border-kd-border w-full">
          {signal.secondary_event && (
            <p className="text-[10px] text-muted">Also: {signal.secondary_event}</p>
          )}
          <p className="text-[10px] text-muted">
            {signal.active_event_count} active event{signal.active_event_count !== 1 ? 's' : ''}
          </p>
          <BullBearBar s={signal} />
        </div>
      )}
    </button>
  );
}
