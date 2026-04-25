-- Migration 067: Add partial_day flag to km_rule_signals
-- Marks signals where the astrological element changes during market hours (9:15–15:30 IST).
-- These signals are "noisy" — the market return includes time under a different nakshatra/tithi.
-- Date: 2026-04-25

-- ── 1. Add column ──────────────────────────────────────────────────────────────

ALTER TABLE km_rule_signals
  ADD COLUMN IF NOT EXISTS partial_day boolean;

COMMENT ON COLUMN km_rule_signals.partial_day IS
  'TRUE if the key astrological element (nakshatra/tithi) changes before market close (15:30 IST) '
  'on this signal date, meaning the rule was only active for part of the trading session. '
  'NULL = not yet computed. FALSE = full trading day under this condition.';

-- ── 2. Back-fill existing signals ─────────────────────────────────────────────
-- nakshatra_vara + DLNL (Schema D) rules → use nakshatra_end_ist
-- tithi_alone rules → use tithi_end_ist
-- All other rule types → FALSE (not applicable)

UPDATE km_rule_signals s
SET partial_day = CASE
    WHEN r.rule_type IN ('nakshatra_vara')
         AND p.nakshatra_end_ist IS NOT NULL
         AND p.nakshatra_end_ist < '15:30:00'::time
        THEN TRUE
    WHEN r.rule_type IN ('tithi_alone')
         AND p.tithi_end_ist IS NOT NULL
         AND p.tithi_end_ist < '15:30:00'::time
        THEN TRUE
    ELSE FALSE
END
FROM km_daily_panchang p
JOIN km_astro_rule_master r ON r.id = s.rule_id
WHERE p.date = s.date;

-- ── 3. Verify ──────────────────────────────────────────────────────────────────
SELECT
    r.rule_type,
    COUNT(*)                                         AS total_signals,
    COUNT(*) FILTER (WHERE s.partial_day = TRUE)     AS partial_day_count,
    ROUND(
        COUNT(*) FILTER (WHERE s.partial_day = TRUE)::numeric
        / NULLIF(COUNT(*), 0) * 100, 1
    )                                                AS partial_pct
FROM km_rule_signals s
JOIN km_astro_rule_master r ON r.id = s.rule_id
WHERE r.rule_type IN ('nakshatra_vara', 'tithi_alone')
GROUP BY r.rule_type
ORDER BY r.rule_type;
