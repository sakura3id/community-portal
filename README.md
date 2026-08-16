# Community Portal

The **Sakura 3 Identity Portal** — the centralized authentication and identity management hub for the Sakura 3 resident ecosystem.

**Live:** [portal.sakura3.id](https://portal.sakura3.id)  
**GitHub:** [sakura3id/community-portal](https://github.com/sakura3id/community-portal)

---

## What This Is

This is the **single sign-on portal** for all Sakura 3 resident applications. It is the only app in the ecosystem that handles Google OAuth and manages resident identity. Other resident apps (IPL Finder, Rekap Viewer, etc.) redirect here to authenticate and share the session via a cross-subdomain cookie.

### Key Responsibilities

- **Google OAuth sign-in** — the only OAuth entry point in the ecosystem
- **Resident approval workflow** — new accounts go through admin review before access is granted
- **Role & permission management** — admins assign app-level roles to residents via the Admin Center
- **Session propagation** — sets the `sakura3-auth` cookie on `.sakura3.id` so all subdomains share the same session

### Environments & Domains

The platform supports local development, staging, and production environments across the following domains:

| Environment | Base Domain | Portal URL | IPL Finder URL | Rekap Viewer URL |
| :--- | :--- | :--- | :--- | :--- |
| **Local Development** | `*.localtest.me` | `http://portal.localtest.me:5173` | `http://ipl-finder.localtest.me:8080` | `http://rekap.localtest.me:3000` |
| **Staging** | `*.sr3.my.id` | `https://portal.sr3.my.id` | `https://ipl-finder.sr3.my.id` | `https://rekap.sr3.my.id` |
| **Production** | `*.sakura3.id` | `https://portal.sakura3.id` | `https://ipl-finder.sakura3.id` | `https://rekap.sakura3.id` |

---

## For Resident Developers

If you are building a new app that should authenticate using this portal, read the integration docs:

| Document | Description |
|---|---|
| [Architecture Reference](./docs/ARCHITECTURE.md) | Internal developer reference — DB schema, RBAC, RLS policies, session architecture, app registration |
| [Lessons Learned](./docs/LESSONS_LEARNED.md) | Operational lessons — cookie truncation, OAuth redirects, race conditions, staging migration gotchas |
| [Auth Integration Guide](./docs/auth-integration-guide.md) | Start here for integrating a new app — overview, app registration, quick reference |
| [Sakura 3 Identity Protocol](./docs/sakura3-identity-protocol.md) | Platform-agnostic auth contract (cookie, redirect, approval, RBAC specs) |
| [React + Vite Implementation](./docs/auth/react-vite.md) | Reference implementation for React/Vite apps |
| [Node.js + Express Implementation](./docs/auth/node-express.md) | Reference implementation for Express backends |
| [Next.js Implementation](./docs/auth/nextjs.md) | Stub — contributions welcome |
| [Laravel Implementation](./docs/auth/laravel.md) | Stub — contributions welcome |
| [Go + Fiber Implementation](./docs/auth/go-fiber.md) | Stub — contributions welcome |

---

## Tech Stack

- **Framework:** React 19 + Vite
- **Language:** TypeScript
- **Auth & Database:** Supabase (Google OAuth, PostgreSQL, Row Level Security)
- **Deployment:** Fly.io (Singapore region), served via nginx
- **Icons:** Lucide React

---

## Localization & i18n

The platform features a lightweight path-based internationalization (i18n) layer to translate all user-facing UI copy dynamically.

- **Default Language:** Bahasa Indonesia (`id`), with English (`en`) as the development reference and fallback.
- **Strict Separation of Concerns**: 
  - **Internal Domain Values** (database-level representation: `resident`, `non_resident`, `owner`, `renter`, `household_member`, `caretaker`, etc.) must remain stable and in language-neutral English.
  - **UI Labels**: All visible user interface text, dropdown options, and descriptions are loaded from the translation dictionaries using `t('key.path')` lookups.
- **Translation Files**:
  - [id.json](./src/locales/id.json) — Indonesian dictionary.
  - [en.json](./src/locales/en.json) — English dictionary.

---

## Local Development

### Prerequisites

- Node.js 18+
- Access to the shared Supabase project credentials (ask the platform admin)

### Setup

```bash
git clone https://github.com/sakura3prog/community-portal.git
cd community-portal
npm install
cp .env.example .env
# Fill in your Supabase credentials in .env
```

### Running the Dev Server

```bash
npm run dev
```

For cross-subdomain session sharing with other local apps, access the portal via:

```
http://portal.localtest.me:5173
```

All `*.localtest.me` subdomains resolve to `127.0.0.1` automatically — no `/etc/hosts` setup required.

### Other Commands

```bash
npm run build    # Production build
npm run lint     # ESLint
npm run preview  # Preview production build locally
```

---

## Environment Variables

See [`.env.example`](./.env.example) for all required variables.

```env
VITE_SUPABASE_URL="https://your-supabase-project.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-supabase-anon-key"

# Ecosystem app URLs (used for portal hub directory links)
VITE_IPL_FINDER_URL="https://ipl-finder.sakura3.id"
VITE_REKAP_VIEWER_URL="https://rekap.sakura3.id"
```

---

## Deployment

Deployed to Fly.io via Docker + nginx.

### Deploy Staging (`sr3.my.id`)
```bash
npm run deploy:staging
```
Config: [`fly.toml`](./fly.toml) — app name `community-veryresto` (routes to `portal.sr3.my.id`).

### Deploy Production (`sakura3.id`)
```bash
npm run deploy:prod
```
Config: [`fly.production.toml`](./fly.production.toml) — app name `portal-sakura3`.

---

## Project Structure

```
community-portal/
  src/
    components/
      LoginScreen.tsx           # Google sign-in UI
      PendingApprovalScreen.tsx # Waiting room + profile info collection
      RejectedScreen.tsx        # Access denied screen
      EcosystemLandingScreen.tsx# App hub directory (post-approval)
      AdminDashboardScreen.tsx  # Governance center for admins/verifiers
    hooks/
      useAuth.tsx               # Auth context (session, signInWithGoogle, signOut)
      usePermissions.tsx        # Approval status + platform roles
    lib/
      i18n.ts                   # Core path-based translation helper t()
      supabase.ts               # Supabase client with cross-subdomain CookieStorage
    locales/
      id.json                   # Indonesian translation dictionary
      en.json                   # English fallback translation dictionary
  supabase/
    migrations/                 # Database schema and RLS policies
    functions/                  # Supabase Edge Functions
  docs/
    sakura3-identity-protocol.md  # Platform-agnostic auth contract
    auth-integration-guide.md       # Developer integration index
    auth/                           # Per-stack reference implementations
```
