import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import ts from 'typescript';

const root=process.cwd();
function load(file, dependencies={}, globals={}) {
  const exports={};
  const js=ts.transpileModule(readFileSync(path.join(root,file),'utf8').replaceAll('import.meta.env', '{}'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  runInNewContext(js,{exports,require:id=>dependencies[id]||{},console,Date,Map,Set,...globals});
  return exports;
}
const flow=load('src/components/domain/FlowIntensityMap.tsx');
const {sectorSignal}=load('src/lib/sectorFlow.ts',{'@/components/domain/FlowIntensityMap':flow});
const fixtures=[
  [30,20,120,100,3,'STRONG'],[10,10,120,100,3,'BUILDING'],[10,20,120,100,3,'FADING'],
  [0,0,80,100,-3,'OUTFLOW'],[0,0,120,100,-3,'QUIET'],[null,0,120,100,3,null],
  [0,0,null,100,-3,null],
].map(([score_5d,score_22d,avg_amt_5d,avg_amt_22d,ret_5d,state])=>({score_5d,score_22d,avg_amt_5d,avg_amt_22d,ret_5d,state}));
for(const f of fixtures) assert.equal(sectorSignal(f),f.state);
const backend=JSON.parse(execFileSync(process.env.PYTHON||'python',['-c','import json,sys; from lib.sector_vani import flow_state; print(json.dumps([flow_state(r) for r in json.load(sys.stdin)]))'],{cwd:path.join(root,'../backend'),input:JSON.stringify(fixtures),encoding:'utf8'}));
assert.equal(JSON.stringify(backend),JSON.stringify(fixtures.map(f=>f.state ? f.state[0]+f.state.slice(1).toLowerCase():'Unavailable')));
const {computeMoveQuality}=load('src/services/moveQuality.ts');
const constituents=Array.from({length:5},(_,i)=>({symbol:`S${i}`,pct_chng:i===0?20:-1,score_5d:i===0?80:5,flow_type:'SHORT_COVERING'}));
const concentrated=computeMoveQuality(constituents,40);
assert.equal(concentrated.topSharePct,80); assert.equal(concentrated.verdict,'narrow');
assert(concentrated.flags.some(f=>f.includes('positive constituent Flow 5D')));
assert(!concentrated.flags.some(f=>f.includes('confirm with fresh longs')));
assert.equal(computeMoveQuality([...constituents,{symbol:'MISSING',pct_chng:null,score_5d:null}]).verdict,'mixed');

const sourceRows=Array.from({length:600},(_,i)=>({equity_id:i+1,trade_date:'2026-09-10',score_5d:i+1,score_22d:10,ret_5d:1,pct_chng:1}));
const queries=[];
function from(table) {
  const q={table,filters:[],offset:0,take:Infinity,columns:'*',orders:[],select(v){this.columns=v;return this},eq(k,v){this.filters.push([k,'eq',v]);return this},in(k,v){this.filters.push([k,'in',v]);return this},is(){return this},notNull(){return this},gte(k,v){this.filters.push([k,'gte',v]);return this},lte(k,v){this.filters.push([k,'lte',v]);return this},order(k,v){this.orders.push([k,v]);return this},range(a,b){this.offset=a;this.take=b-a+1;return this},limit(n){this.take=n;return this},async execute(){
    queries.push(this);
    let data=table==='km_index_constituents'?sourceRows.map(r=>({equity_id:r.equity_id})):
      table==='km_equity_symbols'?sourceRows.map(r=>({id:r.equity_id,symbol:`S${r.equity_id}`,company_name:'Example'})):
      table==='km_index_eod'&&this.columns==='trade_date'?[{trade_date:'2026-09-10'}]:
      table==='km_equity_eod'?sourceRows:[];
    return {data:data.slice(this.offset,this.offset+this.take),error:null};
  }};return q;
}
const service=load('src/services/sectorRotation.ts',{'./postgrest':{from},'@/lib/symbolUtils':{displaySymbol:r=>r.symbol}});
const history=await service.fetchConstituentFlowMap(97,66,'2026-09-10');
assert.equal(history.rows.length,600);
assert.equal(history.cells.S600[0].s5,600,'Rows beyond server page cap must survive');
assert.equal(history.dates[0],'10 September');
const eod=queries.filter(q=>q.table==='km_equity_eod');
assert.equal(eod.length,2); assert.equal(eod[1].offset,500);
for(const q of eod) assert(q.filters.some(([k,op,v])=>k==='trade_date'&&op==='lte'&&v==='2026-09-10'));
assert.equal(service.BREADTH_MIN_N,5);
// Exercise the actual HTTP query builder: stable multi-column ordering is needed
// when consecutive pages contain several records from the same trading session.
const transport = {};
const source = readFileSync(path.join(root,'src/services/postgrest.ts'),'utf8').replaceAll('import.meta.env', '({ DEV: true })');
const transportJs = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let requested;
runInNewContext(transportJs,{exports:transport,console:{log(){},error(){}},URLSearchParams,AbortController,DOMException,setTimeout,clearTimeout,
  localStorage:{getItem(){return null}},fetch:async url=>{requested=new URL(url,'http://local.test');return {ok:true,status:200,json:async()=>[],headers:{get(){return null}}}}});
await transport.from('km_equity_eod').gte('trade_date','2026-09-01').lte('trade_date','2026-09-10')
  .order('trade_date',{ascending:true}).order('equity_id',{ascending:true}).range(500,999).execute();
assert.equal(requested.searchParams.getAll('order').length,1);
assert.equal(requested.searchParams.get('order'),'trade_date.asc,equity_id.asc');
assert.equal(requested.searchParams.getAll('trade_date').length,2);
console.log('PASS: shared browser/server flow states, missing data, concentration, 600-constituent pagination, historical bounds, readable dates, five-stock minimum');

// Discovery must project the same snapshot rows and scores used by VaNi.
const pulseRows=fixtures.map((f,i)=>({...f,index_id:i+1,name:`Basket ${i+1}`,category:i%2?'custom':'sectoral index',trade_date:'2026-09-10'}));
let pulseRequest;
const pulseService=load('src/services/sectorRotation.ts',{}, {fetch:async (url,options)=>{
  pulseRequest=JSON.parse(options.body);
  return {ok:true,json:async()=>({rows:pulseRows,history:pulseRows,date:'2026-09-10',period:22})};
}});
const pulse=await pulseService.fetchSectorPulse();
assert.equal(pulseRequest.intent_id,'sector.pulse.context');
assert.equal(pulseRequest.sector_category,undefined);
assert.equal(pulse.length,pulseRows.length);
pulse.forEach((row,i)=>{
  const c=row.cells[0];
  assert.equal(row.id,pulseRows[i].index_id);
  assert.equal(c.s5,pulseRows[i].score_5d??undefined);
  assert.equal(sectorSignal({score_5d:c.s5??null,score_22d:c.s22??null,avg_amt_5d:c.amt_5d??null,avg_amt_22d:c.amt_22d??null,ret_5d:c.ret_5d??null}),sectorSignal(pulseRows[i]));
});
console.log('Discovery and VaNi snapshot parity passed.');

// Personal joins use authenticated bookmarks and preserve all basket memberships.
const privateRows=[{equity_id:1,symbol:'HOLD',entry_price:100},{equity_id:2,symbol:'WATCH',entry_price:null},{equity_id:1,symbol:'HOLD',entry_price:100}];
let memberCalls=0,failMembership=false;
const personal=load('src/services/sectorPersonal.ts',{
 './bookmarks':{fetchBookmarks:async uid=>uid==='empty'?[]:privateRows},
 './postgrest':{from:()=>{const q={select(){return q},in(){return q},order(){return q},range(a,b){q.offset=a;return q},async execute(){memberCalls++;return failMembership?{error:{message:'failed'}}:{data:q.offset===0?Array.from({length:500},()=>({index_id:97,equity_id:1})):[{index_id:98,equity_id:1},{index_id:98,equity_id:2}]}}};return q}}
});
const personalSectors=[{id:97,name:'Sector',reading:'Strong'},{id:98,name:'Curated',reading:'Building'}];
const personalData=await personal.fetchSectorPersonal('user-a',[97,98]);
assert.equal(memberCalls,2,'Membership must paginate');
const matched=personal.personalConnections(personalData,personalSectors);
assert.equal(matched.length,2,'Count each saved stock once');
assert.equal(matched[0].kind,'Position');assert.equal(matched[0].sectors.length,2);
assert.equal(matched[1].kind,'Bookmark');
assert.equal(personal.personalConnections(personalData,[{id:99,name:'Other',reading:'Quiet'}]).length,0);
assert.equal((await personal.fetchSectorPersonal('empty',[97])).bookmarks.length,0);
failMembership=true;
await assert.rejects(()=>personal.fetchSectorPersonal('user-a',[97]),/could not be loaded/);
const recorded=await personal.fetchSectorPersonal('user-a',[97],{'97':[2]});
assert.equal(personal.personalConnections(recorded,personalSectors)[0].stock.symbol,'WATCH','Longer-term membership follows published snapshot');
console.log('PASS: personal stock deduplication, position labels, multiple memberships, empty account, membership errors and published membership');

const {leadershipStory}=load('src/services/leadershipStory.ts');
const storyRow={index_id:97,name:'Example',status:'Building',aligned_streak:10,current:{eligible:5,total:5,leaders:2,leaders_pct:40,weekly:true,monthly:true},alignment_history:[{weekly:true,monthly:true}],flow:{state:'Fading'}};
assert.match(leadershipStory([storyRow],'sector.leadership').title,/broad leadership is not yet established/);
assert.match(leadershipStory([storyRow],'sector.leadership.building').meaning,/broader share of Stage 2 Leaders/);
assert.match(leadershipStory([storyRow],'sector.leadership.support').meaning,/not missing data/);
assert.match(leadershipStory([{...storyRow,status:'Running broadly'}],'sector.leadership.flow').title,/recent flow is softer/);
assert.match(leadershipStory([{...storyRow,status:'Not aligned'}],'sector.leadership').title,/agreement is not established/);
assert.match(leadershipStory([],'sector.leadership').title,/No baskets/);
assert.match(leadershipStory([storyRow],'sector.leadership.cooling').title,/No baskets/);
assert.match(leadershipStory([{...storyRow,alignment_history:[{weekly:null,monthly:true},{weekly:true,monthly:true}]}],'sector.leadership.persistence').title,/Gaps/);
console.log('PASS: interpretation stories distinguish incomplete support, missing data, interruptions and opposing horizons');
