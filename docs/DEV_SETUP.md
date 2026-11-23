# Development setup: local, staging and production

There are three places the site runs. **Local** is your machine, with a database in a folder and made-up tournaments; it needs no account and no secret. **Staging** is a private copy on real hosting, with its own database and Firebase project, where a branch is tried before visitors see it. **Production** is what visitors use. Today that is still the old site; the new platform takes over one tournament at a time (`docs/overhaul/ARCHITECTURE.md`, ADR-15).

| | Local | Staging | Production (old site, today) | Production (new platform, later) |
|---|---|---|---|---|
| Database | PGlite in `.local/pglite`, seeded | Supabase project `dota2inhouse-staging` | Firestore | Supabase project `dota2inhouse` |
| Web app | `npm run dev:local` on port 3100 | Vercel preview of each `wp/*` branch | Firebase Hosting, deployed by hand | Vercel, deployed from `overhaul` |
| Sign-in, files | placeholder Firebase project (sign-in off) | Firebase project `dota2inhouse-staging-6e3ef` | Firebase project `tournament-tracker-f35tb` | same as the old site |
| Secrets | none | `.env.staging.local`, GitHub secrets, Vercel preview variables | Firebase and Railway settings | Vercel production variables |
| Who changes it | anyone | CI after an approval; the owner | the owner only | CI after an approval; the owner |

Everything below is run from a terminal in the repository folder (or an overhaul worktree). Node 22 and git are needed.

## Local

```bash
npm ci                      # once, and after package-lock.json changes
npm run db:seed             # creates .local/pglite, migrates it, writes four tournaments
npm run dev:local           # http://localhost:3100
```

`db:seed` writes one tournament per format: `/seed-liga` (league with divisions, mid-season), `/seed-grupy` (group stage with playoffs, in the playoffs), `/seed-swiss` (Swiss, finished) and `/seed-lan` (LAN qualifier, mid-season). Run it again at any time; it replaces the seed tournaments and touches nothing else. Other phases:

```bash
npm run db:seed -- --phase seed-liga=finished --phase seed-swiss=registration
npm run db:seed -- --only seed-grupy --phase seed-grupy=mid-season
```

Phases are `registration`, `mid-season`, `playoffs` (group stage with playoffs only) and `finished`.

`dev:local` serves the database folder over the PostgreSQL protocol on `127.0.0.1:54329` and starts `next dev` with every secret blank and `PLATFORM_ROUTING=on` (below). With `--start` it runs `next start` on the last production build instead, for measuring one (`node scripts/tools/build-offline.mjs` builds it). It also blanks every value from `.env` files, so a `.env.local` with real credentials cannot reach a local run. Options: `--port 3200`, `--db-port 54330`. Port 3000 is refused, because the owner's own dev server uses it. Stop it with Ctrl+C. Only one process can open the database folder: stop `dev:local` before running `db:seed` again.

**What works locally.** Only pages moved to the new platform read the local database. So far that is `/<slug>/teams` of every tournament in it (WP-06), `/sitemap.xml` (it lists the tournaments and their pages) and `/robots.txt`. The card game prototypes (`/prototype/cards/game`, `/prototype/cards/match`) need no database. The other pages are still the old site's: they render their frame and show no data, because they read Firestore from the browser and the local run has no Firebase project. Each work package that moves a page makes it work here.

**The real tournaments locally.** The import tool writes the four captured tournaments into the same folder (stop `dev:local` first): `npx tsx scripts/import/index.ts --from ../overhaul/data-exports --db .local/pglite`.

**The new platform in front of the old site** (ADR-15, `src/platform/routing/rules.mjs`). Three variables, read by `next.config.mjs` when the app is built (`next dev` reads them when it starts), never at run time: a change needs a new build or deployment, and a malformed value fails the build:

| Variable | Meaning | Local | Staging preview |
|---|---|---|---|
| `PLATFORM_ROUTING` | `on`: moved pages of tournaments not on the old site render from PostgreSQL; the rest is forwarded. Anything else: everything as before WP-06 | `on` (set by `dev:local`) | `on` |
| `LEGACY_ORIGIN` | the old site's address; unset means nothing is forwarded | unset | the old site's hosting address |
| `LEGACY_SLUGS` | comma-separated slugs the old site still serves; they are forwarded whole | unset | every captured slug that is not imported into staging |

`PLATFORM_TRIAL_SECRET` switches on the hosting trial's two endpoints under `/api/platform/trial/` (they answer 404 without it). The steps of the trial are in `docs/overhaul/spikes/WP-06.md`.

**A local PostgreSQL instead of PGlite.** Any PostgreSQL 15 or later on this machine works; give its address:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm run db:seed
DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm run dev:local
```

The scripts accept only an address on this machine (`localhost`, `127.0.0.1`, `::1`) or CI's container (`postgres`). They never read `.env` files.

**Starting over.** Stop `dev:local`, delete the `.local` folder, and run `npm run db:seed`.

**Checks.** CI runs the same commands on every push (`.github/workflows/ci.yml`):

```bash
npm run typecheck
npm run lint
npx vitest run --project unit          # unit and component tests
npx vitest run --project db            # database tests, on PGlite
npm test                               # both
node scripts/tools/build-offline.mjs   # production build, every secret blank, network refused
```

`build-offline.mjs` fails if anything in the build tries to open a network connection; a build must read no database and download nothing. Delete `.next` afterwards; it is large.

Tests that need the Firebase emulators (file names ending in `.emulator.test.ts`) say in their first lines how to run them, for example:

```bash
firebase emulators:exec --only firestore,auth --project demo-merge "npx vitest run src/__tests__/account-merge.emulator.test.ts"
```

**A plain `npm run dev` or `npm run build`.** These load `.env.local`. Copy `.env.local.example` and fill it with staging values only. A local build with production credentials once read production data.

## Staging

Staging needs the owner's accounts. They exist (question 5 in `docs/overhaul/STATUS.md`), and `docs/overhaul/SETUP_STAGING.md` says where each value comes from. The values are in `.env.staging.local` in the `overhaul` worktree (git-ignored; never print it or paste it into a chat), in the repository's GitHub secrets, and in the Vercel project's preview variables.

**Marking the database as staging.** The seed and the CI migration job refuse a remote database unless its own settings say it is staging. After the first migration, write that once, in the Supabase SQL editor or with `psql`:

```sql
insert into app.platform_settings (key, value) values ('environment', '"staging"')
on conflict (key) do update set value = excluded.value;
```

**Migrations** reach staging only through the GitHub workflow `Staging migrations` (`.github/workflows/staging-migrate.yml`). It runs when a merge to `overhaul` changes `drizzle/`, or by hand (Actions, then Run workflow), and it waits until someone approves it. It does nothing until the owner switches it on:

```bash
# 1. The environment with a required reviewer. Its branch rule (overhaul only) and the reviewer
#    are set on the website: Settings -> Environments -> staging. Or from the terminal:
gh api -X PUT 'repos/{owner}/{repo}/environments/staging' \
  -F "reviewers[][type]=User" -F "reviewers[][id]=$(gh api user --jq .id)" \
  -F "deployment_branch_policy[protected_branches]=false" -F "deployment_branch_policy[custom_branch_policies]=true"
gh api -X POST 'repos/{owner}/{repo}/environments/staging/deployment-branch-policies' -f name=overhaul
# 2. The database secret belongs to the environment, so only an approved job on overhaul can read it.
#    (SETUP_STAGING.md step 6 set it as a repository secret; set it here and delete that one.)
grep '^DATABASE_URL_SESSION=' .env.staging.local | cut -d= -f2- | tr -d '\r' | gh secret set DATABASE_URL_SESSION --env staging
gh secret delete DATABASE_URL_SESSION
# 3. Switch it on.
gh variable set STAGING_MIGRATIONS --body on
```

The job uses the secret `DATABASE_URL_SESSION` (the session pooler, port 5432) and runs `npm run db:migrate -- --remote --expect staging`, which refuses a database that says it is something else. It also stops if the environment has no required reviewer.

**Seeding staging** (the owner, from the `overhaul` worktree, after the migrations):

```bash
DATABASE_URL="$(grep '^DATABASE_URL_SESSION=' .env.staging.local | cut -d= -f2- | tr -d '\r')" npm run db:seed -- --staging
```

This is Git Bash syntax; it reads the session-pooler address from the file for that one command and prints nothing secret. Real tournaments reach staging only through the import tool with `--anonymize` (WP-33).

**Previews.** Each push of a `wp/*` branch builds a Vercel preview against staging (`.github/workflows/preview.yml`). The preview uses the Vercel project's preview variables, which are the staging values. To switch it on:

```bash
gh secret set VERCEL_TOKEN                    # a token scoped to the team that holds only this project, with an expiry
gh variable set VERCEL_ORG_ID --body <orgId>          # both ids are in .vercel/project.json
gh variable set VERCEL_PROJECT_ID --body <projectId>  # of the linked overhaul worktree
gh variable set STAGING_PREVIEWS --body on
```

Do not use an account-wide token: the same Vercel account holds the community site, which is production for dota2inhouse.pl. The workflow gives the token only to the Vercel steps, not to `npm ci` or the branch's code. The Vercel project is not connected to GitHub; keep it that way, or Vercel would build every push a second time and deploy `overhaul` to its production address.

The preview address appears on the workflow run's summary page. A branch that adds a migration needs the staging migration first, or its preview fails on the new tables. Nothing in these workflows deploys to production.

## Production

**The old site (today).** Production is the branch `feature/multi-tournament-platform`. Only the owner deploys it, from the main working copy:

```bash
firebase deploy --only hosting --project tournament-tracker-f35tb
```

From WP-03 on, the site reads its own address and the origins it trusts from environment variables instead of constants in the code. The production branch does not have WP-03. If WP-03, or `overhaul`, is ever built for the old production hosting, these must be set for that build, or server actions, Steam and Discord linking, card-duel requests, notification links, `robots.txt` and the assets all point at `localhost`:

```bash
NEXT_PUBLIC_SITE_URL=https://dota2inhouse.pl
ALLOWED_ORIGINS=https://www.dota2inhouse.pl,https://tournament-tracker-f35tb.web.app
NEXT_PUBLIC_ASSET_ORIGIN=https://tournament-tracker-f35tb.web.app
```

The sitemap of such a build also needs `DATABASE_URL`; without it the sitemap lists only the home page.

A push of that branch also redeploys the lobby bot on Railway, so it is pushed only when the bot should restart, and never while a game is being played. Agents never deploy, never push that branch, and never use the production service account.

**The new platform (later).** It does not exist yet. Go-live step one (WP-35) creates the production database and the Vercel production deployment, which then deploys from `overhaul`. Migrations reach it through an approved CI job like staging's. No build and no CI job holds production's database secret before then.

**The smoke test** runs after every go-live step and production deploy. It opens the home page and `/teams` and `/schedule` of two tournaments, and fails on an error status, an empty page, an error title or a console error. It never signs in and refuses every request that could write, so it is safe against production. From the terminal:

```bash
npx playwright install chromium       # once
SMOKE_BASE_URL=https://<address> npm run smoke
SMOKE_BASE_URL=https://<address> SMOKE_TOURNAMENTS=letnia,pdl-s2 npm run smoke
```

`SMOKE_BROWSER_CHANNEL=msedge` uses the installed Edge instead of downloading a browser. On GitHub: Actions, then Smoke test, then Run workflow, with the address. The default tournaments are `pdl-s2` and `wiosenna`.

## The lobby bot

The bot is in `bot-worker/`. Only compiled `dist/*.js` is committed (there is no TypeScript source), so edit `dist/` directly. `dist/` is git-ignored but tracked, so a new file under it is added with `git add -f <file>`.

To run or test it locally, a plain `npm install` is not enough: node-dota2 and steam need protobufjs 4 nested in two places and a patched `CSODOTALobby` proto. `setup-local.js` does what the Dockerfile does:

```bash
cd bot-worker
npm install
npm run setup:local        # idempotent; needs the network once
# bot-worker/.env from bot-worker/.env.example, then:
node dist/diagnose.js --bot-id=<botAccountId>
```

Pause the Railway service, or use an idle bot account, before logging one in locally: the same Steam account logged in twice kicks itself. CI tests the bot with fakes only and builds its image without pushing it.

## Files that are not in git

| File | For | Notes |
|---|---|---|
| `.env.local` | a plain `npm run dev` or `npm run build` | From `.env.local.example`, with staging values. Not needed for `dev:local`. |
| `.env.staging.local` | staging, in the `overhaul` worktree | From `.env.staging.example`; `docs/overhaul/SETUP_STAGING.md`. |
| `bot-worker/.env` | running the bot locally | From `bot-worker/.env.example`. |
| `.local/` | the local database and smoke test results | Delete it to start over. |

Rebuildable, never copied: `node_modules/`, `.next/`, `bot-worker/node_modules/`.
