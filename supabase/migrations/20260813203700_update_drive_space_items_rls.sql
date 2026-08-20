-- Migration: Allow backend write access for drive_space_items
-- App: community-docs (Centralized Supabase migration in community-portal)

CREATE POLICY "Allow backend write access for drive_space_items"
    ON drive_space_items FOR ALL
    USING (true)
    WITH CHECK (true);
