import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { fetchMonthEvents } from '@/services/astroCalendar';
import type { AstroCalendarEvent } from '@/services/astroCalendar';

// ── Date helpers ──────────────────────────────────────────────────────────────

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function fmtShort(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${MONTH_ABBR[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`;
}

function fmtRange(start: string, end: string | null): string {
  if (!end || end === start) return fmtShort(start);
  return `${fmtShort(start)} → ${fmtShort(end)}`;
}

function durationDays(e: AstroCalendarEvent): number {
  if (!e.end_date || e.end_date === e.start_date) return 1;
  const ms = new Date(e.end_date).getTime() - new Date(e.start_date).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

// ── Impact label ──────────────────────────────────────────────────────────────

function impactLabel(impact: string): string {
  const map: Record<string, string> = {
    strong_bullish: 'STRONG POSITIVE',
    bullish:        'POSITIVE',
    mild_bullish:   'MILD POSITIVE',
    neutral:        'NEUTRAL',
    mild_bearish:   'MILD NEGATIVE',
    bearish:        'NEGATIVE',
    strong_bearish: 'STRONG NEGATIVE',
    turning:        'INFLECTION',
    minor_bullish:  'MILD POSITIVE',
    minor_bearish:  'MILD NEGATIVE',
  };
  return map[impact] ?? impact.replace(/_/g, ' ').toUpperCase();
}

function ImpactCell({ impact }: { impact: string }) {
  const label = impactLabel(impact);
  const isTurning = impact === 'turning';
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      letterSpacing: '0.12em',
      color: 'var(--text-faint)',
      whiteSpace: 'nowrap',
      flexShrink: 0,
    }}>
      {isTurning && <span style={{ marginRight: 4 }}>◈</span>}
      {label}
    </span>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

function EventRow({
  evt,
  showDate,
  isToday,
}: {
  evt: AstroCalendarEvent;
  showDate: boolean;
  isToday: boolean;
}) {
  const [open, setOpen] = useState(false);
  const hasNarrative = !!(evt.narrative || evt.inference);
  const text = evt.narrative ?? evt.inference ?? null;

  return (
    <div style={{
      borderBottom: '1px solid color-mix(in srgb, var(--text-primary) 4%, transparent)',
    }}>
      <div
        role={hasNarrative ? 'button' : undefined}
        tabIndex={hasNarrative ? 0 : undefined}
        onClick={hasNarrative ? () => setOpen(o => !o) : undefined}
        onKeyDown={hasNarrative ? e => (e.key === 'Enter' || e.key === ' ') && setOpen(o => !o) : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 14px',
          cursor: hasNarrative ? 'pointer' : 'default',
          background: isToday
            ? 'rgba(212,168,75,0.04)'
            : open
            ? 'color-mix(in srgb, var(--text-primary) 2%, transparent)'
            : 'transparent',
          transition: 'background 0.1s',
        }}
        onMouseEnter={e => {
          if (hasNarrative) (e.currentTarget as HTMLDivElement).style.background = 'color-mix(in srgb, var(--text-primary) 2%, transparent)';
        }}
        onMouseLeave={e => {
          if (!open) (e.currentTarget as HTMLDivElement).style.background = isToday ? 'rgba(212,168,75,0.04)' : 'transparent';
        }}
      >
        {/* Expand chevron */}
        <div style={{ width: 12, flexShrink: 0 }}>
          {hasNarrative && (
            open
              ? <ChevronDown style={{ width: 11, height: 11, color: 'var(--text-faint)' }} />
              : <ChevronRight style={{ width: 11, height: 11, color: 'var(--text-faint)', opacity: 0.5 }} />
          )}
        </div>

        {/* Date (for daily events) */}
        {showDate && (
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: isToday ? 'rgba(212,168,75,0.9)' : 'var(--text-faint)',
            width: 52,
            flexShrink: 0,
          }}>
            {fmtShort(evt.start_date)}
          </span>
        )}

        {/* Name */}
        <span style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          color: 'var(--text-primary)',
          flex: 1,
          lineHeight: 1.35,
        }}>
          {evt.display_name}
        </span>

        {/* Date range (for macro events) */}
        {!showDate && (
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-faint)',
            flexShrink: 0,
            width: 150,
            textAlign: 'right',
            paddingRight: 16,
          }}>
            {fmtRange(evt.start_date, evt.end_date)}
          </span>
        )}

        {/* Impact label */}
        <ImpactCell impact={evt.market_impact} />
      </div>

      {/* Expanded narrative */}
      {open && text && (
        <div style={{
          padding: '0 14px 12px 38px',
          fontFamily: 'var(--font-sans)',
          fontSize: 12,
          color: 'var(--text-secondary)',
          lineHeight: 1.7,
          borderLeft: '2px solid color-mix(in srgb, var(--text-primary) 7%, transparent)',
          marginLeft: 14,
          marginBottom: 4,
        }}>
          {text}
        </div>
      )}
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({
  label,
  events,
  showDate,
  today,
}: {
  label: string;
  events: AstroCalendarEvent[];
  showDate: boolean;
  today: string;
}) {
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid color-mix(in srgb, var(--text-primary) 6%, transparent)',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      {/* Section header */}
      <div style={{
        padding: '11px 14px 11px 38px',
        borderBottom: '1px solid color-mix(in srgb, var(--text-primary) 6%, transparent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'var(--text-faint)',
        }}>
          {label}
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--text-faint)',
          letterSpacing: '0.08em',
        }}>
          {events.length} event{events.length !== 1 ? 's' : ''}
        </span>
      </div>

      {events.length === 0 ? (
        <div style={{
          padding: '24px 14px',
          textAlign: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--text-faint)',
          letterSpacing: '0.1em',
        }}>
          None this period
        </div>
      ) : (
        events.map(evt => (
          <EventRow
            key={evt.id}
            evt={evt}
            showDate={showDate}
            isToday={today === evt.start_date}
          />
        ))
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PlanetaryIntelView() {
  const today = todayIso();
  const [offset, setOffset] = useState(0);
  const now = new Date();

  const monthOptions = [0, 1, 2].map(o => {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() + o, 1));
    return {
      offset: o,
      year:   d.getUTCFullYear(),
      month:  d.getUTCMonth() + 1,
      abbr:   MONTH_ABBR[d.getUTCMonth()],
      full:   MONTH_FULL[d.getUTCMonth()],
    };
  });

  const { year, month, full: monthFull } = monthOptions[offset];

  const { data: events = [], isLoading, isError } = useQuery({
    queryKey: ['pi_events', year, month],
    queryFn:  () => fetchMonthEvents(year, month),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const { macro, daily } = useMemo(() => ({
    macro: events
      .filter(e => durationDays(e) > 7)
      .sort((a, b) => a.start_date.localeCompare(b.start_date)),
    daily: events
      .filter(e => durationDays(e) <= 7)
      .sort((a, b) => a.start_date.localeCompare(b.start_date)),
  }), [events]);

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--text-faint)',
            marginBottom: 6,
          }}>
            Kāla-Drishti · Planetary Intelligence
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 26,
            fontWeight: 500,
            color: 'var(--text-primary)',
            margin: 0,
            letterSpacing: '-0.01em',
          }}>
            Planetary Intel
          </h1>
        </div>

        {/* Month selector */}
        <div style={{
          display: 'flex',
          gap: 2,
          padding: 3,
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid color-mix(in srgb, var(--text-primary) 8%, transparent)',
          borderRadius: 8,
        }}>
          {monthOptions.map(opt => (
            <button
              key={opt.offset}
              onClick={() => setOffset(opt.offset)}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 700,
                padding: '4px 14px',
                borderRadius: 5,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.12s',
                background: offset === opt.offset ? 'color-mix(in srgb, var(--text-primary) 12%, transparent)' : 'transparent',
                color: offset === opt.offset ? 'var(--text-primary)' : 'var(--text-faint)',
                letterSpacing: '0.08em',
              }}
            >
              {opt.abbr}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '32px 0' }}>
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--text-faint)' }} />
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-faint)' }}>
            Loading…
          </span>
        </div>
      ) : isError ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '24px 0' }}>
          <AlertCircle style={{ width: 16, height: 16, color: 'var(--text-faint)' }} />
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-faint)' }}>
            Failed to load — backend may be offline
          </span>
        </div>
      ) : (
        <>
          <Section
            label={`Active Backdrop — ${monthFull} ${year}`}
            events={macro}
            showDate={false}
            today={today}
          />
          <Section
            label={`Events — ${monthFull} ${year}`}
            events={daily}
            showDate={true}
            today={today}
          />
        </>
      )}
    </div>
  );
}
