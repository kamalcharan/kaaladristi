/**
 * IntradayHeader — symbol + last close + IST clock + Rahu/Abhijit pills
 *
 * Cycle 3 — Rahu/Abhijit pills now reflect the live in-window state
 * passed down from IntradayPage's single clock source.
 */

interface IntradayHeaderProps {
  symbolName: string;
  lastClose: number | null;
  pctChng: number | null;
  tradeDate: string;
  isHoliday: boolean;
  nowMin: number;
  inRahu: boolean;
  inAbhijit: boolean;
}

const _DAY = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const _MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const weekday = _DAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday} · ${String(d).padStart(2, '0')}-${_MON[m - 1]}-${y}`;
}

function formatIstClockSeconds(): string {
  const ist = new Date(Date.now() + (5.5 * 60 * 60 * 1000));
  const h = String(ist.getUTCHours()).padStart(2, '0');
  const m = String(ist.getUTCMinutes()).padStart(2, '0');
  const s = String(ist.getUTCSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

interface PillProps { label: string; active: boolean; activeColor: string; }
function Pill({ label, active, activeColor }: PillProps) {
  return (
    <span style={{
      fontFamily: 'var(--font-mono, monospace)', fontSize: 9,
      padding: '2px 7px', borderRadius: 3,
      letterSpacing: '0.08em', fontWeight: 700,
      background: active ? `color-mix(in srgb, ${activeColor} 13%, transparent)` : 'transparent',
      border: `1px solid ${active ? activeColor : 'var(--kd-border)'}`,
      color: active ? activeColor : 'var(--text-faint)',
    }}>{label}</span>
  );
}

export default function IntradayHeader({
  symbolName, lastClose, pctChng, tradeDate, isHoliday,
  nowMin: _nowMin, inRahu, inAbhijit,
}: IntradayHeaderProps) {
  // _nowMin is consumed via the parent's setInterval; we still want
  // seconds in the clock display, so re-read Date.now() each render.
  const upColor = pctChng !== null && pctChng >= 0
    ? 'var(--risk-green)' : 'var(--risk-red)';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '8px 16px',
      borderBottom: '1px solid var(--kd-border)',
      background: 'var(--kd-panel)',
      flexShrink: 0, minHeight: 44,
    }}>
      {/* Brand */}
      <span style={{
        fontFamily: 'var(--font-serif, serif)', fontSize: 13, fontWeight: 700,
        color: 'var(--text-primary)', letterSpacing: 2,
      }}>DristiQ</span>

      {/* Symbol + price */}
      <span style={{
        fontFamily: 'var(--font-serif, serif)', fontSize: 15, fontWeight: 700,
        color: 'var(--text-primary)',
      }}>{symbolName}</span>
      {lastClose !== null && (
        <span style={{
          fontFamily: 'var(--font-mono, monospace)', fontSize: 14,
          color: upColor,
        }}>
          {lastClose.toLocaleString('en-IN')}
          {pctChng !== null && (
            <span style={{ marginLeft: 6, fontSize: 11 }}>
              {pctChng >= 0 ? '+' : ''}{pctChng.toFixed(2)}%
            </span>
          )}
        </span>
      )}

      {/* Trade date */}
      <span style={{
        fontFamily: 'var(--font-mono, monospace)', fontSize: 11,
        color: 'var(--text-muted)',
      }}>{formatDateLabel(tradeDate)}</span>

      {/* EOD badge */}
      <span style={{
        fontFamily: 'var(--font-mono, monospace)', fontSize: 9,
        padding: '2px 6px', borderRadius: 3,
        border: '1px solid var(--kd-border)', color: 'var(--text-faint)',
        letterSpacing: '0.08em',
      }}>EOD DATA</span>
      {/* INTRADAY: replace EOD badge with "LIVE" + tick indicator when km_index_15m is wired */}

      {/* Spacer */}
      <span style={{ flex: 1 }} />

      {/* Rahu pill */}
      <Pill label="☊ RAHU" active={inRahu} activeColor="rgb(231, 76, 60)" />

      {/* Abhijit pill */}
      <Pill label="☀ ABHIJIT" active={inAbhijit} activeColor="rgb(46, 204, 113)" />

      {/* Holiday badge */}
      {isHoliday && (
        <span style={{
          fontFamily: 'var(--font-mono, monospace)', fontSize: 10,
          padding: '2px 8px', borderRadius: 3,
          background: 'var(--caution-bg)',
          color: 'var(--risk-amber)',
          letterSpacing: '0.08em',
        }}>⊘ NON-WORKING</span>
      )}

      {/* IST clock — show seconds, formatted from current Date so the
          seconds tick smoothly even if nowMin only updates per-minute. */}
      <span style={{
        fontFamily: 'var(--font-mono, monospace)', fontSize: 14,
        color: 'var(--gold)', letterSpacing: '0.1em',
        // Re-read the wall-clock for seconds precision; the explicit
        // dependency on nowMin (via parent re-render) is what makes
        // this re-evaluate in lockstep with the rest of the page.
      }}>{formatIstClockSeconds()} IST</span>
    </div>
  );
}
