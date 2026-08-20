-- Migration: Update RLS policies for drive_folder_sync_state to allow backend writes
-- App: community-docs (Centralized Supabase migration in community-portal)

DROP POLICY IF EXISTS "Service role full access for drive_folder_sync_state" ON drive_folder_sync_state;
DROP POLICY IF EXISTS "Allow backend write access for drive_folder_sync_state" ON drive_folder_sync_state;

CREATE POLICY "Allow backend write access for drive_folder_sync_state"
    ON drive_folder_sync_state FOR ALL
    USING (true)
    WITH CHECK (true);
