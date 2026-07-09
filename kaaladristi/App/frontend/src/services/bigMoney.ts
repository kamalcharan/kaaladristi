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
 *
 * SELF-RELATIVE floor (owner decision 2026-07-09): the old flat ₹25 Cr floor
 * was mcap-blind — it silenced Big Money on every mid/small cap. Since this is
 * a PER-STOCK view, significance is judged against the stock's OWN history: a
 * day fires only if its delivered value also lands in the stock's own top
 * TOP_PCT of delivered days in the loaded window (plus a tiny absolute sanity
 * floor so near-zero-delivery names can't produce noise). No mcap lookup, no
 * fallback — a stock with no delivery data (most BSE scrips) simply produces
 * zero events, shown as the card's honest empty state.
 * TOP_PCT / ABS_SANITY_CR are PROVISIONAL — verify the per-stock event counts
 * against live data before trusting them (see LESSONS_LEARNED: check the
 * distribution before fixing a threshold).
 *
 * SEBI note: events are observations ("large money changed hands here"),
 * never support/resistance claims. The card reports the honest stat —
 * how often price has closed above the zone since — computed, not asserted.
 */

export const BIG_MONEY_MIN_RATIO = 5;
/** Self-relative floor: delivered value must be in the stock's own top 2% of
 *  delivered days in the loaded window. */
export const BIG_MONEY_TOP_PCT = 0.02;
/** Tiny absolute guard (₹ Cr) so near-zero-delivery stocks can't fire on noise. */
const ABS_SANITY_CR = 1;
const BASELINE_BARS = 66;
const BASELINE_MIN_BARS = 22; // no detection until the baseline has substance

interface DayRow {
  trade_date: string;
  close: number | null;
  low?: number | null;
  high?: number | null;
  volume?: number | null;
  delivery_qty?: number | null;
  pct_chng?: number | null;
}

/**
 * Direction is an INFERENCE, not a fact: delivery is two-sided by definition
 * (every delivered share had a buyer and a seller). What price tells us is
 * how the handover was absorbed:
 *   entry — up day closing in the top of its range: buyers paid up
 *   exit  — down day closing in the bottom of its range: holders sold down
 *   mixed — large ownership change with no clear price verdict
 */
export type BigMoneyDirection = 'entry' | 'exit' | 'mixed';

function classifyDirection(r: DayRow): BigMoneyDirection {
  const pct = r.pct_chng ?? null;
  const closePos =
    r.close != null && r.low != null && r.high != null && r.high > r.low
      ? (r.close - r.low) / (r.high - r.low)
      : null;
  if (pct != null && closePos != null) {
    if (pct > 0 && closePos >= 0.6) return 'entry';
    if (pct < 0 && closePos <= 0.4) return 'exit';
  }
  return 'mixed';
}

export interface BigMoneyEvent {
  trade_date: string;
  direction: BigMoneyDirection;
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

  // Self-relative floor: the stock's own top-TOP_PCT delivered value over the
  // loaded window. Descriptive (whole-window) percentile, paired with the
  // prior-only ratio gate below.
  const validDv = dv.filter((v): v is number => v != null).sort((a, b) => a - b);
  const selfFloor = validDv.length > 0
    ? Math.max(ABS_SANITY_CR, validDv[Math.min(validDv.length - 1, Math.floor(validDv.length * (1 - BIG_MONEY_TOP_PCT)))])
    : Infinity; // no delivery data → nothing can pass (honest empty state)

  // Rolling baseline: mean of the PRIOR up-to-66 valid delivered values.
  let windowSum = 0;
  const window: number[] = [];

  for (let i = 0; i < rows.length; i++) {
    const value = dv[i];
    const baseline = window.length >= BASELINE_MIN_BARS ? windowSum / window.length : null;

    if (
      value != null && baseline != null && baseline > 0 &&
      value / baseline >= BIG_MONEY_MIN_RATIO &&
      value >= selfFloor
    ) {
      const r = rows[i];
      if (r.low != null && r.high != null && r.close != null) {
        events.push({
          trade_date: r.trade_date,
          direction: classifyDirection(r),
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
