/**
 * AlertStrip — single-line banner showing the next time event +
 * a Rahu/Abhijit live banner when active.
 *
 * Cycle 3 — does NOT yet show the conflict-engine verdict (that's
 * Cycle 4). For now the right side is left intentionally blank.
 */

import { nextEvent, parseTimeToMinutes, type EventInputs } from '@/services/intradayTime';
import type { PanchangDailyResponse } from '@/hooks/useIntraday';

interface AlertStripProps {
  panchang:     PanchangDailyResponse | null;
  nowMin:       number;
  inRahu:       boolean;
  inAbhijit:    boolean;
  verdictLabel?: string;
  verdictColor?: 'red' | 'green' | 'amber' | 'teal' | 'dim';
}

const VERDICT_COLOR_VAR: Record<NonNullable<AlertStripProps['verdictColor']>, string> = {
  red:   'var(--risk-red)',
  green: 'var(--risk-green)',
  amber: 'var(--risk-amber)',
  teal:  'var(--accent-cyan)',
  dim:   'var(--text-muted)',
};

export default function AlertStrip({
  panchang, nowMin, inRahu, inAbhijit, verdictLabel, verdictColor,
}: AlertStripProps) {

  const ev: EventInputs = {
    rahuKala: panchang?.rahu_kala_start && panchang?.rahu_kala_end ? {
      startMin: parseTimeToMinutes(panchang.rahu_kala_start) ?? 0,
      endMin:   parseTimeToMinutes(panchang.rahu_kala_end)   ?? 0,
    } : null,
    abhijit: panchang?.abhijit_start && panchang?.abhijit_end ? {
      startMin: parseTimeToMinutes(panchang.abhijit_start) ?? 0,
      endMin:   parseTimeToMinutes(panchang.abhijit_end)   ?? 0,
    } : null,
    yogaEnd: panchang?.yoga_end_ist
      ? { time: panchang.yoga_end_ist, isNextDay: panchang.yoga_end_next_day }
      : null,
    tithiEnd: null,       // not yet exposed by API in this shape; safe to leave
    nakshatraEnd: null,
  };

  const ne = nextEvent(nowMin, ev);

  // Left side — primary message
  let leftLabel: React.ReactNode = '⚡ No events scheduled';
  let leftColor = 'var(--text-muted)';

  if (inRahu) {
    leftLabel = '☊ Rahu Kala active — no new entries';
    leftColor = 'var(--risk-red)';
  } else if (inAbhijit) {
    leftLabel = '☀ Abhijit active — best execution window';
    leftColor = 'var(--risk-green)';
  } else if (ne) {
    leftLabel = (
      <>
        <span style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>
          ⚡ Next: {ne.time}
        </span>
        <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>
          {ne.label}
        </span>
        <span style={{ color: 'var(--text-faint)', marginLeft: 6 }}>
          (+{Math.max(0, Math.round(ne.minutesFromNow))}m)
        </span>
      </>
    );
    leftColor = 'var(--text-primary)';
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '4px 16px',
      background: inRahu
        ? 'var(--bear-bg)'
        : inAbhijit
          ? 'var(--bull-bg)'
          : 'transparent',
      borderBottom: '1px solid var(--kd-border)',
      fontFamily: 'var(--font-mono, monospace)', fontSize: 10,
      flexShrink: 0,
    }}>
      <span style={{ color: leftColor, fontWeight: inRahu || inAbhijit ? 700 : 400 }}>
        {leftLabel}
      </span>
      {/* Conflict engine verdict (Cycle 4) */}
      {verdictLabel && verdictColor && (
        <span style={{
          color: VERDICT_COLOR_VAR[verdictColor],
          fontWeight: 700, letterSpacing: '0.04em',
        }}>{verdictLabel}</span>
      )}
    </div>
  );
}
