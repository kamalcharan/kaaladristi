/**
 * Text-token contrast gate — runs inside `npm run build`.
 *
 *   node scripts/check-text-contrast.mjs
 *
 * WHY THIS EXISTS
 *
 * On 2026-09-22 the owner reported "words are hard to read" across the
 * product. Measured on the LAUNCH theme (Vikuna Black, dark — the app is
 * dark-locked), the two lowest text tiers were:
 *
 *     --text-muted   2.51:1 on --bg, 2.48:1 on --card
 *     --text-faint   2.00:1 on --bg, 2.04:1 on --card
 *
 * Both below WCAG's 3:1 floor for even large or decorative text, while
 * carrying real sentences at 9–10px. The tokens were not hardcoded literals
 * and no existing gate could see them: check-theme-standard.mjs hunts for hex
 * and rgba literals, which these are not — they are correctly tokenized values
 * that are simply too dim.
 *
 * The root cause is instructive and is the reason this file is a GATE and not
 * a one-off fix: every light-mode value in config/theme/index.ts carries a
 * measured comment, and the dark branch carried the assertion "reads fine in
 * dark mode … still has presence". Nobody had put a number on dark. That is
 * the same shape as the scrollbar thumb (1.97:1, survived seven months because
 * it was "thin but perceptible") and the BreadthLadder stub. Dim-but-present
 * is exactly the failure that eyes forgive and arithmetic does not.
 *
 * WHAT IT ASSERTS
 *
 * For every theme × mode, each text token composited over BOTH --bg and --card
 * must clear its floor, and the ramp must stay ordered (primary brighter than
 * secondary brighter than muted brighter than faint). The ordering check
 * matters as much as the floors: raising a tier past the one above it destroys
 * the hierarchy just as surely as leaving it invisible.
 *
 * FLOORS are per mode and the difference is deliberate — see the FLOORS block.
 * In DARK, every tier but decorative --text-faint must hold 4.5:1. That became
 * reachable on 2026-09-22 when the owner approved lifting Vikuna Black's
 * secondaryText (#7A8099 -> #9ba0b2): the old value was AA for itself at 4.63
 * but left no room beneath it, capping muted at 3.70. Note that raising TYPE
 * SIZE would not have helped — WCAG's 3:1 "large text" tier starts at 24px
 * (18.7px bold), so 9px -> 11px stays normal text at 4.5:1. Only the palette
 * moves the ratio; type size buys legibility, which is a separate pass.
 */

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── colour maths (WCAG 2.x relative luminance) ───────────────────────────
const hex2rgb = (h) => {
  const s = h.replace('#', '').trim();
  const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
};
const parse = (v) => {
  const s = String(v).trim();
  const m = s.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/);
  if (m) return { rgb: [+m[1], +m[2], +m[3]], a: m[4] === undefined ? 1 : +m[4] };
  if (s.startsWith('#')) return { rgb: hex2rgb(s), a: 1 };
  return null;
};
const lin = (c) => { const x = c / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const over = (fg, a, bg) => fg.map((c, i) => Math.round(c * a + bg[i] * (1 - a)));
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

// ── load the real theme module, no stubs ────────────────────────────────
function load(rel, deps = {}) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  new Function('exports', 'require', js)(exports, (m) => deps[m] ?? {});
  return exports;
}

// applyTheme() writes through element.style.setProperty — capture that.
function tokensFor(theme, prefersDark) {
  const vars = {};
  const el = { style: { setProperty: (k, v) => { vars[k] = v; } } };
  const g = globalThis;
  const prevDoc = g.document;
  g.document = { documentElement: el, body: el };
  try {
    themeMod.applyTheme(theme, prefersDark);
  } finally {
    if (prevDoc === undefined) delete g.document; else g.document = prevDoc;
  }
  return vars;
}

const themeMod = load('src/config/theme/index.ts', {
  './themes/kaaladristi': load('src/config/theme/themes/kaaladristi.ts'),
  './themes/jadeThorn': load('src/config/theme/themes/jadeThorn.ts'),
});

// ── the contract ────────────────────────────────────────────────────────
// Floors are PER MODE, because the two modes are in different states.
//
// DARK is the shipping surface (the app is dark-locked for launch) and, since
// secondaryText was lifted on 2026-09-22, every tier but decorative --text-faint
// holds 4.5:1. That is locked in here so it cannot quietly slip back.
//
// LIGHT is held at 3.0 on muted, and that is a RECORDED GAP, not an opinion
// that 3.0 is enough. Vikuna light muted is 3.48 and Jade light 3.77; both can
// reach AA, but only by materially darkening secondaryText (#6f6354 -> ~#534a3f
// and #5e5c5a -> ~#4b4a48), and those light palettes were owner-calibrated over
// five sessions with A/B/C picks (see docs/claude/theme-session-2026-07-12.md).
// Overriding that unilaterally would trade one owner decision for a compliance
// number, on a mode that does not currently ship. Raise these to 4.5 when light
// mode is re-calibrated for release — the numbers above are the targets.
const FLOORS = {
  dark:  { '--text-primary': 4.5, '--text-secondary': 4.5, '--text-muted': 4.5, '--text-faint': 3.0 },
  light: { '--text-primary': 4.5, '--text-secondary': 4.5, '--text-muted': 3.0, '--text-faint': 3.0 },
};
const RAMP = ['--text-primary', '--text-secondary', '--text-muted', '--text-faint'];
const SURFACES = ['--bg', '--card'];

// The registry itself is module-private; the two theme configs are exported
// by name, which is the stable surface.
const list = [themeMod.KaalaDrishtiTheme, themeMod.JadeThornTheme].filter(Boolean);
if (!list.length) {
  console.error('✗ contrast gate could not load any theme — check the export name.');
  process.exit(1);
}

let failed = 0;
const rows = [];

for (const theme of list) {
  for (const prefersDark of [true, false]) {
    const vars = tokensFor(theme, prefersDark);
    const modeName = prefersDark ? 'dark' : 'light';
    const floors = FLOORS[modeName];
    const label = `${theme.name ?? theme.id ?? 'theme'} ${modeName}`;

    // A dark-only theme has no meaningful light pass.
    if (!prefersDark && theme.darkOnly) continue;

    const surf = {};
    for (const s of SURFACES) {
      const p = parse(vars[s]);
      if (!p) { console.error(`✗ ${label}: ${s} unparseable (${vars[s]})`); failed++; continue; }
      surf[s] = p.rgb;
    }

    const worst = {};
    for (const tok of RAMP) {
      const p = parse(vars[tok]);
      if (!p) { console.error(`✗ ${label}: ${tok} unparseable (${vars[tok]})`); failed++; continue; }
      let w = Infinity;
      for (const s of SURFACES) {
        if (!surf[s]) continue;
        const r = ratio(over(p.rgb, p.a, surf[s]), surf[s]);
        if (r < w) w = r;
        if (r < floors[tok]) {
          console.error(`✗ ${label}: ${tok} on ${s} = ${r.toFixed(2)}:1 (floor ${floors[tok]}:1)`);
          failed++;
        }
      }
      worst[tok] = w;
      rows.push(`    ${label.padEnd(26)} ${tok.padEnd(18)} ${w.toFixed(2)}`);
    }

    // Ordering: each tier must be strictly dimmer than the one above it.
    for (let i = 1; i < RAMP.length; i++) {
      const [hi, lo] = [RAMP[i - 1], RAMP[i]];
      if (worst[hi] !== undefined && worst[lo] !== undefined && worst[lo] >= worst[hi]) {
        console.error(
          `✗ ${label}: ramp inverted — ${lo} (${worst[lo].toFixed(2)}) is not dimmer than ${hi} (${worst[hi].toFixed(2)})`);
        failed++;
      }
    }
  }
}

if (failed) {
  console.error(`\n✗ Text contrast: ${failed} violation(s). Fix the token in config/theme/index.ts — never per-component.`);
  process.exit(1);
}

console.log('✓ Text tokens clear their contrast floors on --bg and --card, ramp ordered, all themes x modes.');
if (process.env.CONTRAST_VERBOSE) console.log(rows.join('\n'));
