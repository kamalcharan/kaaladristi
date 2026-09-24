/**
 * Post-Result Drift scanner — the properties measurement bought.
 *
 *   node scripts/qa/check-pead-scanner.mjs
 *
 * Every assertion here encodes a number that cost a measurement to learn, and
 * each one is the kind a well-meaning later edit would undo:
 *
 *   +5% GATE. The drift is NEGATIVE across all three reaction bands below +2%
 *   and only clears the market above +5% (n=278, +1.54 pts). Loosening it to
 *   +2% to "get more names" admits a band measured at +0.75 and then one at
 *   -1.02. The gate is a finding, not a preference.
 *
 *   NO MagicRS GATE. react>=5% with RS rising measured +0.80%, with RS falling
 *   +0.59% (n=42) — within noise. Bolting RS on is the obvious way to make the
 *   scanner look richer and it would halve the list for nothing.
 *
 *   suspect_corporate_action IS FILTERED. km_corporate_actions is still EMPTY,
 *   so a bonus inside the span reads as a genuine -50% drift — and results
 *   season is exactly when boards declare them.
 *
 *   A FAILED READ THROWS. An empty scanner is a measurement; an error is not.
 *
 *   REACTION AND DRIFT STAY SEPARATE. Merging them folds the announcement jump
 *   into the drift, which is how a PEAD study reports an effect it never
 *   measured.
 *
 *   DRIFT IS COMPUTED HERE, FROM day_0_close. `kd_result_returns` fills
 *   drift_pct only once the FULL horizon has passed, while this scanner's
 *   membership rule is "still inside the window" — so every row it can return
 *   has a NULL drift_pct, and reading it shipped a column that was
 *   structurally always "—".
 *
 * Verified to FAIL against: the gate loosened to 2, an RS filter added, the
 * corporate-action filter dropped, the throw softened to `return []`, the
 * freshest-first ordering reversed, the preset losing its own category, drift
 * read back from the RPC, drift measured from base_close, and the seasonal
 * empty state falling back to the generic "no stocks match".
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../../src/services/scanEngine.ts', import.meta.url), 'utf8');
const fn = (() => {
  const i = src.indexOf('async function fetchPeadDrift');
  assert.ok(i > 0, 'fetchPeadDrift not found in scanEngine.ts');
  // Ends at the first top-level `}` on its own line. Asserted non-trivial so
  // a refactor that moves the function cannot silently shrink every check
  // below to a pass over an empty string.
  const j = src.indexOf('\n}\n', i);
  const body = src.slice(i, j);
  assert.ok(body.length > 2000, 'fetchPeadDrift body looks truncated');
  return body;
})();

let pass = 0;
const ok = (n) => { pass++; console.log(`  ✓ ${n}`); };

// ── 1. The gate is +5, and it is a named constant ────────────────────────
{
  const m = src.match(/const PEAD_MIN_REACTION_PCT\s*=\s*(\d+(?:\.\d+)?)\s*;/);
  assert.ok(m, 'PEAD_MIN_REACTION_PCT must be a named constant, not an inline 5');
  assert.equal(Number(m[1]), 5,
    `the gate must be +5% — measured. Below +2% the drift is negative across ` +
    `three consecutive bands (-1.02, -1.28, -0.93 pts); +2..+5% is only +0.75; ` +
    `above +5% is +1.54 (n=278). Got ${m[1]}.`);
  assert.ok(fn.includes('PEAD_MIN_REACTION_PCT'), 'the scan must use the constant');
  ok('entry gate is the measured +5%, via a named constant');
}

// ── 2. No MagicRS gate on membership ─────────────────────────────────────
{
  // magic_rs may be SELECTED (it is a display column) but must never appear
  // in a comparison that decides membership.
  const gated = /magic_rs[a-z_0-9]*\s*(>=|>|<|<=)\s*-?\d/.test(fn)
             || /(>=|>|<|<=)\s*.*magic_rs/.test(fn.split('\n').filter(l => l.includes('filter') || l.includes('if (')).join('\n'));
  assert.ok(!gated,
    'membership must NOT gate on MagicRS — react>=5% with RS rising measured ' +
    '+0.80% vs +0.59% falling (n=42), within noise');
  ok('no MagicRS gate on membership');
}

// ── 3. Corporate actions filtered ────────────────────────────────────────
{
  assert.ok(/suspect_corporate_action\s*!==\s*true/.test(fn),
    'suspect_corporate_action must be filtered — km_corporate_actions is EMPTY, ' +
    'so a bonus inside the span reads as a genuine -50% drift');
  ok('suspect_corporate_action is filtered, not optional');
}

// ── 4. A failed read fails visibly ───────────────────────────────────────
{
  assert.ok(/if\s*\(rpcErr\)\s*throw/.test(fn),
    'a failed RPC must THROW — rendering an error as an empty scanner asserts ' +
    'a measurement the page never made');
  ok('failed read throws instead of rendering as empty');
}

// ── 5. Reaction and drift stay separate ──────────────────────────────────
{
  assert.ok(/result_reaction_pct:/.test(fn) && /result_drift_pct:/.test(fn),
    'both must be carried');
  assert.ok(!/reaction_pct\s*\+\s*.*drift_pct|drift_pct\s*\+\s*.*reaction_pct/.test(fn),
    'reaction and drift must NEVER be summed — that folds the announcement ' +
    'jump into the drift');
  ok('reaction and drift are carried separately, never merged');
}

// ── 6. Freshest first ────────────────────────────────────────────────────
{
  assert.ok(/out\.sort/.test(fn), 'results must be ordered');
  assert.ok(/b\.result_day_0.*localeCompare.*a\.result_day_0/s.test(fn),
    'freshest Day 0 first — a result two sessions old still has eighteen of ' +
    'its twenty-session window left');
  ok('freshest result first, reaction as the tiebreaker');
}

// ── 7. Window comes from the calendar, never date arithmetic ─────────────
{
  assert.ok(/fetchRecentDates\(21\)/.test(fn),
    'the 20-session window must come from the trading calendar — date ' +
    'arithmetic would silently widen or narrow it across a holiday');
  assert.ok(!/setDate|Date\.now|86400/.test(fn), 'no calendar-day arithmetic');
  ok('window is calendar-derived (21 dates), not date arithmetic');
}

// ── 8. Preset registration ───────────────────────────────────────────────
{
  const p = src.match(/\{\s*id:\s*'pead_drift'[^}]*\}/);
  assert.ok(p, "pead_drift must be registered in SCAN_PRESETS");
  const entry = p[0];
  assert.ok(/category:\s*'events'/.test(entry),
    "pead_drift needs its OWN category — it is seasonal (104 qualifying names " +
    "in the week of 2026-08-10, ONE on 2026-09-23) and an empty list inside " +
    "Price Action would make that family look broken four weeks in five");
  assert.ok(/universe:\s*'NSE_ONLY'/.test(entry),
    'the filing ingest does not cover BSE');
  assert.ok(/vani_rule:\s*null/.test(entry),
    'no vani_rule — a highlight here would just restate membership');
  ok('preset registered in its own seasonal category, NSE-only, no vani_rule');
}

// ── 8. Drift is computed here, and from the right anchor ────────────────
{
  assert.ok(/driftSoFar/.test(fn),
    'drift must be computed in the scanner. kd_result_returns fills drift_pct '
    + 'only after the FULL horizon, and every member of this list is still '
    + 'inside its window — so reading the RPC gives a column that can never '
    + 'populate');
  assert.ok(!/toNum\(ev\.drift_pct\)/.test(fn),
    'ev.drift_pct is NULL for every live row; it must not reach the column');
  assert.ok(/ev\.day_0_close/.test(fn) && !/ev\.base_close/.test(fn),
    'drift is measured from day_0_close. base_close is Day -1, and measuring '
    + 'from there folds the announcement jump into the drift — the exact '
    + 'error migration 215 exists to prevent');
  assert.ok(/d0Close > 0/.test(fn),
    'a zero or missing Day 0 close must yield null, never a division result');
  // The divisor must be d0Close itself. `d0Close ?? 1` looks like a null guard
  // and is not: it turns a missing Day 0 close into "drift = close - 100%",
  // a confident number computed from nothing.
  assert.ok(/\/ d0Close\)/.test(fn) && !/d0Close \?\?/.test(fn),
    'divide by d0Close directly — a ?? fallback fabricates a drift from a '
    + 'missing anchor instead of returning null');
  assert.ok(/dates\.indexOf/.test(fn),
    'sessions elapsed must come off the trading calendar, not date arithmetic '
    + '— a holiday would silently mis-count the window');
  ok('drift so far is computed from day_0_close, sessions off the calendar');
}

// ── 9. The seasonal empty state says what is actually empty ─────────────
{
  const view = fs.readFileSync(new URL('../../src/views/ScanView.tsx', import.meta.url), 'utf8');
  assert.ok(/EMPTY_COPY/.test(view) && /pead_drift:/.test(view),
    'a SEASONAL scanner needs its own empty copy');
  assert.ok(/No results filed in the last 20 sessions/.test(view),
    'the empty state must name what is missing — RESULTS, not opportunities. '
    + '104 names in the week of 2026-08-10 and ONE on 2026-09-23: this list is '
    + 'empty four weeks in five by design, and "no stocks match" reads as a '
    + 'broken screen');
  // Count the FALLBACKS, not the lookups: swapping `??` for `&&` keeps the
  // lookup count identical and silently blanks the generic line.
  const heads = view.match(/EMPTY_COPY\[presetId\]\?\.head\s*\?\?/g) ?? [];
  const bodies = view.match(/EMPTY_COPY\[presetId\]\?\.body\s*\n?\s*\?\?/g) ?? [];
  assert.equal(heads.length, 2,
    `both empty states need a head with a ?? fallback; found ${heads.length}`);
  assert.equal(bodies.length, 2,
    `both empty states need a body with a ?? fallback; found ${bodies.length}`);
  ok('seasonal empty state is wired into both branches, head and body');
}

// ── 10. The category label moves in the DB and the array together ───────
{
  const arr = fs.readFileSync(new URL('../../src/services/scanEngine.ts', import.meta.url), 'utf8');
  const mig = fs.readFileSync(
    new URL('../../../DBscripts/km_migration_222_events_category_rename.sql', import.meta.url), 'utf8');
  const label = (arr.match(/category: 'events', category_label: '([^']+)'/) ?? [])[1];
  assert.ok(label, 'the events preset must carry a category_label');
  assert.ok(mig.includes(`category_label = '${label}'`),
    `the array says "${label}" but migration 222 sets something else. `
    + 'getPresetMeta() reads the DB row FIRST and only falls back to the '
    + 'array, so the two must move together or the page renders whichever '
    + 'copy happens to answer');
  assert.ok(/category = 'events'/.test(mig) && !/SET category =/.test(mig),
    "the category ID is an address (?setup= links, PRESET_COL_OVERRIDES) and "
    + 'must not be renamed — only its label');
  ok(`category label "${label}" is consistent across the array and migration 222`);
}

console.log(`\n✓ pead scanner: ${pass} checks passed`);
