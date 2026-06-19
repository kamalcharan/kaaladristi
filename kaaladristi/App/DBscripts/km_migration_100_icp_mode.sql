-- Migration 100: Add icp_mode column to km_profiles
-- Stores user's ICP (Ideal Customer Profile) analysis style preference.
-- Values: 'astro' (default) | 'technical'
-- Drives tab default on WorkspacePage (Sprint 4).
-- Run on kaala_dristi_db.

ALTER TABLE km_profiles
ADD COLUMN icp_mode TEXT NOT NULL DEFAULT 'astro'
CHECK (icp_mode IN ('astro', 'technical'));
