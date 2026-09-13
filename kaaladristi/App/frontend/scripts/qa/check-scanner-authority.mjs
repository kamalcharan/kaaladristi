import fs from 'node:fs';import assert from 'node:assert/strict';import {chromium} from 'playwright-core';
const file='__authority_qa.html';if(fs.existsSync(file))throw Error('Fixture exists');
fs.writeFileSync(file,'<script type="module">import {executeScan} from "/src/services/scanEngine.ts";window.runScan=executeScan;</script>');
let browser;try{
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();let mode='empty';const calls=[];
 await page.route('**/db/**',route=>{calls.push(route.request().url());return route.fulfill({status:mode==='error'?500:200,json:mode==='error'?{message:'test failure'}:mode==='empty'?[]:[{equity_id:1,isin:'TEST-ISIN',symbol:'TEST',exchange:'NSE',close:100,vani_flag:mode==='invalid'?null:mode==='true',trade_date:'2026-09-11'}]})});
 await page.goto('http://127.0.0.1:4318/'+file);await page.waitForFunction(()=>!!window.runScan);
 for(const id of ['breakout_surge','breakout_surge_daily','breakdown_watch','weekly_movers','monthly_movers','weekly_decliners','monthly_decliners','flower_pot_burst'])for(const scenario of ['empty','error','invalid','true','false']){
  mode=scenario;calls.length=0;
  const result=await page.evaluate(async id=>{try{return {rows:await window.runScan(id)}}catch(e){return {error:e.message}}},id);
  if(['error','invalid'].includes(mode))assert(result.error,`${id}: ${mode} must fail`);
  else {assert(!result.error);assert.equal(result.rows.length,mode==='empty'?0:1);if(result.rows.length)assert.equal(result.rows[0].vaniOpportunity,mode==='true')}
  assert.equal(calls.length,1,`${id}: no alternate query`);assert(calls[0].includes('/km_scan_results?'));
 }
 console.log('PASS 40 database-authority cases: failure, empty, invalid flag, true, false; no fallback requests');
}finally{await browser?.close();fs.unlinkSync(file)}
