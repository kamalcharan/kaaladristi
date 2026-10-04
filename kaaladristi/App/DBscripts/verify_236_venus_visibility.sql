-- Read-only verification after 236. Expected 52 periods and 156 calendar rows.
SELECT count(*) AS periods,min(start_ts) AS first_start,max(end_ts) AS last_end
FROM public.km_venus_visibility_windows;
SELECT event_type,count(*) FROM public.km_venus_visibility_calendar GROUP BY event_type ORDER BY event_type;
SELECT display_name,start_date,end_date,
 start_ts AT TIME ZONE 'Asia/Kolkata' AS start_ist,
 end_ts AT TIME ZONE 'Asia/Kolkata' AS end_ist,
 calculation_method,start_event,end_event
FROM public.km_venus_visibility_calendar
WHERE event_type='venus_tara_asta_period' AND start_date<'2028-01-01' AND end_date>='2025-12-01'
ORDER BY start_date;
-- One agreed method, no alternate production dates.
SELECT DISTINCT parameters FROM public.km_venus_visibility_windows;
-- Both existing daily facts and new visibility events remain available.
SELECT event_type,count(*) FROM public.km_venus_calendar
WHERE start_date<'2027-01-01' AND end_date>='2026-01-01' GROUP BY event_type ORDER BY event_type;
-- Expected 0.
SELECT count(*) AS overlapping_periods FROM public.km_venus_visibility_windows a
JOIN public.km_venus_visibility_windows b ON a.start_ts<b.start_ts AND a.end_ts>=b.start_ts;
