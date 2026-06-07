-- Migration 091: Add theme and dark_mode columns to km_profiles
-- Default: kaaladristi theme, dark mode on

ALTER TABLE km_profiles
  ADD COLUMN IF NOT EXISTS theme      TEXT    NOT NULL DEFAULT 'kaaladristi'
                                              CHECK (theme IN ('kaaladristi', 'tech-ai', 'jade-thorn')),
  ADD COLUMN IF NOT EXISTS dark_mode  BOOLEAN NOT NULL DEFAULT true;

-- Existing users keep defaults (kaaladristi, dark)
COMMENT ON COLUMN km_profiles.theme     IS 'Active UI theme id';
COMMENT ON COLUMN km_profiles.dark_mode IS 'Dark mode preference — ignored for kaaladristi (always dark)';
