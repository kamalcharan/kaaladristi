// Isolated UI regression: actual routes, synthetic data, no external requests.
// Run against a local Vite server: SECTOR_QA_URL=http://127.0.0.1:4318 node scripts/qa/check-sector-ui.mjs
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
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
import MyBookmarksPage from './src/views/MyBookmarksPage';
import SectorCompanion from './src/components/domain/VaNi/SectorCompanion'; import './src/styles/globals.css';
import {initTheme,useThemeStore} from './src/stores/themeStore'; initTheme(); useThemeStore.getState().setMode(new URLSearchParams(location.search).get('mode') === 'light' ? 'light' : 'dark');
import {useAuthStore} from './src/stores/authStore';
useAuthStore.setState({profile:{id:'qa-personal'} as any,session:{access_token:'qa-token'} as any,isLoading:false});
(window as any).__setPersonalUser=(id:string|null)=>useAuthStore.setState({profile:id?{id} as any:null,session:id?{access_token:'qa-token'} as any:null,isLoading:false});
const detail = new URLSearchParams(location.search).get('detail') === '1';
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter initialEntries={[detail ? '/sector-rotation/97?asof=2026-09-11' : '/sector-rotation?asof=2026-09-11']}><div style={{padding:12,color:'var(--text-primary)',background:'var(--bg)',minHeight:'100vh'}} className="flex flex-col xl:flex-row gap-4"><SectorCompanion/><div className="min-w-0 flex-1"><Routes><Route path="/bookmarks" element={<MyBookmarksPage/>}/><Route path="/sector-rotation" element={<SectorRotationPage/>}/><Route path="/sector-rotation/:indexId" element={<IndexDetailPage/>}/></Routes></div></div></MemoryRouter></QueryClientProvider>);`);

const days=[];
for(let d=new Date('2026-06-01T00:00:00Z'); d<=new Date('2026-09-11T00:00:00Z'); d.setUTCDate(d.getUTCDate()+1)) if(![0,6].includes(d.getUTCDay())) days.push(d.toISOString().slice(0,10));
const symbols=[{id:97,name:'Specialty manufacturing research basket',category:'sectoral index',is_active:true},{id:98,name:'Second comparison sector',category:'sectoral index',is_active:true}];
const stocks=Array.from({length:5},(_,i)=>({id:i+1,symbol:`STOCK${i+1}`,company_name:`Example constituent ${i+1}`}));
const indices=symbols.flatMap(s=>days.map((d,i)=>({index_id:s.id,name:s.name,trade_date:d,open:100+i,high:104+i,low:98+i,close:102+i,volume:100000,value_cr:300,ema_20:95+i,score_5d:i%7===0?0:20+i%20,score_22d:15,avg_amt_5d:120,avg_amt_22d:100,avg_amt_66d:90,ret_5d:3,ret_22d:4,ret_66d:6,pct_chng:1,rsi_14:55,magic_rs:2,stock_count:5})));
const equities=stocks.flatMap(s=>days.map((d,i)=>({equity_id:s.id,trade_date:d,close:100+i,pct_chng:s.id===1?20:-1,ema_20:95+i,sma_50:90+i,sma_150:88+i,ret_5d:3,ret_22d:5,score_5d:s.id===1?80:5,score_22d:4,value_cr:20,avg_amt_5d:20,avg_amt_22d:10,flow_type:'SHORT_COVERING',rsi_14:55})));
const breadth=days.map((d,i)=>({index_id:97,trade_date:d,stock_count:5,universe_count:5,pct_above_20:40+i%20,pct_above_50:60,pct_above_150:80,breadth_score:54,roc_13:.03,roc_55:.02,sma_breadth:.04,above_20:2,above_50:3,above_150:4}));
const currentViews=JSON.parse(execFileSync('python',['-c','import sys,json; from lib.sector_flow_intents import build_views; print(json.dumps(build_views(json.load(sys.stdin))))'],{cwd:path.join(root,'../backend'),encoding:'utf8',input:JSON.stringify({date:'2026-09-11',category:'sectoral',period:22,index_count:2,rows:indices.filter(r=>r.trade_date==='2026-09-11'),history:indices})}));
let browser;
try {
  browser=await chromium.launch(process.env.SECTOR_QA_BROWSER ? {executablePath:process.env.SECTOR_QA_BROWSER,headless:true} : {channel:'chrome',headless:true});
  const page=await browser.newPage(); const errors=[]; const queries=[]; const vaniCalls=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/src/lib/analytics.ts') return route.fulfill({contentType:'application/javascript',body:`export function trackEvent(name,props){(window.__qaAnalytics??=[]).push({name,props})} export function initAnalytics(){} export function identifyUser(){} export function resetAnalytics(){}`});
    if(url.pathname.endsWith('/api/vani/feedback')) return route.fulfill({json:{ok:true}});
    if(url.pathname.includes('/api/')) {
      const body=route.request().postDataJSON?.() || {};
      if(url.pathname.includes('/api/bookmarks/')) {
        const personalState=new URL(page.url()).searchParams.get('personal');
        if(personalState==='error') return route.fulfill({status:500,json:{detail:'fixture failure'}});
        if(personalState==='empty'||url.pathname.endsWith('/qa-other')) return route.fulfill({json:[]});
        return route.fulfill({json:[{id:'p1',equity_id:personalState==='unmatched'?999:1,symbol:'PERSONAL_HOLD',entry_price:100},{id:'p2',equity_id:personalState==='unmatched'?998:2,symbol:'PERSONAL_WATCH',entry_price:null}]});
      }
      if(url.pathname.endsWith('/api/vani/ask')) {
        vaniCalls.push(body);
        if(body.intent_id==='sector.leadership.context') {
          const history=days.slice(-body.leadership_months*4).map((date,i)=>({date,weekly:true,monthly:i%3===0?null:true,weekly_date:date,monthly_date:date,eligible:5,total:5,leaders:3,watch:1,leaders_pct:60,watch_pct:20}));
          return route.fulfill({json:{membership:{97:[1,2,3,4,5]},snapshot:`leadership-${body.date}-${body.leadership_months}-${body.sector_category}`,date:body.date,start:history[0].date,months:body.leadership_months,rows:[{index_id:97,name:symbols[0].name,category:body.sector_category,current:history.at(-1),history,aligned_samples:12,known_samples:18,aligned_streak:12,status:'Running broadly',alignment_history:history,flow:{state:'Fading',score_5d:12,score_22d:25},charts:{weekly:history.map((s,i)=>({trade_date:s.date,magic_rs:2+i/10,magic_ma:1+i/20,magic_rs_zone:'Neutral Bull'})),monthly:history.slice(-4).map((s,i)=>({trade_date:s.date,magic_rs:2+i/10,magic_ma:1,magic_rs_zone:'Neutral Bull'})),weekly_method:'short'}}]}});
        }
        const pulse=body.intent_id==='sector.pulse.context';
        if(pulse) { body.date='2026-09-11'; body.sector_period=22; }
        const data=(pulse || body.intent_id==='sector.context') ? {intent_views:body.entity_id?undefined:currentViews,snapshot:`${body.date}-${body.sector_period}`,date:body.date,facts:['Synthetic fixture: 5 constituents.'],period:22,index_count:2,rows:indices.filter(r=>r.trade_date===body.date),history:indices.filter(r=>r.trade_date<=body.date)} : {response:'Near-term flow is above its underlying baseline. Check participation across the constituents.',cached:true,log_id:'qa'};
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
  for(const mode of (process.env.SECTOR_QA_MODES??'dark,light').split(',')) for(const width of (process.env.SECTOR_QA_WIDTHS??'320,390,768,1440').split(',').map(Number)) {
    await page.setViewportSize({width,height:950});
    await page.goto(base+'/__sector_qa.html?mode='+mode);
    await page.locator(width < 768 ? '.sector-mobile-rows article' : '.sector-desktop-table tbody tr').first().waitFor();
    await page.getByRole('heading',{name:/What.*happening here/}).waitFor();
    await page.getByRole('heading',{name:'Money Entering',exact:true}).waitFor();
    await page.getByRole('region',{name:'Connected to your stocks'}).getByRole('link',{name:'PERSONAL_HOLD',exact:true}).waitFor();
    const before=await page.locator('[aria-label="Sector flow snapshot"]').innerText();
    await page.getByRole('button',{name:'Curated',exact:true}).click();
    assert.equal(await page.locator('[aria-label="Sector flow snapshot"]').innerText(),before,'Overall flow must survive tab changes');
    await page.getByRole('button',{name:'Sectoral',exact:true}).click();
    assert.equal(await page.getByText('Inspect the evidence',{exact:true}).count(),0);
    assert(vaniCalls.some(r=>r.intent_id==='sector.overview' && !r.entity_id), 'Listing default should run automatically');
    await page.screenshot({path:path.join(out,`sector-default-${mode}-${width}.png`),fullPage:true});
    await noOverflow(`list ${width}`);
    // Only the three launch follow-ups are visible; deferred implementations stay hidden.
    const currentCompanion=page.getByRole('complementary',{name:'VaNi Sector Rotation companion'});
    await currentCompanion.getByText('Explore another question',{exact:true}).click();
    assert.equal(await currentCompanion.locator('[aria-label="Sector questions"] button').count(),4,'Current Flow: default plus three questions');
    for(const [id,label] of [['entering','Where is flow entering?'],['fading','Where is flow fading?'],['persistence','Has this flow persisted?']]) {
      const surface=width<1280&&await page.getByRole('dialog').isVisible()?page.getByRole('dialog'):currentCompanion;
      const menu=surface.getByText('Open current-flow intents',{exact:true});
      if(await menu.isVisible()&&!(await menu.locator('..').getAttribute('open')!==null)) await menu.click();
      await surface.getByRole('button',{name:label,exact:true}).click();
      const active=width<1280?page.getByRole('dialog'):currentCompanion;
      await active.getByText('Consulting VaNi…',{exact:true}).waitFor();
      await active.getByRole('region',{name:'Current-flow interpretation'}).waitFor();
      await active.getByText('VaNi explanation',{exact:true}).click();
      await active.locator('.vani-explanation').getByText('Near-term flow is above its underlying baseline.',{exact:false}).waitFor();
      if(id==='fading') {
        await active.getByText('None of your saved stocks are linked to the sectors highlighted in this reading.',{exact:true}).waitFor();
        assert.equal(await active.getByRole('link',{name:'PERSONAL_HOLD',exact:true}).count(),0);
      }
      if(id==='persistence') {
        await active.locator('.vani-flow-strip button').first().click();
        await active.getByText(/11 September · (Strong|Building)/).first().waitFor();
        await page.screenshot({path:path.join(out,`sector-intent-persistence-${mode}-${width}.png`),fullPage:true});
      }
      const events=await page.evaluate(()=>window.__qaAnalytics??[]);
      assert.equal(events.filter(e=>e.name==='vani_intent_selected'&&e.props.intent_id==='sector.'+id&&e.props.source==='manual').length,1);
      await noOverflow(`current intent ${id} ${width}`);
    }
    if(width<1280) await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
    await page.getByRole('button',{name:'Longer-Term Leadership',exact:true}).click();
    await page.getByRole('heading',{name:'Which baskets are holding their strength?',exact:true}).waitFor();
    await page.getByRole('heading',{name:'VaNi · Longer-term picture',exact:true}).waitFor();
    await page.getByRole('button',{name:'3M',exact:true}).click();
    await page.getByRole('heading',{name:'Which baskets are holding their strength?',exact:true}).waitFor();
    await page.getByRole('button',{name:'12M',exact:true}).click();
    await page.getByRole('heading',{name:'Which baskets are holding their strength?',exact:true}).waitFor();
    await page.getByRole('button',{name:'Cooling 0',exact:true}).click();
    await page.getByText('No baskets in this group for the selected session.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Running broadly 1',exact:true}).click();
    await page.getByRole('button',{name:'MagicRS +',exact:true}).click();
    await page.getByRole('heading',{name:/MagicRS .*Specialty/}).waitFor();
    await page.getByRole('button',{name:'Monthly',exact:true}).click();
    assert.equal(await page.locator('.leadership-evidence:visible canvas').count(),1,'Uses existing MagicRS canvas');
    const detailLink=page.getByRole('link',{name:'Open full sector evidence',exact:false});
    assert((await detailLink.getAttribute('href')).includes('asof=2026-09-11&research=leadership&months=12'));

    await noOverflow(`leadership ${width}`);
    assert(vaniCalls.some(r=>r.intent_id==='sector.leadership'&&r.leadership_months===12),'VaNi must follow longer-term window');
    await page.getByRole('region',{name:'Connected to your stocks'}).getByRole('link',{name:'PERSONAL_WATCH',exact:true}).waitFor();
    const companion=page.getByRole('complementary',{name:'VaNi longer-term companion'});
    assert.equal(await companion.locator('[aria-label="Longer-term group counts"]').count(),0,'VaNi must not repeat the group statistics grid');
    await companion.getByRole('region',{name:'Longer-term interpretation'}).getByText('What stands out',{exact:true}).waitFor();
    await companion.getByText('Open longer-term intents',{exact:true}).click();
    assert.equal(await companion.locator('[aria-label="Longer-term questions"] button').count(),4,'Longer-Term: default plus three questions');
    for(const [label,suffix] of [['Which baskets are building strength?','building'],['Where is strength weakening?','cooling'],['How does current flow compare?','flow']]) {
      await companion.getByRole('button',{name:label,exact:true}).click();
      await companion.getByRole('heading',{name:label,exact:true}).waitFor();
      await companion.getByText('Consulting VaNi…',{exact:true}).waitFor();
      await companion.getByText('VaNi explanation',{exact:true}).click();
      await companion.getByText('Near-term flow is above its underlying baseline.',{exact:false}).waitFor();
      await page.waitForFunction(intent=>(window.__qaAnalytics??[]).some(e=>e.name==='vani_detail_opened'&&e.props.detail==='explanation'&&e.props.intent_id===intent),'sector.leadership.'+suffix);
      const events=await page.evaluate(()=>window.__qaAnalytics??[]);
      assert.equal(events.filter(e=>e.name==='vani_intent_selected'&&e.props.intent_id==='sector.leadership.'+suffix&&e.props.source==='manual').length,1,'One selection per deliberate click');
      assert.equal(events.filter(e=>e.name==='vani_reading_ready'&&e.props.intent_id==='sector.leadership.'+suffix).length,1,'One completion, including cache hits');
      assert(events.some(e=>e.name==='vani_detail_opened'&&e.props.detail==='explanation'&&e.props.intent_id==='sector.leadership.'+suffix),'Opening the explanation is separate engagement');
      assert(vaniCalls.some(r=>r.intent_id==='sector.leadership.'+suffix&&r.leadership_months===12),'Intent uses the selected longer-term snapshot');
    }
    await companion.getByRole('button',{name:'Helpful',exact:true}).click();
    await page.waitForFunction(()=>(window.__qaAnalytics??[]).some(e=>e.name==='vani_feedback_submitted'));
    await page.evaluate(()=>localStorage.removeItem('vani_feedback:qa'));
    const measured=await page.evaluate(()=>window.__qaAnalytics??[]);
    assert(measured.some(e=>e.name==='vani_panel_viewed'&&e.props.mode==='longer_term'));
    assert(measured.some(e=>e.name==='vani_intent_selected'&&e.props.source==='automatic'&&e.props.mode==='current_flow'));
    assert(!JSON.stringify(measured).includes('PERSONAL_'),'No saved stock names in telemetry');
    assert(!JSON.stringify(measured).includes('Near-term flow is above'),'No answer text in telemetry');
    await companion.getByRole('button',{name:'Which baskets are holding strength?',exact:true}).click();
    await companion.getByText('Consulting VaNi…',{exact:true}).waitFor();
    await noOverflow(`leadership intents ${width}`);
    await page.screenshot({path:path.join(out,`sector-leadership-${mode}-${width}.png`),fullPage:true});
    await page.getByRole('button',{name:'Current Flow',exact:true}).click();
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
  for(const state of ['empty','unmatched','error']) {
    await page.goto(base+'/__sector_qa.html?personal='+state);
    const personal=page.getByRole('region',{name:'Connected to your stocks'});
    if(state==='empty') {
      await personal.getByText('I didn’t find any bookmarks or active positions.',{exact:true}).waitFor();
      assert.equal(await personal.getByRole('link',{name:'Add positions'}).getAttribute('href'),'/bookmarks?tab=positions');
      assert.equal(await personal.getByRole('link',{name:'Add bookmarks'}).getAttribute('href'),'/bookmarks?tab=watchlist');
      await personal.getByRole('link',{name:'Add positions'}).click();
      await page.getByText('No positions yet',{exact:false}).waitFor();
      const events=await page.evaluate(()=>window.__qaAnalytics??[]);
      assert.equal(events.filter(e=>e.name==='vani_next_step'&&e.props.destination==='positions'&&e.props.area==='personal_connections').length,1);
    } else if(state==='unmatched') await personal.getByText('None of your saved stocks are linked to the sectors highlighted in this reading.',{exact:true}).waitFor();
    else await personal.getByRole('button',{name:'Retry personal connections'}).waitFor();
  }
  await page.goto(base+'/__sector_qa.html');
  const personal=page.getByRole('region',{name:'Connected to your stocks'});
  await personal.getByRole('link',{name:'PERSONAL_HOLD',exact:true}).waitFor();
  await page.evaluate(()=>window.__setPersonalUser('qa-other'));
  await personal.getByText('I didn’t find any bookmarks or active positions.',{exact:true}).waitFor();
  assert.equal(await personal.getByRole('link',{name:'PERSONAL_HOLD',exact:true}).count(),0,'Previous account data must disappear');
  await page.evaluate(()=>window.__setPersonalUser(null));
  await personal.getByRole('link',{name:'Sign in',exact:true}).waitFor();
  assert(!JSON.stringify(vaniCalls).includes('PERSONAL_HOLD'),'Private stocks must not enter shared VaNi requests');
  assert.equal(errors.length,0,errors.join('\n'));
  const histories=queries.filter(u=>u.pathname.endsWith('km_index_breadth')&&u.searchParams.get('index_id'));
  assert(histories.some(u=>u.searchParams.getAll('trade_date').includes('lte.2026-09-10')),'Breadth must follow historical date');
  console.log('Sector UI regression passed. Screenshots: '+out);
} finally {
  await browser?.close();
  fs.unlinkSync(html); fs.unlinkSync(entry);
}
