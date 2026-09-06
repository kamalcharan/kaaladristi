// Mobile-viewport QA for the scanner pages — same stub approach as
// qa-screenshots.mjs, but with real-shaped scan rows so the table / cards /
// filter bar actually render, and a phone viewport.
// Usage: node scripts/qa/qa-mobile.mjs [--width=390] [--routes=/scanner/power_buy,...] [--view=table|cards] [--tag=before]
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'http://127.0.0.1:5173';
const USER_ID = '00000000-0000-4000-8000-000000000001';
const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
}));
const WIDTH = Number(args.width || 390);
const HEIGHT = WIDTH >= 1000 ? 1000 : 844;
const VIEW = args.view || 'table';
const TAG = args.tag || 'shot';
const OUT = join(import.meta.dirname, 'screens-mobile', `${TAG}-${WIDTH}-${VIEW}`);
const ROUTES = (args.routes || [
  '/scanner/power_buy', '/scanner/smart_money', '/scanner/stage_2_leaders',
  '/scanner/conviction_flow', '/scanner/flower_pot_burst', '/scanner/waking_giants',
  '/scanner/breakout_surge', '/scanner/weekly_decliners', '/scanner/gl_breakout',
].join(',')).split(',');
const slug = r => r.replace(/^\//, '').replace(/[/:]+/g, '_');

import { rowsFor } from './qa-mobile-fixtures.mjs';
async function run() {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', headless: true });
  mkdirSync(OUT, { recursive: true });
  const ctx = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT }, colorScheme: 'dark',
    isMobile: WIDTH < 800, hasTouch: WIDTH < 800, deviceScaleFactor: 2,
  });
  await ctx.route('**/db/**', async route => {
    const req = route.request(); const url = new URL(req.url());
    const accept = req.headers()['accept'] || ''; const wantsObject = accept.includes('pgrst.object');
    const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    const p = url.pathname;
    if (p.includes('/db/km_profiles')) {
      const row = { id: USER_ID, full_name: 'QA Harness', display_name: 'QA', email: 'qa@harness.local', role: 'admin', onboarded: true, tier: 'pro', expires_at: null, theme: 'kaaladristi', mode: 'dark', icp_mode: 'astro', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };
      return json(wantsObject ? row : [row]);
    }
    if (p.includes('/db/kd_scan_presets')) return json(PRESETS);
    if (p.includes('/db/km_scan_results')) {
      const pid = (url.searchParams.get('preset_id') || 'eq.power_buy').replace(/^eq\./, '');
      if (url.searchParams.get('select')?.includes('preset_id,exchange')) {
        return json(PRESETS.flatMap(pr => rowsFor(pr.id).map(r => ({ preset_id: pr.id, exchange: 'NSE', isin: r.isin, vani_flag: r.vani_flag, trade_date: r.trade_date }))));
      }
      return json(rowsFor(pid));
    }
    if (p.includes('/db/km_equity_eod') || p.includes('/db/v_equity_eod')) {
      if (url.searchParams.get('select') === 'trade_date' || /select=trade_date(&|$)/.test(url.search)) return json([{ trade_date: '2026-09-04' }]);
      return json(rowsFor('direct'));
    }
    if (p.includes('/db/rpc/')) return json(wantsObject ? {} : []);
    return json(wantsObject ? null : []);
  });
  await ctx.route('**/pipeline-api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/**', route => route.abort());
  await ctx.addInitScript(({ userId, view }) => {
    localStorage.setItem('kd_session', JSON.stringify({ access_token: 'eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogImF1dGhlbnRpY2F0ZWQiLCAic3ViIjogIjAwMDAwMDAwLTAwMDAtNDAwMC04MDAwLTAwMDAwMDAwMDAwMSIsICJlbWFpbCI6ICJxYUBoYXJuZXNzLmxvY2FsIiwgImV4cCI6IDQxMDI0NDQ4MDB9.harness', user: { id: userId, email: 'qa@harness.local', full_name: 'QA Harness', role: 'admin' } }));
    localStorage.setItem('kd-theme', 'kaaladristi'); localStorage.setItem('kd-theme-mode', 'dark');
    localStorage.setItem(`kd_welcome_ack_${userId}`, '2026-01-01T00:00:00Z');
    // Guided Walk (hooks/useTour.ts) — mark the scanner tour seen so it does not cover the page.
    localStorage.setItem(`kd_tour_page-scanner_${userId}`, '2026-01-01T00:00:00Z');
    localStorage.setItem('scan_view_mode', view);
  }, { userId: USER_ID, view: VIEW });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  for (const r of ROUTES) {
    try {
      await page.goto(BASE + r, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(2500);
      const overflow = await page.evaluate(() => ({ docW: document.documentElement.scrollWidth, vw: window.innerWidth }));
      await page.screenshot({ path: join(OUT, slug(r) + '.png'), fullPage: true });
      process.stdout.write(`ok  ${WIDTH} ${r}  docWidth=${overflow.docW} vw=${overflow.vw}${overflow.docW > overflow.vw ? '  <-- HORIZONTAL OVERFLOW' : ''}\n`);
    } catch (e) { process.stdout.write(`ERR ${r} — ${String(e).slice(0, 140)}\n`); }
  }
  if (errs.length) process.stdout.write(`pageerrors: ${[...new Set(errs)].slice(0, 6).join(' | ')}\n`);
  await browser.close();
}
const PRESETS = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', 'presets.json'), 'utf8'));
run();
