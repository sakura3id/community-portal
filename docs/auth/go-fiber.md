# Reference Implementation: Go + Fiber

> **Stack:** Go, Fiber v2, `golang-jwt/jwt`  
> **Protocol:** [Sakura 3 Identity Protocol](../sakura3-identity-protocol.md)

> [!NOTE]
> This implementation guide is a **planned stub**. Contributions welcome.

---

## What This Will Cover

- Parsing the `sakura3-auth` cookie in a Fiber handler
- Verifying the Supabase JWT using the Supabase Auth REST API
- A reusable `Sakura 3Auth` middleware function
- Checking `profiles.approval_status` via a direct Supabase PostgREST request
- Namespaced permission checks via the `has_namespaced_permission` RPC

---

## Key Notes for Implementors

- Use Go's `net/http` or a Fiber-native HTTP client to call the Supabase Auth API for JWT verification (`GET /auth/v1/user` with `Authorization: Bearer <token>`).
- The `sakura3-auth` cookie value is URL-encoded JSON. Use `url.QueryUnescape()` before `json.Unmarshal()`.
- For the PostgREST approval check, make an authenticated `GET` to `{SUPABASE_URL}/rest/v1/profiles?id=eq.<user_id>&select=approval_status`.
- The RBAC RPC call maps to `POST {SUPABASE_URL}/rest/v1/rpc/has_namespaced_permission`.

---

## Reference

See the [Node.js + Express](./node-express.md) implementation for the full verification flow logic, which maps directly to Go equivalents.
