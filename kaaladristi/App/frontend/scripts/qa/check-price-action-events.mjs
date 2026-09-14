/**
 * Phase 2 contract — the six Price Action scanners, derived on read.
 *
 *   node scripts/qa/check-price-action-events.mjs
 *
 * Exercises the real priceActionEvents + buildStoryEvents against synthetic
 * bars shaped from measured live data. Three regression classes, none of which
 * a type can see and all three of which are the natural way to write this:
 *
 *   1. A naive sign-change test on pct_wtd / pct_mtd fires a PHANTOM crossing on
 *      the first bar of every period, where the two sides are measured against
 *      different reference prices. Measured on SOLARA over 123 bars: 17 of 35
 *      weekly sign changes and 3 of 17 monthly are phantom.
 *   2. Treating a NULL as zero manufactures a crossing on the first bar that
 *      has data at all.
 *   3. Repeated crossings inside one period turn an oscillation into a daily
 *      event. On SOLARA this is 6 of 14 surviving monthly events.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

function load(rel, deps = {}) {
  const src = fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  new Function('exports', 'require', js)(exports, (m) => deps[m] ?? {});
  return exports;
}

const { priceActionEvents } = load('../../src/services/priceActionEvents.ts');
const { buildStoryEvents, KIND_COLORS } = load('../../src/services/storyEvents.ts', {
  './priceActionEvents': { priceActionEvents },
});

const titles = (evs) => evs.map((e) => e.title);
const pa = (bars) => priceActionEvents(bars);

/** A bar carrying only what the Price Action derivation reads. */
const bar = (trade_date, o = {}) => ({ trade_date, close: 100, ...o });

// ── 1. The reference-reset guard ───────────────────────────────────────────
// Mon 2026-09-07 opens a new week: prev_week_close moves 95 → 103 and pct_wtd
// resets from +8.4 to -1.9. Nothing crossed; the yardstick changed.
const rollover = [
  bar('2026-09-03', { prev_week_close: 95, pct_wtd: 6.3 }),
  bar('2026-09-04', { prev_week_close: 95, pct_wtd: 8.4 }),
  bar('2026-09-07', { prev_week_close: 103, pct_wtd: -1.9 }),
  bar('2026-09-08', { prev_week_close: 103, pct_wtd: -2.4 }),
];
assert.deepEqual(pa(rollover), [],
  'a sign change across a period rollover is a PHANTOM — the reference moved, '
  + 'not the stock. This is the single most important assertion in this file.');

// The same shape WITHIN one week is a real crossing and must fire.
const realCross = [
  bar('2026-09-08', { prev_week_close: 103, pct_wtd: -2.4 }),
  bar('2026-09-09', { prev_week_close: 103, pct_wtd: 1.6 }),
];
let evs = pa(realCross);
assert.deepEqual(titles(evs), ['Above last week’s close']);
assert.equal(evs[0].barIndex, 1);
assert.match(evs[0].detail, /₹103/, 'the detail must name the reference it crossed');
assert.match(evs[0].detail, /\+1\.60%/);
assert.equal(evs[0].tone, 'bull');

// Monthly rollover is the same trap on a different column.
assert.deepEqual(pa([
  bar('2026-08-29', { prev_month_close: 80, pct_mtd: 12.0 }),
  bar('2026-09-01', { prev_month_close: 90, pct_mtd: -0.8 }),
]), [], 'prev_month_close moving is a rollover, not a crossing');

// ── 2. NULL is not zero ────────────────────────────────────────────────────
assert.deepEqual(pa([
  bar('2026-09-08', { prev_week_close: 103, pct_wtd: null }),
  bar('2026-09-09', { prev_week_close: 103, pct_wtd: 1.6 }),
]), [], 'an absent previous value is unmeasured, never "was negative"');

assert.deepEqual(pa([
  bar('2026-09-08', { prev_week_close: null, pct_wtd: -2.4 }),
  bar('2026-09-09', { prev_week_close: null, pct_wtd: 1.6 }),
]), [], 'with no reference stored, a crossing cannot be told from a rollover');

assert.deepEqual(pa([
  bar('2026-09-08', {}),
  bar('2026-09-09', {}),
]), [], 'bars carrying none of the columns produce nothing');

// ── 3. One crossing per period per direction ───────────────────────────────
// A stock oscillating around last month's close. Four upward crossings inside
// September; only the first is news.
const oscillate = [
  bar('2026-09-01', { prev_month_close: 100, pct_mtd: -1 }),
  bar('2026-09-02', { prev_month_close: 100, pct_mtd: 1 }),
  bar('2026-09-03', { prev_month_close: 100, pct_mtd: -1 }),
  bar('2026-09-04', { prev_month_close: 100, pct_mtd: 2 }),
  bar('2026-09-07', { prev_month_close: 100, pct_mtd: -2 }),
  bar('2026-09-08', { prev_month_close: 100, pct_mtd: 3 }),
];
evs = pa(oscillate);
assert.deepEqual(titles(evs),
  ['Above last month’s close', 'Below last month’s close'],
  'one crossing per direction per period — six raw crossings collapse to two');
assert.equal(evs[0].barIndex, 1);
assert.equal(evs[1].barIndex, 2);

// A NEW month re-arms both directions.
const twoMonths = [
  bar('2026-09-29', { prev_month_close: 100, pct_mtd: -1 }),
  bar('2026-09-30', { prev_month_close: 100, pct_mtd: 1 }),
  bar('2026-10-01', { prev_month_close: 101, pct_mtd: -1 }),
  bar('2026-10-05', { prev_month_close: 101, pct_mtd: 2 }),
];
assert.deepEqual(titles(pa(twoMonths)),
  ['Above last month’s close', 'Above last month’s close'],
  'the dedup is scoped to the period — October gets its own crossing. '
  + '(01 Oct is the rollover and is correctly silent.)');

// Weeks are keyed by ISO week, not by calendar date, so Fri → Mon is two keys.
assert.deepEqual(titles(pa([
  bar('2026-09-10', { prev_week_close: 100, pct_wtd: -1 }),
  bar('2026-09-11', { prev_week_close: 100, pct_wtd: 1 }),
  bar('2026-09-14', { prev_week_close: 100, pct_wtd: -1 }),
  bar('2026-09-15', { prev_week_close: 100, pct_wtd: 1 }),
])), ['Above last week’s close', 'Below last week’s close', 'Above last week’s close'],
  'a new ISO week re-arms the direction even when prev_week_close happens to '
  + 'be unchanged — otherwise a flat reference silently merges two weeks');

// ── 4. Breakout / breakdown are edge-triggered on the matview's own rule ───
// SOLARA 2026-05-15: +14.22% day, 10.13% above its 20-day high.
const breakout = [
  bar('2026-05-14', { pct_chng: -0.5, pct_from_breakout: -1.2, breakout_level: 500 }),
  bar('2026-05-15', { pct_chng: 14.22, pct_from_breakout: 10.13, breakout_level: 500 }),
  bar('2026-05-16', { pct_chng: 1.0, pct_from_breakout: 11.0, breakout_level: 500 }),
];
evs = pa(breakout);
assert.deepEqual(titles(evs), ['Cleared the 20-day high'], 'the ENTRY fires, not every day held');
assert.equal(evs[0].barIndex, 1);
assert.match(evs[0].detail, /\+10\.13% above the 20-day high of ₹500/);
assert.match(evs[0].detail, /\+14\.22% day/);

// BOTH legs are required — an up day below the level, or a down day above it,
// is not the scanner's condition.
assert.deepEqual(pa([
  bar('2026-05-14', { pct_chng: -0.5, pct_from_breakout: -1.2 }),
  bar('2026-05-15', { pct_chng: 2.0, pct_from_breakout: -0.4 }),
]), [], 'above-zero pct_chng alone does not clear the 20-day high');
assert.deepEqual(pa([
  bar('2026-05-14', { pct_chng: -0.5, pct_from_breakout: -1.2 }),
  bar('2026-05-15', { pct_chng: -2.0, pct_from_breakout: 0.4 }),
]), [], 'the matview requires an UP day — a breakout is cleared on strength');

// Breakdown is the mirror, and tones bear.
evs = pa([
  bar('2026-05-14', { pct_chng: 0.5, pct_from_breakdown: 1.2, breakdown_level: 400 }),
  bar('2026-05-15', { pct_chng: -3.1, pct_from_breakdown: -2.4, breakdown_level: 400 }),
]);
assert.deepEqual(titles(evs), ['Broke the 20-day low']);
assert.equal(evs[0].tone, 'bear');
assert.match(evs[0].detail, /-2\.40% below the 20-day low of ₹400/);

// An unmeasured first bar must not read as "was outside the state".
assert.deepEqual(pa([
  bar('2026-05-14', { pct_chng: null, pct_from_breakout: null }),
  bar('2026-05-15', { pct_chng: 2.0, pct_from_breakout: 1.0 }),
]), [], 'the first MEASURED bar of a state is not a fresh entry');

// ── 5. Re-entries are emitted faithfully — no cooldown ─────────────────────
// SOLARA cleared its 20-day high five times in fifteen days. A cooldown was
// considered and REJECTED: across a 1-in-37 NSE sample (566 entries) the gap
// distribution is 12.5% / 9.2% / 20.8% / 40.8% with no cliff, so any N would
// be taste. Density is paid for by priority instead — assert both halves.
const reentry = [
  bar('2026-04-01', { pct_chng: -1, pct_from_breakout: -1 }),
  bar('2026-04-02', { pct_chng: 3.7, pct_from_breakout: 2.13 }),
  bar('2026-04-03', { pct_chng: -1, pct_from_breakout: -0.5 }),
  bar('2026-04-08', { pct_chng: 2.99, pct_from_breakout: 1.49 }),
];
assert.equal(pa(reentry).length, 2, 'a genuine re-entry is a second event, not a duplicate');

// ── 6. Integration: through buildStoryEvents, at the bottom of the pile ────
const full = buildStoryEvents([
  { trade_date: '2026-05-14', close: 100, pct_chng: -0.5, pct_from_breakout: -1.2 },
  { trade_date: '2026-05-15', close: 114, pct_chng: 14.22, pct_from_breakout: 10.13, breakout_level: 500 },
  { trade_date: '2026-05-16', close: 115 },
]);
const paEvs = full.filter((e) => e.kind === 'price_action');
assert.equal(paEvs.length, 1, 'the derived event reaches buildStoryEvents');
assert.equal(paEvs[0].date, '2026-05-15', 'and is dated to its own bar');
assert.ok(paEvs[0].reactionPct !== undefined, 'it goes through the same add() — so it carries a reaction');

const other = full.find((e) => e.kind !== 'price_action');
if (other) assert.ok(other.priority > paEvs[0].priority);
assert.ok(KIND_COLORS.price_action, 'the kind must carry a colour token');
assert.match(KIND_COLORS.price_action, /^var\(--/, 'theme token, never a literal');

// Every other kind outranks price_action, so it can never displace one.
const PRIORITIES = fs.readFileSync(new URL('../../src/services/storyEvents.ts', import.meta.url), 'utf8')
  .match(/const PRIORITY: Record<StoryKind, number> = \{([\s\S]*?)\n\}/)[1];
const nums = [...PRIORITIES.matchAll(/^\s*(\w+):\s*([\d.]+),/gm)].map(([, k, v]) => [k, Number(v)]);
const paPri = nums.find(([k]) => k === 'price_action')[1];
assert.ok(nums.every(([k, v]) => k === 'price_action' || v > paPri),
  'price_action must be the LOWEST priority — that is how an uncapped event '
  + 'stream is kept from burying the journey milestones');

// ── 7. The naming trap must stay fixed ─────────────────────────────────────
// is_vani_surge is a 52-WEEK-high + volume flag; the Breakout Surge SCANNER is
// 20-day-high geometry. Titling the flag "Breakout surge" put the scanner's
// name on a different rule, on the same chart that now draws the real one.
const storySrc = fs.readFileSync(new URL('../../src/services/storyEvents.ts', import.meta.url), 'utf8');
const flagBlock = storySrc.match(/const SCAN_FLAGS[\s\S]*?\n\]/)[0];
assert.ok(!/Breakout surge|Fresh breakout/i.test(flagBlock),
  'the is_vani_* flags must not be titled after the Breakout Surge scanner');
assert.match(flagBlock, /52-week high/, 'they are titled for what they measure');

// ── 8. The Thesis list must trim by priority, not recency ──────────────────
// Phase 2 turns a rare event stream into a dense one: 22 Price Action events on
// SOLARA's last 74 bars against 4 of everything else. `slice(-8)` was a pure
// recency cut, which was safe only while every kind was rare — it would now
// fill all eight rows with "above last week's close" and evict the Big Money
// day, the stage change and the journey confirmation. The tab's headline
// sentence reads signals[0], so it would degrade too.
const thesisSrc = fs.readFileSync(new URL('../../src/services/thesis.ts', import.meta.url), 'utf8');
const trim = thesisSrc.match(
  /signals = \[\.\.\.signals\]\s*\n(\s*\.[^\n]*\n)+/);
assert.ok(trim, 'the signal list must be trimmed explicitly, not by a bare slice');
const steps = trim[0].match(/\.\w+\(/g).map((x) => x.slice(1, -1));
assert.deepEqual(steps, ['sort', 'slice', 'sort'],
  'the trim is exactly: rank, cut, restore order — three steps, in that order');
assert.match(trim[0], /\.sort\(\(a, b\) => b\.priority - a\.priority[\s\S]*?\)\s*\n\s*\.slice\(0, 8\)/,
  'selection must be priority-FIRST — the chart resolves a shared bar by '
  + 'priority via eventAtBar and this list needs the same rule');
assert.match(trim[0], /\.slice\(0, 8\)\s*\n\s*\.sort\(\(a, b\) => b\.barIndex - a\.barIndex\)/,
  'display order must be restored to recency AFTER the priority trim');
assert.ok(!/signals\.slice\(-8\)/.test(thesisSrc),
  'the pure-recency slice must be gone, not merely shadowed');

console.log('PASS: reference-reset guard on both period columns, NULL never read as zero, '
  + 'one crossing per period per direction with ISO-week keying, breakout/breakdown '
  + 'edge-triggered on both legs, faithful re-entries at bottom priority, '
  + 'Thesis list trims by priority, naming trap held');
