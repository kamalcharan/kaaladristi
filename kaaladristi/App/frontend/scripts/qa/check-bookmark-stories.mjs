import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
function load(path, dependencies = {}) {
  const code = ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const output = {};
  new Function('exports','require',code)(output, name => { if (name in dependencies) return dependencies[name]; throw Error(name); });
  return output;
}
const scale = load('../../src/constants/signalScale.ts');
const price = load('../../src/services/priceActionEvents.ts');
const engine = load('../../src/services/storyEvents.ts', { './priceActionEvents': price, '../constants/signalScale': scale });
const { personalStory } = load('../../src/services/bookmarkStories.ts', { './postgrest': {}, './storyEvents': engine });
assert.equal(personalStory([], '2026-09-18'), null);
assert.equal(personalStory([{trade_date:'2026-09-18',close:NaN}], '2026-09-18'), null);
const rows = Array.from({length:8}, (_,i) => ({trade_date:`2026-09-${11+i}`,close:600,magic_rs_chg_5d:i===0 ? null : i<6 ? 1 : -1}));
const result = personalStory(rows.reverse(), '2026-09-19');
assert.equal(result.sessions,5);
assert.equal(result.fromDate,'2026-09-14');
assert.equal(result.latest.trade_date,'2026-09-18');
assert.notEqual(result.latest.trade_date,result.expectedDate,'stale stock data remains dated');
assert.equal(result.events.filter(e=>e.kind==='magic_rs').length,1);
assert.ok(result.events.every(e=>e.date >= result.fromDate));
const missing = personalStory([{trade_date:'2026-09-17',close:600,magic_rs_chg_5d:null},{trade_date:'2026-09-18',close:600,magic_rs_chg_5d:2}], '2026-09-18');
assert.equal(missing.events.length,0,'missing momentum is not a zero crossing');
assert.equal(personalStory([{trade_date:'2026-09-18',close:600,dot_sbd:true}], '2026-09-18').events[0].tone,'neutral');
console.log('PASS bookmark story ordering, coverage, missing data, stale date and shared event semantics');
