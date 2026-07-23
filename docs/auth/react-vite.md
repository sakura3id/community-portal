# Reference Implementation: React + Vite (TypeScript)

> **Stack:** React, Vite, TypeScript, `@supabase/supabase-js`  
> **Protocol:** [Sakura 3 Identity Protocol](../sakura3-identity-protocol.md)

This guide walks through integrating Sakura 3 auth into a React/Vite frontend application.

---

## 1. Install Dependencies

```bash
npm install @supabase/supabase-js
```

---

## 2. Environment Variables

Add to your `.env` file:

```env
VITE_SUPABASE_URL="https://your-supabase-project.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-supabase-anon-key"
VITE_PORTAL_URL="https://portal.sakura3.id"
```

For local development:

```env
VITE_PORTAL_URL="http://portal.localtest.me:5173"
```

---

## 3. Supabase Client with Cookie Storage

Create `src/lib/supabase.ts`. The key requirement is a custom `CookieStorage` class so the client reads from the shared `sakura3-auth` cookie across subdomains.

```typescript
import { createClient } from '@supabase/supabase-js';
import type { SupportedStorage } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Parses the JWT to reconstruct the User object.
// Needed because the portal strips the `user` field from the cookie to stay within 4KB.
const parseJwt = (token: string) => {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(
      decodeURIComponent(
        window.atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
      )
    );
  } catch { return null; }
};

const getCookieDomain = (): string => {
  const h = window.location.hostname;
  if (h.endsWith('.localtest.me') || h === 'localtest.me') return '.localtest.me';
  if (h.endsWith('.sakura3.id') || h === 'sakura3.id') return '.sakura3.id';
  return h;
};

const isLocalHostOrIP = (h: string) =>
  h === 'localhost' || h === '127.0.0.1' || /^\d{1,3}(\.\d{1,3}){3}$/.test(h);

class CookieStorage implements SupportedStorage {
  private domain = getCookieDomain();
  private isLocalOrIP = isLocalHostOrIP(this.domain);

  getItem(key: string): string | null {
    const parts = `; ${document.cookie}`.split(`; ${key}=`);
    if (parts.length !== 2) return null;
    const raw = decodeURIComponent(parts.pop()!.split(';').shift()!);
    try {
      const session = JSON.parse(raw);
      // Reconstruct user from JWT claims if missing (portal strips it to save cookie space)
      if (session?.access_token && !session.user) {
        const payload = parseJwt(session.access_token);
        if (payload) {
          session.user = {
            id: payload.sub, aud: payload.aud, role: payload.role,
            email: payload.email, phone: payload.phone,
            app_metadata: payload.app_metadata || {},
            user_metadata: payload.user_metadata || {},
            created_at: payload.created_at || new Date().toISOString(),
          };
          return JSON.stringify(session);
        }
      }
    } catch { /* non-session value */ }
    return raw;
  }

  setItem(key: string, value: string): void {
    let stored = value;
    try {
      const session = JSON.parse(value);
      if (session?.access_token && session?.refresh_token) {
        // Strip user object — keep cookie under 4KB
        stored = JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at,
          expires_in: session.expires_in,
          token_type: session.token_type || 'bearer',
        });
      }
    } catch { /* non-session, store as-is */ }
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
    const domain = this.isLocalOrIP ? '' : `;domain=${this.domain}`;
    const secure = window.location.protocol === 'https:' ? ';Secure' : '';
    document.cookie = `${key}=${encodeURIComponent(stored)};expires=${expires}${domain};path=/;SameSite=Lax${secure}`;
  }

  removeItem(key: string): void {
    const domain = this.isLocalOrIP ? '' : `;domain=${this.domain}`;
    const secure = window.location.protocol === 'https:' ? ';Secure' : '';
    document.cookie = `${key}=;expires=Thu, 01 Jan 1970 00:00:00 UTC${domain};path=/;SameSite=Lax${secure}`;
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'sakura3-auth',  // ⚠️ Must match the portal's storage key exactly
    storage: new CookieStorage(),
    persistSession: true,
    autoRefreshToken: true,
  },
});
```

---

## 4. Auth Hook

Create `src/hooks/useAuth.tsx`:

```tsx
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

const PORTAL_URL = import.meta.env.VITE_PORTAL_URL || 'https://portal.sakura3.id';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  redirectToPortal: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const redirectToPortal = () => {
    const returnUrl = encodeURIComponent(window.location.href);
    window.location.href = `${PORTAL_URL}/?redirect_to=${returnUrl}`;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, redirectToPortal, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

---

## 5. Approval Status Hook

Create `src/hooks/useApproval.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'suspended' | null;

export function useApproval() {
  const { user } = useAuth();
  const [status, setStatus] = useState<ApprovalStatus>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setStatus(null); setLoading(false); return; }
    supabase
      .from('profiles')
      .select('approval_status')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setStatus((data?.approval_status as ApprovalStatus) ?? 'pending');
        setLoading(false);
      });
  }, [user]);

  return {
    isApproved: status === 'approved',
    isRejected: status === 'rejected' || status === 'suspended',
    isPending: status === 'pending',
    status,
    loading,
  };
}
```

---

## 6. Gating Your App

In your root component:

```tsx
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useApproval } from './hooks/useApproval';

function AppContent() {
  const { user, loading: authLoading, redirectToPortal } = useAuth();
  const { isApproved, isRejected, loading: approvalLoading } = useApproval();

  if (authLoading || approvalLoading) return <LoadingSpinner />;
  if (!user) { redirectToPortal(); return null; }
  if (isRejected) return <AccessDeniedScreen />;
  if (!isApproved) return <PendingApprovalScreen />;

  return <YourMainApp />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
```

---

## 7. Checking App-Specific Permissions (Optional)

```typescript
const { data: canUpload } = await supabase.rpc('has_namespaced_permission', {
  user_id: user.id,
  namespaced_perm: 'my_app.upload_files',  // format: '<app_slug>.<permission_name>'
});

if (!canUpload) {
  // show permission denied UI
}
```

---

## 8. Local Development

Run your app on a `localtest.me` subdomain so the cookie is shared with the local portal:

```bash
# If using Vite, bind to 0.0.0.0 and open via subdomain in browser
npx vite --host 0.0.0.0 --port 3001
# Then access at: http://my-app.localtest.me:3001
```

The local portal runs at `http://portal.localtest.me:5173`.

---

## Summary Checklist

- [ ] `@supabase/supabase-js` installed
- [ ] `CookieStorage` implemented with `storageKey: 'sakura3-auth'`
- [ ] `redirectToPortal()` called when `user` is `null`
- [ ] `approval_status === 'approved'` checked before rendering app content
- [ ] App origin added to portal's `ALLOWED_ORIGINS` in `App.tsx`
- [ ] (Optional) App registered in the `applications` table for RBAC
- [ ] Using `localtest.me` subdomains for local dev
