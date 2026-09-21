import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import * as router from 'react-router-dom';
import * as jsx from 'react/jsx-runtime';

function load(rel, deps = {}) {
  const source = fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const result = {};
  new Function('exports', 'require', code)(result, name => {
    if (name.endsWith('.css')) return {};
    if (name in deps) return deps[name];
    throw Error(`Unprovided dependency ${name}`);
  });
  return result;
}
const facts = load('../../src/components/domain/StockStory/stockStoryFacts.ts');
const { computeDots } = load('../../src/services/visualPulseEngine.ts');
assert.deepEqual(computeDots({ dot_sbd: true, dot_svd: true, dot_syd: false, rvol: 0 }, null), { isSBD: true, isSVD: true, isSYD: false });
assert.deepEqual(computeDots({ dot_sbd: false, dot_svd: false, dot_syd: false, rvol: 99 }, null), { isSBD: false, isSVD: false, isSYD: false });
const priceAction = load('../../src/services/priceActionEvents.ts');
const signalScale = load('../../src/constants/signalScale.ts');
const { buildStoryEvents } = load('../../src/services/storyEvents.ts', { './priceActionEvents': priceAction, '../constants/signalScale': signalScale });
const vertical = load('../../src/components/domain/StockStory/VerticalEventTimeline.tsx', { react: React, 'react/jsx-runtime': jsx });
const visuals = load('../../src/components/domain/StockStory/StoryVisuals.tsx', { react: React, 'react/jsx-runtime': jsx, './stockStoryFacts': facts, '@/constants/signalScale': signalScale, './VerticalEventTimeline': vertical });
const Workspace = load('../../src/components/domain/StockStory/StockStoryWorkspace.tsx', {
  react: React, 'react/jsx-runtime': jsx, 'react-router-dom': router, './stockStoryFacts': facts, './StoryVisuals': visuals,
  '@/constants/signalScale': signalScale,
}).default;
const first = { trade_date: '2026-09-17', close: 588.15, high: 598.4, low: 580, volume: 1000,
  magic_rs_chg_5d: -1, magic_rs_chg_22d: 1, magic_rs_chg_66d: null };
const last = { ...first, trade_date: '2026-09-18', close: 612.4, prev_week_close: 592.05,
  sma_150: 444.74, magic_rs_chg_5d: 1, magic_rs_chg_22d: -1, magic_rs_chg_66d: 2,
  dot_sbd: true, dot_svd: true, bm_event: 'exit' };
const events = buildStoryEvents([first, last], new Set([last.trade_date]));
assert.equal(events.filter(e => e.title.includes('RS momentum')).length, 2);
assert.ok(events.some(e => e.title.includes('5 sessions crossed above')));
assert.ok(events.some(e => e.title.includes('22 sessions crossed below')));
assert.ok(!events.some(e => e.title.includes('66 sessions crossed')));
assert.equal(events.find(e => e.kind === 'big_money').tone, 'bear');
assert.ok(events.some(e => e.title === 'SBD + SVD recorded'));
assert.ok(buildStoryEvents([last]).some(e => e.title === 'SBD + SVD recorded'), 'first-bar stored signatures need no predecessor');
assert.equal(facts.watchReferences(last).find(e => e.id === 'week').state, 'Above');
assert.equal(facts.relation(500, 500), 'At');
assert.equal(facts.relation(499, 500), 'Below');
assert.equal(facts.relation(500, null), 'Unavailable');
assert.equal(facts.relation(500, NaN), 'Unavailable');
assert.equal(facts.relation(500, 0), 'Unavailable');
assert.ok(facts.watchReferences(null).every(e => e.value === null));
const warm = buildStoryEvents([first, last], undefined, undefined, undefined, 1);
assert.ok(warm.every(e => e.barIndex === 0 && e.date === last.trade_date));
const base = { name: 'JGCHEM', equityId: 39248, search: '', latest: last, setup: null,
  setupLoading: false, setupError: false, inferredLens: false, scanCount: 1, scansLoading: false,
  context: 'Industry / scanners / membership', stats: 'Stats', leadership: 'RS quadrant',
  participation: 'Flow / Smart Money / Big Money / Delivery', chart: 'Chart and MagicRS',
  setupContent: 'Original setup component', dataContent: 'Original Data component',
  lensPicker: null, actions: null, loading: false, error: false, events, fromDate: first.trade_date,
  barCount: 2, bigMoney: [], selectedEvent: null, onSelectEvent: () => {} };
function render(props) { return renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [`/?${props.search ?? ''}`] }, React.createElement(Workspace, { ...base, ...props }))); }
for (const mcapCr of [null, undefined, 0, -1, NaN, Infinity]) assert.ok(!render({ mcapCr }).includes('Current market cap'));
const html = render({ mcapCr: 2399.75 });
assert.ok(html.includes('Current market cap') && html.includes('2,399.75'));
for (const section of ['Turning points, in time', 'Events to watch', 'Setup Read']) assert.ok(html.includes(section));
assert.ok(!html.includes('id="story-price"') && !html.includes('RS quadrant'));
assert.ok(html.indexOf('id="story-events"') < html.indexOf('id="story-conditions"'));
assert.ok(html.indexOf('Where price sits') < html.indexOf('id="story-events"'));
const chartHtml = render({ search: 'tab=chart' });
for (const section of ['RS quadrant', 'Chart and MagicRS', 'Flow / Smart Money / Big Money / Delivery']) assert.ok(chartHtml.includes(section));
assert.ok(!chartHtml.includes('id="story-events"') && !chartHtml.includes('id="story-conditions"'));
assert.ok(html.includes('Original setup component') && html.includes('story-setup-shell'));
assert.ok(!html.includes('Original Data component'));
const dataHtml = render({ search: 'tab=data' });
assert.ok(dataHtml.includes('Original Data component') && dataHtml.includes('id="story-panel-data"'));
assert.ok(!dataHtml.includes('Original setup component') && !dataHtml.includes('id="story-price"'));
for (const [zone, mapped] of Object.entries(signalScale.ZONE_LABELS)) {
  const output = render({ latest: { ...last, magic_rs_zone: zone, magic_rs: 37.22 } });
  assert.ok(output.includes(`37.22 · ${mapped.label}`));
  assert.ok(!/\b(bull|bear|bullish|bearish|uptrend|downtrend)\b/i.test(output.replace(/<[^>]+>/g, ' ')));
}
const zoneEvents = buildStoryEvents([
  { ...first, magic_rs_zone: 'Neutral' }, { ...last, magic_rs_zone: 'Mild Bull' },
  { ...last, trade_date: '2026-09-21', magic_rs_zone: 'Strong Bear' },
]).filter(e => e.kind === 'magic_rs');
assert.ok(zoneEvents.some(e => e.detail.includes('Improving')));
assert.ok(zoneEvents.some(e => e.detail.includes('Lagging')));
assert.ok(zoneEvents.every(e => !/\b(bull|bear|bullish|bearish|uptrend|downtrend)\b/i.test(`${e.title} ${e.detail}`)));
assert.ok(!html.includes('reactionPct') && !html.includes('Risk ↔ Reward'));
const inside = render({ bigMoney: [{ trade_date: first.trade_date, low: 600, high: 620 }] });
assert.ok(inside.includes('Inside range'));
assert.ok(render({ latest: null, events: [], loading: true }).includes('Loading events'));
const mismatch = render({ pulseDate: '2026-09-16' });
assert.ok(mismatch.includes('different observation dates'));
console.log('PASS stock story: momentum, missing history, directional footprint, warmup, reference states, missing MCAP, retained widget slots, loading and dates');
const missingHtml = render({ latest: null, events: [] });
assert.ok(!missingHtml.includes('NaN') && !missingHtml.includes('Infinity'));
for (const section of ['Level ≠ momentum', 'Who participated?', 'Connected observations', 'story-zero-track', 'story-time-scroll']) assert.ok(html.includes(section), section);
assert.ok(html.includes('No event in this family'));
assert.ok(!html.includes('reactionPct'));
const zeros = render({ latest: { ...last, magic_rs_chg_5d: 0, magic_rs_chg_22d: null, magic_rs_chg_66d: 0, score_5d: 0, score_22d: 0 } });
assert.ok(!zeros.includes('NaN') && !zeros.includes('Infinity'));
console.log('PASS visual scales, event lanes, missing values and zero values');
const endTime = Date.parse('2026-09-18T00:00:00Z');
assert.equal(vertical.timePosition('2026-09-18', endTime, 6, 480), 24);
assert.equal(vertical.timePosition('2026-09-15', endTime, 6, 480), 264);
assert.equal(vertical.timePosition('2026-09-12', endTime, 6, 480), 504);
console.log('PASS proportional shared time geometry');
