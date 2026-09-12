// Isolated UI regression: actual routes, synthetic data, no external requests.
// Run against a local Vite server: SECTOR_QA_URL=http://127.0.0.1:4318 node scripts/qa/check-sector-ui.mjs
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const root = process.cwd();
const html = path.join(root, '__sector_qa.html');
const entry = path.join(root, '__sector_qa.tsx');
const base = process.env.SECTOR_QA_URL || 'http://127.0.0.1:4318';
const out = process.env.SECTOR_QA_OUTPUT || path.join(root, 'node_modules/.cache/sector-qa');
fs.mkdirSync(out, { recursive: true });
if (fs.existsSync(html) || fs.existsSync(entry)) throw new Error('QA entry already exists; inspect before replacing it.');
fs.writeFileSync(html, '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__sector_qa.tsx"></script></body></html>');
fs.writeFileSync(entry, `import React from 'react'; import {createRoot} from 'react-dom/client';
import {MemoryRouter,Routes,Route} from 'react-router-dom'; import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import SectorRotationPage from './src/views/SectorRotationPage'; import IndexDetailPage from './src/views/IndexDetailPage';
import SectorCompanion from './src/components/domain/VaNi/SectorCompanion'; import './src/styles/globals.css';
import {initTheme,useThemeStore} from './src/stores/themeStore'; initTheme(); useThemeStore.getState().setMode(new URLSearchParams(location.search).get('mode') === 'light' ? 'light' : 'dark');
const detail = new URLSearchParams(location.search).get('detail') === '1';
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter initialEntries={[detail ? '/sector-rotation/97?asof=2026-09-11' : '/sector-rotation?asof=2026-09-11']}><div style={{padding:12,color:'var(--text-primary)',background:'var(--bg)',minHeight:'100vh'}} className="flex flex-col xl:flex-row gap-4"><SectorCompanion/><div className="min-w-0 flex-1"><Routes><Route path="/sector-rotation" element={<SectorRotationPage/>}/><Route path="/sector-rotation/:indexId" element={<IndexDetailPage/>}/></Routes></div></div></MemoryRouter></QueryClientProvider>);`);

const days=[];
for(let d=new Date('2026-06-01T00:00:00Z'); d<=new Date('2026-09-11T00:00:00Z'); d.setUTCDate(d.getUTCDate()+1)) if(![0,6].includes(d.getUTCDay())) days.push(d.toISOString().slice(0,10));
const symbols=[{id:97,name:'Specialty manufacturing research basket',category:'sectoral index',is_active:true},{id:98,name:'Second comparison sector',category:'sectoral index',is_active:true}];
const stocks=Array.from({length:5},(_,i)=>({id:i+1,symbol:`STOCK${i+1}`,company_name:`Example constituent ${i+1}`}));
const indices=symbols.flatMap(s=>days.map((d,i)=>({index_id:s.id,trade_date:d,open:100+i,high:104+i,low:98+i,close:102+i,volume:100000,value_cr:300,ema_20:95+i,score_5d:i%7===0?0:20+i%20,score_22d:15,avg_amt_5d:120,avg_amt_22d:100,avg_amt_66d:90,ret_5d:3,ret_22d:4,ret_66d:6,pct_chng:1,rsi_14:55,magic_rs:2,stock_count:5})));
const equities=stocks.flatMap(s=>days.map((d,i)=>({equity_id:s.id,trade_date:d,close:100+i,pct_chng:s.id===1?20:-1,ema_20:95+i,sma_50:90+i,sma_150:88+i,ret_5d:3,ret_22d:5,score_5d:s.id===1?80:5,score_22d:4,value_cr:20,avg_amt_5d:20,avg_amt_22d:10,flow_type:'SHORT_COVERING',rsi_14:55})));
const breadth=days.map((d,i)=>({index_id:97,trade_date:d,stock_count:5,universe_count:5,pct_above_20:40+i%20,pct_above_50:60,pct_above_150:80,breadth_score:54,roc_13:.03,roc_55:.02,sma_breadth:.04,above_20:2,above_50:3,above_150:4}));
let browser;
try {
  browser=await chromium.launch(process.env.SECTOR_QA_BROWSER ? {executablePath:process.env.SECTOR_QA_BROWSER,headless:true} : {channel:'chrome',headless:true});
  const page=await browser.newPage(); const errors=[]; const queries=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname.includes('/api/')) {
      const body=route.request().postDataJSON?.() || {};
      if(url.pathname.endsWith('/api/vani/ask')) {
        const data=body.intent_id==='sector.context' ? {snapshot:`${body.date}-${body.sector_period}`,date:body.date,facts:['Synthetic fixture: 5 constituents.'],history:indices.filter(r=>r.index_id===97&&r.trade_date<=body.date).slice(-body.sector_period)} : {response:'Near-term flow is above its underlying baseline. Check participation across the constituents.',cached:true,log_id:'qa'};
        return route.fulfill({json:data});
      }
      return route.fulfill({json:{}});
    }
    if(url.pathname.startsWith('/db/')) {
      queries.push(url);
      const table=url.pathname.split('/').at(-1);
      let rows=table==='km_index_symbols'?symbols:table==='km_equity_symbols'?stocks:table==='km_index_constituents'?stocks.map(s=>({index_id:97,equity_id:s.id})):table==='km_index_eod'?indices:table==='km_equity_eod'?equities:['km_index_breadth','km_market_breadth'].includes(table)?breadth:[];
      for(const [key,value] of url.searchParams) {
        if(['select','order','limit','offset'].includes(key)) continue;
        const dot=value.indexOf('.'); const op=value.slice(0,dot), v=value.slice(dot+1);
        if(op==='eq') rows=rows.filter(r=>String(r[key])===v);
        if(op==='lte') rows=rows.filter(r=>String(r[key])<=v);
        if(op==='gte') rows=rows.filter(r=>String(r[key])>=v);
        if(op==='in') {const values=v.slice(1,-1).split(',').map(x=>x.replaceAll('"','')); rows=rows.filter(r=>values.includes(String(r[key])));}
      }
      const order=url.searchParams.get('order');
      if(order) { const [field,dir]=order.split(',')[0].split('.'); rows=[...rows].sort((a,b)=>String(a[field]).localeCompare(String(b[field]))*(dir==='desc'?-1:1)); }
      const offset=Number(url.searchParams.get('offset')||0), limit=Number(url.searchParams.get('limit')||500);
      return route.fulfill({json:rows.slice(offset,offset+limit)});
    }
    if(url.origin===new URL(base).origin) return route.continue();
    return route.abort();
  });
  async function noOverflow(label) {
    const overflow=await page.evaluate(()=>({width:innerWidth,actual:document.documentElement.scrollWidth, offenders:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+2 && getComputedStyle(e).position!=='fixed').slice(0,8).map(e=>e.tagName+'.'+e.className)}));
    assert(overflow.actual<=overflow.width+2,`${label}: ${JSON.stringify(overflow)}`);
  }
  for(const mode of ['dark','light']) for(const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:950});
    await page.goto(base+'/__sector_qa.html?mode='+mode);
    await page.locator(width < 768 ? '.sector-mobile-rows article' : '.sector-desktop-table tbody tr').first().waitFor();
    await noOverflow(`list ${width}`);
    await page.getByRole('button',{name:'Heat',exact:true}).click();
    await page.getByRole('button',{name:'Older →',exact:true}).waitFor();
    await noOverflow(`heat ${width}`);
    const old=page.getByRole('button',{name:'Older →',exact:true});
    await old.click();
    await page.waitForFunction(()=>document.querySelector('.flow-scroll')?.scrollLeft>0);
    await page.screenshot({path:path.join(out,`sector-map-${mode}-${width}.png`),fullPage:true});
    await page.goto(base+'/__sector_qa.html?detail=1&mode='+mode);
    await page.getByRole('heading',{name:'Specialty manufacturing research basket'}).waitFor();
    await page.getByText('Small sample',{exact:false}).waitFor();
    assert.equal(await page.getByText('Insufficient constituents',{exact:false}).count(),0);
    await noOverflow(`detail ${width}`);
    if(width<1280) {
      await page.getByRole('button',{name:'Help me read this page',exact:true}).first().click();
      const sheet=page.getByRole('dialog'); await sheet.waitFor();
      await sheet.getByRole('button',{name:'Explain this flow',exact:true}).click();
      await sheet.getByText('Consulting VaNi…',{exact:true}).waitFor();
      await sheet.getByText('Near-term flow is above its underlying baseline.',{exact:false}).waitFor();
      await sheet.getByRole('button',{name:'Close',exact:true}).click();
    }
    await page.getByRole('button',{name:'Flow Map',exact:true}).click();
    await page.getByRole('button',{name:'66 sessions',exact:true}).click();
    await page.getByRole('button',{name:'Older →',exact:true}).waitFor();
    await noOverflow(`constituents ${width}`);
    await page.getByRole('button',{name:/STOCK1,.*Flow 5D/}).first().click();
    await page.getByText('Scores are not return percentages.',{exact:false}).waitFor();
    await page.getByRole('button',{name:'Price Context',exact:true}).click();
    await noOverflow(`price ${width}`);
    await page.locator('input[type=date]').fill('2026-09-10');
    await page.getByRole('button',{name:'Overview',exact:true}).click();
    await page.getByText('Closing-data session: 10 September.',{exact:false}).waitFor();
    await noOverflow(`historical ${width}`);
    await page.screenshot({path:path.join(out,`sector-detail-${mode}-${width}.png`),fullPage:true});
    console.log(`PASS ${mode} ${width}px: table, maps, scroll, date, price, ${width<1280?'VaNi sheet/cache loader':'desktop companion'}`);
  }
  assert.equal(errors.length,0,errors.join('\n'));
  const histories=queries.filter(u=>u.pathname.endsWith('km_index_breadth')&&u.searchParams.get('index_id'));
  assert(histories.some(u=>u.searchParams.getAll('trade_date').includes('lte.2026-09-10')),'Breadth must follow historical date');
  console.log('Sector UI regression passed. Screenshots: '+out);
} finally {
  await browser?.close();
  fs.unlinkSync(html); fs.unlinkSync(entry);
}
