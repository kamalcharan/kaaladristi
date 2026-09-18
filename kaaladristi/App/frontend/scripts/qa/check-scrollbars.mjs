/**
 * Scrollbar contrast — every theme x mode x surface.
 *
 * The global thumb was `rgba(255,255,255,0.22)` in BOTH modes for seven months.
 * Over the light canvas that composites to 1.03:1 against its own background:
 * the bar was drawn, reserved its gutter, and could not be seen. Two components
 * patched around it locally; nothing measured it, so the root cause survived.
 *
 * This asserts the thing that actually broke — the RESOLVED colour, read out of
 * a live browser after applyTheme() has run, against both surfaces a scroll
 * container sits on. 3:1 is the WCAG 1.4.11 floor for non-text UI.
 *
 *   node scripts/qa/check-scrollbars.mjs        # needs Vite on 127.0.0.1:5174
 */
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const base = process.env.QA_BASE_URL ?? 'http://127.0.0.1:5174';
const exe = process.env.QA_BROWSER ?? '/opt/pw-browsers/chromium';
const MIN = 3.0;
const html = '__scrollprobe.html';
const entry = '__scrollprobe.tsx';
for (const f of [html, entry]) if (fs.existsSync(f)) throw Error('Fixture exists: ' + f);

fs.writeFileSync(html, '<html><head><meta charset="utf-8"></head><body><div id="root"></div><script type="module" src="/__scrollprobe.tsx"></script></body></html>');
fs.writeFileSync(entry, `
import {createRoot} from 'react-dom/client';
import {initTheme} from './src/stores/themeStore';
import './src/styles/globals.css';
initTheme();
createRoot(document.getElementById('root')!).render(<div style={{background:'var(--bg)',minHeight:'100vh'}}/>);
`);

const lum = (c) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };

/** Chrome serialises color-mix() as `color(srgb r g b / a)` with 0-1 channels,
 *  while hex and rgb() are 0-255. Treating the first as the second made a
 *  correct dark thumb read 1.04:1 while this check was being written — the
 *  measurement was wrong, not the CSS. Do not collapse these branches. */
function col(s) {
  if (s.startsWith('#')) return [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
  const n = s.match(/-?[\d.]+/g).map(Number);
  if (s.startsWith('color(')) return [n[0] * 255, n[1] * 255, n[2] * 255, ...(n.length > 3 ? [n[3]] : [])];
  return n;
}
const over = (fg, bg) => { const a = fg.length > 3 ? fg[3] : 1; return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)); };

const THEMES = ['kaaladristi', 'jade-thorn'];
const MODES = ['light', 'dark'];
const STATES = [['rest', '--scrollbar-thumb'], ['hover', '--scrollbar-thumb-hover']];

let browser, failures = 0;
try {
  browser = await chromium.launch({ executablePath: exe, headless: true });
  const page = await browser.newPage();
  await page.route('**/*', (r) => (r.request().url().startsWith(base) ? r.continue() : r.abort()));
  await page.goto(`${base}/${html}`);
  await page.waitForSelector('#root', { timeout: 15000 });

  for (const theme of THEMES) {
    for (const mode of MODES) {
      for (const [state, token] of STATES) {
        const v = await page.evaluate(async ([t, m, tok]) => {
          const { useThemeStore } = await import('/src/stores/themeStore.ts');
          useThemeStore.getState().setTheme(t);
          useThemeStore.getState().setMode(m);
          await new Promise((r) => setTimeout(r, 140));
          // Read the RESOLVED colour: color-mix() only collapses to channels
          // once an element actually uses it.
          const probe = document.createElement('div');
          probe.style.backgroundColor = `var(${tok})`;
          document.body.appendChild(probe);
          const thumb = getComputedStyle(probe).backgroundColor;
          probe.remove();
          const s = getComputedStyle(document.documentElement);
          return {
            thumb,
            width: getComputedStyle(document.body).scrollbarWidth,
            color: getComputedStyle(document.body).scrollbarColor,
            bg: s.getPropertyValue('--bg').trim(),
            card: s.getPropertyValue('--card').trim(),
          };
        }, [theme, mode, token]);

        const bg = col(v.bg);
        const card = over(col(v.card), bg);
        const thumb = col(v.thumb);
        const onBg = ratio(over(thumb, bg), bg);
        const onCard = ratio(over(thumb, card), card);

        // `scrollbar-width` reading `auto` means the `*` rule did not apply —
        // which is exactly what a stray brace in globals.css looks like, and
        // did look like, once. A contrast pass alone would not have caught it.
        const themed = v.color !== 'auto' && !/rgba?\(255,\s*255,\s*255/.test(v.color);
        const ok = Math.min(onBg, onCard) >= MIN && v.width === 'thin' && themed;
        if (!ok) failures++;
        console.log(
          `${ok ? 'PASS' : 'FAIL'} ${theme.padEnd(12)} ${mode.padEnd(6)} ${state.padEnd(6)} ` +
          `sw:${v.width.padEnd(5)} vs --bg ${onBg.toFixed(2).padEnd(6)} vs --card ${onCard.toFixed(2)}`
        );
      }
    }
  }
} finally {
  await browser?.close();
  for (const f of [html, entry]) if (fs.existsSync(f)) fs.unlinkSync(f);
}

if (failures) {
  console.error(`\n${failures} scrollbar combination(s) below ${MIN}:1 — the bar is there but cannot be seen.`);
  process.exit(1);
}
console.log(`\nOK — thin bar, all ${THEMES.length * MODES.length * STATES.length} combinations clear the ${MIN}:1 non-text floor.`);
