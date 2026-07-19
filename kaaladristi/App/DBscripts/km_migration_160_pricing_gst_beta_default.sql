-- km_migration_160_pricing_gst_beta_default.sql
-- Target DB: kaala_dristi_db
--
-- Payments P0 (Part 3/3) — pricing model: yearly-only + GST + beta default.
--
-- 1. GST breakdown storage on user_subscriptions. Prices in km_config are
--    stored GST-EXCLUSIVE (base); every payment now records base / gst / total
--    in paise so invoices and GST filings are mechanical, not forensic.
-- 2. New signups default to the 'beta' tier (growth-first pre-launch; nobody
--    is charged during beta). Flip the km_profiles.tier column default back to
--    'free' at public launch.
-- 3. Config: gst_rate + tier_expiry_demote_to (read by the 00:15 expiry sweep)
--    + a clarifying note that price_*_paise are base/exclusive amounts.
--
-- NOTE (manual, owner): for GST to actually be COLLECTED on subscriptions, the
-- Razorpay annual PLAN must be (re)created at the GST-INCLUSIVE total
-- (₹4,999 + 18% = ₹5,898.82 → 589882 paise) and its id stored in
-- km_config.razorpay_plan_annual. One-time trial orders are charged
-- GST-inclusive automatically by the backend (create-trial-order).

BEGIN;

-- 1 ── GST breakdown columns (paise, nullable — historical rows stay null) ──
ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS base_paise  INTEGER,
  ADD COLUMN IF NOT EXISTS gst_paise   INTEGER,
  ADD COLUMN IF NOT EXISTS total_paise INTEGER;

COMMENT ON COLUMN user_subscriptions.base_paise  IS 'Pre-tax amount in paise (GST-exclusive)';
COMMENT ON COLUMN user_subscriptions.gst_paise   IS 'GST amount in paise';
COMMENT ON COLUMN user_subscriptions.total_paise IS 'Charged amount in paise (base + gst)';

-- 2 ── New signups default to beta (pre-launch). Revert to 'free' at launch. ──
ALTER TABLE km_profiles ALTER COLUMN tier SET DEFAULT 'beta';

-- 3 ── Config: GST rate + expiry demotion target + base-price clarification ──
INSERT INTO km_config (key, value) VALUES
  ('gst_rate',              '0.18'),
  ('tier_expiry_demote_to', 'free')
ON CONFLICT (key) DO NOTHING;

COMMIT;
