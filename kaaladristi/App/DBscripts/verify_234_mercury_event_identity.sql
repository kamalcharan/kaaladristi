-- Read-only review AFTER migration 234. Run all statements and retain results.
SELECT m.rule_id,m.legacy_rule_code,m.event_type,r.display_name,r.rule_type,
       r.base_bias,d.definition_status
FROM public.km_astro_rule_event_map m
JOIN public.km_astro_rule_master r ON r.id=m.rule_id
JOIN public.km_astro_event_definition d USING(event_type)
ORDER BY m.event_type;

-- Definition pending; three unverified owner references, not calendar events.
SELECT d.*,ref.reference_date,ref.status AS reference_status,ref.source
FROM public.km_astro_event_definition d
LEFT JOIN public.km_astro_event_reference ref USING(event_type)
WHERE d.event_type='mercury_manifestation' ORDER BY ref.reference_date;

-- Review all 2026 data including periods crossing the year boundary.
SELECT event_type,display_name,start_date,end_date,start_ist,end_ist,
       start_precision,end_precision,motion_at_start,sign_at_start,
       sign_lord_at_start,emergence,source_kind,visibility_source,source_transit_id
FROM public.km_mercury_event_calendar
WHERE start_date < DATE '2027-01-01' AND end_date >= DATE '2026-01-01'
ORDER BY start_date,start_ist NULLS LAST,event_type;

-- Both July 24 events must retain distinct timestamps. Also checks March/Nov.
SELECT display_name,start_ist,emergence,source_transit_id
FROM public.km_mercury_event_calendar
WHERE shape='point' AND start_date IN ('2026-03-16','2026-07-24','2026-11-11')
ORDER BY start_ist;

-- Every original transit ID/date/price-return must remain unchanged on first
-- application. Run BEFORE any later generator reconcile (which replaces IDs).
SELECT b.row_key AS original_id, 'missing or changed source transit' AS problem
FROM public.km_mercury_identity_backup b
LEFT JOIN public.km_rule_transits t ON t.id=(b.payload->>'id')::bigint
WHERE b.source_table='km_rule_transits' AND (
 t.id IS NULL OR t.rule_id IS DISTINCT FROM (b.payload->>'rule_id')::integer
 OR t.start_date IS DISTINCT FROM (b.payload->>'start_date')::date
 OR t.end_date IS DISTINCT FROM (b.payload->>'end_date')::date
 OR t.start_ts IS DISTINCT FROM (b.payload->>'start_ts')::timestamptz
 OR t.end_ts IS DISTINCT FROM (b.payload->>'end_ts')::timestamptz
 OR t.nifty_return_pct IS DISTINCT FROM (b.payload->>'nifty_return_pct')::numeric
);

-- Expected zero. No dates are silently promoted into manifestation.
SELECT count(*) AS manifestation_event_count
FROM public.km_mercury_event_calendar WHERE event_type='mercury_manifestation';

-- Archived row counts for recovery/research review, not active evidence.
SELECT source_table,count(*) FROM public.km_mercury_identity_backup
GROUP BY source_table ORDER BY source_table;
