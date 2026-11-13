# Test strategy

Written in S1 (2026-11-13) by Fable. It says which kinds of test the product needs, what each one covers, the tools, the environments, the goals, and the order to build them in. The work packages that build them are in `ROADMAP.md`.

**Where we start.** 26 test files with 256 tests cover small helpers and the Swiss pairing. Nothing tests a Firestore write, a security rule, a route's permission check, the result import, standings, scoring, the bot, or a page in a browser. CI runs typecheck, lint, the unit tests and a build.

**The principle.** Put each rule where it is cheapest to test, then test it there. Most of the product's risk is in rules that are pure once they are separated from Firestore: who advances, who gets points, which game belongs to which match, who may do what. The architecture moves those rules into `domain/` folders and commands (`ARCHITECTURE.md`, ADR-07, ADR-11, ADR-14), and that is what makes thorough testing affordable. Until a piece of old code is moved, it gets a characterisation test: a test that records what the code does today, so that moving it cannot change behaviour unnoticed.

## 1. The levels

| # | Level | Proves | Tool | Runs | Speed target |
|---|---|---|---|---|---|
| 1 | Pure logic | A rule gives the right answer for every case that matters | vitest, node environment | every push | whole level under 30 s |
| 2 | Components | A component shows the right state and calls the right command | vitest with jsdom, Testing Library | every push | under 60 s |
| 3 | Firestore rules | The browser can read and write only what its role allows | Firebase emulator, `@firebase/rules-unit-testing` | every push | under 60 s |
| 4 | Commands, queries and jobs | A server function checks permission, validates, writes the right documents, invalidates the right tags, and is safe to repeat | vitest against the Firestore and Auth emulators | every push | under 3 min |
| 5 | Contract between website and bot | Documents written by one side are accepted by the other, in every supported version | shared schemas in `contract/`, fixtures, emulator scenario with a fake Dota client | every push | under 60 s |
| 6 | End-to-end flows | A person can complete the journeys the product is sold on | Playwright against a production build with emulators | every push to `overhaul`; every pull request | under 10 min |
| 7 | Performance | Pages stay inside their budgets | Lighthouse CI, bundle-size check, read-count assertions | every pull request | under 5 min |
| 8 | Visual | Pages look right under different themes and screen sizes | Playwright screenshots | every pull request, comparison reviewed by a person | under 5 min |
| 9 | Load | The platform holds 1,000 tournaments and a busy match evening | k6 against staging with seeded data | before each milestone, by hand | 30 min |
| 10 | Production checks | The live site works after a deploy | Playwright smoke test (read-only), uptime check, error monitoring | after each deploy, then continuously | 2 min |

### Level 1. Pure logic

The largest level, and the one to grow first. Targets, in order of risk:

- **Results:** matching a Dota game to two teams by player ids (three or more players per side, stand-ins, a player in two teams); choosing the match for a game; series completion for bo1, bo2, bo3 and bo5, including forfeited games; the practice-game filter; walkovers.
- **Standings:** league and group tables with every tie-break in the configured order; Swiss standings and Buchholz; the effect of extra matches, replayed matches and banned teams (`match-flags`).
- **Scoring:** fantasy points for each scoring preset, checked against fixed numbers from real games; the performance score; pick'em scoring.
- **Formats:** round-robin schedule generation (every pair once, no team twice in a round); the playoff bracket generator, advancement, byes and the mirror into `matches`; Swiss pairing (already tested); the LAN qualifier.
- **Policies:** reschedule rules (already tested), stand-in rules, coach rules, transfer limits, registration validation, slug rules.
- **Permissions:** the role-to-action table: for every role and every action, allowed or refused. This one table test replaces dozens of route tests.
- **Bot logic:** `runner-logic` (series result, ready check, late arrival and forfeit thresholds) once it has source (ADR-10).
- **Card engine:** already pure and deterministic; S3 adds its own balance simulations.

Style: table-driven tests and property tests (fast-check) where a rule must hold for all inputs, for example "the sum of points in a table equals two per completed match" and "a bracket never advances a team that lost".

Golden fixtures: a few real finished tournaments (pdl-s2 and Wiosenna, read through the public site, with user data reduced to ids and nicknames) are stored as JSON. `computeTournament(fixture)` must reproduce the standings and totals that were published. This is the safety net for replacing the seven standings implementations and the stats calculator.

### Level 2. Components

Only where a component has behaviour of its own: forms and their validation, the reschedule picker, bracket display with byes, the home page's section navigation, the theme preview. A component that only lays out props is covered by level 8. Server components are tested through level 6.

### Level 3. Firestore rules

The rules file is 570 lines with no tests. It gets a test file per collection group, each with the same matrix: signed-out visitor, signed-in user, captain of the team, captain of another team, tournament admin, admin of another tournament, platform admin; for read, create, update of each sensitive field, delete.

- First pass (WP-02): write the matrix for the rules as they are, with the known holes as failing expectations, then close the holes.
- Each time an area moves to commands, its write rules become "deny", and the matrix is updated in the same change.
- End state: a short file whose tests say "clients can write nothing; clients can read only their own private documents and the live-update documents".
- `storage.rules` gets the same treatment.
- The test that the rules' reserved-slug list matches the code already exists; keep it.

### Level 4. Commands, queries and jobs

Every command gets the same four tests through a shared helper: the allowed role succeeds and writes exactly the expected documents; each other role gets `Forbidden`; invalid input gets `Invalid`; an id from another tournament gets `NotFound`. Then the tests of its own behaviour.

- A route-inventory test walks `src/app/api/**/route.ts` and fails if a route that changes data is not built with `defineCommand`, and if any `'use server'` file exists outside the allowlist. This is the test that would have caught both security problems found so far.
- Jobs: each job type runs twice on the same input and must leave the same state. The queue is tested for claiming (two runners, one job), retry with delay, deduplication, and the one-job-per-tournament limit.
- The result pipeline end to end on the emulator: a recorded OpenDota response goes in; the match score, standings, dataset and fantasy leaderboard come out. OpenDota and Steam are replaced by recorded responses (msw). No test calls the network.
- Queries: the shape returned, and a **read-count assertion**: the data layer counts document reads, and each public query has a ceiling (for example "the teams page reads at most T+2 documents"). This stops N+1 reads from coming back.
- Migrations: each script runs on an emulator seeded with old-shape data; the test checks the new shape, that a second run changes nothing, and that old code paths still read the data.

### Level 5. The contract with the bot

1. **Schema tests.** `contract/` holds the schema of every exchanged document. The website's writer output is parsed with the schema; the bot's reader input is the same schema. A fixture folder keeps one example per version. A change that cannot parse the previous version's fixtures fails, which forces a version bump and a compatibility branch.
2. **Scenario tests on the emulator with a fake Dota client.** The fake implements the small interface the runner uses (create lobby, invite, lobby state events, launch, match result). Scenarios: a bo3 played to 2:1; a team that does not show and is forfeited; a reschedule after the session exists; a stand-in approved after the lobby opened; a runner crash and respawn mid-series; no free account; a lost post-game event recovered by the OpenDota poll. Each ends by checking what the website's side received.
3. **Website side without a bot.** A fake bot script writes the bot's documents in order, so the website's handling (jobs, live lobby state, results) is tested without the worker.

What stays manual: one real lobby on Steam with test accounts before a bot release. Valve's Game Coordinator cannot be emulated faithfully; the checklist for this is short and lives in `bot-worker/RELEASE_CHECK.md` (written in WP-20).

### Level 6. End-to-end flows

Playwright drives a production build that talks to the emulators, seeded by a script with one tournament per format. Sign-in uses the Auth emulator. The flows, each one a selling point or a past incident:

1. A visitor opens a tournament's home page, teams, schedule, a team, the stats hub, on desktop and phone sizes; every page has content in the first HTML response.
2. An organizer creates a tournament in the wizard, publishes it, and sees it live.
3. A captain registers a team; an admin verifies it; it appears on the teams page.
4. An admin generates a schedule; a captain proposes a new time; the other captain accepts; the schedule shows it.
5. A match gets its lobby: the lobby session appears, the fake bot plays the series, the result, standings and stats update with no admin action.
6. A captain requests a stand-in; the opponent approves; the lobby roster changes. A third user cannot approve.
7. An admin forfeits a match and reverts it; standings follow both times.
8. Playoffs: seed, generate, play through to the final; the right teams advance.
9. A Swiss tournament: three rounds paired, played and ranked.
10. A user picks a fantasy lineup before the lock and sees points after a game; pick'em likewise.
11. Roles: a referee can set a result and cannot edit the theme; an admin of tournament A gets nothing in tournament B.
12. A tournament on its own domain: pages, links and sign-in work without the slug in the path (after WP-26).

Rules for this level: each test creates what it needs and does not depend on another test; no fixed waits; a failed run keeps its trace and video as a CI artifact.

### Level 7. Performance

Budgets, measured by Lighthouse CI on a production build with emulator data, phone profile, for the home page, teams, schedule and one team page:

| Measure | Budget | Today |
|---|---|---|
| Content in the first HTML response | yes, every public page | none |
| Largest Contentful Paint | under 2.5 s | 7.0 s (January 2026) |
| First Load JS, public page | under 200 kB | 243-489 kB |
| Layout shift | under 0.1 | not measured |
| Time to first byte from the CDN, staging | under 300 ms | about 300 ms for an empty shell |
| Firestore reads per cached page view | 0 | 10 or more |
| Browser Firestore SDK on a public page | not loaded | loaded on every page |

- CI fails a pull request that breaks a budget. Budgets start at today's values for pages not yet converted and tighten as each page is converted.
- The bundle check lists the largest modules, so a new dependency in the shared bundle is seen in review.
- Real-user web vitals from production are the final measure (ADR-13).

The headless browser cannot run in the local agent sandbox (S0 found this). Levels 6 to 8 therefore run in GitHub Actions, and a developer runs them locally with `npm run e2e`.

### Level 8. Visual

Screenshots of about fifteen key screens, each under three themes (a dark default, a light theme, a deliberately extreme theme with long names and missing images) and three widths (390, 1280, 1920). They catch what the owner's product rules care about and no other test sees: overflow, content that does not fit its container, theme colours that were hard-coded. Differences are shown in the pull request; a person approves or rejects them. Animations and video are frozen for the capture.

### Level 9. Load

A script seeds staging with 1,000 synthetic tournaments (16 teams, 60 matches, 120 games each) and then k6 runs three scenarios:

1. **Viewers:** 500 requests a second across random tournaments and pages for ten minutes. Pass: 95% answered under 500 ms, error rate under 0.1%, Firestore reads per request near zero once warm.
2. **Match evening:** 300 series finish within fifteen minutes. Results are enqueued as the bot would. Pass: every result visible within two minutes, no failed job, no tournament delayed by another.
3. **Organizers:** 50 organizers editing settings, schedules and results at once. Pass: 95% of commands under 800 ms, pages show the change within five seconds.

Also measured once, by hand: how many lobbies one bot worker can hold (memory and CPU per runner process), since that sets the plan for scaling out (WP-23).

### Level 10. Production checks

- A read-only smoke test runs after every production deploy: the home page and four subpages of two live tournaments have content, no console errors, correct titles.
- The uptime check and error monitoring run all the time (ADR-13).
- No test writes to production. A dedicated hidden test tournament for write checks in production is possible later; it is not needed while staging mirrors production.

## 2. Environments

| Environment | Firebase | Web app | Bot | Used for |
|---|---|---|---|---|
| Local and CI | Emulator suite (Auth, Firestore, Storage) | `next build` + `next start` on a spare port | fake Dota client | levels 1-8 |
| Staging | project `dota2inhouse-staging` | preview deployments of work-package branches | a second small worker, switched on when needed | levels 9, manual checks, bot release check |
| Production | `tournament-tracker-f35tb` | production deployment | Railway | level 10 only |

The emulator needs Java, which GitHub's runners have. Locally it runs with `npm run emulators`; `firebase-tools` becomes a pinned dev dependency so everyone uses the same version.

**Fixtures.** One seed module builds tournaments of each format at chosen stages (registration open, mid-season, playoffs, finished). It is used by the emulator tests, the end-to-end tests, the staging seed and the load seed, so all of them describe the same world. No fixture contains real e-mail addresses, tokens or Discord ids.

### What the owner must create

Nothing below can be done by an agent, because each needs an account owner. This is question 5 in `STATUS.md`.

1. **A Firebase project for staging**, named `dota2inhouse-staging`, on the Blaze plan with a budget alert at a low amount.
   - Firestore in Native mode, location `eur3` (Europe). The location cannot be changed later.
   - Authentication with the Google provider enabled.
   - A Storage bucket in a European location.
   - A web app registered in the project (this gives the six `NEXT_PUBLIC_FIREBASE_*` values).
   - A service account key for the Admin SDK.
2. **A Discord application for staging** (Developer Portal), with its client id and secret, and redirect URLs for the staging address. Using production's application for staging is possible but mixes the two.
3. **GitHub repository secrets:** the staging service account (base64), the staging `NEXT_PUBLIC_FIREBASE_*` values, the staging Discord client id and secret, a staging `CRON_SECRET`, and a Firebase CI token or workload identity for deploying rules and indexes to staging.
4. **Hosting for previews** (if ADR-03 is accepted): a Vercel project for the tournament app connected to the GitHub repository, with the staging values as preview environment variables. If ADR-03 is declined: a second Firebase Hosting site in the staging project.
5. **For bot testing, later (WP-20):** two or three Steam accounts that are only for testing, and a Railway service for the staging worker that is switched off when not in use.
6. **Error monitoring** (ADR-13): a Sentry organization with two projects (web, bot) and their DSNs as secrets.

Production's own secrets are not needed for any test and must not be added to CI until deploys move there (WP-03).

## 3. Coverage goals

Coverage is a floor that stops untested code from being added, not a target to chase. The percentages apply to new and moved code; the old folders are judged by whether the risky paths have tests, in the order of section 4.

| Code | Line coverage floor | Also required |
|---|---|---|
| `src/features/*/domain`, `contract/` | 95% | property tests for standings, brackets and scoring |
| `src/features/*/commands.ts`, `queries.ts`, jobs | 85% | the four standard tests per command; idempotency test per job |
| `src/platform` | 85% | |
| `bot-worker/src` logic (not the Steam client wrapper) | 80% | the seven scenarios of level 5 |
| React components | no floor | level 8 screens, level 2 where there is behaviour |
| `firestore.rules`, `storage.rules` | every `allow` statement reached by a test | the role matrix |
| Old code in `src/lib`, `src/components` | no floor | a characterisation test before it is changed |

Other goals:
- Every route that changes data is covered by the route-inventory test: 100%.
- Each of the twelve end-to-end flows is green on the production branch at all times.
- A bug found in production gets a test at the lowest level that can show it, in the same change as the fix.
- The test suite for levels 1-5 runs in under five minutes on CI. If it gets slower, it is split, not skipped.

## 4. The order to build in

The order follows risk and the roadmap: first the tests that protect against harm that could happen today, then the tests that make the big changes safe, then the wide journeys.

| Step | What | Why now | Work package |
|---|---|---|---|
| 1 | Route-inventory test and the role tests for the routes and server actions fixed in the security pass | The two security holes found were both "a write nobody checked" | WP-01 |
| 2 | Emulator harness in CI; the rules matrix; close the rule holes | Rules are the only guard on browser writes until commands replace them | WP-02 |
| 3 | Fixtures and the seed module; staging project | Everything after this needs them | WP-03 |
| 4 | Characterisation tests and golden fixtures for the result pipeline and standings | They must exist before that code is moved | WP-12 |
| 5 | Performance budgets and the first Playwright flow (flow 1) | Proves the fast-page work and guards it | WP-06, WP-11 |
| 6 | Level 1 for each `domain/` as it is extracted; level 4 for each command as it is written | Tests arrive with the code, never after | WP-13 onward |
| 7 | Jobs: queue tests and idempotency | Before result processing moves to the queue | WP-14 |
| 8 | Contract schemas, bot scenario tests with the fake Dota client | Before the bot's code is converted | WP-20, WP-21 |
| 9 | End-to-end flows 2-11 | Once the commands they exercise exist | WP-17 onward, WP-30 |
| 10 | Visual screenshots across themes | Together with the theme work, so S2's redesign starts with a net | WP-27 |
| 11 | Load test on staging | Before the platform is opened to outside organizers | WP-31 |
| 12 | Production smoke test wired to deploys | When deploys move to CI | WP-03 |

## 5. What is deliberately not tested

- Valve's Game Coordinator behaviour beyond the fake client's interface. It is covered by the manual release check with real accounts.
- Third-party services themselves (OpenDota, Steam Web API, Discord, Twitch, Bunny, Gemini). Their responses are recorded and replayed; a small scheduled check on staging warns when a real response no longer matches the recording's schema.
- Unreachable legacy code. It is deleted (WP-05), not tested.
- Pixel-exact animation and video playback.
