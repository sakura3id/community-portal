# Community Portal — Architecture Reference

This document is the canonical technical reference for the **Community Portal** internals. For the external developer integration contract, see the [Auth Integration Guide](./auth-integration-guide.md) and [Sakura 3 Identity Protocol](./sakura3-identity-protocol.md).

---

## 1. Architecture Overview

The Community Portal is the **sole OAuth entry point** for the Sakura 3 residential ecosystem. It handles Google sign-in, the resident approval workflow, and platform RBAC. After authentication, it writes a shared `sakura3-auth` cookie that all sibling apps consume.

### App State Machine (`src/App.tsx`)

```
User not logged in           → LoginScreen
User logged in + rejected/suspended  → RejectedScreen
User logged in + not approved        → PendingApprovalScreen
User logged in + approved + redirect_to → Redirect to origin app
User logged in + approved            → EcosystemLandingScreen (MobileEcosystemPortal)
```

### Ecosystem Sibling Apps

| App | Slug | Description |
|---|---|---|
| IPL Finder | `ipl_finder` | Bank e-statement search, CSV record indexing |
| Rekap Viewer | `rekap_viewer` | Sheets logs, reports, community summaries |
| Community Documents | `community_docs` | Governed document access, meeting records |

### Environments

| Env | Domain | Portal URL |
|---|---|---|
| Local | `*.localtest.me` | `http://portal.localtest.me:5173` |
| Staging | `*.sr3.my.id` | `https://portal.sr3.my.id` |
| Production | `*.sakura3.id` | `https://portal.sakura3.id` |

---

## 2. Directory Structure

```
community-portal/
├── docs/
│   ├── ARCHITECTURE.md              # This document
│   ├── LESSONS_LEARNED.md           # Operational lessons & gotchas
│   ├── sakura3-identity-protocol.md # Platform-agnostic auth contract (external)
│   ├── auth-integration-guide.md    # Developer integration entry point (external)
│   ├── auth-sequence-diagram.md     # Mermaid auth flow diagrams (external)
│   ├── whatsapp-verification.md     # WhatsApp verification spec (planned feature)
│   └── auth/                        # Per-stack reference implementations (external)
├── src/
│   ├── components/
│   │   ├── LoginScreen.tsx           # Google sign-in UI
│   │   ├── PendingApprovalScreen.tsx # Waiting room + profile info collection
│   │   ├── RejectedScreen.tsx        # Access denied screen
│   │   ├── EcosystemLandingScreen.tsx# App hub directory (post-approval)
│   │   └── mobile/
│   │       └── MobileEcosystemPortal.tsx # Main portal shell, tab routing, governance handlers
│   ├── hooks/
│   │   ├── useAuth.tsx               # AuthProvider: session, signInWithGoogle, signOut
│   │   ├── usePermissions.tsx        # Approval status, roles, permission flags
│   │   └── useDemoMode.tsx           # Demo account detection (read-only mode)
│   ├── lib/
│   │   ├── supabase.ts               # Supabase client + cross-subdomain CookieStorage
│   │   ├── i18n.ts                   # Path-based t('key') translation helper
│   │   ├── analytics.ts              # Event tracking via analytics_events table
│   │   └── masking.ts                # Data masking utilities
│   ├── constants/
│   │   └── affiliations.ts           # Non-resident affiliation types
│   ├── locales/
│   │   ├── id.json                   # Indonesian (default) translation dictionary
│   │   └── en.json                   # English (fallback) translation dictionary
│   ├── App.tsx                       # Root state machine, redirect validation, ALLOWED_ORIGINS
│   └── index.css                     # Full design system (tokens, components, animations)
├── supabase/
│   ├── migrations/                   # Database schema, RLS policies (source of truth)
│   └── functions/                    # Supabase Edge Functions (e.g. predefined-login)
├── .kiro/steering/project.md         # Lean internal reference (design tokens, conventions)
├── Dockerfile
├── fly.toml                          # Staging config (community-veryresto → portal.sr3.my.id)
└── fly.production.toml               # Production config (portal-sakura3 → portal.sakura3.id)
```

---

## 3. Database Schema

All migrations live in `supabase/migrations/`. The database is **shared** across all ecosystem apps.

### `public.profiles`

Maps 1-to-1 with `auth.users`. Created automatically via `handle_new_user` trigger on signup.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | References `auth.users(id)` |
| `full_name` | TEXT | |
| `avatar_url` | TEXT | |
| `house_number` | TEXT | Primary house affiliation |
| `whatsapp_number` | TEXT | Raw number |
| `whatsapp_verified_at` | TIMESTAMPTZ | Null until verified |
| `approval_status` | ENUM | `unsubmitted` → `pending` → `approved` \| `rejected` \| `suspended` |
| `participant_type` | TEXT | `resident` \| `non_resident` |
| `resident_subtype` | TEXT | `owner` \| `renter` \| `household_member` |
| `requested_affiliation` | TEXT | For non-residents: `secretariat`, `security`, `vendor`, `assistant` |
| `last_active_at` | TIMESTAMPTZ | Updated on activity |

### `public.user_roles`

Global platform roles. Bypass most app-level RLS.

| Column | Type | Notes |
|---|---|---|
| `user_id` | UUID | References `auth.users(id)` |
| `role` | ENUM | `admin` \| `resident_verifier` \| `platform_moderator` |

### `public.applications`

Registry of ecosystem apps — the RBAC namespace.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `slug` | TEXT UNIQUE | e.g. `ipl_finder` — **immutable after creation** |
| `name` | TEXT | |
| `url` | TEXT | |

### `public.app_permissions`

Raw capabilities defined by each app.

| Column | Notes |
|---|---|
| `app_id` | FK to `applications` |
| `name` | e.g. `read_files`, `upload_files` |

### `public.app_roles`

Role templates per app (e.g. `ipl_finder.resident`, `ipl_finder.admin`).

### `public.app_role_permissions`

Join table binding `app_roles` ↔ `app_permissions`.

### `public.user_app_roles`

Per-user per-app role assignment. Primary enforcement table.

| Column | Notes |
|---|---|
| `user_id` | FK to `auth.users` |
| `app_role_id` | FK to `app_roles` |
| `granted_by` | FK to `auth.users` |

**Uniqueness**: `UNIQUE (user_id, app_role_id)`

### `public.user_permissions` (Legacy)

Flat compatibility table (`read_files`, `upload_files` flags) kept in sync with `user_app_roles` via trigger. **Read-only** — never write directly. Will be dropped once all apps migrate to `has_namespaced_permission`.

### `public.houses`

House registry for the community.

### `public.profile_house_affiliations`

Many-to-many between `profiles` and `houses` (`affiliation_type`, `is_primary`).

### `public.governance_events`

Immutable audit log of all governance actions.

| Column | Notes |
|---|---|
| `actor_user_id` | Who performed the action |
| `target_user_id` | Who was affected |
| `action` | e.g. `approved_resident`, `assigned_app_role`, `PROFILE_WHATSAPP_VERIFIED` |
| `reason` | Required for negative actions (suspend/reject) |
| `metadata` | JSONB context |

### `public.analytics_events`

Event telemetry via `analytics.track(eventName, properties)`.

---

## 4. RBAC Model

### Two-Tier System

**Tier 1 — Global roles** (`user_roles`):
- `admin` — full platform administrator, bypasses all app RLS
- `resident_verifier` — can approve/reject residents and manage app roles
- `platform_moderator` — can moderate content and log governance events

**Tier 2 — App roles** (`user_app_roles`):
- Scoped to a specific app (`app_roles.app_id`)
- Combined into capability templates (`app_role_permissions`)
- Checked via `has_namespaced_permission(uid, 'app_slug.permission_name')`

### Permission Namespace Format

```
<app_slug>.<permission_name>

Examples:
  ipl_finder.read_files
  ipl_finder.upload_files
  rekap_viewer.read_data
  community_docs.admin
```

### Key SQL Helper Functions

```sql
-- Core dynamic permission resolution
has_namespaced_permission(user_id UUID, namespaced_perm TEXT) RETURNS BOOLEAN
-- Returns TRUE for global admin, or if user holds an app role containing the permission.
-- Does NOT check approval_status — check separately.

-- Governance guard
is_platform_manager(uid UUID) RETURNS BOOLEAN
-- Returns TRUE for admin, resident_verifier, or platform_moderator.
-- Used in profile approval RLS.

-- Legacy helpers (pre-RBAC)
has_role(_user_id UUID, _role TEXT) RETURNS BOOLEAN
has_permission(_user_id UUID, _permission TEXT) RETURNS BOOLEAN
```

### Database Triggers

| Trigger | Table | Action |
|---|---|---|
| `handle_new_user` | `auth.users` INSERT | Auto-creates `profiles` row with `approval_status = 'pending'` |
| `log_user_app_role_governance` | `user_app_roles` INSERT/DELETE | Writes `assigned_app_role` / `revoked_app_role` to `governance_events` |
| `sync_legacy_permissions` | `user_app_roles` INSERT/DELETE | Keeps `user_permissions` in sync for legacy apps |

---

## 5. RLS Policy Reference

### `public.profiles`

```sql
-- Anyone can see all profiles (name, avatar, etc.)
CREATE POLICY "Users can view all profiles"
ON public.profiles FOR SELECT USING (true);

-- Self-service profile edits (name, WA number, etc.)
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Platform managers can update any profile (approval, status changes)
CREATE POLICY "Platform managers can update all profiles"
ON public.profiles FOR UPDATE USING (public.is_platform_manager(auth.uid()));
```

> ⚠️ The self-service UPDATE policy does not restrict `approval_status`. Backend implementations must validate payloads to prevent self-approval.

### `public.user_roles`

```sql
CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));
```

### `public.governance_events`

```sql
CREATE POLICY "Admins and verifiers can view governance events"
ON public.governance_events FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role IN ('admin', 'resident_verifier')
));

CREATE POLICY "Authorized managers can create governance events"
ON public.governance_events FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role IN ('admin', 'resident_verifier', 'platform_moderator')
));
```

### App-RBAC Framework

```sql
-- Only approved residents can see the app/role registry
CREATE POLICY "Approved residents can view connected apps and roles"
ON public.applications FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.profiles WHERE id = auth.uid() AND approval_status = 'approved'
));

-- Only admins can add/modify apps
CREATE POLICY "Platform managers can manage application registry"
ON public.applications FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
));

-- Admins and verifiers manage user role assignments
CREATE POLICY "Platform managers can manage resident app role mappings"
ON public.user_app_roles FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role IN ('admin', 'resident_verifier')
));
```

---

## 6. Session & Cookie Architecture

### Cookie Name & Domain

```
Cookie key: sakura3-auth
```

| Environment | Cookie Domain |
|---|---|
| Production | `.sakura3.id` |
| Staging | `.sr3.my.id` |
| Local dev | `.localtest.me` |

Domain is resolved dynamically in `src/lib/supabase.ts` → `getCookieDomain()`.

### 4KB Size Optimization

Browser cookies are hard-capped at **4KB per domain**. Supabase sessions with full user metadata easily exceed this, causing silent truncation and invisible auth failures.

**Solution** (in `CookieStorage`):
- **`setItem`**: strips the `user` object before writing — stores only `access_token`, `refresh_token`, `expires_at`, `expires_in`, `token_type` (~1.5KB)
- **`getItem`**: reconstructs the `user` object on read by decoding JWT claims (`sub`, `email`, `role`, `app_metadata`, `user_metadata`)

### Redirect Validation (`ALLOWED_ORIGINS` in `src/App.tsx`)

All `?redirect_to=` values are validated against `ALLOWED_ORIGINS` before the OAuth flow. Unregistered origins are silently dropped — the user lands on the portal hub instead. **Registering a new app's URLs in this list is a required step for integration.**

---

## 7. App Registration Checklist

For each new ecosystem app:

1. **Add to `ALLOWED_ORIGINS`** in `src/App.tsx` — both production and local dev URLs
2. **Register in DB**: `INSERT INTO public.applications (slug, name, url)`
3. **Define permissions**: `INSERT INTO public.app_permissions`
4. **Define roles**: `INSERT INTO public.app_roles` + `app_role_permissions`
5. **Configure DNS**: Point `[app-name].sakura3.id` to Fly.io
6. **Implement auth hook**: Redirect unauthenticated traffic to `portal.sakura3.id/?redirect_to=…`

---

## 8. Deployment

```bash
npm run deploy:staging   # → community-veryresto → portal.sr3.my.id
npm run deploy:prod      # → portal-sakura3 → portal.sakura3.id
```

**Build note**: Vite injects `VITE_SUPABASE_URL` and similar vars **at build time** into the static bundle. If you update `.env` without rebuilding and redeploying, the running app still uses the old compiled values. See [L7 in LESSONS_LEARNED.md](./LESSONS_LEARNED.md) for the full gotcha.

**Docker**: Static build (React + Vite) served via nginx. See `nginx.conf` and `Dockerfile`.

**Machine spec**: Fly.io Singapore region. Auto-stop/start enabled.
