# App template

- **What this is**
  - The starting point for one app: SvelteKit + Svelte 5, TypeScript, Postgres through Drizzle, Docker
  - Implements the app standard from the public app guide, _Building an app_
  - Knows nothing about where it runs: any container runtime with Postgres (and, for uploads, an S3-compatible bucket)
- **Status**
  - Template v1

# Start

- **Docker only**
  - `cp .env.example .env`, then set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`
  - `docker compose up --build`: Postgres and the app on http://localhost:3000, migrated and seeded
  - Sign in with the seed admin; change its password under the account page
- **Development** (Node 24+)
  - `docker compose up -d db`, `cp .env.example .env`, `npm install`
  - `npm run db:migrate`, `npm run db:seed`, `npm run dev`
- **Before pushing**
  - `npm run check`, `npm run lint`, `npm test`

# Code layout

- `src/lib/server/platform/` — shared kernel: config check, database, migrations, file storage
- `src/lib/server/modules/<module>/` — one folder per domain: `README.md`, `index.ts`, `schema.ts`
  - `identity` — users, password sign-in, sessions
  - `notes` — the example module, to be replaced
- `src/lib/server/seed/` — starting content, written only through the modules' `index.ts`
- `src/lib/server/session.ts` — the session cookie and `requireUser`
- `src/routes/` — pages and endpoints, kept thin
- `drizzle/` — SQL migrations; `scripts/seed.ts` — `npm run db:seed`

# Module rules

- **Import another module only through its `index.ts`**
- **Write to a module's tables only through that module's functions**
- **No foreign keys into another module's tables**: keep the id, ask the module for the rest
- **A module's `README.md`**: what it owns, its rules and why; not a walkthrough of the code
- **Schema changes**
  - Edit the module's `schema.ts`, run `npm run db:generate`, commit the new file in `drizzle/`
  - A merged migration is never edited; add a new one

# Settings

- **Environment variables only**, read only in `platform/config.ts`
- **Checked at start**: one message naming every missing or half-set variable, then a one-line summary without secrets
- **Standard variables**
  - `DATABASE_URL` — Postgres
  - `ORIGIN` — the app's own address: links, CSRF checks. Never from `X-Forwarded-*` headers
  - `PORT` — default 3000
  - `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` — uploads, all or none
    - `S3_REGION` (default `us-east-1`), `S3_PREFIX` — this deployment's part of the bucket
  - `SEED_ON_START=1` with `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` — seed an empty database
- **The app's own variables**
  - Named after its features, never after a deployment platform
  - Added to `checkConfig` when they must be set, or only work together

# Running it

- **Start**: config check, pending migrations, seeding with `SEED_ON_START=1`, then requests. Any failure stops the server
- **Container**: the `runtime` stage of the `Dockerfile`
  - Runs as the `node` user, has `sh` and `wget`, listens on `PORT`
  - On `SIGTERM` finishes open requests, closes the database pool and exits
  - Health check: `/robots.txt`, which needs no database (also the image's `HEALTHCHECK`)
- **One address per deployment**: set `ORIGIN` to it; form posts from any other address fail SvelteKit's CSRF check
- **Seeding**: an empty database gets the admin and a welcome note; a database with users or notes is never touched
- **Uploads**
  - Private bucket; files are served through the app, always as downloads
  - Rows store the full object key, `S3_PREFIX` included
  - The app deletes only keys under its own `S3_PREFIX`, so deployments can share a bucket
- **Secrets**: only in the deployment's environment; never in the repository or logs

# Making an app from it

- Rename: `name` in `package.json`, `APP_NAME` in `src/lib/app.ts`
- Replace the `notes` module, its routes and the seed's welcome note with the app's own
- Before the first deploy, `drizzle/` can be regenerated as one clean first migration; after it, only add migrations
