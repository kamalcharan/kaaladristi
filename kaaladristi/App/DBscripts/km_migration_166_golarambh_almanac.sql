-- ============================================================================
-- Migration 166 — Golārambha Almanac: gola halves + turn-window rules,
--                 unified 'Gola' tag
-- Target database: kaala_dristi_db
--
-- Context (owner, 2026-07-25): elevate the hemisphere/gola concept to a full
-- almanac + overlay family like Mercury (127) and Bayer. Two legacy single-day
-- rules already exist (HEM-BST-TRN / HEM-DAK-TRN, 'Basant/Dakshin Golarambh
-- Watch Week', discovered from km_daily_panchang.hemisphere_event) — they stay
-- as-is and just join the family tag.
--
-- New rules (windows are GENERATOR-FED from Swiss Ephemeris, like the Mercury
-- combust/journey windows — rule_discovery.py's discover_planet_state returns
-- [] for them because conditions carry no 'planet'+'condition' keys, so
-- discovery and the generator never fight over km_rule_transits):
--
--   TR-SUN-UGOLA-BUL    Uttara Gola — Sun in the northern celestial
--                       hemisphere, March equinox → September equinox.
--                       NIFTY 2008-2025: 15/18 halves positive, mean +12.8%
--                       (+9.0% ex-2009); worst half −8.9%.
--   TR-SUN-DGOLA-BEA    Dakshina Gola — September equinox → March equinox.
--                       NIFTY 2007-2025: 10/19 positive, mean −1.2%; hosts
--                       every era crash (2008 −33.5%, 2019-20 −24.6%).
--   TRN-SUN-UGOLARM-TRN Basanta Golārambha turn window (equinox ±1 day).
--                       Range-breakout read: up-breaks continued 8/12 at 63
--                       sessions; down-breaks FAILED 6/9 (capitulation marker
--                       — Mar 2020/Mar 2026 V-bottoms sat in this window).
--   TRN-SUN-DGOLARM-TRN Dakshina Golārambha turn window (equinox ±1 day).
--                       The weak seam of the year: next-10-session mean
--                       −0.74% (4/10 positive); Sep 2024 ATH formed here.
--
-- rule_type 'planet_state' throughout: a hemisphere IS a state of the Sun,
-- and planet_state is in RANGE_RULE_TYPES so all four route to chart zone
-- overlays (astro_group:Gola expands them via fetchAstroBands).
--
-- After running this migration:
--   cd App/backend/scripts
--   DB_PRIMARY=... python3 generate_golarambh_windows.py   # windows 1990-2030
--   DB_PRIMARY=... python3 compute_rule_evidence.py        # evidence rows
-- ============================================================================

-- ── Step 1: Insert the four Golārambha rules ────────────────────────────────

INSERT INTO km_astro_rule_master
  (rule_code, rule_type, display_name, planet_1, planet_2,
   base_bias, probability_label, tags, conditions,
   is_active, catalog_visible, is_deleted, remarks)
VALUES
(
  'TR-SUN-UGOLA-BUL',
  'planet_state',
  'Uttara Gola — Sun in Northern Hemisphere',
  'Sun', null,
  'bullish', 'High',
  ARRAY['Gola', 'Sun', 'Seasonal'],
  '{"gola": "uttara", "window_source": "generate_golarambh_windows.py"}'::jsonb,
  true, true, false,
  'Sun north of the celestial equator: March equinox (Basanta Golārambha) to September equinox. Tropical/astronomical event — deliberately independent of ayanamsha; the sidereal Mesha Sankranti lands ~25 days later and is a different claim. NIFTY 50 backtest 2008-2025: 15 of 18 halves positive, mean +12.8% (+9.0% excluding the 2009 outlier), worst half −8.9%. Essentially all of NIFTY''s net gain since 2007 accrued inside Uttara Gola halves.'
),
(
  'TR-SUN-DGOLA-BEA',
  'planet_state',
  'Dakshina Gola — Sun in Southern Hemisphere',
  'Sun', null,
  'bearish', 'Reasonable',
  ARRAY['Gola', 'Sun', 'Seasonal'],
  '{"gola": "dakshina", "window_source": "generate_golarambh_windows.py"}'::jsonb,
  true, true, false,
  'Sun south of the celestial equator: September equinox (Dakshina Golārambha) to March equinox. NIFTY 50 backtest 2007-2025: 10 of 19 halves positive, mean −1.2%, median +0.4% — and every catastrophic drawdown of the era fell here (2008 −33.5%, 2019-20 COVID −24.6%, 2010-11 −10.5%, 2024-25 −10.6%, 2025-26 −8.3%). 4 of the last 5 halves negative. Tail-risk regime, not a short signal.'
),
(
  'TRN-SUN-UGOLARM-TRN',
  'planet_state',
  'Basanta Golārambha — Turn Window (±1 day)',
  'Sun', null,
  'turning', 'Reasonable',
  ARRAY['Gola', 'Sun', 'Seasonal'],
  '{"gola": "uttara", "event": "golarambha_window", "window_source": "generate_golarambh_windows.py"}'::jsonb,
  true, true, false,
  'March equinox ±1 day — the northern-hemisphere entry seam. Range-breakout study (NIFTY, 20-session range, 2008-2026): a window close ABOVE the prior range continued higher 8/12 times at 63 sessions (avg +5.1%; persistent 2-3 day breaks 3/4); a close BELOW the range FAILED to follow through 6/9 times — the failed breakdowns include the Mar-2020 COVID V-bottom and the Mar-2026 correction low, both inside this window. Historically an exhaustion/turn marker when price falls into it.'
),
(
  'TRN-SUN-DGOLARM-TRN',
  'planet_state',
  'Dakshina Golārambha — Turn Window (±1 day)',
  'Sun', null,
  'turning', 'Reasonable',
  ARRAY['Gola', 'Sun', 'Seasonal'],
  '{"gola": "dakshina", "event": "golarambha_window", "window_source": "generate_golarambh_windows.py"}'::jsonb,
  true, true, false,
  'September equinox ±1 day — the southern-hemisphere entry seam and the weakest of the four seasonal event windows: next-10-session mean −0.74% (4/10 positive) vs +1.6-1.7% for the other three. Strength INTO this window has repeatedly marked exhaustion tops — the Sep-2024 all-time high printed a persistent 3-day upside breakout here and fell −8.4% over the next quarter. Treat any breakout this window prints with maximum skepticism.'
)
ON CONFLICT (rule_code) DO NOTHING;

-- ── Step 2: Unified 'Gola' tag on the legacy hemisphere watch rules ─────────
-- Idempotent (same pattern as migrations 101/127/128). These stay compound/
-- single-day discovery rules — fetchAstroBands' RANGE_RULE_TYPES filter keeps
-- them out of the zone overlay, so the tag only groups them in /rules.

UPDATE km_astro_rule_master
SET tags = array_append(tags, 'Gola')
WHERE rule_code IN ('HEM-BST-TRN', 'HEM-DAK-TRN')
AND NOT ('Gola' = ANY(tags));

-- ── Verification ─────────────────────────────────────────────────────────────
-- SELECT rule_code, display_name, rule_type, tags, catalog_visible
-- FROM km_astro_rule_master WHERE 'Gola' = ANY(tags) ORDER BY rule_code;
