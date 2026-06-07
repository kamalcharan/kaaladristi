-- Migration 092: km_config + subscription tracking + expires_at denormalisation
-- Adds plan registry, subscription tracking columns, and fast-lookup expiry in profiles

-- ── 1. Create km_config table for platform-level key-value config ────────

CREATE TABLE IF NOT EXISTS km_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ── 2. Insert Razorpay plan IDs + prices (test values — swap for production) ────

INSERT INTO km_config (key, value) VALUES
  ('razorpay_plan_quarterly', 'plan_SwiRT8DxobH8uv'),
  ('razorpay_plan_annual',    'plan_SwiS7MUxm5MbTj'),
  ('razorpay_trial_qr',       'qr_SwiVP7FJQ64O2G'),
  ('price_trial_paise',       '19900'),
  ('price_quarterly_paise',   '199900'),
  ('price_annual_paise',      '499900')
ON CONFLICT (key) DO NOTHING;

-- ── 3. Add subscription tracking columns to user_subscriptions ────────────

ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS razorpay_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id      TEXT,
  ADD COLUMN IF NOT EXISTS status                   TEXT DEFAULT 'active';

-- ── 4. Add expires_at to km_profiles for fast lookup (denormalised) ──────

ALTER TABLE km_profiles
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- ── 5. Backfill expires_at from user_subscriptions (active subscriptions only) ────

UPDATE km_profiles p
SET expires_at = (
  SELECT MAX(s.expires_at)
  FROM user_subscriptions s
  WHERE s.user_id = p.id
    AND s.status = 'active'
    AND s.expires_at IS NOT NULL
)
WHERE expires_at IS NULL;

-- ── 6. Add index on user_subscriptions status + user_id for fast lookups ──

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status
  ON user_subscriptions (user_id, status);

-- ── 7. Add comment documenting the schema ──────────────────────────────

COMMENT ON TABLE km_config IS
  'Platform-level configuration registry. Keys: razorpay plan IDs, pricing in paise. '
  'Allows price/plan changes without code redeployment.';

COMMENT ON TABLE user_subscriptions IS
  'One row per payment event (trial, renewal, cancellation). '
  'Tracks payment IDs, subscription IDs, tier, and expiry. '
  'tier + expires_at are the source of truth for subscription status.';

COMMENT ON COLUMN km_profiles.expires_at IS
  'Denormalised expiry date from user_subscriptions for fast tier-gate checks. '
  'Updated by webhook handler on payment.captured / subscription.charged / halted / cancelled. '
  'NULL = no expiry (free tier or beta).';

COMMENT ON COLUMN user_subscriptions.razorpay_subscription_id IS
  'Razorpay subscription ID for recurring (quarterly/annual) tiers. '
  'Null for one-time trial orders.';

COMMENT ON COLUMN user_subscriptions.razorpay_payment_id IS
  'Razorpay payment ID. Used to correlate with webhooks and dispute handling.';

COMMENT ON COLUMN user_subscriptions.status IS
  'Subscription status: active (paying) or cancelled (failed/user-cancelled). '
  'Webhook handler updates this on subscription.halted / subscription.cancelled.';
