/**
 * BigMoneyCard — Study cockpit rail (POA Phase 3).
 * Sessions where delivered value ran ≥5× the stock's own 66-day norm
 * (≥₹25 Cr absolute) — zones where large money changed hands. Observational
 * only: the aftermath stat is computed history, not a support claim.
 */

import { Landmark } from 'lucide-react';
import {
  BIG_MONEY_MIN_RATIO,
  BIG_MONEY_MIN_DELIV_CR,
  type BigMoneyEvent,
  type BigMoneyDirection,
} from '@/services/bigMoney';

const DIRECTION_BADGE: Record<BigMoneyDirection, { label: string; color: string; bg: string }> = {
  entry: { label: 'Entry footprint', color: 'var(--bull, #22c55e)', bg: 'rgba(34,197,94,0.12)' },
  exit:  { label: 'Exit footprint',  color: 'var(--bear, #ef4444)', bg: 'rgba(239,68,68,0.12)' },
  mixed: { label: 'Mixed',           color: 'var(--gold, #d4a84b)', bg: 'rgba(212,168,75,0.12)' },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDay(d: string): string {
  const dt = new Date(d + 'T00:00:00');
  return `${String(dt.getDate()).padStart(2, '0')} ${MONTHS[dt.getMonth()]} ${String(dt.getFullYear()).slice(2)}`;
}

export default function BigMoneyCard({ events }: { events: BigMoneyEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg bg-kd-card border border-kd-border p-3">
        <div className="flex items-center gap-2 mb-1">
          <Landmark className="w-3.5 h-3.5" style={{ color: 'var(--gold, #d4a84b)' }} />
          <span className="text-[11px] font-serif font-semibold text-primary tracking-wide">
            Big Money Days
          </span>
        </div>
        <p className="text-[9px] text-muted leading-snug">
          No big-money days in this window — delivered value never reached
          {' '}≥{BIG_MONEY_MIN_RATIO}× this stock's 66-day norm and ≥₹{BIG_MONEY_MIN_DELIV_CR} Cr.
          These are structurally rare, and stocks without delivery data (most BSE-only scrips)
          won't register any.
        </p>
      </div>
    );
  }

  const shown = [...events].reverse().slice(0, 6); // newest first

  return (
    <div className="rounded-lg bg-kd-card border border-kd-border p-3">
      <div className="flex items-center gap-2 mb-1">
        <Landmark className="w-3.5 h-3.5" style={{ color: 'var(--gold, #d4a84b)' }} />
        <span className="text-[11px] font-serif font-semibold text-primary tracking-wide">
          Big Money Days
        </span>
        <span className="ml-auto text-[9px] font-mono text-muted">{events.length}</span>
      </div>
      <p className="text-[9px] text-muted leading-snug mb-2.5">
        Delivered value ≥{BIG_MONEY_MIN_RATIO}× this stock's 66-day norm and ≥₹{BIG_MONEY_MIN_DELIV_CR} Cr —
        price zones where large money changed hands. Marked ₹ on the chart. Footprint is inferred
        from how price absorbed the handover (delivery itself is two-sided).
      </p>

      <div className="flex flex-col gap-2">
        {shown.map((ev) => (
          <div key={ev.trade_date} className="rounded-md bg-kd-elevated border border-kd-border px-2.5 py-1.5">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-[10px] font-mono text-[var(--text-secondary)]">{fmtDay(ev.trade_date)}</span>
              <span className="text-[11px] font-mono font-bold" style={{ color: DIRECTION_BADGE[ev.direction].color }}>
                ₹{ev.delivCr >= 100 ? ev.delivCr.toFixed(0) : ev.delivCr.toFixed(1)} Cr
              </span>
              <span
                className="text-[8.5px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{ color: DIRECTION_BADGE[ev.direction].color, background: DIRECTION_BADGE[ev.direction].bg }}
              >
                {DIRECTION_BADGE[ev.direction].label}
              </span>
              <span className="text-[9.5px] font-mono text-muted">{ev.ratio.toFixed(1)}× norm</span>
              <span className="ml-auto text-[9.5px] font-mono text-muted">
                zone ₹{ev.low.toFixed(0)}–{ev.high.toFixed(0)}
              </span>
            </div>
            {ev.sessionsSince > 0 && (
              <div className="text-[9px] text-muted mt-0.5">
                closed above the zone in {ev.heldAbove} of {ev.sessionsSince} sessions since
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
