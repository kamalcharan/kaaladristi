import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const browser = await chromium.launch({channel:'msedge',headless:true});
try {
  for (const width of [1440,390]) for (const mode of ['light','dark']) {
    const page = await browser.newPage({ viewport:{width,height:1000} });
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/db/**',r=>r.fulfill({json:[]}));
    await page.route('**/pipeline-api/**',r=>r.fulfill({json:[]}));
    await page.goto(`http://127.0.0.1:5174/scripts/qa/fixtures/personal-cards.html?mode=${mode}`);
    await page.locator('.ps-card').waitFor();
    assert.ok((await page.locator('.ps-card').innerText()).includes('RS 5D'));
    for (const tone of ['Positive','Negative','Neutral']) {
      await page.getByRole('button',{name:new RegExp('^'+tone+':')}).click();
      assert.equal(await page.locator('.ps-event').count(),1);
      assert.ok((await page.locator('.ps-event-symbol').getAttribute('aria-label')).includes(tone));
    }
    await page.getByRole('button',{name:'All',exact:true}).click();
    assert.equal(await page.getByText('My entry',{exact:true}).count(),0);
    await page.getByRole('button',{name:/Positions/}).click();
    await page.getByText('My entry',{exact:true}).waitFor();
    assert.ok((await page.locator('.ps-card').innerText()).includes('+4.33%'));
    await page.getByText('Manage position',{exact:true}).click();
    assert.ok((await page.getByRole('link',{name:'Entry and position tools →'}).getAttribute('href')).includes('tab=thesis'));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:`${process.env.TEMP}/personal-${width}-${mode}.png`,fullPage:true});
    await page.getByRole('button',{name:/Watching/}).click();
    await page.getByRole('button',{name:'Compare · table & flow map'}).click();
    await page.getByText('5D Money Flow',{exact:true}).waitFor();
    await page.goto(`http://127.0.0.1:5174/scripts/qa/fixtures/personal-cards.html?mode=${mode}&today=1`);
    await page.locator('.ps-compact .ps-card').waitFor();
    assert.equal(await page.locator('.ps-reference').count(),0);
    assert.equal(await page.locator('.ps-event:visible').count(),1);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:`${process.env.TEMP}/today-personal-${width}-${mode}.png`,fullPage:true});
    await page.goto(`http://127.0.0.1:5174/scripts/qa/fixtures/personal-cards.html?mode=${mode}&today=1&stale=1`);
    await page.locator('.ps-warning').waitFor();
    assert.equal(await page.locator('.ps-event').count(),0);
    assert.deepEqual(errors,[]);await page.close();
    console.log(`PASS personal cards ${width} ${mode}, entry context, comparison retained`);
  }
} finally {await browser.close();}
