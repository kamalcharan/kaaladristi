/**
 * Phase 1 contract — Discovery milestones and stage transitions.
 *
 *   node scripts/qa/check-journey-events.mjs
 *
 * Exercises the real buildStoryEvents against synthetic bars. Two classes of
 * regression, both of which shipped and neither of which a type would catch:
 *
 *   1. Reading journeys with `is_current` alone. sleep_date only ever exists on
 *      an ARCHIVED row, so that filter structurally hides the END of every
 *      completed arc. PGHL's real journey — woke 2026-07-09, confirmed 07-31,
 *      slept 08-31 — is entirely invisible under it.
 *   2. Deriving a stage change by diffing consecutive bars. That cannot see a
 *      transition landing on the FIRST bar of the loaded window, so a 1-year
 *      chart silently dropped every stage change on its left edge.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// storyEvents imports priceActionEvents (Phase 2). Transpiled to CommonJS it
// asks for `require`, which an .mjs scope does not have — so the real module is
// loaded and handed over rather than stubbed empty: this check must exercise
// the same event stream the chart does, Price Action included.
function loadTs(rel, deps = {}) {
  const src = fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
  // jsx is required for the .tsx component; harmless for the .ts services.
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText;
  const exp = {};
  new Function('exports', 'require', js)(exp, (m) => deps[m] ?? {});
  return exp;
}
const priceAction = loadTs('../../src/services/priceActionEvents.ts');
const { buildStoryEvents } = loadTs('../../src/services/storyEvents.ts', {
  './priceActionEvents': priceAction,
});

/** Minimal flat bars — no signal columns, so only the events under test fire. */
function bars(dates, extra = {}) {
  return dates.map((d) => ({
    trade_date: d, close: 100, high: 101, low: 99, volume: 1000,
    ...(extra[d] || {}),
  }));
}

const DATES = ['2026-07-08', '2026-07-09', '2026-07-30', '2026-07-31', '2026-08-30', '2026-08-31'];
const titles = (evs) => evs.map((e) => e.title);
const discovery = (evs) => evs.filter((e) => e.kind === 'discovery');

// ── 1. The full arc, from an ARCHIVED journey ───────────────────────────────
// PGHL's real row: is_current false, so an is_current-only fetch returns nothing.
const pghl = {
  state: 'ASCENDING', is_current: false, base_years: 5.3, base_high: 6581.5,
  wake_date: '2026-07-09', wake_close: 6600, confirm_date: '2026-07-31',
  sleep_date: '2026-08-31',
};
let evs = discovery(buildStoryEvents(bars(DATES), undefined, undefined, [pghl]));
assert.deepEqual(titles(evs), ['Journey woke', 'Journey confirmed', 'Journey closed'],
  'an archived arc must emit wake, confirm and close, in bar order');
assert.match(evs[2].detail, /53 days after its wake/, 'close must state the life of the journey');
assert.equal(evs[2].tone, 'bear', 'a closed journey is not a positive event');
assert.match(evs[1].detail, /6581\.5/, 'confirmation must cite the base ceiling it held above');

// A single object still works — the builder accepts one or many.
assert.equal(discovery(buildStoryEvents(bars(DATES), undefined, undefined, pghl)).length, 3,
  'passing one journey must behave exactly like passing an array of one');

// ── 2. Several arcs on one stock ────────────────────────────────────────────
// METROPOLIS really holds 8 rows: one current plus seven archived, five of
// which woke and slept inside two days. All of them belong on the chart.
const metro = [
  { is_current: true, state: 'STIRRING', stir_days: 14, base_years: 4.6 },
  { is_current: false, state: 'WAKING', wake_date: '2026-07-09', sleep_date: '2026-07-30' },
  { is_current: false, state: 'WAKING', wake_date: '2026-08-30', sleep_date: '2026-08-31' },
];
evs = discovery(buildStoryEvents(bars(DATES), undefined, undefined, metro));
assert.equal(evs.filter((e) => e.title === 'Journey woke').length, 2, 'both wakes must appear');
assert.equal(evs.filter((e) => e.title === 'Journey closed').length, 2, 'both closes must appear');
assert.ok(evs.every((e) => !/confirm/i.test(e.title)), 'no confirmation was recorded on either arc');
assert.match(evs.find((e) => e.title === 'Journey closed').detail, /never reached confirmation/,
  'an unconfirmed close must say so — it is the difference between a 38-day and a 494-day arc');

// ── 3. Milestones outside the window are silent ─────────────────────────────
const older = { is_current: false, wake_date: '2019-01-02', sleep_date: '2019-06-02' };
assert.deepEqual(discovery(buildStoryEvents(bars(DATES), undefined, undefined, [older])), [],
  'a journey with no milestone inside the loaded bars must draw nothing');
assert.deepEqual(discovery(buildStoryEvents(bars(DATES), undefined, undefined, null)), [],
  'no journey must not throw');
assert.deepEqual(discovery(buildStoryEvents(bars(DATES), undefined, undefined, [])), [],
  'an empty journey list must not throw');

// ── 4. Stage transitions come from stage_since ──────────────────────────────
const stageBars = bars(DATES, {
  // Transition on the FIRST bar — the diff approach has no previous bar here
  // and emitted nothing, which is the regression this guards.
  '2026-07-08': { stage: 'S2', stage_since: '2026-07-08' },
  '2026-07-09': { stage: 'S2', stage_since: '2026-07-08' },
  '2026-07-30': { stage: 'S2', stage_since: '2026-07-08' },
  '2026-07-31': { stage: 'S3', stage_since: '2026-07-31' },
  '2026-08-30': { stage: 'S3', stage_since: '2026-07-31' },
  '2026-08-31': { stage: 'S3', stage_since: '2026-07-31' },
});
const stageEvs = buildStoryEvents(stageBars).filter((e) => e.kind === 'stage');
assert.deepEqual(titles(stageEvs), ['Entered Stage 2', 'Entered Stage 3'],
  'BOTH transitions — the S2 entry on the very first loaded bar, which a '
  + 'bar-to-bar diff can never see, and the S3 entry on 07-31');
assert.equal(stageEvs[0].date, '2026-07-08', 'first-bar transition must be dated to that bar');
assert.match(stageEvs[0].detail, /^Now /, 'with no predecessor there is no "X -> Y" to state');
assert.equal(stageEvs[1].date, '2026-07-31');

// A stage held flat across the whole window fires nothing.
const flat = bars(DATES, Object.fromEntries(DATES.map((d) => [d, { stage: 'S2', stage_since: '2026-01-02' }])));
assert.deepEqual(buildStoryEvents(flat).filter((e) => e.kind === 'stage'), [],
  'a stage that never changed must produce no event');

// UNKNOWN is the classifier saying it could not tell. Moving OUT of it is the
// indicator arriving, not the stock changing character — 713 fabricated events
// when this suppression was missing.
const unknown = bars(DATES, {
  '2026-07-08': { stage: 'UNKNOWN', stage_since: '2026-01-02' },
  '2026-07-09': { stage: 'S4', stage_since: '2026-07-09' },
});
assert.deepEqual(buildStoryEvents(unknown).filter((e) => e.kind === 'stage'), [],
  'a move out of UNKNOWN must stay suppressed');

// Series without stage_since (resampled weekly/monthly, indices) keep the diff.
const noSince = bars(DATES, {
  '2026-07-08': { stage: 'S2' },
  '2026-07-09': { stage: 'S3' },
});
assert.deepEqual(titles(buildStoryEvents(noSince).filter((e) => e.kind === 'stage')), ['Entered Stage 3'],
  'the bar-diff fallback must still work where stage_since is absent');

// ── 5. Base rates are read, never remembered ───────────────────────────────
// The four figures in this sentence were hardcoded. They are derived from
// km_wg_journeys, which changes nightly, so a typed-in number goes stale
// silently. migration 209 computes them; the component must cite what it is
// given and say LESS when given nothing.
//
// The sentence moved to services/journeyFacts.ts when VaNi began narrating the
// same arc: one phrasing of one comparison, or the strip and the narration
// drift apart on the same screen.
const factsSrc = fs.readFileSync(new URL('../../src/services/journeyFacts.ts', import.meta.url), 'utf8');
const factsJs = ts.transpileModule(factsSrc, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const factsExports = {};
new Function('exports', factsJs)(factsExports);
const { baseRateLine, journeyFacts } = factsExports;

const RATES = {
  as_of: '2026-09-14', closed_total: 595, confirmed_total: 348, confirmed_pct: 58.5,
  avg_days_to_confirm: 29, avg_life_confirmed: 494, avg_life_unconfirmed: 38,
};

// Woken, not confirmed — cites the rate WITH its denominator.
let line = baseRateLine({ wake_date: '2026-07-09' }, RATES, null);
assert.match(line, /Of 595 recorded journeys/, 'the denominator must be stated, not just a percentage');
assert.match(line, /348 \(58\.5%\)/);
assert.match(line, /29 days after the wake/);

// Confirmed — cites the confirmed lifespan.
line = baseRateLine({ confirm_date: '2026-07-31' }, RATES, null);
assert.match(line, /494 days/, 'a confirmed arc cites the confirmed lifespan');

// THE RULE THAT MATTERS: no reading → the frequency clause disappears. It must
// never fall back to a remembered figure.
for (const missing of [null, undefined, { closed_total: 0 }]) {
  const l = baseRateLine({ wake_date: '2026-07-09' }, missing, null);
  assert.equal(l, 'Woken, not yet confirmed.',
    'with no base rate the clause must be dropped, not defaulted');
  assert.ok(!/\d{3}/.test(l), 'no three-digit figure may survive a missing reading');
}
// Same for a confirmed arc.
assert.equal(baseRateLine({ confirm_date: '2026-07-31' }, null, null), 'Confirmed 31 Jul 26.');

// A partial reading uses what it has and omits what it lacks.
line = baseRateLine({ wake_date: '2026-07-09' },
  { ...RATES, avg_days_to_confirm: null }, null);
assert.match(line, /went on to confirm\./, 'a missing sub-figure drops its own clause only');
assert.ok(!/average/.test(line));

// No wake at all — no population claim of any kind.
assert.match(baseRateLine({}, RATES, 103.25), /A close above the base ceiling/);
assert.ok(!/595/.test(baseRateLine({}, RATES, 103.25)),
  'an arc that never woke must cite no wake frequency');

// No figure may be hardcoded in either file any more. Strip EVERY block and
// line comment first — prose may cite an example ("348 of 595"); executable
// code may not.
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
for (const [label, src] of [
  ['JourneyStrip', fs.readFileSync(new URL('../../src/components/domain/StockCockpit/JourneyStrip.tsx', import.meta.url), 'utf8')],
  ['journeyFacts', factsSrc],
]) {
  assert.ok(!/\b595\b|\b58\.5\b|\b494\b|\b348\b/.test(stripComments(src)),
    `base-rate figures must not appear in ${label} executable code`);
}

// ── 5b. The stirring tally is never phrased as a run ───────────────────────
// `stir_days` counts qualifying bars inside the last-60 window; they are
// scattered (9.4 over a 41.3-bar span, 2.8% contiguous across 1,048 stocks).
// "Stirring for 24 days" is therefore false for 97% of the population, and it
// is the phrasing both the strip and a language model reach for by default.
const strip = loadTs('../../src/components/domain/StockCockpit/JourneyStrip.tsx', {
  '@/services/journeyFacts': { baseRateLine },
  react: { createElement: () => null },
});
assert.equal(strip.stirLabel({ stir_days: 24, stir_window_bars: 41 }), '24 / 41',
  'the cell must state the denominator');
assert.equal(strip.stirLabel({ stir_days: 24 }), '24',
  'with no window recorded, show the bare count \u2014 never an invented denominator');
assert.equal(strip.stirLabel({}), '\u2014');

let sf = journeyFacts({ state: 'STIRRING', stir_days: 24, stir_window_bars: 41,
                        stir_first_date: '2026-06-12' }, null, null, '2026-09-11').join('\n');
assert.match(sf, /24 of the last 41 sessions/, 'VaNi gets the rate with its denominator');
assert.match(sf, /scattered bars, not a continuous run/,
  'and is told explicitly that it is not a duration');
assert.doesNotMatch(sf, /Stirring for \d+ days/,
  'the duration phrasing must not survive anywhere');

sf = journeyFacts({ state: 'STIRRING', stir_days: 24 }, null, null, '2026-09-11').join('\n');
assert.doesNotMatch(sf, /of the last/, 'no denominator claimed when none is recorded');
assert.match(sf, /scattered bars/, 'the caveat still applies without a window');

// ── 6. What VaNi is given ──────────────────────────────────────────────────
// The fact block is the only thing the model sees. Two properties are
// load-bearing and neither is visible in a type: every comparison is already
// resolved into a WORD, and the population frequency is fenced off from being
// read as a per-stock chance.
const SOLARA = {
  state: 'STIRRING', is_current: true, base_years: 5.3, base_start: '2021-03-12',
  turn_date: '2026-08-21', turn_close: 616.9, stir_days: 24, align_score: 6,
  base_high: 852.4, pct_from_turn: 21.4,
};
let f = journeyFacts(SOLARA, 749.15, RATES, '2026-09-11').join('\n');

// The model must never be handed a subtraction to perform.
assert.match(f, /BELOW the base ceiling of Rs 852\.4/, 'the side of the ceiling is stated, not implied');
assert.match(f, /Rs 103\.25 \(13\.8%\)/, 'the gap is computed here, not in the prompt');
assert.match(f, /A close clearing that ceiling is what records a wake/);
assert.match(f, /Price is UP 21\.4% since the turn/, 'direction is a word — a signed number is what got misread');
assert.match(f, /NO wake recorded/, 'the absence of a wake must be stated, not left to inference');
assert.doesNotMatch(f, /NOT yet confirmed/, 'an arc that never woke cannot be "not yet confirmed"');
assert.match(f, /not a probability for this stock/,
  'the frequency must carry its own fence — this is the sentence that stops a base rate becoming a forecast');
assert.match(f, /21 days before the latest bar/, 'milestone age is precomputed against the latest bar');

// The other side of the ceiling, and a negative move: both words must flip.
f = journeyFacts({ ...SOLARA, pct_from_turn: -8.5, base_high: 700 }, 749.15, RATES, '2026-09-11').join('\n');
assert.match(f, /ABOVE the base ceiling/);
assert.match(f, /Price is DOWN 8\.5% since the turn/);
assert.doesNotMatch(f, /records a wake/, 'the wake hint belongs only below the ceiling');

// A woken, unconfirmed arc says so in words, and cites the two lifespans.
f = journeyFacts({ wake_date: '2026-07-09', state: 'WAKING' }, null, RATES, '2026-09-11').join('\n');
assert.match(f, /NOT yet confirmed/);
assert.match(f, /confirmed ran 494 days and arcs that never confirmed ran 38 days/,
  'the asymmetry between a confirmed and an unconfirmed arc is the whole decision value');

// A closed arc states its life, in days, already subtracted.
f = journeyFacts({ wake_date: '2026-07-09', sleep_date: '2026-08-31', state: 'WAKING' }, null, RATES, '2026-09-11').join('\n');
assert.match(f, /CLOSED on 31 Aug 26, 53 days after its wake/);
assert.doesNotMatch(f, /Arc is RUNNING/, 'a slept arc is not running');

// No journey → nothing at all, so the caller appends no empty header.
assert.deepEqual(journeyFacts(null, 100, RATES, '2026-09-11'), []);
assert.deepEqual(journeyFacts(undefined, null, null, null), []);

// No reading → the fence sentence has nothing to fence, and must not appear.
f = journeyFacts(SOLARA, 749.15, null, '2026-09-11').join('\n');
assert.doesNotMatch(f, /not a probability/);
assert.doesNotMatch(f, /\b595\b|\b58\.5\b/, 'no remembered frequency may appear without a reading');
assert.match(f, /BELOW the base ceiling/, 'the arc itself is still fully described');

console.log('PASS: archived arcs emit wake/confirm/close, multiple journeys per stock, '
  + 'out-of-window silence, stage_since transitions incl. first-bar and UNKNOWN suppression, '
  + 'base rates read from the nightly table and dropped when absent, '
  + 'stirring stated as a tally with its denominator, '
  + 'VaNi fact block states every comparison as a word and fences the frequency');
