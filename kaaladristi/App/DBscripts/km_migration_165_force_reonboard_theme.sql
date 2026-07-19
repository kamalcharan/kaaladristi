-- km_migration_165_force_reonboard_theme.sql
-- Target DB: kaala_dristi_db
--
-- Force every existing user back through onboarding so they consciously pick a
-- theme (a new final step was added to ProfileSetup — owner request 2026-07-19).
--
-- Effect: on next login, ProtectedRoute redirects to /setup. Users who already
-- have icp_mode (built a framework before) resume near the end — plan → theme —
-- and finish in a couple of clicks; users without icp_mode run the short wizard.
-- onboarded flips back to true only when they complete the new theme step.
--
-- Frameworks, tiers, themes and all other profile data are untouched — this
-- only clears the completion flag.

UPDATE km_profiles SET onboarded = false, updated_at = now();
