import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright-core';

const root = fileURLToPath(new URL('../../', import.meta.url));
const output = process.env.HEATMAP_QA_OUT || path.join(os.tmpdir(), 'dristiq-heatmap-qa');
fs.mkdirSync(output, {recursive:true});
const dates = [];
for (let d = new Date('2026-09-18T12:00:00Z'); dates.length < 71; d.setUTCDate(d.getUTCDate()-1)) {
  const day = d.toISOString().slice(0,10);
  if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && day !== '2026-09-14') dates.unshift(day);
}
const breadth = dates.map((trade_date,i) => {
  const n=3000, p=75-i*.6+Math.sin(i/3)*4;
  return {trade_date,pct_above_20:p,pct_above_50:p+3,pct_above_150:p+7,breadth_score:p+2.3,
    stock_count:n,universe_count:n,above_20:Math.round(p*n/100),above_50:Math.round((p+3)*n/100),above_150:Math.round((p+7)*n/100),
    up_5pct:40+i,down_5pct:10+i%20,up_20pct_5d:8+i%10,down_20pct_5d:2+i%5};
});
const changes = {
  '2026-09-15':{pct_above_20:23.94,pct_above_50:31.05,pct_above_150:37.68,stock_count:852,universe_count:852},
  '2026-09-16':{pct_above_20:23.85,pct_above_50:31.27,pct_above_150:39.32},
  '2026-09-17':{pct_above_20:28.11,pct_above_50:33.52,pct_above_150:41.3},
  '2026-09-18':{pct_above_20:36.3,pct_above_50:38.74,pct_above_150:44.25},
};
for (const row of breadth) {
  Object.assign(row,changes[row.trade_date]||{});
  row.breadth_score=.5*row.pct_above_20+.3*row.pct_above_50+.2*row.pct_above_150;
}
const roc=dates.map((trade_date,i)=>({trade_date,roc_13:.3-i*.005+Math.sin(i/3)*.04,roc_55:.35-i*.004,sma_breadth:.28-i*.004,stock_count:trade_date==='2026-09-15'?911:3073}));
Object.assign(roc.at(-1),{roc_13:-.0511,roc_55:.0298,sma_breadth:-.1013});
const nifty=dates.map((trade_date,i)=>({id:i+1,index_id:1,trade_date,open:24000+i*8,high:24100+i*8,low:23900+i*8,close:24050+i*8,prev_close:i?24050+(i-1)*8:null,chng:i?8:null,pct_chng:i?8/(24050+(i-1)*8)*100:null,volume:null}));
const server=await createServer({configFile:false,root,cacheDir:path.join(output,'vite-cache'),
  plugins:[react({exclude:/node_modules|vite-cache/}),{name:'heatmap-offline-fixture',configureServer(server){server.middlewares.use('/__heatmap_qa.html',async(req,res,next)=>{
    try {const html=await server.transformIndexHtml('/__heatmap_qa.html','<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/scripts/qa/fixtures/heatmap-reading.tsx"></script></body></html>');res.setHeader('Content-Type','text/html');res.end(html)} catch(error){next(error)}
  })}}],resolve:{alias:{'@':path.join(root,'src')}},server:{host:'127.0.0.1',port:4329,strictPort:true}});
let browser;
try {
  await server.listen();
  browser=await chromium.launch({channel:'chrome',headless:true});
  for (const theme of ['kaaladristi','jade-thorn']) for(const mode of ['light','dark']) for(const width of [390,1440]) {
    const context=await browser.newContext({viewport:{width,height:1000},hasTouch:width===390,isMobile:width===390,reducedMotion:'reduce'});
    const page=await context.newPage(), errors=[];
    page.setDefaultTimeout(60000);
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(route.request().method()!=='GET') return route.abort();
      if(url.pathname.startsWith('/db/')) {
        let data=url.pathname.includes('km_market_breadth')?[...breadth].reverse()
          :url.pathname.includes('km_breadth_roc')?[...roc].reverse()
          :url.pathname.includes('km_index_symbols')?[{id:1,name:'NIFTY 50',category:'Broad Market'}]
          :url.pathname.includes('km_index_eod')?nifty:[{trade_date:'2026-09-18'}];
        return route.fulfill({json:data});
      }
      if(url.origin==='http://127.0.0.1:4329')return route.continue();
      return route.abort();
    });
    await page.goto(`http://127.0.0.1:4329/__heatmap_qa.html?mode=${mode}&theme=${theme}`);
    const heatmap=page.getByRole('region',{name:'Participation heatmap'});
    await heatmap.locator('.heatmap-cell').first().waitFor();
    assert.equal(await heatmap.locator('tbody tr').count(),6);
    const firstRow=heatmap.locator('tbody tr').nth(1);
    assert(await heatmap.locator('.zone-entry-dot:not(.provisional)').count() >= 1,'Zone-entry row should contain at least one confirmed crossing');
    const warningEvent=heatmap.locator('tbody tr').first().locator('[data-date="2026-09-15"] .heatmap-event');
    assert.equal(await warningEvent.evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
    const provisionalBall=warningEvent.locator('.zone-entry-dot.provisional');
    assert.notEqual(await provisionalBall.evaluate(e=>getComputedStyle(e).backgroundImage),'none');
    assert.equal(await firstRow.locator('.heatmap-cell').first().getAttribute('data-date'),'2026-09-18');
    assert.equal(await firstRow.locator('.heatmap-cell').count(),66);
    const latest=firstRow.locator('[data-date="2026-09-18"]');
    assert.match(await latest.getAttribute('aria-label'),/36.3%/);
    assert.equal(await latest.locator('.heatmap-marker').count(),0);
    assert.equal(await firstRow.locator('[data-date="2026-09-15"]').getAttribute('data-warning'),'true');
    assert.equal(await firstRow.locator('[data-date="2026-09-16"] .heatmap-marker').count(),0);
    await latest.click();
    await page.getByText('Linked date: 2026-09-18',{exact:false}).waitFor();
    assert.equal(await page.locator('.heatmap-cell[data-date="2026-09-18"][data-highlighted="true"]').count(),9);
    assert.match(await heatmap.getByRole('row',{name:/Daily pressure/}).textContent(),/U\d+.*D\d+/);
    await page.screenshot({path:path.join(output,`linked-${theme}-${mode}-${width}.png`),fullPage:true});
    console.log('Linked chart labels:', await page.locator('.recharts-label').allTextContents());
    await page.waitForFunction(() => [...document.querySelectorAll('.recharts-label')].filter(n=>n.textContent==='18 Sep').length===2);
    const colors=await firstRow.locator('.heatmap-fill').evaluateAll(nodes=>nodes.slice(0,3).map(n=>getComputedStyle(n).backgroundColor));
    assert.notEqual(colors[0],colors[1]);
    assert.equal(await latest.locator('.heatmap-fill').textContent(),'36.3%');
    await latest.focus();
    await page.keyboard.press('Enter');
    assert.equal(await latest.getAttribute('data-highlighted'),'true');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'No document overflow on phone or desktop');
    await heatmap.screenshot({path:path.join(output,`breadth-${theme}-${mode}-${width}.png`)});
    const momentum=page.getByRole('region',{name:'Momentum heatmap'});
    await momentum.locator('tbody tr').first().locator('[data-date="2026-09-18"]').click();
    assert.match(await momentum.textContent(),/Recovering relative to signal/);
    await momentum.screenshot({path:path.join(output,`roc-${theme}-${mode}-${width}.png`)});
    // Changing the window must preserve the date's shade.
    await page.getByRole('button',{name:'22D',exact:true}).first().click();
    assert.equal(await firstRow.locator('.heatmap-cell').count(),22);
    assert.equal(await latest.locator('.heatmap-fill').evaluate(n=>getComputedStyle(n).backgroundColor),colors[0]);
    if(width===1440 && mode==='light' && theme==='kaaladristi') {
      // The chart is oldest-first: hovering its left end highlights an OLD date
      // in the right-hand end of the newest-first heatmap.
      const chart=page.locator('.recharts-wrapper').first();
      await chart.scrollIntoViewIfNeeded();
      const box=await chart.boundingBox();
      await page.mouse.move(box.x+80,box.y+100);
      await page.waitForTimeout(100);
      await page.getByText('NIFTY 50',{exact:true}).last().waitFor();
      assert.equal(await page.getByText('Unavailable',{exact:true}).count(),0);
      const highlighted=await firstRow.locator('[data-highlighted="true"]').getAttribute('data-date');
      assert.notEqual(highlighted,'2026-09-18');
      assert(highlighted<'2026-09-10');
    }
    assert.deepEqual(errors,[]);
    console.log(`PASS UI ${theme} ${mode} ${width}: fixed bands, date order/linking, no arrows, coverage, visible values, keyboard, overflow`);
    await context.close();
  }
  console.log('Screenshots:',output);
} finally {await browser?.close();await server.close()}
