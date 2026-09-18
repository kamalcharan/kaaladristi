/**
 * Main-window horizontal overflow — every route, every breakpoint.
 *
 * `body { overflow-x: hidden }` used to sit in globals.css. On `body` (with
 * `html` at `visible`) that value propagates to the VIEWPORT, so it removed the
 * window's horizontal scrollbar rather than clipping one element: anything
 * wider than the page was unreachable and unannounced. Four routes were losing
 * real content that way, the worst being /account, where 233px of tab strip —
 * "Plan & Billing" included — simply did not exist on a phone.
 *
 * The rule is gone. This sweep is what replaces it: overflow is now a failure
 * you can read instead of a silence you cannot.
 *
 *   node scripts/qa/check-page-overflow.mjs               # needs Vite on :5173
 *   node scripts/qa/check-page-overflow.mjs --width=390   # one breakpoint
 */
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.QA_BASE_URL ?? 'http://127.0.0.1:5173';
const EXE = process.env.QA_BROWSER ?? '/opt/pw-browsers/chromium';
const USER_ID = '00000000-0000-4000-8000-000000000001';
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
}));
// 390 is the phone pass the harness already standardises on; 1280 is the
// narrowest desktop where the companion column and the nav rail both show.
const WIDTHS = args.width ? [Number(args.width)] : [390, 1280];
const ONLY = args.routes ? String(args.routes).split(',') : null;   // sabotage/debug filter
const TOLERANCE = 1; // sub-pixel rounding, not a budget for real overflow

const ROUTES = [
  '/workspace', '/markets', '/catalog', '/guide', '/market-structure',
  '/sector-rotation', '/sector-rotation/13', '/scanner', '/scanner/breakout_surge',
  '/scanner/power_buy', '/scanner/flower_pot_burst', '/scanner/wg_stirring',
  '/chart/equity/668', '/chart/index/13', '/pulse/13', '/pulse/equity/668',
  '/intraday/13', '/industry-transition', '/manipulation-watch', '/astro-calendar',
  '/almanac', '/panchang', '/rules', '/inference', '/rule-eval', '/bookmarks',
  '/account', '/settings', '/pricing', '/custom-index', '/data-pipeline',
  '/correlation/13/668', '/planetary-intel',
];

const PRESETS = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', 'presets.json'), 'utf8'));
const fixtures = await import('./qa-mobile-fixtures.mjs').catch(() => null);

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const failures = [];
try {
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: 'dark' });
    await ctx.route('**/db/**', async (route) => {
      const req = route.request(), url = new URL(req.url()), p = url.pathname;
      const wantsObject = (req.headers()['accept'] || '').includes('pgrst.object');
      const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
      if (p.includes('/db/km_profiles')) {
        const row = { id: USER_ID, full_name: 'QA', display_name: 'QA', email: 'qa@h.local', role: 'admin', onboarded: true, onboarding_version: 1, tier: 'pro', theme: 'kaaladristi', mode: 'dark' };
        return json(wantsObject ? row : [row]);
      }
      if (p.includes('/db/kd_scan_presets')) return json(PRESETS);
      if (p.includes('/db/km_scan_results') || p.includes('/db/km_equity_eod') || p.includes('/db/v_equity_eod')) {
        if (/select=trade_date(&|$)/.test(url.search)) return json([{ trade_date: '2026-09-17' }]);
        return json(fixtures ? fixtures.rowsFor((url.searchParams.get('preset_id') || 'eq.x').replace(/^eq\./, '')) : []);
      }
      if (p.includes('/db/rpc/')) return json(wantsObject ? {} : []);
      return json(wantsObject ? null : []);
    });
    await ctx.route('**/api/**', (r) => r.abort());
    await ctx.addInitScript(({ userId }) => {
      localStorage.setItem('kd_session', JSON.stringify({
        access_token: 'eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogImF1dGhlbnRpY2F0ZWQiLCAic3ViIjogIjAwMDAwMDAwLTAwMDAtNDAwMC04MDAwLTAwMDAwMDAwMDAwMSIsICJlbWFpbCI6ICJxYUBoYXJuZXNzLmxvY2FsIiwgImV4cCI6IDQxMDI0NDQ4MDB9.harness',
        user: { id: userId, email: 'qa@h.local', role: 'admin' },
      }));
      localStorage.setItem('kd-theme', 'kaaladristi');
      localStorage.setItem('kd-theme-mode', 'dark');
      localStorage.setItem(`kd_welcome_ack_${userId}`, '2026-01-01T00:00:00Z');
    }, { userId: USER_ID });

    const page = await ctx.newPage();
    const routes = ONLY ? ROUTES.filter((r) => ONLY.includes(r)) : ROUTES;
    // A blank page overflows nothing, so without this the sweep reports a clean
    // bill of health for an app that failed to boot — which is exactly what it
    // did on its first run, when a JSX syntax error in PageHeader made every
    // route 500 and all 33 came back "ok". A check that cannot fail is worse
    // than no check.
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message.slice(0, 160)));
    for (const route of routes) {
      try {
        pageErrors.length = 0;
        await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(2200);
        const live = await page.evaluate(() => ({
          rootLen: document.getElementById('root')?.innerHTML.length ?? 0,
          textLen: (document.body.innerText || '').trim().length,
          // On `body` (with `html` visible) this propagates to the VIEWPORT, so
          // it would clip the very overflow this sweep measures — i.e. the one
          // "fix" that makes every check below pass while hiding the bug. It is
          // the thing we removed; assert it has not come back.
          clip: [getComputedStyle(document.documentElement).overflowX,
                 getComputedStyle(document.body).overflowX].join('/'),
        }));
        if (/hidden|clip/.test(live.clip)) {
          failures.push({ route, width, over: 0, clipped: live.clip });
          console.log(`CLIP ${String(width).padEnd(5)} ${route.padEnd(26)} html/body overflow-x = ${live.clip} — the viewport is clipped, this sweep cannot see overflow`);
          continue;
        }
        if (live.rootLen < 200 || live.textLen < 5) {
          failures.push({ route, width, over: 0, dead: true });
          console.log(`DEAD ${String(width).padEnd(5)} ${route.padEnd(26)} rendered nothing (root ${live.rootLen}b, text ${live.textLen}c)` +
            (pageErrors.length ? ` — ${pageErrors[0]}` : ''));
          continue;
        }
        const out = await page.evaluate((w) => {
          const de = document.documentElement;
          const over = de.scrollWidth - de.clientWidth;
          if (over <= 1) return { over };
          // Name the OUTERMOST offender — an inner one is usually just carried
          // along by its parent, and `fixed` elements (parked drawers) never
          // contribute to document width however far right they sit.
          const all = [...document.querySelectorAll('body *')];
          const off = new Set(all.filter((el) => {
            const b = el.getBoundingClientRect();
            return b.width > 0 && b.right > w + 1 && getComputedStyle(el).position !== 'fixed';
          }));
          const outermost = [...off].filter((el) => {
            let a = el.parentElement;
            while (a) { if (off.has(a)) return false; a = a.parentElement; }
            return true;
          }).map((el) => {
            const b = el.getBoundingClientRect();
            const cls = typeof el.className === 'string' && el.className ? '.' + el.className.split(' ').slice(0, 3).join('.') : '';
            return { tag: el.tagName.toLowerCase() + cls, right: Math.round(b.right), text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 45) };
          }).sort((a, b) => b.right - a.right).slice(0, 2);
          return { over, outermost };
        }, width);

        if (out.over > TOLERANCE) {
          failures.push({ route, width, over: out.over, outermost: out.outermost ?? [] });
          console.log(`FAIL ${String(width).padEnd(5)} ${route.padEnd(26)} +${out.over}px`);
          for (const o of out.outermost ?? []) console.log(`        ↳ right=${o.right} ${o.tag}  "${o.text}"`);
        } else {
          console.log(`ok   ${String(width).padEnd(5)} ${route}`);
        }
      } catch (e) {
        console.log(`ERR  ${String(width).padEnd(5)} ${route.padEnd(26)} ${String(e).slice(0, 70)}`);
      }
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}

if (failures.length) {
  const dead = failures.filter((f) => f.dead).length;
  const clipped = failures.filter((f) => f.clipped).length;
  const over = failures.length - dead - clipped;
  if (clipped) console.error(`\n${clipped} route(s) clip the viewport horizontally. Reinstating body{overflow-x:hidden} does not fix an overflow, it hides it — and blinds this sweep.`);
  if (dead) console.error(`\n${dead} route(s) rendered nothing — the app is broken, not narrow. Fix that first; the overflow result means nothing until every route renders.`);
  if (over) console.error(`\n${over} route/width combination(s) overflow the main window. ` +
    `That content is unreachable on that screen — fix the row, do not reinstate body{overflow-x:hidden}.`);
  process.exit(1);
}
console.log(`\nOK — ${(ONLY ?? ROUTES).length} routes x ${WIDTHS.join('/')}px: every route renders, none clips the viewport, none overflows the main window.`);
