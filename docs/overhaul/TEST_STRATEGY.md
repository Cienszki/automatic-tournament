# Test strategy

Written in S1 (2026-11-13) by Fable, and revised the same day for the new database (`ARCHITECTURE.md`, ADR-04, ADR-15). It says which kinds of test the product needs, what each one covers, the tools, the environments, the goals, and the order to build them in. The work packages that build them are in `ROADMAP.md`.

**Where we start.** 26 test files with 256 tests cover small helpers and the Swiss pairing. Nothing tests a Firestore write, a security rule, a route's permission check, the result import, standings, scoring, the bot, or a page in a browser. CI runs typecheck, lint, the unit tests and a build.

**The principle.** Put each rule where it is cheapest to test, then test it there. Most of the product's risk is in rules that are pure once they are separated from the database: who advances, who gets points, which game belongs to which match, who may do what. The architecture moves those rules into `domain/` folders and commands (`ARCHITECTURE.md`, ADR-07, ADR-11, ADR-14), and that is what makes thorough testing affordable. The old code is not changed. The new code is checked against what the old site publishes for real tournaments (the parity fixtures of WP-12), so that rebuilding a rule cannot change a table unnoticed.

## 1. The levels

| # | Level | Proves | Tool | Runs | Speed target |
|---|---|---|---|---|---|
| 1 | Pure logic | A rule gives the right answer for every case that matters | vitest, node environment | every push | whole level under 30 s |
| 2 | Components | A component shows the right state and calls the right command | vitest with jsdom, Testing Library | every push | under 60 s |
| 3 | Database schema and isolation | The database refuses bad data, one tournament cannot reach another, and the bot's role can touch only its own tables | vitest on in-process PostgreSQL (PGlite) and on a PostgreSQL container in CI | every push | under 60 s |
| 4 | Commands, queries and jobs | A server function checks permission, validates, writes the right documents, invalidates the right tags, and is safe to repeat | vitest on in-process PostgreSQL (PGlite) | every push | under 3 min |
| 5 | Contract between website and bot | Documents written by one side are accepted by the other, in every supported version | shared schemas in `contract/`, fixtures, database scenario with a fake Dota client | every push | under 60 s |
| 6 | End-to-end flows | A person can complete the journeys the product is sold on | Playwright against a production build with a seeded local database | every push to `overhaul`; every pull request | under 10 min |
| 7 | Performance | Pages stay inside their budgets | Lighthouse CI, bundle-size check, statement-count assertions | every pull request | under 5 min |
| 8 | Visual | Pages look right under different themes and screen sizes | Playwright screenshots | every pull request, comparison reviewed by a person | under 5 min |
| 9 | Load | The platform holds 1,000 tournaments and a busy match evening | k6 against a PostgreSQL container in CI and against staging | before each milestone, by hand | 30 min |
| 10 | Production checks | The live site works after a deploy | Playwright smoke test (read-only), uptime check, error monitoring | after each deploy, then continuously | 2 min |

### Level 1. Pure logic

The largest level, and the one to grow first. Targets, in order of risk:

- **Results:** matching a Dota game to two teams by player ids (three or more players per side, stand-ins, a player in two teams); choosing the match for a game; series completion for bo1, bo2, bo3 and bo5, including forfeited games; the practice-game filter; walkovers.
- **Standings:** league and group tables with every tie-breaker in the catalogue, in any order, including three-way ties; open ties and tiebreaker matches; ranking across groups; places into bracket slots; Swiss standings and Buchholz; the effect of extra matches, replayed matches and banned teams (`match-flags`).
- **Scoring:** fantasy points for each scoring preset, checked against fixed numbers from real games; the performance score; pick'em scoring.
- **Formats:** round-robin schedule generation (every pair once, no team twice in a round); the playoff bracket generator, advancement, byes and the mirror into `matches`; Swiss pairing (already tested); the LAN qualifier.
- **Policies:** reschedule rules (already tested), stand-in rules, coach rules, transfer limits, registration validation, slug rules.
- **Permissions:** the role-to-action table: for every role and every action, allowed or refused. This one table test replaces dozens of route tests.
- **Bot logic:** `runner-logic` (series result, ready check, late arrival and forfeit thresholds) once it has source (ADR-10).
- **Card engine:** already pure and deterministic; S3 adds its own balance simulations.

Style: table-driven tests and property tests (fast-check) where a rule must hold for all inputs, for example "the sum of points in a table equals two per completed match" and "a bracket never advances a team that lost".

Parity fixtures: real finished tournaments (pdl-s2 and Wiosenna, captured through public reads, with user data reduced to ids and nicknames) are stored in the export format, together with the tables the old site publishes for them (WP-12). The new standings and `computeTournament` must reproduce those tables. This is the safety net for replacing the nine standings implementations and the stats calculators. The same captures, imported, are what the new pages are compared with screen by screen.

### Level 2. Components

Only where a component has behaviour of its own: forms and their validation, the reschedule picker, bracket display with byes, the home page's section navigation, the theme preview. A component that only lays out props is covered by level 8. Server components are tested through level 6.

### Level 3. Database schema and isolation

The security rules and their tests are gone, because the browser cannot reach the database (ADR-04, ADR-07). What replaces them is checked here:

- **Catalog tests.** A test walks the database catalog and fails on: a tournament table without `tournament_id`; a foreign key between tournament tables that omits it; a table in the `public` schema; a table without row-level security enabled.
- **Constraints.** Tests that the database refuses a duplicate slug, a game imported twice, a match whose team belongs to another tournament.
- **Roles.** The bot's database role cannot read or write anything outside its schema and cannot do more than insert into the job table.
- **Migrations.** Every migration is applied to a database at the previous version that holds seed data, in CI, on a real PostgreSQL. Once production data exists, a migration that drops or rewrites a column needs a test that the old code still runs between the two deploy steps.
- **The import tool.** Mapper tests on the fixtures; a second run changes nothing; the Letnia adapter; the count and standings comparison (WP-33).
- **Storage rules.** A short test that every client write is denied and that an upload through a command works (WP-19).

### Level 4. Commands, queries and jobs

Every command gets the same four tests through a shared helper: the allowed role succeeds and writes exactly the expected documents; each other role gets `Forbidden`; invalid input gets `Invalid`; an id from another tournament gets `NotFound`. A failed command leaves no row behind (the transaction rolled back). Then the tests of its own behaviour.

- A route-inventory test walks `src/app/api/v1/**/route.ts` and fails if a route is not built with `defineCommand` or `defineQueryRoute`, and if any `'use server'` file exists. This is the test that would have caught both security problems found so far.
- Jobs: each job type runs twice on the same input and must leave the same state. The queue is tested for claiming (two runners, one job), retry with delay, deduplication, and the one-job-per-tournament limit.
- The result pipeline end to end on the test database: a recorded OpenDota response goes in; the match score, standings, dataset and fantasy leaderboard come out. OpenDota and Steam are replaced by recorded responses (msw). No test calls the network.
- Queries: the shape returned, and a **statement-count assertion**: the test database counts statements, and each public query has a fixed ceiling that does not grow with the number of teams or matches. This stops a query per row from coming back.

### Level 5. The contract with the bot

1. **Schema tests.** `contract/` holds the schema of every exchanged document. The website's writer output is parsed with the schema; the bot's reader input is the same schema. A fixture folder keeps one example per version. A change that cannot parse the previous version's fixtures fails, which forces a version bump and a compatibility branch.
2. **Scenario tests on the test database with a fake Dota client.** The fake implements the small interface the runner uses (create lobby, invite, lobby state events, launch, match result). Scenarios: a bo3 played to 2:1; a team that does not show and is forfeited; a reschedule after the session exists; a stand-in approved after the lobby opened; a runner crash and respawn mid-series; no free account; a lost post-game event recovered by the OpenDota poll. Each ends by checking what the website's side received.
3. **Website side without a bot.** A fake bot script writes the bot's rows in order, so the website's handling (jobs, live lobby state, results) is tested without the worker.

What stays manual: one real lobby on Steam with test accounts before a bot release. Valve's Game Coordinator cannot be emulated faithfully; the checklist for this is short and lives in `bot-worker/RELEASE_CHECK.md` (written in WP-20).

### Level 6. End-to-end flows

Playwright drives a production build that talks to a local database seeded with one tournament per format. Sign-in uses the Firebase Auth emulator. The flows, each one a selling point or a past incident:

1. A visitor opens a tournament's home page, teams, schedule, a team, the stats hub, on desktop and phone sizes; every page has content in the first HTML response.
2. An organizer creates a tournament in the wizard, publishes it, and sees it live.
3. A captain registers a team; an admin verifies it; it appears on the teams page.
4. An admin generates a schedule; a captain proposes a new time; the other captain accepts; the schedule shows it.
5. A match gets its lobby: the lobby session appears, the fake bot plays the series, the result, standings and stats update with no admin action.
6. A captain requests a stand-in; the opponent approves; the lobby roster changes. A third user cannot approve.
7. An admin forfeits a match and reverts it; standings follow both times.
8. Playoffs: two groups finish with a tie on a qualifying place; a tiebreaker match settles it; the bracket is filled from the places with no hand placement; play through to the final; the right teams advance.
9. A Swiss tournament: three rounds paired, played and ranked.
10. A user picks a fantasy lineup before the lock and sees points after a game; pick'em likewise.
11. Roles: a referee can set a result and cannot edit the theme; an admin of tournament A gets nothing in tournament B.
12. A tournament on its own domain: pages, links and sign-in work without the slug in the path (after WP-26).

Rules for this level: each test creates what it needs and does not depend on another test; no fixed waits; a failed run keeps its trace and video as a CI artifact.

### Level 7. Performance

Budgets, measured by Lighthouse CI on a production build with seeded data, phone profile, for the home page, teams, schedule and one team page:

| Measure | Budget | Today |
|---|---|---|
| Content in the first HTML response | yes, every public page | none |
| Largest Contentful Paint | under 2.5 s | 7.0 s (January 2026) |
| First Load JS, public page | under 200 kB | 243-489 kB |
| Layout shift | under 0.1 | not measured |
| Time to first byte from the CDN, staging | under 300 ms | about 300 ms for an empty shell |
| Database work per cached page view | none | 10 or more Firestore reads |
| Firestore SDK in the browser | not loaded on any page | loaded on every page |

- CI fails a pull request that breaks a budget. Budgets start at today's values for pages not yet converted and tighten as each page is converted.
- The bundle check lists the largest modules, so a new dependency in the shared bundle is seen in review.
- Real-user web vitals from production are the final measure (ADR-13).

The headless browser cannot run in the local agent sandbox (S0 found this). Levels 6 to 8 therefore run in GitHub Actions, and a developer runs them locally with `npm run e2e`.

### Level 8. Visual

Screenshots of about fifteen key screens, each under three themes (a dark default, a light theme, a deliberately extreme theme with long names and missing images) and three widths (390, 1280, 1920). They catch what the owner's product rules care about and no other test sees: overflow, content that does not fit its container, theme colours that were hard-coded. Differences are shown in the pull request; a person approves or rejects them. Animations and video are frozen for the capture.

### Level 9. Load

A script seeds 1,000 synthetic tournaments (16 teams, 60 matches, 120 games each) into a PostgreSQL container in CI, which is free and has no size limit, and k6 runs three scenarios against the app in front of it. The CDN behaviour is measured separately on staging with as many tournaments as its free database holds.

1. **Viewers:** 500 requests a second across random tournaments and pages for ten minutes. Pass: 95% answered under 500 ms, error rate under 0.1%, database statements per request near zero once warm.
2. **Match evening:** 300 series finish within fifteen minutes. Results are enqueued as the bot would. Pass: every result visible within two minutes, no failed job, no tournament delayed by another.
3. **Organizers:** 50 organizers editing settings, schedules and results at once. Pass: 95% of commands under 800 ms, pages show the change within five seconds.

Also measured once, by hand: how many lobbies one bot worker can hold (memory and CPU per runner process), since that sets the plan for scaling out (WP-23).

### Level 10. Production checks

- A read-only smoke test runs after every production deploy: the home page and four subpages of two live tournaments have content, no console errors, correct titles.
- The uptime check and error monitoring run all the time (ADR-13).
- No test writes to production. A dedicated hidden test tournament for write checks in production is possible later.

## 2. Environments

| Environment | Database | Web app | Sign-in and files | Bot | Used for |
|---|---|---|---|---|---|
| Local and CI | in-process PostgreSQL (PGlite); a PostgreSQL container in CI | `next build` + `next start` on a spare port | Firebase Auth and Storage emulators in CI; fakes in unit tests | fake Dota client | levels 1-8, and the database part of 9 |
| Staging | Supabase project, free plan, Frankfurt | Vercel preview deployments of work-package branches | Firebase project `dota2inhouse-staging` | a small worker, switched on when needed | the trial (WP-06), rehearsals of every go-live step, manual checks, the bot release check |
| New production | Supabase project, free plan at first, Frankfurt | Vercel production deployment | the existing Firebase project | a new Railway service | level 10 |
| Old production | Firestore, unchanged | Firebase Hosting, unchanged | the existing Firebase project | the existing Railway service | untouched until it retires |

PGlite needs no Docker and no Java, so database tests run anywhere Node runs, including this machine. The Auth and Storage emulators need Java, which GitHub's runners have; they are used only by the end-to-end level.

**Fixtures.** One seed module builds tournaments of each format at chosen stages (registration open, mid-season, playoffs, finished). It is used by the database tests, the end-to-end tests, the staging seed and the load seed, so all of them describe the same world. No fixture contains real e-mail addresses, tokens or Discord ids. Real tournaments reach staging only through the import tool with `--anonymize`.

### What the owner must create

Nothing below can be done by an agent, because each needs an account owner. Everything in the first list is free. This is question 5 in `STATUS.md`.

**Now, for staging and the trial (WP-03, WP-06):**

1. **A Supabase account with two projects** in the region Central EU (Frankfurt), both on the free plan: `dota2inhouse-staging` now, and `dota2inhouse` for production later (create it when WP-35 asks). For each project, from Settings: the database password, and the two connection strings (direct, and the pooled one on port 6543). Turn the Data API off in the project's API settings.
2. **A Firebase project for staging**, named `dota2inhouse-staging`, on the Blaze plan with a budget alert at $1. It needs only: Authentication with the Google provider enabled; a Storage bucket in a European location; a web app registered in the project (this gives the six `NEXT_PUBLIC_FIREBASE_*` values); a service account key. No Firestore database.
3. **A Vercel project for the tournament app**, on the free Hobby plan, connected to the GitHub repository, production branch `overhaul`, function region Frankfurt (`fra1`), with the staging values as preview environment variables. It can live in the same Vercel account as the community site.
4. **A Discord application for staging** (Developer Portal), with its client id and secret, and redirect URLs for the staging address.
5. **GitHub repository secrets:** the staging database connection strings, the staging service account (base64), the staging `NEXT_PUBLIC_FIREBASE_*` values, the staging Discord client id and secret, a staging `CRON_SECRET`.
6. **Error monitoring** (ADR-13): a Sentry organization on the free plan with two projects (web, bot) and their DSNs as secrets; a private Discord channel with a webhook for alerts.
7. **On this computer:** about 3 GB of free disk space and one run of `npm ci` in the `overhaul` worktree, so that agents can run lint and the new tests locally (question 13).

**Later:**

8. **For bot testing (WP-21):** two or three Steam accounts that are only for testing, and a Railway service for the staging worker that is switched off when not in use.
9. **For go-live step one (WP-35):** the production Supabase project from point 1 and the production environment variables on the Vercel project.
10. **For go-live step two (WP-37):** Steam accounts for the new bot, a Railway service for it, and one run of the read-only export script for the private collections.

Production's own secrets are not needed for any test and are never added to CI.

## 3. Coverage goals

Coverage is a floor that stops untested code from being added, not a target to chase. The percentages apply to new and moved code; the old folders are judged by whether the risky paths have tests, in the order of section 4.

| Code | Line coverage floor | Also required |
|---|---|---|
| `src/features/*/domain`, `contract/` | 95% | property tests for standings, brackets and scoring |
| `src/features/*/commands.ts`, `queries.ts`, jobs | 85% | the four standard tests per command; idempotency test per job |
| `src/platform` | 85% | |
| `bot-worker/src` logic (not the Steam client wrapper) | 80% | the seven scenarios of level 5 |
| React components | no floor | level 8 screens, level 2 where there is behaviour |
| `src/platform/db`, `scripts/import` | 85% | the catalog tests; the import report for every captured tournament |
| Old code in `src/lib`, `src/components` | no floor | none; it is replaced, and parity fixtures check the replacement |

Other goals:
- Every route that changes data is built with `defineCommand`, checked by the route-inventory test: 100%.
- Each of the twelve end-to-end flows is green on the production branch at all times.
- A bug found in production gets a test at the lowest level that can show it, in the same change as the fix.
- The test suite for levels 1-5 runs in under five minutes on CI. If it gets slower, it is split, not skipped.

## 4. The order to build in

The order follows the roadmap: first the net that makes the rebuild safe, then tests that arrive with each piece of new code, then the wide journeys.

| Step | What | Why now | Work package |
|---|---|---|---|
| 1 | Capture real tournaments and what the old site publishes for them | Everything rebuilt is compared with this | WP-12 |
| 2 | Database test harness (PGlite), catalog and constraint tests | The schema is the foundation | WP-32 |
| 3 | Import tool tests and the comparison report | Real data proves the schema | WP-33 |
| 4 | Seed module, CI with the database, blank-secrets build | Everything after this needs them | WP-03 |
| 5 | The measured trial on staging | The riskiest unknown | WP-06 |
| 6 | Level 1 for standings and ranking rules against the parity fixtures | Before any page shows a table | WP-13a, WP-15 |
| 7 | Permission table test, `defineCommand` tests, the route-inventory test | Before the first command | WP-07 |
| 8 | Statement ceilings per query; performance budgets; the first Playwright flow | Proves the fast pages and guards them | WP-08 to WP-11 |
| 9 | Jobs: queue tests and idempotency | Before results run through the queue | WP-14 |
| 10 | Level 4 for each command as it is written; end-to-end flows 2-11 | Tests arrive with the code, never after | WP-13b onward, WP-30 |
| 11 | Bot dry-runs as tests, contract schemas, scenarios with the fake Dota client | Before the bot's storage changes | WP-20, WP-21 |
| 12 | Visual screenshots across themes | Together with the theme work | WP-27 |
| 13 | Restore rehearsal; tournament export and import round trip | Before production holds data that exists nowhere else | WP-36 |
| 14 | Load test | Before the platform is opened to outside organizers | WP-31 |
| 15 | Production smoke test and site comparison | At each go-live step | WP-35, WP-37 |

## 5. What is deliberately not tested

- Valve's Game Coordinator behaviour beyond the fake client's interface. It is covered by the manual release check with real accounts.
- Third-party services themselves (OpenDota, Steam Web API, Discord, Twitch, Bunny, Gemini). Their responses are recorded and replayed; a small scheduled check on staging warns when a real response no longer matches the recording's schema.
- Unreachable legacy code. It is deleted (WP-05), not tested.
- Pixel-exact animation and video playback.
