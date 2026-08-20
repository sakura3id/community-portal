-- Migration: Add drive_folder_sync_state table for folder-level sync timestamps
-- App: community-docs (Centralized Supabase migration in community-portal)

CREATE TABLE IF NOT EXISTS drive_folder_sync_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id UUID NOT NULL REFERENCES document_spaces(id) ON DELETE CASCADE,
    folder_id TEXT NOT NULL,
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    items_synced INTEGER DEFAULT 0,
    deleted_stale_rows INTEGER DEFAULT 0,
    duration_ms INTEGER,
    status TEXT DEFAULT 'success',
    CONSTRAINT unique_space_folder_sync UNIQUE (space_id, folder_id)
);

-- Fast lookup index for space and folder scope queries
CREATE INDEX IF NOT EXISTS idx_folder_sync_state ON drive_folder_sync_state(space_id, folder_id);

-- RLS Security Policies
ALTER TABLE drive_folder_sync_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public or authenticated read access for drive_folder_sync_state" ON drive_folder_sync_state;
DROP POLICY IF EXISTS "Service role full access for drive_folder_sync_state" ON drive_folder_sync_state;
DROP POLICY IF EXISTS "Allow backend write access for drive_folder_sync_state" ON drive_folder_sync_state;

CREATE POLICY "Public or authenticated read access for drive_folder_sync_state"
    ON drive_folder_sync_state FOR SELECT
    USING (true);

CREATE POLICY "Allow backend write access for drive_folder_sync_state"
    ON drive_folder_sync_state FOR ALL
    USING (true)
    WITH CHECK (true);
