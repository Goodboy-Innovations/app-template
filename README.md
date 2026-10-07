# App template

- **What this is**
  - The starting point for one app: copy it, keep its conventions, replace the `notes` example module
  - Standalone: runs anywhere with Postgres (and an S3-compatible bucket for uploads), configured only through standard environment variables. Knows nothing about where it runs
  - Template v1
- **Rules**
  - Modules use each other only through `index.ts`, and only a module writes to its own tables
  - The app owns its database: no other app reads or writes it, and apps exchange data only through published, versioned APIs
  - Nothing private in this repository: no secrets, internal hostnames, addresses or deployment configuration
