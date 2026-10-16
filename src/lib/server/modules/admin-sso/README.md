# admin-sso

Optional admin sign-in through an OIDC provider (Zitadel in Cloudgood). Off unless `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` and `OIDC_ADMIN_ROLE` are set.

- **Owns**
  - `admin_sessions`: one row per signed-in admin browser, with the user the admin acts as
  - `admin_access_log`: every sign-in, refusal, switch, exit and sign-out
- **Rules**
  - Authorization Code with PKCE (S256), state and nonce, through `openid-client` (`oidc.ts`)
  - Admin only with `OIDC_ADMIN_ROLE` in `OIDC_ROLE_CLAIM`, checked on the server: in the ID token, else at userinfo (`roles.ts`)
  - Admins get no row in `users` and no password. Their session: a random token in an `httpOnly` cookie, only its SHA-256 stored, 8 hours, not sliding
  - Acting as a user puts that user in `locals.user` for every request, without a session of their own. It ends with Exit, sign-out, or the admin session's end
  - Only users at `OIDC_ACT_AS_DOMAIN` (default `example.com`, the demo users) can be acted as
  - Uses `identity` only through its `index.ts` (`findUserById`, `listUsers`)
- **Why**
  - Admins of every app sign in with one identity and never handle passwords
  - Acting as demo users shows what users see, without touching real users' data
  - A separate module, so the password sign-in stays as it is, and the app works without a provider
