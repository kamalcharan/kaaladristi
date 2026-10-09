-- Read-only verification after migration 235. No generator run is needed.
SELECT r.id,r.rule_code,r.display_name,r.rule_type,r.is_active,r.catalog_visible,
 m.event_type,m.alias_of,r.base_bias
FROM public.km_venus_rule_event_map m JOIN public.km_astro_rule_master r ON r.id=m.rule_id
ORDER BY r.id;

SELECT event_type,display_name,shape,start_date,end_date,bracket_start_date,
 bracket_end_date,precision,source,calculation_method,venus_sign_at_start,
 sign_lord_at_start,venus_retrograde,mercury_retrograde,sample_count,min_separation_deg,
 preceding_sample_available,following_sample_available
FROM public.km_venus_event_calendar
WHERE start_date<=DATE '2026-11-10' AND end_date>=DATE '2026-09-20'
ORDER BY start_date,event_type;

SELECT r.rule_code,t.id,t.start_date,t.end_date,t.start_ts,t.end_ts,t.conditions_snapshot
FROM public.km_rule_transits t JOIN public.km_venus_rule_event_map m ON m.rule_id=t.rule_id
JOIN public.km_astro_rule_master r ON r.id=t.rule_id
WHERE t.start_date<='2026-11-10' AND t.end_date>='2026-09-20'
ORDER BY t.start_date,r.rule_code;

-- The unresolved west-combustion references are NOT generated events.
SELECT d.*,ref.reference_date,ref.source,ref.status AS reference_status
FROM public.km_astro_event_definition d LEFT JOIN public.km_astro_event_reference ref USING(event_type)
WHERE d.event_type IN ('venus_rise','venus_combustion_west') ORDER BY d.event_type,ref.reference_date;

-- Expected zero: no duplicate alias windows or invented exact timestamps.
SELECT count(*) AS alias_or_fabricated_timestamp_rows
FROM public.km_rule_transits t JOIN public.km_venus_rule_event_map m ON m.rule_id=t.rule_id
WHERE m.alias_of IS NOT NULL OR t.start_ts IS NOT NULL OR t.end_ts IS NOT NULL;

-- Must be empty: the specialised rule contains ONLY the requested motions,
-- every calendar day, including weekends and holidays.
SELECT t.id,f.date,f.mercury_retrograde,f.venus_retrograde,f.separation_deg
FROM public.km_rule_transits t JOIN public.km_venus_rule_event_map m ON m.rule_id=t.rule_id
JOIN public.km_venus_daily_facts f ON f.date BETWEEN t.start_date AND t.end_date
WHERE m.event_type='mercury_direct_venus_retrograde_proximity'
AND (f.required_motion IS NOT TRUE OR f.separation_deg>=5);

SELECT source_table,count(*) FROM public.km_venus_identity_backup GROUP BY source_table ORDER BY source_table;

-- Mercury cleanup must still contain its original four mappings, not Venus.
SELECT event_type,count(*) FROM public.km_mercury_event_calendar
WHERE start_date<'2027-01-01' AND end_date>='2026-01-01' GROUP BY event_type ORDER BY event_type;
