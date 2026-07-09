-- Migration 141: Add mode column to km_profiles — persist color mode per-user
--
-- km_profiles.theme (migration 091) already makes the chosen palette follow
-- a user across devices via kd_auth_login -> getProfile() -> applyProfileTheme().
-- Color mode (dark/light/system) was still localStorage-only (themeStore.ts
-- setMode), so it did not survive a login on a different device/browser.
--
-- Migration 091 also added a `dark_mode BOOLEAN` column for this, but it was
-- never wired into the frontend (no KmProfile field, no read/write path) and
-- predates the 3-state mode model (dark/light/system) introduced by Theme
-- Phase 1 (#173). Left in place, unused — not worth a destructive migration
-- over a column nothing ever read.

ALTER TABLE km_profiles
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'dark'
                                CHECK (mode IN ('dark', 'light', 'system'));

COMMENT ON COLUMN km_profiles.mode IS 'Active UI color mode (dark/light/system) — mirrors themeStore.ts ThemeMode';
