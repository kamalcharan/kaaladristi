import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../../src/lib/heatmapReading.ts', import.meta.url), 'utf8');
const exports = {};
new Function('exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(exports);
const { participationColor, participationBand, pressureReading, breadthZoneEntry, rocColor, rocMomentumReading, rocAlignmentReading, participationTransition, rocTransition, coverageWarnings, chartReadingDate, countContext } = exports;
assert.notEqual(participationColor(28.1), participationColor(36.3));
assert.equal(participationColor(-10), participationColor(0));
assert.equal(participationColor(110), participationColor(100));
assert.equal(participationColor(null), 'var(--card)');
assert.equal(participationColor(NaN), 'var(--card)');
assert.equal(participationBand(56,20),'Extended');
assert.equal(participationBand(34,50),'Opportunity watch');
assert.equal(participationBand(29,150),'Opportunity watch');
assert.equal(breadthZoneEntry(56,54)?.description.startsWith('Entered Greed'),true);
assert.equal(breadthZoneEntry(34,36)?.description.startsWith('Entered Fear'),true);
assert.equal(breadthZoneEntry(34,36,true),null);
assert.equal(pressureReading(90,13,3000,[.2,.3,.4,.5,.6,.7], 'daily').label,'Buying thrust');
assert.equal(pressureReading(13,90,3000,[.2,.3,.4,.5,.6,.7], 'daily').label,'Panic selling');
assert.match(rocColor(-.0511), /risk-red/); // Recovering but negative must stay red.
assert.equal(rocMomentumReading(-.0511,-.1013).label,'Negative but recovering');
assert.equal(rocMomentumReading(.08,.11).label,'Positive but fading');
assert.equal(rocMomentumReading(.10,.09).label,'Indecisive / flat');
assert.equal(rocAlignmentReading(-.0511,.0298).label,'Fast momentum lagging');
assert.equal(participationTransition(50.1, 49.9), null); // No boundary flicker.
assert.equal(participationTransition(36.3, 28.1).direction, 'up');
assert.equal(participationTransition(28, 36).direction, 'down');
assert.equal(participationTransition(36.3, 28.1, true), null);
assert.equal(participationTransition(36.3, null), null);
const rows = [2928,2933,2928,852,2920,2918,2924].map((n,i) => ({trade_date:`2026-09-${10+i}`,stock_count:n}));
const warnings = coverageWarnings(rows);
assert.deepEqual([...warnings.keys()], ['2026-09-13']);
assert.equal(coverageWarnings(rows.slice(0,4)).get('2026-09-13'), warnings.get('2026-09-13')); // No future baseline.
const roc = [{roc_13:-.12,sma_breadth:-.05},{roc_13:-.09,sma_breadth:-.12},{roc_13:-.06,sma_breadth:-.10},{roc_13:-.05,sma_breadth:-.09}];
assert.equal(rocTransition(roc,1), null);
assert.equal(rocTransition(roc,2).direction, 'up');
assert.equal(rocTransition(roc,3), null); // No repeated transition marker.
assert.equal(rocTransition(roc,2,true), null);
assert.equal(rocTransition([{roc_13:null,sma_breadth:0},...roc.slice(1)],2),null);
const fading = [{roc_13:.12,sma_breadth:.05},{roc_13:.09,sma_breadth:.12},{roc_13:.06,sma_breadth:.10}];
assert.equal(rocTransition(fading,2).direction,'down');
assert.equal(chartReadingDate({activeLabel:'2026-09-18'}),'2026-09-18');
assert.equal(chartReadingDate({activeLabel:65}),null);
assert.match(countContext({above_20:1056,universe_count:2924},'above_20'),/eligibility may differ/);
console.log('PASS: fixed participation bands, signed ROC levels, coverage gating, date-based linking and honest denominators');
