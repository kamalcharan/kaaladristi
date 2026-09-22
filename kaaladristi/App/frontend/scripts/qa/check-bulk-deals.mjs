/**
 * Bulk & block deals — the two properties a type cannot see.
 *
 *   node scripts/qa/check-bulk-deals.mjs
 *
 * Exercises the REAL services/bulkDeals.ts (postgrest stubbed) against
 * fixtures taken verbatim from the live DB on 2026-09-22.
 *
 *   1. FEED DEDUP. One transaction is published in BOTH the bulk and the block
 *      file when it clears both thresholds. ENTERO 18-Sep is the measured
 *      case: HDFC Mutual Fund's 1,390,000-share buy appears once in each, and
 *      rendering both doubles a Rs 235.6 Cr deal into Rs 471 Cr. But presence
 *      is NOT the test — migration 217 has no unique constraint precisely
 *      because HDFC really did buy ASTERDM twice in one session under two
 *      schemes. Those are two rows in the SAME feed and both must survive, so
 *      the rule is per-feed COUNT (max across feeds), not set membership.
 *
 *   2. COVERAGE IS NOT ABSENCE. Collection is forward-only from 2026-09-17 —
 *      3 sessions and 89 stocks on the day this was written, so ~97% of stocks
 *      render empty. An empty card that says "no deals" is asserting something
 *      never measured. km_bulk_deal_days separates "looked, found nothing"
 *      (row present) from "never fetched" (row absent), and windowUncovered
 *      must follow the DAYS table, never the deals table — a stock with no
 *      deals on covered sessions is a measurement; a stock in an unfetched
 *      window is a gap.
 *
 * Verified to FAIL against: set-membership dedup (ASTERDM collapses), summing
 * feed counts (ENTERO doubles), no dedup at all, windowUncovered derived from
 * deals.length, and a hardcoded collection-start date.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

function load(rel, deps = {}) {
  const src = fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
  // ES2020 target matters: at the default target, `for...of` over a Map
  // iterator is downlevelled to an INDEXED loop, which silently yields
  // nothing because an iterator has no .length. That produced a green-looking
  // 0-result run before this line was added.
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  new Function('exports', 'require', js)(exports, (m) => deps[m] ?? {});
  return exports;
}

// Captured responses, keyed by table. fetchBulkDeals issues three queries.
let RESPONSES = {};
const builder = (table) => {
  const b = {};
  for (const m of ['select', 'eq', 'gte', 'lte', 'order', 'limit']) b[m] = () => b;
  b.execute = async () => RESPONSES[table] ?? { data: [], error: null };
  return b;
};

const { dedupeAcrossFeeds, fetchBulkDeals } = load('../../src/services/bulkDeals.ts', {
  './postgrest': { from: builder },
});

const deal = (o) => ({
  deal_date: '2026-09-18', day_0_trade_date: '2026-09-21',
  deal_type: 'BULK', client_name: 'X', buy_sell: 'BUY',
  quantity: 100, price: 10, ...o,
});

let pass = 0;
const ok = (name) => { pass++; console.log(`  ✓ ${name}`); };

// ── 1. ENTERO: one transaction, two feeds ────────────────────────────────
// Verbatim from km_bulk_deals, ids 1389/1592 (BULK + BLOCK).
{
  const entero = [
    deal({ deal_type: 'BULK',  client_name: 'HDFC MUTUAL FUND', quantity: 1390000, price: 1695 }),
    deal({ deal_type: 'BLOCK', client_name: 'HDFC MUTUAL FUND', quantity: 1390000, price: 1695 }),
    deal({ deal_type: 'BULK',  client_name: 'PRASID UNO FAMILY TRUST', buy_sell: 'SELL', quantity: 1221820, price: 1695 }),
    deal({ deal_type: 'BLOCK', client_name: 'PRASID UNO FAMILY TRUST', buy_sell: 'SELL', quantity: 1221820, price: 1695 }),
    // Below the 0.5% bulk line (0.386%), so BLOCK only — this asymmetry is real.
    deal({ deal_type: 'BLOCK', client_name: 'PRASID UNOFAMILY TRUST', buy_sell: 'SELL', quantity: 168180, price: 1695 }),
  ];
  const out = dedupeAcrossFeeds(entero);
  assert.equal(out.length, 3, `ENTERO must collapse to 3 legs, got ${out.length}`);

  const buy = out.find((d) => d.side === 'BUY');
  assert.deepEqual(buy.feeds, ['BULK', 'BLOCK'], 'buy leg must record both feeds');
  assert.ok(Math.abs(buy.valueCr - 235.605) < 0.01, `buy must be ~235.6 Cr, got ${buy.valueCr}`);

  const solo = out.find((d) => d.quantity === 168180);
  assert.deepEqual(solo.feeds, ['BLOCK'], 'sub-0.5% leg is block-only');

  // The sell side must still total the buy side — the property that proved
  // the quantities were right in the first place.
  const sold = out.filter((d) => d.side === 'SELL').reduce((a, d) => a + d.quantity, 0);
  assert.equal(sold, buy.quantity, 'sell legs must sum to the buy leg');
  ok('ENTERO: 5 rows across two feeds collapse to 3 legs, sides balance');
}

// ── 2. ASTERDM: two genuine deals in ONE feed must both survive ──────────
{
  const twice = [
    deal({ client_name: 'HDFC MUTUAL FUND', quantity: 500, price: 100 }),
    deal({ client_name: 'HDFC MUTUAL FUND', quantity: 500, price: 100 }),
  ];
  const out = dedupeAcrossFeeds(twice);
  assert.equal(out.length, 2, `same-feed repeat must survive as 2 legs, got ${out.length}`);
  ok('ASTERDM: identical same-feed pair survives as two legs');
}

// ── 3. Both at once: 2 in each feed is 2 legs, not 1 and not 4 ───────────
{
  const out = dedupeAcrossFeeds([
    deal({ deal_type: 'BULK',  quantity: 500 }), deal({ deal_type: 'BULK',  quantity: 500 }),
    deal({ deal_type: 'BLOCK', quantity: 500 }), deal({ deal_type: 'BLOCK', quantity: 500 }),
  ]);
  assert.equal(out.length, 2, `max-across-feeds must give 2 legs, got ${out.length}`);
  assert.deepEqual(out[0].feeds, ['BULK', 'BLOCK']);
  ok('count is max across feeds, never the sum and never presence');
}

// ── 4. A window nobody fetched is a GAP, not an absence ──────────────────
{
  RESPONSES = {
    km_bulk_deals: { data: [], error: null },
    km_bulk_deal_days: { data: [], error: null },
  };
  const r = await fetchBulkDeals(390, '2024-01-01', '2024-06-30');
  assert.equal(r.deals.length, 0);
  assert.equal(r.coverage.windowUncovered, true, 'unfetched window must report uncovered');
  assert.equal(r.coverage.sessionsCovered, 0);
  ok('unfetched window reports windowUncovered, not a quiet stock');
}

// ── 5. A covered window with no deals is a real measurement ──────────────
{
  RESPONSES = {
    km_bulk_deals: { data: [], error: null },
    km_bulk_deal_days: { data: [{ deal_date: '2026-09-17' }, { deal_date: '2026-09-18' }], error: null },
  };
  const r = await fetchBulkDeals(390, '2026-09-15', '2026-09-22');
  assert.equal(r.coverage.windowUncovered, false, 'covered window must not read as a gap');
  assert.equal(r.coverage.sessionsCovered, 2);
  assert.equal(r.coverage.collectionStart, '2026-09-17', 'start must come from the days table');
  ok('covered window with no deals is a measurement, with its denominator');
}

// ── 6. A FAILED request must never read as "no deals" ────────────────────
{
  RESPONSES = {
    km_bulk_deals: { data: null, error: new Error('boom') },
    km_bulk_deal_days: { data: [{ deal_date: '2026-09-17' }], error: null },
  };
  const r = await fetchBulkDeals(390, '2026-09-15', '2026-09-22');
  assert.equal(r.deals.length, 0, 'failed request yields no deals');
  assert.equal(r.coverage.collectionStart, '2026-09-17', 'coverage still reported on failure');
  ok('failed deals request does not fabricate an empty-but-covered reading');
}

// ── 7. % of equity is omitted, never guessed ─────────────────────────────
{
  RESPONSES = {
    km_bulk_deals: { data: [deal({ quantity: 1390000, price: 1695 })], error: null },
    km_bulk_deal_days: { data: [{ deal_date: '2026-09-18' }], error: null },
  };
  const none = await fetchBulkDeals(390, '2026-09-15', '2026-09-22', null);
  assert.equal(none.deals[0].pctOfEquity, null, 'no share count => no percentage');

  const known = await fetchBulkDeals(390, '2026-09-15', '2026-09-22', 43523072);
  assert.ok(Math.abs(known.deals[0].pctOfEquity - 3.193) < 0.01,
    `ENTERO must read 3.19% of equity, got ${known.deals[0].pctOfEquity}`);
  ok('percent-of-equity omitted without a share count, 3.19% with one');
}

console.log(`\n✓ bulk deals: ${pass} checks passed`);
