# App template

- **What this is**
  - The starting point and the standard for an app: copy it, keep its rules, replace the example
  - Standalone: needs only a container runtime, Postgres and, for uploads, an S3-compatible bucket. Knows nothing about where it runs
  - SvelteKit + Svelte 5, TypeScript, Postgres through Drizzle, Docker
- **Status**
  - Template v1

# Start

- **Docker only**: `cp .env.example .env`, set `SEED_ADMIN_*`, then `docker compose up --build` (http://localhost:3000)
- **Development** (Node 24+): `docker compose up -d db`, then the `db:migrate`, `db:seed` and `dev` scripts
- **Before pushing**: the `check`, `lint` and `test` scripts

# Where things are

- `src/lib/server/platform/` — config check, database, migrations, file storage
- `src/lib/server/modules/<module>/` — one folder per domain; start from its `README.md` and `index.ts`
  - `identity` — users, password sign-in, sessions
  - `notes` — the example module
- `src/lib/server/seed/` — starting content, for `SEED_ON_START=1` and `npm run db:seed`
- `src/hooks.server.ts` — startup (check, migrations, seeding) and the session on each request
- `src/routes/` — pages and endpoints, kept thin
- `drizzle/` — SQL migrations

# Rules

- **Modules**
  - Import another module only through its `index.ts`
  - Write to a module's tables only through that module's functions
  - No foreign keys into another module's tables
  - A module's `README.md` holds what it owns, its rules and why; not a walkthrough of the code
- **Migrations**: generated from `schema.ts` with `db:generate`. A merged migration is never edited; add a new one
- **Settings**
  - Environment variables only, read only in `platform/config.ts` and checked at start by `checkConfig`
  - The app's own variables are named after its features, never after a deployment platform
  - `ORIGIN` is the app's one address, never taken from `X-Forwarded-*` headers
- **Data**
  - The app owns its database: no other app reads or writes it, and it reads no other app's
  - Apps exchange data only through published, versioned APIs
- **Sign-in**: the app signs in its own users. A shared sign-in service, if one comes, stays optional
- **Secrets**: only in the deployment's environment. Never in the repository, logs or error messages

# Making an app from it

- Rename `name` in `package.json` and `APP_NAME` in `src/lib/app.ts`
- Replace `notes`, its routes and the seed's welcome note
- Before the first deploy, `drizzle/` can be regenerated as one clean first migration
