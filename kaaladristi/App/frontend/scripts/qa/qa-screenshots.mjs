// Kāla-Drishti theme QA harness — screenshots every route × mode × theme
// against the local vite dev server with stubbed auth + data.
// Usage: node shoot.mjs [--themes kaaladristi,tech-ai,jade-thorn] [--modes dark,light] [--routes /workspace,...]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'http://127.0.0.1:5173';
const OUT = join(import.meta.dirname, 'screens');
const USER_ID = '00000000-0000-4000-8000-000000000001';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
}));
const THEMES = (args.themes || 'kaaladristi,tech-ai,jade-thorn').split(',');
const MODES = (args.modes || 'dark,light').split(',');

const ROUTES = args.routes ? args.routes.split(',') : [
  '/', '/login',
  '/workspace', '/catalog', '/scanner', '/sector-rotation',
  '/sector-rotation/1', '/correlation/RULE_A/RULE_B',
  '/markets', '/market-structure', '/chart/index/1',
  '/pulse/1', '/pulse/equity/1', '/intraday/1',
  '/astro-calendar', '/inference', '/rule-eval', '/rules', '/rules/1',
  '/manipulation-watch', '/industry-transition', '/panchang',
  '/planetary-intel', '/settings', '/account', '/pricing',
  '/custom-index', '/custom-index/create', '/custom-index/discover',
  '/data-pipeline', '/users', '/admin/panchang',
];

const slug = r => r === '/' ? 'landing' : r.replace(/^\//, '').replace(/[/:]+/g, '_');

function profileRow(theme, mode) {
  return {
    id: USER_ID, full_name: 'QA Harness', display_name: 'QA', email: 'qa@harness.local',
    phone: null, avatar_url: null, role: 'admin', onboarded: true,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    tier: 'pro', expires_at: null, theme, mode, icp_mode: 'astro',
  };
}

async function run() {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium',
    headless: true,
  });

  for (const theme of THEMES) {
    for (const mode of MODES) {
      const dir = join(OUT, theme, mode);
      mkdirSync(dir, { recursive: true });
      const ctx = await browser.newContext({
        viewport: { width: 1600, height: 1000 },
        colorScheme: mode === 'light' ? 'light' : 'dark',
      });

      // ── stub all API traffic ──
      await ctx.route('**/db/**', async route => {
        const req = route.request();
        const url = req.url();
        const accept = req.headers()['accept'] || '';
        const wantsObject = accept.includes('pgrst.object');
        if (url.includes('/db/km_profiles')) {
          const row = profileRow(theme, mode);
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(wantsObject ? row : [row]) });
        }
        if (url.includes('/db/rpc/')) {
          return route.fulfill({ status: 200, contentType: 'application/json', body: wantsObject ? '{}' : '[]' });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: wantsObject ? 'null' : '[]' });
      });
      await ctx.route('**/pipeline-api/**', route => {
        const u = route.request().url();
        if (u.includes('/api/framework/')) {
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
            id: 'fw-harness', user_id: USER_ID, name: 'My Framework',
            created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
            version: 1, instruments: [], blocks: [], chart_overlays: [], tier_at_creation: 'pro',
          }) });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      });

      // ── seed auth + theme + welcome-ack before any page script runs ──
      await ctx.addInitScript(({ theme, mode, userId }) => {
        localStorage.setItem('kd_session', JSON.stringify({
          access_token: 'harness-token',
          user: { id: userId, email: 'qa@harness.local', full_name: 'QA Harness', role: 'admin' },
        }));
        localStorage.setItem('kd-theme', theme);
        localStorage.setItem('kd-theme-mode', mode);
        localStorage.setItem(`kd_welcome_ack_${userId}`, '2026-01-01T00:00:00Z');
      }, { theme, mode, userId: USER_ID });

      const page = await ctx.newPage();
      const consoleErrors = [];
      page.on('pageerror', e => consoleErrors.push(String(e).slice(0, 200)));

      for (const r of ROUTES) {
        try {
          await page.goto(BASE + r, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await page.waitForTimeout(2200); // let queries settle into empty/error states
          await page.screenshot({ path: join(dir, slug(r) + '.png'), fullPage: false });
          process.stdout.write(`ok  ${theme}/${mode} ${r}\n`);
        } catch (e) {
          process.stdout.write(`ERR ${theme}/${mode} ${r} — ${String(e).slice(0, 120)}\n`);
        }
      }
      if (consoleErrors.length) {
        process.stdout.write(`  pageerrors(${theme}/${mode}): ${[...new Set(consoleErrors)].slice(0, 5).join(' | ')}\n`);
      }
      await ctx.close();
    }
  }
  await browser.close();
}
run();
