/**
 * TopStrip — 9-cell panchang strip (Cycle 3)
 * ============================================
 * Mirrors finastro_screen1_v3.jsx top strip but data-driven from
 * /api/panchang/daily and /api/astro/daily-signal.
 *
 * Cells:
 *   1 SESSION quality (derived from net_signal)
 *   2 YOGA + favorability
 *   3 TITHI + paksha
 *   4 MOON sign + element
 *   5 YOGA changeover (yoga_end_ist + yoga_end_next_day)
 *   6 RAHU window (rahu_kala_start/end)
 *   7 ABHIJIT window (abhijit_start/end)
 *   8 TIME · DATE (live IST)
 *   9 LUCKYPOP (placeholder until webhook lands)
 */

import {
  deriveSessionQuality, SQ_LABELS, SQ_ICONS, SQ_COLOR_VARS,
  yogaFavorability, elementOfSign, formatHHMM,
} from '@/services/intradayTime';
import type { PanchangDailyResponse, AstroDailySignalResponse } from '@/hooks/useIntraday';

interface TopStripProps {
  panchang:    PanchangDailyResponse | null;
  astroSignal: AstroDailySignalResponse | null;
  nowMin:      number;
  inRahu:      boolean;
  inAbhijit:   boolean;
}

// ── Cell shell ──────────────────────────────────────────────────────

interface CellProps {
  label: string;
  primary?: React.ReactNode;
  secondary?: React.ReactNode;
  tone?: 'green' | 'red' | 'amber' | 'teal' | 'gold' | 'dim';
  highlight?: boolean;
  borderRight?: boolean;
}

const TONE_COLOR: Record<NonNullable<CellProps['tone']>, string> = {
  green: 'var(--risk-green)',
  red:   'var(--risk-red)',
  amber: 'var(--risk-amber)',
  teal:  'var(--accent-teal, #40B8C8)',
  gold:  'var(--accent-gold, #C9A84C)',
  dim:   'var(--text-muted)',
};

const TONE_BG: Record<NonNullable<CellProps['tone']>, string> = {
  green: 'rgba(46, 204, 113, 0.10)',
  red:   'rgba(231, 76, 60, 0.10)',
  amber: 'rgba(245, 158, 11, 0.08)',
  teal:  'rgba(64, 184, 200, 0.08)',
  gold:  'rgba(201, 168, 76, 0.08)',
  dim:   'transparent',
};

function Cell({ label, primary, secondary, tone, highlight, borderRight }: CellProps) {
  const color = tone ? TONE_COLOR[tone] : 'var(--text-primary)';
  const bg = highlight && tone ? TONE_BG[tone] : 'transparent';
  return (
    <div style={{
      padding: '5px 6px',
      textAlign: 'center',
      borderRight: borderRight ? '1px solid var(--kd-border)' : 'none',
      background: bg,
      minWidth: 0,
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
    }}>
      <div style={{
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: 8, color: 'var(--text-faint)',
        letterSpacing: '0.1em', textTransform: 'uppercase',
        marginBottom: 2,
      }}>{label}</div>
      <div style={{
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: 11, fontWeight: 700,
        color, lineHeight: 1.2,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{primary ?? '—'}</div>
      {secondary !== undefined && (
        <div style={{
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: 9, color: tone ? color : 'var(--text-muted)',
          marginTop: 1, lineHeight: 1.2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{secondary}</div>
      )}
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────

export default function TopStrip({
  panchang, astroSignal, nowMin, inRahu, inAbhijit,
}: TopStripProps) {

  // Cell 1 — Session
  const sq = deriveSessionQuality(astroSignal?.net_signal);
  const isTurning = astroSignal?.turning_date === true;
  const sessionTone: NonNullable<CellProps['tone']> =
    sq === 3 ? 'green' : sq === 2 ? 'amber' : sq === 1 ? 'amber' : 'red';

  // Cell 2 — Yoga
  const yogaFav = yogaFavorability(panchang?.yoga_name);
  const yogaTone: NonNullable<CellProps['tone']> =
    yogaFav === 'favorable' ? 'green' : yogaFav === 'avoid' ? 'red' : 'dim';

  // Cell 4 — Moon
  const moonElement = elementOfSign(panchang?.moon_sign_name);

  // Cell 5 — Yoga changeover
  const yogaEndLabel = panchang?.yoga_end_ist
    ? `${panchang.yoga_end_ist.slice(0, 5)}${panchang.yoga_end_next_day ? ' +1' : ''}`
    : null;

  // Cell 6 / 7 — windows
  const rahuLabel = panchang?.rahu_kala_start && panchang?.rahu_kala_end
    ? `${panchang.rahu_kala_start.slice(0, 5)}–${panchang.rahu_kala_end.slice(0, 5)}`
    : null;
  const abhLabel = panchang?.abhijit_start && panchang?.abhijit_end
    ? `${panchang.abhijit_start.slice(0, 5)}–${panchang.abhijit_end.slice(0, 5)}`
    : null;

  // Cell 8 — time
  const clockLabel = formatHHMM(nowMin);
  const dateLabel = panchang?.date
    ? new Date(panchang.date + 'T00:00:00Z').toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', timeZone: 'UTC',
      })
    : '—';
  const dayLabel = panchang?.vara ?? '—';

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(9, 1fr)',
      background: 'var(--kd-panel)',
      borderBottom: '1px solid var(--kd-border)',
      flexShrink: 0,
    }}>
      {/* 1 SESSION */}
      <Cell
        label="Session"
        primary={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 14 }}>{SQ_ICONS[sq]}</span>
            <span>{SQ_LABELS[sq]}</span>
            {isTurning && (
              <span style={{
                fontSize: 8, color: 'var(--risk-amber)',
                border: '1px solid var(--risk-amber)',
                padding: '0 4px', borderRadius: 2, marginLeft: 2,
              }}>TURNING</span>
            )}
          </span>
        }
        secondary={astroSignal?.net_signal?.replace(/_/g, ' ') ?? 'no signal'}
        tone={sessionTone}
        borderRight
      />

      {/* 2 YOGA */}
      <Cell
        label="Yoga"
        primary={panchang?.yoga_name ?? '—'}
        secondary={
          yogaFav === 'favorable' ? 'Favorable'
          : yogaFav === 'avoid'   ? 'AVOID'
          : 'Neutral'
        }
        tone={yogaTone}
        borderRight
      />

      {/* 3 TITHI */}
      <Cell
        label="Tithi"
        primary={panchang?.tithi_base_name ?? panchang?.tithi_name ?? '—'}
        secondary={panchang?.paksha ?? null}
        tone="dim"
        borderRight
      />

      {/* 4 MOON */}
      <Cell
        label="Moon"
        primary={panchang?.moon_sign_name ?? '—'}
        secondary={moonElement ?? null}
        tone="teal"
        borderRight
      />

      {/* 5 YOGA CHANGE */}
      <Cell
        label="Yoga ⚡"
        primary={yogaEndLabel ?? 'full day'}
        secondary={yogaEndLabel ? 'IST' : null}
        tone="gold"
        borderRight
      />

      {/* 6 RAHU */}
      <Cell
        label="Rahu Kala"
        primary={<span>☊ {rahuLabel ?? '—'}</span>}
        secondary={inRahu ? 'ACTIVE' : null}
        tone="red"
        highlight={inRahu}
        borderRight
      />

      {/* 7 ABHIJIT */}
      <Cell
        label="Abhijit"
        primary={<span>☀ {abhLabel ?? '—'}</span>}
        secondary={inAbhijit ? 'ACTIVE' : null}
        tone="green"
        highlight={inAbhijit}
        borderRight
      />

      {/* 8 TIME · DATE */}
      <Cell
        label="Time · Date"
        primary={clockLabel}
        secondary={`${dateLabel} · ${dayLabel}`}
        tone="gold"
        borderRight
      />

      {/* 9 LUCKYPOP — placeholder until webhook */}
      {/* INTRADAY: replace placeholder with live LP signal cell when webhook is wired */}
      <Cell
        label="LuckyPop"
        primary="—"
        secondary="awaiting webhook"
        tone="dim"
      />
    </div>
  );
}
