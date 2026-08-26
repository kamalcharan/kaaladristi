-- Migration 189 — rename "Breakdown Watch" to "Breakdown Surge"
-- Target DB: kaala_dristi_db
--
-- Owner feedback (2026-08-26): "Breakdown Watch" reads as a WATCHLIST rather
-- than the daily breakdown screener. That was a naming error on my part -- the
-- name was mirrored from "Stage 2 Watch", where Watch legitimately means
-- "approaching, not yet confirmed". Here nothing is being watched for: the
-- level has already been lost. It is the exact mirror of Breakout Surge and is
-- now named as one, so the pair reads as a pair in the Price Action list.
--
-- The preset ID stays 'breakdown_watch' DELIBERATELY. IDs are addresses, not
-- labels: they appear in ?setup= URLs, in kd_scan_presets.id, in the setup
-- adapter registry key, and in PRESET_COL_OVERRIDES. Renaming an ID to match a
-- label is churn that buys nothing and breaks any link already shared. The
-- divergence is recorded here and in the TS preset row so it does not read as
-- an oversight later.
--
-- Display name only. No column, filter, universe, ranking or limit changes --
-- the screener returns exactly the same rows before and after.

UPDATE kd_scan_presets
SET name        = 'Breakdown Surge',
    description = 'NSE stocks closing below their 20-day low on a red day — ranked by depth below the level',
    tooltip     = 'Stocks that closed under the lowest close of the prior 20 sessions, on a down day. The exact mirror of Breakout Surge: a structural level being lost, not merely a weak week. The Brk Dn Lvl column is the floor that was broken; % Below states how far under it price now sits. Observational only; not a recommendation.'
WHERE id = 'breakdown_watch';

NOTIFY pgrst, 'reload schema';
