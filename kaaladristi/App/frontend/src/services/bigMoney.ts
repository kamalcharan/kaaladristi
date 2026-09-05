/**
 * Big Money days — READER over the stored km_equity_eod.bm_event / bm_ratio
 * columns (migration 200). This file used to DETECT them client-side; it no
 * longer does, and that is the point.
 *
 * A Big Money day is a session where DELIVERED value — shares actually taken
 * home, not day-traded — ran far above the stock's own norm. It marks a price
 * zone where large money changed hands.
 *
 * WHY DETECTION MOVED SERVER-SIDE
 *
 * The client version derived its own delivered value, its own baseline and its
 * own significance floor, none of which any other consumer could see. A
 * scanner could not filter on a Big Money day, the risk thesis could not read
 * one, and the numbers on the card were window-dependent — the same stock
 * produced a different set of events at 6M than at 1Y, because the top-2%
 * percentile was measured over whatever the chart had loaded. Detection now
 * lives in scripts/backfill_big_money.py and the nightly `big_money` pipeline
 * step, against a fixed prior-only 252-bar window, and every consumer reads
 * the same stored answer.
 *
 * Two numbers therefore moved slightly, both for the better:
 *   - delivered value is the stored VWAP-based deliv_value_cr, not
 *     delivery_qty × close (the 100× scale bug that forced the old
 *     first-principles workaround has been fixed in the pipeline);
 *   - the ratio is against the stored avg_amt_66d, the same 66-day delivered
 *     norm the rest of the platform uses.
 *
 * STILL COMPUTED HERE, deliberately: the aftermath stat. How often price has
 * closed above the zone SINCE an event changes every session for every past
 * event, so storing it would mean rewriting all history nightly. It is
 * arithmetic over the bars already loaded.
 *
 * SEBI note: events are observations ("large money changed hands here"), never
 * support/resistance claims. The card reports the honest stat — how often
 * price has closed above the zone since — computed, not asserted.
 */

/** Ratio gate the pipeline applies. Displayed in the card's explainer, so it
 *  must track BM_MIN_RATIO in scripts/backfill_big_money.py. */
export const BIG_MONEY_MIN_RATIO = 5;

interface DayRow {
  trade_date: string;
  close: number | null;
  low?: number | null;
  high?: number | null;
  deliv_value_cr?: number | null;
  /** Stored footprint — 'entry' | 'exit' | 'mixed', NULL on every other bar. */
  bm_event?: string | null;
  /** Stored delivered value as a multiple of this stock's own 66-day norm. */
  bm_ratio?: number | null;
}

/**
 * Direction is an INFERENCE, not a fact: delivery is two-sided by definition
 * (every delivered share had a buyer and a seller). What price told us is how
 * the handover was absorbed — the pipeline classifies it and stores the verdict:
 *   entry — up day closing in the top of its range: buyers paid up
 *   exit  — down day closing in the bottom of its range: holders sold down
 *   mixed — large ownership change with no clear price verdict
 */
export type BigMoneyDirection = 'entry' | 'exit' | 'mixed';

const DIRECTIONS: BigMoneyDirection[] = ['entry', 'exit', 'mixed'];

function asDirection(v: string | null | undefined): BigMoneyDirection | null {
  return v != null && (DIRECTIONS as string[]).includes(v) ? (v as BigMoneyDirection) : null;
}

export interface BigMoneyEvent {
  trade_date: string;
  direction: BigMoneyDirection;
  delivCr: number;      // delivered value that day, ₹ Cr (stored, VWAP-based)
  ratio: number;        // vs the stock's own 66-day delivered norm (stored)
  low: number;          // event day's price range — the zone where money moved
  high: number;
  close: number;
  /** Honest aftermath stat: sessions since the event where close ≥ event low. */
  heldAbove: number;
  sessionsSince: number;
}

/**
 * Read the Big Money days out of a daily bar series (ascending by date).
 * Pure function — no detection, only projection plus the read-time aftermath.
 *
 * A series whose rows carry no bm_event (an index, a resampled weekly bar, or
 * a deployment where migration 200 has not been applied) yields an empty list,
 * which the card renders as its honest empty state.
 */
export function readBigMoneyDays(rows: DayRow[]): BigMoneyEvent[] {
  const events: BigMoneyEvent[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const direction = asDirection(r.bm_event);
    if (direction == null) continue;
    // The zone IS the bar's own range, so a row missing it cannot be shown as
    // an event even though the pipeline flagged it.
    if (r.low == null || r.high == null || r.close == null) continue;

    let held = 0;
    let total = 0;
    for (let j = i + 1; j < rows.length; j++) {
      const c = rows[j].close;
      if (c == null) continue;
      total++;
      if (c >= r.low) held++;
    }

    events.push({
      trade_date: r.trade_date,
      direction,
      delivCr: r.deliv_value_cr ?? 0,
      ratio: r.bm_ratio ?? 0,
      low: r.low,
      high: r.high,
      close: r.close,
      heldAbove: held,
      sessionsSince: total,
    });
  }

  return events;
}
