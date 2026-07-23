-- Register Rekap Viewer in the ecosystem applications table
INSERT INTO public.applications (slug, name, description, url)
VALUES (
  'rekap_viewer',
  'Rekap Viewer',
  'Fly.io cached backend display for Sheets logs, reports, and real-time community summaries.',
  'https://rekap.sakura3.id'
) ON CONFLICT (slug) DO NOTHING;

-- Define basic permissions
INSERT INTO public.app_permissions (app_id, name, description)
SELECT id, 'read_data', 'View rekap data'
FROM public.applications WHERE slug = 'rekap_viewer'
ON CONFLICT (app_id, name) DO NOTHING;

-- Define roles
INSERT INTO public.app_roles (app_id, name, description)
SELECT id, 'resident', 'Standard resident access'
FROM public.applications WHERE slug = 'rekap_viewer'
ON CONFLICT (app_id, name) DO NOTHING;

-- Bind permissions to roles
INSERT INTO public.app_role_permissions (app_role_id, permission_id)
SELECT ar.id, ap.id
FROM public.app_roles ar
JOIN public.app_permissions ap ON ar.app_id = ap.app_id
JOIN public.applications app ON ar.app_id = app.id
WHERE app.slug = 'rekap_viewer' AND ar.name = 'resident' AND ap.name = 'read_data'
ON CONFLICT DO NOTHING;
