-- Migration 201: opt the five Level 2 price-action presets into the VaNi
-- Discovery board (kd_scan_presets.vani_side / vani_short_label)
--
-- Target DB: kaala_dristi_db
--
-- WHY: weekly_movers, monthly_movers, weekly_decliners, monthly_decliners and
-- breakdown_watch all carry a vani_rule and compute a real vani_flag, but none
-- carries a vani_side. fetchVaniHighlights (scanEngine.ts) selects its sources
-- with `p.vani_side != null`, so these five have never reached the Discovery
-- board on /workspace no matter how strong their signal. vani_side IS the
-- opt-in switch — migration 177's design deliberately made joining Discovery a
-- DB update rather than a code deploy.
--
-- The strength/caution split below is the same one config/scannerStudio.ts
-- already encodes for these presets, so the board and the Studio agree.
--
-- ── vani_cap: deliberately left NULL, and here is the evidence ──────────────
--
-- The open question recorded in docs/claude/vani-scanner-handover.md §11 was
-- whether these need a cap, on the reasoning that they are 500-row scans while
-- gl_breakout caps at 12 and uncapped they would "swamp the board".
--
-- Measured on 2026-09-04, that reasoning was aimed at the wrong number. The
-- board never sees a preset's row count: fetchVaniHighlights filters to
-- vaniOpportunity FIRST, and vani_cap slices what is left. The flagged counts
-- are small, and in line with presets already on the board uncapped:
--
--     weekly_movers      14        breakout_surge (on board, uncapped)  14
--     monthly_movers     14        power_sell     (on board, uncapped)  25
--     monthly_decliners  10        power_buy      (on board, uncapped)   5
--     weekly_decliners    9
--     breakdown_watch     5
--
-- The board then DEDUPLICATES by equity_id into a Map, merging each preset's
-- short label into one row's `scans[]` array. That matters here because three
-- of these run the same rule as breakout_surge (is_vani_surge_or_breakout):
--
--     strength trio (breakout_surge + the two movers): 42 slots -> 14 stocks
--     caution trio  (the three weakness presets):      24 slots -> 11 stocks
--
-- So the two movers add ZERO new names to the strength bucket — they add a
-- second and third chip to rows already there, which is information ("this
-- name is showing on the breakout AND the weekly view"), not noise. The three
-- caution presets add 11 distinct names to a bucket that already carries 25
-- from power_sell.
--
-- A cap is therefore not the lever this needed, and setting one would silently
-- drop real names. Leave NULL, like every other non-Waking-Giants preset. If
-- the board ever does feel crowded, the honest fix is a cap chosen from a
-- measurement of the board, not from a scan's row count.
--
-- Reversal: set vani_side = NULL on any row below and it leaves the board.

UPDATE kd_scan_presets SET vani_side = 'strength', vani_short_label = 'Weekly'
 WHERE id = 'weekly_movers';

UPDATE kd_scan_presets SET vani_side = 'strength', vani_short_label = 'Monthly'
 WHERE id = 'monthly_movers';

UPDATE kd_scan_presets SET vani_side = 'caution',  vani_short_label = 'Wk Decline'
 WHERE id = 'weekly_decliners';

UPDATE kd_scan_presets SET vani_side = 'caution',  vani_short_label = 'Mth Decline'
 WHERE id = 'monthly_decliners';

UPDATE kd_scan_presets SET vani_side = 'caution',  vani_short_label = 'Breakdown'
 WHERE id = 'breakdown_watch';

-- Verification — expect five rows, sides as above, vani_cap NULL on each.
SELECT id, name, vani_side, vani_short_label, vani_cap
  FROM kd_scan_presets
 WHERE id IN ('weekly_movers','monthly_movers','weekly_decliners',
              'monthly_decliners','breakdown_watch')
 ORDER BY vani_side, id;
