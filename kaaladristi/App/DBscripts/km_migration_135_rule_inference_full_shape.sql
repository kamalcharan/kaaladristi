-- Migration 135: km_rule_inference — full /inference-shaped capture
--
-- Owner spec 2026-07-07 (round 3, final): the Rule Inference form borrows
-- /inference's UI design and data shape, but stores in km_rule_inference —
-- NOTHING goes into dc_inference.
--
--   * astro event / dates come automatically from the rule + its almanac
--     windows (km_rule_transits) — displayed, never captured.
--   * Captured manually: inference text, market impact (the FULL 12-value
--     /inference vocabulary, not the reduced 5-value set from migration 134),
--     expert confidence 1-10 (always manual — AI never sets it),
--     applicability (same JSONB shape as dc_inference: Stock Market /
--     Sectors / Indexes / Commodities), notes.
--   * AI generates ONLY inference_text + market_impact.
--   * Non-directional inferences are first-class ("Mercury retrograde is a
--     turning point — might be positive or negative; the Pattern engine
--     tells how it works") — hence 'volatile'/'cautious'/'mixed' etc.

BEGIN;

-- Widen market_impact to the full /inference vocabulary
-- (constants/marketStatus.ts MARKET_STATUS is the frontend source of truth)
ALTER TABLE km_rule_inference
  DROP CONSTRAINT IF EXISTS km_rule_inference_market_impact_check;
ALTER TABLE km_rule_inference
  ADD CONSTRAINT km_rule_inference_market_impact_check CHECK (market_impact IN (
    'major_positive','minor_positive','bullish',
    'major_negative','minor_negative','bearish',
    'highly_volatile','volatile','cautious',
    'neutral','consolidation','mixed'));

-- Expert confidence + applicability + notes — same semantics as dc_inference
ALTER TABLE km_rule_inference
  ADD COLUMN IF NOT EXISTS confidence          SMALLINT CHECK (confidence BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS applicability_scope TEXT[],
  ADD COLUMN IF NOT EXISTS applicability       JSONB,
  ADD COLUMN IF NOT EXISTS notes               TEXT;

COMMENT ON COLUMN km_rule_inference.confidence IS
  'Expert confidence 1-10, always manually set — never AI-generated';
COMMENT ON COLUMN km_rule_inference.applicability IS
  'Same JSONB shape as dc_inference.applicability: {equity:{all_sectors,sectors[]}, index:{all,list[]}, commodity:{all,list[]}}';

NOTIFY pgrst, 'reload schema';

COMMIT;
