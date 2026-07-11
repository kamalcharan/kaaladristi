import React, { useState, useCallback } from 'react';
import type { DcInferenceEvent } from '@/services/visualPulseEngine';
import { MONTH_ABBR } from '@/lib/dateUtils';

/**
 * AstroStrip — 7-day window centered on active date.
 * Shows astro energy gradient, event ticks, today marker,
 * cursor-following tooltip with inference details.
 * Moves with the timeline slider.
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
  major_positive: 'var(--bull)',
  bullish:        'var(--bull)',
  minor_positive: 'var(--bull)',
  neutral:        '#64748b',
  minor_negative: 'var(--caution)',
  bearish:        'var(--bear)',
  major_negative: 'var(--bear)',
};

function scoreToColor(score: number): string {
  if (score >= 6) return 'var(--bull-bg)';
  if (score >= 3) return 'var(--bull-bg)';
  if (score >= 1) return 'var(--bull-bg)';
  if (score === 0) return 'var(--bg)';
  if (score >= -1) return 'var(--caution-bg)';
  if (score >= -3) return 'var(--bear-bg)';
  return 'var(--bear-bg)';
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function formatDayLabel(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${parseInt(d)} ${MONTH_ABBR[parseInt(m) - 1]}`;
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
    score: number;
  }>({ visible: false, x: 0, y: 0, events: [], dateStr: '', score: 0 });

  // 7-day window: 3 days before active, active, 3 days after
  const windowStart = addDays(activeDate || new Date().toISOString().split('T')[0], -3);
  const WINDOW_DAYS = 7;
  const today = new Date().toISOString().split('T')[0];

  // Build days array
  const days = Array.from({ length: WINDOW_DAYS }, (_, i) => {
    const dateStr = addDays(windowStart, i);
    const events = dcInferences.filter(
      (ev) => dateStr >= ev.start_date && dateStr <= (ev.end_date ?? ev.start_date),
    );
    const score = events.reduce(
      (sum, ev) => sum + (ASTRO_WEIGHTS[ev.market_impact ?? 'neutral'] ?? 0), 0,
    );
    return { dateStr, events, score, color: scoreToColor(score) };
  });

  // Unique event ticks within window
  const ticks: { dayIdx: number; color: string; event: DcInferenceEvent }[] = [];
  const seenKeys = new Set<string>();
  dcInferences.forEach((ev) => {
    const key = ev.start_date + ev.astro_event;
    if (seenKeys.has(key)) return;
    // Check if event start falls within our window
    const dayIdx = days.findIndex((d) => d.dateStr === ev.start_date);
    if (dayIdx < 0) return;
    seenKeys.add(key);
    ticks.push({
      dayIdx,
      color: IMPACT_COLORS[ev.market_impact ?? 'neutral'] ?? '#64748b',
      event: ev,
    });
  });

  const handleDayEnter = useCallback(
    (e: React.MouseEvent, day: typeof days[0]) => {
      setTooltip({
        visible: true,
        x: e.clientX + 12,
        y: e.clientY - 80,
        events: day.events,
        dateStr: day.dateStr,
        score: day.score,
      });
    },
    [],
  );

  const handleDayMove = useCallback((e: React.MouseEvent) => {
    setTooltip((t) => {
      let x = e.clientX + 12;
      let y = e.clientY - 80;
      if (x + 250 > window.innerWidth) x = e.clientX - 260;
      if (y < 10) y = 10;
      return { ...t, x, y };
    });
  }, []);

  const handleDayLeave = useCallback(() => {
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
          fontSize: 8, fontFamily: 'var(--font-mono, monospace)',
          textTransform: 'uppercase', letterSpacing: 2, color: 'var(--text-muted)',
        }}>
          Astro Energy &middot; 7-Day Window
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { label: 'Major+', color: 'var(--bull)' },
            { label: 'Minor+', color: 'var(--bull)' },
            { label: 'Minor−', color: 'var(--caution)' },
            { label: 'Major−', color: 'var(--bear)' },
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

      {/* Day segments */}
      <div style={{
        display: 'grid', gridTemplateColumns: `repeat(${WINDOW_DAYS}, 1fr)`, gap: 2,
        position: 'relative',
      }}>
        {days.map((day, i) => {
          const isToday = day.dateStr === today;
          const isActive = day.dateStr === activeDate;

          return (
            <div
              key={day.dateStr}
              onMouseEnter={(e) => handleDayEnter(e, day)}
              onMouseMove={handleDayMove}
              onMouseLeave={handleDayLeave}
              style={{
                height: 28, borderRadius: 4, position: 'relative',
                background: day.color,
                border: isActive
                  ? '2px solid var(--accent-gold)'
                  : isToday
                  ? '1px solid var(--accent-gold)'
                  : '1px solid var(--kd-border)',
                boxShadow: isActive ? '0 0 8px var(--accent-gold)' : isToday ? '0 0 4px rgba(201,168,76,0.3)' : undefined,
                cursor: 'pointer',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {/* Day number */}
              <span style={{
                fontSize: 10, fontFamily: 'var(--font-mono, monospace)',
                fontWeight: isActive ? 700 : 400,
                color: isActive ? 'var(--accent-gold)' : 'var(--text-primary)',
              }}>
                {parseInt(day.dateStr.split('-')[2], 10)}
              </span>

              {/* Event dots below day number */}
              {day.events.length > 0 && (
                <div style={{ display: 'flex', gap: 2, marginTop: 1 }}>
                  {day.events.slice(0, 4).map((ev, j) => (
                    <span key={j} style={{
                      width: 4, height: 4, borderRadius: '50%',
                      background: IMPACT_COLORS[ev.market_impact ?? 'neutral'],
                    }} />
                  ))}
                </div>
              )}

              {/* Today label */}
              {isToday && (
                <span style={{
                  position: 'absolute', top: -10,
                  fontSize: 6, fontFamily: 'var(--font-mono, monospace)',
                  color: 'var(--accent-gold)', letterSpacing: 1,
                  textTransform: 'uppercase',
                }}>TODAY</span>
              )}

              {/* Score badge */}
              {day.score !== 0 && (
                <span style={{
                  position: 'absolute', bottom: -10,
                  fontSize: 7, fontFamily: 'var(--font-mono, monospace)',
                  color: day.score > 0 ? 'var(--bull)' : 'var(--bear)',
                }}>
                  {day.score > 0 ? '+' : ''}{day.score}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Day labels */}
      <div style={{
        display: 'grid', gridTemplateColumns: `repeat(${WINDOW_DAYS}, 1fr)`, gap: 2,
        marginTop: 12,
      }}>
        {days.map((day) => (
          <span key={day.dateStr} style={{
            textAlign: 'center',
            fontSize: 7, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-muted)',
          }}>
            {formatDayLabel(day.dateStr)}
          </span>
        ))}
      </div>

      {/* Cursor-following tooltip */}
      {tooltip.visible && (
        <div style={{
          position: 'fixed',
          left: tooltip.x,
          top: tooltip.y,
          zIndex: 999,
          padding: '10px 14px',
          borderRadius: 8,
          background: 'var(--kd-surface)',
          border: '1px solid var(--kd-border)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          fontSize: 9,
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          maxWidth: 260,
          pointerEvents: 'none',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 4,
          }}>
            <span style={{
              fontFamily: 'var(--font-mono, monospace)', fontWeight: 600,
              color: 'var(--text-primary)',
            }}>{tooltip.dateStr}</span>
            <span style={{
              fontFamily: 'var(--font-mono, monospace)', fontWeight: 600,
              fontSize: 10,
              color: tooltip.score > 0 ? 'var(--bull)' : tooltip.score < 0 ? 'var(--bear)' : 'var(--text-muted)',
            }}>
              Score: {tooltip.score > 0 ? '+' : ''}{tooltip.score}
            </span>
          </div>

          {tooltip.events.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No astro events active
            </div>
          ) : (
            tooltip.events.map((ev) => (
              <div key={ev.id} style={{
                marginBottom: 6, paddingBottom: 4,
                borderBottom: '1px solid var(--kd-border)',
              }}>
                <div style={{
                  color: IMPACT_COLORS[ev.market_impact ?? 'neutral'],
                  fontWeight: 600,
                }}>{ev.astro_event}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 8 }}>
                  {ev.start_date}{ev.end_date && ev.end_date !== ev.start_date ? ` → ${ev.end_date}` : ''}
                  {' · '}
                  <span style={{
                    color: IMPACT_COLORS[ev.market_impact ?? 'neutral'],
                    textTransform: 'uppercase',
                  }}>{(ev.market_impact ?? 'neutral').replace(/_/g, ' ')}</span>
                </div>
                {ev.inference && (
                  <div style={{
                    color: 'var(--accent-gold)', fontStyle: 'italic', marginTop: 2,
                    fontSize: 9,
                  }}>"{ev.inference}"</div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
