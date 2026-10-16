# identity

Sign-in through [Better Auth](https://www.better-auth.com) (`auth.ts`), pinned to an exact version in `package.json`.

- **Owns**
  - `users`: email (lowercased, unique), name, role
  - `accounts`: how a user signs in; provider `credential` holds the password hash
  - `sessions`: one row per signed-in browser; `verifications`: one-time values
- **Rules**
  - Roles: `admin` and `user`, never set from a request. The template gives `admin` no extra pages; apps decide what it allows
  - Passwords: at least `MIN_PASSWORD_LENGTH` characters, hashed by Better Auth (scrypt, no native dependencies)
    - Template v1 hashes (`scrypt$…`, `password.ts`) still verify, so users from before the move keep signing in
  - Sessions: Better Auth's signed cookie, 30 days, extended when half used up. `BETTER_AUTH_SECRET` signs it
  - Changing a password signs the user's other devices out
  - Rate limit: Better Auth's, on in every environment. Sign-in allows 3 tries per 10 seconds per client address, in memory (per process)
    - The client address is what SvelteKit sees (`ADDRESS_HEADER` / `XFF_DEPTH` behind a proxy). `hooks.server.ts` replaces any address header the client sends
  - Sign-in goes through Better Auth's HTTP handler (`signIn` in `service.ts`), because its rate limit only guards HTTP requests
  - Better Auth's admin plugin is always on, for roles and acting as a user; `admin-sso` keeps its API closed except what admin sign-in needs
  - OAuth accounts never attach to an existing user with the same email (account linking off)
  - Better Auth's HTTP API is under `/api/auth/*`. Sign-up there is off: the first admin comes from seeding, and an app adds the sign-up or user pages it needs
- **Why**
  - Every app signs in its own users and must work alone
  - A maintained library for sessions, rate limiting and later OAuth, instead of code each app keeps up itself
  - Other modules use `index.ts` only, so they don't depend on Better Auth
