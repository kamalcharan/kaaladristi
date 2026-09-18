/**
 * VaNi companion open/closed — the rail, the reclaimed width, and persistence.
 *
 * Renders the REAL Layout (the only place that knows about the closed state)
 * at one route from each companion family, with every external request
 * blocked. The width assertion is the point: "the page gains the space" is the
 * whole request, and a collapse that hides the panel without widening the
 * content would pass every structural check.
 *
 *   node scripts/qa/check-vani-panel.mjs        # needs Vite on 127.0.0.1:5174
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const base = process.env.QA_BASE_URL ?? 'http://127.0.0.1:5174';
const exe = process.env.QA_BROWSER ?? '/opt/pw-browsers/chromium';
const html = '__vani_panel.html';
const entry = '__vani_panel.tsx';
for (const f of [html, entry]) if (fs.existsSync(f)) throw Error('Fixture exists: ' + f);

fs.writeFileSync(html, '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__vani_panel.tsx"></script></body></html>');
fs.writeFileSync(entry, `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import Layout from './src/components/domain/Layout';
import ScannerCompanionShell from './src/components/domain/VaNi/ScannerCompanionShell';
import {initTheme} from './src/stores/themeStore';
import './src/styles/globals.css';
initTheme();
const client=new QueryClient({defaultOptions:{queries:{enabled:false,retry:false}}});
const route=new URLSearchParams(location.search).get('route')??'/workspace';
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={client}>
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route element={<Layout/>}>
          <Route path="*" element={<>
            {/* Price Action presets get an EMPTY dock host and portal into it
                from the page, exactly as ScanView does for Flower Pot. A shell
                that finds no host renders inline, which is the case worth
                proving: the width must be freed, not just the column hidden. */}
            {route.startsWith('/scanner/flower_pot_burst') && <ScannerCompanionShell presetId="flower_pot_burst" subtitle="Coil research">{null}</ScannerCompanionShell>}
            <div data-qa="content" style={{height:400}}>content</div>
          </>}/>
        </Route>
      </Routes>
    </MemoryRouter>
  </QueryClientProvider>
);
`);

const ROUTES = [
  ['/workspace', 'Workspace docked pane'],
  ['/market-structure', 'Market Structure companion'],
  ['/sector-rotation', 'Sector Rotation companion'],
  ['/scanner/wg_stirring', 'Scanner dock (route-owned default)'],
  ['/scanner/flower_pot_burst', 'Scanner shell portalled from the page'],
];

const widthOf = (page) => page.locator('[data-qa="content"]').evaluate(el => el.parentElement.getBoundingClientRect().width);

let browser;
try {
  browser = await chromium.launch({ executablePath: exe, headless: true });
  for (const [route, label] of ROUTES) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await ctx.addInitScript(() => {
      localStorage.setItem('kd_session', JSON.stringify({
        access_token: 'eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogImF1dGhlbnRpY2F0ZWQiLCAic3ViIjogIjAwMDAwMDAwLTAwMDAtNDAwMC04MDAwLTAwMDAwMDAwMDAwMSIsICJlbWFpbCI6ICJxYUBoYXJuZXNzLmxvY2FsIiwgImV4cCI6IDQxMDI0NDQ4MDB9.harness',
        user: { id: '00000000-0000-4000-8000-000000000001', email: 'qa@harness.local' },
      }));
      // NOT clearing kd_vani_panel here: addInitScript runs on EVERY
      // navigation, so a clear would wipe the preference the reload is
      // supposed to prove. Each route gets a fresh context, so it starts unset.
    });
    const page = await ctx.newPage();
    await page.route('**/*', r => r.request().url().startsWith(base) && !r.request().url().includes('/api/') ? r.continue() : r.abort());
    await page.goto(`${base}/${html}?route=${encodeURIComponent(route)}`);

    // 1. Default is open: the companion is on screen, the rail is not.
    const hide = page.getByRole('button', { name: 'Hide VaNi' });
    await hide.first().waitFor({ timeout: 8000 });
    assert.equal(await page.getByRole('button', { name: 'Show VaNi' }).count(), 0, `${label}: rail showing while open`);
    const openWidth = await widthOf(page);

    // 2. Collapsing swaps the panel for the rail AND widens the content.
    await hide.first().click();
    const show = page.getByRole('button', { name: 'Show VaNi' });
    await show.waitFor({ timeout: 5000 });
    assert.equal(await page.getByRole('button', { name: 'Hide VaNi' }).count(), 0, `${label}: collapse control survived the collapse`);
    const closedWidth = await widthOf(page);
    assert.ok(closedWidth > openWidth + 100, `${label}: content did not gain the space (${openWidth} -> ${closedWidth})`);

    // 3. The choice is the preference — a fresh load stays closed.
    await page.goto(`${base}/${html}?route=${encodeURIComponent(route)}`);
    await page.getByRole('button', { name: 'Show VaNi' }).waitFor({ timeout: 8000 });
    assert.equal(await page.getByRole('button', { name: 'Hide VaNi' }).count(), 0, `${label}: reopened itself on reload`);

    // 4. And the rail brings it back.
    await page.getByRole('button', { name: 'Show VaNi' }).click();
    await page.getByRole('button', { name: 'Hide VaNi' }).first().waitFor({ timeout: 5000 });
    // The nav rail animates its margin over 300ms (it re-collapses to make room
    // for the companion), so measure after it settles or this races it.
    await page.waitForTimeout(500);
    const reopenWidth = await widthOf(page);
    assert.ok(Math.abs(reopenWidth - openWidth) < 2, `${label}: width did not return on reopen (${openWidth} -> ${reopenWidth})`);

    // 5. Phone width, closed. The rail holds its 52px at every breakpoint on
    //    purpose (the row is flex-row whenever the panel is closed), so this
    //    is where a width that only worked on desktop would show up as a page
    //    the user has to scroll sideways.
    await page.setViewportSize({ width: 390, height: 900 });
    await hide.first().click();
    await page.getByRole('button', { name: 'Show VaNi' }).waitFor({ timeout: 5000 });
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `${label}: ${overflow}px of horizontal overflow at 390px while closed`);

    console.log(`PASS ${label} — ${Math.round(openWidth)}px open, ${Math.round(closedWidth)}px closed, no 390px overflow`);
    await ctx.close();
  }
} finally {
  await browser?.close();
  for (const f of [html, entry]) if (fs.existsSync(f)) fs.unlinkSync(f);
}
