# readme

Shows the repository's `README.md` on the front page, so a running copy of the app explains itself: its stack, layout, development and deployment.

- **Owns**
  - Nothing in the database. It reads `README.md` when the app is built and renders it once, on first use
- **Rules**
  - Markdown only: raw HTML in the README is shown as text, and `javascript:`, `vbscript:`, `file:` and `data:` links are refused, so the page can put the result in `{@html}`
  - Relative links and images point into the repository (`LINK_BASE` in `service.ts`); without a base they keep their text only
- **Why**
  - The README is the one description of the app; showing it beats a second copy on the front page that drifts
  - Read at build time (`?raw`), since the runtime image holds only the built server
- **In an app made from the template**
  - Point `LINK_BASE` at the app's own repository, or drop the module: delete this folder and the `readme` lines in `src/routes/+page.server.ts` and `+page.svelte`
