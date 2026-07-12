// Screenshot each Catalog sub-section (static content = the swept files) in both modes.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'http://127.0.0.1:5173';
const OUT = join(import.meta.dirname, 'screens-catalog');
const USER_ID = '00000000-0000-4000-8000-000000000001';
const TABS = ['Astro Rules', 'Chart Indicators', 'Intelligence Widgets', 'Scanners'];

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', headless: true });
for (const mode of ['dark', 'light']) {
  const dir = join(OUT, mode); mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, colorScheme: mode });
  await ctx.route('**/db/**', async route => {
    const wantsObject = (route.request().headers()['accept'] || '').includes('pgrst.object');
    if (route.request().url().includes('/db/km_profiles')) {
      const row = { id: USER_ID, full_name: 'QA', display_name: 'QA', email: 'qa@h.local', phone: null, avatar_url: null, role: 'admin', onboarded: true, created_at: '2026-01-01', updated_at: '2026-01-01', tier: 'pro', expires_at: null, theme: 'kaaladristi', mode, icp_mode: 'technical' };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(wantsObject ? row : [row]) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: wantsObject ? 'null' : '[]' });
  });
  await ctx.route('**/pipeline-api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await ctx.addInitScript(({ mode, userId }) => {
    localStorage.setItem('kd_session', JSON.stringify({ access_token: 't', user: { id: userId, email: 'qa@h.local', role: 'admin' } }));
    localStorage.setItem('kd-theme', 'kaaladristi');
    localStorage.setItem('kd-theme-mode', mode);
    localStorage.setItem(`kd_welcome_ack_${userId}`, 'x');
  }, { mode, userId: USER_ID });
  const page = await ctx.newPage();
  await page.goto(BASE + '/catalog', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  for (const tab of TABS) {
    try {
      await page.getByText(tab, { exact: false }).first().click({ timeout: 3000 });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: join(dir, tab.toLowerCase().replace(/ /g, '-') + '.png') });
      console.log(`ok ${mode} ${tab}`);
    } catch (e) { console.log(`ERR ${mode} ${tab}: ${String(e).slice(0, 80)}`); }
  }
  await ctx.close();
}
await browser.close();
