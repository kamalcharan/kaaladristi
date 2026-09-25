#!/usr/bin/env node
/**
 * check-scanner-loading.mjs — every scanner layout says something while it
 * waits, and something else when it fails.
 *
 * Node only, no browser, no DB:  node scripts/qa/check-scanner-loading.mjs
 *
 * There are FIVE scanner layouts, not one. /scanner/:presetId routes to
 * Stage2Results, ConvictionFlowResults, FpbResults, ScannerStudio or the
 * generic branch of ScannerResults, and each renders its own results block.
 * So "the scanner has a loader" is five separate facts, and on 2026-09-25 one
 * of them was false: the Stage 2 table branch read `!isLoading && !error` and
 * rendered NOTHING -- while the scan ran, and then permanently if it failed,
 * with no message and no retry.
 *
 * That is the failure worth guarding. An absent loader is a visible annoyance;
 * an absent ERROR surface is indistinguishable from "no stocks match today",
 * and a scanner must never be ambiguous about that.
 *
 * Reads CODE with comments stripped: a comment mentioning DristiQLoader is
 * not a loader.
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const code = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const view   = code(read('../../src/views/ScanView.tsx'));
const studio = code(read('../../src/views/ScannerStudio.tsx'));

let n = 0;
const ok = (m) => { n++; console.log(`  ✓ ${m}`); };

/** A top-level `function Name(` body, to its matching closing brace at col 0. */
function fnBody(src, name) {
  const i = src.indexOf(`function ${name}(`);
  assert.ok(i >= 0, `${name} must exist`);
  const j = src.indexOf('\n}\n', i);
  assert.ok(j > i, `${name} must terminate at column 0`);
  return src.slice(i, j);
}

// ── 1. Each ScanView layout carries a loader AND an error surface ─────────
// The COUNT matters, not just presence. Stage 2 and Conviction Flow branch on
// viewMode FIRST and so need a loader and an error branch on each side; Flower
// Pot and the generic layout hoist both ABOVE the viewMode ternary and need
// one. A layout with two results branches and one error branch is the original
// bug with half of it still in place -- which is what "does it mention
// DristiQLoader" happily passes.
{
  const BRANCHES = {
    Stage2Results:         2,
    ConvictionFlowResults: 2,
    FpbResults:            1,
    ScannerResults:        1,
  };
  const count = (hay, needle) => hay.split(needle).length - 1;
  for (const [name, want] of Object.entries(BRANCHES)) {
    const body = fnBody(view, name);
    assert.equal(count(body, '<DristiQLoader'), want,
      `${name} must render DristiQLoader on each of its ${want} results branch(es)`);
    assert.equal(count(body, 'Failed to run scan'), want,
      `${name} must surface a load error on each of its ${want} results branch(es) -- `
      + 'silence reads as "no stocks match today", which is the one thing a scanner '
      + 'must never be ambiguous about');
  }
  ok('all four ScanView layouts: a loader and an error surface on every results branch');
}

// ── 2. The Studio layout too ──────────────────────────────────────────────
{
  assert.ok(/\{isLoading && <DristiQLoader \/>\}/.test(studio),
    'ScannerStudio must render DristiQLoader while loading');
  assert.ok(/\{error && <p role="alert"/.test(studio),
    'ScannerStudio must surface a load error');
  ok('the Studio layout (8 presets) renders a loader and an error surface');
}

// ── 3. The anti-pattern that caused this, by name ─────────────────────────
// `{cond && !isLoading && !error && (<Results/>)}` renders nothing in both
// the waiting AND the failed state, and it looks complete at the call site
// because the happy path is right there. A three-way ternary cannot do this.
{
  assert.ok(!/&&\s*!isLoading\s*&&\s*!error\s*&&\s*\(\s*\n\s*<Scan(Table|Cards)/.test(view),
    'a results block must not be gated on !isLoading && !error with no loader '
    + 'and no error branch -- that renders nothing, forever, on failure');
  ok('no results block is gated into silence by !isLoading && !error');
}

// ── 4. One loading state across the five layouts ──────────────────────────
// A second, layout-specific skeleton is how a product starts looking
// assembled from parts. The one that existed here was also DEAD -- defined
// inside Stage2Results, never rendered, in the exact layout with no loader.
{
  assert.ok(!/SkeletonCard/.test(view),
    'DristiQLoader is the house loading state; a second one on a single layout '
    + 'is an inconsistency, and this one was never even rendered');
  const shell = view.slice(view.indexOf('export default function ScanView'));
  assert.ok(!/<p>Loading scanners/.test(shell),
    "the page shell's own wait must use the house loader, not a bare paragraph");
  assert.ok(/<DristiQLoader message="Loading scanners/.test(shell),
    'the page shell must render DristiQLoader before a preset resolves');
  ok('one loading state, used by the shell and all five layouts');
}

console.log(`\nscanner loading: ${n} checks passed`);
