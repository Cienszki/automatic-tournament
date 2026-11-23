# Scripts

Tools for developers and CI. Each file says at the top how to run it. None of them reads secrets. The database scripts write only to a local database, or to staging when CI's approved job or the owner asks for it; `db/target.ts` holds the rules. `docs/DEV_SETUP.md` shows how they fit together.

| Script | What it does |
|---|---|
| `tools/unreachable.mjs` | Lists files under `src/` and `server/` that no entry point imports, and exits with code 1 if there are any. CI runs it. `--lines` adds line counts, `--json` prints the result as JSON. Files kept on purpose for a later work package are in its `KEEP` list, each with a reason. |
| `db/migrate.ts` (`npm run db:migrate`) | Applies the migrations in `drizzle/` to the local database, a local PostgreSQL, or (with `--remote --expect staging`) staging. |
| `seed/` (`npm run db:seed`) | Writes the four seed tournaments (league, groups with playoffs, Swiss, LAN qualifier) at chosen phases. The builders are reused by tests. |
| `db/dev-local.ts` (`npm run dev:local`) | Serves the local database over the PostgreSQL protocol and starts `next dev` on port 3100 with every secret blank (`--start`: `next start` of the last build instead). |
| `smoke/` (`npm run smoke`) | The read-only production smoke test: five pages of the site in `SMOKE_BASE_URL`. Refuses every request that could write. |
| `tools/build-offline.mjs` | `next build` with every secret blank and every network connection refused; fails if anything tried the network. CI runs it. |
| `tools/measure-pages.js` | Measures page loads in a real browser (time to first byte, Largest Contentful Paint, Firestore and API requests, JavaScript weight). Needs `puppeteer-core` and an installed Edge. |
| `measure/` | The hosting trial's measurements (WP-06), against any base URL: `ttfb.ts` (time to first byte, cold and warm, HTML and client-navigation payload), `page-load.ts` (Largest Contentful Paint and the requests one page view costs, in a real browser), `cache-headers.ts` (whether the HTML and the navigation payload come from the CDN, headers quoted), `invalidation.ts` (seconds from an invalidation to fresh content; renames one team and back, local or staging database only), `concurrency.ts` (N concurrent uncached requests), `forwarding.ts` (which app answers each path) and `local-hops.ts` (stand-ins for the old site and the community site's rule, for trying the forwarding on this machine). Each says at the top how to run it; `docs/overhaul/spikes/WP-06.md` has the procedure. |

The 119 one-off scripts that used to live here (debugging, backfills, fantasy formula experiments, imports with the production service account) were deleted in WP-05. They are in git history before that commit, and in the tag `restore/pre-overhaul-2026-11-12`.

New tools go in `scripts/tools/` (or in their own folder, such as `scripts/import/`) and get a line in this table. A script that needs production credentials is run by the owner, never by an agent, and says so in its first lines.
