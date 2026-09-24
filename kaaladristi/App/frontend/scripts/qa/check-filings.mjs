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
 * 4. THE ROW EXPANDS, IT DOES NOT NAVIGATE. The first version of this page
 *    routed a row click to /chart/equity/:id, which made the filing's own
 *    content unreachable from the one page built to show it. The row's click
 *    handler must toggle; the chart must be a named secondary control.
 *
 * 5. THE DETAIL IS ACTUALLY JOINED, AND ITS EMBED SHAPE IS TOLERANT.
 *    `summary_text`/`doc_url` live on `km_filings_raw`, one FK hop away.
 *    PostgREST returns a to-one embed as an object OR an array depending on
 *    version and detection; only one of those shapes rendering means the panel
 *    is silently empty for everyone on the other.
 *
 * 6. NOTHING PROMISES THE DOCUMENT TEXT. `raw_text` is NULL on all 31,803 raw
 *    rows and `extract_status` is 'pending' on every one of them — Sprint 3
 *    has never run. A missing summary must say which of "no wording filed" and
 *    "not read yet" it is, never render an empty box.
 *
 * Verified to FAIL against: a typo'd desc string, orders/auditor added to high
 * priority, admin included in the defaults, a desc listed in two groups, the
 * shorter-side inversion removed, a row click that navigates, an embed read
 * that assumes one shape, a dropped join, and a blank missing-summary branch.
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

// ── 6. The row expands; only the panel navigates ─────────────────────────
{
  const view = fs.readFileSync(new URL('../../src/views/FilingsView.tsx', import.meta.url), 'utf8');

  // The row component's own body, up to the next top-level function.
  const start = view.indexOf('function FilingRowItem(');
  assert.ok(start > 0, 'FilingRowItem must exist');
  const rest = view.slice(start + 1);
  const end = start + 1 + rest.indexOf('\nfunction ');
  const rowBody = view.slice(start, end);

  assert.ok(!/navigate\s*\(/.test(rowBody),
    'a filings row must NOT navigate on click — it expands. The chart belongs '
    + 'in the detail panel as a named control, or the filing is unreadable on '
    + 'the page built to show it.');
  assert.ok(/aria-expanded/.test(rowBody),
    'the row toggle must expose aria-expanded');
  assert.ok(/FilingDetail/.test(rowBody),
    'the row must render the detail panel when open');

  const detail = view.slice(view.indexOf('function FilingDetail('));
  assert.ok(/Chart study/.test(detail) && /navigate\s*\(/.test(detail),
    'the chart must still be reachable — as an explicit control in the panel');
  assert.ok(/row\.docUrl/.test(detail) && /target="_blank"/.test(detail),
    'the panel must link out to the filing document');
  ok('row expands; chart and PDF are named controls in the panel');
}

// ── 7. The detail is joined, and both embed shapes are handled ───────────
{
  const src = fs.readFileSync(new URL('../../src/services/filings.ts', import.meta.url), 'utf8');
  assert.ok(/km_filings_raw\(summary_text,doc_url,doc_size_label\)/.test(src),
    'the list query must embed km_filings_raw — the detail lives there, not on '
    + 'km_corporate_events');
  assert.ok(/Array\.isArray\(/.test(src),
    'PostgREST may return the to-one embed as an array; assuming one shape '
    + 'leaves the panel silently empty on the other');
  ok('detail is embedded in the list query, both embed shapes handled');
}

// ── 8. Nothing claims to hold the document text ──────────────────────────
{
  const view = fs.readFileSync(new URL('../../src/views/FilingsView.tsx', import.meta.url), 'utf8');
  const src = fs.readFileSync(new URL('../../src/services/filings.ts', import.meta.url), 'utf8');

  // raw_text is NULL on 31,803 of 31,803 rows; extract_status is 'pending' on
  // all of them. Reading it would render an empty section on every filing.
  for (const [name, text] of [['FilingsView', view], ['filings service', src]]) {
    const body = text.split('*/').slice(1).join('*/');  // skip the doc comments
    assert.ok(!/raw_text/.test(body),
      `${name} must not read raw_text — document extraction has never run`);
  }

  // An absent summary is a stated fact, not a blank.
  const detail = view.slice(view.indexOf('function FilingDetail('));
  assert.ok(/row\.summary\s*\?/.test(detail),
    'the panel must branch on whether the summary carries anything');
  assert.ok(/no wording beyond the subject line/.test(detail),
    'a missing summary must SAY so — an empty box reads as a broken panel');
  ok('missing summary is stated, document text is never promised');
}

// ── 9. A chip NARROWS; it does not start on and get switched off ────────
{
  const view = fs.readFileSync(new URL('../../src/views/FilingsView.tsx', import.meta.url), 'utf8');

  assert.ok(/useState<string\[\]>\(\[\]\)/.test(view),
    'the category selection must start EMPTY. Starting it as every non-muted '
    + 'id makes every chip look ON and makes a click REMOVE a category — so '
    + 'narrowing to Capital Raise meant clicking sixteen chips off, which reads '
    + 'as a broken filter.');
  assert.ok(/selected\.length \? selected : DEFAULT_GROUP_IDS/.test(view),
    'empty selection must mean ALL categories (minus Administrative), never '
    + 'an empty result');
  assert.ok(/const on = selected\.includes\(g\.id\)/.test(view),
    'a chip is lit by the SELECTION, not by the effective query — otherwise '
    + 'all 18 light up on an unfiltered page');
  assert.ok(/Showing all categories/.test(view),
    'the empty state must say it is showing everything; an unlit chip row is '
    + 'otherwise indistinguishable from a filter that returned nothing');
  assert.ok(/Clear/.test(view), 'a narrowed row needs a way back');
  ok('category chips narrow, and the unfiltered state says so');
}

console.log(`\n✓ filings: ${pass} checks passed`);
