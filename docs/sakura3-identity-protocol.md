# Sakura 3 Identity Protocol

> **Version:** 1.0  
> **Status:** Active  
> **Scope:** All applications in the `sakura3.id` ecosystem

This document is a **platform-agnostic specification**. It defines the contracts that every resident application must conform to in order to participate in the shared Sakura 3 identity system. It makes no assumption about your programming language, runtime, or framework.

For concrete implementation examples, see the [reference implementations](./auth-integration-guide.md). For visual step-by-step sequence diagrams of the flows, see the [Authentication Sequence Diagrams](./auth-sequence-diagram.md).

---

## 1. Auth Topology

The Sakura 3 ecosystem uses a **centralized identity provider (IdP)** model.

```
                     ┌──────────────────────────────────────┐
                     │        Supabase Auth Backend          │
                     │  (Google OAuth, JWT issuance, users)  │
                     └──────────────────┬───────────────────┘
                                        │
                     ┌──────────────────▼───────────────────┐
                     │      Community Portal (Identity)      │
                     │      portal.sakura3.id                │
                     │                                       │
                     │  • The only app that initiates OAuth  │
                     │  • Handles approval/rejection flow    │
                     │  • Sets the shared auth cookie        │
                     └───────┬──────────────────┬───────────┘
                             │                  │
               ┌─────────────▼──┐         ┌────▼─────────────┐
               │   App A         │         │   App B           │
               │ ipl-finder.…   │         │ rekap.sakura3.id  │
               │                │         │                   │
               │ reads cookie   │         │ reads cookie      │
               │ checks Supabase│         │ checks Supabase   │
               └────────────────┘         └───────────────────┘
```

**Rules:**
- **The portal is the only OAuth entry point.** Apps never initiate Google sign-in themselves.
- **Apps are read-only consumers of identity.** They never write to `auth.users`.
- **Supabase is the shared backend.** All apps use the same Supabase project URL and anon key.

---

## 2. Cookie Contract

The auth session is propagated via an HTTP cookie set by the portal after successful authentication.

### Cookie Name

```
sakura3-auth
```

All apps **must** use this exact key when reading the session storage. Do not use a different key.

### Cookie Domain

| Environment | Cookie Domain |
|---|---|
| Production | `.sakura3.id` |
| Staging | `.sr3.my.id` |
| Local development | `.localtest.me` |
| Bare `localhost` / IP | Set without a domain attribute (browser default) |

The leading `.` makes the cookie accessible to all subdomains automatically. Your app must configure its Supabase client to read from the same domain.

### Cookie Value Structure

The cookie value is **URL-encoded JSON** representing a minimal session object:

```json
{
  "access_token":  "<Supabase JWT>",
  "refresh_token": "<opaque refresh token>",
  "expires_at":    1234567890,
  "expires_in":    3600,
  "token_type":    "bearer"
}
```

> **Why minimal?** Browser cookies have a 4 KB size limit. The portal intentionally strips the full `user` object from the stored value to avoid truncation. Your app must reconstruct the user object from the JWT claims if needed (see [§6 Session Verification Contract](#6-session-verification-contract)).

### Cookie Attributes

| Attribute | Value |
|---|---|
| `expires` | 30 days from issuance |
| `path` | `/` |
| `SameSite` | `Lax` |
| `Secure` | Set when served over HTTPS |

### Cookie Lifetime

The cookie lives for **30 days**. The Supabase access token (JWT) inside it expires much sooner (typically 1 hour). Apps must use the `refresh_token` to silently obtain a new access token when the JWT expires — the Supabase client library handles this automatically when `autoRefreshToken: true` is configured.

---

## 3. Redirect Contract

### Initiating Authentication

When a user is not authenticated, the app must redirect them to the portal with a return URL:

```
https://portal.sakura3.id/?redirect_to=<URL-encoded return URL>
```

**Example:**
```
https://portal.sakura3.id/?redirect_to=https%3A%2F%2Fipl-finder.sakura3.id%2Fdashboard
```

### Return URL Requirements

- Must be a **full absolute URL**, including scheme and host.
- The origin must be present in the portal's **allowed origins allowlist** (see [§5 App Registration](#5-app-registration)). Unrecognized origins are silently dropped — the user will land on the portal hub instead of being redirected.
- The return URL is preserved in `sessionStorage` on the portal side for the duration of the OAuth flow. After approval, the portal calls `window.location.replace(returnUrl)` to send the user back.

### Post-Authentication Flow

After the portal completes authentication:

1. The `sakura3-auth` cookie is written to `.sakura3.id`.
2. The browser is redirected to the validated `redirect_to` URL.
3. Your app reads the cookie, initializes a Supabase session, and verifies approval status.

### Local Development

During local development, use `localtest.me` subdomains instead of `localhost`. All `*.localtest.me` subdomains resolve to `127.0.0.1` without any `/etc/hosts` configuration:

| Service | Local URL |
|---|---|
| Community Portal | `http://portal.localtest.me:5173` |
| Your App | `http://my-app.localtest.me:<port>` |

The cookie domain becomes `.localtest.me`, preserving the same cross-subdomain sharing behavior as production.

---

## 4. Approval Contract

Authentication (proving identity) and authorization (being allowed access) are **two separate steps**. A user can be authenticated (has a valid session) but not yet approved to use any apps.

### Approval Status

Stored in `public.profiles.approval_status` in the shared Supabase database.

| Status | Meaning | Required App Behavior |
|---|---|---|
| `pending` | New account, awaiting admin review | Deny access. Optionally show a "waiting for approval" message. |
| `approved` | Resident verified by portal admin | Grant access. |
| `rejected` | Account explicitly denied | Deny access. Show a rejection message. |
| `suspended` | Account suspended post-approval | Deny access. Treat as rejected. |

### Approval Check Query

Every app must query the `profiles` table before granting access:

```sql
SELECT approval_status
FROM public.profiles
WHERE id = '<user_id>'
LIMIT 1;
```

**Access is granted only when `approval_status = 'approved'`.**

Apps must not infer approval from the presence of a session alone. A valid JWT does not mean the user is approved.

### Profile Table Schema (relevant fields)

```sql
public.profiles (
  id              UUID PRIMARY KEY,  -- matches auth.users.id
  house_number    TEXT,
  whatsapp_number TEXT,
  approval_status approval_status,   -- enum: pending | approved | rejected | suspended
  last_active_at  TIMESTAMPTZ
)
```

---

## 5. RBAC Contract

Beyond the portal-level approval gate, apps can define their own **fine-grained permissions** using the shared RBAC system.

### Concepts

| Concept | Description |
|---|---|
| **Application** | A registered app with a unique `slug` (e.g., `ipl_finder`) |
| **Permission** | A named capability within an app (e.g., `read_files`, `upload_files`) |
| **App Role** | A named template of permissions (e.g., `resident`, `admin`) |
| **User App Role** | Assignment of an App Role to a specific user |

### Permission Namespace Format

Permissions are referenced in the format:

```
<app_slug>.<permission_name>
```

Examples:
- `ipl_finder.read_files`
- `ipl_finder.upload_files`
- `rekap_viewer.read_data`

### Permission Check Function

The shared Supabase database exposes a security-definer function callable via RPC:

```sql
SELECT public.has_namespaced_permission(
  '<user_uuid>',
  '<app_slug>.<permission_name>'
);
-- Returns: BOOLEAN
```

**Behavior:**
- Returns `TRUE` if the user is a **global admin** (regardless of app-level roles).
- Returns `TRUE` if the user holds an App Role that includes the specified permission.
- Returns `FALSE` otherwise.
- The user must have an **approved** profile — this function checks roles only, not approval status. Check approval separately.

### Global Roles

Some users hold portal-level roles independent of any app:

| Role | Description |
|---|---|
| `admin` | Full portal administrator. Has all permissions in all apps. |
| `resident_verifier` | Can review and approve/reject resident registrations. |
| `platform_moderator` | Can moderate content and users. |

Global roles are stored in `public.user_roles`. Apps may query this table directly if they need to branch on portal-level authority, but most apps should use `has_namespaced_permission` instead.

### App Registration Requirement

To use the RBAC system, your app must be registered in the shared database. This is a one-time setup (see [§ App Registration in the integration guide](./auth-integration-guide.md#registering-your-app)).

---

## 6. Session Verification Contract

This section defines what your app must do to establish a valid, trusted session.

### Step 1: Read the Cookie

Read the raw value of the `sakura3-auth` cookie. URL-decode it, then JSON-parse it to obtain the session object.

### Step 2: Extract the Access Token

The `access_token` field is a standard **Supabase JWT**. Verify it using the Supabase client's `getUser(accessToken)` method, which validates the signature server-side.

Do **not** trust user identity by decoding the JWT locally without server-side validation. Use `getUser()`.

### Step 3: Reconstruct the User Object (if needed)

Because the portal strips the `user` object from the stored cookie value to save space, you must reconstruct it from the JWT payload if your runtime needs user metadata (email, name, etc.) before an API call is possible.

The relevant JWT claims are:

| Claim | Maps to |
|---|---|
| `sub` | `user.id` |
| `email` | `user.email` |
| `aud` | `user.aud` |
| `role` | `user.role` |
| `app_metadata` | `user.app_metadata` |
| `user_metadata` | `user.user_metadata` (name, avatar, etc.) |

### Step 4: Check Approval Status

Query `public.profiles` for `approval_status` as described in [§4](#4-approval-contract). This is a **required step** for all apps. Do not skip it.

### Step 5: Handle Token Expiry

The access token has a short TTL (~1 hour). Use the `refresh_token` to obtain a new one silently. All official Supabase client libraries handle this automatically. If implementing without an official client, call `POST /auth/v1/token?grant_type=refresh_token` with the refresh token.

### Verification Flow Summary

```
Read sakura3-auth cookie
        │
        ▼
Cookie absent? ──────────────────────────────────► Redirect to portal
        │
        ▼
Parse JSON → extract access_token
        │
        ▼
supabase.auth.getUser(access_token)
        │
   error / null? ──────────────────────────────► Redirect to portal
        │
        ▼
Query profiles.approval_status for user.id
        │
   not 'approved'? ────────────────────────────► Show denial screen
        │
        ▼
(Optional) has_namespaced_permission(user_id, 'app.perm')
        │
   false? ─────────────────────────────────────► Show permission denied
        │
        ▼
        ✅ Grant access
```

---

## 7. Security Considerations

- **Never trust the cookie value alone.** Always verify the access token server-side via `getUser()` before granting access to sensitive resources.
- **Never use the service role key in a frontend app.** The anon key is the only key safe for browser/client use.
- **Always check `approval_status`.** A valid session is not sufficient for access.
- **Validate `redirect_to` on the portal side.** The portal's allowlist is the security boundary. Keep it up to date.
- **Do not store user PII from the JWT in your own database** unless necessary for your app's function.
- **Apps must not write to `auth.users` directly.** User lifecycle is managed exclusively through the portal and Supabase Auth.
