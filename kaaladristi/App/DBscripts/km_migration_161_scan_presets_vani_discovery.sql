-- km_migration_161_scan_presets_vani_discovery.sql
-- Target database: kaala_dristi_db
--
-- Makes the Workspace Discovery board's scanner list DB-driven instead of a
-- hardcoded TypeScript array. Owner instruction: "no hardcoding should
-- happen because additional scanners might be added and few may be removed
-- as we go forward."
--
-- Was: HIGHLIGHT_SOURCES, a hardcoded array in
-- App/frontend/src/services/scanEngine.ts, manually listing 13 preset ids
-- with a strength/caution side + short label + optional row cap. Its own
-- comment documents the failure mode this migration fixes: two presets
-- (fresh_breakout, vani_opportunity) were already manually retired from the
-- array by hand — every future add/retire requires remembering to edit
-- this file, with no enforcement.
--
-- Now: three nullable columns on kd_scan_presets, the same table that
-- already drives every other piece of scan preset metadata (name,
-- description, tooltip, vani_rule, ...). Discovery becomes a plain query:
-- WHERE vani_side IS NOT NULL AND is_active = true. A new scanner is opted
-- into Discovery by setting vani_side at creation time (or later); a
-- retired scanner (is_active = false) or one explicitly opted out
-- (vani_side = NULL) drops out automatically — no code deploy needed
-- either way.

ALTER TABLE kd_scan_presets
  ADD COLUMN IF NOT EXISTS vani_side TEXT
    CHECK (vani_side IN ('strength', 'caution')),
  ADD COLUMN IF NOT EXISTS vani_short_label TEXT,
  ADD COLUMN IF NOT EXISTS vani_cap INTEGER;

COMMENT ON COLUMN kd_scan_presets.vani_side IS
  'Workspace Discovery board bucket. NULL = not shown on Discovery (default for new presets — opt-in, not opt-out).';
COMMENT ON COLUMN kd_scan_presets.vani_short_label IS
  'Short label shown on Discovery cards for stocks this preset flags (e.g. "S2", "Flow"). Falls back to name if NULL.';
COMMENT ON COLUMN kd_scan_presets.vani_cap IS
  'Optional cap on how many of this preset''s VaNi-flagged rows contribute to the Discovery union (e.g. pre-filtered shortlists that would otherwise flood it). NULL = uncapped.';

-- Backfill exact current HIGHLIGHT_SOURCES values so behavior is unchanged
-- on deploy. Every other active preset stays NULL (opted out of Discovery)
-- until the owner deliberately opts it in.

UPDATE kd_scan_presets SET vani_side = 'strength', vani_short_label = 'Confluence' WHERE id = 'power_buy';
UPDATE kd_scan_presets SET vani_side = 'strength', vani_short_label = 'Smart Money' WHERE id = 'smart_money';
UPDATE kd_scan_presets SET vani_side = 'strength', vani_short_label = 'Quiet Acc'   WHERE id = 'quiet_accumulation';
UPDATE kd_scan_presets SET vani_side = 'strength', vani_short_label = 'Flow'        WHERE id = 'conviction_flow';
UPDATE kd_scan_presets SET vani_side = 'strength', vani_short_label = 'Surge'       WHERE id = 'breakout_surge';
UPDATE kd_scan_presets SET vani_side = 'strength', vani_short_label = 'Burst'       WHERE id = 'flower_pot_burst';
UPDATE kd_scan_presets SET vani_side = 'strength', vani_short_label = 'S2'          WHERE id = 'stage_2_leaders';
UPDATE kd_scan_presets SET vani_side = 'strength', vani_short_label = 'S2 Watch'    WHERE id = 'stage_2_watch';

UPDATE kd_scan_presets SET vani_side = 'caution', vani_short_label = 'Weakness'     WHERE id = 'power_sell';
UPDATE kd_scan_presets SET vani_side = 'caution', vani_short_label = 'Distribution' WHERE id = 'distribution_warning';
UPDATE kd_scan_presets SET vani_side = 'caution', vani_short_label = 'S3'           WHERE id = 'stage_3_watch';
UPDATE kd_scan_presets SET vani_side = 'caution', vani_short_label = 'S4'           WHERE id = 'stage_4_leaders';
UPDATE kd_scan_presets SET vani_side = 'caution', vani_short_label = 'VaNi', vani_cap = 3 WHERE id = 'vani_exit_watch';

NOTIFY pgrst, 'reload schema';
