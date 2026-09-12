// Offline contract checks against the actual TypeScript and Python modules.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';

const root = fileURLToPath(new URL('../../', import.meta.url));
function load(relative) {
  const exports = {};
  const js = ts.transpileModule(readFileSync(path.join(root, relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(js, { exports });
  return exports;
}
const { momentumState, participationState } = load('src/lib/structureStates.ts');
assert.equal(momentumState(.0235, .0700), 'FADING');
assert.equal(momentumState(-.01, -.02), 'BUILDING');
assert.equal(momentumState(-.03, -.02), 'OUTFLOW');
assert.equal(momentumState(0, -.02), 'QUIET');
assert.equal(momentumState(.1, .1), 'QUIET');
assert.equal(momentumState(null, .1), 'MISSING');
assert.equal(momentumState(NaN, .1), 'MISSING');
assert.equal(participationState(36, 40), 'FADING');
assert.equal(participationState(40, 36), 'BUILDING');
assert.equal(participationState(40, 40), 'QUIET');
assert.equal(participationState(40, undefined), 'MISSING');

const { structureSnapshot } = load('src/lib/structureSnapshot.ts');
const fixture = [[{ trade_date: '2026-09-11', pct_above_20: 36, pct_above_50: 50,
  pct_above_150: 62, breadth_score: 44.8, stock_count: 3000 }],
[{ trade_date: '2026-09-11', roc_13: .023500001, roc_55: null, sma_breadth: -.07, stock_count: 3069 }]];
const python = process.env.PYTHON || 'python';
const expected = execFileSync(python, ['-c', 'import json,sys; from lib.market_structure_vani import snapshot; print(snapshot(*json.load(sys.stdin)))'],
  { cwd: path.join(root, '../backend'), input: JSON.stringify(fixture), encoding: 'utf8' }).trim();
assert.equal(structureSnapshot(...fixture), expected, 'Browser and server snapshots must match exactly');
const { STRUCTURE_INTENTS, STRUCTURE_INTENT_VERSION, STRUCTURE_FOLLOWUPS } = load('src/config/marketStructureIntents.ts');
const backend = JSON.parse(execFileSync(python, ['-c', 'import json; from lib.market_structure_vani import INTENTS, VERSION; print(json.dumps([INTENTS, VERSION]))'],
  { cwd: path.join(root, '../backend'), encoding: 'utf8' }));
assert.equal(STRUCTURE_INTENT_VERSION, backend[1]);
assert.deepEqual(Object.keys(STRUCTURE_INTENTS).sort(), Object.keys(backend[0]).sort());
for (const [id, item] of Object.entries(STRUCTURE_INTENTS)) {
  assert.deepEqual([item.label, item.section, item.kind], backend[0][id]);
  for (const next of STRUCTURE_FOLLOWUPS[id]) assert.ok(STRUCTURE_INTENTS[next], `Unknown follow-up ${next}`);
}
console.log('PASS: condition colors, missing/zero values, exact browser/server snapshots, intent registry and follow-ups');
