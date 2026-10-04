-- Apply after 234–236. Seven managed families; rule master owns publication.
BEGIN;
SET LOCAL lock_timeout='10s';
CREATE TABLE IF NOT EXISTS public.km_astro_workspace_archive (
 rule_id integer PRIMARY KEY, payload jsonb NOT NULL, archived_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.km_astro_family (
 id text PRIMARY KEY, rule_id integer UNIQUE NOT NULL REFERENCES public.km_astro_rule_master(id),
 planets text[] NOT NULL, name text NOT NULL, description text NOT NULL,
 event_types text[] NOT NULL, display_order integer NOT NULL);
INSERT INTO public.km_astro_rule_master(rule_code,rule_type,display_name,base_bias,outcome,data_source,conditions,is_active,catalog_visible,tags)
SELECT code,'planet_state',title,'neutral','neutral','user_defined',jsonb_build_object('managed_event_family',true),true,true,planets
FROM (VALUES
 ('EVT-MER-MOTION','Mercury Motion',ARRAY['Mercury']),
 ('EVT-MER-SIGN','Mercury Sign Change',ARRAY['Mercury']),
 ('EVT-MER-VISIBILITY','Mercury Visibility',ARRAY['Mercury']),
 ('EVT-VEN-MOTION','Venus Motion',ARRAY['Venus']),
 ('EVT-VEN-SIGN','Venus Sign Change',ARRAY['Venus']),
 ('EVT-VEN-VISIBILITY','Venus Visibility',ARRAY['Venus']),
 ('EVT-MER-VEN-CONJUNCTION','Mercury–Venus Conjunction',ARRAY['Mercury','Venus'])
) v(code,title,planets) ON CONFLICT(rule_code) DO NOTHING;
INSERT INTO public.km_astro_family
SELECT f.id,r.id,f.planets,f.name,f.description,f.types,f.ord
FROM (VALUES
 ('mercury-motion','EVT-MER-MOTION',ARRAY['Mercury'],'Motion','Direct and retrograde periods, with turning dates.',ARRAY['mercury_motion_direct','mercury_motion_retrograde','mercury_turns_direct','mercury_turns_retrograde'],1),
 ('mercury-sign','EVT-MER-SIGN',ARRAY['Mercury'],'Sign Change','Sign entries and the lord of each sign.',ARRAY['mercury_sign_journey'],2),
 ('mercury-visibility','EVT-MER-VISIBILITY',ARRAY['Mercury'],'Visibility','Disappearance and reappearance, with source provenance.',ARRAY['mercury_combustion','mercury_rise','mercury_visibility_disappears'],3),
 ('venus-motion','EVT-VEN-MOTION',ARRAY['Venus'],'Motion','Direct and retrograde daily samples, with station brackets.',ARRAY['venus_motion_direct','venus_motion_retrograde','venus_turns_direct','venus_turns_retrograde'],4),
 ('venus-sign','EVT-VEN-SIGN',ARRAY['Venus'],'Sign Change','Sign entries and the lord of each sign.',ARRAY['venus_sign_journey'],5),
 ('venus-visibility','EVT-VEN-VISIBILITY',ARRAY['Venus'],'Visibility','Tara Asta and Tara Udaya, calculated for Ujjain.',ARRAY['venus_tara_asta','venus_tara_udaya','venus_tara_asta_period'],6),
 ('mercury-venus-conjunction','EVT-MER-VEN-CONJUNCTION',ARRAY['Mercury','Venus'],'Conjunction','Mercury–Venus proximity and crossing. Motion is an occurrence detail.',ARRAY['mercury_venus_proximity','mercury_venus_crossing'],7)
) f(id,code,planets,name,description,types,ord)
JOIN public.km_astro_rule_master r ON r.rule_code=f.code ON CONFLICT(id) DO NOTHING;
-- Archive once; retain all source transits/evidence for recovery and provenance.
INSERT INTO public.km_astro_workspace_archive(rule_id,payload)
SELECT r.id,to_jsonb(r) FROM public.km_astro_rule_master r
WHERE NOT EXISTS(SELECT 1 FROM public.km_astro_family f WHERE f.rule_id=r.id)
ON CONFLICT DO NOTHING;
UPDATE public.km_astro_rule_master SET is_active=false,catalog_visible=false
WHERE id IN (SELECT rule_id FROM public.km_astro_workspace_archive);
CREATE OR REPLACE VIEW public.km_astro_family_catalog AS
SELECT f.*,r.catalog_visible,r.is_active FROM public.km_astro_family f
JOIN public.km_astro_rule_master r ON r.id=f.rule_id WHERE r.is_deleted IS NOT TRUE;
CREATE OR REPLACE VIEW public.km_astro_managed_occurrences AS
WITH facts AS (
 SELECT 'mercury:'||event_key AS event_key,event_type,display_name,shape,start_date,end_date,start_ts,end_ts,
 start_precision AS precision,source_kind AS source,calculation_method,
 NULL::date AS bracket_start_date,NULL::date AS bracket_end_date,
 jsonb_build_object('sign',sign_at_start,'sign_lord',sign_lord_at_start,'motion_at_start',motion_at_start,'provenance',provenance) AS details
 FROM public.km_mercury_event_calendar
 UNION ALL
 SELECT 'mercury:'||event_key||':asta','mercury_visibility_disappears','Mercury Disappearance','point',
 start_date,start_date,start_ts,start_ts,start_precision,source_kind,calculation_method,NULL::date,NULL::date,
 jsonb_build_object('provenance',provenance)
 FROM public.km_mercury_event_calendar WHERE event_type='mercury_combustion' AND provenance->>'detect'='visibility_v3'
 UNION ALL
 SELECT 'venus:'||c.event_key,c.event_type,c.display_name,c.shape,c.start_date,c.end_date,c.start_ts,c.end_ts,
 c.precision,c.source,c.calculation_method,d.bracket_start_date,d.bracket_end_date,
 jsonb_build_object('sign',d.venus_sign_at_start,'sign_lord',d.sign_lord_at_start,
 'venus_retrograde_at_start',d.venus_retrograde,'mercury_retrograde_at_start',d.mercury_retrograde,
 'parameters',v.parameters,'contra_directional',EXISTS(SELECT 1 FROM public.km_venus_event_calendar x
 WHERE x.event_type='mercury_direct_venus_retrograde_crossing' AND x.start_date=c.start_date AND c.event_type='mercury_venus_crossing'))
 FROM public.km_venus_calendar c
 LEFT JOIN public.km_venus_event_calendar d ON d.event_key=c.event_key
 LEFT JOIN public.km_venus_visibility_calendar v ON v.event_key=c.event_key
)
SELECT f.id AS family_id,f.rule_id,f.planets,f.name AS family_name,e.*
FROM facts e JOIN public.km_astro_family f ON e.event_type=ANY(f.event_types);
REVOKE ALL ON public.km_astro_workspace_archive,public.km_astro_family FROM PUBLIC;
DO $$ DECLARE role_name text; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','kd_readonly','kd_app','kd_admin'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON public.km_astro_workspace_archive,public.km_astro_family FROM %I',role_name);
   IF role_name<>'anon' THEN
    EXECUTE format('GRANT SELECT ON public.km_astro_family,public.km_astro_family_catalog,public.km_astro_managed_occurrences TO %I',role_name);
   END IF;
  END IF;
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
