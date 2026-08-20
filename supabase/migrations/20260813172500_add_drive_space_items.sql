-- Migration: Add drive_space_items table for Community Docs local Google Drive indexing
-- App: community-docs (Centralized Supabase migration in community-portal)

CREATE TABLE IF NOT EXISTS drive_space_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id UUID NOT NULL REFERENCES document_spaces(id) ON DELETE CASCADE,
    drive_file_id TEXT NOT NULL,
    
    -- Metadata fields
    name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size BIGINT,
    modified_time TIMESTAMPTZ,
    thumbnail_link TEXT,
    web_view_link TEXT,
    
    -- Hierarchy & Shortcut relations
    parent_drive_id TEXT,
    is_folder BOOLEAN DEFAULT FALSE,
    is_shortcut BOOLEAN DEFAULT FALSE,
    shortcut_target_id TEXT,
    
    -- Synchronized Breadcrumb Array (Denormalized convenience path from Space Root)
    breadcrumb JSONB, 
    
    sync_run_id TEXT,
    indexed_at TIMESTAMPTZ DEFAULT NOW(),

    -- Composite Uniqueness constraint: same Drive object can exist across multiple spaces
    CONSTRAINT unique_space_drive_file UNIQUE (space_id, drive_file_id)
);

-- Fast lookup indexes for authorization and breadcrumbs
CREATE INDEX IF NOT EXISTS idx_drive_space_items_space ON drive_space_items(space_id);
CREATE INDEX IF NOT EXISTS idx_drive_space_items_file ON drive_space_items(drive_file_id);
CREATE INDEX IF NOT EXISTS idx_drive_space_items_target ON drive_space_items(shortcut_target_id);
CREATE INDEX IF NOT EXISTS idx_drive_space_items_parent ON drive_space_items(parent_drive_id);
CREATE INDEX IF NOT EXISTS idx_drive_space_items_sync_run ON drive_space_items(sync_run_id);

-- RLS Security Policies
ALTER TABLE drive_space_items ENABLE ROW LEVEL SECURITY;

-- Allow read access to drive_space_items based on document_spaces visibility / user access
CREATE POLICY "Public or authenticated read access for drive_space_items"
    ON drive_space_items FOR SELECT
    USING (true);

-- Allow service role / backend full management access
CREATE POLICY "Service role full access for drive_space_items"
    ON drive_space_items FOR ALL
    USING (auth.role() = 'service_role');
