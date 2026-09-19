import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../../src/lib/heatmapReading.ts', import.meta.url), 'utf8');
const exports = {};
new Function('exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(exports);
const { participationColor, rocColor, participationTransition, rocTransition, coverageWarnings, chartReadingDate, countContext } = exports;
assert.notEqual(participationColor(28.1), participationColor(36.3));
assert.equal(participationColor(-10), participationColor(0));
assert.equal(participationColor(110), participationColor(100));
assert.equal(participationColor(null), 'var(--card)');
assert.equal(participationColor(NaN), 'var(--card)');
assert.match(rocColor(-.0511), /risk-red/); // Recovering but negative must stay red.
assert.equal(participationTransition(50.1, 49.9), null); // No boundary flicker.
assert.equal(participationTransition(36.3, 28.1).direction, 'up');
assert.equal(participationTransition(28, 36).direction, 'down');
assert.equal(participationTransition(36.3, 28.1, true), null);
assert.equal(participationTransition(36.3, null), null);
const rows = [2928,2933,2928,852,2920,2918,2924].map((n,i) => ({trade_date:`2026-09-${10+i}`,stock_count:n}));
const warnings = coverageWarnings(rows);
assert.deepEqual([...warnings.keys()], ['2026-09-13']);
assert.equal(coverageWarnings(rows.slice(0,4)).get('2026-09-13'), warnings.get('2026-09-13')); // No future baseline.
const roc = [-.1,.03,.04,.05].map(v => ({roc_13:v,sma_breadth:0}));
assert.equal(rocTransition(roc,1), null);
assert.equal(rocTransition(roc,2).direction, 'up');
assert.equal(rocTransition(roc,3), null); // No repeated transition marker.
assert.equal(rocTransition(roc,2,true), null);
assert.equal(rocTransition([{roc_13:null,sma_breadth:0},...roc.slice(1)],2),null);
assert.equal(chartReadingDate({activeLabel:'2026-09-18'}),'2026-09-18');
assert.equal(chartReadingDate({activeLabel:65}),null);
assert.match(countContext({above_20:1056,universe_count:2924},'above_20'),/eligibility may differ/);
console.log('PASS: graduated level scales, negative recovery, non-noisy transitions, coverage gating, date-based linking and honest denominators');
