import React, { useState, useRef, useCallback } from 'react';
import type { DcInferenceEvent } from '@/services/visualPulseEngine';
import { getDaysInMonth, toIso, MONTH_ABBR } from '@/lib/dateUtils';

/**
 * AstroStrip — matches kaaladristi-v2.html spec.
 * CSS gradient track colored by net astro score per day,
 * event tick marks overlaid, today marker with glow,
 * cursor-following tooltip, weekly date labels, legend.
 */

const ASTRO_WEIGHTS: Record<string, number> = {
  major_positive: 4,
  bullish: 3,
  minor_positive: 1,
  neutral: 0,
  minor_negative: -1,
  bearish: -3,
  major_negative: -4,
};

const IMPACT_COLORS: Record<string, string> = {
  major_positive: '#10b981',
  bullish:        '#34d399',
  minor_positive: '#6ee7b7',
  neutral:        '#64748b',
  minor_negative: '#fb923c',
  bearish:        '#ef4444',
  major_negative: '#dc2626',
};

function scoreToColor(score: number): string {
  if (score >= 6) return '#10b981';
  if (score >= 3) return '#34d399';
  if (score >= 1) return '#6ee7b766';
  if (score === 0) return '#1e293b';
  if (score >= -1) return '#fb923c88';
  if (score >= -3) return '#ef444488';
  return '#ef4444';
}

interface AstroStripProps {
  dcInferences: DcInferenceEvent[];
  activeDate: string;
}

export default function AstroStrip({ dcInferences, activeDate }: AstroStripProps) {
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    events: DcInferenceEvent[];
    dateStr: string;
  }>({ visible: false, x: 0, y: 0, events: [], dateStr: '' });

  const trackRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const daysInMonth = getDaysInMonth(year, month);
  const todayStr = toIso(year, month, now.getDate());
  const monthStart = toIso(year, month, 1);

  // Compute net astro score per day
  function dayScore(day: number): number {
    const dateStr = toIso(year, month, day);
    return dcInferences
      .filter((ev) => dateStr >= ev.start_date && dateStr <= (ev.end_date ?? ev.start_date))
      .reduce((sum, ev) => sum + (ASTRO_WEIGHTS[ev.market_impact ?? 'neutral'] ?? 0), 0);
  }

  // Events active on a day
  function dayEvents(day: number): DcInferenceEvent[] {
    const dateStr = toIso(year, month, day);
    return dcInferences.filter(
      (ev) => dateStr >= ev.start_date && dateStr <= (ev.end_date ?? ev.start_date),
    );
  }

  // Build gradient stops
  const gradientStops = Array.from({ length: daysInMonth }, (_, i) => {
    const pct = ((i / daysInMonth) * 100).toFixed(1);
    return `${scoreToColor(dayScore(i + 1))} ${pct}%`;
  }).join(', ');

  // Unique event tick marks (one per event start date in this month)
  const ticks: { pct: number; color: string; event: DcInferenceEvent }[] = [];
  const seenKeys = new Set<string>();
  dcInferences.forEach((ev) => {
    if (ev.start_date < monthStart || ev.start_date > toIso(year, month, daysInMonth)) return;
    const key = ev.start_date + ev.astro_event;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    const dayNum = parseInt(ev.start_date.split('-')[2], 10);
    const pct = ((dayNum - 1) / daysInMonth) * 100;
    ticks.push({
      pct,
      color: IMPACT_COLORS[ev.market_impact ?? 'neutral'] ?? '#64748b',
      event: ev,
    });
  });

  // Today position
  const todayDay = now.getDate();
  const todayPct = ((todayDay - 1) / daysInMonth) * 100;

  // Active date position
  let activePct: number | null = null;
  if (activeDate) {
    const parts = activeDate.split('-');
    const aMonth = parseInt(parts[1], 10);
    const aDay = parseInt(parts[2], 10);
    if (aMonth === month) {
      activePct = ((aDay - 1) / daysInMonth) * 100;
    }
  }

  // Weekly date labels
  const weekLabels: { label: string; pct: number }[] = [];
  for (let d = 1; d <= daysInMonth; d += 7) {
    weekLabels.push({
      label: `${MONTH_ABBR[month - 1]} ${String(d).padStart(2, '0')}`,
      pct: ((d - 1) / daysInMonth) * 100,
    });
  }
  // Always include last day
  weekLabels.push({
    label: `${MONTH_ABBR[month - 1]} ${daysInMonth}`,
    pct: ((daysInMonth - 1) / daysInMonth) * 100,
  });

  const handleTickEnter = useCallback(
    (e: React.MouseEvent, ev: DcInferenceEvent) => {
      const dateStr = ev.start_date;
      const eventsOnDay = dcInferences.filter(
        (d) => dateStr >= d.start_date && dateStr <= (d.end_date ?? d.start_date),
      );
      setTooltip({ visible: true, x: e.clientX + 12, y: e.clientY - 70, events: eventsOnDay, dateStr });
    },
    [dcInferences],
  );

  const handleTickMove = useCallback((e: React.MouseEvent) => {
    setTooltip((t) => {
      let x = e.clientX + 12;
      let y = e.clientY - 70;
      if (x + 220 > window.innerWidth) x = e.clientX - 230;
      if (y < 10) y = 10;
      return { ...t, x, y };
    });
  }, []);

  const handleTickLeave = useCallback(() => {
    setTooltip((t) => ({ ...t, visible: false }));
  }, []);

  return (
    <div style={{ padding: '6px 0' }}>
      {/* Label + Legend */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 6,
      }}>
        <span style={{
          fontSize: 7, fontFamily: 'var(--font-mono, monospace)',
          textTransform: 'uppercase', letterSpacing: 3, color: 'var(--text-muted)',
        }}>
          Astro Energy &middot; {MONTH_ABBR[month - 1]} {year}
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { label: 'Major+', color: '#10b981' },
            { label: 'Minor+', color: '#6ee7b7' },
            { label: 'Minor-', color: '#fb923c' },
            { label: 'Bearish', color: '#ef4444' },
          ].map((item) => (
            <span key={item.label} style={{
              display: 'flex', alignItems: 'center', gap: 3,
              fontSize: 7, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-muted)',
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', background: item.color,
              }} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      {/* Gradient Track + Ticks + Today */}
      <div
        ref={trackRef}
        style={{
          height: 10, borderRadius: 5, position: 'relative',
          background: `linear-gradient(to right, ${gradientStops})`,
          overflow: 'visible',
        }}
      >
        {/* Event tick marks */}
        {ticks.map((tick, i) => (
          <div
            key={i}
            onMouseEnter={(e) => handleTickEnter(e, tick.event)}
            onMouseMove={handleTickMove}
            onMouseLeave={handleTickLeave}
            style={{
              position: 'absolute',
              left: `${tick.pct}%`,
              top: -3, bottom: -3,
              width: 2.5, borderRadius: 1,
              background: tick.color,
              opacity: 0.9,
              cursor: 'pointer',
              transition: 'opacity 0.2s, transform 0.2s',
            }}
            onMouseOver={(e) => {
              (e.currentTarget as HTMLElement).style.opacity = '1';
              (e.currentTarget as HTMLElement).style.transform = 'scaleY(1.3)';
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLElement).style.opacity = '0.9';
              (e.currentTarget as HTMLElement).style.transform = 'scaleY(1)';
            }}
          />
        ))}

        {/* Today marker */}
        <div style={{
          position: 'absolute',
          left: `${todayPct}%`,
          top: -5, bottom: -5,
          width: 2,
          background: 'var(--accent-gold)',
          boxShadow: '0 0 8px var(--accent-gold)',
          borderRadius: 1,
          zIndex: 2,
        }}>
          <div style={{
            position: 'absolute', bottom: 'calc(100% + 3px)', left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 6, fontFamily: 'var(--font-mono, monospace)',
            color: 'var(--accent-gold)', letterSpacing: 2,
            textTransform: 'uppercase', whiteSpace: 'nowrap',
          }}>TODAY</div>
        </div>

        {/* Active date marker */}
        {activePct != null && activeDate !== todayStr && (
          <div style={{
            position: 'absolute',
            left: `${activePct}%`,
            top: -4, bottom: -4,
            width: 2,
            background: 'var(--text-secondary)',
            borderRadius: 1,
            zIndex: 1,
            opacity: 0.7,
          }} />
        )}
      </div>

      {/* Weekly date labels */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        marginTop: 5,
        fontSize: 7, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-muted)',
      }}>
        {weekLabels.map((lbl, i) => (
          <span key={i}>{lbl.label}</span>
        ))}
      </div>

      {/* Cursor-following tooltip */}
      {tooltip.visible && tooltip.events.length > 0 && (
        <div style={{
          position: 'fixed',
          left: tooltip.x,
          top: tooltip.y,
          zIndex: 999,
          padding: '8px 12px',
          borderRadius: 8,
          background: 'var(--kd-surface)',
          border: '1px solid var(--kd-border)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          fontSize: 9,
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
          maxWidth: 220,
          pointerEvents: 'none',
        }}>
          <div style={{
            fontFamily: 'var(--font-mono, monospace)', fontWeight: 600,
            color: 'var(--text-primary)', marginBottom: 4,
          }}>{tooltip.dateStr}</div>
          {tooltip.events.map((ev) => (
            <div key={ev.id} style={{ marginBottom: 3 }}>
              <div style={{
                color: IMPACT_COLORS[ev.market_impact ?? 'neutral'],
                fontWeight: 600, marginBottom: 1,
              }}>{ev.astro_event}</div>
              <div style={{ color: 'var(--text-muted)' }}>
                {ev.start_date}{ev.end_date && ev.end_date !== ev.start_date ? ` → ${ev.end_date}` : ''}
              </div>
              <div style={{
                color: IMPACT_COLORS[ev.market_impact ?? 'neutral'],
                textTransform: 'uppercase', fontSize: 8, marginTop: 1,
              }}>{(ev.market_impact ?? 'neutral').replace(/_/g, ' ')}</div>
              {ev.inference && (
                <div style={{
                  color: 'var(--accent-gold)', fontStyle: 'italic', marginTop: 2,
                }}>"{ev.inference}"</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
