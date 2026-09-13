import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {chromium} from 'playwright-core';
const root=process.cwd(),base='http://127.0.0.1:4318';const html=path.join(root,'__scanner_vani_qa.html'),entry=path.join(root,'__scanner_vani_qa.tsx');
if(fs.existsSync(html)||fs.existsSync(entry))throw Error('QA entry already exists');
fs.writeFileSync(html,'<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__scanner_vani_qa.tsx"></script></body></html>');
fs.writeFileSync(entry,`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {ScannerVaNiCard} from './src/views/ScannerStudio';import StockAskPopover from './src/components/domain/VaNi/StockAskPopover';import VaNiTrigger from './src/components/domain/VaNiTrigger';import {useBookmarkStore} from './src/stores/bookmarkStore';useBookmarkStore.setState({hasLoaded:true});import {STUDIO_DESCRIPTORS} from './src/config/scannerStudio';import {initTheme,useThemeStore} from './src/stores/themeStore';import './src/styles/globals.css';initTheme();useThemeStore.getState().setMode(new URLSearchParams(location.search).get('mode')==='light'?'light':'dark');
(window as any).__filterCalls=[];const stocks=[{symbol:'ALPHA',equity_id:1,score_5d:50,score_22d:10,rvol:4,magic_rs:2,close:98,w52_high:100,rsi_14:74,industry:'Metals',vaniOpportunity:true}];
function App(){const [intent,setIntent]=useState<any>(null);return <div style={{padding:12,background:'var(--bg)',color:'var(--text-primary)'}}><div id="scanner-vani-host" className="scanner-vani-host"/><StockAskPopover/><div style={{position:'fixed',right:16,top:16,zIndex:600}}><VaNiTrigger entity={{type:'equity',id:2,symbol:'BETA',asOfDate:'2026-09-11',currentPresetId:'breakout_surge'}}/></div><button id="outside">Outside popup</button><ScannerVaNiCard presetId="breakout_surge" descriptor={STUDIO_DESCRIPTORS.breakout_surge} meta={{id:'breakout_surge',name:'Breakout Surge'} as any} allStocks={stocks as any} dataDate="2026-09-11" exchangeFilter="combined" scanIntent={intent} onSelectIntent={key=>{(window as any).__filterCalls.push(key);setIntent(key)}} sectorLeadingReady sectorLeadingFacts={{count:1,industries:[{name:'Metals',count:1}]} as any} newSinceYesterdayFacts={{count:1,priorDate:'2026-09-10',examples:[{symbol:'ALPHA'}]} as any} rsFlipFacts={{count:1,priorDate:'2026-09-10',examples:[{symbol:'ALPHA',fromZone:'Weakening',toZone:'Leading'}]} as any} isUnusualFacts={{todayCount:1,avgCount:3,lookbackDays:10}}/></div>};createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/scanner/breakout_surge']}><App/></MemoryRouter></QueryClientProvider>);`);
let browser;try {browser=await chromium.launch({channel:'chrome',headless:true});
for(const mode of ['dark','light'])for(const width of [390,1440]){
 const page=await browser.newPage({viewport:{width,height:1000}}),calls=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const req=route.request();if(req.url().includes('/api/vani/ask')){const body=req.postDataJSON();calls.push(body);await new Promise(r=>setTimeout(r,120));return route.fulfill({json:{response:'VaNi test answer: ALPHA has a flow-score gap of 40. Inspect the supplied evidence.',log_id:'qa',cached:false}})}if(req.url().startsWith(base))return route.continue();return route.abort()});
 await page.goto(base+'/__scanner_vani_qa.html?mode='+mode);const card=page.getByRole('region',{name:'Scanner VaNi'});
 const buttons=card.locator('.scanner-questions button');await buttons.first().waitFor();const labels=await buttons.allTextContents();assert.equal(labels.length,7);
 assert(await card.evaluate(el=>el.parentElement.id==='scanner-vani-host'),'Persistent companion belongs beside results');
 assert.equal(await card.getByRole('button',{name:'Pin beside results'}).count(),0);
 for(const name of labels){const question=card.getByRole('button',{name,exact:true});await Promise.all([page.waitForResponse(r=>r.url().includes('/api/vani/ask')),question.click()]);await card.getByText('VaNi test answer:',{exact:false}).waitFor();if(calls.at(-1).intent_id==='scanner.why_highlighted'){
  const story=card.locator('[data-highlight-story]');await story.waitFor();
  assert.equal(await story.locator('.vani-highlight-count').textContent(),'1');
  assert.equal(await story.getByRole('region',{name:'VaNi’s reading',exact:true}).count(),1);
  assert(await story.locator('.vani-highlight-reading mark').count()>0,'Model numbers are highlighted');
  assert.deepEqual(calls.at(-1).highlight_facts.readings,{rvol_available:1,above_usual_volume:1,high_available:1,rs_available:1,positive_rs:1,rsi_available:1,high_rsi:1,score_pair_available:1,recent_score_below:0});
  assert.equal(await story.getByText('2.0%',{exact:true}).count(),1);
  const mascot=story.getByRole('button',{name:'Ask VaNi about ALPHA',exact:true});await mascot.click();
  const popup=page.getByRole('dialog',{name:'VaNi · ALPHA',exact:true});await popup.waitFor();
  assert(await popup.evaluate(el=>el.parentElement===document.body),'Stock popup belongs outside scanner chat');
  assert(await card.isVisible(),'Scanner reading remains visible');
  assert.equal(await page.locator('#scanner-vani-stock').count(),0);
  const bounds=await popup.boundingBox();assert(bounds.x>=0 && bounds.y>=0 && bounds.x+bounds.width<=width+1 && bounds.y+bounds.height<=1001,'Popup fits viewport');
  if(width<600)assert(bounds.y+bounds.height>970,'Mobile uses bottom sheet');
  const popout=path.join(root,'node_modules/.cache/stock-popup');fs.mkdirSync(popout,{recursive:true});await popup.screenshot({path:path.join(popout,mode+'-'+width+'.png')});
  await page.keyboard.press('Escape');await popup.waitFor({state:'hidden'});assert(await mascot.evaluate(el=>document.activeElement===el));
  await mascot.click();await popup.waitFor();await page.mouse.click(2,2);await popup.waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Ask VaNi about BETA',exact:true}).click();await page.getByRole('dialog',{name:'VaNi · BETA',exact:true}).waitFor();assert.equal(await page.getByRole('dialog',{name:'VaNi · ALPHA',exact:true}).count(),0);await page.getByRole('button',{name:'Close stock VaNi',exact:true}).click();
  const out=path.join(root,'node_modules/.cache/scanner-highlight');fs.mkdirSync(out,{recursive:true});await story.screenshot({path:path.join(out,mode+'-'+width+'.png')});
 }}
 assert.equal(new Set(calls.filter(c=>c.intent_id.startsWith('scanner.')).map(c=>c.intent_id)).size,7);assert(calls.filter(c=>c.intent_id.startsWith('scanner.')).every(c=>c.date==='2026-09-11'&&c.explanation_depth==='simple'));
 assert.equal(await card.getByRole('button',{name:/^(Concise|Explain simply|Go deeper)$/}).count(),0);
 assert.equal(await card.getByText('Change question',{exact:true}).count(),0);
 await card.getByText('Inspect the evidence',{exact:true}).click();await card.getByRole('heading',{name:'Observed facts'}).waitFor();
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));assert.deepEqual(errors,[]);
 const out=path.join(root,'node_modules/.cache/scanner-vani');fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,mode+'-'+width+'.png'),fullPage:true});await page.close();console.log('PASS original scanner VaNi '+mode+' '+width);
}
}finally{await browser?.close();for(const file of [html,entry])fs.unlinkSync(file)}
