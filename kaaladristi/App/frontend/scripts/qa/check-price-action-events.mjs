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
const { buildStoryEvents, KIND_COLORS, storyCoverage, blindLeadingBars, STORY_WARMUP_BARS } = load('../../src/services/storyEvents.ts', {
  './priceActionEvents': { priceActionEvents },
  '../constants/signalScale': load('../../src/constants/signalScale.ts'),
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

// ── 6b. A window too short to look must not read as "nothing found" ────────
// fpbEvents returns [] on fewer than 61 bars. Until this, that was
// indistinguishable from a window with no coils in it — so the Thesis and VaNi
// reported "no coils", a claim about the STOCK made from a fact about the
// RANGE. Measured (1-in-23 NSE sample, 36 coil starts over a year): a 1M chart
// never evaluates Flower Pot once; a 3M chart reaches 2 of its 62 bars; a 6M
// chart loses 2 of 28 coil starts to its blind first 60.

const short = Array.from({ length: 20 }, (_, i) => ({ trade_date: `2026-08-${i + 1}`, close: 100 }));
let cov = storyCoverage(short);
assert.equal(cov.fpb, false, '20 bars cannot evaluate a 60-bar compression window');
assert.equal(cov.breakaway, true, 'but 20 bars IS enough for the 8-bar breakaway');
assert.equal(cov.missing.length, 1);
assert.match(cov.missing[0], /Flower Pot compression \(needs 60 prior bars, window has 20\)/,
  'the gap must state the requirement AND what it actually has — a bare '
  + '"not available" is the same silence in different words');

const tiny = [{ trade_date: '2026-08-01', close: 100 }];
assert.equal(storyCoverage(tiny).missing.length, 2, 'both derivations report');

// A long window CAN look — but only past its own blind head. Saying "no gap"
// there would be the same lie in a longer window: a coil in the opening weeks
// of an un-warmed 1-year chart is just as invisible as one on a 1M chart.
const long = Array.from({ length: 300 }, (_, i) => ({ trade_date: `d${i}`, close: 100 }));
cov = storyCoverage(long);
assert.equal(cov.fpb, true, '300 bars can evaluate compression somewhere');
assert.equal(cov.blind, 60, 'but its first 60 sessions are still unreachable');
assert.equal(cov.missing.length, 1, 'and a partial gap is still a gap');
assert.match(cov.missing[0], /first 60 sessions shown/);

assert.equal(blindLeadingBars(long), 60);
assert.equal(blindLeadingBars(short), 20, 'capped at what the window holds');

// ── 6c. Warm-up closes the blind head — and must not leak into the window ──
// The cure for the blind head is history the user never asked to see: fetch
// STORY_WARMUP_BARS bars BEFORE the display start, derive over all of them,
// render only the display window. Two things have to hold or the cure is
// worse than the disease — the prefix must be fully consumed (no gap left to
// report) and no event may escape from it into the window's indices.

assert.equal(STORY_WARMUP_BARS, 60,
  'the warm-up must be sized by the LONGEST lookback any derivation needs');

// A fully warmed window reports nothing missing at all.
const warmed = storyCoverage(long, 60);
assert.equal(warmed.bars, 240, 'coverage counts the DISPLAY window, not the prefix');
assert.equal(warmed.blind, 0, 'a full warm-up leaves no blind head');
assert.deepEqual(warmed.missing, [], 'and therefore nothing to disclaim');
assert.equal(blindLeadingBars(long, 60), 0);

// A PARTIAL warm-up must not be rounded up to "covered".
const half = storyCoverage(long, 25);
assert.equal(half.blind, 35, '25 of the 60 needed bars leaves 35 still blind');
assert.equal(half.missing.length, 1, 'and that remainder is still said');

// Events inside the prefix are DROPPED; events after it are REBASED so a
// returned barIndex still indexes the display window. Get this wrong and every
// marker on the chart lands 60 sessions away from the bar it describes — a
// failure that looks like a data bug, not an off-by-N.
const mkBar = (d, extra = {}) => ({ trade_date: d, close: 100, ...extra });
const withPrefix = [
  // prefix: a stage change the user must never see, it predates the window
  mkBar('2026-01-05', { stage: 'S2', stage_since: '2026-01-05' }),
  mkBar('2026-01-06'),
  // display window starts here
  mkBar('2026-05-14', { pct_chng: -0.5, pct_from_breakout: -1.2 }),
  mkBar('2026-05-15', { close: 114, pct_chng: 14.22, pct_from_breakout: 10.13, breakout_level: 500 }),
  mkBar('2026-05-16', { close: 115 }),
];
const rebased = buildStoryEvents(withPrefix, undefined, undefined, undefined, 2);
assert.ok(rebased.length > 0, 'the window still produces events');
assert.ok(rebased.every((e) => e.barIndex >= 0),
  'no event may carry a negative index — that is the prefix leaking through');
assert.ok(!rebased.some((e) => e.date < '2026-05-14'),
  'no event dated inside the prefix may survive: the user did not ask to see '
  + 'those sessions and cannot be shown a marker on a bar that is not rendered');
const display = withPrefix.slice(2);
for (const e of rebased) {
  assert.ok(e.barIndex < display.length,
    `barIndex ${e.barIndex} is past the end of the ${display.length}-bar display `
    + 'window — the events were dropped but never rebased, so every marker sits '
    + 'warmup sessions away from the bar it describes');
  assert.equal(e.date, display[e.barIndex].trade_date,
    'barIndex must index the DISPLAY window — bars.slice(warmup) — so the '
    + 'chart, the scrubber and the Thesis list all resolve the same bar');
}

// The same bars with no warm-up declared: the prefix event now appears, at its
// own absolute index. This is the control — it proves the drop above was the
// warmup argument doing work, not an event that never fired.
const unrebased = buildStoryEvents(withPrefix);
assert.ok(unrebased.some((e) => e.date === '2026-01-05'),
  'control: without the warmup argument the prefix event IS emitted');
assert.equal(unrebased.length, rebased.length + 1,
  'exactly the prefix events are dropped — no more, no fewer');

// warmup: 0 must be byte-identical to omitting it. Every existing call site
// passes nothing, and a default that quietly reshapes their output would be a
// silent regression across the chart, StoryMode and the Thesis tab at once.
assert.deepEqual(buildStoryEvents(withPrefix, undefined, undefined, undefined, 0), unrebased,
  'warmup 0 must be a no-op');

// ── 6d. The warm-up fetch must stay ADDITIVE ───────────────────────────────
// The tempting implementation is to widen the display fetch's range. That
// silently hands 60 extra bars to ~25 consumers of `rows` — the chart, the
// stat strip, the scrubber, the Data tab, the export, the "N days" footer —
// none of which asked for them. The prefix must be its own query.
const dataSrc = fs.readFileSync(new URL('../../src/services/indicatorData.ts', import.meta.url), 'utf8');
const warmFn = dataSrc.match(/export async function fetchEquityWarmupBars[\s\S]*?\n\}/);
assert.ok(warmFn, 'the warm-up fetch must exist as its own function');
assert.match(warmFn[0], /ascending: false/,
  'DESC + limit takes the bars IMMEDIATELY before the window; ascending would '
  + "take the stock's first N bars ever, which is a different decade");
assert.match(warmFn[0], /\.lt\('trade_date', beforeDate\)/,
  'strictly before the display start — an overlap would double-count a bar');
assert.match(warmFn[0], /\.reverse\(\)/,
  'returned oldest-first like every other fetch here, or the derivation runs '
  + 'over a backwards series and every lookback is inverted');
assert.ok(/EQUITY_EOD_COLS/.test(warmFn[0]) || /runEquityEodSelect/.test(warmFn[0]),
  'warm-up bars must carry the SAME columns as display bars — a prefix missing '
  + 'a column the derivation reads evaluates to nothing, which is the exact '
  + 'silence the warm-up exists to remove');

const chartSrc = fs.readFileSync(new URL('../../src/views/ChartView.tsx', import.meta.url), 'utf8');
assert.match(chartSrc, /queryKey: \['chart-warmup'/,
  'the prefix must be a SEPARATE query, not a widened range on the display fetch');
assert.ok(!/fetchEquityEodById\(numId, range, \s*STORY_WARMUP_BARS/.test(chartSrc),
  'the display fetch must not grow a warm-up argument');
assert.match(chartSrc, /range !== 'MAX'/,
  'MAX already starts at the first bar — there is nothing before it to fetch');
assert.match(chartSrc, /buildStoryEvents\(\s*\n\s*warmupBars\.length \? \[\.\.\.warmupBars, \.\.\.rows\] : rows,/,
  'events derive over prefix + rows — and `rows` itself is never reassigned');

// ── 6e. The Thesis must hand the REMAINING gap to VaNi, and no more ────────
// Naming a gap is what makes the answers that ARE given believable — but a
// disclaimer that fires on a fully warmed window is noise, and a disclaimer
// that is always there stops being read.
const thesisSrc2 = fs.readFileSync(new URL('../../src/components/domain/StockCockpit/ThesisTab.tsx', import.meta.url), 'utf8');
assert.match(thesisSrc2, /storyCoverage\(\s*warm\.length \? \[\.\.\.warm, \.\.\.bars\] : bars,\s*warm\.length\s*\)/,
  'the fact block must measure coverage of the DISPLAY window while counting '
  + 'the warm-up it was given — measuring `bars` alone re-reports a gap the '
  + 'warm-up already closed');
assert.match(thesisSrc2, /NOT EVALUATED in this window/,
  'and tell the model, in words, not to report these as absent');
assert.match(thesisSrc2, /do NOT/, 'the instruction must be explicit');
assert.match(thesisSrc2, /report these as absent/,
  'a model handed an empty list says "none" unless told not to');
assert.match(thesisSrc2, /warmupBars/,
  'the tab must accept the prefix — a component that cannot be given warm-up '
  + 'silently keeps the blind head forever');

// ── 6f. The whole point: a coil in the blind head is RECOVERED ─────────────
// Everything above proves the plumbing. This proves the plumbing was worth
// building — a compression the user's window could not reach becomes visible,
// through the real gate, with no threshold touched.
//
// Shape: 70 volatile sessions, then tightness — narrow range, volume dying,
// Magic RS flat. The gate's 10-bar range leg is the last to clear, so the coil
// starts on the first bar whose whole 10-bar window sits inside the quiet.
const D = (i) => `2026-${String(1 + Math.floor(i / 28)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`;
const coilSeries = Array.from({ length: 130 }, (_, i) => (i < 70
  ? { trade_date: D(i), close: 100, high: 106, low: 94, volume: 1_000_000, magic_rs: 5 }
  : { trade_date: D(i), close: 100, high: 100.8, low: 99.2, volume: 300_000, magic_rs: 5 }));

// The user asked for the last 60 sessions. Alone, that is one bar short of
// what compression needs — so it is evaluated on NOTHING.
const shown = coilSeries.slice(70);
const blindRun = buildStoryEvents(shown);
assert.equal(blindRun.filter((e) => e.kind === 'fpb').length, 0,
  'without warm-up a 60-bar window finds no compression — not because there is '
  + 'none, but because the derivation cannot run at all');
assert.equal(storyCoverage(shown).fpb, false, 'and coverage says so out loud');

// The same window, warmed. Same bars on screen, same thresholds, same code.
const warmedRun = buildStoryEvents(coilSeries.slice(10), undefined, undefined, undefined, 60);
const coils = warmedRun.filter((e) => e.kind === 'fpb');
assert.ok(coils.length > 0,
  'THE POINT: warm-up recovers a coil the window could not reach. If this ever '
  + 'goes to zero the warm-up has stopped reaching the derivation, and Flower '
  + 'Pot is silently back to reporting an absence it never measured');
assert.equal(coils[0].date, D(79),
  'and it is dated to the bar the gate actually cleared on — the first whose '
  + 'full 10-bar range sits inside the quiet, not the first quiet bar');
assert.equal(shown[coils[0].barIndex].trade_date, coils[0].date,
  'rebased onto the DISPLAY window, so the marker lands on the rendered bar');
assert.equal(storyCoverage(coilSeries.slice(10), 60).blind, 0,
  'and there is no longer a blind head to disclaim');

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
  + 'Thesis list trims by priority, unevaluable windows are named not silent, '
  + 'warm-up drops and rebases correctly, stays additive and recovers a coil '
  + 'the raw window could not reach, '
  + 'naming trap held');
