# App template

A proven stack for a web app with its own users and database: it builds, tests, deploys and seeds itself. Use it as it is, change it, or take only the parts that fit. When an app needs something else, choose that instead, and say why in the app's README.

## Stack

- **SvelteKit 2** with Svelte 5 and TypeScript, built with Vite for Node 24 (`adapter-node`)
- **Postgres 18** through Drizzle ORM; SQL migrations in `drizzle/`, applied when the server starts
- **Sign-in** with Better Auth: email and password, sessions in Postgres, rate limiting (module `identity`)
- **Admin sign-in** through any OpenID Connect provider, optional: admins sign in with the organisation's identity provider and act as demo users, without passwords (module `admin-sso`)
- **Uploads** to any S3-compatible bucket, optional (`aws4fetch`)
- Vitest, ESLint, Prettier, svelte-check; CI on GitHub Actions

## Layout

| Path                             | What                                                                                                                                                                   |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/`                    | Pages and endpoints                                                                                                                                                    |
| `src/lib/server/modules/<name>/` | One module per area of the app: `schema.ts`, `service.ts`, `index.ts` (what others may use), `README.md`. `identity` signs users in; `notes` is the example to replace |
| `src/lib/server/platform/`       | Config (the only place that reads environment variables), database, migrations, storage                                                                                |
| `src/lib/server/seed/`           | The first admin and the demo dataset for an empty database                                                                                                             |
| `drizzle/`                       | Generated SQL migrations                                                                                                                                               |
| `Dockerfile`, `compose.yaml`     | The production image; the app with its own Postgres, locally                                                                                                           |

How the modules are kept apart: a module is used only through its `index.ts`, and only it writes to its own tables. Each module's README says what it owns and why.

## Development

```sh
cp .env.example .env
docker compose up -d db        # Postgres on localhost:5432
npm install
npm run db:migrate && npm run db:seed
npm run dev                    # http://localhost:5173
```

- `npm run db:generate` after changing a `schema.ts`, then commit the migration
- `npm run lint`, `npm run check`, `npm test` are what CI runs, plus a build and a start on an empty database
- `docker compose up --build` runs the production image locally; `.env.example` lists every variable

## Deployment

One container, configured only through environment variables, so it runs on any platform that runs Docker images:

- **Image**: `Dockerfile`, listening on port 3000
- **Needs**: `DATABASE_URL` (Postgres 18), `ORIGIN` (the app's public address) and `BETTER_AUTH_SECRET` (signs session cookies; at least 32 characters, e.g. `openssl rand -base64 32`; without it outside production, each start makes a new one and signs everyone out). Behind a reverse proxy, set `ADDRESS_HEADER=X-Forwarded-For` and `XFF_DEPTH` (usually `1`), so rate limits see the client's address and not the proxy's. Uploads need the `S3_*` variables; without them uploads are off
- **On start**: applies migrations; with `SEED_ON_START=1` an empty database gets the first admin (`SEED_ADMIN_*`), and with `SEED_DEMO=1` the demo dataset, for staging and previews
- **Health check**: `GET /robots.txt`, which doesn't touch the database
- **Stop**: SIGTERM shuts it down cleanly

## Admin sign-in (optional)

Password sign-in stays the default for everyone. Admin sign-in works with any standard OpenID Connect provider (Zitadel, Keycloak, Authentik, Entra ID, Google Workspace, …). With the `OIDC_*` variables set, the sign-in page also shows **Sign in as admin with &lt;provider&gt;**:

1. The admin signs in at the provider through Better Auth's generic OAuth plugin: Authorization Code with PKCE, client secret, ID token verified against the provider's keys (signature, issuer, audience, nonce)
2. The app checks the admin role on the server, in the ID token or else at userinfo. Without the role the sign-in is refused and no user is created
3. The admin becomes a user with role `admin` and no password, signed in for at most 8 hours
4. At `/admin` the admin picks a demo user and sees the app as that user (Better Auth's admin plugin, impersonation), under a banner "Acting as X — Exit". Acting ends with Exit, Sign out, or after an hour

The admin never has a password in the app. Only users whose email is at `OIDC_ACT_AS_DOMAIN` can be acted as, so real users never can. Every sign-in, refusal, switch, exit and sign-out goes to the `admin_access_log` table and the server log, with the admin's `sub`, email and client address. While acting, `locals.actingAdmin` holds the admin's `sub` and email next to `locals.user`: record it with the app's own audited writes, so they say "admin X acting as Y".

| Variable             | Required | What                                                                                                                                               |
| -------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OIDC_ISSUER`        | yes      | The provider's issuer URL; its `/.well-known/openid-configuration` must answer. https (http only on localhost)                                     |
| `OIDC_CLIENT_ID`     | yes      | The app's client at the provider                                                                                                                   |
| `OIDC_CLIENT_SECRET` | yes      | Its secret, sent with HTTP Basic (`client_secret_basic`)                                                                                           |
| `OIDC_ADMIN_ROLE`    | yes      | The role that makes someone an admin, e.g. `admin`                                                                                                 |
| `OIDC_ROLE_CLAIM`    | no       | The claim holding the roles. An object keyed by role, an array or a space-separated string. Default: Zitadel's `urn:zitadel:iam:org:project:roles` |
| `OIDC_SCOPES`        | no       | Default: `openid profile email urn:zitadel:iam:org:projects:roles` (the last one is Zitadel's; other providers ignore or replace it)               |
| `OIDC_ACT_AS_DOMAIN` | no       | Admins may act only as users at this email domain. Default `example.com`, the seeded demo users                                                    |
| `OIDC_PROVIDER_NAME` | no       | The provider's name on the button. Default `Cloudgood ID`                                                                                          |

Setting some of the four required variables but not all stops the server at start with a message naming the missing ones. The provider's discovery document is read on the first request that needs sign-in; if the provider can't be reached then, admin sign-in stays off until the app restarts.

Only `/api/auth/admin/impersonate-user` and `/api/auth/admin/stop-impersonating` of Better Auth's admin API are open, and only to admins signed in through the provider. The rest of it answers 404. Password admins (from `SEED_ADMIN_*`) can't act as users.

At the provider, register a web application with:

- **Redirect URI**: `<ORIGIN>/api/auth/callback/oidc`, one per environment (staging, production)
- **Grant**: authorization code, with PKCE; **auth method**: client secret, basic
- **Roles**: the `OIDC_ADMIN_ROLE` role, granted to the people who may act as demo users, delivered in the ID token or at userinfo under `OIDC_ROLE_CLAIM`

Other providers, for example:

- **Keycloak**: `OIDC_ROLE_CLAIM=roles` with a client-roles mapper that adds `roles` to the ID token, and `OIDC_SCOPES="openid profile email"`
- **Authentik, Entra ID**: `OIDC_ROLE_CLAIM=groups` (Authentik) or `roles` (Entra app roles), and `OIDC_ADMIN_ROLE` set to that group or role name
- **Zitadel**: the defaults; turn on "assert roles on authentication" for the project, or leave it off and the app reads userinfo

## Running outside Cloudgood

The app needs no Cloudgood service. It is one container with standard settings:

- **Required**: Postgres and `DATABASE_URL`, `ORIGIN`, `BETTER_AUTH_SECRET`. Run it on any Docker host, Kubernetes, a PaaS or a plain VM with Node 24
- **Optional parts** are standard and off when unset:
  - uploads: any S3-compatible store (`S3_*`)
  - admin sign-in: any OpenID Connect provider (`OIDC_*`)
- **Secrets** are plain environment variables. Cloudgood fills them from its secret store, but the app only reads `process.env`
- **Sign-in** is the app's own (Better Auth, in the app's database), not a hosted service
- **Without admin sign-in**: leave `OIDC_*` unset. Admins sign in with email and password like everyone else (`SEED_ADMIN_*` creates the first one), and the admin API stays closed
- **Platform modules** such as `admin-sso` live in their own folder under `src/lib/server/modules/`. To remove one, delete its folder and its routes, and remove the lines that use it in `identity/auth.ts`, `session.ts`, `hooks.server.ts`, the layout and the sign-in page

## This repository

- It's public: nothing private goes in it, so no secrets, internal hostnames, addresses or deployment configuration
- An app made from it keeps its own copy and changes it freely; improvements that suit every app come back here as a PR
- Version: template v1. An app says in its README which version it started from
