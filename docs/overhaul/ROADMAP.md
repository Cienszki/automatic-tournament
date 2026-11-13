# Roadmap

Written in S1 (2026-11-13) by Fable, and rewritten the same day after the owner's answers (new database, production untouched until the new platform is ready, free plans first). It turns `ARCHITECTURE.md` into work packages (WPs). Each WP is written so that an Opus implementer can do it from this text, `BRIEF.md`, `CONVENTIONS.md` and the linked decision record (ADR), without the context of the session that planned it. S2 (organizer experience) and S3 (card game) add their own WPs to this file in the same format.

## How to read and run this

- **What is being built.** A new platform on the `overhaul` branch, beside the old site: PostgreSQL in place of Firestore, server-rendered pages, commands for every write. The old site, its Firestore data and its bot are not changed. The new platform takes over one tournament at a time (ADR-15).
- **Old code on the branch.** `src/lib`, `src/components` and the old pages stay as the reference until the WP that replaces each part deletes it. New code goes only into `src/features`, `src/platform`, `src/ui`, `contract/` and `bot-worker/src`. Keep the look of every screen: view components are moved and fed props, not redesigned, unless an S2 work package says otherwise.
- **Numbers.** WP ids are stable; they are not renumbered when the order changes. Read the milestones for the order. WP-02, WP-25 and WP-28 were dropped (see the end of this file).
- **For the implementer, every time.** Work in a worktree under `.claude/worktrees/` on branch `wp/NN-name` from `overhaul`. Follow the limits in `BRIEF.md`: no deploy, no writes to production, no script with production credentials, blank `FIREBASE_SERVICE_ACCOUNT_BASE64` and the other secrets for every local build. Done means: typecheck, lint, tests and build pass in CI; each acceptance criterion is checked off in the final report; `STATUS.md` is updated. Delete `.next` and other build output before finishing; the disk is nearly full.
- **Dependencies on this machine.** The worktree has no `node_modules` of its own and resolves packages from the main working copy, which lacks ESLint, Playwright and every package the new platform adds. Until the owner has run `npm ci` in the `overhaul` worktree (question 13), CI on GitHub is the only place where lint and the new tests run: push the `wp/*` branch and read the run.
- **Size.** S is up to half a day of agent work, M about a day, L two to three days, XL more and must be split by the orchestrator before starting.
- **Review.** "Fable" means a Fable review before merging, because a mistake would be costly or hard to see (security, data, the live bot, design-preserving rewrites). "Opus" means the `reviewer` agent is enough.
- **Rollback.** Every WP is one `--no-ff` merge, so `git revert -m 1 <merge>` undoes it. Nothing here reaches visitors until a go-live WP, and each of those has its own way back.

## Milestones

| Milestone | WPs | What is true when it is reached |
|---|---|---|
| M0 Ground | 05, 12, 03, 32, 33, 06, 04 | Dead code gone; a database schema with tests; real tournament data imported into it; staging exists; the hosting and database choice is proven by measurement |
| M1 Fast and read-only | 07, 13a, 15, 08, 09, 10, 11, 35, 39 | Every public page is served complete from the CDN out of PostgreSQL. **Go-live step one:** Letnia and finished seasons are served by the new platform, and PDL S2 is mirrored on it and compared with the old site every day |
| M2 Results run themselves | 14, 13b, 34, 16 | A played game becomes a result, standings, stats and fantasy points with no admin action; organizers' ranking rules decide ties and playoff places |
| M3 Organizers run a season | 24, 17, 18, 38, 40, 19 | Everything an organizer, referee or captain does is a command behind S2's new screens; the browser has no database access |
| M4 A bot we can maintain | 20, 21, 22, 23 | Bot source in TypeScript with tests, a written contract, its own database role, a plan to scale out |
| M5 A platform | 26, 27, 29, 36 | Custom domains, guarded themes, one translation system, backups and tournament export |
| M6 Proven and live | 30, 31, 37 | End-to-end flows green; load test passed. **Go-live step two:** PDL S2 moves to the new platform while it is being played. **Step three:** new seasons start there. **Step four:** the old site retires |

What can run in parallel: WP-05, WP-12 and WP-20 can start now and need nothing from the owner. M4 runs beside M1 to M3 (different folders). WP-04 runs beside anything. S2 must have run before WP-18 starts, because WP-18 builds S2's screens. The card game moves as it is in WP-40; S3 redesigns it later.

What waits for the owner: WP-03 (staging part), WP-06 and WP-35 need the accounts in `TEST_STRATEGY.md`, "What the owner must create". Question 8 is answered: the role-based formula is the default for new tournaments.

---

## M0. Ground

### WP-05. Delete what is dead

- **Goal.** The repository contains only code that can run, so every later agent reads less.
- **Files.** The 108 unreachable files listed in `inventory/CODE_HEALTH.md` section 3 (re-derive the list with an import graph before deleting); the legacy root pages `src/app/{teams,groups,schedule,playoffs,fantasy,pickem,stats,rules,faq,standins,register,my-team}` (they are redirected away; keep nothing); `scripts/` (move the few useful ones to `scripts/tools/` with a README, delete the rest); `_archive/`; root files `PERFORMANCE_*.md`, `database_schema.md`, `hero-data.json`, `.modified`, `apphosting.yaml`; unused dependencies `styled-components`, `date-fns-tz`; dead bot code on the website (`bot-pool-manager.ts` except `getBotPoolStatus`, `scheduleNextGameInSeries`); dead admin tabs `GroupsTab.tsx`, `StandinsTransfersTab.tsx`, `tabs/index.ts`; the legacy playoff system that only root pages used (`context/PlayoffContext.tsx`, `components/app/PlayoffBracketDisplay*.tsx`, `bracketConverter.ts`) if the import graph shows nothing else reaches it; outdated docs in `docs/` that describe `/api/admin`.
- **Design.** `ARCHITECTURE.md` B10. Deletions only. Do not fix behaviour in old code: it is replaced later and the old production branch does not receive this WP. Deletions go in separate commits per group, each proven by `tsc` and the build, as S0 did.
- **Acceptance.** The import graph finds no unreachable file under `src`; `scripts/` has a README and fewer than 15 files; build, typecheck and tests pass; the report lists every deleted group and its line count. Keep a file if it holds the only copy of a rule that a later WP names as its source (check the "Files" lists of WP-13, WP-15, WP-16, WP-33).
- **Tests.** A script `scripts/tools/unreachable.mjs` that prints unreachable files, wired into CI as a failing check.
- **Risks and rollback.** A file that looked dead is loaded by a dynamic import the graph missed. The build catches most; revert the single commit.
- **Dependencies.** None.
- **Size.** M. **Review.** Opus.

### WP-12. Capture tool and parity fixtures

- **Goal.** Real tournament data on disk, in one export format, captured without credentials; and a record of what the old site shows for it. This feeds the import tool (WP-33) and is the proof that the new platform computes the same tables.
- **Files.** New `scripts/tools/capture/` (TypeScript, run with the existing `tsx` or plain Node; no new dependency), new `fixtures/exports/<slug>/` (reduced, checked in) and `data-exports/` (full, git-ignored), new `docs/overhaul/EXPORT_FORMAT.md`.
- **Design.** `TEST_STRATEGY.md` level 1, "parity fixtures".
  1. The tool reads a tournament through Firestore's public REST API, read-only, as S0 did for its measurements. It walks the publicly readable collections of `inventory/DATA.md`: the tournament document, `teams` with `players`, `matches` with `games` and `performances`, `divisions`, `groups`, `standings`, `swissRounds`, `playoffs`, `playoff_matches`, `announcements`, `rules` with `paragraphs`, `prizes`, `standins`, `standinRequests`, `fantasyLineups`, `pickems`. For Letnia it walks the root collections of the same names.
  2. Output: one folder per tournament, one JSON-lines file per collection, each line `{ path, data }` with Firestore value types decoded (timestamps as ISO strings). `EXPORT_FORMAT.md` describes it. The owner's later full export of the private collections uses the same format.
  3. Capture `letnia`, `wiosenna`, `pdl` and `pdl-s2` in full into `data-exports/`. Rate-limit the requests (a few per second) and stop on the first 429.
  4. The checked-in fixtures are reduced copies of `pdl-s2` and `wiosenna`: everything personal removed except nicknames and Steam ids, which are public; user ids replaced by stable fake ids.
  5. Alongside each fixture, store what the old site publishes for it, captured from the same data by calling the old functions where they are pure, and otherwise by copying the numbers from the live pages: the standings of every division or group in page order, each team's record, and the stats hub's season totals.
  6. Record 8 to 10 OpenDota match responses for games in the fixtures: a normal game, an unparsed game, a game with a stand-in, a practice game.
- **Acceptance.** The four full captures exist locally with a count per collection in the report; the two fixtures are in git and contain no e-mail address, token or Discord id (a test scans for them); the published standings are stored for every division and group; the format document exists.
- **Tests.** A parser test for the export format; the personal-data scan.
- **Risks and rollback.** A collection that is not publicly readable returns 403: list it in the report as "needs the owner's export". The capture only reads.
- **Dependencies.** None.
- **Size.** M. **Review.** Opus.

### WP-03. Environments: local database, seed, CI and previews

- **Goal.** One command gives a developer or an agent a working local site on a seeded database; CI runs every test level that exists; a branch can be previewed on staging.
- **Files.** `.github/workflows/` (ci, preview, migrate), new `scripts/seed/` (TypeScript), `next.config.mjs` (origins from environment variables: replace the hard-coded `FIREBASE_ORIGIN`; `allowedOrigins`), `src/app/sitemap.ts` (generated at request time from the database with a one-hour cache; a build reads nothing), `docs/DEV_SETUP.md`, `.env.local.example`, `package.json` scripts (`db:migrate`, `db:seed`, `dev:local`).
- **Design.** ADR-15; `TEST_STRATEGY.md` section 2.
  1. The seed module builds one tournament per format (league with divisions, group stage with playoffs, Swiss, LAN qualifier) at chosen stages, with teams, rosters, matches, games and performances, using builders that later tests reuse. It refuses to run against a database whose URL is not local or the staging one.
  2. CI: typecheck, lint, unit tests, database tests on PGlite and on a PostgreSQL service container, build with every secret blank. A job applies migrations to staging on merge to `overhaul`, with a manual approval.
  3. A read-only production smoke test script (Playwright, five URLs of two live tournaments) that the owner or CI can run after a go-live step.
- **Acceptance.** `npm run db:seed` then `npm run dev:local` (on a port other than 3000) gives a browsable local site with four tournaments, for every page that has been moved to the new platform; a build with blank secrets succeeds and opens no network connection (asserted); no file contains the production origin as a literal except documentation; `docs/DEV_SETUP.md` describes local, staging and production in one page.
- **Tests.** Seed builders give rows that pass the schema; the blank-secrets build check.
- **Risks and rollback.** The staging jobs need the owner's accounts (question 5). Everything else can be finished without them; mark those jobs as waiting.
- **Dependencies.** WP-32.
- **Size.** M. **Review.** Opus.

### WP-32. Database schema, version 1, and `platform/db`

- **Goal.** The data model of the new platform exists as a reviewed schema with migrations and tests, and code has one way to reach the database.
- **Files.** New `src/platform/db/` (`schema/*.ts` one file per table group, `client.ts`, `scoped.ts`, `ids.ts`, `testing.ts`), `drizzle/` (generated SQL migrations), `drizzle.config.ts`, new `docs/overhaul/SCHEMA.md`, `package.json` (add `drizzle-orm`, `drizzle-kit`, `postgres`, `@electric-sql/pglite`).
- **Design.** ADR-04, ADR-05, ADR-06, ADR-09, ADR-10. Inputs: `inventory/DATA.md`, `src/types/tournament.ts`, `src/lib/definitions.ts`, `src/types/lobby-bot.ts`, and the real documents in `data-exports/` from WP-12.
  1. **Write `SCHEMA.md` first and stop for a Fable review before writing migrations.** For each table: columns, keys, what it replaces in Firestore, and every field of the old documents that is dropped, with the reason.
  2. Table groups are those of ADR-04. One model for every format: `stages` (kind `round_robin`, `swiss`, `bracket`; ordered; `ranking` and `advancement` as JSON validated by the schemas of ADR-11), `groups` inside a stage, `matches` (stage, group, round, two team ids, format, scheduled time, status, score, `kind` regular/tiebreak/rematch/showmatch, bracket slot and the next match for winner and loser), `games`, `performances`.
  3. Ids are text. Imported rows keep their Firestore id, so every old link keeps working; new rows get a generated id (`ids.ts`). `users.id` is the Firebase user id.
  4. Every tournament table has `tournament_id` as the first column of its primary key or of an index, and foreign keys between tournament tables include it. `scoped(db, tournamentId)` returns helpers that add the filter, so a query cannot forget it.
  5. Tables live in schemas `app` and `bot`, never `public`. Row-level security is enabled on every table with no policy. A role `bot_worker` can use only schema `bot` and insert into `app.jobs`.
  6. Typed columns for whatever is filtered, joined or summed; JSON (validated by zod in code) for theme, format settings and the long tail of a performance.
  7. `testing.ts` gives each test file a fresh PGlite database with migrations applied in under a second.
- **Acceptance.** Migrations apply cleanly on PGlite and on PostgreSQL 15 or later in CI; a schema test walks the catalog and fails on a tournament table without `tournament_id`, a foreign key that omits it, a table in `public`, or a table without row-level security; a test proves the `bot_worker` role cannot select from `app.matches`; every field of the captured documents is either mapped or listed as dropped in `SCHEMA.md`; a unique slug and a unique `(tournament_id, dota_match_id)` are enforced by the database.
- **Tests.** The schema tests above; a round trip for each JSON column's validator.
- **Risks and rollback.** A schema mistake found late costs a migration, not a rewrite; migrations are cheap until production data exists (go-live step one). After that, every change is an additive migration with a test.
- **Dependencies.** WP-12 (real documents to design against). The schema can start from the type files alone if WP-12 is late.
- **Size.** L. **Review.** Fable, twice: `SCHEMA.md`, then the result.

### WP-33. The import tool

- **Goal.** A tournament in the export format becomes rows in the new database, any number of times, with a report that proves nothing was lost. Letnia is imported as an ordinary tournament.
- **Files.** New `scripts/import/` (`index.ts`, one mapper per table group, `legacy-letnia.ts`, `report.ts`), new `scripts/tools/export-firestore.mjs` (the owner's read-only export of the private collections, written here and never run by an agent), tests with the WP-12 fixtures.
- **Design.** ADR-04 "How the data gets there", ADR-05.
  1. `import --from data-exports/<slug> [--anonymize]` maps each collection to its tables in one transaction per tournament. Every write is an upsert by id, so a second run changes nothing and a later run brings a tournament up to date.
  2. `legacy-letnia.ts` maps the root collections to the same intermediate shape as a scoped tournament before the common mappers run. Record every difference it handles (the stats explorer noted that a legacy performance's `playerId` is the document id).
  3. Stages and groups are derived: a league's `divisions` become groups of one round-robin stage; `groups` likewise; `swissRounds` become a Swiss stage with its rounds on the matches; `playoff_matches` become matches of a bracket stage with their links, and the mirror copies in `matches` are skipped.
  4. The ranking rules of each stage are set to what that tournament uses today (ADR-11 defaults; the explorer's table in WP-13a lists them).
  5. One organization per distinct organizer; user rows are created as stubs for every user id that data refers to, and filled in when the owner's export of `users` and `accounts` is imported.
  6. `--anonymize` replaces e-mail addresses, Discord ids and names in private tables; it is required when the target is staging.
  7. `report.ts` prints, per table, source count and row count, and compares the standings computed by the new code (once WP-13a exists; until then counts only) with the published standings stored by WP-12.
  8. The tool refuses a target that is not local, staging, or the new production database named in an environment variable, and it never writes to Firestore.
- **Acceptance.** The four captured tournaments import into a local database with matching counts; a second run reports zero changes; Letnia's teams, matches, games and performances are in the same tables as the others, with slug `letnia`; rows that could not be mapped are listed, not dropped silently; no code path in the new platform mentions Letnia.
- **Tests.** Mapper tests on the fixtures; idempotency; the Letnia adapter on a reduced Letnia fixture; the refusal of a wrong target.
- **Risks and rollback.** Old documents have shapes nobody remembers. The report makes every unmapped field visible; the Fable review reads the report for all four tournaments.
- **Dependencies.** WP-32, WP-12.
- **Size.** L. **Review.** Fable.

### WP-06. Trial: a fast page on the chosen hosting and database

- **Goal.** Measured proof, or disproof, that the target read path works end to end before M1 is built on it: Vercel on the free plan, Supabase in Frankfurt, cache invalidation by tag, and forwarding to the old site. This is the riskiest unknown in the plan.
- **Files.** A branch with throwaway code except the parts named "keep": `src/platform/cache/` (`cachedQuery`, `tags`) (keep), `src/middleware.ts` (the forwarding rule, keep), one server-rendered page (`[tournamentSlug]/teams`) reading PostgreSQL, `scripts/measure/` (keep), `docs/overhaul/spikes/WP-06.md`.
- **Design.** ADR-01, ADR-02, ADR-03, ADR-04, ADR-09, ADR-15.
  1. The owner creates the staging accounts (question 5). If they do not exist yet, do every step that can be done locally and report the rest as not done.
  2. Import `pdl-s2` into staging. The trial page renders its teams on the server from one cached query, with the theme as CSS variables in the HTML and no loading gate.
  3. Forwarding: a slug that is not in the new database, and any path the new app does not serve (the old site's `/_next/` files, its `/api/` routes), is forwarded to the old site's address. Load an old-site tournament through the new app and use it.
  4. Put a copy of the community site's forwarding rule in front and navigate between two pages through both hops.
  5. Change a team name in the database, call the invalidation, and time how long the old page is still served.
  6. Scheduler: enable `pg_cron` and `pg_net` on the staging database; have the database call a test endpoint only when a row is due.
  7. Connection handling: run 200 concurrent uncached requests and confirm the pooled connection holds.
- **Acceptance.** A written result with numbers for: time to first byte and Largest Contentful Paint, cold and warm, direct and through the forwarding; whether the HTML and the client-navigation payload are both served from the CDN cache (response headers quoted); seconds from invalidation to fresh content; a query's round trip from a function to the database; whether an old-site page works fully through the new app (sign-in included); whether the scheduler extensions work on the free plan; the CDN requests one page view costs (to check the estimate in `COSTS.md`); anything in the app that does not run on this hosting. A clear recommendation: go, go with changes, or switch to the fallback of ADR-03.
- **Tests.** The measurements are the tests.
- **Risks and rollback.** None for production; nothing merges except the kept helpers.
- **Dependencies.** WP-32, WP-33 (one imported tournament), the owner's accounts.
- **Size.** M. **Review.** Fable (decision gate for ADR-03 and ADR-04's host).

### WP-04. Error monitoring and structured logs

- **Goal.** When something breaks on the new platform, the owner is told within minutes, with the tournament and the release.
- **Files.** New `src/platform/log/`, `src/platform/alerts/` (Discord webhook with de-duplication), a Sentry provider for `src/lib/error-reporting.ts` (move it to `src/platform/errors/`), `src/app/error.tsx`, `global-error.tsx`, `instrumentation.ts`, a web-vitals reporter component, a usage check job stub (filled in by WP-14).
- **Design.** ADR-13. DSNs and the webhook URL come from environment variables; with none set, everything is a no-op, so this merges before the owner creates the accounts. The bot's side is in WP-22.
- **Acceptance.** With a DSN set on staging, a thrown error in a page and in a route each appear in Sentry with release, tournament id and user id. No secret or token appears in an event (checked by a scrubbing test). The same alert is sent once, not once a minute.
- **Tests.** Unit tests for the logger, the scrubber and the alert de-duplication.
- **Dependencies.** None. The owner agreed to create the accounts (question 9).
- **Size.** S. **Review.** Opus.

### WP-01. On request: close the unauthenticated server actions on the old site

- **State.** Not scheduled. The owner decided that old production is not changed until the new platform is ready (questions 1 and 4). The new platform does not have these holes by construction (ADR-07). This package stays here so that, if the owner changes that decision, the patch is one request away.
- **Goal.** No server function on the old site that reads private data or writes anything can be called without a permission check. Small enough to cherry-pick to the production branch together with S0's commit `3db4e3e`.
- **Files.** `src/lib/standin-actions.ts`, `src/lib/bot/bot-config-actions.ts`, `src/lib/playoff-sync-actions.ts`, `src/lib/player-profile-actions.ts`, `src/lib/fake-team-action.ts`, `src/lib/admin-actions.ts`, `src/lib/match-players-action.ts`, `src/lib/team-actions.ts` (`getUserTeam`); their importers (`MyTeamView.tsx`, `MatchPanel.tsx`, `StandinsTab.tsx`, `MatchesTab.tsx`, `PDLMatchRules.tsx`); routes `api/manage/bot/config` (GET), `api/manage/bot/sessions` (GET), `api/pickem/export`, `api/dev/*`.
- **Design.** For each `'use server'` file: functions that only server code calls move to a module that starts with `import 'server-only'`; functions a client calls become route handlers that call `requireAdmin` or `requireUser` plus the specific check (captain of the opponent team for approving a stand-in). `saveTournamentBotConfig` takes the actor from the verified token.
- **Acceptance.** A signed-in user who is not the opponent's captain gets 403 when approving a stand-in; the right captain succeeds; the bot tab and stand-in flow work for the right roles.
- **Size.** M. **Review.** Fable.

---

## M1. Fast and read-only

### WP-07. Platform kernel and enforced boundaries

- **Goal.** The shared machinery that every later WP uses exists, is tested, and the lint enforces the module rules.
- **Files.** New `src/platform/`: `auth/` (`getActor` from the ID token verified with `jose` against Google's keys, `authorize`, the role-to-action table), `http/defineCommand.ts`, `http/defineQueryRoute.ts`, `cache/` (from WP-06), `errors.ts`, `tenancy/` (`getTournamentBySlug`, `getTournamentByHost`), `files/` (Storage upload addresses); `eslint.config.*` (boundaries, size limits, import allowlists, the ratchet script); `src/features/README.md`.
- **Design.** ADR-02, ADR-05, ADR-06, ADR-07, ADR-14; `CONVENTIONS.md` sections 5, 6, 12.
  - `authorize` implements the table of ADR-06 from `organization_members`, `tournament_members` and `teams.captain_user_id`.
  - `defineCommand` parses, authorizes, runs the handler in a transaction, writes the audit row in the same transaction, then invalidates tags and inserts jobs. Typed errors become JSON with a stable `code`.
  - The Firebase Admin SDK is imported only where a custom sign-in token is minted.
- **Acceptance.** The kernel imports nothing from `src/features`, `src/lib` or `src/components`; one example command and one example query work end to end against PGlite; the lint fails on a deliberate violation of each boundary rule (shown in the report) and passes on the repo; the ratchet numbers are recorded in a checked-in file.
- **Tests.** Table test of `authorize` for every role and action; database tests for `defineCommand` (allowed, forbidden, invalid, id from another tournament, audit written, rollback on error) and for `cachedQuery` tag invalidation; token verification with a locally signed key.
- **Dependencies.** WP-32, WP-06 result (the cache helper's final shape).
- **Size.** L. **Review.** Fable.

### WP-13a. Standings and ranking rules as pure functions

- **Goal.** One implementation of "who is ahead of whom" per stage kind, driven by rules stored on the stage, reproducing what each existing tournament publishes.
- **Files.** New `src/features/formats/domain/` (`ranking/schema.ts`, `ranking/tiebreakers/*.ts`, `standings-round-robin.ts`, `standings-swiss.ts`, `series.ts`). Sources to read and then replace (deleted by the WP that moves each page): `src/hooks/useDivisionData.ts:381-393`, `usePDLData.ts:267-279`, `src/lib/swiss/pairing.ts:121-193`, `src/lib/api/groups.ts:107`, `components/tournament/MmrTournamentHomePage.tsx:25-37`, `components/app/GroupTable.tsx:15-52`, `app/[tournamentSlug]/teams/page.tsx:28-52`, `components/team/MyTeamView.tsx:1711-1725`, `lib/stats-lab/season.ts:198-213`, `app/[tournamentSlug]/playoffs/page.tsx:57-85`, `lib/match-flags.ts`.
- **Design.** ADR-11 "Ranking rules".
  - `ranking` schema: `points` (win, draw, loss; or `games_won` for Swiss) and an ordered `tiebreakers` list from the catalogue: `head_to_head`, `game_difference`, `games_won`, `neustadtl`, `buchholz`, `match_wins`, `lower_mmr`, `tiebreak_match`, `manual`.
  - Each tie-breaker is a pure function from the tied teams and their matches to an ordering with ties. The engine applies them in order and recurses into subsets that are still tied. Head-to-head is a mini-table among the tied teams (today it is a sum of wins, which differs for three or more tied teams; pin today's behaviour as `head_to_head_wins` and use it in the defaults so that published tables do not change).
  - Output per team: place, shared-place flag, record, the value of each tie-breaker used, and `openTie` when `tiebreak_match` or `manual` is reached without a decision.
  - Which matches count: regular matches and rematches; not tiebreak, showmatch or replaced matches (`match-flags.ts` today).
  - Defaults per existing tournament: 2/1/0 with head-to-head wins, Neustadtl, lower MMR for leagues and groups; games won with Buchholz, match wins, game difference for Swiss.
- **Acceptance.** For every division and group in the WP-12 fixtures, the function returns the published order; property tests hold (points sum to two per completed match under 2/1/0; reordering input does not change output; a tie-breaker never reorders teams that an earlier one separated); every catalogue entry has table tests, including three-way ties.
- **Tests.** Level 1 only. No database.
- **Dependencies.** WP-12. No dependency on the database.
- **Size.** M. **Review.** Fable.

### WP-15. The `stats` feature: one compute, read from PostgreSQL

- **Goal.** Everything derived from results is computed by one pure function from rows, inside cached queries. The old calculators are not ported.
- **Files.** `src/lib/stats-lab/*` (moves into `src/features/stats/domain`; `build-dataset.ts` is rewritten to take rows), new `src/features/stats/queries.ts`, `src/app/api/v1/stats/dataset/route.ts`, `src/components/tournament/RankingsView.tsx`. Not ported, deleted when their last importer goes: `comprehensive-stats-calculator.ts`, `stats-calculator-*.ts`, `stats-service-simple.ts`, `post-sync-recalculations.ts`, `performance-rankings-calculator.ts`, `api/stats/recalculate`, `api/rankings/recalculate`.
- **Design.** ADR-02, ADR-11.
  - `loadTournamentInput(tournamentId)` fetches teams, members, matches, games and performances in a fixed, small number of statements.
  - `computeTournament(input)` returns the dataset the stats hub uses today, standings per stage (through WP-13a) and the performance rankings.
  - `getDataset(tournamentId)` is a cached query with the `stats` tag; the endpoint serves it compressed with CDN caching.
  - Measure the compute on the largest imported tournament. If it is above 300 ms, add a stored copy written by the `recompute` job (WP-14) and say so in the report; otherwise store nothing.
- **Acceptance.** For the imported `pdl-s2` and `wiosenna`, the stats hub's season totals and the rankings equal the published values from WP-12 (list any difference with its cause); the statement count of `loadTournamentInput` is constant for any tournament size (asserted); the compute time is in the report.
- **Tests.** Level 1 for `computeTournament` on the fixtures; a database test for the loader with a statement counter.
- **Dependencies.** WP-13a, WP-32, WP-33.
- **Size.** L. **Review.** Fable.

### WP-08. The server-rendered shell

- **Goal.** Every tournament page gets its tournament, theme, title and navigation from the server in the first response. The loading gate and the whole-collection read are gone.
- **Files.** `src/app/layout.tsx`, `src/app/[tournamentSlug]/layout.tsx` (becomes a server component with a small client shell), `src/context/TournamentContext.tsx`, `src/i18n/request.ts`, `src/components/tournament/TournamentRedirect.tsx`, `DraftGate`, `DynamicFontLoader`, `ThemeFontApplier`, `LoadingScreen` usage, `src/context/AuthContext.tsx` (remove the `/api/session` cookie call), `src/app/api/session/` (delete), new `src/features/tournaments/{queries.ts,domain/theme.ts,components/}`, `generateMetadata` and an `opengraph-image` for the tournament layout, `src/middleware.ts` (the forwarding rule from WP-06).
- **Design.** ADR-01, ADR-08 (theme and language parts), ADR-15 (forwarding), section 2.1.
  1. `getTournamentBySlug` (cached, tag `core`) loads the tournament on the server. `TournamentProvider` stays as a client context **seeded from server props**, so the components that call `useTournament()` keep working. It no longer fetches anything. The tournament type the context exposes is built from the new rows by one adapter, so view components can be moved without rewriting them all at once.
  2. The theme is rendered as a `<style>` block of CSS variables in the layout, for all variables that `TournamentContext` sets today. Remove the inline script, the session cache and the hard-coded Letnia and PDL fallback configs.
  3. Children render immediately. The full-screen loading screen remains only for the home page hero, with a hard cap (suggest 1.2 s) and never covering content that is ready. Fonts use `font-display: swap`.
  4. Language comes from the tournament; `request.ts` reads no cookie. Pages become static per slug with on-demand regeneration.
  5. A slug the database does not have is forwarded to the old site. A draft tournament renders per request with `no-store` and checks the admin token or the preview token.
  6. Each tournament page has a title, description and preview image from the tournament.
- **Acceptance.** `curl` of any imported tournament's page returns HTML containing the tournament name, the theme variables and the navbar, with a cacheable `Cache-Control`; the browser makes no Firestore request (network log); the build output marks tournament pages as static or ISR; a draft tournament is invisible without access; visual comparison of the shell for wiosenna and pdl-s2 against production shows no unintended difference (screenshots in the report); sign-in still works.
- **Tests.** Server tests for the theme-to-CSS function (including `hsl()` colours) and for draft access; Playwright flow 1 on the seeded tournaments; a test that the layout runs at most two statements on a cache miss.
- **Risks and rollback.** Hydration mismatches from theme or time; components that assumed `tournament` could be null. Keep the context API identical.
- **Dependencies.** WP-07, WP-33.
- **Size.** L. **Review.** Fable.

### WP-09. Public subpages on cached queries

- **Goal.** Teams, schedule, groups and divisions, playoffs, rules, news, prizes and the static pages arrive complete from PostgreSQL, with no second loader.
- **Split.** 09a teams, team page, player page and schedule; 09b groups, divisions, Swiss, playoffs; 09c rules, news, prizes, about, FAQ, format pages, diploma. Each is its own branch.
- **Files.** `src/app/[tournamentSlug]/{teams,schedule,groups,divisions,playoffs,rules,news,prizes,about,faq,format-lan,privacy,diploma}/page.tsx`, `src/hooks/usePDLData.ts`, `useDivisionData.ts` (deleted when their last user is moved), new `src/features/{teams,schedule,formats,content}/queries.ts` and `components/`.
- **Design.** ADR-01, ADR-02; `CONVENTIONS.md` section 1 example.
  - Each page becomes a server component that calls cached queries and renders the existing view component with props. The view keeps its look; its data-fetching effect and its `<LoadingScreen/>` are removed.
  - Queries return slim shapes (the teams list does not carry roster detail the page does not show).
  - Standings come from WP-13a through one query. The bracket is drawn from the bracket stage's matches.
- **Acceptance.** For each page, on the imported tournaments: content in the first HTML; no Firestore request; the same content as the old site's page for the same tournament (screenshots side by side, differences listed); First Load JS for the route lower than in `inventory/PAGES.md` section 3; each query has a statement ceiling.
- **Tests.** Database tests per query (shape and statement ceiling); Playwright flow 1 extended to each page.
- **Dependencies.** WP-08, WP-13a.
- **Size.** L in total (M each). **Review.** Opus; Fable for 09b (standings and brackets must not change).

### WP-10. The home page on server data, and deep links without redirects

- **Goal.** The home page keeps its design and gets its data from the server. `/stats`, `/rankings`, `/teams/[teamId]` and the player page open the right section directly.
- **Files.** `src/app/[tournamentSlug]/page.tsx`, `src/components/tournament/FullScreenHomePage.tsx` (1,142 lines; split by section while here), `LeagueHomePage`, `MmrTournamentHomePage`, `src/context/HomeNavigationContext.tsx`, `src/app/[tournamentSlug]/{stats,rankings}/page.tsx`, `HeroMediaGateProvider`, `src/components/stats-lab/kit.tsx`.
- **Design.** Section 2.1 points 4-6.
  - The page loads teams, matches, standings and bracket once through the WP-09 queries and passes them to the client shell. The browser reads are removed.
  - `?view=` stays a client-side concern so the HTML is the same for every view. The deep-link routes render the same shell with an `initialView` prop.
  - Heavy sections (stats hub, account, my team, pick'em) stay lazy. The stats dataset is prefetched when the browser is idle, as now. Sections that are not on the new platform yet (cards; my team and pick'em until M3) are hidden by a feature flag, not broken.
  - Per-user data loads after the page is shown.
- **Acceptance.** The home page's first HTML contains the hero text and the first section's data; no Firestore request; deep links make no client redirect; scrolling, snapping, section order and animations are unchanged (side-by-side recording in the report); no part exceeds 400 lines.
- **Tests.** Component tests for section navigation; Playwright for the deep links and for the snap-scroll order.
- **Risks and rollback.** The owner's favourite page: any visible change is a defect. The reviewer compares recordings at three widths.
- **Dependencies.** WP-09a, 09b, WP-15.
- **Size.** L. **Review.** Fable.

### WP-11. Performance budgets in CI and a lighter bundle

- **Goal.** Speed cannot regress unnoticed, and no page ships the Firebase data SDK.
- **Files.** `.github/workflows/` (Lighthouse CI, bundle report), `lighthouserc.*`, `src/lib/firebase.ts` (reduced to Auth, loaded after the page is interactive), `src/context/AuthContext.tsx`, `src/platform/http/rate-limit.ts` (a table-backed limiter; client address from the proxy's header through one helper).
- **Design.** `TEST_STRATEGY.md` level 7; ADR-12.
- **Acceptance.** The budgets table of `TEST_STRATEGY.md` is enforced for home, teams, schedule and a team page; `firebase/firestore` is absent from every moved page's bundle (bundle report); the limiter works behind the proxy (test with forwarded headers).
- **Dependencies.** WP-10.
- **Size.** M. **Review.** Opus.

### WP-35. Go-live step one: the archive

- **Goal.** Letnia and the finished seasons are served to real visitors by the new platform. Nothing else changes for anyone.
- **Files.** `docs/overhaul/runbooks/go-live-1.md`, `scripts/tools/compare-sites.mjs` (fetches the same pages from the old and the new site and lists differences in titles, team names, table rows).
- **Design.** ADR-15 "Going live", steps 2 and 3. The runbook is written and rehearsed on staging by an agent; **the owner runs it.** Steps: create the production database and Vercel project; apply migrations; import `letnia` and each finished season from fresh captures; run the comparison; set the community site's forwarding to the new app; run the smoke test; watch errors for a day. Rollback: set the forwarding back.
- **Acceptance.** The rehearsal report shows every step working on staging, including an old-site tournament used through the new app with sign-in; the comparison lists no unexplained difference; after the owner's run, `/letnia` opens, Largest Contentful Paint for an archived tournament's pages is under 2.5 s on a phone profile, and the running seasons behave exactly as before.
- **Risks and rollback.** The forwarding breaks something on the old site for a running season. The trial (WP-06) and the rehearsal test exactly this; rollback is one setting.
- **Dependencies.** WP-08 to WP-11, WP-15, the owner's production accounts.
- **Size.** S for the agent. **Review.** Fable.

### WP-39. Mirror a live season and compare it every day

- **Goal.** PDL S2, while it is being played on the old site, is also on the new platform, kept up to date, and a daily report says where the two sites differ. This is the owner's way of testing on a real tournament.
- **Files.** `tournaments.serving` (`mirror` or `live`; a migration), `src/middleware.ts` (the public domain serves only `live` tournaments and forwards the rest), `.github/workflows/mirror.yml`, `scripts/tools/compare-sites.mjs` (from WP-35), `scripts/tools/mirror-report.ts`.
- **Design.** ADR-15 "Going live", step 4, "Mirror".
  1. A scheduled CI job (every few hours, and on demand) runs the WP-12 capture for `pdl-s2` and the WP-33 import into the new production database. Both are safe to repeat. The capture only reads public data.
  2. A mirrored tournament is visible on the new app's own address and on preview addresses, with a small "mirror of the live site, data from HH:MM" note for signed-in admins only. On the public domain its paths are forwarded to the old site.
  3. The report compares, for the mirrored season: every standings table (order and numbers), every match result, the schedule, and the stats hub's totals, between what the old site publishes (the capture's `published/` files, regenerated each run) and what the new code computes from the imported rows. Once WP-13b exists, it also runs `recordGame` with `dryRun` for each newly captured game and compares the rows it would write with the imported ones.
  4. The report is a short page for the platform admin and one line in the alert channel: "PDL S2 mirror: 0 differences" or the list.
- **Acceptance.** The job has run for a week of real matches with no manual step; each difference it reported is either fixed or explained in the report's "known differences" list; the mirror never appears on the public domain; a failed capture or import raises an alert and leaves the previous data in place.
- **Tests.** The comparison on two fixtures with a planted difference; the middleware rule for `mirror` and `live`.
- **Risks and rollback.** The mirror reads production through public reads a few times a day; keep the request rate low. Switching it off is disabling the job.
- **Dependencies.** WP-35 (the new production database and app exist), WP-12, WP-33, WP-15.
- **Size.** M. **Review.** Fable.

---

## M2. Results run themselves

### WP-14. The job queue

- **Goal.** Background work is a visible, retried, per-tournament queue driven by the database.
- **Files.** New `src/platform/jobs/` (`enqueue.ts`, `runner.ts`, `registry.ts`), `src/app/api/v1/jobs/tick/route.ts`, a migration that schedules the `pg_cron` check, a platform-admin page listing jobs.
- **Design.** ADR-09.
  - Claiming uses `FOR UPDATE SKIP LOCKED`; one job per tournament at a time; a time budget per tick; retries with growing delay; `failed` raises an alert through WP-04.
  - The cron statement calls the tick endpoint only when a job is due. In local development and tests, the runner is called directly.
  - Job types registered here as their features arrive: `import-results`, `apply-forfeit`, `recompute` (invalidate, warm, side effects), `send-reminder`, `refresh-avatars`, `usage-check`.
- **Acceptance.** Two runners never run the same job (test with two connections); a failing job retries and ends `failed` with one alert; one tournament's slow job does not delay another's (test with an artificial delay); an idle database causes no call to the tick endpoint; the admin page shows waiting, running and failed jobs per tournament.
- **Tests.** `TEST_STRATEGY.md` level 4, jobs paragraph; an idempotency test per job type.
- **Dependencies.** WP-07.
- **Size.** M. **Review.** Fable.

### WP-13b. The `results` feature: one way to change a result

- **Goal.** Every change to a result goes through one small set of tested commands, and a played game is imported without an admin.
- **Files.** New `src/features/results/` (`domain/identify-teams.ts`, `select-match.ts`, `series.ts`, `parse-opendota.ts`; `commands.ts`; `jobs.ts`). Sources to read: `src/lib/pdl-admin-actions.ts` (2,200 lines), `src/lib/opendota.ts`, `unified-game-save.ts`, `admin-match-actions-server.ts`, `match-flags.ts`, `playoff-result-bridge.ts`, `playoff-advancement.ts`, `src/app/api/manage/pdl/*`, `api/manage/extra-match`, `api/manage/ban-team`.
- **Design.** ADR-11.
  - `domain/`: `identifyTeams`, `selectMatch`, `seriesState(format, games)`, bracket advancement, all pure, with the recorded OpenDota responses from WP-12 as test input.
  - `commands.ts`: `recordGame`, `deleteGame`, `forfeitMatch`, `revertForfeit`, `setManualResult`, `addExtraMatch`, `banTeam`, `skipGame`. Each invalidates `matches`, `standings`, `stats` and enqueues `recompute`.
  - `jobs.ts`: `import-results` fetches a game by Dota match id (or lists a league's games), parses it, and calls `recordGame`. A game is imported once: the unique key is `(tournament_id, dota_match_id)`. An unparsed game is retried by a job with a later `run_at`.
  - A tournament without a Steam league id cannot sync and says so.
  - Behaviour that differs from the old site, each with a test: a full-series forfeit moves the standings; a forfeited game in a bo3 does not complete the series at two game rows; a manual edit moves the standings.
- **Acceptance.** Feeding the fixture tournaments' recorded games through `import-results` into an empty schedule reproduces the fixture's match scores; the three fixes have tests; `recordGame` with `dryRun` returns what it would write; no name contains `PDL`.
- **Tests.** Level 1 for the domain with property tests; level 4 for each command and the job.
- **Dependencies.** WP-07, WP-13a, WP-14.
- **Size.** L. **Review.** Fable.

### WP-34. Tiebreaker matches, ranking across groups, and places into bracket slots

- **Goal.** An organizer's rules decide ties and fill the playoff bracket: tiebreaker matches when the rules ask for one, teams from different groups compared for the remaining places, and each place mapped to a slot and seed.
- **Files.** `src/features/formats/domain/` (`advancement/schema.ts`, `advancement/resolve.ts`, `ranking/cross-group.ts`, `bracket/generate.ts` from `src/lib/playoff-bracket-generator.ts`), `src/features/formats/commands.ts`, the `lan-qualifier` engine (`src/lib/lan-qualifier/engine.ts`) as a reference for tie-settling matches.
- **Design.** ADR-11 "Ranking rules". Today none of this exists in code: the admin picks teams for first-round slots from a dropdown, `lowerBracketTeams` and `wildcardSpots` are stored and never read, and a tiebreak match is only a flag that keeps it out of the table.
  - `advancement` on a stage: a list of entries `{ from, to }`. `from` is either `{ group, place }` or `{ place, best: n, by: [...] }` (the best n teams of that place across all groups). `to` is a slot of a later stage, or `eliminated`.
  - Cross-group comparison uses rules that are fair across groups of different sizes: points per match, game difference per match, games won per match, `tiebreak_match`, `manual`.
  - `resolveAdvancement(standings, advancement)` returns the filled slots, or the list of open ties that block it.
  - The bracket generator takes a list of slots with byes and entry rounds, so a team can enter in round two or in the lower bracket, and 12 teams do not need 16 slots of hand editing. Single and double elimination; the lower bracket is generated from its own entries.
  - Commands: `createTiebreakMatches(stage, tie)` (one match for two teams, a round robin for three or more; kind `tiebreak`, linked to the tie it settles), `decideTieManually(stage, order, reason)`, `seedBracket(stage)` (runs the resolution and places teams; refuses while a tie is open; the organizer can still move a team by hand, and that is audited).
  - A tiebreak match's result orders its teams in the standings and adds no points.
  - Presets for S2's screens: top N per group; top N plus best K of the next place; cross-seeding (A1 against B2); upper and lower bracket by place. The Wiosenna arrangement (12 places from two groups, some entering later) must be expressible as data; write it as a fixture.
- **Acceptance.** The Wiosenna fixture's bracket is produced from its group tables by `seedBracket` with no hand placement and equals the published bracket; an open tie blocks seeding and names the teams; a played tiebreak match unblocks it and does not change points; property tests (every qualifying team appears in exactly one slot; no team that lost advances).
- **Tests.** Level 1 for resolution, cross-group ranking and the generator; level 4 for the commands; end-to-end flow 8.
- **Risks and rollback.** Formats nobody has listed yet. The schema is a list of entries, so a new arrangement is data; S2 confirms the presets with the owner.
- **Dependencies.** WP-13a, WP-13b.
- **Size.** L. **Review.** Fable.

### WP-16. Fantasy and pick'em scoring in the pipeline

- **Goal.** Fantasy and pick'em produce points and a ranking, from one formula per tournament.
- **Files.** Sources to read: `src/lib/pdl-fantasy-scoring.ts`, `opendota.ts:285` (`calculateFantasyPoints`), `src/lib/firestore.ts` (fantasy and pick'em helpers), `src/app/[tournamentSlug]/{fantasy,pickem}/page.tsx`, `components/fantasy/FantasyScoreCalculator.tsx`. New `src/features/stats/domain/{fantasy,pickem}.ts`, `src/features/{fantasy,pickem}/`.
- **Design.** ADR-11. The owner chose the role-based formula as the default for new tournaments (question 8); existing seasons keep the formula they were scored with.
  - `scoreFantasy(performance, preset)` with presets `pdl-flat` and `role-based` reproducing the two live formulas exactly.
  - `computeTournament` adds per-round user totals from `fantasy_lineups` and a leaderboard. Saving a lineup is a command that enforces the round lock on the server.
  - Pick'em: a scoring function comparing picks with final placements, and a leaderboard. Picks lock by a server-checked deadline. Lineups and picks of other users are not returned before the lock.
  - The scoring guide text is generated from the preset.
  - The viewer screens get the minimum needed to show points and rank using existing components; their redesign is S2's.
- **Acceptance.** On the seeded tournament, a user's lineup scores after a recorded game and appears in the ranking; saving after the lock is refused by the server; pick'em ranks users after the final; preset functions return the pinned numbers for the recorded games.
- **Tests.** Level 1 for both scoring functions; level 4 for the commands and the lock; end-to-end flow 10.
- **Dependencies.** WP-15, WP-13b.
- **Size.** L. **Review.** Opus.

---

## M3. Organizers run a season

### WP-24. Organizations and roles

- **Goal.** An organizer account that owns several tournaments, with members and roles, checked by the one permission function.
- **Files.** New `src/features/organizations/`, `src/platform/auth/` (role table), `src/app/organizer/page.tsx`.
- **Design.** ADR-05, ADR-06. The tables exist since WP-32 and the import fills them.
  - Commands: create organization, invite member (by e-mail or Discord name, accepted by the invitee), change role, remove member, transfer ownership; add and remove tournament members (admin, referee, caster).
  - A platform setting keeps tournament creation to an allowlist until the public launch.
  - Screens are minimal and functional; S2 designs the real ones.
- **Acceptance.** The role table test covers every role and action; an admin of organization A gets "not found" for anything in B (tested through three commands); an invited referee can set a result and cannot edit settings (end-to-end flow 11); the last owner cannot be removed.
- **Dependencies.** WP-07.
- **Size.** M. **Review.** Fable.

### WP-17. Captain flows through commands

- **Goal.** Everything a captain does is a server command.
- **Files.** Sources to read: `src/components/team/MyTeamView.tsx` (1,859 lines, 17 browser write sites), `SquadView.tsx`, `MatchPanel.tsx`, `StandinRequestModal.tsx`, `src/lib/team-actions.ts`, `standin-actions.ts`, `reschedule-rules.ts`, `src/app/[tournamentSlug]/register/page.tsx`, `api/register-*`. New `src/features/teams/` and `src/features/schedule/`.
- **Design.** ADR-07; `CONVENTIONS.md` section 6.
  - Commands: `registerTeam`, `updateRoster`, `proposeReschedule`, `answerReschedule`, `requestStandin`, `decideStandin`, `cancelStandin`, `appealStandin`, `postScrimSlot`, `removeScrimSlot`, `recordTransfer`.
  - Each command updates the lobby session if one exists (through the `lobby` feature) and enqueues notifications.
  - `MyTeamView` is split into components under 400 lines that receive data as props and call commands. The look stays.
  - The lobby state a captain needs comes from a short-cached endpoint (ADR-16).
- **Acceptance.** Each command has the four standard tests; a captain of another team is refused in each; end-to-end flows 3, 4 and 6 pass; no file in the feature imports Firebase.
- **Dependencies.** WP-07, WP-13b, WP-14.
- **Size.** L. **Review.** Fable.

### WP-18. The organizer's commands, built with S2's screens

- **Goal.** Everything an organizer or referee does is a command, behind the screens S2 designs. The old admin tabs are deleted, not converted.
- **Split.** 18a tournament creation, settings, theme, lifecycle. 18b teams, groups and divisions, transfers. 18c schedule and matches. 18d formats: stages, ranking rules, Swiss rounds, playoffs (uses WP-34). 18e content and viewer features: rules, news, prizes, fantasy and pick'em setup.
- **Files.** Sources to read for the rules that live inside them: `src/app/[tournamentSlug]/admin/tabs/*`, `src/lib/api/tournaments.ts`, `src/lib/api/groups.ts`, `src/lib/swiss/actions.ts` (26 write sites whose order matters: draft, commit, reopen), `lan-qualifier/actions.ts`, `components/creator/*`. New commands in the matching features.
- **Design.** ADR-07. For each part: write down the business rules found in the old tab (the report lists them), put them in `domain/` with tests, define the commands, then build the screen from S2's WP on top. If S2's screen for a part is not ready, build the commands and their tests only.
- **Acceptance (per part).** Commands have the standard tests; the rules found in the old tab are each either implemented with a test or listed as dropped with a reason; the part's S2 acceptance criteria pass; the old tab and its helpers are deleted.
- **Risks and rollback.** A rule that existed only in a tab's click handler is lost. The written list of rules per tab is the guard, and the reviewer checks it against the old file.
- **Dependencies.** WP-17 (pattern proven), WP-13b, WP-24, S2's work packages.
- **Size.** XL in total; each part M to L. **Review.** Fable for 18a and 18d; Opus for the rest.

### WP-38. Move the remaining server features

- **Goal.** The server features that sit on Firestore and have no other package are on the new platform: accounts and their links, notifications, casters, draft preparation, the rules assistant's quota, captain-change codes.
- **Files.** Sources: `src/server/accounts/*`, `src/server/notify/*`, `src/server/casters/*`, `src/lib/draft-prep/server.ts`, `src/lib/rules-assistant-quota.ts`, `api/manage/captain-change-code`, `api/captain-change/redeem`, `api/account`, `api/inbox`, `api/login/**`, `api/connect/steam/**`, `NotificationBell.tsx`. New `src/features/{accounts,notifications,casters,draft-prep,content}/`.
- **Design.** ADR-04 "Cost", ADR-06, ADR-16.
  - Accounts: `users`, `user_links`; sign-in endpoints keep their behaviour. The inhouse bot's `inhousePlayers` collection stays in Firestore; the one place that reads it for linking is isolated in `features/accounts` behind an interface.
  - Notifications: an `inbox` table with a retention limit; Discord messages sent by a job; the bell fetches on load and on focus.
  - Draft preparation: its large cached documents become rows or a cached file, whichever the measured sizes suggest.
  - Each feature gets queries, commands and tests like any other.
- **Acceptance.** The listed sources are deleted; sign-in with Google and Discord, Steam linking, a notification after a reschedule, and a captain change by code all work end to end on staging; `grep -r "firebase-admin/firestore\|from 'firebase/firestore'" src` finds only the isolated inhouse reader.
- **Dependencies.** WP-07, WP-14, WP-17.
- **Size.** L; split into two branches (accounts and notifications; the rest). **Review.** Fable for accounts; Opus for the rest.

### WP-40. The card game on the new platform, as it is today

- **Goal.** The card game works for a tournament on the new platform exactly as it does on the old site, so that PDL S2 keeps it when it moves.
- **Files.** Sources: `src/server/card-lab/*` (`collection.ts`, `duels.ts`, `rewards.ts`, `finds.ts`), `src/lib/card-lab/*` (the engine; it is pure and moves unchanged into `src/features/cards/domain`), `src/hooks/useDuel.ts`, `api/cards/**`, `api/manage/cards`, the cards section components, `inventory/CARDS.md`. New `src/features/cards/`, new tables in `src/platform/db/schema/cards.ts`.
- **Design.** ADR-04 (card tables), ADR-16 (live updates). This is a move, not a redesign; S3 changes the game later.
  - Tables for collections, duels, duel views, rankings, rewards, grants and reports, each with `tournament_id` where the data is per tournament today. The duel state that is a JSON string today becomes a JSON column validated by the engine's schema.
  - A duel move is a command. The opponent's view comes from a short-cached endpoint polled while a duel is open (ADR-16); measure the delay a player feels and say so in the report. If it is over a second, use Supabase Realtime broadcast for duels only.
  - Settling stale duels and round rewards become job types.
  - The import tool gets a mapper for the card collections from the owner's export (they are not publicly readable).
  - Everything reads the stats dataset through `features/stats`.
- **Acceptance.** On staging, with PDL S2 imported including card data from an export: a user's collection shows the same cards as on the old site; a duel can be played to the end between two test users; rewards for a finished round are granted once (idempotency test); the engine's existing tests pass unchanged.
- **Tests.** Level 4 for the commands and jobs; the engine's own tests; an end-to-end duel between two users.
- **Risks and rollback.** Card data for a live season is the one place where a move can lose something players care about. The import report lists every collection with its card count on both sides.
- **Dependencies.** WP-07, WP-14, WP-15, WP-38 (accounts).
- **Size.** L. **Review.** Fable.

### WP-19. No database access from the browser

- **Goal.** What the architecture says is checked by a machine: the browser cannot read or write data except through the server.
- **Files.** `storage.rules` (deny all client writes; uploads use addresses issued by commands from `platform/files`), `src/lib/firebase.ts`, the lint configuration, `package.json`.
- **Design.** ADR-04 rule 1, ADR-07.
- **Acceptance.** No file under `src` imports `firebase/firestore`, `firebase/storage` or `firebase/functions`; the Storage rules deny every client write and a test proves an upload through a command works; on staging, the database's browser API is off and a request with the public key gets nothing; `src/lib` and `src/components` hold no data access.
- **Dependencies.** WP-17, WP-18 (all parts), WP-16, WP-38, WP-40.
- **Size.** S. **Review.** Fable.

---

## M4. A bot we can maintain

### WP-20. Bring the bot's source under control

- **Goal.** The tournament bot is TypeScript in `src/`, built by the Docker image, with its dry-run scripts as automated tests. Behaviour does not change.
- **Files.** `bot-worker/dist/{conductor,runner,runner-logic,scheduling,dota-client,firebase,logger}.js` (become `bot-worker/src/*.ts`), `dist/_drytest-*.js` (become `src/**/*.test.ts`), legacy `dist/{manager,command-handler,event-emitter,index}.js` (delete), `bot-worker/{Dockerfile,tsconfig.json,package.json,.gitignore}`, `ecosystem.config.cjs`, `deploy-bot.ps1`, `setup-vps.sh` (delete), new `bot-worker/RELEASE_CHECK.md`.
- **Design.** ADR-10 point 1.
  1. First commit: copy each hand-written file to `src/` as `.ts` with `// @ts-nocheck`, change nothing else, compile, and prove the compiled output is equivalent to the committed `dist` file (same statements; a normalised diff in the report).
  2. Then remove `@ts-nocheck` file by file, adding types, starting with `runner-logic` and `scheduling`. No logic changes; any bug found is written down, not fixed here.
  3. The Dockerfile builds from source (`npm ci`, `tsc`), keeps the protobuf patch step, and `dist/` is removed from git.
  4. A `DotaClient` interface is extracted from `dota-client`, with a fake implementation for tests (`TEST_STRATEGY.md` level 5). The storage calls are gathered behind one `Store` interface, still implemented on Firestore here; WP-21 gives it a PostgreSQL implementation.
- **Acceptance.** `git ls-files bot-worker/dist` is empty; the Docker image builds (in CI if Docker is not available locally); the dry-run scenarios run under vitest in CI; `tsc --noEmit` passes with at most `dota-client.ts` still unchecked; every Firestore call in the hand-written files goes through `Store`; the release checklist exists and names the manual lobby test.
- **Tests.** The converted dry-runs; unit tests for `runner-logic`.
- **Risks and rollback.** This is the code that runs live matches, but nothing here is deployed: the old bot keeps running from the production branch, and this becomes the new bot's base. Never push `feature/multi-tournament-platform` (Railway deploys from it).
- **Dependencies.** None.
- **Size.** L. **Review.** Fable.

### WP-21. The contract, and the bot on its own tables

- **Goal.** The website and the bot exchange only what `contract/` defines, through the `bot` schema, and the bot can reach nothing else.
- **Files.** New `contract/` (schemas for lobby session request and state, game report, forfeit report, worker heartbeat), `src/types/lobby-bot.ts` (713 lines; replaced by the contract), new `src/features/lobby/` (from `src/lib/bot/*`), `bot-worker/src/{store-postgres,scheduling,runner,conductor}.ts`, `tsconfig` paths on both sides.
- **Design.** ADR-10 points 2-6 and 9; section 2.3.
  - Both builds import `contract/` by path alias; it has no dependency except zod.
  - The website is the only creator of sessions: when a match gets a time and the bot is enabled, `features/lobby` writes the session with rosters, stand-ins, casters, settings and the time to create the lobby, and updates it on every relevant command.
  - The bot's `Store` gets a PostgreSQL implementation using the `bot_worker` role. Its reads of tournaments, teams and matches are deleted, along with its own session creation and the duplicate scheduling rule.
  - Series completion is decided by the website only; the bot reads from the session row whether another game is needed.
  - Steam accounts: decide here between a separate pool for the new bot in `bot.accounts` and keeping the Firestore lease shared with the inhouse bot (`core/lease.ts`). Read how the inhouse bot uses the lease first; recommend the separate pool unless accounts are too few, and put the question to the owner in the report.
- **Acceptance.** `grep` in `bot-worker/src` finds no table outside `bot` and `app.jobs`; contract fixtures for the current version parse on both sides; the level-5 scenarios pass on PostgreSQL, including reschedule and late stand-in; the website type file is gone.
- **Tests.** `TEST_STRATEGY.md` level 5, all three parts.
- **Risks and rollback.** A field the runner needs is missing from the session. The scenarios with the fake Dota client cover every field the runner reads; a manual lobby on staging with test accounts is the final check.
- **Dependencies.** WP-20, WP-32, WP-14; WP-17 for the commands that update sessions.
- **Size.** L. **Review.** Fable.

### WP-22. Due work only, real secrets, visible waiting

- **Goal.** The bot does work only when there is work; its credentials are encrypted; a missing account and a dead worker are visible.
- **Files.** `bot-worker/src/{conductor,scheduling,heartbeat}.ts`, `src/features/lobby/`, a platform-admin page for bot accounts and workers.
- **Design.** ADR-10 points 6-7, ADR-13.
  - One statement finds due, unclaimed sessions and claims them with `SKIP LOCKED`.
  - `password` and the Steam Guard secret are encrypted with AES-GCM using a key from the worker's environment. The website stores what the platform admin enters, already encrypted with the public half of a key pair, and can never read it back.
  - A heartbeat row per worker; a job alerts when it is stale or when a session waits for an account longer than a threshold, and the organizer and captains see "waiting for a bot".
- **Acceptance.** With 1,000 seeded idle tournaments, a bot tick runs a constant number of statements (asserted); no readable password exists in the database; a stopped worker raises one alert within three minutes; the waiting state shows on the match.
- **Dependencies.** WP-21, WP-04.
- **Size.** M. **Review.** Fable.

### WP-23. Measure and scale the lobby workers

- **Goal.** Know how many concurrent lobbies one worker holds, and be able to add workers.
- **Files.** `bot-worker/src/conductor.ts`, `docs/overhaul/spikes/WP-23.md`.
- **Design.** ADR-10 point 8. Part 1 (measure): memory and CPU per runner process with the fake client and, by hand on staging, with real accounts; write the numbers, the per-worker limit and the Railway cost per concurrent lobby (this replaces the least certain number in `COSTS.md`). Part 2 (only if part 1 or demand calls for it): workers claim up to their capacity; a crashed worker's sessions are reclaimed after its heartbeat goes stale.
- **Acceptance.** Part 1: the report states lobbies per worker and the cost per concurrent lobby. Part 2: two workers share ten sessions without double-claiming; killing one moves its sessions.
- **Dependencies.** WP-22.
- **Size.** S for part 1, M for part 2. **Review.** Fable for part 2.

---

## M5. A platform

### WP-26. Custom domains, one link helper, sign-in from any domain

- **Goal.** A tournament can be served on an organizer's own domain, with working links and sign-in.
- **Files.** `src/middleware.ts`, new `src/features/tournaments/domain/{links,domains}.ts`, every hand-built `/${slug}/...` link (find with grep; `getTournamentPath` in `TournamentContext` is the start), `src/features/accounts/` (sign-in hand-off), `src/context/AuthContext.tsx`, hosting-domain API client.
- **Design.** ADR-08 (domains and sign-in).
  - `tournamentHref(tournament, path)` everywhere. On a custom host the prefix is empty.
  - Middleware: look up the host (cached), rewrite to `/{slug}/...`; unknown hosts get a plain "not connected" page. Platform paths that are not tournaments work on the platform domain only.
  - Sign-in hand-off: generalise the Discord flow to "sign in on the platform origin, return a custom token to an allowed origin". Google sign-in moves to the same flow. Allowed origins come from `domains` plus configuration.
  - Commands: add domain (returns the DNS records to set), check verification, remove. Attach and detach through the hosting API. The free hosting plan allows 50 domains per project; the command refuses with a clear message at the limit.
- **Acceptance.** On staging, a test domain serves a tournament at its root; every link stays on the domain; sign-in with Discord and Google works there and on the platform domain; removing the domain stops serving it; end-to-end flow 12 passes; `grep` finds no hand-built tournament path.
- **Dependencies.** WP-08, WP-24, WP-38 (accounts).
- **Size.** L. **Review.** Fable.

### WP-27. Theme tokens with guard rails, and visual tests

- **Goal.** A validated theme format that the server renders, limits that keep every tournament readable, and screenshots that prove pages hold under any theme.
- **Files.** `src/types/tournament.ts` (`TournamentTheme`, about 40 fields), `src/features/tournaments/domain/theme.ts`, `src/lib/themes/*`, `division-themes.ts`, `google-fonts.ts`, `dynamic-fonts.ts`, components with hard-coded colours (`docs/THEME_COLOR_AUDIT.md` is the list), `src/components/themed/*`, Playwright visual suite.
- **Design.** ADR-08 (theming); `TEST_STRATEGY.md` level 8. S2 decides which tokens organizers see; this WP builds the schema (versioned; the import converts current fields with no visible change), the contrast and size checks, font loading without blocking, and removes hard-coded colours.
- **Acceptance.** Imported tournaments render identically after the theme conversion (screenshots); a theme that fails contrast cannot be published; the extreme test theme breaks no layout at three widths; no component reads a slug to pick a style.
- **Dependencies.** WP-08. Coordinate with S2's customization WPs.
- **Size.** L. **Review.** Opus, with the owner looking at the screenshots.

### WP-29. One translation system

- **Goal.** All UI text comes from `messages/*.json` through `next-intl`; `lib/translations.ts` (1,830 lines) and `useTranslation` are gone; a tournament with `locale: 'en'` shows no Polish UI text on public pages.
- **Files.** `src/lib/translations.ts`, `src/hooks/useTranslation.ts`, the 67 files that use them, `messages/{pl,en}.json`, components with hard-coded Polish on public pages.
- **Design.** ADR-08 (language). Public pages first; admin screens follow S2's rebuild. A CI check compares the key sets of the two message files.
- **Acceptance.** The old system is deleted; the key check passes; the seeded English tournament's public pages contain no Polish UI strings (a test scans rendered HTML against a word list).
- **Dependencies.** WP-08, WP-09.
- **Size.** L. **Review.** Opus.

### WP-36. Backups, and export and import of one tournament

- **Goal.** Production data can be restored after any mistake, and one tournament can be lifted out of a database and put into another.
- **Files.** `.github/workflows/backup.yml`, `scripts/tools/tournament-export.ts`, `tournament-import.ts`, `docs/overhaul/runbooks/restore.md`.
- **Design.** ADR-04 rule 2, ADR-05 rule 5, ADR-17.
  - A nightly job dumps the production database, encrypts the file with a key from the repository's secrets, and stores it as a private artifact or in a private bucket, keeping 30 days. It alerts on failure.
  - `tournament-export` writes every row of one tournament, and the global rows it refers to, to one file; `tournament-import` loads it into any database, as upserts.
- **Acceptance.** A restore from last night's dump into an empty database is rehearsed on staging and timed in the runbook; a tournament exported from one database and imported into an empty one renders the same pages (comparison script); the export contains no row of another tournament (asserted by a test with two tournaments).
- **Dependencies.** WP-32. Must be merged before WP-37.
- **Size.** M. **Review.** Fable.

---

## M6. Proven and live

### WP-30. The full end-to-end suite

- **Goal.** The twelve flows of `TEST_STRATEGY.md` level 6 run in CI on every pull request.
- **Files.** `e2e/`, `playwright.config.ts`, CI workflow, the fake-bot script from WP-21.
- **Design.** `TEST_STRATEGY.md` level 6. Flows are added as their WPs land (flow 1 in WP-08, 3/4/6 in WP-17, 8 in WP-34, 10 in WP-16, 11 in WP-24, 12 in WP-26); this WP completes the rest and makes the suite stable and under ten minutes.
- **Acceptance.** Twelve flows green three runs in a row; a failed run uploads its trace.
- **Dependencies.** M1-M3.
- **Size.** M. **Review.** Opus.

### WP-31. Load test at 1,000 tournaments

- **Goal.** Evidence that the platform holds the target size, and a list of what breaks first.
- **Files.** `scripts/load/` (seed for 1,000 tournaments, k6 scenarios), `docs/overhaul/spikes/WP-31.md`.
- **Design.** `TEST_STRATEGY.md` level 9, with its pass marks. The database part (1,000 tournaments of rows, the queries and commands under load) runs against a PostgreSQL container in CI, which is free and has no size limit. The CDN part runs on staging with as many tournaments as the free database holds.
- **Acceptance.** The three scenarios run; the report gives the numbers against each pass mark, the slowest statements with their plans, the measured database size per tournament (this corrects `COSTS.md`), and follow-up WPs for anything that failed.
- **Dependencies.** M1, M2, WP-22.
- **Size.** M. **Review.** Fable.

### WP-37. Go-live steps two to four: PDL S2 moves, new seasons start, the old site retires

- **Goal.** PDL S2 is played on the new platform from one match day to the next; new seasons are created there; when the last old season has ended, the old site, its bot and its hosting are switched off.
- **Files.** `docs/overhaul/runbooks/move-live-season.md`, `go-live-new-seasons.md`, `retire-old-site.md`, `scripts/tools/export-firestore.mjs` (from WP-33).
- **Design.** ADR-15 "Going live", steps 4 to 6. Written and rehearsed on staging by an agent; **the owner runs them.**
  - Moving PDL S2, between two match days: confirm the mirror report (WP-39) shows no unexplained difference; run the owner's export of the private data (users, accounts, links, roles, card collections, bot settings); import it; play one test lobby with the new bot and its own Steam accounts; set `serving` to `live`; watch the first match day with the owner. The way back is setting `serving` to `mirror`; results entered on the new side since the move are then entered again on the old side by hand, and the runbook lists how to find them.
  - New seasons: backups confirmed (WP-36); creation is open to the allowlist.
  - Retiring: import the last finished seasons; switch off the old bot and the old hosting; keep a Firestore export; turn the Firestore rules to deny all for the tournament collections (the inhouse bot's collections stay); rename `overhaul` to `main` and retire `master` (question 10: remind the owner).
- **Acceptance.** Rehearsal reports for the three runbooks; after the move, a real PDL S2 series is played end to end on the new platform with no admin action between lobby creation and updated standings, and the card game works for its players; after retiring, no request reaches the old hosting for a week before it is removed.
- **Dependencies.** M3, M4, WP-36, WP-39, WP-40, WP-30.
- **Size.** M for the agent. **Review.** Fable.

---

## Dropped packages

| WP | Was | Why dropped |
|---|---|---|
| WP-02 | Test the Firestore rules and close their holes | The new platform has no browser database access, so there are no rules to test. The old site's rules stay as they are until it retires, by the owner's decision not to change production. Storage rules are handled in WP-19. |
| WP-25 | Move Letnia into the tournament tree | Letnia is imported as an ordinary tournament by WP-33. |
| WP-28 | Move the database to Europe | The new database is created in Frankfurt from the start. |

## Things deliberately left out of S1's packages

- The new admin panel and wizard (S2), the card game (S3), business material (S4).
- A redesign of the bot's lobby logic. Open bot gaps recorded in the owner's notes (forfeit voting, coin toss, Immortal Draft seat) are product work to schedule after WP-21.
- Per-visitor language switching, free subdomains, organization-owned bot pools, billing, a second region. Each has a place in the design (ADR-08, ADR-10, ADR-05, ADR-17) and no package yet.
