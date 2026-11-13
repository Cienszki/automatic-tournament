# Scripts

Tools for developers and CI. Each file says at the top how to run it. None of them reads secrets or writes to any database.

| Script | What it does |
|---|---|
| `tools/unreachable.mjs` | Lists files under `src/` and `server/` that no entry point imports, and exits with code 1 if there are any. CI runs it. `--lines` adds line counts, `--json` prints the result as JSON. Files kept on purpose for a later work package are in its `KEEP` list, each with a reason. |
| `tools/measure-pages.js` | Measures page loads in a real browser (time to first byte, Largest Contentful Paint, Firestore and API requests, JavaScript weight). Needs `puppeteer-core` and an installed Edge. |

The 119 one-off scripts that used to live here (debugging, backfills, fantasy formula experiments, imports with the production service account) were deleted in WP-05. They are in git history before that commit, and in the tag `restore/pre-overhaul-2026-11-12`.

New tools go in `scripts/tools/` (or in their own folder, such as `scripts/import/`) and get a line in this table. A script that needs production credentials is run by the owner, never by an agent, and says so in its first lines.
