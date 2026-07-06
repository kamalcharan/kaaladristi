/**
 * DeliveryVsTraded — Study cockpit rail widget (POA Phase 1.4).
 * Last 10 sessions: delivered value vs total traded value as paired bars,
 * delivery-% label, traded ₹ Cr on the right. High delivery = shares taken
 * home, not day-traded — conviction, not churn.
 */

import { BarChart3 } from 'lucide-react';

interface DayRow {
  trade_date: string;
  value_cr?: number | null;
  deliv_value_cr?: number | null;
  delivery_pct?: number | null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDay(d: string): string {
  const dt = new Date(d + 'T00:00:00');
  return `${String(dt.getDate()).padStart(2, '0')} ${MONTHS[dt.getMonth()]}`;
}

export default function DeliveryVsTraded({ rows }: { rows: DayRow[] }) {
  // rows arrive oldest-first from the chart fetch; take last 10, newest on top
  const days = rows.slice(-10).reverse().map((r) => {
    const traded = r.value_cr ?? null;
    const delivered =
      r.deliv_value_cr != null
        ? r.deliv_value_cr
        : traded != null && r.delivery_pct != null
          ? (traded * r.delivery_pct) / 100
          : null;
    const pctVal =
      r.delivery_pct != null
        ? r.delivery_pct
        : traded != null && traded > 0 && delivered != null
          ? (delivered / traded) * 100
          : null;
    return { date: r.trade_date, traded, delivered, pct: pctVal };
  });

  const valid = days.filter((d) => d.traded != null && d.traded > 0);
  if (valid.length === 0) return null;

  const maxTraded = Math.max(...valid.map((d) => d.traded!));

  return (
    <div className="rounded-lg bg-kd-card border border-kd-border p-3">
      <div className="flex items-center gap-2 mb-2.5">
        <BarChart3 className="w-3.5 h-3.5 text-accent-indigo" />
        <span className="text-[11px] font-serif font-semibold text-primary tracking-wide">
          Delivery vs Traded (10D)
        </span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mb-2">
        <span className="flex items-center gap-1.5 text-[9px] text-muted">
          <span className="inline-block w-2.5 h-2 rounded-sm" style={{ background: 'var(--accent-indigo, #6366f1)' }} />
          Delivered
        </span>
        <span className="flex items-center gap-1.5 text-[9px] text-muted">
          <span className="inline-block w-2.5 h-2 rounded-sm" style={{ background: 'rgba(148,163,184,0.45)' }} />
          Traded
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {days.map((d) => {
          const tradedW = d.traded != null ? Math.max(2, (d.traded / maxTraded) * 100) : 0;
          const delivW = d.delivered != null ? Math.max(1, (d.delivered / maxTraded) * 100) : 0;
          return (
            <div key={d.date} className="flex items-center gap-2">
              <span className="text-[9.5px] font-mono text-muted w-11 shrink-0">{fmtDay(d.date)}</span>
              <div className="flex-1 relative h-3.5 min-w-0">
                {/* traded (background bar) */}
                <div
                  className="absolute inset-y-0 left-0 rounded-sm"
                  style={{ width: `${tradedW}%`, background: 'rgba(148,163,184,0.28)' }}
                />
                {/* delivered (foreground bar) */}
                <div
                  className="absolute inset-y-0 left-0 rounded-sm"
                  style={{ width: `${delivW}%`, background: 'var(--accent-indigo, #6366f1)' }}
                />
              </div>
              <span className="text-[9.5px] font-mono text-[var(--text-secondary)] w-8 text-right shrink-0">
                {d.pct != null ? `${Math.round(d.pct)}%` : '—'}
              </span>
              <span className="text-[9.5px] font-mono text-muted w-14 text-right shrink-0">
                {d.traded != null ? `${d.traded.toFixed(1)} Cr` : '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
