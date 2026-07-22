# Reference Implementation: Next.js (App Router)

> **Stack:** Next.js 14+, App Router, TypeScript, `@supabase/ssr`  
> **Protocol:** [Sakura 3 Identity Protocol](../sakura3-identity-protocol.md)

> [!NOTE]
> This implementation guide is a **planned stub**. Contributions welcome.

---

## What This Will Cover

- Using `@supabase/ssr` to create both client-side and server-side Supabase clients
- Reading the `sakura3-auth` cookie in Next.js Route Handlers and Server Components
- A `middleware.ts` file that gates protected routes server-side before rendering
- Checking `profiles.approval_status` in a Server Component
- Handling the portal redirect from Next.js middleware

---

## Key Notes for Implementors

- Next.js with App Router is a **hybrid** runtime (some code runs server-side, some client-side). You need two separate Supabase client instances.
- Use `@supabase/ssr` (`createServerClient` and `createBrowserClient`) instead of the base `@supabase/supabase-js` for proper cookie handling in Next.js.
- The `sakura3-auth` cookie must be read with the same `storageKey` (`'sakura3-auth'`) in your `createServerClient` configuration.
- Cookie writes happen in `middleware.ts` where you can use `response.cookies.set()`.
- For local development, the same `localtest.me` subdomain approach applies. Configure `next.config.js` to accept requests from `*.localtest.me`.

---

## Planned File Structure

```
src/
  lib/
    supabase-server.ts   ← createServerClient helper
    supabase-browser.ts  ← createBrowserClient helper
  middleware.ts          ← route-level auth guard
  app/
    (protected)/
      layout.tsx         ← Server Component approval check
```

---

## Reference

See the [React/Vite](./react-vite.md) guide for the client-side `CookieStorage` pattern and the [Node.js + Express](./node-express.md) guide for server-side session verification logic.
