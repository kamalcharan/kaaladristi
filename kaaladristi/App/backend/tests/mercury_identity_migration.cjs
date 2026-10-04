// Integration tests execute the real migration in an isolated PostgreSQL WASM
// instance. Set NODE_PATH to an installation of @electric-sql/pglite.
const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const migration = fs.readFileSync(path.join(__dirname,'../../DBscripts/km_migration_234_mercury_event_identity.sql'),'utf8');
const schema = `
CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE kd_readonly;
ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO authenticated;
CREATE TABLE km_astro_rule_master(id integer primary key,rule_code text unique,display_name text,
 rule_type text CHECK(rule_type IN ('planet_state','planet_transit','planet_manifestation')),
 planet_1 text,planet_2 text,planet_state text,base_bias text,outcome text,probability_label text,
 remarks text,conditions jsonb,updated_at timestamptz,tags text[] DEFAULT ARRAY['Mercury','Manifestation']);
INSERT INTO km_astro_rule_master(id,rule_code,display_name,rule_type,base_bias,conditions) VALUES
 (197,'TRN-MER-MAN-TRN','Mercury Manifestation','planet_manifestation','turning','{}'),
 (198,'TRN-MER-RIS-W-BUL','Mercury Rise in West','planet_manifestation','bullish','{}'),
 (102,'TR-MER-CMB-E-BEA','Mercury Combust East Vimshra Speed','planet_state','bearish','{}'),
 (238,'TR-MER-RET','Mercury Retrograde','planet_state','turning','{}'),
 (999,'UNRELATED','Unrelated','planet_state','bullish','{}');
CREATE TABLE km_rule_transits(id bigint primary key,rule_id integer REFERENCES km_astro_rule_master,
 start_date date,end_date date,start_ts timestamptz,end_ts timestamptz,sign text,
 conditions_snapshot jsonb,matched boolean,nifty_return_pct numeric);
INSERT INTO km_rule_transits VALUES
 (1,197,'2026-07-07','2026-08-05','2026-07-07 10:32+05:30','2026-08-05 19:54+05:30','Gemini','{"sign":"Gemini","rule_type":"sign_transit"}',true,2),
 (2,197,'2026-08-05','2026-08-22','2026-08-05 19:54+05:30','2026-08-22 19:31+05:30','Cancer','{"sign":"Cancer","rule_type":"sign_transit"}',false,-1),
 (3,198,'2026-07-24','2026-07-24','2026-07-24 04:28:50+05:30','2026-07-24 04:28:50+05:30','Gemini','{"event":"mercury_station_direct","rule_type":"manifestation"}',true,1),
 (4,102,'2026-07-02','2026-07-24','2026-07-02 20:14+05:30','2026-07-24 05:11+05:30','Gemini','{"rule_type":"combust","detect":"visibility_v3","combust_source":"almanac_ujjain","conjunction":"inferior"}',false,-2),
 (5,238,'2026-06-29','2026-07-24','2026-06-29 23:04+05:30','2026-07-24 04:28:50+05:30','Cancer','{"event":"mercury_retrograde","rule_type":"retrograde"}',true,3),
 (6,238,'2026-10-24','2026-11-13','2026-10-24 12:42+05:30','2026-11-13 21:24+05:30','Libra','{"event":"mercury_retrograde","rule_type":"retrograde"}',true,4),
 (7,999,'2026-07-01','2026-07-02',NULL,NULL,NULL,'{}',true,5);
CREATE TABLE km_rule_inference(id integer primary key,rule_a_id integer,rule_b_id integer,status text,superseded_at timestamptz);
INSERT INTO km_rule_inference VALUES(1,197,NULL,'active',NULL),(2,999,198,'active',NULL),(3,999,NULL,'active',NULL);
CREATE TABLE km_vani_cache(cache_key text primary key,intent_id text,response_text text);
INSERT INTO km_vani_cache VALUES('a','index.astro_now','old'),('b','other','keep');
`;
async function setup(){
 const db=new PGlite(); await db.exec(schema);
 for(const table of ['km_rule_evidence','km_rule_confidence','km_rule_confidence_bench','km_rule_confidence_yearly','km_rule_signals','km_rule_patterns']){
  await db.exec(`CREATE TABLE ${table}(rule_id integer primary key,value text); INSERT INTO ${table} VALUES(197,'old'),(999,'keep');`);
 } return db;
}
async function rows(db,sql){return (await db.query(sql)).rows;}
(async()=>{
 const db=await setup();
 const before=await rows(db,'SELECT id,rule_id,start_date,end_date,start_ts,end_ts,nifty_return_pct FROM km_rule_transits ORDER BY id');
 await db.exec(migration);
 await db.exec(fs.readFileSync(path.join(__dirname,'../../DBscripts/verify_234_mercury_event_identity.sql'),'utf8'));
 assert.deepEqual(await rows(db,'SELECT id,rule_id,start_date,end_date,start_ts,end_ts,nifty_return_pct FROM km_rule_transits ORDER BY id'),before);
 const defs=await rows(db,'SELECT id,display_name FROM km_astro_rule_master ORDER BY id');
 assert.equal(defs.find(r=>r.id===197).display_name,'Mercury Sign Journey');
 assert.equal(defs.find(r=>r.id===198).display_name,'Mercury Turns Direct');
 assert.equal((await rows(db,"SELECT 'Manifestation'=ANY(tags) AS tagged FROM km_astro_rule_master WHERE id=197"))[0].tagged,false);
 const cal=await rows(db,"SELECT * FROM km_mercury_event_calendar ORDER BY event_key");
 assert.equal(cal.filter(r=>r.event_type==='mercury_manifestation').length,0);
 assert.equal(cal.filter(r=>r.event_type==='mercury_motion_direct').length,1);
 const rise=cal.find(r=>r.event_type==='mercury_rise');
 const station=cal.find(r=>r.event_type==='mercury_turns_direct');
 assert.equal(rise.source_transit_id,4); assert.equal(rise.emergence,'morning');
 assert.equal(rise.sign_lord_at_start,'Mercury');
 assert.notEqual(String(rise.start_ts),String(station.start_ts));
 assert.equal(rise.visibility_source,'almanac_ujjain');
 assert.equal(rise.motion_at_start,'direct');
 assert.equal(rise.source_kind,'almanac_override');
 assert.equal((await rows(db,"SELECT count(*)::int n FROM km_astro_event_reference WHERE status='unverified'"))[0].n,3);
 assert.equal((await rows(db,"SELECT status FROM km_rule_inference WHERE id=2"))[0].status,'superseded');
 assert.equal((await rows(db,"SELECT status FROM km_rule_inference WHERE id=3"))[0].status,'active');
 assert.equal((await rows(db,'SELECT count(*)::int n FROM km_rule_evidence'))[0].n,1);
 assert.equal((await rows(db,'SELECT cache_key FROM km_vani_cache'))[0].cache_key,'b');
 assert.equal((await rows(db,"SELECT has_table_privilege('authenticated','km_mercury_identity_backup','SELECT') AS ok"))[0].ok,false);
 assert.equal((await rows(db,"SELECT has_table_privilege('authenticated','km_astro_rule_event_map','UPDATE') AS ok"))[0].ok,false);
 assert.equal((await rows(db,"SELECT has_table_privilege('kd_readonly','km_mercury_event_calendar','SELECT') AS ok"))[0].ok,true);
 // Rerunning migration preserves new research and the original recovery rows.
 const backupCount=(await rows(db,'SELECT count(*)::int n FROM km_mercury_identity_backup'))[0].n;
 await db.exec("INSERT INTO km_rule_evidence VALUES(197,'recomputed'); UPDATE km_rule_inference SET status='active' WHERE id=1");
 await db.exec(migration);
 assert.equal((await rows(db,"SELECT value FROM km_rule_evidence WHERE rule_id=197"))[0].value,'recomputed');
 assert.equal((await rows(db,"SELECT status FROM km_rule_inference WHERE id=1"))[0].status,'active');
 assert.equal((await rows(db,'SELECT count(*)::int n FROM km_mercury_identity_backup'))[0].n,backupCount);
 // Date-only records remain date-only; an angular threshold is not heliacal rise.
 await db.exec(`INSERT INTO km_rule_transits VALUES(8,102,'2025-01-01','2025-01-05',NULL,NULL,NULL,'{"rule_type":"combust","detect":"angular"}',NULL,NULL)`);
 assert.equal((await rows(db,"SELECT start_precision FROM km_mercury_event_calendar WHERE source_transit_id=8"))[0].start_precision,'date_only');
 assert.equal((await rows(db,"SELECT count(*)::int n FROM km_mercury_event_calendar WHERE source_transit_id=8 AND event_type='mercury_rise'"))[0].n,0);
 // Clipped periods with no timestamp cannot invent a rise/station boundary.
 await db.exec(`INSERT INTO km_rule_transits VALUES
 (9,102,'2024-01-01','2024-01-05',NULL,NULL,NULL,'{"rule_type":"combust","detect":"visibility_v3"}',NULL,NULL),
 (10,238,'1990-01-01','1990-01-10',NULL,NULL,NULL,'{"event":"mercury_retrograde","rule_type":"retrograde"}',NULL,NULL)`);
 assert.equal((await rows(db,"SELECT count(*)::int n FROM km_mercury_event_calendar WHERE source_transit_id IN (9,10) AND shape='point'"))[0].n,0);
 await db.close();
 // Unknown old data must abort and rollback the complete migration.
 const bad=await setup();
 await bad.exec("UPDATE km_rule_transits SET conditions_snapshot='{}' WHERE id=1");
 await assert.rejects(bad.exec(migration),/Unexpected Mercury snapshots/);
 await bad.exec('ROLLBACK');
 assert.equal((await rows(bad,'SELECT display_name FROM km_astro_rule_master WHERE id=197'))[0].display_name,'Mercury Manifestation');
 assert.equal((await rows(bad,"SELECT to_regclass('km_astro_rule_event_map') AS t"))[0].t,null);
 await bad.close();
 console.log('PASS: migration, date/ID preservation, rise vs station, bounded motion, sign lord, provenance, pending references, stale research, grants, idempotency, date-only boundaries, fail-closed rollback');
})().catch(e=>{console.error(e);process.exitCode=1});
