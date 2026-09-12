import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import ts from 'typescript';

const root=process.cwd();
function load(file, dependencies={}) {
  const exports={};
  const js=ts.transpileModule(readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  runInNewContext(js,{exports,require:id=>dependencies[id]||{},console,Date,Map,Set});
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
