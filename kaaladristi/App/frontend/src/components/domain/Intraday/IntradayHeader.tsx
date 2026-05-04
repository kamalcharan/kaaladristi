/**
 * IntradayHeader
 * ==============
 * Cycle 2 — symbol + last close + IST clock. Rahu/Abhijit pills land
 * in Cycle 3 (driven by km_daily_panchang.rahu_kala_start/end).
 */

import { useEffect, useState } from 'react';

interface IntradayHeaderProps {
  symbolName: string;
  lastClose: number | null;
  pctChng: number | null;
  tradeDate: string;
  isHoliday: boolean;
}

function formatIstClock(d: Date): string {
  const ist = new Date(d.getTime() + (5.5 * 60 * 60 * 1000));
  const h = String(ist.getUTCHours()).padStart(2, '0');
  const m = String(ist.getUTCMinutes()).padStart(2, '0');
  const s = String(ist.getUTCSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function IntradayHeader({
  symbolName, lastClose, pctChng, tradeDate, isHoliday,
}: IntradayHeaderProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const upColor = pctChng !== null && pctChng >= 0
    ? 'var(--risk-green)' : 'var(--risk-red)';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
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

      {/* Holiday badge */}
      {isHoliday && (
        <span style={{
          fontFamily: 'var(--font-mono, monospace)', fontSize: 10,
          padding: '2px 8px', borderRadius: 3,
          background: 'var(--risk-amber-dim, rgba(245,158,11,0.15))',
          color: 'var(--risk-amber)',
          letterSpacing: '0.08em',
        }}>⊘ NON-WORKING</span>
      )}

      {/* IST clock */}
      <span style={{
        fontFamily: 'var(--font-mono, monospace)', fontSize: 14,
        color: 'var(--accent-gold, #C9A84C)', letterSpacing: '0.1em',
      }}>{formatIstClock(now)} IST</span>
    </div>
  );
}
