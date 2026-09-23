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
 * Verified to FAIL against: the gate loosened to 2, an RS filter added, the
 * corporate-action filter dropped, the throw softened to `return []`, the
 * freshest-first ordering reversed, and the preset losing its own category.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../../src/services/scanEngine.ts', import.meta.url), 'utf8');
const fn = (() => {
  const i = src.indexOf('async function fetchPeadDrift');
  assert.ok(i > 0, 'fetchPeadDrift not found in scanEngine.ts');
  const j = src.indexOf('\n}\n', i);
  return src.slice(i, j);
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

console.log(`\n✓ pead scanner: ${pass} checks passed`);
