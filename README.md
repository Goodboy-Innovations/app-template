# App template

A proven stack for a web app with its own users and database: it builds, tests, deploys and seeds itself. Use it as it is, change it, or take only the parts that fit. When an app needs something else, choose that instead, and say why in the app's README.

## Stack

- **SvelteKit 2** with Svelte 5 and TypeScript, built with Vite for Node 24 (`adapter-node`)
- **Postgres 18** through Drizzle ORM; SQL migrations in `drizzle/`, applied when the server starts
- **Sign-in** built in: email and password, sessions in Postgres (module `identity`)
- **Admin sign-in** through OIDC, optional: admins sign in with the organisation's identity provider and act as demo users, without passwords (module `admin-sso`)
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
- **Needs**: `DATABASE_URL` (Postgres 18) and `ORIGIN` (the app's public address). Uploads need the `S3_*` variables; without them uploads are off. Admin sign-in needs the `OIDC_*` variables; without them it is off
- **On start**: applies migrations; with `SEED_ON_START=1` an empty database gets the first admin (`SEED_ADMIN_*`), and with `SEED_DEMO=1` the demo dataset, for staging and previews
- **Health check**: `GET /robots.txt`, which doesn't touch the database
- **Stop**: SIGTERM shuts it down cleanly

## Admin sign-in (optional)

Password sign-in stays the default for everyone. With the `OIDC_*` variables set, the sign-in page also shows **Sign in as admin with Cloudgood ID**:

1. The admin signs in at the provider (Authorization Code with PKCE, client secret, ID token checked against the provider's keys)
2. The app checks the admin role on the server, in the ID token or else at userinfo. Without the role: 403
3. The admin picks a demo user at `/admin` and sees the app as that user, under a banner "Acting as X — Exit"
4. Acting ends with Exit, Sign out, or when the 8-hour admin session ends. Every sign-in, refusal, switch and exit is written to the `admin_access_log` table and the server log

The admin never has a password in the app and no row in `users`. Only users whose email is at `OIDC_ACT_AS_DOMAIN` can be acted as, so real users never can.

| Variable             | Required | What                                                                                                                         |
| -------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `OIDC_ISSUER`        | yes      | The provider's issuer URL; its `/.well-known/openid-configuration` must answer. https (http only on localhost)               |
| `OIDC_CLIENT_ID`     | yes      | The app's client at the provider                                                                                             |
| `OIDC_CLIENT_SECRET` | yes      | Its secret, sent with HTTP Basic (`client_secret_basic`)                                                                     |
| `OIDC_ADMIN_ROLE`    | yes      | The role that makes someone an admin, e.g. `admin`                                                                           |
| `OIDC_ROLE_CLAIM`    | no       | The claim holding the roles. Default `urn:zitadel:iam:org:project:roles` (Zitadel). Also reads an array or a string of names |
| `OIDC_SCOPES`        | no       | Default `openid profile email urn:zitadel:iam:org:projects:roles`                                                            |
| `OIDC_ACT_AS_DOMAIN` | no       | Admins may act only as users at this email domain. Default `example.com`, the seeded demo users                              |

Setting some of the four required variables but not all stops the server at start with a message naming the missing ones.

At the provider, register a web application with:

- **Redirect URI**: `<ORIGIN>/auth/oidc/callback`, one per environment (staging, production)
- **Grant**: authorization code, with PKCE; **auth method**: client secret, basic
- **Roles**: the `OIDC_ADMIN_ROLE` role, granted to the people who may act as demo users. In Zitadel, either turn on "assert roles on authentication" for the project or leave it off and the app reads userinfo

## This repository

- It's public: nothing private goes in it, so no secrets, internal hostnames, addresses or deployment configuration
- An app made from it keeps its own copy and changes it freely; improvements that suit every app come back here as a PR
- Version: template v1. An app says in its README which version it started from
