-- Venus + Mercury/Venus data cleanup. Requires 234. No UI or market forecasts.
-- Daily ephemeris samples bracket events; they do not supply exact timestamps.
BEGIN;
SET LOCAL lock_timeout='10s';

CREATE TABLE IF NOT EXISTS public.km_venus_identity_backup (
 source_table text NOT NULL,row_key text NOT NULL,payload jsonb NOT NULL,
 archived_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(source_table,row_key)
);
REVOKE ALL ON public.km_venus_identity_backup FROM PUBLIC;

INSERT INTO public.km_astro_event_definition VALUES
 ('venus_motion_direct','Venus Direct','period','Consecutive daily samples showing direct Venus; sample coverage, not exact boundaries.','defined'),
 ('venus_sign_journey','Venus Sign Journey','period','Consecutive daily samples in one recorded zodiac sign. Entry/exit times are not known from these samples.','defined'),
 ('venus_motion_retrograde','Venus Retrograde','period','Consecutive daily samples showing retrograde Venus; sample coverage, not exact boundaries.','defined'),
 ('venus_turns_direct','Venus Turns Direct','point','Transition bracket between consecutive retrograde and direct daily samples. Not visibility rise.','defined'),
 ('venus_turns_retrograde','Venus Turns Retrograde','point','Transition bracket between consecutive direct and retrograde daily samples. Not visibility rise.','defined'),
 ('venus_combustion','Venus Combustion','period','Consecutive stored combust=true samples. Original angular method not verified here; no west/east or visibility claim.','defined'),
 ('venus_rise','Venus Rise','point','Visibility event not established by station changes or stored combustion flags.','pending'),
 ('venus_combustion_west','Venus Combustion in West','period','Directional definition and almanac source require reconciliation; no automatic assignment from combust=true.','pending'),
 ('mercury_venus_proximity','Mercury–Venus Conjunction Window','period','Daily Mercury–Venus circular longitude separation strictly below 5 degrees, without a motion restriction.','defined'),
 ('mercury_direct_venus_retrograde_proximity','Mercury Direct / Venus Retrograde Conjunction Window','period','Separation below 5 degrees AND Mercury direct with positive speed AND Venus retrograde with negative speed.','defined'),
 ('mercury_venus_crossing','Mercury–Venus Crossing','point','Zero signed longitude separation crossed between consecutive samples; exact timestamp unknown.','defined'),
 ('mercury_direct_venus_retrograde_crossing','Mercury Direct / Venus Retrograde Crossing','point','Crossing bracket with Mercury direct and Venus retrograde at BOTH samples.','defined')
ON CONFLICT(event_type) DO NOTHING;

-- Separate mapping avoids widening migration 234's Mercury-only source view.
CREATE TABLE IF NOT EXISTS public.km_venus_rule_event_map (
 rule_id integer PRIMARY KEY REFERENCES public.km_astro_rule_master(id),
 event_type text NOT NULL REFERENCES public.km_astro_event_definition(event_type),
 legacy_rule_code text NOT NULL UNIQUE,
 alias_of text REFERENCES public.km_astro_event_definition(event_type)
);
INSERT INTO public.km_venus_rule_event_map
SELECT r.id,v.event_type,r.rule_code,v.alias_of FROM public.km_astro_rule_master r
JOIN (VALUES
 ('BAY-R03-VEN-RET','venus_motion_retrograde',NULL::text),
 ('TRN-VEN-RIS-W-BUL','venus_turns_direct',NULL),
 ('TRN-VEN-RIS-E-BUL','venus_turns_retrograde',NULL),
 ('TR-VEN-CMB-W-BUL','venus_combustion',NULL),
 ('CON-MER-VEN-BEA','mercury_venus_proximity',NULL),
 ('CON-MER-VEN-CD-BEA','mercury_direct_venus_retrograde_proximity',NULL),
 ('CON-VEN-MER-BEA','mercury_venus_proximity','mercury_venus_proximity')
) v(code,event_type,alias_of) ON r.rule_code=v.code
ON CONFLICT(rule_id) DO NOTHING;

DO $$ BEGIN
 IF (SELECT count(*) FROM public.km_venus_rule_event_map)<>7 THEN
  RAISE EXCEPTION 'Expected seven Venus/conjunction rules; inspect rule master';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.km_planetary_positions WHERE planet='Venus')
 OR NOT EXISTS(SELECT 1 FROM public.km_planetary_positions WHERE planet='Mercury') THEN
  RAISE EXCEPTION 'Venus and Mercury daily positions are required';
 END IF;
END $$;

CREATE OR REPLACE VIEW public.km_venus_daily_facts AS
SELECT v.date,v.longitude AS venus_longitude,v.speed AS venus_speed,
 v.retrograde AS venus_retrograde,v.combust AS venus_combust,v.sign_name AS venus_sign,
 m.longitude AS mercury_longitude,m.speed AS mercury_speed,m.retrograde AS mercury_retrograde,
 s.longitude AS sun_longitude,
 mod((m.longitude-v.longitude+540)::numeric,360)-180 AS signed_separation,
 abs(mod((m.longitude-v.longitude+540)::numeric,360)-180) AS separation_deg,
 (m.retrograde IS FALSE AND m.speed>0 AND v.retrograde IS TRUE AND v.speed<0) AS required_motion
FROM public.km_planetary_positions v
LEFT JOIN public.km_planetary_positions m ON m.date=v.date AND m.planet='Mercury'
LEFT JOIN public.km_planetary_positions s ON s.date=v.date AND s.planet='Sun'
WHERE v.planet='Venus';

CREATE OR REPLACE VIEW public.km_venus_event_calendar AS
WITH samples AS (
 SELECT *,lag(date) OVER w AS previous_date,
 lag(venus_retrograde) OVER w AS previous_retrograde,
 lag(venus_speed) OVER w AS previous_speed,
 lag(signed_separation) OVER w AS previous_separation,
 lag(required_motion) OVER w AS previous_required_motion
 FROM public.km_venus_daily_facts WINDOW w AS (ORDER BY date)
), active AS (
 SELECT s.*,a.event_type FROM samples s CROSS JOIN LATERAL (VALUES
 ('venus_motion_direct',s.venus_retrograde IS FALSE AND s.venus_speed>0),
 ('venus_sign_journey',s.venus_sign IS NOT NULL),
 ('venus_motion_retrograde',s.venus_retrograde IS TRUE AND s.venus_speed<0),
 ('venus_combustion',s.venus_combust IS TRUE),
 ('mercury_venus_proximity',s.separation_deg<5),
 ('mercury_direct_venus_retrograde_proximity',s.separation_deg<5 AND s.required_motion)
 ) a(event_type,is_active) WHERE a.is_active
), islands AS (
 SELECT *,CASE WHEN event_type='venus_sign_journey' THEN venus_sign ELSE '' END AS sign_group,
 date-row_number() OVER(PARTITION BY event_type,CASE WHEN event_type='venus_sign_journey' THEN venus_sign ELSE '' END ORDER BY date)::integer AS island
 FROM active
), periods AS (
 SELECT event_type,min(date) AS start_date,max(date) AS end_date,count(*)::integer AS sample_count,
 min(separation_deg) AS min_separation_deg
 FROM islands GROUP BY event_type,sign_group,island
), points AS (
 SELECT s.*,a.event_type FROM samples s CROSS JOIN LATERAL (VALUES
 ('venus_turns_direct',s.previous_retrograde IS TRUE AND s.venus_retrograde IS FALSE AND s.previous_speed<0 AND s.venus_speed>0),
 ('venus_turns_retrograde',s.previous_retrograde IS FALSE AND s.venus_retrograde IS TRUE AND s.previous_speed>0 AND s.venus_speed<0),
 ('mercury_venus_crossing',s.previous_separation<>0 AND s.previous_separation*s.signed_separation<=0 AND abs(s.signed_separation-s.previous_separation)<180),
 ('mercury_direct_venus_retrograde_crossing',s.previous_separation<>0 AND s.previous_separation*s.signed_separation<=0 AND abs(s.signed_separation-s.previous_separation)<180 AND s.required_motion AND s.previous_required_motion)
 ) a(event_type,is_active) WHERE a.is_active AND s.date=s.previous_date+1
), events AS (
 SELECT event_type,start_date,end_date,NULL::date AS bracket_start_date,NULL::date AS bracket_end_date,
 sample_count,min_separation_deg FROM periods
 UNION ALL
 SELECT event_type,date,date,previous_date,date,2,least(abs(previous_separation),abs(signed_separation)) FROM points
)
SELECT e.event_type||':'||e.start_date::text AS event_key,e.event_type,d.display_name,d.shape,
 e.start_date,e.end_date,e.bracket_start_date,e.bracket_end_date,
 NULL::timestamptz AS start_ts,NULL::timestamptz AS end_ts,
 CASE WHEN d.shape='point' THEN 'daily_sample_bracket' ELSE 'daily_sample_period_inclusive' END AS precision,
 'km_planetary_positions'::text AS source,
 CASE WHEN e.event_type='venus_combustion' THEN 'stored_combust_flag_method_unverified' ELSE 'daily_longitude_and_motion' END AS calculation_method,
 f.venus_sign AS venus_sign_at_start,
 CASE f.venus_sign WHEN 'Aries' THEN 'Mars' WHEN 'Taurus' THEN 'Venus' WHEN 'Gemini' THEN 'Mercury'
 WHEN 'Cancer' THEN 'Moon' WHEN 'Leo' THEN 'Sun' WHEN 'Virgo' THEN 'Mercury' WHEN 'Libra' THEN 'Venus'
 WHEN 'Scorpio' THEN 'Mars' WHEN 'Sagittarius' THEN 'Jupiter' WHEN 'Capricorn' THEN 'Saturn'
 WHEN 'Aquarius' THEN 'Saturn' WHEN 'Pisces' THEN 'Jupiter' END AS sign_lord_at_start,
 f.venus_retrograde,f.mercury_retrograde,e.sample_count,e.min_separation_deg,
 EXISTS(SELECT 1 FROM public.km_venus_daily_facts p WHERE p.date=e.start_date-1) AS preceding_sample_available,
 EXISTS(SELECT 1 FROM public.km_venus_daily_facts p WHERE p.date=e.end_date+1) AS following_sample_available
FROM events e JOIN public.km_astro_event_definition d USING(event_type)
JOIN public.km_venus_daily_facts f ON f.date=e.start_date;

INSERT INTO public.km_astro_event_reference VALUES
 ('venus_combustion_west','2026-10-15','owner_reference_window_start','unverified'),
 ('venus_combustion_west','2026-10-27','owner_reference_window_end','unverified')
ON CONFLICT DO NOTHING;

-- Original identities, astronomical rows and research remain recoverable.
DO $$ DECLARE affected integer[]; tab text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.km_venus_identity_backup WHERE source_table='_migration' AND row_key='235') THEN
  SELECT array_agg(rule_id) INTO affected FROM public.km_venus_rule_event_map;
  INSERT INTO public.km_venus_identity_backup(source_table,row_key,payload)
  SELECT 'km_astro_rule_master',id::text,to_jsonb(r) FROM public.km_astro_rule_master r WHERE id=ANY(affected);
  INSERT INTO public.km_venus_identity_backup(source_table,row_key,payload)
  SELECT 'km_rule_transits',id::text,to_jsonb(t) FROM public.km_rule_transits t WHERE rule_id=ANY(affected);
  IF to_regclass('public.km_rule_inference') IS NOT NULL THEN
   INSERT INTO public.km_venus_identity_backup(source_table,row_key,payload)
   SELECT 'km_rule_inference',id::text,to_jsonb(i) FROM public.km_rule_inference i WHERE rule_a_id=ANY(affected) OR rule_b_id=ANY(affected);
   UPDATE public.km_rule_inference SET status='superseded',superseded_at=now()
   WHERE status='active' AND (rule_a_id=ANY(affected) OR rule_b_id=ANY(affected));
  END IF;
  FOREACH tab IN ARRAY ARRAY['km_rule_evidence','km_rule_confidence','km_rule_confidence_bench','km_rule_confidence_yearly','km_rule_signals','km_rule_patterns'] LOOP
   IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=tab AND column_name='rule_id') THEN
    EXECUTE format('INSERT INTO public.km_venus_identity_backup(source_table,row_key,payload) SELECT %L,md5(to_jsonb(x)::text),to_jsonb(x) FROM public.%I x WHERE rule_id=ANY($1) ON CONFLICT DO NOTHING',tab,tab) USING affected;
    EXECUTE format('DELETE FROM public.%I WHERE rule_id=ANY($1)',tab) USING affected;
   END IF;
  END LOOP;
  IF to_regclass('public.km_vani_cache') IS NOT NULL THEN
   INSERT INTO public.km_venus_identity_backup(source_table,row_key,payload)
   SELECT 'km_vani_cache',md5(to_jsonb(c)::text),to_jsonb(c) FROM public.km_vani_cache c WHERE intent_id='index.astro_now';
   DELETE FROM public.km_vani_cache WHERE intent_id='index.astro_now';
  END IF;
  INSERT INTO public.km_venus_identity_backup VALUES('_migration','235','{"version":1}',now());
 END IF;
END $$;

UPDATE public.km_astro_rule_master r SET display_name=d.display_name,
 rule_type=CASE WHEN m.event_type LIKE 'mercury%proximity' THEN 'planet_conjunction' ELSE 'planet_state' END,
 planet_1=CASE WHEN m.event_type LIKE 'mercury%' THEN 'Mercury' ELSE 'Venus' END,
 planet_2=CASE WHEN m.event_type LIKE 'mercury%' THEN 'Venus' ELSE NULL END,
 planet_state=NULL,base_bias='neutral',outcome='neutral',probability_label=NULL,
 conditions=jsonb_build_object('event_type',m.event_type,'identity_version',1,'generator','refresh_venus_event_windows','alias_of',m.alias_of),
 remarks=d.definition,
 tags=array_remove(coalesce(r.tags,ARRAY[]::text[]),'Manifestation'),
 is_active=CASE WHEN m.alias_of IS NOT NULL THEN false ELSE r.is_active END,
 catalog_visible=CASE WHEN m.alias_of IS NOT NULL THEN false ELSE r.catalog_visible END,
 updated_at=now()
FROM public.km_venus_rule_event_map m JOIN public.km_astro_event_definition d USING(event_type)
WHERE r.id=m.rule_id AND r.conditions->>'generator' IS DISTINCT FROM 'refresh_venus_event_windows';

-- Reconcile legacy transit readers to canonical sample windows without changing
-- unrelated rules. UPSERT preserves IDs when the start date is unchanged.
CREATE OR REPLACE FUNCTION public.refresh_venus_event_windows() RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE affected integer[]; changed integer; n integer; tab text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('refresh_venus_event_windows'));
 SELECT array_agg(rule_id) INTO affected FROM public.km_venus_rule_event_map;
 IF coalesce(cardinality(affected),0)<>7 OR EXISTS (
  SELECT 1 FROM public.km_venus_rule_event_map m JOIN public.km_astro_rule_master r ON r.id=m.rule_id
  WHERE r.conditions->>'event_type' IS DISTINCT FROM m.event_type
 ) THEN RAISE EXCEPTION 'Apply/verify Venus identity migration 235 first'; END IF;
 -- Never replace history outside the available ephemeris coverage.
 IF EXISTS(SELECT 1 FROM public.km_rule_transits t WHERE t.rule_id=ANY(affected)
 AND (t.start_date<(SELECT min(date) FROM public.km_venus_daily_facts WHERE mercury_longitude IS NOT NULL)
 OR t.end_date>(SELECT max(date) FROM public.km_venus_daily_facts WHERE mercury_longitude IS NOT NULL))) THEN
  RAISE EXCEPTION 'Ephemeris coverage is shorter than existing Venus history; restore coverage before cleanup';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.km_venus_daily_facts WHERE mercury_longitude IS NOT NULL) THEN
  RAISE EXCEPTION 'No paired Mercury/Venus samples; refusing cleanup'; END IF;
 IF EXISTS(SELECT 1 FROM public.km_venus_daily_facts WHERE mercury_longitude IS NULL
 OR mercury_speed IS NULL OR venus_speed IS NULL OR mercury_retrograde IS NULL
 OR venus_retrograde IS NULL OR venus_combust IS NULL)
 OR (SELECT count(*)<>max(date)-min(date)+1 FROM public.km_venus_daily_facts) THEN
  RAISE EXCEPTION 'Incomplete paired daily ephemeris; refusing to overwrite existing history';
 END IF;
 CREATE TEMP TABLE IF NOT EXISTS venus_identity_desired (
  rule_id integer,start_date date,end_date date,snapshot jsonb,PRIMARY KEY(rule_id,start_date)
 ) ON COMMIT DROP;
 TRUNCATE pg_temp.venus_identity_desired;
 INSERT INTO pg_temp.venus_identity_desired
 SELECT m.rule_id,c.start_date,c.end_date,jsonb_build_object(
  'event_type',c.event_type,'identity_version',1,'source',c.source,'precision',c.precision,
  'calculation_method',c.calculation_method,'bracket_start_date',c.bracket_start_date,
  'bracket_end_date',c.bracket_end_date,'sample_count',c.sample_count,
  'min_separation_deg',c.min_separation_deg,'venus_retrograde',c.venus_retrograde,
  'mercury_retrograde',c.mercury_retrograde,
  'preceding_sample_available',c.preceding_sample_available,'following_sample_available',c.following_sample_available)
 FROM public.km_venus_event_calendar c JOIN public.km_venus_rule_event_map m USING(event_type)
 WHERE m.alias_of IS NULL;
 -- Capture each old version before replacement/removal, including later refreshes.
 INSERT INTO public.km_venus_identity_backup(source_table,row_key,payload)
 SELECT 'transit_before_refresh',md5(to_jsonb(t)::text),to_jsonb(t) FROM public.km_rule_transits t
 LEFT JOIN pg_temp.venus_identity_desired d ON d.rule_id=t.rule_id AND d.start_date=t.start_date
 WHERE t.rule_id=ANY(affected) AND (d.rule_id IS NULL OR t.end_date IS DISTINCT FROM d.end_date OR t.conditions_snapshot IS DISTINCT FROM d.snapshot)
 ON CONFLICT DO NOTHING;
 DELETE FROM public.km_rule_transits t WHERE t.rule_id=ANY(affected)
 AND NOT EXISTS(SELECT 1 FROM pg_temp.venus_identity_desired d WHERE d.rule_id=t.rule_id AND d.start_date=t.start_date);
 GET DIAGNOSTICS changed=ROW_COUNT;
 INSERT INTO public.km_rule_transits(rule_id,start_date,end_date,conditions_snapshot)
 SELECT rule_id,start_date,end_date,snapshot FROM pg_temp.venus_identity_desired
 ON CONFLICT(rule_id,start_date) DO UPDATE SET end_date=EXCLUDED.end_date,conditions_snapshot=EXCLUDED.conditions_snapshot,
 start_ts=NULL,end_ts=NULL,direction=NULL,sign=NULL,motion=NULL,combustion_type=NULL,sun_sep_min=NULL,
 matched=NULL,nifty_start_close=NULL,nifty_end_close=NULL,nifty_return_pct=NULL
 WHERE km_rule_transits.end_date IS DISTINCT FROM EXCLUDED.end_date
 OR km_rule_transits.conditions_snapshot IS DISTINCT FROM EXCLUDED.conditions_snapshot;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF changed+n>0 THEN
  FOREACH tab IN ARRAY ARRAY['km_rule_evidence','km_rule_confidence','km_rule_confidence_bench','km_rule_confidence_yearly','km_rule_signals','km_rule_patterns'] LOOP
   IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=tab AND column_name='rule_id') THEN
    EXECUTE format('INSERT INTO public.km_venus_identity_backup(source_table,row_key,payload) SELECT %L,md5(to_jsonb(x)::text),to_jsonb(x) FROM public.%I x WHERE rule_id=ANY($1) ON CONFLICT DO NOTHING',tab,tab) USING affected;
    EXECUTE format('DELETE FROM public.%I WHERE rule_id=ANY($1)',tab) USING affected;
   END IF;
  END LOOP;
  IF to_regclass('public.km_vani_cache') IS NOT NULL THEN
   INSERT INTO public.km_venus_identity_backup(source_table,row_key,payload)
   SELECT 'km_vani_cache',md5(to_jsonb(c)::text),to_jsonb(c) FROM public.km_vani_cache c
   WHERE intent_id='index.astro_now' ON CONFLICT DO NOTHING;
   DELETE FROM public.km_vani_cache WHERE intent_id='index.astro_now';
  END IF;
 END IF;
 RETURN changed+n;
END $$;
REVOKE ALL ON FUNCTION public.refresh_venus_event_windows() FROM PUBLIC;
SELECT public.refresh_venus_event_windows();

DO $$ DECLARE role_name text; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','admin','kd_readonly','kd_app'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON public.km_venus_identity_backup, public.km_venus_rule_event_map, public.km_venus_daily_facts, public.km_venus_event_calendar FROM %I',role_name);
   EXECUTE format('REVOKE ALL ON FUNCTION public.refresh_venus_event_windows() FROM %I',role_name);
   IF role_name<>'anon' THEN
    EXECUTE format('GRANT SELECT ON public.km_venus_rule_event_map, public.km_venus_daily_facts, public.km_venus_event_calendar TO %I',role_name);
   END IF;
   IF role_name IN ('kd_app','admin') THEN
    EXECUTE format('GRANT SELECT,INSERT ON public.km_venus_identity_backup TO %I',role_name);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.refresh_venus_event_windows() TO %I',role_name);
   END IF;
  END IF;
 END LOOP;
END $$;
COMMENT ON VIEW public.km_venus_event_calendar IS 'Daily sample facts, all calendar days. Point dates are bracket-end labels, NOT exact event times. No inferred rise/west visibility events or market forecasts.';
NOTIFY pgrst,'reload schema';
COMMIT;
