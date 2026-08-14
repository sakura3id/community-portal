-- Migration: Add is_synthetic_target column to drive_space_items
-- App: community-docs (Centralized Supabase migration in community-portal)

ALTER TABLE drive_space_items ADD COLUMN IF NOT EXISTS is_synthetic_target BOOLEAN DEFAULT FALSE;

-- Index for fast filtering of synthetic target rows
CREATE INDEX IF NOT EXISTS idx_drive_space_items_synthetic ON drive_space_items(is_synthetic_target);
