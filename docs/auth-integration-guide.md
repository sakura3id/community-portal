# Auth Integration Guide

> **For resident developers building apps in the Sakura 3 ecosystem.**

Sakura 3 uses a **centralized identity system**. You do not build your own login — you integrate with the Community Portal and share its session. For a visual overview of how authentication redirects, SSO, and background refreshes work, see the [Authentication Sequence Diagrams](./auth-sequence-diagram.md).

This guide is split into two layers.

---

## Layer 1 — The Contract

Read this first, regardless of your stack.

**[Sakura 3 Identity Protocol](./sakura3-identity-protocol.md)**

Defines the auth topology, cookie contract, redirect contract, approval contract, RBAC contract, and session verification contract in a **platform-agnostic** way.

---

## Layer 2 — Reference Implementations

Pick the guide for your stack:

| Stack | Status | Guide |
|---|---|---|
| React + Vite (TypeScript) | ✅ Active | [auth/react-vite.md](./auth/react-vite.md) |
| Node.js + Express | ✅ Active | [auth/node-express.md](./auth/node-express.md) |
| Next.js (App Router) | 📋 Stub | [auth/nextjs.md](./auth/nextjs.md) |
| Laravel (PHP) | 📋 Stub | [auth/laravel.md](./auth/laravel.md) |
| Go + Fiber | 📋 Stub | [auth/go-fiber.md](./auth/go-fiber.md) |

---

## Registering Your App

All apps must complete two one-time setup steps before integration works.

### Step 1 — Add your origin to the portal allowlist

Open `community-portal/src/App.tsx` and add your production and local dev URLs to `ALLOWED_ORIGINS`:

```typescript
const ALLOWED_ORIGINS = [
  // ... existing entries ...
  'https://my-app.sakura3.id',       // ← production
  'http://my-app.localtest.me:3000',    // ← local dev
];
```

Submit a PR or ask the platform admin.

### Step 2 — (Optional) Register for RBAC

If your app has its own permission model, register it in the shared Supabase database so the Admin Center can manage per-app roles for residents.

Run this migration once:

```sql
-- Register your app
INSERT INTO public.applications (slug, name, description, url)
VALUES (
  'my_app',                              -- unique slug, used in permission namespace
  'My App Name',
  'Brief description',
  'https://my-app.sakura3.id'
) ON CONFLICT (slug) DO NOTHING;

-- Define permissions
INSERT INTO public.app_permissions (app_id, name, description)
SELECT id, 'read_data', 'View app data'
FROM public.applications WHERE slug = 'my_app'
ON CONFLICT (app_id, name) DO NOTHING;

-- Define roles
INSERT INTO public.app_roles (app_id, name, description)
SELECT id, 'resident', 'Standard resident access'
FROM public.applications WHERE slug = 'my_app'
ON CONFLICT (app_id, name) DO NOTHING;

-- Bind permissions to roles
INSERT INTO public.app_role_permissions (app_role_id, permission_id)
SELECT ar.id, ap.id
FROM public.app_roles ar
JOIN public.app_permissions ap ON ar.app_id = ap.app_id
JOIN public.applications app ON ar.app_id = app.id
WHERE app.slug = 'my_app' AND ar.name = 'resident' AND ap.name = 'read_data'
ON CONFLICT DO NOTHING;
```

Once registered, the **Admin Center** on `portal.sakura3.id` can assign app roles to individual residents.

---

## Quick Reference

| Item | Value |
|---|---|
| Cookie name | `sakura3-auth` |
| Cookie domain (prod) | `.sakura3.id` |
| Cookie domain (staging) | `.sr3.my.id` |
| Cookie domain (local) | `.localtest.me` |
| Supabase `storageKey` | `sakura3-auth` |
| Portal URL (prod) | `https://portal.sakura3.id` |
| Portal URL (staging) | `https://portal.sr3.my.id` |
| Portal URL (local) | `http://portal.localtest.me:5173` |
| Permission RPC | `has_namespaced_permission(user_id, 'app_slug.perm_name')` |
| Approval field | `public.profiles.approval_status` |
