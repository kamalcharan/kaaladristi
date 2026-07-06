/**
 * Big Money day detection (POA Phase 3).
 *
 * A Big Money day = a session where DELIVERED value (shares actually taken
 * home) ran far above the stock's own norm — a price zone where large money
 * changed hands. Detection is quantity-based (delivery_qty × close ÷ 10⁷)
 * because the stored deliv_value_cr / avg_amt_66d columns carry a 100×
 * scale bug (value_cr holds ₹÷100; engine divides by 10⁷ assuming rupees —
 * diagnosed with the owner 2026-07-07, pipeline fix tracked separately).
 *
 * Thresholds (owner-calibrated 2026-07-07):
 *  - MIN_RATIO = 5 — anchored by TARIL 19-Jun-2026: ₹240 Cr delivered vs a
 *    ₹40 Cr baseline = 6.0×. Liquid stocks carry big baselines, so high
 *    multiples are structurally rare — 8× would have missed the owner's own
 *    canonical event. Market-wide, ratio p97 ≈ 4.1, p99 ≈ 7.2.
 *  - MIN_DELIV_CR = 25 — absolute floor so microcap noise can't fire.
 *    PROVISIONAL pending the market-wide clean-units event count; adjust
 *    this one constant if the yearly event count runs hot.
 *
 * SEBI note: events are observations ("large money changed hands here"),
 * never support/resistance claims. The card reports the honest stat —
 * how often price has closed above the zone since — computed, not asserted.
 */

export const BIG_MONEY_MIN_RATIO = 5;
export const BIG_MONEY_MIN_DELIV_CR = 25;
const BASELINE_BARS = 66;
const BASELINE_MIN_BARS = 22; // no detection until the baseline has substance

interface DayRow {
  trade_date: string;
  close: number | null;
  low?: number | null;
  high?: number | null;
  volume?: number | null;
  delivery_qty?: number | null;
}

export interface BigMoneyEvent {
  trade_date: string;
  delivCr: number;      // delivered value that day, ₹ Cr
  ratio: number;        // vs the stock's own trailing 66-bar delivered norm
  low: number;          // event day's price range — the zone where money moved
  high: number;
  close: number;
  /** Honest aftermath stat: sessions since the event where close ≥ event low. */
  heldAbove: number;
  sessionsSince: number;
}

/** Delivered ₹ Cr from first principles. */
function delivCrOf(r: DayRow): number | null {
  if (r.delivery_qty == null || r.close == null) return null;
  return (r.delivery_qty * r.close) / 1e7;
}

/**
 * Detect Big Money days over a daily bar series (ascending by date).
 * Pure function — runs client-side over the chart's loaded rows.
 */
export function detectBigMoneyDays(rows: DayRow[]): BigMoneyEvent[] {
  const dv: (number | null)[] = rows.map(delivCrOf);
  const events: BigMoneyEvent[] = [];

  // Rolling baseline: mean of the PRIOR up-to-66 valid delivered values.
  let windowSum = 0;
  const window: number[] = [];

  for (let i = 0; i < rows.length; i++) {
    const value = dv[i];
    const baseline = window.length >= BASELINE_MIN_BARS ? windowSum / window.length : null;

    if (
      value != null && baseline != null && baseline > 0 &&
      value / baseline >= BIG_MONEY_MIN_RATIO &&
      value >= BIG_MONEY_MIN_DELIV_CR
    ) {
      const r = rows[i];
      if (r.low != null && r.high != null && r.close != null) {
        events.push({
          trade_date: r.trade_date,
          delivCr: value,
          ratio: value / baseline,
          low: r.low,
          high: r.high,
          close: r.close,
          heldAbove: 0,
          sessionsSince: 0,
        });
      }
    }

    if (value != null) {
      window.push(value);
      windowSum += value;
      if (window.length > BASELINE_BARS) windowSum -= window.shift()!;
    }
  }

  // Aftermath stat per event
  for (const ev of events) {
    const startIdx = rows.findIndex((r) => r.trade_date === ev.trade_date);
    let held = 0, total = 0;
    for (let i = startIdx + 1; i < rows.length; i++) {
      const c = rows[i].close;
      if (c == null) continue;
      total++;
      if (c >= ev.low) held++;
    }
    ev.heldAbove = held;
    ev.sessionsSince = total;
  }

  return events;
}
