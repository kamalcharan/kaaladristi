-- Mercury data identity cleanup. No ephemeris recalculation or UI changes.
-- Run as migration owner after migration 233. Entire script is transactional.
-- Stable legacy rule IDs/codes are retained for existing consumers; event_type
-- is the canonical identity. Backup tables below are private recovery material.
BEGIN;
SET LOCAL lock_timeout = '10s';

CREATE TABLE IF NOT EXISTS public.km_astro_event_definition (
    event_type text PRIMARY KEY,
    display_name text NOT NULL,
    shape text NOT NULL CHECK (shape IN ('point', 'period')),
    definition text NOT NULL,
    definition_status text NOT NULL CHECK (definition_status IN ('defined', 'pending'))
);
INSERT INTO public.km_astro_event_definition VALUES
 ('mercury_sign_journey','Mercury Sign Journey','period','Mercury occupancy of a sidereal zodiac sign; not manifestation or motion change.','defined'),
 ('mercury_motion_retrograde','Mercury Retrograde','period','Mercury retrograde motion interval. Sign is independent of motion.','defined'),
 ('mercury_motion_direct','Mercury Direct','period','Direct interval bounded by two recorded retrograde periods; no extrapolation outside coverage.','defined'),
 ('mercury_turns_direct','Mercury Turns Direct','point','Mercury geocentric longitudinal speed changes from retrograde to direct. Not heliacal rise.','defined'),
 ('mercury_turns_retrograde','Mercury Turns Retrograde','point','Start boundary of a recorded Mercury retrograde period.','defined'),
 ('mercury_combustion','Mercury Combustion','period','Recorded combustion/invisibility interval. Method and source must accompany the dates.','defined'),
 ('mercury_rise','Mercury Rise','point','End of a visibility_v3 Mercury invisibility period. Morning/evening subtype is derived from the recorded conjunction.','defined'),
 ('mercury_manifestation','Mercury Manifestation','point','Unresolved owner terminology. No sign-transit, station or rise dates are automatically assigned to this identity.','pending')
ON CONFLICT (event_type) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.km_astro_rule_event_map (
    rule_id integer PRIMARY KEY REFERENCES public.km_astro_rule_master(id),
    event_type text NOT NULL REFERENCES public.km_astro_event_definition(event_type),
    legacy_rule_code text NOT NULL UNIQUE,
    generator text NOT NULL DEFAULT 'generate_mercury_windows.py'
);
CREATE TABLE IF NOT EXISTS public.km_mercury_identity_backup (
    source_table text NOT NULL,
    row_key text NOT NULL,
    payload jsonb NOT NULL,
    archived_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (source_table, row_key)
);
REVOKE ALL ON public.km_mercury_identity_backup FROM PUBLIC;

-- Fail closed rather than assigning new identities to unfamiliar records.
DO $$ BEGIN
 IF (SELECT count(*) FROM public.km_astro_rule_master WHERE rule_code IN
   ('TRN-MER-MAN-TRN','TRN-MER-RIS-W-BUL','TR-MER-CMB-E-BEA','TR-MER-RET')) <> 4 THEN
   RAISE EXCEPTION 'Expected four Mercury source rules; inspect rule master before migration';
 END IF;
 IF EXISTS (
   SELECT 1 FROM public.km_rule_transits t JOIN public.km_astro_rule_master r ON r.id=t.rule_id
   WHERE (r.rule_code='TRN-MER-MAN-TRN' AND (t.conditions_snapshot->>'rule_type') IS DISTINCT FROM 'sign_transit')
      OR (r.rule_code='TRN-MER-RIS-W-BUL' AND (t.conditions_snapshot->>'event') IS DISTINCT FROM 'mercury_station_direct')
      OR (r.rule_code='TR-MER-CMB-E-BEA' AND (t.conditions_snapshot->>'rule_type') IS DISTINCT FROM 'combust')
      OR (r.rule_code='TR-MER-RET' AND (t.conditions_snapshot->>'event') IS DISTINCT FROM 'mercury_retrograde')
 ) THEN RAISE EXCEPTION 'Unexpected Mercury snapshots: cleanup aborted without reclassification'; END IF;
END $$;

-- Backup once; a rerun must not discard evidence produced after this cleanup.
DO $$
DECLARE affected integer[]; tab text; first_run boolean;
BEGIN
 first_run := NOT EXISTS (SELECT 1 FROM public.km_mercury_identity_backup WHERE source_table='_migration' AND row_key='234');
 SELECT array_agg(id) INTO affected FROM public.km_astro_rule_master WHERE rule_code IN
   ('TRN-MER-MAN-TRN','TRN-MER-RIS-W-BUL','TR-MER-CMB-E-BEA','TR-MER-RET');
 IF first_run THEN
   INSERT INTO public.km_mercury_identity_backup(source_table,row_key,payload)
   SELECT 'km_astro_rule_master',id::text,to_jsonb(r) FROM public.km_astro_rule_master r WHERE id=ANY(affected);
   INSERT INTO public.km_mercury_identity_backup(source_table,row_key,payload)
   SELECT 'km_rule_transits',id::text,to_jsonb(t) FROM public.km_rule_transits t WHERE rule_id=ANY(affected);
   -- Old research remains recoverable, but is no longer an active hypothesis
   -- for the corrected identity (including pair hypotheses).
   IF to_regclass('public.km_rule_inference') IS NOT NULL THEN
     INSERT INTO public.km_mercury_identity_backup(source_table,row_key,payload)
     SELECT 'km_rule_inference',id::text,to_jsonb(i) FROM public.km_rule_inference i
     WHERE rule_a_id=ANY(affected) OR rule_b_id=ANY(affected);
     UPDATE public.km_rule_inference SET status='superseded',superseded_at=now()
     WHERE status='active' AND (rule_a_id=ANY(affected) OR rule_b_id=ANY(affected));
   END IF;
   FOREACH tab IN ARRAY ARRAY['km_rule_evidence','km_rule_confidence','km_rule_confidence_bench','km_rule_confidence_yearly','km_rule_signals','km_rule_patterns'] LOOP
     IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=tab AND column_name='rule_id') THEN
       EXECUTE format('INSERT INTO public.km_mercury_identity_backup(source_table,row_key,payload) SELECT %L,md5(to_jsonb(x)::text),to_jsonb(x) FROM public.%I x WHERE rule_id=ANY($1) ON CONFLICT DO NOTHING',tab,tab) USING affected;
       EXECUTE format('DELETE FROM public.%I WHERE rule_id=ANY($1)',tab) USING affected;
     END IF;
   END LOOP;
   UPDATE public.km_rule_transits SET matched=NULL WHERE rule_id=ANY(affected);
   IF to_regclass('public.km_vani_cache') IS NOT NULL THEN
     INSERT INTO public.km_mercury_identity_backup(source_table,row_key,payload)
     SELECT 'km_vani_cache',md5(to_jsonb(c)::text),to_jsonb(c) FROM public.km_vani_cache c
     WHERE intent_id='index.astro_now';
     DELETE FROM public.km_vani_cache WHERE intent_id='index.astro_now';
   END IF;
   INSERT INTO public.km_mercury_identity_backup VALUES ('_migration','234','{"version":1}'::jsonb,now());
 END IF;
END $$;

INSERT INTO public.km_astro_rule_event_map(rule_id,event_type,legacy_rule_code)
SELECT r.id, v.event_type,r.rule_code FROM public.km_astro_rule_master r JOIN (VALUES
 ('TRN-MER-MAN-TRN','mercury_sign_journey'),
 ('TRN-MER-RIS-W-BUL','mercury_turns_direct'),
 ('TR-MER-CMB-E-BEA','mercury_combustion'),
 ('TR-MER-RET','mercury_motion_retrograde')
) v(code,event_type) ON v.code=r.rule_code ON CONFLICT (rule_id) DO NOTHING;

UPDATE public.km_astro_rule_master r SET
 display_name=d.display_name,
 rule_type=CASE WHEN m.event_type='mercury_sign_journey' THEN 'planet_transit' ELSE 'planet_state' END,
 planet_1='Mercury', planet_2=NULL, planet_state=NULL,
 base_bias='neutral',outcome='neutral',probability_label=NULL,
 remarks=d.definition,
 tags=ARRAY(SELECT DISTINCT tag FROM unnest(array_remove(coalesce(r.tags,ARRAY[]::text[]),'Manifestation') || ARRAY['Mercury']) AS tag),
 conditions=jsonb_build_object('event_type',m.event_type,'generator','generate_mercury_windows.py','identity_version',1),
 updated_at=now()
FROM public.km_astro_rule_event_map m JOIN public.km_astro_event_definition d USING(event_type)
WHERE r.id=m.rule_id AND r.conditions->>'identity_version' IS DISTINCT FROM '1';

UPDATE public.km_rule_transits t SET conditions_snapshot=
  t.conditions_snapshot || jsonb_build_object('event_type',m.event_type,'identity_version',1) ||
  CASE WHEN m.event_type='mercury_turns_direct' THEN '{"rule_type":"motion_transition"}'::jsonb ELSE '{}'::jsonb END
FROM public.km_astro_rule_event_map m WHERE t.rule_id=m.rule_id;

-- Keep the owner's original reference dates without calling them generated
-- astronomical events. They intentionally never appear in the event calendar.
CREATE TABLE IF NOT EXISTS public.km_astro_event_reference (
 event_type text NOT NULL REFERENCES public.km_astro_event_definition(event_type),
 reference_date date NOT NULL,
 source text NOT NULL,
 status text NOT NULL CHECK(status='unverified'),
 PRIMARY KEY(event_type,reference_date,source)
);
INSERT INTO public.km_astro_event_reference VALUES
 ('mercury_manifestation','2026-04-10','owner_reference','unverified'),
 ('mercury_manifestation','2026-08-03','owner_reference','unverified'),
 ('mercury_manifestation','2026-11-14','owner_reference','unverified')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE VIEW public.km_mercury_event_calendar AS
WITH raw AS (
 SELECT t.*,m.event_type,m.legacy_rule_code
 FROM public.km_rule_transits t JOIN public.km_astro_rule_event_map m ON m.rule_id=t.rule_id
), retro AS (
 SELECT *,lead(start_date) OVER (ORDER BY start_date,id) AS next_start_date,
 lead(start_ts) OVER (ORDER BY start_date,id) AS next_start_ts
 FROM raw WHERE event_type='mercury_motion_retrograde'
), events AS (
 SELECT id::text||':record' AS event_key,id AS source_transit_id,rule_id,legacy_rule_code,event_type,
 start_date,end_date,start_ts,end_ts,conditions_snapshot AS provenance FROM raw
 UNION ALL
 SELECT id::text||':turn-retrograde',id,rule_id,legacy_rule_code,'mercury_turns_retrograde',
 start_date,start_date,start_ts,start_ts,conditions_snapshot FROM retro WHERE start_ts IS NOT NULL
 UNION ALL
 SELECT id::text||':direct-period',id,rule_id,legacy_rule_code,'mercury_motion_direct',
 end_date,next_start_date,end_ts,next_start_ts,conditions_snapshot
 FROM retro WHERE next_start_date>end_date AND end_ts IS NOT NULL AND next_start_ts IS NOT NULL
 UNION ALL
 SELECT id::text||':rise',id,rule_id,legacy_rule_code,'mercury_rise',
 end_date,end_date,end_ts,end_ts,conditions_snapshot FROM raw
 WHERE event_type='mercury_combustion' AND conditions_snapshot->>'detect'='visibility_v3' AND end_ts IS NOT NULL
)
SELECT e.event_key,e.source_transit_id,e.rule_id,e.legacy_rule_code,e.event_type,
 d.display_name,d.shape,e.start_date,e.end_date,e.start_ts,e.end_ts,
 e.start_ts AT TIME ZONE 'Asia/Kolkata' AS start_ist,
 e.end_ts AT TIME ZONE 'Asia/Kolkata' AS end_ist,
 CASE WHEN e.start_ts IS NULL THEN 'date_only' ELSE 'timestamp' END AS start_precision,
 CASE WHEN e.end_ts IS NULL THEN 'date_only' ELSE 'timestamp' END AS end_precision,
 s.sign AS sign_at_start,
 CASE s.sign WHEN 'Aries' THEN 'Mars' WHEN 'Taurus' THEN 'Venus'
 WHEN 'Gemini' THEN 'Mercury' WHEN 'Cancer' THEN 'Moon' WHEN 'Leo' THEN 'Sun'
 WHEN 'Virgo' THEN 'Mercury' WHEN 'Libra' THEN 'Venus' WHEN 'Scorpio' THEN 'Mars'
 WHEN 'Sagittarius' THEN 'Jupiter' WHEN 'Capricorn' THEN 'Saturn'
 WHEN 'Aquarius' THEN 'Saturn' WHEN 'Pisces' THEN 'Jupiter' END AS sign_lord_at_start,
 CASE WHEN e.event_type IN ('mercury_motion_direct','mercury_turns_direct') THEN 'direct'
 WHEN e.event_type IN ('mercury_motion_retrograde','mercury_turns_retrograde') THEN 'retrograde'
 ELSE mo.motion END AS motion_at_start,
 CASE WHEN e.event_type='mercury_rise' THEN CASE e.provenance->>'conjunction'
 WHEN 'inferior' THEN 'morning' WHEN 'superior' THEN 'evening' END END AS emergence,
 e.provenance->>'detect' AS calculation_method,
 e.provenance->>'combust_source' AS visibility_source,
 CASE WHEN e.provenance->>'combust_source'='almanac_ujjain' THEN 'almanac_override'
 WHEN e.provenance->>'combust_source'='heliacal_ujjain' THEN 'visibility_model'
 ELSE 'stored_generator_record' END AS source_kind,
 e.provenance
FROM events e JOIN public.km_astro_event_definition d USING(event_type)
LEFT JOIN LATERAL (
 SELECT coalesce(r.sign,r.conditions_snapshot->>'sign') AS sign FROM raw r
 WHERE r.event_type='mercury_sign_journey' AND
 CASE WHEN e.start_ts IS NOT NULL AND r.start_ts IS NOT NULL AND r.end_ts IS NOT NULL
 THEN e.start_ts>=r.start_ts AND e.start_ts<r.end_ts
 ELSE e.start_date>=r.start_date AND e.start_date<r.end_date END
 ORDER BY r.start_date DESC,r.id DESC LIMIT 1
) s ON true
LEFT JOIN LATERAL (
 SELECT CASE p.event_type WHEN 'mercury_motion_retrograde' THEN 'retrograde' ELSE 'direct' END AS motion
 FROM events p WHERE p.event_type IN ('mercury_motion_retrograde','mercury_motion_direct')
 AND CASE WHEN e.start_ts IS NOT NULL AND p.start_ts IS NOT NULL AND p.end_ts IS NOT NULL
 THEN e.start_ts>=p.start_ts AND e.start_ts<p.end_ts
 ELSE e.start_date>=p.start_date AND e.start_date<p.end_date END
 ORDER BY p.start_date DESC LIMIT 1
) mo ON true;

COMMENT ON VIEW public.km_mercury_event_calendar IS
 'Canonical Mercury facts, not predictions. Period ends are exclusive timestamps. Date-only boundaries have limited precision. Sign/lord describe period START, not its entire span. No extrapolated direct periods; manifestation is pending.';

-- Grant only to existing project read roles; recovery snapshots stay private.
DO $$ DECLARE role_name text; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','admin','kd_readonly','kd_app'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON public.km_mercury_identity_backup FROM %I',role_name);
   EXECUTE format('REVOKE ALL ON public.km_astro_event_definition, public.km_astro_rule_event_map, public.km_astro_event_reference, public.km_mercury_event_calendar FROM %I',role_name);
   IF role_name <> 'anon' THEN
    EXECUTE format('GRANT SELECT ON public.km_astro_event_definition, public.km_astro_rule_event_map, public.km_astro_event_reference, public.km_mercury_event_calendar TO %I',role_name);
   END IF;
  END IF;
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
