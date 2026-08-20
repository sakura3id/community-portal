-- Clean up app-specific roles and permissions for 'documents' application
-- Since community-docs now relies purely on global user roles, these app-specific templates are no longer needed.

DELETE FROM public.app_role_permissions
WHERE app_role_id IN (
  SELECT ar.id FROM public.app_roles ar
  JOIN public.applications app ON ar.app_id = app.id
  WHERE app.slug = 'documents'
);

DELETE FROM public.app_roles ar
USING public.applications app
WHERE ar.app_id = app.id AND app.slug = 'documents';

-- Drop deprecated permission column from public.document_spaces table
ALTER TABLE public.document_spaces DROP COLUMN IF EXISTS permission;
