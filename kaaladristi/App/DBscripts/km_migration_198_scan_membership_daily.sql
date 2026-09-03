-- ============================================================================
-- km_migration_198_scan_membership_daily.sql
-- Target DB: kaala_dristi_db
--
-- New table: km_scan_membership_daily — day-over-day scan-membership
-- history. Foundation for the Breakout Surge scanner-level VaNi intents
-- that need to diff today against a prior date ("Show me what's new since
-- yesterday", "Which stocks just turned RS-green?", "Is today unusual
-- compared to recent sessions?" — see docs/claude/breakout-surge-vani-poa.md
-- and the VaNi Two Levels 7-question design).
--
-- Why this doesn't already exist: km_scan_results (migration 147, extended
-- by 195/197 to also cover the price-action presets including
-- breakout_surge) is a materialized VIEW — it only ever holds the CURRENT
-- snapshot, overwritten in place every night by the scan_refresh pipeline
-- step. Nothing anywhere in the schema persists that membership across
-- days, so there has never been a prior day's row to diff "today" against.
--
-- Populated by scripts/compute_scan_membership_snapshot.py, wired into
-- pipeline2 as the scan_membership_snapshot step (App/backend/pipeline2/
-- orchestrator.py DAILY_STEPS). CORRECTED (2026-09-03, before first
-- deploy): an earlier version of this script read membership straight from
-- km_scan_results, which seemed like reuse but actually broke backfill —
-- that view is current-snapshot-only and never holds a date other than
-- "today", so reading it for any past date silently returned zero rows.
-- Fixed to re-derive membership directly from km_equity_eod (which DOES
-- hold full history) for every date, live or backfilled alike — the same
-- WHERE clause as migration 197's `breakout_surge`/`pa`/`pa_pool` CTEs
-- (NSE-only, close >= 50, pct_chng > 0, pct_from_breakout > 0, capped at
-- the display limit), kept in sync by hand since it's no longer read off a
-- live view.
--
-- Scope: breakout_surge only for now (the one preset with Phase 3 VaNi
-- intents) — extend by adding a preset_id + its qualifying WHERE clause to
-- the script's PRESET_MEMBERSHIP_FNS.
--
-- "New since yesterday" / "RS just turned green" only have something real
-- to answer starting the day AFTER a prior day's snapshot exists — either
-- the day after the nightly pipeline first runs this step, or immediately
-- if backfilled below (backfill now works for any real past date, unlike
-- the original version of this migration's tail comment implied).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS km_scan_membership_daily (
    trade_date      DATE NOT NULL,
    preset_id       TEXT NOT NULL,
    equity_id       INT NOT NULL REFERENCES km_equity_symbols(id),
    magic_rs_zone   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (trade_date, preset_id, equity_id)
);

CREATE INDEX IF NOT EXISTS ix_scan_membership_daily_preset_date
    ON km_scan_membership_daily (preset_id, trade_date);

COMMENT ON TABLE km_scan_membership_daily IS
  'Frozen daily membership of a scan preset''s qualifying equities, appended once per day -- unlike km_scan_results (a current-snapshot-only materialized view), this persists history so day-over-day VaNi intents (new-since-yesterday, RS-flip, unusual-vs-recent) can diff today against a prior date. Populated by scripts/compute_scan_membership_snapshot.py (derives membership directly from km_equity_eod, so it works for backfilled past dates too, not just live runs), wired into pipeline2 as the scan_membership_snapshot step. Scope: breakout_surge only for now -- see the script''s SNAPSHOT_PRESET_IDS to extend.';

COMMENT ON COLUMN km_scan_membership_daily.magic_rs_zone IS
  'The equity''s magic_rs_zone AS OF this trade_date -- captured here (not re-joined from km_equity_eod later) so a Magic RS zone flip can be detected via LAG() over this table''s own history even after km_equity_eod''s retention window or the zone-banding logic changes.';

-- No RLS -- pipeline-computed aggregate table, no user data
-- (LESSONS_LEARNED.md: "don't add RLS to aggregate tables"). Grants match
-- every other pipeline table: kd_app writes it; the rest get read access
-- for consistency/future frontend use, though today it's read server-side
-- only, by pipeline2_api.py's VaNi assemblers.
GRANT SELECT ON km_scan_membership_daily TO authenticated, anon, kd_app, admin, kd_readonly;
GRANT INSERT, UPDATE, DELETE ON km_scan_membership_daily TO kd_app;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- After COMMIT:
--   1. Deploy the pipeline2 change (scan_membership_snapshot step).
--   2. Optional backfill so "new since yesterday" has more than one day of
--      history on day one:
--        python scripts/compute_scan_membership_snapshot.py --from 2026-08-01
