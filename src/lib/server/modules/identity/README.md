# identity

- **Owns**
  - `users`: email (lowercased, unique), name, password hash, role
  - `sessions`: one row per signed-in browser
- **Rules**
  - Roles: `admin` and `user`. The template gives `admin` no extra pages; apps decide what it allows
  - Passwords: scrypt from `node:crypto` (`password.ts`), at least `MIN_PASSWORD_LENGTH` characters
    - No native dependencies, so the Docker build works on every platform
  - Sessions: a random token in an `httpOnly` cookie, only its SHA-256 stored; 30 days, sliding
  - Changing a password signs the user out everywhere
  - Sign-in takes the same time whether or not the email exists, and cools down after 5 failures per email (`throttle.ts`, per process)
  - No self-registration: the first admin comes from seeding; an app adds the sign-up or user pages it needs
- **Why**
  - Every app signs in its own users and must work alone
  - A shared identity app (OIDC) may come later; it will be optional, so this module stays
