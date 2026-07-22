# Reference Implementation: Laravel (PHP)

> **Stack:** Laravel, PHP, Guzzle (or built-in HTTP client)  
> **Protocol:** [Sakura 3 Identity Protocol](../sakura3-identity-protocol.md)

> [!NOTE]
> This implementation guide is a **planned stub**. Contributions welcome.

---

## What This Will Cover

- Reading the `sakura3-auth` cookie in a Laravel request
- Verifying the Supabase JWT using the Supabase REST API (`getUser`)
- A reusable `Sakura 3Auth` middleware
- Checking `profiles.approval_status` via the Supabase PostgREST API
- Namespaced permission checks via the `has_namespaced_permission` RPC call

---

## Key Notes for Implementors

- Laravel does not have an official Supabase SDK. Use the [Supabase PHP client](https://github.com/supabase-community/supabase-php) or make raw HTTP calls to the Supabase REST and Auth APIs.
- The `sakura3-auth` cookie value is **URL-encoded JSON**. Use `urldecode()` before `json_decode()`.
- The Supabase `getUser` endpoint: `POST {SUPABASE_URL}/auth/v1/user` with `Authorization: Bearer <access_token>` header.
- The PostgREST approval check: `GET {SUPABASE_URL}/rest/v1/profiles?id=eq.<user_id>&select=approval_status` with `apikey` and `Authorization` headers.

---

## Reference

See the [Node.js + Express](./node-express.md) implementation for the full verification flow logic, which maps directly to PHP/Laravel equivalents.
