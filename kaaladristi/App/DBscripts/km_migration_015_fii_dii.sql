-- ============================================================
-- Migration 015 · FII / DII Activity
-- Daily buy/sell/net flows for Foreign & Domestic institutions
-- Source: NSE API — fiidiiTradeReact (cash market)
-- ============================================================

CREATE TABLE IF NOT EXISTS km_fii_dii (
  id          SERIAL PRIMARY KEY,
  trade_date  DATE        NOT NULL,
  category    TEXT        NOT NULL,   -- 'FII' or 'DII'
  buy_value   NUMERIC(14,2),          -- gross purchases, crores
  sell_value  NUMERIC(14,2),          -- gross sales, crores
  net_value   NUMERIC(14,2),          -- net (buy - sell), crores
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (trade_date, category)
);

CREATE INDEX IF NOT EXISTS idx_fii_dii_date
  ON km_fii_dii (trade_date DESC);

CREATE INDEX IF NOT EXISTS idx_fii_dii_category
  ON km_fii_dii (category);

-- ── Permissions ─────────────────────────────────────────────
GRANT ALL ON km_fii_dii TO authenticated, kd_app, anon;
GRANT USAGE, SELECT ON SEQUENCE km_fii_dii_id_seq TO authenticated, kd_app, anon;

NOTIFY pgrst, 'reload schema';
