# Community Portal — Lessons Learned

Distilled operational lessons from implementation phases, staging migrations, and production incidents. Each lesson includes the root cause, fix applied, and the rule to not repeat it.

---

## L1 — Silent Cookie Truncation (4KB Browser Limit)

**Source**: Implementation Phase 1

### What Happened

After Google OAuth completed successfully, users were stuck in an infinite unauthenticated loop. The browser appeared to accept the login but immediately treated them as logged out.

### Root Cause

Supabase sessions include a large nested `user` object with metadata, `app_metadata`, and `user_metadata`. Combined with the JWT and refresh token, the serialized session exceeded **4KB** — the hard per-domain cookie size limit enforced by modern browsers. The browser silently rejected the cookie write, leaving no error in the console.

### Fix

`CookieStorage.setItem()` strips the `user` object before writing — only `access_token`, `refresh_token`, `expires_at`, `expires_in`, `token_type` are stored (~1.5KB). `CookieStorage.getItem()` reconstructs the `user` object on read by decoding JWT claims from the `access_token`.

### Rule

> **Never store the full Supabase session object in a cookie.** Strip to token fields only. Always reconstruct `user` from the JWT at read time.

---

## L2 — Google OAuth Redirect Whitelist

**Source**: Implementation Phase 1

### What Happened

Local development logins (`http://portal.localtest.me:5173/`) completed the Google OAuth flow but redirected users to the **production site** instead of localhost.

### Root Cause

Supabase rejects OAuth callback redirect URLs that are not explicitly whitelisted in the Supabase Dashboard under **Authentication → URL Configuration → Redirect URLs**. When the local URL was absent, Supabase fell back to the configured Site URL (production).

### Fix

Whitelist all local dev subdomains in Supabase Dashboard alongside production:
- `http://portal.localtest.me:5173/`
- `http://ipl-finder.localtest.me:8080/`
- `https://portal.sakura3.id/`

### Rule

> **When adding a new environment or a new app's OAuth callback**, always update the Supabase redirect URL allowlist before testing authentication.

---

## L3 — Permissions Loading Race Condition

**Source**: Implementation Phase 2

### What Happened

After login, users were briefly redirected back to the portal even though their account was approved. The redirect loop stopped after a page refresh.

### Root Cause

When a consumer app mounts, the Supabase `user` object resolves first. In the single render frame where `user` is valid but the `usePermissions` DB query is still in-flight, `approval_status` evaluates to `undefined` (falsy). The app triggered the "not approved" redirect before the query completed.

### Fix

`usePermissions` returns a `resolvedUserId` state variable. Consumer apps must verify `resolvedUserId === user.id` before executing automatic redirect logic — this ensures timing parity between the session and permission states.

### Rule

> **Never redirect on `approval_status` until `resolvedUserId` equals `user.id`.** A missing permission state means "still loading" — not "denied."

---

## L4 — Vite `allowedHosts` for Custom Domains

**Source**: Local development setup

### What Happened

Accessing the Vite dev server via `http://portal.localtest.me:5173` returned a **403 Forbidden** from Vite itself, not the app.

### Root Cause

Vite's default dev server blocks requests from hosts other than `localhost` and `127.0.0.1` as a security measure.

### Fix

Add custom domains to `server.allowedHosts` in each project's `vite.config.ts`:

```typescript
server: {
  allowedHosts: ['portal.localtest.me', 'ipl-finder.localtest.me', ...]
}
```

### Rule

> **Any new app using a custom domain in local development must add that domain to `vite.config.ts` → `server.allowedHosts`.**

---

## L5 — macOS mDNSResponder Negative DNS Cache

**Source**: Production domain setup

### What Happened

After configuring a new production domain (e.g. `portal.sakura3.id`) on Fly.io and verifying DNS propagation globally, the macOS machine still could not reach the domain for up to 1 hour.

### Root Cause

macOS's `mDNSResponder` caches negative DNS lookups (NXDOMAIN) for up to 3,600 seconds. If you tried to resolve the domain *before* DNS propagated, the negative result was cached and persisted even after DNS became globally available.

### Fix

```bash
sudo killall -HUP mDNSResponder
```

### Rule

> **When setting up a new custom domain, flush the macOS DNS cache immediately after DNS propagates.** Do not trust the local resolver for up to an hour after a domain goes live.

---

## L6 — Staging Supabase Migration: CLI History Conflict

**Source**: Staging environment migration to new Supabase project (Aug 2026)

### What Happened

Running `npx supabase db push` against the new staging Supabase project returned:
```
ERROR: relation "profiles" already exists (SQLSTATE 42P07)
```

### Root Cause

The new Supabase project was initialized by Lovable Cloud's default setup, which created some standard tables. However, the Supabase CLI's migration history table (`supabase_migrations.schema_migrations`) was empty — so the CLI tried to replay all migrations from the beginning, causing table collisions.

### Fix

Mark all local migrations as already applied **without re-running them**:

```bash
npx supabase migration repair --status applied
```

This syncs the CLI history with the actual database state without wiping existing tables or data.

### Rule

> **When connecting the Supabase CLI to a database that was initialized outside the CLI (e.g. Lovable, dashboard), always run `migration repair --status applied` first.** Never `db reset` if you have live data to preserve.

---

## L7 — Staging Supabase Migration: Vite Stale Bundle

**Source**: Staging environment migration (Aug 2026)

### What Happened

After migrating the staging environment to a new Supabase project and updating `.env` credentials, the portal UI continued writing data to the **old** Supabase project. Role assignments and approvals appeared to succeed but had no effect on the new database.

### Root Cause

Vite **bakes environment variables into the static JS bundle at build time**. Updating `.env` locally does not affect the already-deployed bundle. The staging app was running a stale bundle compiled against the old `VITE_SUPABASE_URL`.

### Fix

Rebuild and redeploy after any credential change:
```bash
npm run deploy:staging
```

Additionally, existing users must **log out and log back in** to invalidate old session JWTs (signed with the old project's JWT secret) and receive fresh tokens from the new project.

### Rule

> **After changing any `VITE_*` environment variable on a deployed app, always rebuild and redeploy.** The running bundle is compiled against the values at the time of the last build — there is no runtime reload.

---

## L8 — Staging Supabase Migration: Storage RLS Not Copied

**Source**: Staging environment migration (Aug 2026)

### What Happened

After migrating to the new staging Supabase project, authenticated users with upload permissions received `400 Bad Request` errors when trying to upload files to the `text-files` storage bucket.

### Root Cause

The database cloning process copied tables in the `public` schema, but **RLS policies on the `storage` schema were not migrated**. Since RLS was enabled on the bucket with no policies, Supabase Storage blocked all writes by default (fail-closed).

### Fix

Created migration `20260729000000_recreate_storage_policies.sql` to reconstruct storage RLS:
- `SELECT` policy for approved readers (`ipl_finder.read_files`)
- `INSERT` policy for authorized uploaders (`ipl_finder.upload_files`)
- `DELETE` policy for uploaders and admins

```bash
SUPABASE_ACCESS_TOKEN=<token> npx supabase db push
```

### Rule

> **When migrating a Supabase project, `storage` schema RLS policies are NOT copied by default.** Always explicitly re-create storage bucket policies in a dedicated migration file after any project migration.

---

## L9 — Cookie Name Must Never Change

**Source**: "Community Platform → Community Portal" rename spec (Aug 2026)

### What Happened

During a terminology rename across the codebase (Community Platform → Community Portal), there was a question about whether to rename the cookie from `sakura3-auth` to something matching the new branding.

### Why It Cannot Change

Changing the `sakura3-auth` cookie name would **immediately invalidate all active sessions** across every ecosystem app simultaneously. Every logged-in user across all environments — staging and production — would be forced to re-authenticate. The change would need to be deployed in **perfect lockstep** across every app, which is operationally impossible without downtime.

### Rule

> **The `sakura3-auth` cookie name is a cross-app contract. It must never be changed without a coordinated, synchronized breaking-change deployment across all ecosystem apps.** Treat it as an immutable API surface.

---

## L10 — Database Values Stay in English; UI via `t()`

**Source**: Localization & terminology refinement (Aug 2026)

### The Principle

When the portal was localized to Bahasa Indonesia, a key design decision was made: **internal database enum values must remain in language-neutral English**, while all user-facing labels are loaded from the translation dictionaries via `t('key')`.

### Why

- Database values are referenced in RLS policies, triggers, application code across multiple repos, and third-party integrations. Renaming them requires coordinated schema migrations.
- UI labels change frequently (wording improvements, localization). They must be updatable without touching the database or any backend code.

### Example

```
Database value (immutable): "household_member"
Indonesian UI label (via t()): "Anggota Keluarga Serumah"
English UI label (via t()):   "Household Member"
```

### Rule

> **Never expose raw database enum values in the UI.** Always route through `t('key.path')`. Never localize database column values, permission names, application slugs, or role names.
