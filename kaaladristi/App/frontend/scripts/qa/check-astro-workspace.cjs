const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'../..');
function load(name,dependencies={}){
 const source=fs.readFileSync(path.join(root,'src/services',name+'.ts'),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};vm.runInNewContext(code,{exports,require:key=>{if(!(key in dependencies))throw Error(key);return dependencies[key]},Intl,Date,Map,Set});return exports;
}
const events=load('astroEvents',{'./apiClient':{api:{}}});
const {migrateAstroSelections:migrate}=load('astroSelection',{'./astroEvents':events});
const make=(id,visible=true)=>({catalog_item_id:id,type:'astro_zone',visible});
const input=[make('astro_group:Mercury'),make('astro_rule:TR-MER-RET'),make('astro_group:Venus'),make('astro_rule:TR-VEN-CMB-W-BUL')];
const output=migrate(input);
assert.equal(output.length,8); // seven families and one retired angular-combustion selection
assert.equal(output.filter(x=>x.catalog_item_id==='astro_event:mercury-venus-conjunction').length,1);
assert.equal(output.at(-1).visible,false);
assert.equal(output.at(-1).config.retired,true);
assert.deepEqual(JSON.parse(JSON.stringify(migrate(output))),JSON.parse(JSON.stringify(output)));
assert.equal(input.at(-1).visible,true); // source selection is not mutated
const {eventCoordinate}=load('astroCoordinates');
const rows=[{trade_date:'2026-10-02'},{trade_date:'2026-10-05'}];
const coords=d=>({'2026-10-02':0,'2026-10-05':90}[d]??null);
assert.equal(eventCoordinate('2026-10-04',rows,coords),60);
assert.equal(eventCoordinate('2026-10-05',rows,coords),90);
assert.equal(eventCoordinate('2026-10-01',rows,coords),null);
(async()=>{
 const {fetchAstroBands}=load('astroOverlayService',{'./astroEvents':{
  ...events,fetchAstroFamilies:async()=>[{id:'venus-visibility',planets:['Venus']}],
  fetchAstroEvents:async()=>[{family_id:'venus-visibility',rule_id:100,event_type:'venus_tara_asta',display_name:'Venus Tara Asta',shape:'point',start_date:'2026-10-14',end_date:'2026-10-14',start_ts:'2026-10-14T18:00:27+05:30',details:{}}]
 }});
 const bands=await fetchAstroBands(new Map([['astro_event:venus-visibility','#123456']]),new Map(),'2026-01-01','2026-12-31');
 assert.equal(bands.length,1);assert.equal(bands[0].isPoint,true);assert.equal(bands[0].startTs,'2026-10-14T18:00:27+05:30');
 assert.equal((await fetchAstroBands(new Map([['astro_rule:UNSUPPORTED','#123456']]),new Map(),'2026-01-01')).length,0);
 console.log('PASS astro: saved-selection migration, deduplication, idempotency, retirement, weekend coordinates, canonical overlay dates');
})().catch(e=>{console.error(e);process.exit(1)});
