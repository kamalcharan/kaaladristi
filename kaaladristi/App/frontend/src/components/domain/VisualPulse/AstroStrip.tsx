import React, { useState } from 'react';
import type { DcInferenceEvent } from '@/services/visualPulseEngine';
import { getDaysInMonth, toIso, MONTH_ABBR } from '@/lib/dateUtils';

/**
 * AstroStrip — day-by-day gradient strip for current month
 * showing DC inference events color-coded by impact.
 */

const IMPACT_COLORS: Record<string, string> = {
  major_positive: 'var(--risk-green)',
  bullish:        'var(--risk-green)',
  minor_positive: 'var(--risk-green)',
  neutral:        'var(--kd-border)',
  minor_negative: 'var(--risk-amber)',
  bearish:        'var(--risk-red)',
  major_negative: 'var(--risk-red)',
};

const IMPACT_OPACITY: Record<string, number> = {
  major_positive: 1.0,
  bullish:        0.7,
  minor_positive: 0.4,
  neutral:        0.2,
  minor_negative: 0.5,
  bearish:        0.7,
  major_negative: 1.0,
};

interface AstroStripProps {
  dcInferences: DcInferenceEvent[];
  activeDate: string;
}

export default function AstroStrip({ dcInferences, activeDate }: AstroStripProps) {
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const daysInMonth = getDaysInMonth(year, month);
  const todayStr = toIso(year, month, now.getDate());

  // Get strongest impact for each day
  function dayImpact(day: number): { color: string; opacity: number; events: DcInferenceEvent[] } {
    const dateStr = toIso(year, month, day);
    const active = dcInferences.filter(
      (ev) => dateStr >= ev.start_date && dateStr <= (ev.end_date ?? ev.start_date),
    );
    if (active.length === 0) return { color: 'var(--kd-border)', opacity: 0.15, events: [] };

    // Find strongest impact
    const impactOrder = ['major_positive', 'major_negative', 'bullish', 'bearish', 'minor_positive', 'minor_negative', 'neutral'];
    let strongest = 'neutral';
    for (const impact of impactOrder) {
      if (active.some((ev) => ev.market_impact === impact)) {
        strongest = impact;
        break;
      }
    }

    return {
      color: IMPACT_COLORS[strongest] ?? 'var(--kd-border)',
      opacity: IMPACT_OPACITY[strongest] ?? 0.2,
      events: active,
    };
  }

  const hoveredInfo = hoveredDay != null ? dayImpact(hoveredDay) : null;

  return (
    <div style={{ padding: '8px 0' }}>
      {/* Label */}
      <div style={{
        fontSize: 7, fontFamily: 'var(--font-mono, monospace)',
        textTransform: 'uppercase', letterSpacing: 3, color: 'var(--text-muted)',
        marginBottom: 4,
      }}>
        Astro Energy &middot; {MONTH_ABBR[month - 1]} {year}
      </div>

      {/* Strip */}
      <div style={{
        display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden',
        background: 'var(--kd-bg)', position: 'relative',
      }}>
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const info = dayImpact(day);
          const dateStr = toIso(year, month, day);
          const isToday = dateStr === todayStr;
          const isActive = dateStr === activeDate;

          return (
            <div
              key={day}
              onMouseEnter={() => setHoveredDay(day)}
              onMouseLeave={() => setHoveredDay(null)}
              style={{
                flex: 1, height: '100%', cursor: 'pointer',
                background: info.color, opacity: info.opacity,
                position: 'relative',
                transition: 'opacity 0.2s ease',
                borderRight: day < daysInMonth ? '1px solid var(--kd-bg)' : undefined,
              }}
            >
              {/* Today marker */}
              {isToday && (
                <div style={{
                  position: 'absolute', top: -2, bottom: -2, left: 0, right: 0,
                  border: '1px solid var(--accent-gold)',
                  borderRadius: 2,
                  boxShadow: '0 0 6px var(--accent-gold)',
                }} />
              )}
              {/* Active date marker */}
              {isActive && !isToday && (
                <div style={{
                  position: 'absolute', top: -1, bottom: -1, left: 0, right: 0,
                  border: '1px solid var(--text-secondary)',
                  borderRadius: 1,
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Date labels */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', marginTop: 2,
        fontSize: 7, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-muted)',
      }}>
        <span>1 {MONTH_ABBR[month - 1]}</span>
        <span>{daysInMonth} {MONTH_ABBR[month - 1]}</span>
      </div>

      {/* Tooltip */}
      {hoveredDay != null && hoveredInfo && hoveredInfo.events.length > 0 && (
        <div style={{
          marginTop: 4, padding: '6px 10px', borderRadius: 6,
          background: 'var(--kd-surface)', border: '1px solid var(--kd-border)',
          fontSize: 9, color: 'var(--text-secondary)', lineHeight: 1.5,
        }}>
          <div style={{
            fontFamily: 'var(--font-mono, monospace)', fontWeight: 600,
            color: 'var(--text-primary)', marginBottom: 2,
          }}>
            {toIso(year, month, hoveredDay)}
          </div>
          {hoveredInfo.events.map((ev) => (
            <div key={ev.id} style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: IMPACT_COLORS[ev.market_impact ?? 'neutral'],
                display: 'inline-block', marginTop: 4,
              }} />
              <span>{ev.astro_event}</span>
              {ev.market_impact && (
                <span style={{
                  fontSize: 8, fontFamily: 'var(--font-mono, monospace)',
                  color: IMPACT_COLORS[ev.market_impact],
                }}>({ev.market_impact.replace(/_/g, ' ')})</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
