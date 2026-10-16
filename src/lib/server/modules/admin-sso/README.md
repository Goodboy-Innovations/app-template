# admin-sso

Optional admin sign-in through any standard OIDC provider (Zitadel, Keycloak, Authentik, Entra ID, Google, …), and acting as demo users. Better Auth plugins that `identity/auth.ts` adds; off unless `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` and `OIDC_ADMIN_ROLE` are set.

- **Owns**
  - `admin_access_log`: every sign-in, refusal, act-as, exit and sign-out, with the admin's `sub`, email and client address
- **Rules**
  - Sign-in: Better Auth's generic OAuth plugin, provider id `oidc`, Authorization Code with PKCE, `client_secret_basic`, ID token verified against the discovery JWKS (`plugin.ts`)
  - Admin only with `OIDC_ADMIN_ROLE` in `OIDC_ROLE_CLAIM`, checked on the server: in the ID token, else at userinfo (`roles.ts`). Others are refused before any user is created
  - Admins become users with role `admin` and no password. `session.ts` ends their session after 8 hours
  - Acting as a user: Better Auth's admin plugin (impersonation, 1 hour). The guard in `plugin.ts` opens only impersonate-user and stop-impersonating of its API, only to admins who signed in through the provider, and only for users at `OIDC_ACT_AS_DOMAIN` (default `example.com`, the demo users)
  - While acting, `locals.actingAdmin` holds the admin's `sub` and email. Writes the app logs or audits record it too, so they say "admin X acting as Y"
  - Doesn't import `identity`; the routes and `session.ts` join the two
- **Why**
  - Admins of every app sign in with one identity and never handle passwords
  - Acting as demo users shows what users see, without touching real users' data
  - Standard OIDC only and a module of its own, so the password sign-in stays as it is, the app works without a provider, and any provider works
