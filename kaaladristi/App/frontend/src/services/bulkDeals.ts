/**
 * Bulk & block deals — READER over km_bulk_deals / km_bulk_deal_days
 * (migration 217). The companion to Big Money days, and deliberately NOT the
 * same measurement.
 *
 * WHY BOTH EXIST
 *
 * Big Money reads DELIVERED VALUE from the bhavcopy: an anonymous, aggregate
 * footprint of ownership changing hands. It covers every stock and every bar,
 * and it never names anyone.
 *
 * A bulk/block deal is a NAMED transaction disclosed because it crossed a
 * regulatory line — >0.5% of listed equity in a session (bulk), or a block-
 * window trade (block). `client_name` is the reason the table exists.
 *
 * They overlap far less than you would guess. Measured 2026-09-22 over the
 * three sessions where both datasets exist: 122 bulk-deal stock-days, 108 Big
 * Money stock-days, only 29 in both. Two reasons, and both matter here:
 *
 *   1. Most bulk deals are CHURN, not accumulation. 271 of 383 client-stock-
 *      days had the same client on BOTH sides of the same session (prop desks
 *      round-tripping). GLASSWALL on 18-Sep carried Rs 757 Cr of disclosed
 *      deals while delivering 0.8x its own norm.
 *   2. Block-window trades appear to sit OUTSIDE the bhavcopy entirely, so
 *      Big Money is structurally blind to them. ENTERO 18-Sep: HDFC Mutual
 *      Fund bought 3.19% of the company for Rs 235.6 Cr, and the day's
 *      reported volume was 244,661 shares — 5.68x SMALLER than the deal.
 *      Delivered value that day was 1.3x norm, nowhere near the 5x gate.
 *
 * So a named institutional buy can be completely invisible to Big Money. That
 * is the value this card adds, and why it is its own card rather than a badge.
 *
 * ── TWO RULES THIS FILE ENFORCES ──────────────────────────────────────────
 *
 * DEDUP ACROSS FEEDS. One transaction is published in BOTH the bulk and the
 * block file when it clears both thresholds, with identical date/client/side/
 * quantity. Rendering both is double-counting. We collapse them and show which
 * feeds carried it. `deal_type` is therefore NOT execution venue — ENTERO's
 * block-window trade is in the bulk file too, because it also exceeded 0.5%.
 *
 * COVERAGE IS NOT OPTIONAL. Collection is FORWARD-ONLY from the first ingest
 * (2026-09-17); there is no history and no backfill, because the NSE CSV holds
 * one session and the JSON API caps at 70 rows. On 2026-09-22 that is 3
 * sessions and 89 stocks ever seen — so ~97% of stocks render empty, and that
 * emptiness means "we were not collecting", NOT "nothing happened". An empty
 * card that cannot tell those apart is the fpbEvents starvation bug again.
 * `km_bulk_deal_days` exists precisely to separate them: a row with
 * row_count 0 is "we looked, the market was quiet"; an ABSENT row is "never
 * fetched". Callers must render the coverage line in both states.
 */

import { from } from './postgrest';

/** First session the ingest ever collected. Read from km_bulk_deal_days at
 *  runtime — never hardcode it, it moves backwards only if a backfill lands. */
export interface BulkDealCoverage {
  /** Sessions inside the requested window that were actually fetched. */
  sessionsCovered: number;
  /** Earliest session ever collected, across all history. */
  collectionStart: string | null;
  /** True when no session in the window was ever fetched. */
  windowUncovered: boolean;
}

export type DealSide = 'BUY' | 'SELL';

export interface BulkDeal {
  dealDate: string;
  /** The session the market could first act on it (NSE publishes post-close). */
  day0: string | null;
  clientName: string;
  side: DealSide;
  quantity: number;
  price: number;
  valueCr: number;
  /** Which disclosure files carried this one transaction. */
  feeds: ('BULK' | 'BLOCK')[];
  /** Percent of listed equity, only when shares outstanding is known. */
  pctOfEquity: number | null;
}

export interface BulkDealsResult {
  deals: BulkDeal[];
  coverage: BulkDealCoverage;
}

interface DealRow {
  deal_date: string;
  day_0_trade_date: string | null;
  deal_type: string;
  client_name: string;
  buy_sell: string;
  quantity: number | string | null;
  price: number | string | null;
}

function num(v: number | string | null | undefined): number {
  const n = typeof v === 'string' ? Number(v) : v;
  return n == null || Number.isNaN(n) ? 0 : n;
}

/**
 * Collapse the same transaction appearing in both disclosure files.
 * Key is (date, client, side, quantity) — NOT including price, because the two
 * files can carry the weighted-average to different precision.
 *
 * Note this deliberately does NOT collapse two genuine same-day deals by one
 * client at the same size: migration 217's header records that HDFC Mutual
 * Fund really did buy ASTERDM twice in one session under two schemes, and the
 * table has no unique constraint for exactly that reason. Those arrive as two
 * rows in the SAME feed, so the per-feed COUNT — not mere presence — is what
 * decides how many legs survive.
 */
export function dedupeAcrossFeeds(rows: DealRow[]): Omit<BulkDeal, 'pctOfEquity'>[] {
  // key -> { row, countsByFeed }. The number of REAL legs behind a key is the
  // MAX count across feeds, not the sum: one transaction in two files is one
  // leg, but two identical transactions in the same file are two.
  const byKey = new Map<string, { row: DealRow; counts: Map<string, number> }>();

  for (const r of rows) {
    const key = `${r.deal_date}|${r.client_name}|${r.buy_sell}|${num(r.quantity)}`;
    let hit = byKey.get(key);
    if (!hit) {
      hit = { row: r, counts: new Map() };
      byKey.set(key, hit);
    }
    hit.counts.set(r.deal_type, (hit.counts.get(r.deal_type) ?? 0) + 1);
  }

  const out: Omit<BulkDeal, 'pctOfEquity'>[] = [];
  for (const { row, counts } of byKey.values()) {
    const feeds = new Set(counts.keys());
    const legs = Math.max(...counts.values());
    for (let i = 0; i < legs; i++) out.push(toDeal(row, feeds));
  }

  // Newest first, then largest.
  out.sort((a, b) =>
    a.dealDate === b.dealDate ? b.valueCr - a.valueCr : (a.dealDate < b.dealDate ? 1 : -1));
  return out;
}

function toDeal(r: DealRow, feeds: Set<string>): Omit<BulkDeal, 'pctOfEquity'> {
  const quantity = num(r.quantity);
  const price = num(r.price);
  return {
    dealDate: r.deal_date,
    day0: r.day_0_trade_date,
    clientName: r.client_name,
    side: r.buy_sell === 'SELL' ? 'SELL' : 'BUY',
    quantity,
    price,
    valueCr: (quantity * price) / 1e7,
    feeds: (['BULK', 'BLOCK'] as const).filter((f) => feeds.has(f)),
  };
}

/**
 * Deals for one equity between two dates, plus the honest coverage of that
 * window. `sharesOutstanding` is optional: when absent the percent-of-equity
 * column is omitted rather than guessed.
 */
export async function fetchBulkDeals(
  equityId: number,
  fromIso: string,
  toIso: string,
  sharesOutstanding?: number | null,
): Promise<BulkDealsResult> {
  const [dealsRes, daysRes, startRes] = await Promise.all([
    from('km_bulk_deals')
      .select('deal_date,day_0_trade_date,deal_type,client_name,buy_sell,quantity,price')
      .eq('equity_id', equityId)
      .gte('deal_date', fromIso)
      .lte('deal_date', toIso)
      .order('deal_date', { ascending: false })
      .execute(),
    from('km_bulk_deal_days')
      .select('deal_date')
      .gte('deal_date', fromIso)
      .lte('deal_date', toIso)
      .execute(),
    // Earliest session ever collected — the "we only started looking then" line.
    from('km_bulk_deal_days')
      .select('deal_date')
      .order('deal_date', { ascending: true })
      .limit(1)
      .execute(),
  ]);

  const dayRows = (daysRes.data ?? []) as { deal_date: string }[];
  const sessionsCovered = new Set(dayRows.map((d) => d.deal_date)).size;
  const startRows = (startRes.data ?? []) as { deal_date: string }[];

  const coverage: BulkDealCoverage = {
    sessionsCovered,
    collectionStart: startRows[0]?.deal_date ?? null,
    windowUncovered: sessionsCovered === 0,
  };

  // A failed request must not read as "no deals". Surface it as uncovered.
  if (dealsRes.error || !dealsRes.data) return { deals: [], coverage };

  const deals = dedupeAcrossFeeds(dealsRes.data as DealRow[]).map((d) => ({
    ...d,
    pctOfEquity:
      sharesOutstanding && sharesOutstanding > 0
        ? (d.quantity / sharesOutstanding) * 100
        : null,
  }));

  return { deals, coverage };
}
