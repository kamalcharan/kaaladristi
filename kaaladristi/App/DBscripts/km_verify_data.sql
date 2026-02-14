-- ============================================================================
-- KALA-DRISHTI DATA VERIFICATION QUERIES
-- Run each section in Supabase SQL Editor to verify uploaded data
-- ============================================================================

-- ============================================================================
-- 1. ROW COUNTS (expected values in comments)
-- ============================================================================

SELECT 'km_planetary_positions' AS table_name, COUNT(*) AS row_count FROM km_planetary_positions  -- expect 134,775
UNION ALL
SELECT 'km_planetary_aspects', COUNT(*) FROM km_planetary_aspects                                  -- expect 31,938
UNION ALL
SELECT 'km_astro_events', COUNT(*) FROM km_astro_events                                            -- expect 28,121
UNION ALL
SELECT 'km_moon_intraday', COUNT(*) FROM km_moon_intraday                                          -- expect 59,900
UNION ALL
SELECT 'km_daily_panchang', COUNT(*) FROM km_daily_panchang                                        -- expect 14,975
ORDER BY table_name;

-- ============================================================================
-- 2. DATE RANGE CONTINUITY (should be 1990-01-01 to 2030-12-31)
-- ============================================================================

SELECT 'positions' AS src, MIN(date) AS first_date, MAX(date) AS last_date,
       COUNT(DISTINCT date) AS unique_dates
FROM km_planetary_positions
UNION ALL
SELECT 'panchang', MIN(date), MAX(date), COUNT(DISTINCT date)
FROM km_daily_panchang;

-- ============================================================================
-- 3. RETROGRADE VERIFICATION (% of days each planet is retrograde)
-- ============================================================================

SELECT planet,
       COUNT(*) FILTER (WHERE retrograde = TRUE) AS retro_days,
       COUNT(*) AS total_days,
       ROUND(100.0 * COUNT(*) FILTER (WHERE retrograde = TRUE) / COUNT(*), 1) AS retro_pct
FROM km_planetary_positions
GROUP BY planet
ORDER BY planet;
-- Expected: Mars ~9.5%, Mercury ~19.3%, Jupiter ~30.2%, Saturn ~36.6%, Rahu 100%

-- ============================================================================
-- 4. PANCHANG VERIFICATION
-- ============================================================================

-- DLNL match rate (expect ~11%)
SELECT COUNT(*) FILTER (WHERE dlnl_match = TRUE) AS dlnl_days,
       COUNT(*) AS total_days,
       ROUND(100.0 * COUNT(*) FILTER (WHERE dlnl_match = TRUE) / COUNT(*), 1) AS dlnl_pct
FROM km_daily_panchang;

-- Sankranti count (expect ~492 for 41 years = 12/year)
SELECT COUNT(*) AS sankranti_count
FROM km_daily_panchang
WHERE is_sankranti = TRUE;

-- Tithi range (should be 1-30)
SELECT MIN(tithi_num) AS min_tithi, MAX(tithi_num) AS max_tithi
FROM km_daily_panchang;

-- Paksha split (expect ~50/50)
SELECT paksha, COUNT(*) AS days,
       ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 1) AS pct
FROM km_daily_panchang
GROUP BY paksha;

-- Purnima / Amavasya / Ekadashi counts
SELECT 'Purnima' AS event, COUNT(*) AS days FROM km_daily_panchang WHERE is_purnima = TRUE
UNION ALL
SELECT 'Amavasya', COUNT(*) FROM km_daily_panchang WHERE is_amavasya = TRUE
UNION ALL
SELECT 'Ekadashi', COUNT(*) FROM km_daily_panchang WHERE is_ekadashi = TRUE;

-- ============================================================================
-- 5. ASPECT DISTRIBUTION
-- ============================================================================

SELECT aspect_type, COUNT(*) AS count
FROM km_planetary_aspects
GROUP BY aspect_type
ORDER BY count DESC;
-- Expected: conjunction ~9831, trine ~9187, square ~7915, opposition ~5005

-- ============================================================================
-- 6. EVENT BREAKDOWN
-- ============================================================================

SELECT event_type, COUNT(*) AS count
FROM km_astro_events
GROUP BY event_type
ORDER BY count DESC;
-- Expected: nakshatra_change ~18988, sign_change ~8631, retrograde_start ~250, retrograde_end ~252

-- ============================================================================
-- 7. CROSS-VALIDATION: Panchang Moon nakshatra vs Ephemeris Moon nakshatra
-- (should match for same dates since both computed from same source)
-- ============================================================================

SELECT COUNT(*) AS total_dates,
       COUNT(*) FILTER (WHERE p.nakshatra_name = e.nakshatra_name) AS matching,
       COUNT(*) FILTER (WHERE p.nakshatra_name != e.nakshatra_name) AS mismatches
FROM km_daily_panchang p
JOIN km_planetary_positions e ON e.date = p.date AND e.planet = 'Moon';
-- Minor mismatches expected: panchang evaluates at Ujjain sunrise, ephemeris at 5:30 UTC (11:00 IST)

-- ============================================================================
-- 8. SAMPLE SPOT CHECK: Mars retrograde Jan 2025
-- ============================================================================

SELECT date, speed, retrograde
FROM km_planetary_positions
WHERE planet = 'Mars' AND date BETWEEN '2025-01-01' AND '2025-01-05'
ORDER BY date;
-- Expect retrograde = TRUE, negative speed
