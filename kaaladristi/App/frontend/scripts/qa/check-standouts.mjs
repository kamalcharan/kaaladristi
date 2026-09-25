#!/usr/bin/env node
/**
 * check-standouts.mjs — the Standouts preset pair.
 *
 * Node only, no browser, no DB:  node scripts/qa/check-standouts.mjs
 *
 * Guards the properties that are invisible in a type and each cost a
 * measurement to establish. Every assertion reads CODE with comments stripped,
 * because three sabotages in check-filings.mjs passed against a file whose
 * COMMENTS named the thing that had been deleted.
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
/** Strip block and line comments so prose can neither satisfy nor break a check. */
const code = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const engineRaw = read('../../src/services/scanEngine.ts');
const engine    = code(engineRaw);
const fieldsRaw = read('../../src/config/fieldConfig.ts');
const fields    = code(fieldsRaw);
const tableRaw  = read('../../src/components/domain/ScanTable.tsx');
const table     = code(tableRaw);
const migration = read('../../../DBscripts/km_migration_223_standouts_presets.sql');

let n = 0;
const ok = (m) => { n++; console.log(`  ✓ ${m}`); };

// ── 1. The gate is 2, and it is a named constant ───────────────────────────
{
  const m = engine.match(/const\s+STANDOUTS_MIN_PRESETS\s*=\s*(\d+)/);
  assert.ok(m, 'the threshold must be a named constant, not a literal at the call site');
  assert.equal(m[1], '2',
    'the gate is 2 because that is where direction stops conflicting: at >=1, 79 '
    + 'stocks carried a strength AND a caution flag at once; at >=2 it is zero. '
    + 'Moving it needs a new measurement, not a preference');
  assert.ok(/presets\.size\s*>=\s*STANDOUTS_MIN_PRESETS/.test(engine),
    'the constant must actually gate membership');
  ok('gate is the measured 2, via a named constant');
}

// ── 2. Direction is split — counting presets blind is the trap ─────────────
{
  assert.ok(/vani_side\s*===\s*side/.test(engine),
    'presets must be filtered to ONE side. breakdown_watch + power_sell + '
    + 'distribution_warning is three presets and is the opposite of a standout');
  assert.ok(/sameSide\.has\(preset\)/.test(engine),
    'the count must use the same-side set, not every preset the stock appears in');
  ok('strength and caution are counted separately, never pooled');
}

// ── 3. vani_side NULL on both rows, or the preset counts itself ────────────
{
  const rows = engine.match(/id:\s*'standouts(?:_caution)?'[^\n]*/g) ?? [];
  assert.equal(rows.length, 2, `both presets must be registered; found ${rows.length}`);
  for (const r of rows) {
    assert.ok(/vani_rule:\s*null/.test(r), 'vani_rule must be null');
  }
  const sql = migration.replace(/^\s*--.*$/gm, '');
  const valueRows = sql.match(/'standouts(?:_caution)?',[\s\S]*?NULL\)/g) ?? [];
  assert.equal(valueRows.length, 2,
    'both migration rows must end vani_side NULL — a value there makes Standouts '
    + 'count itself, because the fetcher SELECTS on vani_side');
  ok('vani_side is NULL in both the array and the migration');
}

// ── 4. SWAP, never DROP — the dual-listing resolve ─────────────────────────
{
  assert.ok(/nseIdByIsin/.test(engine),
    'a dual-listed BSE constituent must resolve to its NSE listing by ISIN');
  assert.ok(/twin\s*\?\?\s*rawId/.test(engine),
    'unresolvable ids must FALL BACK to themselves, never be dropped: measured on '
    + 'the curated baskets, 24 of 27 dual-listed BSE constituents had no NSE twin '
    + 'in any basket, so a drop would delete 24 curated names');
  assert.ok(!/buildNsePreferredIds\s*\([^)]*\)[\s\S]{0,200}standout/i.test(engine),
    'buildNsePreferredIds prefers among rows it is GIVEN — it cannot swap to a '
    + 'listing that is not in the map, which is exactly this case');
  ok('dual listings swap to NSE and are never dropped');
}

// ── 5. A failed read THROWS; an empty result stays empty ───────────────────
{
  const fn = engine.slice(engine.indexOf('async function fetchStandouts'));
  const body = fn.slice(0, fn.indexOf('\nasync function', 10) + 1 || undefined);
  const throws = (body.match(/throw new Error/g) ?? []).length;
  assert.ok(throws >= 3,
    `every read must fail visibly; found ${throws} throws. An error rendered as an `
    + 'empty scanner asserts a measurement that was never taken');
  assert.ok(/if\s*\(!ids\.length\)\s*return \[\]/.test(body),
    'no qualifying stock is a MEASUREMENT and must return empty, not throw');
  ok('reads throw, emptiness returns empty');
}

// ── 6. The raw count is NOT a column ───────────────────────────────────────
{
  const over = table.slice(table.indexOf('standouts:'), table.indexOf('pead_drift:'));
  assert.ok(/standout_baskets/.test(over) && /standout_presets/.test(over),
    'the basket and the flagging scanners are the evidence for a row and must be columns');
  assert.ok(!/standout_count|preset_count|standout_presets_count/.test(table),
    'the raw agreement COUNT must not be a column — the chips already are the '
    + 'count, and a bare number reads as a strength score, which nothing measures');
  ok('evidence columns present, raw count absent');
}

// ── 7. The universe read is capped, not an in.(<1500 ids>) ────────────────
{
  assert.ok(/ACTIVE_UNIVERSE_CAP/.test(engine),
    'reuse the sized cap rather than a fresh literal — an undersized one already '
    + 'dropped 2,412 rows and resolved a dual-listed stock to its BSE row');
  const fn = engine.slice(engine.indexOf('async function fetchBasketMembership'));
  const body = fn.slice(0, fn.indexOf('\nasync function', 10));
  assert.ok(!/\.in\('isin'/.test(body),
    'an in.() over every constituent ISIN is a URL long enough to truncate silently');
  ok('universe read is capped, no unbounded in.() list');
}

// ── 8. The stale PEAD figure is gone from the tooltip ──────────────────────
{
  assert.ok(!/\+1\.54 points of excess/.test(fieldsRaw),
    'the +1.54 pts point estimate is SUPERSEDED: split in half the same sample '
    + 'gives +0.82 and +5.95, and the second half is one cluster of consecutive '
    + 'Day 0 dates sharing a single forward window. It must not be quoted as an '
    + 'expected return in a tooltip');
  assert.ok(/not stable|ranking, not as an expected return/.test(fieldsRaw),
    'the tooltip must say the band is a ranking, not an expected return');
  ok('superseded +1.54 estimate retired from the PEAD tooltip');
}

// ── 9. Own category, and the array agrees with the migration ──────────────
{
  const rows = engine.match(/id:\s*'standouts(?:_caution)?'[^\n]*/g) ?? [];
  for (const r of rows) {
    assert.ok(/category:\s*'standouts'/.test(r),
      'Standouts needs its OWN category: its membership is a function of the '
      + 'other presets, so inside Market or Price Action every badge double-counts');
  }
  const label = (rows[0].match(/category_label:\s*'([^']+)'/) ?? [])[1];
  assert.ok(label, 'category_label must be set in the array');
  assert.ok(migration.includes(`'${label}'`),
    `the migration must set the same category_label as the array ("${label}") — `
    + 'getPresetMeta reads the DB row FIRST and the array is only the offline '
    + 'fallback, so a drift leaves the page rendering whichever copy answers');
  ok(`own category, label "${label}" consistent with migration 223`);
}

console.log(`\n✓ standouts: ${n} checks passed`);
