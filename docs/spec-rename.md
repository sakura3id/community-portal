# Spec: Rename Community Platform → Community Portal

## Goal

Rename all **user-facing** and **internal application naming** from **Community Platform** to **Community Portal**.

This is a terminology refactor only.

The application behavior, authentication, RBAC, database schema, APIs, and routing must remain functionally identical.

Repository rename will be performed later manually and is **NOT** part of this task.

---

# Objectives

Standardize terminology across the codebase.

Current terminology:

- Community Platform
- community-platform
- COMMUNITY_PLATFORM
- communityPlatform

New terminology:

- Community Portal
- community-portal
- PORTAL
- portal

---

# Primary Changes

## Environment Variables

Rename every environment variable that refers to Community Platform.

Examples:

```
VITE_COMMUNITY_PLATFORM_URL
```

↓

```
VITE_PORTAL_URL
```

Likewise:

```
COMMUNITY_PLATFORM_URL
```

↓

```
PORTAL_URL
```

Update:

- frontend
- backend
- build configs
- deployment configs
- examples
- documentation
- README
- comments

Do not leave compatibility aliases unless absolutely required.

---

## Internal Constants

Rename variables.

Examples

```
communityPlatformUrl
```

↓

```
portalUrl
```

```
communityPlatformOrigin
```

↓

```
portalOrigin
```

```
communityPlatformHost
```

↓

```
portalHost
```

```
communityPlatformRedirect
```

↓

```
portalRedirect
```

---

## User Facing Strings

Rename:

```
Community Platform
```

↓

```
Community Portal
```

Examples:

```
Go back to Community Platform
```

↓

```
Return to Community Portal
```

```
Redirecting to Community Platform...
```

↓

```
Redirecting to Community Portal...
```

---

## Documentation

Rename terminology in:

- README
- docs/
- architecture docs
- AGENTS.md
- onboarding docs
- comments where appropriate

Examples

```
Community Platform Architecture
```

↓

```
Community Portal Architecture
```

---

## Configuration

Rename configuration keys where appropriate.

Example

```
communityPlatformUrl
```

↓

```
portalUrl
```

---

# Redirect Logic

Current logic should remain identical.

Example

```
window.location.replace(portalUrl)
```

should still perform exactly the same redirect as before.

Only variable names change.

---

# Do NOT Change

The following are architectural concepts and must remain unchanged.

## Database

Do NOT rename:

- applications
- app_roles
- app_permissions
- user_app_roles
- user_roles
- profiles

Do NOT rename any:

- tables
- columns
- migrations
- SQL functions
- RPC names
- triggers

---

## Permission Names

Do NOT rename

```
ipl_finder.read_files
```

```
rekap_viewer.read_data
```

etc.

---

## Cookie Name

Keep

```
sakura3-auth
```

unchanged.

Reason:

Changing the cookie name would invalidate all existing sessions and require coordinated deployment across the ecosystem.

---

## Auth Storage Key

Keep

```
sakura3-auth
```

unchanged.

---

## API Routes

Do not rename endpoints.

Example

```
/api/*
```

must remain identical.

---

## Route Structure

Do not change routes unless they literally contain "community-platform".

Example

```
/admin
```

must remain

```
/admin
```

---

## Database Seed Data

Do not rename:

- application slugs
- permission namespaces
- RBAC names

unless they literally contain "community-platform".

---

## Authentication

No authentication behavior changes.

No session changes.

No OAuth changes.

No redirect behavior changes.

---

## Business Logic

There must be zero behavior changes.

No refactoring beyond naming.

No optimization.

No cleanup unrelated to this task.

---

# Search Targets

The agent should search for at least the following:

```
Community Platform
community platform

community-platform
community_platform

COMMUNITY_PLATFORM

communityPlatform

communityPlatformUrl

communityPlatformURL

communityPlatformOrigin

communityPlatformHost

communityPlatformRedirect

COMMUNITY_PLATFORM_URL

VITE_COMMUNITY_PLATFORM_URL
```

Rename every legitimate occurrence.

---

# Validation Checklist

After completing the refactor:

- All tests still pass.
- Project builds successfully.
- No TypeScript errors.
- No lint errors.
- No broken imports.
- No broken redirects.
- No references to `VITE_COMMUNITY_PLATFORM_URL`.
- No references to `COMMUNITY_PLATFORM_URL`.
- No references to `communityPlatformUrl`.
- Documentation updated.
- Environment examples updated.
- Deployment configs updated.

---

# Deliverables

Provide:

1. Summary of renamed files.
2. List of renamed environment variables.
3. Any manual follow-up steps required.
4. Confirmation that:
   - cookie name remains `sakura3-auth`
   - auth storage key remains `sakura3-auth`
   - database schema was untouched
   - routes and APIs were untouched
   - only terminology was changed