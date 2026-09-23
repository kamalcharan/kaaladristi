/**
 * Filings page — the properties a type cannot see.
 *
 *   node scripts/qa/check-filings.mjs
 *
 * 1. CATEGORY MAP INTEGRITY. The map holds 117 exact NSE subject strings.
 *    They are long, contain commas, parentheses and in one case a DOUBLE
 *    SPACE. A single typo silently drops that category into `other`, where
 *    nobody looks — and nothing in TypeScript can catch it. The high-volume
 *    subjects are pinned verbatim from the live DB (2026-09-23).
 *
 * 2. HIGH PRIORITY IS MEASURED, NOT ASSERTED. 'Bagging/Receiving of orders/
 *    contracts' pops +2.07% on Day 0 and gives back 3.20% over the next month
 *    (-2.61 pts vs market). 'Change in Auditors' measures -0.11 pts, i.e.
 *    nothing. Both are intuitive high-priority entries and both are wrong; the
 *    test pins their ABSENCE so a later "surely orders matter" edit fails here
 *    rather than shipping a losing list.
 *
 * 3. THE SHORTER FILTER SIDE. All 117 values inline are ~7KB URL-encoded,
 *    against nginx's 8KB header limit, and the DEFAULT view needs 104 of them.
 *    The query must invert to the 13-value complement instead.
 *
 * Verified to FAIL against: a typo'd desc string, orders/auditor added to high
 * priority, admin included in the defaults, a desc listed in two groups, and
 * the shorter-side inversion removed.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

function load(rel) {
  const src = fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  new Function('exports', 'require', js)(exports, () => ({}));
  return exports;
}

const C = load('../../src/constants/filingCategories.ts');
let pass = 0;
const ok = (n) => { pass++; console.log(`  ✓ ${n}`); };

// ── 1. Structure ─────────────────────────────────────────────────────────
{
  const ids = C.FILING_GROUPS.map((g) => g.id);
  assert.equal(new Set(ids).size, ids.length, 'group ids must be unique');

  const seen = new Map();
  for (const g of C.FILING_GROUPS) {
    for (const d of g.descs) {
      assert.ok(!seen.has(d), `"${d}" is in both ${seen.get(d)} and ${g.id} — the filter would be ambiguous`);
      seen.set(d, g.id);
    }
  }
  ok(`${C.FILING_GROUPS.length} groups, ${seen.size} subjects, no duplicates`);
}

// ── 2. The high-volume subjects must all resolve ─────────────────────────
// Verbatim from the live DB. If NSE renames one these stop resolving, which
// is exactly the signal wanted — better a red test than a silent `other`.
{
  const LIVE_TOP = [
    ['Analysts/Institutional Investor Meet/Con. Call Updates', 4987],
    ['Copy of Newspaper Publication', 3827],
    ['General Updates', 3185],
    ['Outcome of Board Meeting', 3090],
    ['Shareholders meeting', 2814],
    ['Updates', 1983],
    ['Press Release', 1606],
    ['Investor Presentation', 1118],
    ['Certificate under SEBI (Depositories and Participants) Regulations, 2018', 971],
    ['Appointment', 721],
    ['Record Date', 601],
    ['Change in Management', 473],
    ['Resignation of Director/KMP/SMP', 388],
    ['Monitoring Agency Report', 350],
    ['ESOP/ESOS/ESPS', 317],
    ['Credit Rating', 268],
    ['Bagging/Receiving of orders/contracts', 236],
    ['Acquisition', 203],
    ['Change in Auditors', 180],
    ['Corporate Insolvency Resolution Process', 112],
    ['Pendency of Litigation(s)/dispute(s) or the outcome impacting the Company', 101],
    ['Spurt in Volume', 118],
    // Double space before "framework" is in the exchange's own string.
    ['Effect(s) on listed entity due to changed regulatory  framework applicable', 4],
  ];
  let covered = 0;
  for (const [desc, n] of LIVE_TOP) {
    const g = C.groupForDesc(desc);
    assert.notEqual(g, C.OTHER_GROUP_ID,
      `"${desc}" (${n} rows) fell to 'other' — the string in the map does not match the DB`);
    covered += n;
  }
  ok(`${LIVE_TOP.length} highest-volume subjects resolve (${covered.toLocaleString()} rows)`);
}

// ── 3. High priority is the MEASURED set ─────────────────────────────────
{
  const hp = new Set(C.HIGH_PRIORITY_DESCS);
  assert.ok(hp.has('Outcome of Board Meeting'), 'results must be high priority (+1.54 pts)');
  assert.ok(hp.has('Pendency of Litigation(s)/dispute(s) or the outcome impacting the Company'),
    'litigation must be high priority (-2.31 pts)');
  assert.ok(hp.has('Corporate Insolvency Resolution Process'), 'insolvency must be high priority (-1.63 pts)');

  assert.ok(!hp.has('Bagging/Receiving of orders/contracts'),
    'orders MUST NOT be high priority — measured -2.61 pts vs market, it pops then fades');
  assert.ok(!hp.has('Acquisition'), 'acquisition MUST NOT be high priority — measured -1.40 pts');
  assert.ok(!hp.has('Change in Auditors'),
    'auditor change MUST NOT be high priority — measured -0.11 pts, it only SOUNDS alarming');
  ok('high priority carries the four measured classes and none of the three traps');
}

// ── 4. Administrative is off by default ──────────────────────────────────
{
  assert.ok(C.MUTED_GROUP_IDS.has('admin'), 'admin must be muted');
  assert.ok(!C.DEFAULT_GROUP_IDS.includes('admin'),
    'admin must not be on by default — 3,827 newspaper adverts would bury everything');
  assert.ok(C.DEFAULT_GROUP_IDS.length === C.FILING_GROUPS.length - C.MUTED_GROUP_IDS.size,
    'defaults must be exactly the non-muted groups');
  ok('administrative group is off by default');
}

// ── 5. The query sends the shorter side ──────────────────────────────────
{
  const src = fs.readFileSync(new URL('../../src/services/filings.ts', import.meta.url), 'utf8');
  assert.ok(/notIn\(/.test(src),
    'filings.ts must use notIn — 104 inline values is ~7KB encoded, on nginx\'s 8KB limit');
  assert.ok(/exclude\.length\s*<\s*include\.length/.test(src),
    'must compare both sides and send the shorter one');

  const included = C.descsForGroups(C.DEFAULT_GROUP_IDS);
  const excluded = C.descsForGroups([...C.MUTED_GROUP_IDS]);
  assert.ok(excluded.length < included.length,
    'the default view must be expressible as a short exclusion');
  const encoded = excluded.reduce((a, d) => a + encodeURIComponent(d).length + 3, 0);
  assert.ok(encoded < 4000, `default exclusion must stay well under the header limit, got ${encoded}`);
  ok(`default view excludes ${excluded.length} subjects (~${encoded} URL chars), not ${included.length}`);
}

console.log(`\n✓ filings: ${pass} checks passed`);
