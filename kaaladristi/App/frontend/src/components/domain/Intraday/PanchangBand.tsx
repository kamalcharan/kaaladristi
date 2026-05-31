/**
 * PanchangBand — horizontal SVG strip 09:15–15:30 IST.
 *
 * Layers (bottom → top):
 *   • Background fill tinted by session quality (subtle)
 *   • Rahu Kala zone (red shading) clipped to session window
 *   • Abhijit zone (green shading) clipped to session window
 *   • Yoga changeover tick (gold)
 *   • Tithi changeover tick (teal)
 *   • Current-time cursor (gold vertical line, animated)
 *   • Hour ticks 09:15, 10, 11, 12, 13, 14, 15, 15:30
 *
 * Pure presentational — receives nowMin from parent so the cursor
 * and active state stay in lockstep with TopStrip / AlertStrip.
 */

import {
  parseTimeToMinutes,
  SESSION_OPEN_MIN, SESSION_CLOSE_MIN,
  type SessionQuality,
} from '@/services/intradayTime';
import type { PanchangDailyResponse } from '@/hooks/useIntraday';

interface PanchangBandProps {
  panchang: PanchangDailyResponse | null;
  nowMin:   number;
  sq:       SessionQuality;
}

const HOUR_TICKS = [
  { min: 9 * 60 + 15, label: '09:15' },
  { min: 10 * 60,     label: '10:00' },
  { min: 11 * 60,     label: '11:00' },
  { min: 12 * 60,     label: '12:00' },
  { min: 13 * 60,     label: '13:00' },
  { min: 14 * 60,     label: '14:00' },
  { min: 15 * 60,     label: '15:00' },
  { min: 15 * 60 + 30, label: '15:30' },
];

export default function PanchangBand({ panchang, nowMin, sq }: PanchangBandProps) {
  // Map any minute value to viewBox X (0..1000)
  const VB_W = 1000;
  const VB_H = 32;
  const range = SESSION_CLOSE_MIN - SESSION_OPEN_MIN;
  const tx = (m: number) => {
    const clamped = Math.max(SESSION_OPEN_MIN, Math.min(SESSION_CLOSE_MIN, m));
    return ((clamped - SESSION_OPEN_MIN) / range) * VB_W;
  };

  // Zone bounds (clipped to session)
  const rahuS = parseTimeToMinutes(panchang?.rahu_kala_start ?? null);
  const rahuE = parseTimeToMinutes(panchang?.rahu_kala_end ?? null);
  const abhS  = parseTimeToMinutes(panchang?.abhijit_start ?? null);
  const abhE  = parseTimeToMinutes(panchang?.abhijit_end ?? null);

  const showRahu = rahuS != null && rahuE != null
    && rahuE > SESSION_OPEN_MIN && rahuS < SESSION_CLOSE_MIN;
  const showAbh  = abhS != null && abhE != null
    && abhE > SESSION_OPEN_MIN && abhS < SESSION_CLOSE_MIN;

  // Changeover ticks
  const yogaEnd = !panchang?.yoga_end_next_day
    ? parseTimeToMinutes(panchang?.yoga_end_ist ?? null)
    : null;
  const showYoga = yogaEnd != null
    && yogaEnd >= SESSION_OPEN_MIN && yogaEnd <= SESSION_CLOSE_MIN;

  // Background tint by SQ
  const sqTint =
    sq === 3 ? 'var(--bull-bg)' :
    sq === 2 ? 'var(--caution-bg)' :
    sq === 1 ? 'var(--caution-bg)' :
               'var(--bear-bg)';

  // Cursor (only render if in session window, otherwise pin to edge)
  const inSession = nowMin >= SESSION_OPEN_MIN && nowMin <= SESSION_CLOSE_MIN;
  const cursorX = tx(nowMin);

  return (
    <div style={{
      borderBottom: '1px solid var(--kd-border)',
      flexShrink: 0,
      background: 'var(--kd-bg)',
    }}>
      <svg
        width="100%"
        height={VB_H}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        style={{ display: 'block' }}
      >
        {/* SQ background tint */}
        <rect x={0} y={0} width={VB_W} height={VB_H} fill={sqTint} />

        {/* Rahu zone */}
        {showRahu && (
          <rect
            x={tx(rahuS!)}
            y={0}
            width={Math.max(1, tx(rahuE!) - tx(rahuS!))}
            height={VB_H}
            fill="rgba(231, 76, 60, 0.20)"
          />
        )}

        {/* Abhijit zone */}
        {showAbh && (
          <rect
            x={tx(abhS!)}
            y={0}
            width={Math.max(1, tx(abhE!) - tx(abhS!))}
            height={VB_H}
            fill="rgba(46, 204, 113, 0.30)"
          />
        )}

        {/* Hour ticks */}
        {HOUR_TICKS.map(t => (
          <g key={t.label}>
            <line
              x1={tx(t.min)} y1={0} x2={tx(t.min)} y2={VB_H}
              stroke="var(--kd-border)" strokeWidth={0.5}
            />
            <text
              x={tx(t.min)} y={VB_H - 3}
              fontSize={6} fill="var(--text-faint)"
              textAnchor="middle"
              fontFamily="var(--font-mono, monospace)"
            >{t.label}</text>
          </g>
        ))}

        {/* Yoga changeover tick */}
        {showYoga && (
          <line
            x1={tx(yogaEnd!)} y1={0} x2={tx(yogaEnd!)} y2={VB_H}
            stroke="var(--gold)"
            strokeWidth={1.2}
            strokeDasharray="3,2"
            opacity={0.85}
          />
        )}

        {/* Zone labels */}
        {showRahu && (
          <text
            x={(tx(rahuS!) + tx(rahuE!)) / 2}
            y={VB_H / 2 + 2}
            fontSize={6}
            fill="var(--risk-red)"
            opacity={0.85}
            textAnchor="middle"
            fontFamily="var(--font-mono, monospace)"
          >☊ RAHU</text>
        )}
        {showAbh && (
          <text
            x={(tx(abhS!) + tx(abhE!)) / 2}
            y={VB_H / 2 + 2}
            fontSize={6}
            fill="var(--risk-green)"
            opacity={0.85}
            textAnchor="middle"
            fontFamily="var(--font-mono, monospace)"
          >☀ ABHIJIT</text>
        )}

        {/* Now-cursor */}
        {inSession && (
          <line
            x1={cursorX} y1={0} x2={cursorX} y2={VB_H}
            stroke="var(--gold)"
            strokeWidth={1.5}
            opacity={0.95}
          />
        )}
      </svg>
    </div>
  );
}
