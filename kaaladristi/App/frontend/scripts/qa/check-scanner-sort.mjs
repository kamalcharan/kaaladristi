#!/usr/bin/env node
/**
 * check-scanner-sort.mjs — the default ORDER BY on every scanner.
 *
 * Node only, no browser, no DB:  node scripts/qa/check-scanner-sort.mjs
 *
 * The owner specified a default ranking per screener on 2026-09-25. Three of
 * those specs could not be met and the reasons are measurements, not taste —
 * they are asserted here too, so a future session cannot quietly "finish the
 * list" with a column that does not mean what its name suggests.
 *
 * Every assertion reads CODE with comments stripped: a comment naming a sort
 * key is not a sort key.
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const code = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const table  = code(read('../../src/components/domain/ScanTable.tsx'));
const studio = code(read('../../src/config/scannerStudio.ts'));
const avail  = code(read('../../src/fieldAvailability.ts'));
const view   = code(read('../../src/views/ScanView.tsx'));

let n = 0;
const ok = (m) => { n++; console.log(`  ✓ ${m}`); };

/** The DEFAULT_SORT map body, so a stray match elsewhere in the file cannot pass. */
const defaultSortBody = (() => {
  const i = table.indexOf('const DEFAULT_SORT');
  assert.ok(i >= 0, 'DEFAULT_SORT must exist in ScanTable');
  const j = table.indexOf('\n}', i);
  return table.slice(i, j);
})();

const sortOf = (preset) => {
  const m = defaultSortBody.match(
    new RegExp(`\\b${preset}\\s*:\\s*\\{\\s*key:\\s*'([a-z0-9_]+)'\\s*,\\s*dir:\\s*'(asc|desc)'`, 'i'));
  return m ? { key: m[1], dir: m[2] } : null;
};

/** A Studio descriptor's sort, read from inside that descriptor only. */
const studioSortOf = (preset) => {
  const i = studio.indexOf(`  ${preset}: {`);
  assert.ok(i >= 0, `Studio descriptor ${preset} must exist`);
  const seg = studio.slice(i, i + 4000);
  const m = seg.match(/sort:\s*\{\s*key:\s*'([a-z0-9_]+)'\s*,\s*dir:\s*'(asc|desc)'/);
  assert.ok(m, `${preset} must declare a sort`);
  return { key: m[1], dir: m[2] };
};

// ── 1. The owner's spec, preset by preset ──────────────────────────────────
// Studio descriptors are read FIRST by getDefaultSort, so a Studio preset's
// ranking lives on the descriptor and putting it in DEFAULT_SORT does nothing.
{
  const STUDIO_SPEC = {
    breakout_surge:    { key: 'score_5d',          dir: 'desc' },
    breakdown_watch:   { key: 'score_22d',         dir: 'asc'  },
    gl_retest:         { key: 'gl_sessions_since', dir: 'asc'  },
  };
  for (const [preset, want] of Object.entries(STUDIO_SPEC)) {
    assert.deepEqual(studioSortOf(preset), want,
      `${preset} must rank by ${want.key} ${want.dir} (owner, 2026-09-25)`);
  }
  ok('Studio rankings match the spec (breakout 5D, breakdown 22D, retest freshest-first)');

  const MAP_SPEC = {
    stage_2_watch:     { key: 'stage_since',           dir: 'desc' },
    stage_2_leaders:   { key: 'stage_since',           dir: 'desc' },
    stage_3_watch:     { key: 'stage_since',           dir: 'desc' },
    stage_4_leaders:   { key: 'stage_since',           dir: 'desc' },
    volume_drive:      { key: 'rvol',                  dir: 'desc' },
    power_buy:         { key: 'score_5d',              dir: 'desc' },
    conviction_flow:   { key: 'delivery_surge_x',      dir: 'desc' },
    flower_pot_burst:  { key: 'fpb_compression_score', dir: 'desc' },
    standouts:         { key: 'score_5d',              dir: 'desc' },
    standouts_caution: { key: 'score_22d',             dir: 'asc'  },
    waking_giants:     { key: 'wake_date',             dir: 'desc' },
    wg_ascent:         { key: 'wake_date',             dir: 'desc' },
  };
  for (const [preset, want] of Object.entries(MAP_SPEC)) {
    assert.deepEqual(sortOf(preset), want,
      `${preset} must rank by ${want.key} ${want.dir} (owner, 2026-09-25)`);
  }
  ok('DEFAULT_SORT rankings match the spec, all 12');
}

// ── 2. A sort key must be a key of ScanStock, checked by the compiler ──────
// Before this the map was Record<string, {key: string}>, so a typo compiled
// and then read as an undefined property on every row. sortStocks puts nulls
// last in both directions, so the table rendered in FETCH order -- an order
// nobody chose, looking exactly like one somebody did.
{
  assert.ok(/DEFAULT_SORT:\s*Record<string,\s*\{\s*key:\s*keyof ScanStock/.test(defaultSortBody),
    'DEFAULT_SORT keys must be typed `keyof ScanStock`, not `string`');
  ok('a mistyped sort key fails the build instead of silently sorting nothing');
}

// ── 3. Nulls last in BOTH directions, and dates compared as text ───────────
// stage_since and wake_date are ISO date strings. compareValues must fall
// through to localeCompare for them (Number('2026-09-22') is NaN), which
// orders ISO dates correctly; and a row with no recorded entry must never
// sort to the top of a "newest first" list.
{
  assert.ok(/if\s*\(av == null\) return 1;?\s*\n\s*if\s*\(bv == null\) return -1/.test(table),
    'sortStocks must place nulls last irrespective of direction');
  assert.ok(/Number\.isFinite\(an\) && Number\.isFinite\(bn\)/.test(table),
    'compareValues must decide numeric-vs-text on the VALUE, or ISO dates break');
  ok('nulls sort last both ways; ISO dates fall through to localeCompare');
}

// ── 4. The sorted column is a column the user can SEE ──────────────────────
// A default sort on a hidden field gives the table no header arrow, so it
// reads as unordered. Each key below must appear in the column set its preset
// actually renders.
{
  const group = (name) => {
    const i = avail.indexOf(`  ${name}: {`);
    assert.ok(i >= 0, `field group ${name} must exist`);
    return avail.slice(i, i + 1600);
  };
  assert.ok(/'stage_since'/.test(group('stage_analysis')),
    'stage_since must be a rendered column on the Stage family');
  assert.ok(/'rvol'/.test(group('flow')) || /volume_drive:[\s\S]{0,600}'rvol'/.test(table),
    'rvol must be a rendered column on Volume Drive');
  assert.ok(/'score_5d'/.test(group('flow')),
    'score_5d must be a rendered column on Strength Confluence');
  assert.ok(/'delivery_surge_x'/.test(group('flow')),
    'delivery_surge_x must be a rendered column on Conviction Flow');
  for (const p of ['waking_giants', 'wg_ascent']) {
    const i = table.indexOf(`  ${p}: [`);
    assert.ok(i >= 0 && /'wake_date'/.test(table.slice(i, i + 900)),
      `${p} must render wake_date, the column it is sorted by`);
  }
  const i = table.indexOf('  standouts: [');
  assert.ok(i >= 0 && /'score_5d'[\s\S]{0,80}'score_22d'/.test(table.slice(i, i + 400)),
    'the Standouts overrides must render both score columns');
  ok('every default sort key is a column the preset actually renders');
}

// ── 5. The three specs that were REFUSED, and why ──────────────────────────
// Movers/decliners: membership is `pct_wtd > 0` / `pct_mtd > 0` -- a STATE
// against a reference that resets every Monday and every 1st, NOT a dated
// crossing. No breakout/breakdown date is stored anywhere on the scan row, so
// "order by breakout date" cannot be honoured; distance past the reference is
// the closest true thing. gl_breakout: the arm fires on the session of the
// cross, so gl_days_above read 1 on all 14 rows of the 2026-09-24 bar -- a
// constant, which is not an order.
{
  assert.deepEqual(studioSortOf('weekly_movers'),     { key: 'pct_wtd', dir: 'desc' });
  assert.deepEqual(studioSortOf('monthly_movers'),    { key: 'pct_mtd', dir: 'desc' });
  assert.deepEqual(studioSortOf('weekly_decliners'),  { key: 'pct_wtd', dir: 'asc'  });
  assert.deepEqual(studioSortOf('monthly_decliners'), { key: 'pct_mtd', dir: 'asc'  });
  assert.ok(!/key:\s*'(breakout|breakdown)_date'/.test(studio + table),
    'there is no breakout_date/breakdown_date column -- membership is a state, not a crossing');
  assert.deepEqual(studioSortOf('gl_breakout'), { key: 'pct_from_gl', dir: 'desc' },
    'gl_breakout must not sort by a cross date: the arm fires on the cross session, '
    + 'so every row shares one date and gl_days_above was 1 on all 14 rows');
  ok('the four period presets and gl_breakout keep the only orderings their data supports');
}

// ── 6. The redundant VaNi button is gone from the screener header ──────────
// Every /scanner* route carries the companion already (Layout's scannerRoute
// test is wider than scannerDocked for exactly that), so a second entry point
// beside the title asked a question the panel answers -- and it rendered only
// on presets with no shipped introduction, so it read as an inconsistency.
{
  assert.ok(!/VaNi explains this screener/.test(view),
    'the header button must be gone, not merely hidden behind a condition');
  assert.ok(!/openVaNiWithIntent/.test(view),
    'its handler must go with it, or the store subscription survives unused');
  ok('no "VaNi explains this screener" button in the screener header');
}

console.log(`\nscanner sort: ${n} checks passed`);
