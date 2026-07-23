# Reference Implementation: Node.js + Express

> **Stack:** Node.js, Express, `@supabase/supabase-js`  
> **Protocol:** [Sakura 3 Identity Protocol](../sakura3-identity-protocol.md)

This guide covers integrating Sakura 3 auth into a **server-side Express application**, where cookie parsing and session validation happen in backend middleware.

---

## 1. Install Dependencies

```bash
npm install @supabase/supabase-js cookie-parser
```

---

## 2. Environment Variables

```env
SUPABASE_URL="https://your-supabase-project.supabase.co"
SUPABASE_ANON_KEY="your-supabase-anon-key"
PORT=3000
```

> Use the **anon key**, not the service role key, for session validation via `getUser()`. The anon key is safe because `getUser()` verifies the JWT signature server-side.

---

## 3. Supabase Client

Create `src/supabase.js`:

```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

module.exports = { supabase };
```

No custom storage is needed server-side — you extract the token from the cookie manually.

---

## 4. Auth Middleware

Create `src/middleware/auth.js`:

```javascript
const { supabase } = require('../supabase');

/**
 * Reads the sakura3-auth cookie, validates the session with Supabase,
 * and checks that the user's account is approved.
 *
 * Attaches req.user and req.profile on success.
 */
async function requireAuth(req, res, next) {
  // 1. Read the shared session cookie
  const rawCookie = req.cookies['sakura3-auth'];
  if (!rawCookie) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  let session;
  try {
    session = JSON.parse(decodeURIComponent(rawCookie));
  } catch {
    return res.status(401).json({ error: 'Malformed session cookie' });
  }

  const accessToken = session?.access_token;
  if (!accessToken) {
    return res.status(401).json({ error: 'Missing access token' });
  }

  // 2. Verify the JWT with Supabase (server-side signature check)
  const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  // 3. Check platform approval status
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('approval_status, house_number')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return res.status(403).json({ error: 'Profile not found' });
  }

  if (profile.approval_status !== 'approved') {
    return res.status(403).json({
      error: 'Account not approved',
      status: profile.approval_status,
    });
  }

  // 4. Attach to request for downstream handlers
  req.user = user;
  req.profile = profile;
  next();
}

module.exports = { requireAuth };
```

---

## 5. Permission Middleware (Optional)

If your app uses app-specific RBAC:

```javascript
const { supabase } = require('../supabase');

/**
 * Factory that returns middleware checking a specific namespaced permission.
 * Usage: router.get('/upload', requirePermission('my_app.upload_files'), handler)
 */
function requirePermission(namespacedPerm) {
  return async (req, res, next) => {
    // requireAuth must run first (req.user must be set)
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const { data: hasPerm, error } = await supabase.rpc('has_namespaced_permission', {
      user_id: req.user.id,
      namespaced_perm: namespacedPerm,
    });

    if (error) {
      return res.status(500).json({ error: 'Permission check failed' });
    }
    if (!hasPerm) {
      return res.status(403).json({ error: `Permission denied: ${namespacedPerm}` });
    }

    next();
  };
}

module.exports = { requirePermission };
```

---

## 6. Express App Setup

Create `src/server.js`:

```javascript
const express = require('express');
const cookieParser = require('cookie-parser');
const { requireAuth } = require('./middleware/auth');
const { requirePermission } = require('./middleware/permission');

const app = express();

app.use(cookieParser());
app.use(express.json());

// Public routes
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Protected routes — any authenticated + approved resident
app.get('/api/data', requireAuth, async (req, res) => {
  res.json({ message: `Hello ${req.user.email}`, house: req.profile.house_number });
});

// Protected routes — requires a specific app permission
app.post('/api/upload',
  requireAuth,
  requirePermission('my_app.upload_files'),
  async (req, res) => {
    res.json({ message: 'Upload authorized' });
  }
);

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server running on port ${process.env.PORT || 3000}`);
});
```

---

## 7. Handling Token Refresh

The access token inside the cookie expires after ~1 hour. The server middleware will return `401` when this happens. Your frontend should handle the 401 and redirect the user back to the portal:

```javascript
// Client-side fetch wrapper
async function apiFetch(url, options = {}) {
  const res = await fetch(url, { credentials: 'include', ...options });
  if (res.status === 401) {
    // Session expired — send user back to portal to re-authenticate
    const returnUrl = encodeURIComponent(window.location.href);
    window.location.href = `${PORTAL_URL}/?redirect_to=${returnUrl}`;
    return;
  }
  return res;
}
```

Alternatively, implement token refresh before the request by reading the `refresh_token` from the cookie and calling the Supabase refresh endpoint.

---

## 8. Local Development

Your Express server and the local portal both need to be on `localtest.me` subdomains for the cookie to be shared:

| Service | Local URL |
|---|---|
| Community Portal | `http://portal.localtest.me:5173` |
| Your Express App | `http://my-app.localtest.me:3000` |

If you access your app at `http://localhost:3000`, the browser will not send the `.localtest.me` cookie. Use the subdomain URL instead.

---

## Summary Checklist

- [ ] `@supabase/supabase-js` and `cookie-parser` installed
- [ ] `requireAuth` middleware validates JWT via `supabase.auth.getUser()`
- [ ] `requireAuth` checks `profiles.approval_status === 'approved'`
- [ ] `requirePermission()` used for fine-grained RBAC (if needed)
- [ ] Frontend handles `401` by redirecting to portal
- [ ] App origin registered in portal's `ALLOWED_ORIGINS`
- [ ] Using `localtest.me` for local development
