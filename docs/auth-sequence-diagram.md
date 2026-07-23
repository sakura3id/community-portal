# Sakura 3 Authentication Sequence Diagrams

This document visualizes the authentication and authorization flow across the Sakura 3 ecosystem, as specified in the [Sakura 3 Identity Protocol](./sakura3-identity-protocol.md).

It details how the **Community Portal** acting as the central Identity Provider (IdP) interacts with **Ecosystem Apps** (like IPL Finder, Rekap, etc.), **Supabase**, and the **Google OAuth** provider.

---

## 1. Initial Authentication & Cross-App Redirection
This flow describes what happens when an unauthenticated user visits an ecosystem app (e.g., `ipl-finder.sakura3.id`) and is redirected to the Portal for Google Sign-In before being returned to the app.

```mermaid
sequenceDiagram
    autonumber
    actor User as User Browser
    participant App as Ecosystem App<br/>(e.g., IPL Finder)
    participant Portal as Community Portal<br/>(portal.sakura3.id)
    participant Supabase as Supabase Auth & DB
    participant Google as Google Identity Provider

    User->>App: Visit App page (e.g., /dashboard)
    App->>App: Check for 'sakura3-auth' cookie
    Note over App: Cookie is missing or expired
    App->>User: Redirect to Portal with return URL<br/>(?redirect_to=https://ipl-finder.sakura3.id/dashboard)
    
    User->>Portal: Request Portal login screen
    Portal->>Portal: Validate redirect_to origin against ALLOWED_ORIGINS
    
    alt Origin is allowed
        Portal->>Portal: Store redirect_to in sessionStorage ('oauth_redirect_to')
        Portal->>User: Render Login Screen (Sign in with Google)
        
        User->>Portal: Click "Sign in with Google"
        Portal->>Supabase: Initiate OAuth Sign-In (signInWithOAuth)
        Supabase-->>Portal: Return Google OAuth URL
        Portal->>User: Redirect to Google
        
        User->>Google: Authenticate & Authorize
        Google-->>Portal: Redirect back to Portal callback with auth code
        Portal->>Supabase: Exchange auth code for session
        Supabase-->>Portal: Return session object (Tokens + User details)
        
        Portal->>Portal: Strip large metadata (retains only token fields)<br/>to prevent cookie truncation
        Portal->>User: Write 'sakura3-auth' cookie to shared domain<br/>(.sakura3.id or .localtest.me)
        
        Portal->>Supabase: Check user profile approval status
        Supabase-->>Portal: Return profile (approval_status = 'approved')
        
        Portal->>Portal: Retrieve return URL from sessionStorage
        Portal->>User: Redirect back to return URL (window.location.replace)
        
        User->>App: Request App page (sends 'sakura3-auth' cookie)
        App->>App: Parse 'sakura3-auth' cookie (Extract access_token)
        App->>Supabase: Verify access_token (supabase.auth.getUser)
        Supabase-->>App: Return verified User claims
        
        App->>Supabase: Query user's approval_status
        Supabase-->>App: Return 'approved'
        
        App->>User: Render App Dashboard (Access Granted)
    else Origin is not allowed
        Portal->>Portal: Drop redirect_to parameter
        Portal->>User: Render Portal Landing page
    end
```

### Flow Highlights
1. **Redirect Allowlist Gate:** The Portal checks if the `redirect_to` origin is registered in `ALLOWED_ORIGINS` in [App.tsx](../src/App.tsx). Unregistered origins are ignored for security.
2. **Session Storage Persistence:** The callback URL is saved in the browser's `sessionStorage` because the OAuth redirection loop with Google wipes the query parameters.
3. **Cookie Strip Down:** The Portal custom `CookieStorage` (see [supabase.ts](../src/lib/supabase.ts)) strips down the Supabase session payload. It stores only the JWT and refresh token, keeping the cookie size well below the 4KB limit.
4. **App Verification Gate:** The target App reads the cookie, validates the JWT with Supabase, and checks the database for `approval_status = 'approved'`.

---

## 2. Silent Single Sign-On (SSO)
Once a user is logged in, they can access any other ecosystem app (e.g., `rekap.sakura3.id`) without seeing the login prompt or being redirected. This is achieved via shared cookie domain routing.

```mermaid
sequenceDiagram
    autonumber
    actor User as User Browser
    participant App as Ecosystem App<br/>(e.g., Rekap)
    participant Supabase as Supabase Auth & DB

    User->>App: Visit App page
    Note over User, App: Browser automatically sends 'sakura3-auth' cookie<br/>because the domain attribute is '.sakura3.id'
    
    App->>App: Read & JSON-parse 'sakura3-auth' cookie
    App->>Supabase: Validate access_token (supabase.auth.getUser)
    Supabase-->>App: Token valid (Return User claims)
    
    App->>Supabase: Query user profiles.approval_status
    Supabase-->>App: Return 'approved'
    
    App->>User: Render App Interface (Access Granted instantly)
```

### Flow Highlights
- **No Redirect Loop:** The user is logged in seamlessly.
- **Shared Cookie Domain:** The browser attaches the cookie automatically because the Portal set the cookie domain to `.sakura3.id` (or `.localtest.me` in local dev).

---

## 3. Session Expiration & Silent Refresh
Supabase JWT access tokens typically expire in 1 hour. This diagram shows how the client library silently refreshes the session behind the scenes without user intervention.

```mermaid
sequenceDiagram
    autonumber
    actor User as User Browser
    participant App as Ecosystem App
    participant Supabase as Supabase Auth

    User->>App: User interacts with App / API request
    App->>App: Supabase client detects access_token is expired or near expiry
    
    App->>Supabase: POST /auth/v1/token?grant_type=refresh_token<br/>(Sends refresh_token from cookie)
    Supabase-->>App: Return new session object (New access & refresh tokens)
    
    App->>App: CookieStorage.setItem() called with new session
    App->>User: Update 'sakura3-auth' cookie with new tokens
    App->>User: Process and complete original user action
```

### Flow Highlights
- **Background Refresh:** The official Supabase JS SDK (configured with `autoRefreshToken: true` and our custom `CookieStorage`) intercepts expired tokens and fetches new ones before making any database queries.
- **Shared Session Update:** Since the App writes the refreshed session back to the `.sakura3.id` cookie, other ecosystem apps instantly receive the updated session too.

---

## 4. Intercepting Pending / Rejected Users
If a user is authenticated but their registration is still pending review or has been rejected/suspended, they must be prevented from accessing ecosystem apps.

```mermaid
sequenceDiagram
    autonumber
    actor User as User Browser
    participant App as Ecosystem App
    participant Portal as Community Portal
    participant Supabase as Supabase Auth & DB

    User->>App: Visit App page
    App->>App: Detect no cookie or expired session
    App->>User: Redirect to Portal (?redirect_to=...)
    
    User->>Portal: Request Login Screen
    Portal->>Supabase: Get current session (or perform Google login)
    Supabase-->>Portal: Active Session found
    
    Portal->>Supabase: Query public.profiles.approval_status
    Supabase-->>Portal: Returns 'pending', 'rejected', or 'suspended'
    
    alt Status is 'pending'
        Portal->>User: Render PendingApprovalScreen (Access blocked)
    else Status is 'rejected' or 'suspended'
        Portal->>User: Render RejectedScreen (Access blocked)
    end
```

### Flow Highlights
- **Portal Gatekeeper:** The Portal blocks the redirection if the user profile is not `approved`. The user is stuck in the "Waiting Room" or "Rejected" screen.
- **App Gatekeeper (Secondary Layer):** Even if a user bypasses the Portal redirect somehow, the Ecosystem App queries `approval_status` directly. If the status is not `approved`, the App blocks access independently.

---

## Related Documents
- [Sakura 3 Identity Protocol](./sakura3-identity-protocol.md) - Platform-agnostic technical specification of the shared identity design.
- [Auth Integration Guide](./auth-integration-guide.md) - Guide for resident developers to integrate their applications.
- [React + Vite Auth Integration](./auth/react-vite.md) - Detailed guide for React/Vite/TypeScript stack integrations.
