import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAstroWeek } from '@/hooks';
import { from } from '@/services/postgrest';
import { signalColor, signalLabel, addDays, daysBetween } from '@/lib/astroSignalUtils';
import type { AstroSignal } from '@/types';

// ── CSS keyframes injected once ───────────────────────────────────────────────

const STYLES = `
@keyframes pulse-ring {
  0%   { transform: translate(-50%,-50%) scale(1);   opacity: 0.7; }
  100% { transform: translate(-50%,-50%) scale(1.9); opacity: 0; }
}
@keyframes flicker {
  0%,100% { opacity: 1; }
  50%      { opacity: 0.4; }
}
.astro-pulse-ring {
  animation: pulse-ring 1.8s ease-out infinite;
}
.astro-flicker {
  display: inline-block;
  animation: flicker 1.4s ease-in-out infinite;
}
`;

// ── Types ──────────────────────────────────────────────────────────────────────

interface TransitEvent {
  display_name: string;
  start_date: string;
  end_date: string | null;
  market_impact: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function utcDate(d: string) {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

function dayName(d: string) {
  return utcDate(d).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

function dayDateLabel(d: string) {
  return utcDate(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function isWeekend(d: string) {
  const dow = utcDate(d).getUTCDay();
  return dow === 0 || dow === 6;
}

function fmtShort(d: string) {
  return utcDate(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** Glow color based on market_impact category — overrides signalColor for bars */
function transitGlow(impact: string): { color: string; shadow: string } {
  if (['strong_bullish', 'bullish', 'mild_bullish'].includes(impact))
    return { color: 'var(--bull)', shadow: '0 0 6px var(--bull)' };
  if (['strong_bearish', 'bearish', 'mild_bearish'].includes(impact))
    return { color: 'var(--bear)', shadow: '0 0 6px var(--bear)' };
  return { color: 'var(--caution)', shadow: '0 0 6px var(--caution)' };
}

// ── Transit bar ───────────────────────────────────────────────────────────────

const DOT = 12;
const ROW_H = 36; // px per bar row (label above + bar + dots)

function TransitBar({ event, today, showRightPulse }: {
  event: TransitEvent; today: string; showRightPulse: boolean;
}) {
  const glow = transitGlow(event.market_impact);

  const startOffset = daysBetween(today, event.start_date);
  const endOffset   = event.end_date ? daysBetween(today, event.end_date) : 6;

  const gridStart = Math.max(0, startOffset);
  const gridEnd   = Math.min(6, endOffset);

  const leftPct  = (gridStart / 7) * 100;
  const rightPct = ((gridEnd + 1) / 7) * 100;
  const widthPct = rightPct - leftPct;

  const label = `${event.display_name} — ${fmtShort(event.start_date)} → ${event.end_date ? fmtShort(event.end_date) : '…'}`;

  return (
    <div className="relative w-full" style={{ height: `${ROW_H}px` }}>
      {/* Label — sits above bar */}
      <span
        className="absolute truncate select-none pointer-events-none"
        style={{
          left: `calc(${leftPct}% + ${DOT / 2}px)`,
          width: `calc(${widthPct}% - ${DOT}px)`,
          top: 0,
          textAlign: 'center',
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: glow.color,
          lineHeight: '14px',
        }}
      >
        {label}
      </span>

      {/* Bar — sits in lower half */}
      <div
        className="absolute"
        style={{
          left: `${leftPct}%`,
          width: `${widthPct}%`,
          bottom: `${DOT / 2 - 1.5}px`,
          height: '3px',
          backgroundColor: glow.color,
          boxShadow: glow.shadow,
          borderRadius: '2px',
        }}
      />

      {/* Left dot */}
      <div
        className="absolute"
        style={{
          left: `${leftPct}%`,
          bottom: 0,
          width: `${DOT}px`,
          height: `${DOT}px`,
          borderRadius: '50%',
          backgroundColor: glow.color,
          transform: 'translateX(-50%)',
          zIndex: 2,
        }}
      />

      {/* Right dot */}
      <div
        className="absolute"
        style={{
          left: `${rightPct}%`,
          bottom: 0,
          width: `${DOT}px`,
          height: `${DOT}px`,
          borderRadius: '50%',
          backgroundColor: glow.color,
          transform: 'translateX(-50%)',
          zIndex: 2,
        }}
      />

      {/* Pulsing ring on right dot — only if transit end is in the future */}
      {showRightPulse && (
        <div
          className="absolute astro-pulse-ring"
          style={{
            left: `${rightPct}%`,
            bottom: `${DOT / 2}px`,
            width: `${DOT}px`,
            height: `${DOT}px`,
            borderRadius: '50%',
            border: `2px solid ${glow.color}`,
            zIndex: 1,
          }}
        />
      )}
    </div>
  );
}

// ── Day card ──────────────────────────────────────────────────────────────────

function DayCard({ signal, isToday }: { signal: AstroSignal; isToday: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const color = signalColor(signal.net_signal);
  const score = signal.net_score > 0 ? `+${signal.net_score}` : `${signal.net_score}`;

  const topBorder  = `2px solid ${color.bg}`;
  const glowShadow = isToday ? `0 0 12px ${color.bg}4d` : undefined; // 4d = 30% alpha

  return (
    <button
      onClick={() => setExpanded(v => !v)}
      className="flex flex-col items-center text-center flex-1 min-w-0 transition-all"
      style={{
        borderRadius: '12px',
        borderTop: topBorder,
        border: isToday ? `2px solid ${color.bg}` : `1px solid color-mix(in srgb, var(--text-primary) 7%, transparent)`,
        borderTopWidth: '2px',
        borderTopColor: color.bg,
        boxShadow: glowShadow,
        padding: '10px 8px 12px',
        backgroundColor: isToday ? 'rgba(99,102,241,0.05)' : 'transparent',
      }}
    >
      <span
        style={{
          fontSize: '10px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: isToday ? 'var(--accent-indigo, #6366f1)' : 'var(--text-muted, #6b7280)',
          lineHeight: 1.2,
        }}
      >
        {dayName(signal.trade_date)}
      </span>

      <span
        style={{
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--text-secondary, #9ca3af)',
          lineHeight: 1.3,
          marginBottom: '8px',
        }}
      >
        {dayDateLabel(signal.trade_date)}
      </span>

      <span
        style={{
          display: 'block',
          width: '100%',
          padding: '3px 6px',
          borderRadius: '6px',
          fontSize: '10px',
          fontWeight: 700,
          textAlign: 'center',
          backgroundColor: color.bg,
          color: color.text,
          lineHeight: 1.4,
        }}
      >
        {signal.turning_date
          ? <><span className="astro-flicker">⚡</span> {signalLabel(signal.net_signal)}</>
          : signalLabel(signal.net_signal)
        }
      </span>

      <span
        style={{
          fontSize: '20px',
          fontWeight: 700,
          color: 'var(--text-secondary, #9ca3af)',
          marginTop: '6px',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}
      >
        {score}
      </span>

      {expanded && (
        <div
          style={{
            marginTop: '8px',
            paddingTop: '8px',
            borderTop: '1px solid color-mix(in srgb, var(--text-primary) 7%, transparent)',
            width: '100%',
            textAlign: 'left',
          }}
        >
          {signal.primary_event && (
            <p style={{ fontSize: '9px', color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: '2px' }}>
              {signal.primary_event}
            </p>
          )}
          {signal.secondary_event && (
            <p style={{ fontSize: '9px', color: 'var(--text-muted, #6b7280)', lineHeight: 1.4, marginBottom: '2px' }}>
              {signal.secondary_event}
            </p>
          )}
          <p style={{ fontSize: '8px', color: 'var(--text-muted, #6b7280)', marginTop: '2px' }}>
            {signal.active_event_count} event{signal.active_event_count !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </button>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function AstroSignalWeekPanel({ date }: { date: string }) {
  const weekEnd = addDays(date, 7);

  const { data: allSignals = [], isLoading, isError } = useAstroWeek(date);
  const signals = allSignals.filter(s => !isWeekend(s.trade_date));

  const { data: transits = [] } = useQuery({
    queryKey: ['astro_transits_db', date],
    queryFn: async (): Promise<TransitEvent[]> => {
      const { data, error } = await from('km_astro_calendar')
        .select('display_name,start_date,end_date,market_impact')
        .lte('start_date', weekEnd)
        .order('start_date', { ascending: true })
        .execute();
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as TransitEvent[];
      const today = date;
      return rows.filter(r => {
        if (!r.end_date || r.end_date === r.start_date) return false;
        return r.end_date >= today;
      });
    },
    staleTime: 24 * 60 * 60 * 1000,
    enabled: !!date,
  });

  return (
    <>
      {/* Inject keyframes once */}
      <style>{STYLES}</style>

      <div
        style={{
          backgroundColor: 'var(--bg)',
          border: '1px solid color-mix(in srgb, var(--text-primary) 6%, transparent)',
          borderRadius: '16px',
          backgroundImage: [
            'linear-gradient(color-mix(in srgb, var(--text-primary) 3%, transparent) 1px, transparent 1px)',
            'linear-gradient(90deg, color-mix(in srgb, var(--text-primary) 3%, transparent) 1px, transparent 1px)',
          ].join(','),
          backgroundSize: '20px 20px',
          overflow: 'hidden',
        }}
      >
        {/* Title */}
        <div style={{ padding: '16px 20px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>🔭</span>
          <h3 style={{
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '0.03em',
            color: 'var(--text-primary, #f3f4f6)',
            margin: 0,
          }}>
            Astro Signal — Week Ahead
          </h3>
        </div>

        {/* Layer 1 — Transit bars */}
        {transits.length > 0 && (
          <div style={{ padding: '16px 20px 0', display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {transits.map((t, i) => (
              <TransitBar
                key={i}
                event={t}
                today={date}
                showRightPulse={!!t.end_date && t.end_date > date}
              />
            ))}
          </div>
        )}

        {/* Layer 2 — Weekday signal cards */}
        <div style={{ padding: transits.length > 0 ? '24px 20px 20px' : '16px 20px 20px' }}>
          {isLoading ? (
            <div style={{ display: 'flex', gap: '12px' }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ flex: 1, height: '96px', borderRadius: '12px', backgroundColor: 'color-mix(in srgb, var(--text-primary) 4%, transparent)' }} />
              ))}
            </div>
          ) : isError ? (
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
              Astro data unavailable
            </p>
          ) : (
            <div style={{ display: 'flex', gap: '12px' }}>
              {signals.map(signal => (
                <DayCard
                  key={signal.trade_date}
                  signal={signal}
                  isToday={signal.trade_date === date}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
