const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'../..');
function load(name,deps={}){const source=fs.readFileSync(path.join(root,'src/services',name+'.ts'),'utf8');const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const exports={};vm.runInNewContext(code,{exports,require:key=>{if(!(key in deps))throw Error(key);return deps[key]},Date,Map,Set,URLSearchParams});return exports;}
const helpers=load('astroStudy',{'./astroEvents':{planetCatalogItem:()=>({color:'blue'})}});
const rows=[{trade_date:'2026-07-23',magic_rs:null},{trade_date:'2026-07-24',magic_rs:2},{trade_date:'2026-07-27',magic_rs:3}];
assert.equal(helpers.studySession(rows,'2026-07-26').trade_date,'2026-07-24');
assert.equal(helpers.studySession(rows,'2026-07-22'),undefined);
assert.equal(helpers.studySession(rows,'2026-07-23').magic_rs,null);
assert.equal(helpers.validStudyDate('2026-02-30'),false);assert.equal(helpers.validStudyDate('2024-02-29'),true);
assert.equal(helpers.shiftStudyDate('2026-01-01',-1),'2025-12-31');
const event={family_id:'mercury-visibility',event_key:'rise:2026-07-26',rule_id:1,display_name:'Mercury Rise',event_type:'mercury_rise',shape:'point',start_date:'2026-07-26',end_date:'2026-07-26',planets:['Mercury'],start_ts:null,precision:'daily_sample'};
assert.equal(helpers.studyEventBand(event).from,'2026-07-26');assert.equal(helpers.studyEventBand(event).startTs,null);
assert(helpers.astroStudyLink(event,97).startsWith('/chart/index/97?'));assert.equal(new URLSearchParams(helpers.astroStudyLink(event,97).split('?')[1]).get('event'),event.event_key);
let page=0;const queries=[];const db={from:table=>{const q={table};const builder={select(v){q.cols=v;return this},eq(k,v){q[k]=v;return this},gte(k,v){q.start=v;return this},lte(k,v){q.end=v;return this},order(){return this},range(a,b){q.range=[a,b];return this},execute:async()=>{queries.push(q);return{data:page++===0?Array.from({length:500},(_,i)=>({trade_date:String(i),magic_rs:null})):[{trade_date:'last'}],error:null}}};return builder}};
const svc=load('indicatorData',{'./postgrest':db,'date-fns':{}});
(async()=>{const result=await svc.fetchIndexStudyWindow(97,'2020-01-01','2026-07-24');assert.equal(result.length,501);assert.equal(queries[1].range[0],500);assert(queries.every(q=>q.end==='2026-07-24'&&q.index_id===97));assert.equal(result[0].magic_rs,null);assert.equal((await svc.fetchIndexStudyWindow(97,'2026-07-25','2026-07-24')).length,0);console.log('PASS study: weekend alignment, no future substitution, missing indicators, date validation, stable links and bounded pagination');})().catch(e=>{console.error(e);process.exitCode=1});
