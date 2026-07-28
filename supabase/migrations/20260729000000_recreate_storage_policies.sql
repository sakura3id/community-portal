-- Recreate storage policies that were skipped/lost during database migration

DROP POLICY IF EXISTS "Approved users can read files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read files" ON storage.objects;
DROP POLICY IF EXISTS "Users with upload permission can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;

CREATE POLICY "Approved users can read files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'text-files' AND (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id::text = auth.uid()::text AND role::text = 'admin') OR
    has_namespaced_permission(auth.uid(), 'ipl_finder.read_files')
  )
);

CREATE POLICY "Users with upload permission can upload files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'text-files' AND (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id::text = auth.uid()::text AND role::text = 'admin') OR
    has_namespaced_permission(auth.uid(), 'ipl_finder.upload_files')
  )
);

CREATE POLICY "Users can delete own files" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'text-files' AND (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id::text = auth.uid()::text AND role::text = 'admin') OR
    auth.uid()::text = (storage.foldername(name))[1]
  )
);
