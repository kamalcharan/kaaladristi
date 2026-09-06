// Lists elements whose right edge exceeds the device width — pinpoints what
// forces a phone to zoom out instead of eyeballing screenshots.
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const BASE = 'http://127.0.0.1:5173'; const USER_ID = '00000000-0000-4000-8000-000000000001';
const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true]; }));
const WIDTH = Number(args.width || 390);
const VIEW = args.view || 'table';
const ROUTES = (args.routes || '/scanner/power_buy,/scanner/breakout_surge,/scanner/stage_2_leaders').split(',');
const PRESETS = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', 'presets.json'), 'utf8'));
const mod = await import('./qa-mobile-fixtures.mjs').catch(() => null);
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', headless: true });
const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 844 }, colorScheme: 'dark', isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.route('**/db/**', async route => {
  const req = route.request(); const url = new URL(req.url()); const p = url.pathname;
  const wantsObject = (req.headers()['accept'] || '').includes('pgrst.object');
  const json = b => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
  if (p.includes('/db/km_profiles')) { const row = { id: USER_ID, full_name: 'QA', display_name: 'QA', email: 'qa@h.local', role: 'admin', onboarded: true, tier: 'pro', theme: 'kaaladristi', mode: 'dark', icp_mode: 'astro' }; return json(wantsObject ? row : [row]); }
  if (p.includes('/db/kd_scan_presets')) return json(PRESETS);
  if (p.includes('/db/km_scan_results') || p.includes('/db/km_equity_eod') || p.includes('/db/v_equity_eod')) {
    if (/select=trade_date(&|$)/.test(url.search)) return json([{ trade_date: '2026-09-04' }]);
    return json(mod ? mod.rowsFor((url.searchParams.get('preset_id') || 'eq.x').replace(/^eq\./, '')) : []);
  }
  if (p.includes('/db/rpc/')) return json(wantsObject ? {} : []);
  return json(wantsObject ? null : []);
});
await ctx.route('**/pipeline-api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
await ctx.route('**/api/**', r => r.abort());
await ctx.addInitScript(({ userId, view }) => {
  localStorage.setItem('kd_session', JSON.stringify({ access_token: 'eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogImF1dGhlbnRpY2F0ZWQiLCAic3ViIjogIjAwMDAwMDAwLTAwMDAtNDAwMC04MDAwLTAwMDAwMDAwMDAwMSIsICJlbWFpbCI6ICJxYUBoYXJuZXNzLmxvY2FsIiwgImV4cCI6IDQxMDI0NDQ4MDB9.harness', user: { id: userId, email: 'qa@h.local', full_name: 'QA', role: 'admin' } }));
  localStorage.setItem('kd-theme', 'kaaladristi'); localStorage.setItem('kd-theme-mode', 'dark');
  localStorage.setItem(`kd_welcome_ack_${userId}`, '2026-01-01T00:00:00Z');
    // Guided Walk (hooks/useTour.ts) — mark the scanner tour seen so it does not cover the page.
    localStorage.setItem(`kd_tour_page-scanner_${userId}`, '2026-01-01T00:00:00Z'); localStorage.setItem('scan_view_mode', view);
}, { userId: USER_ID, view: VIEW });
const page = await ctx.newPage();
for (const r of ROUTES) {
  await page.goto(BASE + r, { waitUntil: 'domcontentloaded', timeout: 20000 }); await page.waitForTimeout(2500);
  const grid = await page.evaluate(() => { const g=[...document.querySelectorAll('div')].find(d=>(d.getAttribute('style')||'').includes('auto-fit')); if(!g) return null; const r=g.getBoundingClientRect(); return { gridW: Math.round(r.width), cols: getComputedStyle(g).gridTemplateColumns, style: (g.getAttribute('style')||'').slice(0,120) }; }); if (grid) console.log('  studio grid:', JSON.stringify(grid));
  const out = await page.evaluate((W) => {
    const rows = [];
    const all = [...document.querySelectorAll('body *')];
    const offending = new Set(all.filter(el => { const b = el.getBoundingClientRect(); return b.width > 0 && b.right > W + 1; }));
    for (const el of offending) {
      // outermost only: skip if an ancestor is also an offender
      let a = el.parentElement, skip = false; while (a) { if (offending.has(a)) { skip = true; break; } a = a.parentElement; }
      if (skip) continue;
      const b = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      const desc = `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').slice(0, 3).join('.') : ''}`;
      const style = el.getAttribute('style') || ''; const txt = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50);
      rows.push({ desc, left: Math.round(b.left), right: Math.round(b.right), w: Math.round(b.width), pos: cs.position, txt, style: style.slice(0, 160) });
    }
    return { vw: innerWidth, docW: document.documentElement.scrollWidth, offenders: rows.slice(0, 25) };
  }, WIDTH);
  console.log(`\n=== ${r}  innerWidth=${out.vw} docWidth=${out.docW}`);
  for (const o of out.offenders) console.log(`  right=${o.right} left=${o.left} w=${o.w} ${o.pos.padEnd(8)} ${o.desc}  "${o.txt}"\n      style: ${o.style}`);
}
await browser.close();
