# Community Portal — Project Steering

## What This Is

The **Sakura 3 Identity Portal** — the centralized SSO and identity management hub for the Sakura 3 residential community ecosystem. It is the sole OAuth entry point: residents authenticate here via Google OAuth, and sessions propagate to sibling apps (IPL Finder, Rekap Viewer, Community Docs) through a cross-subdomain `sakura3-auth` cookie on `.sakura3.id`.

- **Product name:** Sakura 3 / Community Portal
- **Tagline:** Community Portal (portal subtitle in UI)
- **Live URL:** https://portal.sakura3.id
- **Repo:** sakura3id/community-portal

## Core Responsibilities

1. **Google OAuth sign-in** — the only authentication gateway for the ecosystem.
2. **Resident approval workflow** — new accounts pass through admin/verifier review before gaining access.
3. **Role & permission management** — admins assign platform roles (`admin`, `resident_verifier`, `platform_moderator`) and per-app RBAC.
4. **Session propagation** — sets the `sakura3-auth` cookie scoped to the relevant domain (`.sakura3.id`, `.sr3.my.id`, `.localtest.me`).

## Tech Stack

- **Framework:** React 19 + Vite 8
- **Language:** TypeScript 6
- **Auth & DB:** Supabase (Google OAuth, PostgreSQL, RLS)
- **Deployment:** Fly.io (Singapore), nginx static serving via Docker
- **Icons:** Lucide React
- **Fonts:** Inter (sans), JetBrains Mono (mono) — loaded from Google Fonts

## Visual Identity & Design Tokens

All values live in `src/index.css` as CSS custom properties. The system supports light and dark mode via `prefers-color-scheme`.

### Color Palette (Light / Dark)

| Token | Light | Dark |
|---|---|---|
| `--bg-primary` | `hsl(210 20% 98%)` | `hsl(222 47% 6%)` |
| `--bg-secondary` | `hsl(0 0% 100%)` | `hsl(222 47% 8%)` |
| `--text-primary` | `hsl(220 20% 10%)` | `hsl(210 40% 98%)` |
| `--text-secondary` | `hsl(220 20% 20%)` | `hsl(215 20% 65%)` |
| `--text-muted` | `hsl(220 10% 46%)` | `hsl(215 15% 50%)` |
| `--border-color` | `hsl(220 13% 91%)` | `hsl(217 32% 17%)` |
| `--primary` | `hsl(217 91% 50%)` | `hsl(217 91% 60%)` |
| `--primary-hover` | `hsl(217 91% 40%)` | `hsl(217 91% 50%)` |
| `--success` | `hsl(142 71% 45%)` | same |
| `--pending` | `hsl(38 92% 50%)` | same |
| `--error` | `hsl(0 84% 60%)` | `hsl(0 62% 50%)` |
| `--verifier` | `hsl(262 83% 58%)` | `hsl(262 83% 68%)` |

### Typography

- `--font-sans`: 'Inter', system-ui, -apple-system, sans-serif
- `--font-mono`: 'JetBrains Mono', monospace
- Headings: `font-weight: 600–700`, `letter-spacing: -0.025em` to `-0.04em`
- Body: `line-height: 1.6`, sizes 13–15px

### Spacing & Radii

| Token | Value |
|---|---|
| `--card-radius` | `12px` |
| `--button-radius` | `8px` |
| `--input-radius` | `12px` |
| `--tab-bar-height` | `64px` |
| `--header-height` | `56px` |
| Auth card radius | `24px` |

### Shadows

| Token | Purpose |
|---|---|
| `--shadow-sm` | Subtle lift |
| `--shadow-md` | Medium elevated card |
| `--shadow-lg` | Prominent float |
| `--shadow-card` | Mobile card base |
| `--shadow-elevated` | Bottom sheet, modals |

### Glassmorphism

Cards and auth surfaces use the `.glassmorphic` class:
- `backdrop-filter: blur(20px) saturate(180%)`
- `background: var(--glass-bg)` (semi-transparent)
- `border: 1px solid var(--glass-border)`

### Animation Patterns

- Entry: `fadeIn` (0.6s) / `slideUp` (0.6s) with `cubic-bezier(0.16, 1, 0.3, 1)`
- Glow accents: large radial gradients with `float` animation (20–25s alternate)
- Button hover: `translateY(-1px)` with shadow grow
- Mobile interactions: `scale(0.97)` on `:active`
- Reduced motion: All animations collapse to 0.01ms duration

## Architecture & Data Flow

### App State Machine (src/App.tsx)

```
User not logged in → LoginScreen
User logged in + rejected/suspended → RejectedScreen
User logged in + not approved → PendingApprovalScreen
User logged in + approved + redirect_to param → Redirect to origin app
User logged in + approved → EcosystemLandingScreen (MobileEcosystemPortal)
```

### Key Modules

| File | Responsibility |
|---|---|
| `src/lib/supabase.ts` | Supabase client with CookieStorage (cross-subdomain session) |
| `src/hooks/useAuth.tsx` | AuthProvider context: session state, signInWithGoogle, signInAsDemo, signOut |
| `src/hooks/usePermissions.tsx` | Approval status, roles (admin/verifier/moderator), permission flags |
| `src/hooks/useDemoMode.tsx` | Demo account detection (read-only mode) |
| `src/lib/i18n.ts` | Path-based translation helper `t('key.path')` with variable interpolation |
| `src/lib/analytics.ts` | Event tracking via Supabase `analytics_events` table |
| `src/lib/masking.ts` | Data masking utilities |
| `src/constants/affiliations.ts` | Non-resident affiliation types (secretariat, security, vendor, assistant) |

### Database Entities (Supabase)

- `profiles` — user identity (house_number, approval_status, participant_type, resident_subtype, whatsapp_number, requested_affiliation, last_active_at)
- `user_roles` — platform roles (admin, resident_verifier, platform_moderator)
- `user_permissions` — legacy permission flags (read_files, upload_files, rejected)
- `applications` — registered ecosystem apps
- `app_roles` — role templates per application
- `user_app_roles` — per-user per-app role assignments
- `houses` — house registry
- `profile_house_affiliations` — many-to-many between profiles and houses (affiliation_type, is_primary)
- `governance_events` — audit log (actor, target, action, reason, metadata)
- `analytics_events` — event telemetry

### Approval Statuses

`unsubmitted` → `pending` → `approved` | `rejected` | `suspended`

### Participant Types & Subtypes

- **Resident** subtypes: `owner`, `renter`, `household_member`
- **Non-Resident** affiliations: `secretariat`, `security`, `vendor`, `assistant`
- **Caretaker** — assigned when non-resident has a house affiliation

## Localization

- Default: Bahasa Indonesia (`id`), fallback: English (`en`)
- Dictionary files: `src/locales/id.json`, `src/locales/en.json`
- Usage: `t('key.path')` with optional `{variable}` interpolation
- Internal domain values (database enums) stay in language-neutral English
- All user-facing text uses translation keys

## UI Structure (Mobile-First)

The portal uses a mobile-first shell with bottom tab navigation for governance screens:

| Tab | Component | Visibility |
|---|---|---|
| Hub | `MobileHubScreen` | All approved users |
| Approvals | `MobileApprovalsScreen` | Admin/Verifier |
| Roles | `MobileRolesScreen` | Admin |
| App RBAC | `MobileAppRbacScreen` | Governance managers |
| Logs | `MobileLogsScreen` | Governance managers |

### Component Patterns

- Container: `.mobile-app-shell` (max-width 600px, 960px at tablet)
- Cards: `.card-mobile` with `var(--card-radius)` and `var(--shadow-card)`
- Buttons: `.btn-mobile`, `.btn-mobile-primary`, `.btn-mobile-danger`
- Search: `.search-bar-mobile` with icon and clear button
- Badges: `.badge-mobile` with semantic color variants
- Bottom sheet: `.bottom-sheet-container` with drag handle
- Loading: `.skeleton-mobile` shimmer animation
- Glassmorphic surfaces: `.glassmorphic` on auth cards and elevated panels

## Ecosystem Apps (Sibling Services)

| App | Slug | Description |
|---|---|---|
| IPL Finder | `ipl_finder` | Bank e-statement search, CSV record indexing, document audit trail |
| Rekap Viewer | `rekap_viewer` | Fly.io cached backend for Sheets logs, reports, community summaries |
| Community Documents | `community_docs` | Governed document access, handbook, meeting records |
| Kas Management | `kas_management` | Treasury cashbook, billing tracking, balance sheets (planned) |
| Surat Admin | `surat_admin` | Resident correspondence generation, PDF permits (planned) |

## Environments

| Env | Domain | Portal |
|---|---|---|
| Local | `*.localtest.me` | `http://portal.localtest.me:5173` |
| Staging | `*.sr3.my.id` | `https://portal.sr3.my.id` |
| Production | `*.sakura3.id` | `https://portal.sakura3.id` |

## Development

```bash
npm install
cp .env.example .env   # Fill Supabase credentials
npm run dev            # Runs Vite dev server
npm run build          # TypeScript check + Vite production build
npm run lint           # ESLint
npm run deploy:staging # Fly.io staging deploy
npm run deploy:prod    # Fly.io production deploy
```

## Critical Files

| Path | What It Does |
|---|---|
| `src/App.tsx` | Root state machine, redirect validation, allowed origins |
| `src/lib/supabase.ts` | CookieStorage class with cross-subdomain logic |
| `src/hooks/useAuth.tsx` | Auth context provider |
| `src/hooks/usePermissions.tsx` | Permission/approval evaluation with fallback logic |
| `src/index.css` | Full design system (tokens, components, responsive) |
| `src/components/mobile/MobileEcosystemPortal.tsx` | Main portal shell, tab routing, all governance handlers |
| `src/locales/en.json` / `id.json` | Translation dictionaries |
| `supabase/migrations/` | Database schema, RLS policies |
| `supabase/functions/` | Edge Functions (e.g. `predefined-login`) |

## Conventions & Rules

- Use CSS custom properties from `src/index.css` — do not hardcode colors or spacing.
- All user-facing strings go through `t()` with keys in both `en.json` and `id.json`.
- Database enum values stay in English; only UI labels are localized.
- Mobile-first: design for 360px minimum, scale up at 768px.
- Glassmorphism for elevated auth/modal surfaces; flat cards for content.
- Lucide React for all icons — no other icon library.
- Supabase client is singleton from `src/lib/supabase.ts` — import from there.
- Demo mode: check `isDemoMode` before any write operation; demo user gets read-only access to all features.
- Redirect validation: only origins in `ALLOWED_ORIGINS` (App.tsx) can be redirect targets.
- Analytics: use `analytics.track(eventName, properties)` for telemetry events.
- Governance actions must log to `governance_events` via `logGovernanceAction()`.
