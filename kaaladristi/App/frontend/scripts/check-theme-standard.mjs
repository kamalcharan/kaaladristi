#!/usr/bin/env node
// Glass UX & Theme Standard — enforcement (§9 Phase 6 / §10 anti-patterns).
//
// Wired into `npm run build` (2026-07-12) so the Docker image build fails on
// violations. Run standalone via `npm run check:theme`.
//
// GATES (fail the check):
//   1. components/ui/** must stay free of hardcoded hex/rgb literals
//      (small allowlist below).
//   2. PHANTOM VARS — every `var(--x)` consumed anywhere in src/ must have a
//      definition somewhere (applyTheme setProperty, globals.css declaration,
//      the index.html FOUC script, or a component-level `'--x':` inline
//      definition). Phantom vars render their fallback forever (permanent
//      #0d1117 boxes) or nothing at all (transparent panels) — the #1 root
//      cause of the 2026-07 light-mode mess. See docs/claude/glass-ux-status.md §2.
//   3. DARK-ASSUMPTION FILLS — `background: rgba(0,0,0,…)`/near-black hex
//      fills in component code break light mode. Intentional ones (scrims,
//      contrast rings, the fixed-dark landing page) must carry a
//      `theme-agnostic` comment on the same or the preceding line; anything
//      unmarked fails.
//   4. LITERAL-COUNT RATCHET — the repo-wide hex/rgba literal count may only
//      go DOWN. Baseline lives in scripts/theme-baseline.json; when you
//      remove literals, re-run with --update-baseline to lower the floor.
//
// MONITORING (reported, not gated): calc(100vh usages — the existing hits are
// legitimate scroll-bound max-heights, not the §5.3 .page anti-pattern.

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'theme-baseline.json');
const UPDATE_BASELINE = process.argv.includes('--update-baseline');

const ALLOWLIST = new Set([
  'src/components/ui/DristiQLoader.tsx',
  'src/components/ui/KaalaLoader.tsx',
  'src/components/ui/BetaWelcomeModal.tsx',
  // Neutral black box-shadows — the standard's own named exception category.
  'src/components/ui/Progress.tsx',
  'src/components/ui/Tooltip.tsx',
]);

// Vars that are defined by tooling/browser, not by us.
const VAR_ALLOWLIST = new Set(['--tw-opacity']);

function grep(pattern, path, extra = '') {
  try {
    return execSync(
      `grep -rEn '${pattern}' ${path} --include="*.tsx" --include="*.ts" ${extra}`,
      { encoding: 'utf-8', cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }
    ).trim().split('\n').filter(Boolean);
  } catch {
    return []; // grep exits 1 on no matches
  }
}

let failed = false;

// ── 1. Hard gate: components/ui/** must be hex/rgb-free (minus allowlist) ──
const uiHits = grep('#[0-9a-fA-F]{3,8}\\b|rgba?\\(', 'src/components/ui')
  .filter(line => !ALLOWLIST.has(line.split(':')[0]));

if (uiHits.length > 0) {
  failed = true;
  console.error(`\n✗ Hardcoded color literal(s) in components/ui/ (should be var(--...) only):`);
  uiHits.forEach(line => console.error(`  ${line}`));
} else {
  console.log('✓ components/ui/ clean of hardcoded colors (outside the allowlisted files).');
}

// ── 2. Hard gate: phantom CSS vars (used but never defined) ──
function* walk(dir) {
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = join(dir, e.name);
    if (e.isDirectory()) yield* walk(rel);
    else if (/\.(tsx?|css)$/.test(e.name)) yield rel;
  }
}
function collectDefined() {
  const defined = new Set(VAR_ALLOWLIST);
  const sources = [...walk('src'), 'index.html'];
  for (const file of sources) {
    const t = readFileSync(join(ROOT, file), 'utf-8');
    // runtime: setProperty('--x', …) and the applyTheme set('--x', …) helper
    for (const m of t.matchAll(/set(?:Property)?\(\s*["'](--[a-zA-Z0-9-]+)["']/g)) defined.add(m[1]);
    // component-level inline definitions: '--x': value
    for (const m of t.matchAll(/["'](--[a-zA-Z0-9-]+)["']\s*:/g)) defined.add(m[1]);
    // CSS declarations: --x: value  (css files + <style> blocks/template strings)
    if (/\.css$/.test(file) || file === 'index.html' || t.includes('@keyframes') || t.includes('<style')) {
      for (const m of t.matchAll(/(^|[\s;{])(--[a-zA-Z0-9-]+)\s*:/gm)) defined.add(m[2]);
    }
  }
  return defined;
}
const defined = collectDefined();
const phantomHits = [];
for (const l of grep('var\\(--[a-zA-Z0-9-]+', 'src')) {
  for (const m of l.matchAll(/var\((--[a-zA-Z0-9-]+)/g)) {
    if (!defined.has(m[1])) phantomHits.push(`${l.split(':').slice(0, 2).join(':')}  →  ${m[1]}`);
  }
}
// index.html body also consumes vars
if (phantomHits.length > 0) {
  failed = true;
  console.error(`\n✗ Phantom CSS var(s) — consumed but defined nowhere (fallback-or-nothing renders forever):`);
  [...new Set(phantomHits)].forEach(h => console.error(`  ${h}`));
} else {
  console.log('✓ No phantom CSS vars (every var(--x) consumed in src/ has a definition).');
}

// ── 3. Hard gate: un-annotated dark-assumption background fills ──
const DARK_FILL = 'background[^;]*?(rgba\\(0, ?0, ?0|rgba\\(255, ?255, ?255|#0d1117|#0f172a|#1e293b|#0a0[a-f0-9]|#111\\b|#000\\b)';
const fillFiles = {};
for (const l of grep(DARK_FILL, 'src')) {
  if (l.includes('var(--')) continue;           // token with fallback handled by gate 2
  const [file, lineNo] = l.split(':');
  (fillFiles[file] ??= []).push(Number(lineNo));
}
const unmarked = [];
for (const [file, lines] of Object.entries(fillFiles)) {
  const src = readFileSync(join(ROOT, file), 'utf-8').split('\n');
  for (const n of lines) {
    const here = src[n - 1] ?? '', above = src[n - 2] ?? '';
    if (!here.includes('theme-agnostic') && !above.includes('theme-agnostic')) {
      unmarked.push(`${file}:${n}`);
    }
  }
}
if (unmarked.length > 0) {
  failed = true;
  console.error(`\n✗ Un-annotated dark-assumption background fill(s) — breaks light mode.`);
  console.error(`  Either replace with a token (--panel-recess / --overlay / --card) or, if genuinely`);
  console.error(`  theme-agnostic, add a "theme-agnostic: <reason>" comment on the same/previous line:`);
  unmarked.forEach(h => console.error(`  ${h}`));
} else {
  console.log('✓ All dark-literal background fills are either tokenized or explicitly theme-agnostic.');
}

// ── 4. Hard gate: literal-count ratchet ──
const hexCount = grep('#[0-9a-fA-F]{3,8}\\b', 'src').filter(l => !l.includes('config/theme')).length;
const rgbaCount = grep('rgba?\\(', 'src').filter(l => !l.includes('config/theme')).length;
const current = { hex: hexCount, rgba: rgbaCount };
if (!existsSync(BASELINE_PATH) || UPDATE_BASELINE) {
  writeFileSync(BASELINE_PATH, JSON.stringify(current, null, 2) + '\n');
  console.log(`✓ Ratchet baseline ${UPDATE_BASELINE ? 'updated' : 'created'}: ${hexCount} hex + ${rgbaCount} rgba.`);
} else {
  const base = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'));
  if (hexCount > base.hex || rgbaCount > base.rgba) {
    failed = true;
    console.error(`\n✗ Literal-count ratchet: ${hexCount} hex (baseline ${base.hex}), ${rgbaCount} rgba (baseline ${base.rgba}).`);
    console.error('  New hardcoded colors were added — use theme tokens instead.');
  } else {
    console.log(`✓ Ratchet: ${hexCount} hex + ${rgbaCount} rgba (baseline ${base.hex}+${base.rgba}, may only go down).`);
    if (hexCount < base.hex || rgbaCount < base.rgba) {
      writeFileSync(BASELINE_PATH, JSON.stringify(current, null, 2) + '\n');
      console.log('  Baseline lowered to the new count.');
    }
  }
}

// ── 5. Monitoring: calc(100vh ──
const vhHits = grep('calc\\(100vh', 'src');
if (vhHits.length > 0) {
  console.log(`\nℹ ${vhHits.length} calc(100vh usage(s) — verify each is a scroll-bound max-height, not a .page min-height (§5.3):`);
  vhHits.forEach(line => console.log(`  ${line}`));
}

process.exit(failed ? 1 : 0);
