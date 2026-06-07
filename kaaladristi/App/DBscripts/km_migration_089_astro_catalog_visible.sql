-- Migration 089: Admin-controlled catalog visibility flag for astro rules
--
-- When catalog_visible = TRUE, the rule appears in the Catalog and can be
-- added to user frameworks. Default is FALSE so new rules are hidden until
-- admin explicitly promotes them after testing/backtesting is complete.

ALTER TABLE km_astro_rule_master
  ADD COLUMN IF NOT EXISTS catalog_visible BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN km_astro_rule_master.catalog_visible IS
  'Admin flag: when true, rule is visible in the Catalog for users to add to their frameworks. Default false — admin promotes rules after backtesting is complete.';
