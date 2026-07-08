#!/usr/bin/env node
// Glass UX & Theme Standard — Phase 6 enforcement (§9 Phase 6 / §10 anti-patterns).
//
// No CI pipeline exists in this repo yet, so this isn't wired into anything
// automatically — run it manually (`npm run check:theme`) or hook it into a
// pre-commit/CI step later. It has two modes:
//
// 1. HARD GATE — components/ui/** (the shared primitive library) must stay
//    clean of hardcoded hex/rgb literals. This is the one place in the repo
//    we've established should have zero of them, so violations here fail
//    the check. Three pre-existing files are allowlisted: DristiQLoader.tsx
//    and KaalaLoader.tsx (branded loaders — their glow colors are a fixed
//    brand identity, not meant to re-theme, same reasoning a logo mark
//    doesn't re-theme) and BetaWelcomeModal.tsx (predates this session's
//    primitives; not touched as part of this work).
//
// 2. MONITORING REPORT — the rest of src/ (views, domain components). This
//    is NOT a gate: as of 2026-07-08 there are ~588 hex/rgba literals spread
//    across ~75 files, mapping old/arbitrary colors to the current theme
//    tokens requires per-site judgment (is this decorative, semantic, or an
//    intentionally-fixed chart color?), not a mechanical sweep. Reported so
//    the number is visible and trending, not silently ignored.
//
// `calc(100vh` is reported too, but as monitoring only, not a gate: the 3
// existing hits (checked 2026-07-08) are all legitimate maxHeight/max-h
// scroll-bound calculations for panels within a height-fit layout, not the
// §5.3 anti-pattern (a `.page` wrapper using `min-height: calc(100vh-Npx)`
// instead of `min-height:100%`). A blind grep can't tell those apart, so
// gating on it here would just be noise on files that are already correct.

import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const ALLOWLIST = new Set([
  'src/components/ui/DristiQLoader.tsx',
  'src/components/ui/KaalaLoader.tsx',
  'src/components/ui/BetaWelcomeModal.tsx',
  // Neutral black box-shadows — the standard's own named exception category
  // (§9 Phase 6: "forbid hex/rgb ... except an allowlist for shimmer whites,
  // modal shadow"). Not brand colors; a themed shadow tint isn't the goal.
  'src/components/ui/Progress.tsx',
  'src/components/ui/Tooltip.tsx',
]);

function grep(pattern, path) {
  try {
    return execSync(
      `grep -rEn '${pattern}' ${path} --include="*.tsx" --include="*.ts"`,
      { encoding: 'utf-8', cwd: ROOT }
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
  console.log('✓ components/ui/ is clean of hardcoded colors (outside the 3 allowlisted files).');
}

// ── 2. calc(100vh — monitoring only (see note above on why not a gate) ──
const vhHits = grep('calc\\(100vh', 'src');
if (vhHits.length > 0) {
  console.log(`\nℹ ${vhHits.length} calc(100vh usage(s) — verify each is a scroll-bound max-height, not a .page min-height (§5.3):`);
  vhHits.forEach(line => console.log(`  ${line}`));
} else {
  console.log('✓ No calc(100vh usages.');
}

// ── 3. Monitoring only: repo-wide hex/rgba count, NOT a gate ──
const domainHexCount = grep('#[0-9a-fA-F]{3,8}\\b', 'src').filter(l => !l.includes('config/theme')).length;
const domainRgbaCount = grep('rgba?\\(', 'src').filter(l => !l.includes('config/theme')).length;
console.log(`\nℹ Monitoring (not a gate): ${domainHexCount} hex + ${domainRgbaCount} rgba literals remain outside config/theme/ — the Phase 5 color-sweep backlog.`);

process.exit(failed ? 1 : 0);
