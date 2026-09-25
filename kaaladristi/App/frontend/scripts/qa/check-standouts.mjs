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

// ── 6. Evidence is CHIPS, and the owner's seven fields are the columns ────
{
  const over = table.slice(table.indexOf('standouts:'), table.indexOf('pead_drift:'));
  assert.ok(!/standout_baskets|standout_presets/.test(over),
    'the basket and scanner lists must NOT be grid columns — as cells they cost '
    + '380px and push every number off screen on the live page');
  const cols = (over.match(/standouts(?:_caution)?: \[([^\]]*)\]/) ?? [])[1] ?? '';
  const want = ['symbol','close','score_5d','score_22d','pct_chng','rvol','rsi_14','magic_rs'];
  const got  = [...cols.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]);
  assert.deepEqual(got, want,
    `columns must be the owner's seven after symbol, IN ORDER — got ${got.join(', ')}`);
  assert.ok(!/magic_rs_chg_22d/.test(over),
    'magic_rs_chg_22d is bonus, not a default: "+42" is the 98th percentile yet 8 '
    + 'of the 55 stocks at or above it are still BELOW their own mean, so the raw '
    + 'figure misdescribes ~15% of the rows it would appear on');
  assert.ok(/showsEvidence/.test(table) && /standout_baskets/.test(table)
            && /standout_presets/.test(table),
    'the evidence must still RENDER, as chips under the symbol');
  // Assert the LITERAL is gone, not merely that the constant is declared: the
  // first version of this check passed against a cell that had been re-hardcoded
  // to 158 while symbolWidth sat unused two hundred lines above.
  assert.ok(!/width:\s*158\b/.test(table),
    'the sticky symbol column must take its width from ONE value used by both the '
    + 'header and the cell. A literal here is how they drifted before (header read '
    + 'cfg.width, the cell hardcoded 158), which misaligns a sticky column with its '
    + 'own heading');
  assert.ok((table.match(/symbolWidth/g) ?? []).length >= 4,
    'symbolWidth must be read by BOTH the header and the cell (width + minWidth each)');
  ok('evidence renders as chips; columns are the seven, in order');
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

// ── 9. Market category, and the array agrees with the migration ──────────
{
  const rows = engine.match(/id:\s*'standouts(?:_caution)?'[^\n]*/g) ?? [];
  for (const r of rows) {
    assert.ok(/category:\s*'market'/.test(r),
      "owner decision: Standouts sits in MARKET, whose smart_money, "
      + 'quiet_accumulation and power_sell presets already qualify a stock by the '
      + 'state of its group — this is that shape with baskets instead of industries');
    assert.ok(/category_sort:\s*4/.test(r), 'Market is sort 4');
  }
  const label = (rows[0].match(/category_label:\s*'([^']+)'/) ?? [])[1];
  assert.equal(label, 'Market', 'category_label must match the category');
  assert.ok(migration.includes("'market', 'Market'"),
    'the migration must set the same category as the array — getPresetMeta reads '
    + 'the DB row FIRST and the array is only the offline fallback, so a drift '
    + 'leaves the page rendering whichever copy answers');
  // Market already has a default tab (smart_money); two would race.
  const defaults = (migration.match(/'daily', NULL, TRUE,/g) ?? []).length;
  assert.equal(defaults, 0,
    'neither Standouts row may claim is_default_tab — smart_money already holds '
    + "Market's default and two claimants race for which tab opens");
  ok('Market category, sort 4, no default-tab clash, migration agrees');
}

console.log(`\n✓ standouts: ${n} checks passed`);
