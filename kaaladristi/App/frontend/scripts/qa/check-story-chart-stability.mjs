import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/db/**', route => route.fulfill({ json: [] }));
  await page.route('**/pipeline-api/**', route => route.fulfill({ json: [] }));
  await page.goto(`${process.env.QA_BASE_URL ?? 'http://127.0.0.1:5174'}/scripts/qa/fixtures/story-route.html`);
  for (const entry of ['direct', 'event']) {
    if (entry === 'direct') await page.getByRole('tab', { name: 'Chart & Replay', exact: true }).click();
    else await page.getByRole('button', { name: 'Locate candle →' }).first().click();
    const canvas = page.locator('#story-price canvas').first();
    await canvas.waitFor();
    await page.waitForTimeout(1000);
    const original = await canvas.elementHandle();
    await page.waitForTimeout(4000);
    assert.ok(await original.evaluate(el => el.isConnected), `${entry}: chart rebuilt while idle`);
    await canvas.scrollIntoViewIfNeeded();
    const bounds = await canvas.boundingBox();
    assert.ok(bounds);
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width / 2 - 90, bounds.y + bounds.height / 2, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(1500);
    assert.ok(await original.evaluate(el => el.isConnected), `${entry}: panning rebuilt the chart`);
    await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
    console.log(`PASS stable chart canvas: ${entry} entry, idle and pan`);
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
