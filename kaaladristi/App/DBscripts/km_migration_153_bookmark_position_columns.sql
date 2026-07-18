-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 153 — Positions as columns on bookmarks (Phase 2a)
-- Target DB: kaala_dristi_db
-- ═══════════════════════════════════════════════════════════════════════════
--
-- DECISION (owner, 2026-07-18): a "position" is just a BOOKMARK WITH AN ENTRY —
-- not a separate table. For the current scope (entry price/date/qty → P&L +
-- entry scorecard + thesis-health) a dedicated table is over-engineering, and
-- km_user_bookmarks is already the per-user, per-equity home. So add three
-- nullable columns; the relationship is derived:
--     entry_price IS NULL      → Watchlist  (watching, no money in)
--     entry_price IS NOT NULL  → Position   (held)
--
-- A dedicated km_user_positions table is deferred until we build REAL position/
-- risk management — multiple lots (averaging in), partial exits, stop-loss /
-- target levels, position sizing, risk-per-trade — which is a genuinely
-- different shape (many rows per stock, a lifecycle). Not before.
--
-- Positions are EQUITY-ONLY by construction: km_user_bookmarks references
-- equities. Index positions (NIFTY/BANKNIFTY) would need a separate mechanism
-- and are out of scope here.
--
-- Frontend note: v0 keeps entry data in a local store (stores/positionStore.ts)
-- whose shape mirrors these columns, so switching to server persistence is a
-- drop-in once the /api/bookmarks endpoint is extended to carry entry_*.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE km_user_bookmarks
  ADD COLUMN IF NOT EXISTS entry_price NUMERIC,
  ADD COLUMN IF NOT EXISTS entry_date  DATE,
  ADD COLUMN IF NOT EXISTS entry_qty   NUMERIC;

COMMENT ON COLUMN km_user_bookmarks.entry_price IS
  'Position entry price. NULL = watchlist-only; set = held position (Phase 2a).';
COMMENT ON COLUMN km_user_bookmarks.entry_date IS 'Position entry date (Phase 2a).';
COMMENT ON COLUMN km_user_bookmarks.entry_qty  IS 'Position quantity, optional (Phase 2a).';

NOTIFY pgrst, 'reload schema';
