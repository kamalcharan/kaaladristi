const {setup}=require('./venus_identity_migration.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const sql=name=>fs.readFileSync(path.join(__dirname,'../../DBscripts',name),'utf8');
(async()=>{
 const db=await setup();
 await db.exec(`ALTER TABLE km_astro_rule_master ADD COLUMN is_deleted boolean DEFAULT false;
 ALTER TABLE km_astro_rule_master ADD COLUMN data_source text;
 CREATE SEQUENCE test_rule_ids START 1000;
 ALTER TABLE km_astro_rule_master ALTER COLUMN id SET DEFAULT nextval('test_rule_ids');
 INSERT INTO km_astro_rule_master(id,rule_code,display_name,conditions) VALUES
 (197,'TRN-MER-MAN-TRN','Mercury Manifestation','{}'),(198,'TRN-MER-RIS-W-BUL','Mercury Rise','{}'),
 (102,'TR-MER-CMB-E-BEA','Mercury Combust','{}'),(238,'TR-MER-RET','Mercury Retrograde','{}');
 INSERT INTO km_rule_transits(rule_id,start_date,end_date,start_ts,end_ts,conditions_snapshot,sign) VALUES
 (102,'2026-07-02','2026-07-24','2026-07-02 20:14+05:30','2026-07-24 05:11+05:30','{"rule_type":"combust","detect":"visibility_v3","combust_source":"almanac_ujjain"}','Gemini');`);
 for(const name of ['km_migration_234_mercury_event_identity.sql','km_migration_235_venus_event_identity.sql','km_migration_236_venus_visibility.sql','km_migration_237_astro_event_workspace.sql'])await db.exec(sql(name));
 const rows=async q=>(await db.query(q)).rows;
 assert.equal((await rows('SELECT * FROM km_astro_family')).length,7);
 assert.equal((await rows('SELECT * FROM km_astro_rule_master WHERE is_active')).length,7);
 assert.equal((await rows('SELECT * FROM km_astro_workspace_archive')).length,12);
 const events=await rows('SELECT * FROM km_astro_managed_occurrences');
 assert.equal(new Set(events.map(e=>e.event_key)).size,events.length);
 assert(events.some(e=>e.event_type==='mercury_rise'));
 assert(events.some(e=>e.event_type==='mercury_visibility_disappears'));
 assert(!events.some(e=>e.event_type==='mercury_manifestation'||e.event_type==='venus_combustion'));
 assert.equal(events.find(e=>e.event_type==='mercury_venus_crossing').details.contra_directional,true);
 assert.equal((await rows("SELECT has_table_privilege('authenticated','km_astro_workspace_archive','SELECT') ok"))[0].ok,false);
 assert.equal((await rows("SELECT has_table_privilege('authenticated','km_astro_family','UPDATE') ok"))[0].ok,false);
 // Execute the production reader SQL, not an approximation of its predicates.
 const service=fs.readFileSync(path.join(__dirname,'../lib/astro_events.py'),'utf8');
 const queries=[...service.matchAll(/db.execute\('''([\s\S]*?)'''/g)].map(m=>{let i=0;return m[1].replace(/%s/g,()=>`$${++i}`)});
 const read=async admin=>(await db.query(queries[1],['2026-10-31','2026-10-01',admin])).rows;
 assert((await read(false)).some(e=>e.family_id==='venus-visibility'));
 await db.exec("UPDATE km_astro_rule_master SET catalog_visible=false WHERE rule_code='EVT-VEN-VISIBILITY'");
 assert(!(await read(false)).some(e=>e.family_id==='venus-visibility'));
 assert((await read(true)).some(e=>e.family_id==='venus-visibility'));
 assert.equal((await db.query(queries[0],['2026-10-04','2026-10-04','2026-10-04','2026-10-04',false])).rows.length,6);
 await db.exec(sql('km_migration_237_astro_event_workspace.sql'));
 assert.equal((await rows("SELECT catalog_visible FROM km_astro_rule_master WHERE rule_code='EVT-VEN-VISIBILITY'"))[0].catalog_visible,false);
 assert.deepEqual(await rows('SELECT * FROM km_astro_managed_occurrences'),events);
 await db.close();console.log('PASS workspace: migrations 234–237, archive, identities, exact dates, uniqueness, publication, permissions and rerun preservation');
})().catch(e=>{console.error(e);process.exit(1)});
