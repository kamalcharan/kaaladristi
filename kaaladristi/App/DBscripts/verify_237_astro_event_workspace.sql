-- Read-only deployment checks. Expected: seven families, four shown per planet
-- when all are published (Conjunction is shared), and zero active legacy rules.
SELECT id, planets, name, catalog_visible, is_active
FROM public.km_astro_family_catalog ORDER BY display_order;

SELECT count(*) AS active_legacy_rules FROM public.km_astro_rule_master r
WHERE r.is_active AND NOT EXISTS(SELECT 1 FROM public.km_astro_family f WHERE f.rule_id=r.id);

SELECT family_id,event_type,count(*) AS occurrences
FROM public.km_astro_managed_occurrences
WHERE start_date<='2026-12-31' AND end_date>='2026-01-01'
GROUP BY family_id,event_type ORDER BY family_id,event_type;

SELECT display_name,start_date,end_date,start_ts AT TIME ZONE 'Asia/Kolkata' AS start_ist,
 end_ts AT TIME ZONE 'Asia/Kolkata' AS end_ist,precision,calculation_method,details
FROM public.km_astro_managed_occurrences
WHERE start_date<='2026-10-31' AND end_date>='2026-10-01'
ORDER BY start_date,event_key;

SELECT event_key,count(*) FROM public.km_astro_managed_occurrences
GROUP BY event_key HAVING count(*)>1;

SELECT count(*) AS archived_definitions FROM public.km_astro_workspace_archive;
