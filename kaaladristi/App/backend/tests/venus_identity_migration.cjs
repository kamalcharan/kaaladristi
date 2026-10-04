// Runs actual PostgreSQL SQL via isolated PGlite; no production connection.
const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const migration=fs.readFileSync(path.join(__dirname,'../../DBscripts/km_migration_235_venus_event_identity.sql'),'utf8');
const positions=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/venus_october_2026.json'),'utf8'));
const schema=`
CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE kd_readonly; CREATE ROLE kd_app;
ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO authenticated;
CREATE TABLE km_astro_event_definition(event_type text primary key,display_name text,shape text,definition text,definition_status text);
CREATE TABLE km_astro_event_reference(event_type text,reference_date date,source text,status text,PRIMARY KEY(event_type,reference_date,source));
CREATE TABLE km_astro_rule_master(id integer primary key,rule_code text unique,display_name text,rule_type text,planet_1 text,planet_2 text,
planet_state text,base_bias text,outcome text,probability_label text,conditions jsonb,remarks text,tags text[],is_active boolean default true,catalog_visible boolean default true,updated_at timestamptz);
INSERT INTO km_astro_rule_master(id,rule_code,display_name) VALUES
(221,'BAY-R03-VEN-RET','Venus Retrograde Period'),(199,'TRN-VEN-RIS-W-BUL','Venus Rise in West'),
(200,'TRN-VEN-RIS-E-BUL','Venus Rise in East'),(95,'TR-VEN-CMB-W-BUL','Venus Combust in West'),
(112,'CON-MER-VEN-BEA','Mercury Venus Conjunction'),(113,'CON-MER-VEN-CD-BEA','Mercury Venus Contra-Directional Conjunction'),
(123,'CON-VEN-MER-BEA','Venus Mercury Conjunction'),(999,'UNRELATED','Unrelated');
CREATE TABLE km_rule_transits(id bigserial primary key,rule_id integer REFERENCES km_astro_rule_master,start_date date,end_date date,
start_ts timestamptz,end_ts timestamptz,conditions_snapshot jsonb,direction text,sign text,motion text,combustion_type text,sun_sep_min numeric,
matched boolean,nifty_start_close numeric,nifty_end_close numeric,nifty_return_pct numeric,UNIQUE(rule_id,start_date));
INSERT INTO km_rule_transits(rule_id,start_date,end_date,conditions_snapshot) VALUES
(95,'2026-10-19','2026-10-30','{"condition":"combust"}'),
(112,'2026-10-05','2026-10-09','{}'),(113,'2026-10-05','2026-10-09','{}'),(123,'2026-10-05','2026-10-09','{}'),
(200,'2026-10-04','2026-10-04','{"event":"venus_station_retrograde"}'),(999,'2026-10-01','2026-10-02','{}');
CREATE TABLE km_planetary_positions(date date,planet text,longitude double precision,speed double precision,retrograde boolean,combust boolean,sign_name text,PRIMARY KEY(date,planet));
CREATE TABLE km_rule_inference(id integer primary key,rule_a_id integer,rule_b_id integer,status text,superseded_at timestamptz);
INSERT INTO km_rule_inference VALUES(1,113,NULL,'active',NULL),(2,999,NULL,'active',NULL);
CREATE TABLE km_rule_evidence(rule_id integer primary key,value text);
INSERT INTO km_rule_evidence VALUES(113,'stale'),(999,'keep');
CREATE TABLE km_vani_cache(cache_key text primary key,intent_id text);
INSERT INTO km_vani_cache VALUES('a','index.astro_now'),('b','other');
`;
async function setup(){const db=new PGlite();await db.exec(schema);for(const p of positions)await db.query('INSERT INTO km_planetary_positions VALUES($1,$2,$3,$4,$5,$6,$7)',[p.date,p.planet,p.longitude,p.speed,p.retrograde,p.combust,p.sign_name]);return db;}
async function rows(db,q){return (await db.query(q)).rows;}
(async()=>{
 const db=await setup();
 const old=await rows(db,'SELECT * FROM km_rule_transits ORDER BY id');
 await db.exec(migration);
 // The visibility extension must coexist with actual migration 235.
 const visibility=fs.readFileSync(path.join(__dirname,'../../DBscripts/km_migration_236_venus_visibility.sql'),'utf8');
 await db.exec(visibility);
 assert.equal((await rows(db,'SELECT count(*)::int n FROM km_venus_visibility_windows'))[0].n,52);
 assert.equal((await rows(db,'SELECT count(*)::int n FROM km_venus_visibility_calendar'))[0].n,156);
 const service=fs.readFileSync(path.join(__dirname,'../lib/venus_calendar.py'),'utf8');
 let paramIndex=0;
 const calendarQuery=service.match(/rows = db.execute\('''([\s\S]*?)'''/)[1].replace(/%s/g,()=>`$${++paramIndex}`);
 const october=(await db.query(calendarQuery,['2026-10-31','2026-10-01'])).rows;
 assert.equal(october.filter(e=>e.event_type==='venus_tara_asta').length,1);
 assert.equal(october.filter(e=>e.event_type==='venus_tara_udaya').length,1);
 assert.equal(october.find(e=>e.event_type==='venus_tara_asta').parameters.method_version,'venus_visibility_ujjain_v1');
 assert.equal(october.find(e=>e.event_type==='mercury_direct_venus_retrograde_crossing').bracket_start_date.toISOString().slice(0,10),'2026-10-06');
 const visibilityBefore=await rows(db,'SELECT * FROM km_venus_visibility_windows ORDER BY start_ts');
 await db.exec(visibility);
 assert.deepEqual(await rows(db,'SELECT * FROM km_venus_visibility_windows ORDER BY start_ts'),visibilityBefore);
 assert.equal((await rows(db,"SELECT has_table_privilege('authenticated','km_venus_visibility_windows','INSERT') ok"))[0].ok,false);
 assert.equal((await rows(db,"SELECT count(*)::int n FROM km_venus_calendar WHERE event_type='venus_tara_asta'"))[0].n,52);
 const keysBefore=await rows(db,'SELECT event_key FROM km_venus_visibility_calendar ORDER BY event_key');
 await db.exec("SET TIME ZONE 'Pacific/Auckland'");
 assert.deepEqual(await rows(db,'SELECT event_key FROM km_venus_visibility_calendar ORDER BY event_key'),keysBefore);
 await db.exec("SET TIME ZONE 'UTC'");
 await db.exec("UPDATE km_venus_visibility_windows SET parameters=parameters || '{\"method_version\":\"bad\"}'::jsonb WHERE start_ts=(SELECT min(start_ts) FROM km_venus_visibility_windows)");
 await assert.rejects(db.exec(visibility),/Visibility method\/date conflict/);
 await db.exec('ROLLBACK');
 await db.exec("UPDATE km_venus_visibility_windows SET parameters=parameters || '{\"method_version\":\"venus_visibility_ujjain_v1\"}'::jsonb");
 assert.equal((await rows(db,"SELECT display_name FROM km_astro_rule_master WHERE id=200"))[0].display_name,'Venus Turns Retrograde');
 assert.equal((await rows(db,"SELECT display_name FROM km_astro_rule_master WHERE id=95"))[0].display_name,'Venus Combustion');
 assert.equal((await rows(db,"SELECT is_active FROM km_astro_rule_master WHERE id=123"))[0].is_active,false);
 assert.equal((await rows(db,'SELECT count(*)::int n FROM km_rule_transits WHERE rule_id=123'))[0].n,0);
 let combustion=(await rows(db,"SELECT * FROM km_venus_event_calendar WHERE event_type='venus_combustion'"))[0];
 assert.equal(combustion.start_date.toISOString().slice(0,10),'2026-10-18');
 assert.equal(combustion.end_date.toISOString().slice(0,10),'2026-10-30');
 assert.equal(combustion.start_ts,null);
 for (const [event,start,end] of [
  ['mercury_venus_proximity','2026-10-03','2026-10-10'],
  ['mercury_direct_venus_retrograde_proximity','2026-10-04','2026-10-10'],
  ['venus_turns_retrograde','2026-10-04','2026-10-04']
 ]) {
  const row=(await rows(db,`SELECT * FROM km_venus_event_calendar WHERE event_type='${event}'`))[0];
  assert.equal(row.start_date.toISOString().slice(0,10),start);
  assert.equal(row.end_date.toISOString().slice(0,10),end);
 }
 const crossing=(await rows(db,"SELECT * FROM km_venus_event_calendar WHERE event_type='mercury_direct_venus_retrograde_crossing'"))[0];
 assert.equal(crossing.bracket_start_date.toISOString().slice(0,10),'2026-10-06');
 assert.equal(crossing.bracket_end_date.toISOString().slice(0,10),'2026-10-07');
 assert.equal(crossing.start_ts,null);
 assert.equal((await rows(db,"SELECT count(*)::int n FROM km_venus_event_calendar WHERE event_type IN ('venus_rise','venus_combustion_west')"))[0].n,0);
 assert.equal((await rows(db,"SELECT status FROM km_rule_inference WHERE id=1"))[0].status,'superseded');
 assert.equal((await rows(db,'SELECT value FROM km_rule_evidence WHERE rule_id=999'))[0].value,'keep');
 assert.deepEqual((await rows(db,'SELECT * FROM km_rule_transits WHERE rule_id=999'))[0],old.find(r=>r.rule_id===999));
 assert.equal((await rows(db,"SELECT count(*)::int n FROM km_venus_identity_backup WHERE source_table='km_rule_transits'"))[0].n,5);
 assert.equal((await rows(db,"SELECT has_table_privilege('authenticated','km_venus_identity_backup','SELECT') ok"))[0].ok,false);
 assert.equal((await rows(db,"SELECT has_function_privilege('authenticated','refresh_venus_event_windows()','EXECUTE') ok"))[0].ok,false);
 assert.equal((await rows(db,"SELECT has_function_privilege('kd_app','refresh_venus_event_windows()','EXECUTE') ok"))[0].ok,true);
 // No-op refresh and migration reruns preserve regenerated scores/hypotheses.
 await db.exec("INSERT INTO km_rule_evidence VALUES(113,'new');UPDATE km_rule_inference SET status='active' WHERE id=1");
 const current=await rows(db,'SELECT * FROM km_rule_transits ORDER BY id');
 assert.equal((await rows(db,'SELECT refresh_venus_event_windows() n'))[0].n,0);
 await db.exec(migration);
 assert.deepEqual(await rows(db,'SELECT * FROM km_rule_transits ORDER BY id'),current);
 assert.equal((await rows(db,'SELECT value FROM km_rule_evidence WHERE rule_id=113'))[0].value,'new');
 // Same-direction proximity is NOT the special contra-directional rule.
 await db.exec("UPDATE km_planetary_positions SET retrograde=false,speed=abs(speed) WHERE planet='Venus' AND date BETWEEN '2026-10-03' AND '2026-10-11'");
 assert.equal((await rows(db,"SELECT count(*)::int n FROM km_venus_event_calendar WHERE event_type='mercury_direct_venus_retrograde_proximity'"))[0].n,0);
 assert.equal((await rows(db,"SELECT count(*)::int n FROM km_venus_event_calendar WHERE event_type='mercury_venus_proximity'"))[0].n,1);
 await db.exec('SELECT refresh_venus_event_windows()');
 assert.equal((await rows(db,'SELECT count(*)::int n FROM km_rule_transits WHERE rule_id=113'))[0].n,0);
 assert.equal((await rows(db,'SELECT count(*)::int n FROM km_rule_evidence WHERE rule_id=113'))[0].n,0);
 // Missing sample cannot invent a crossing or erase old history.
 await db.exec("DELETE FROM km_planetary_positions WHERE date='2026-10-06' AND planet='Mercury'");
 assert.equal((await rows(db,"SELECT count(*)::int n FROM km_venus_event_calendar WHERE event_type='mercury_venus_crossing'"))[0].n,0);
 await assert.rejects(db.exec('SELECT refresh_venus_event_windows()'),/Incomplete paired/);
 await db.close();
 // Full transaction rollback when source coverage is insufficient.
 const bad=await setup();await bad.exec("INSERT INTO km_rule_transits(rule_id,start_date,end_date) VALUES(95,'2000-01-01','2000-01-02')");
 await assert.rejects(bad.exec(migration),/coverage is shorter/);await bad.exec('ROLLBACK');
 assert.equal((await rows(bad,'SELECT display_name FROM km_astro_rule_master WHERE id=95'))[0].display_name,'Venus Combust in West');
 assert.equal((await rows(bad,"SELECT to_regclass('km_venus_identity_backup') x"))[0].x,null);
 await bad.close();
 console.log('PASS Venus: actual October samples, weekend combustion, crossing bracket, motion enforcement, alias dedup, backup, unrelated data, permissions, idempotency, invalidation, missing samples, transactional rollback');
})().catch(e=>{console.error(e);process.exit(1)});
