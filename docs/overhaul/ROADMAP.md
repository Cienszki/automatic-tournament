# Roadmap

Written in S1 (2026-11-13) by Fable. It turns `ARCHITECTURE.md` into work packages (WPs). Each WP is written so that an Opus implementer can do it from this text, `BRIEF.md`, `CONVENTIONS.md` and the linked decision record (ADR), without the context of the session that planned it. S2 (organizer experience) and S3 (card game) add their own WPs to this file in the same format.

## How to read and run this

- **Order.** WPs are numbered in the recommended order. The order puts three things first: closing security holes that are live today, building the safety net, and testing the riskiest unknown (fast pages through a CDN on new hosting) before anything depends on it.
- **The leagues keep running.** Every WP leaves the site working. Schema changes are additive, with a migration script and an emulator test. New pipelines run beside old ones behind a flag on one tournament before the rest. Nothing here deploys; the owner copies merged WPs to production when ready.
- **For the implementer, every time.** Work in a worktree under `.claude/worktrees/` on branch `wp/NN-name` from `overhaul`. Follow the limits in `BRIEF.md`: no deploy, no writes to production, no build with production credentials (blank `FIREBASE_SERVICE_ACCOUNT_BASE64` and the other secrets), no `npm install` into a new folder. Done means: typecheck, lint, tests and build pass; each acceptance criterion is checked off in the final report; `STATUS.md` is updated.
- **Size.** S is up to half a day of agent work, M about a day, L two to three days, XL more and must be split by the orchestrator before starting.
- **Review.** "Fable" means a Fable review before merging, because a mistake would be costly or hard to see (security, data migration, live bot, design-preserving rewrites). "Opus" means the `reviewer` agent is enough.
- **Rollback.** Every WP is one `--no-ff` merge, so `git revert -m 1 <merge>` undoes it. A WP lists more only when a revert is not enough.

## Milestones

| Milestone | WPs | What is true when it is reached |
|---|---|---|
| M0 Safe to change | 01-05 | Known holes closed, rules tested, a staging environment, errors monitored, dead code gone |
| M1 Fast | 06-11 | Every public page arrives complete from the CDN; budgets enforced in CI |
| M2 One results pipeline | 12-16 | Results, standings, stats, fantasy and pick'em computed once, by jobs, with tests |
| M3 The server owns writes | 17-19 | No browser writes; rules deny them; every change is audited |
| M4 A bot we can maintain | 20-23 | Bot source in TypeScript with tests, a written contract, no idle cost, a plan to scale out |
| M5 A platform | 24-29 | Organizations and roles, Letnia inside the model, custom domains, themes on the server, database in Europe |
| M6 Proven | 30-31 | End-to-end flows green; load test passed at 1,000 tournaments |

What can run in parallel: WP-04 and WP-05 beside anything. WP-12 beside M1. M4 beside M2 and M3 (different folders). S2's admin work should start after WP-07 and land together with WP-18.

---

## M0. Safe to change

### WP-01. Close the unauthenticated server actions and the weak routes

- **Goal.** No server function that reads private data or writes anything can be called without a permission check. Small enough to cherry-pick to production on its own.
- **Why.** `ARCHITECTURE.md` B3, B4. Server actions in five files use the Admin SDK and check no caller; client components import them, so they are public endpoints.
- **Files.** `src/lib/standin-actions.ts`, `src/lib/bot/bot-config-actions.ts`, `src/lib/playoff-sync-actions.ts`, `src/lib/player-profile-actions.ts`, `src/lib/fake-team-action.ts`, `src/lib/admin-actions.ts` (the exports with no `performAdminAction`), `src/lib/match-players-action.ts`, `src/lib/team-actions.ts` (`getUserTeam`); their importers (`MyTeamView.tsx`, `MatchPanel.tsx`, `StandinsTab.tsx`, `MatchesTab.tsx`, `PDLMatchRules.tsx`, the three bot routes); routes `api/manage/bot/config` (GET), `api/manage/bot/sessions` (GET), `api/pickem/export`, `api/manage/pdl/sync-matches` (default tournament id), `api/dev/*`, `api/import-match`, `api/validate-steam`.
- **Design.** ADR-06, ADR-07, in their smallest form.
  1. For each `'use server'` file: functions that only other server code calls move to a plain module that starts with `import 'server-only'` and loses the `'use server'` line. Functions that a client component calls become route handlers under `/api/manage/...` or `/api/...` that call `requireAdmin(req, tournamentId)` or `requireUser(req)` plus the specific check (captain of the opponent team for approving a stand-in; captain of the requesting team for cancelling; admin for appeals and playoff sync). The client calls them with `fetch` and the ID token, as other tabs already do.
  2. `saveTournamentBotConfig` takes the actor from the verified token, never from an argument.
  3. Delete `fake-team-action.ts`, `createFakeTeam` and `components/app/admin/FakeTeamGenerator.tsx` (unreachable, creates Auth users).
  4. Replace hand-rolled admin checks with `requireAdmin` in the routes listed. `bot/config` GET and `bot/sessions` GET require a tournament admin; the public part captains need stays available through `getPublicBotInfo` behind `requireUser`.
  5. `pickem/export` requires a tournament admin. `sync-matches` rejects a missing `tournamentId`. `api/dev/*` routes are deleted. `import-match` is deleted with its only caller `MatchImportModal.tsx` (it writes the legacy root collection for any tournament).
- **Acceptance.**
  - `grep -r "'use server'\|\"use server\"" src` lists only files where every export authenticates, and the list is written into the test below as an allowlist.
  - A signed-in user who is not a captain of the opponent gets 403 when approving a stand-in; the right captain succeeds; an admin succeeds for appeals.
  - Every route under `src/app/api` that writes calls `requireAdmin`, `requireUser` or the cron secret check; none hand-rolls `verifyIdToken`, except the login and session routes.
  - The stand-in flow, the bot tab and the match tab work as before for the right roles (described step by step in the report).
- **Tests.** A route-inventory test (`TEST_STRATEGY.md` level 4) that fails on a new unauthenticated writer or a `'use server'` file outside the allowlist. Mocked-Admin-SDK tests per new route for allowed and refused roles, in the style of `src/__tests__/bot-routes-auth.test.ts`.
- **Risks and rollback.** A captain flow breaks because a check is too strict. Mitigate by reading how `MyTeamView` calls each action before changing it. Revert the merge to roll back.
- **Dependencies.** None.
- **Size.** M. **Review.** Fable.

### WP-02. Test the Firestore and Storage rules and close their holes

- **Goal.** The rules are covered by a role matrix on the emulator, and the holes that let a captain or any signed-in user change shared data are closed.
- **Files.** `firestore.rules`, `storage.rules`, new `rules-tests/` (or `src/platform/rules/*.test.ts`), `package.json` (pin `firebase-tools` and add `@firebase/rules-unit-testing` as dev dependencies; add `npm run emulators` and `npm run test:rules`), `.github/workflows/ci.yml`, `firestore-secure.rules` (delete; not deployed).
- **Design.** `TEST_STRATEGY.md` level 3; `ARCHITECTURE.md` B2.
  1. Write the matrix for the current rules first, with each known hole as an expectation that fails.
  2. Close the holes with field-level conditions. A captain may update on a match only the fields the captain flows write (find them in `MyTeamView.tsx`: reschedule request fields, proposed times, stand-in related fields); never `teamA.score`, `teamB.score`, `status`, `winnerId`, team ids. A team may be created only with `captainId == request.auth.uid` and status `pending`, and a captain may not change `captainId`, `status`, `divisionId` or standings fields. A captain may not set `status` on a stand-in request of their own team. Only a platform admin or the organizer may delete a tournament admin; nobody may delete the organizer's admin document.
  3. Add the missing rules that the app needs and that default-deny today breaks: `tournaments/{id}/fantasyRounds` (public read, admin write), `teams/{id}/transfers` (captain create, public read). Remove the unmatched `stats/players/{playerId}` rule.
  4. Storage: uploads to `team-logos`, `screenshots` and `standin-screenshots` are limited by size and content type and to file names that begin with the uploader's uid; the catch-all read for any signed-in user is removed.
- **Acceptance.** `npm run test:rules` passes in CI on the emulator; every `allow` line is reached by a test; each hole above has a test that was red before and is green now; the captain flows in `MyTeamView` and team registration still succeed in the tests with realistic payloads copied from the code.
- **Tests.** The matrix itself.
- **Risks and rollback.** Tighter rules break a live captain flow that writes a field nobody listed. Mitigate: derive the allowed field list from the code, and have the report list every browser write to `matches`, `teams` and `standinRequests` with the rule that allows it. Rules deploy separately from the app (by the owner), so rollback is redeploying the previous file, kept as `firestore.rules.prev` in the WP's report, not in the repo.
- **Dependencies.** WP-01 (stand-in decisions already moved to the server).
- **Size.** L. **Review.** Fable.

### WP-03. Staging, fixtures and deploys from git

- **Goal.** A staging environment that every branch can be tried on, one seed module for test data, and a deploy pipeline that does not use anyone's working copy.
- **Files.** `.github/workflows/` (ci, preview, deploy-rules), new `scripts/seed/` (TypeScript, emulator and staging targets), `next.config.mjs` (origins from environment variables: replace the hard-coded `FIREBASE_ORIGIN`; `allowedOrigins`), `src/app/sitemap.ts` (generate at request time with a one-hour cache; no build-time read), `src/server/accounts/identity.ts` (`ORIGINS` from an environment variable), `firebase.json` (staging project alias in `.firebaserc`), `docs/DEV_SETUP.md`, `.env.local.example`.
- **Design.** ADR-15; `TEST_STRATEGY.md` section 2.
  1. The seed module builds one tournament per format (league, MMR groups, Swiss, LAN qualifier) at chosen stages, with teams, rosters, matches, games and performances, using builders that later tests reuse. It refuses to run unless the target is the emulator or the project id equals the staging id.
  2. CI: add the emulator to the test job. Add a job that deploys rules and indexes to staging on merge to `overhaul`. Document, but do not enable, the production deploy job; it is switched on by the owner after M1.
  3. A build must succeed and read nothing with all server secrets blank. Add a CI step that proves it (build with blank secrets and assert the sitemap route is dynamic).
  4. A read-only production smoke test script (Playwright, five URLs of two live tournaments) that the owner or CI can run after a deploy.
- **Acceptance.** `npm run seed:emulator` gives a browsable local site with four tournaments; the same module seeds staging when the owner's secrets exist; no file contains the production origin as a literal except documentation; CI is green; `docs/DEV_SETUP.md` describes local, staging and production in one page.
- **Tests.** Seed module unit tests (each builder gives schema-valid documents); the blank-secrets build check.
- **Risks and rollback.** Depends on the owner creating the staging project (question 5). Everything except the staging deploy job can be finished without it; mark that job as waiting.
- **Dependencies.** WP-02 (emulator in CI).
- **Size.** L. **Review.** Opus.

### WP-04. Error monitoring, structured logs and bot heartbeat

- **Goal.** When something breaks in production, the owner is told within minutes, with the tournament and the release.
- **Files.** `src/lib/error-reporting.ts` (give it a Sentry provider), new `src/platform/log/`, `src/app/error.tsx`, `global-error.tsx`, `src/components/ErrorBoundary.tsx`, `instrumentation.ts`, `bot-worker` logger and conductor (heartbeat document `workers/{id}` every 30 s; additive), a small alert helper that posts to a Discord webhook, a web-vitals reporter component.
- **Design.** ADR-13. DSNs and the webhook URL come from environment variables; with none set, everything is a no-op, so this can merge before the owner creates the accounts.
- **Acceptance.** With a DSN set on staging, a thrown error in a page, in a route and in the bot each appear in Sentry with release, tournament id and user id. A stale heartbeat (worker stopped for 3 minutes) produces one alert, not one per minute. No secret or token appears in an event (checked by a scrubbing test).
- **Tests.** Unit tests for the logger, the scrubber and the alert de-duplication.
- **Risks and rollback.** The bot change touches the live conductor: add only the heartbeat write inside a try/catch, in the style of the existing "inhouse" hooks. Revert to roll back.
- **Dependencies.** None. Question 9 for the accounts.
- **Size.** M. **Review.** Opus.

### WP-05. Delete what is dead and remove single-tenant fallbacks

- **Goal.** The repository contains only code that can run, and no code falls back to a specific tournament.
- **Files.** The 108 unreachable files listed in `inventory/CODE_HEALTH.md` section 3 (re-derive the list with an import graph before deleting); the legacy root pages `src/app/{teams,groups,schedule,playoffs,fantasy,pickem,stats,rules,faq,standins,register,my-team}` except those WP-25 still needs as a reference (keep `src/app/teams/[teamId]` only if still served; otherwise redirect it); `scripts/` (move the few useful ones to `scripts/tools/` with a README, delete the rest); `_archive/`; root files `PERFORMANCE_*.md`, `database_schema.md`, `hero-data.json`, `.modified`, `apphosting.yaml`; unused dependencies `styled-components`, `date-fns-tz`; `src/lib/definitions.ts` (`getLeagueId` fallback); `src/app/api/twitch/live/route.ts` (hard-coded channel); `src/app/page.tsx` (hard-coded `/wiosenna`); `src/components/layout/Footer.tsx:155`; `src/lib/themes/index.ts` (`getThemeBySlug` default); dead bot code on the website (`bot-pool-manager.ts` except `getBotPoolStatus`, `scheduleNextGameInSeries`, the `set_teams` writes in `syncLobbySessionStandins` if WP-21 has not removed them); dead admin tabs `GroupsTab.tsx`, `StandinsTransfersTab.tsx`, `tabs/index.ts`; outdated docs in `docs/` that describe `/api/admin`.
- **Design.** `ARCHITECTURE.md` B10, ADR-05 rule 2.
  - `getLeagueId` returns `null` when a tournament has no league id, and the sync reports "no league id set" for that tournament; it never substitutes another league.
  - The Twitch route takes the channel from the tournament.
  - The root path renders the default tournament from a platform config value, not a literal.
  - Deletions go in separate commits per group, each proven by `tsc` and the build, as S0 did.
- **Acceptance.** The import graph finds no unreachable file under `src`; `scripts/` has a README and fewer than 15 files; a tournament without a league id shows a clear sync error in the admin panel and imports nothing; build, tests and lint pass; the report lists every deleted group and its line count.
- **Tests.** A unit test for `getLeagueId`; a CI check that runs the import-graph script and fails on unreachable files.
- **Risks and rollback.** A file that looked dead is loaded by a dynamic import the graph missed. The build and the end-to-end smoke of each admin tab catch it; revert the single commit.
- **Dependencies.** None; merge `feature/multi-tournament-platform` first so deletions do not fight the owner's edits.
- **Size.** M. **Review.** Opus.

---

## M1. Fast

### WP-06. Trial: a server-rendered, CDN-cached page on the new hosting

- **Goal.** Measured proof, or disproof, that the target read path works end to end before the rest of M1 is built on it. This is the riskiest unknown in the plan.
- **Files.** New branch only; throwaway code allowed except the parts named "keep". `src/app/[tournamentSlug]/teams/` (a server-rendered variant behind `?v=2` or a parallel route), a minimal `src/platform/cache/` (`cachedQuery`, `tags`) (keep), a revalidate endpoint (keep), `src/middleware.ts`, `src/i18n/request.ts` (no cookie read on the trial route), hosting configuration.
- **Design.** ADR-01, ADR-02, ADR-03.
  1. Deploy the branch as a Vercel project connected to the staging Firebase project (owner creates both; questions 5 and 6). If the owner has not answered, do steps 2-4 locally with `next start` and report the hosting part as not done.
  2. The trial page renders the teams of a seeded tournament on the server from one cached query, with the theme as CSS variables in the HTML and no loading gate.
  3. Put a copy of the community site's fallback rewrite in front (a tiny second project or a local proxy that behaves the same) and navigate between two pages through it.
  4. Change a team through the revalidate endpoint and time how long the old page is served.
- **Acceptance.** A written result in `docs/overhaul/spikes/WP-06.md` with numbers for: time to first byte and Largest Contentful Paint, cold and warm, direct and through the rewrite; whether the HTML and the client-navigation payload are both served from the CDN cache (response headers quoted); seconds from invalidation to fresh content, on two regions; whether the `.rsc` path workaround in `src/middleware.ts` is still needed; function duration and Firestore reads on a cache miss; any feature of the app that does not run on the new hosting (list each `runtime`, `maxDuration`, file-system or long-request assumption found by grep). A clear recommendation: go, go with changes, or fall back to time-based caching on Firebase.
- **Tests.** The measurements are the tests; scripts are kept in `scripts/measure/`.
- **Risks and rollback.** None for production; nothing merges except the kept helpers.
- **Dependencies.** WP-03 (seed, env-driven origins).
- **Size.** M. **Review.** Fable (decision gate for ADR-03).

### WP-07. Platform kernel and enforced boundaries

- **Goal.** The shared machinery that every later WP uses exists, is tested, and the lint enforces the module rules.
- **Files.** New `src/platform/`: `firestore/` (one Admin init replacing `src/server/lib/admin.ts` and `src/lib/admin.ts`, with re-exports left at the old paths; `paths.ts`; database id from an environment variable; a read counter for tests), `auth/` (`getActor`, `authorize`, the role-to-action table; `requireAdmin` and `requireUser` become thin wrappers), `http/defineCommand.ts`, `cache/` (from WP-06), `errors.ts`, `log/` (from WP-04), `tenancy/` (`resolveTournament(slugOrHost)`, the `slugs/{slug}` index); `scripts/migrations/001-slug-index.ts`; `eslint.config.*` (boundaries, size limits, import allowlists, the ratchet script); `src/features/README.md`; `src/lib/api/tournaments.ts` (`checkSlugClaim`, `isSlugAvailable`, `fetchOwnedSlugs` stop scanning the collection).
- **Design.** ADR-02, ADR-05, ADR-06, ADR-07, ADR-14; `CONVENTIONS.md` sections 5, 6, 12.
  - The slug index is additive: creating or renaming a tournament writes `slugs/{slug}` in the same transaction; the migration backfills it; readers fall back to the `where('slug','==')` query when the index document is missing.
  - `authorize` implements the table of ADR-06 using today's stored roles (platform admin, organizer, tournament admin, captain). Organization roles arrive in WP-24 without changing callers.
  - `defineCommand` writes the audit entry and returns typed errors as JSON with a `code`.
- **Acceptance.** The kernel has no import from `src/features`, `src/lib` or `src/components`; one example command and one example query are converted end to end (suggested: `captain-change-code` and `getTeams`) and behave as before; the lint fails on a deliberate violation of each boundary rule (shown in the report) and passes on the repo; the ratchet numbers are recorded in a checked-in file.
- **Tests.** Table test of `authorize` for every role and action; emulator tests for `defineCommand` (allowed, forbidden, invalid, wrong tournament, audit written), for the slug index (two creations of one slug: one wins), and for `cachedQuery` tag invalidation.
- **Risks and rollback.** Two Admin init modules merged into one changes failure behaviour (one throws, one warns). Keep "throw at first use" and check the build with blank secrets still passes.
- **Dependencies.** WP-06 result (the cache helper's final shape).
- **Size.** L. **Review.** Fable.

### WP-08. The server-rendered shell

- **Goal.** Every tournament page gets its tournament, theme, title and navigation from the server in the first response. The loading gate and the whole-collection read are gone.
- **Files.** `src/app/layout.tsx`, `src/app/[tournamentSlug]/layout.tsx` (becomes a server component with a small client shell), `src/context/TournamentContext.tsx`, `src/i18n/request.ts`, `src/components/tournament/TournamentRedirect.tsx`, `DraftGate`, `DynamicFontLoader`, `ThemeFontApplier`, `LoadingScreen` usage, `src/context/AuthContext.tsx` (remove the `/api/session` cookie call), `src/app/api/session/` (delete), new `src/features/tournaments/{queries.ts,domain/theme.ts,components/}`, `generateMetadata` and an `opengraph-image` for the tournament layout, `next.config.mjs` redirects.
- **Design.** ADR-01, ADR-08 (theme and language parts), section 2.1.
  1. `getTournamentBySlug` (cached, tag `core`) loads the tournament on the server. `TournamentProvider` stays as a client context **seeded from server props**, so the roughly 100 components that call `useTournament()` keep working. It no longer fetches the current tournament or the list. The few consumers of the tournament list (navbar switcher, organizer page) get a small cached query limited to the same organizer.
  2. The theme is rendered as a `<style>` block of CSS variables in the layout, for all variables that `TournamentContext` sets today (including heading, title and glow, which the inline script misses). Remove the inline script, the session cache and the hard-coded Letnia and PDL fallback configs.
  3. Children render immediately. The full-screen loading screen remains only for the home page hero, with a hard cap (suggest 1.2 s) and never covering content that is ready. Fonts use `font-display: swap`; the font gate is removed.
  4. Language comes from the tournament (`locale`, default `pl`); `request.ts` reads no cookie. Pages become static per slug with on-demand regeneration.
  5. `redirectToSlug` and unknown slugs are handled on the server (`redirect`, `notFound`). A draft tournament renders per request with `no-store` and checks the admin token or the preview token.
  6. Each tournament page has a title, description and preview image from the tournament.
- **Acceptance.** `curl` of any tournament page returns HTML containing the tournament name, the theme variables and the navbar, with a cacheable `Cache-Control`; no request to the `tournaments` collection is made from the browser on load (network log); the build output marks tournament pages as static or ISR, not dynamic; a draft tournament is invisible without access; visual comparison of home, teams and schedule for wiosenna and pdl-s2 against production shows no unintended difference (screenshots in the report); sign-in still works.
- **Tests.** Server tests for the theme-to-CSS function (including `hsl()` colours) and for draft access; Playwright flow 1 on the seeded tournaments; a test that the layout makes at most two document reads on a cache miss.
- **Risks and rollback.** This touches every page. Hydration mismatches from theme or time; components that assumed `tournament` could be null. Mitigate by keeping the context API identical and converting in one WP so there is no half state. Roll back by reverting the merge.
- **Dependencies.** WP-07.
- **Size.** L. **Review.** Fable.

### WP-09. Public subpages on cached queries

- **Goal.** Teams, schedule, groups and divisions, playoffs, rules, news, prizes and the static pages arrive complete, with no second loader and no browser Firestore reads.
- **Split.** 09a teams and schedule; 09b groups, divisions, playoffs; 09c rules, news, prizes, about, FAQ, format pages, diploma. Each is its own branch.
- **Files.** `src/app/[tournamentSlug]/{teams,schedule,groups,divisions,playoffs,rules,news,prizes,about,faq,format-lan,privacy,diploma}/page.tsx`, `src/hooks/usePDLData.ts`, `useDivisionData.ts`, new `src/features/{teams,schedule,formats,content}/queries.ts` and `components/`.
- **Design.** ADR-01, ADR-02; `CONVENTIONS.md` section 1 example.
  - Each page becomes a server component that calls cached queries and renders the existing view component with props. The view keeps its look; its data-fetching effect and its `<LoadingScreen/>` are removed.
  - Queries return slim shapes (the teams list does not carry 190 KB of roster detail the page does not show).
  - Rules: one query returns sections with their paragraphs (no read per section).
  - Standings shown on these pages keep their current computation for now, moved into `features/formats/domain` unchanged; WP-13 replaces it.
  - Admin tabs that still write from the browser call the revalidate endpoint after a successful save (one helper, added to each tab's save path).
- **Acceptance.** For each page: content in the first HTML; zero Firestore requests from the browser on load; a change saved in the admin panel is visible on the public page within 10 seconds; visual comparison with production shows no unintended difference; First Load JS for the route is lower than in `inventory/PAGES.md` section 3.
- **Tests.** Emulator tests per query (shape and read-count ceiling); Playwright flow 1 extended to each page.
- **Risks and rollback.** A page shows stale data because a write path does not invalidate. The 5-minute limit bounds it; the report lists every write path and its tag.
- **Dependencies.** WP-08.
- **Size.** L in total (M each). **Review.** Opus; Fable for 09b (standings must not change).

### WP-10. The home page on server data, and deep links without redirects

- **Goal.** The home page keeps its design and gets its data from the server. `/stats`, `/rankings`, `/teams/[teamId]` and the player page open the right section directly.
- **Files.** `src/app/[tournamentSlug]/page.tsx`, `src/components/tournament/FullScreenHomePage.tsx` (1,142 lines; split by section while here), `src/context/HomeNavigationContext.tsx`, `src/app/[tournamentSlug]/{stats,rankings}/page.tsx`, `teams/[teamId]/**`, `HeroMediaGateProvider`, `src/components/stats-lab/kit.tsx`.
- **Design.** Section 2.1 points 4-6.
  - The page loads teams, matches, divisions and playoff matches once through the WP-09 queries and passes them to the client shell. The eight browser reads and the duplicate reads of teams and matches are removed.
  - `?view=` stays a client-side concern so the HTML is the same for every view. The deep-link routes render the same shell with an `initialView` prop.
  - Heavy sections (stats hub, cards, account, my team, pick'em) stay lazy. The stats dataset is prefetched when the browser is idle, as now.
  - Per-user data (the user's team, notifications) loads after the page is shown.
- **Acceptance.** The home page's first HTML contains the hero text and the first section's data; no browser Firestore read happens before interaction except per-user data; deep links make no client redirect; scrolling, snapping, section order and animations are unchanged (side-by-side recording in the report); the file is split so no part exceeds 400 lines.
- **Tests.** Component tests for section navigation; Playwright for the deep links and for the snap-scroll order.
- **Risks and rollback.** The owner's favourite page: any visible change is a defect. The reviewer compares recordings at three widths.
- **Dependencies.** WP-09a, 09b.
- **Size.** L. **Review.** Fable.

### WP-11. Performance budgets in CI and a lighter bundle

- **Goal.** Speed cannot regress unnoticed, and public pages stop shipping the Firebase data SDKs.
- **Files.** `.github/workflows/` (Lighthouse CI, bundle report), `lighthouserc.*`, `src/lib/firebase.ts` (split: auth loaded lazily; firestore, storage and functions only where imported), `src/context/AuthContext.tsx`, polling components (`NotificationBell.tsx`, `InfoWidgets.tsx`), `src/lib/rate-limit.ts` (client address from the proxy's header through one helper; store shared across instances).
- **Design.** `TEST_STRATEGY.md` level 7; ADR-12; ADR-16.
- **Acceptance.** The budgets table of `TEST_STRATEGY.md` is enforced for home, teams, schedule and a team page; the Firestore browser SDK is absent from those pages' bundles (bundle report); the notification bell does not poll a server-rendered route; the rules assistant's per-user limit works behind the proxy (test with forwarded headers).
- **Tests.** The CI checks themselves; unit tests for the address helper.
- **Dependencies.** WP-10.
- **Size.** M. **Review.** Opus.

---

## M2. One results pipeline

### WP-12. Characterisation tests and golden fixtures for results

- **Goal.** A safety net that records what the result import, score derivation and standings do today, before they are moved.
- **Files.** New `src/features/results/__fixtures__/` and tests; reads `src/lib/pdl-admin-actions.ts`, `opendota.ts`, `useDivisionData.ts`, `swiss/pairing.ts`, `stats-lab/*`; a script `scripts/tools/capture-fixture.ts` that reads a tournament through the public site and Firestore's public REST API (read-only) and writes a reduced JSON.
- **Design.** `TEST_STRATEGY.md` level 1, "golden fixtures".
  - Capture pdl-s2 and Wiosenna: teams, matches, games, performances, the published tables. Remove everything personal except nicknames and Steam ids, which are public.
  - Record 8-10 OpenDota match responses that cover: a normal game, an unparsed game, a game with a stand-in, a practice game, a game between teams with a shared former player.
  - Tests call the existing functions where they are pure, and for the impure ones run them against the emulator seeded from the fixture, then snapshot the documents written.
- **Acceptance.** Tests pin: team identification, match selection, series completion per format, standings per division with the current tie-break, Swiss standings, forfeit handling (including the two known inconsistencies, pinned as "current behaviour" with a comment naming WP-13). All green on current code.
- **Dependencies.** WP-02 (emulator in CI). Can run beside M1.
- **Size.** M. **Review.** Opus.

### WP-13. The `results` feature: one way to change a result

- **Goal.** Every change to a result goes through one small set of tested commands, and standings have one implementation per format.
- **Files.** `src/lib/pdl-admin-actions.ts` (2,200 lines; dissolved), `src/lib/opendota.ts`, `unified-game-save.ts`, `admin-match-actions-server.ts`, `match-flags.ts`, `playoff-result-bridge.ts`, `playoff-advancement.ts`, `playoff-mirror.ts`, `src/app/api/manage/pdl/*`, `api/manage/extra-match`, `api/manage/ban-team`, the score-edit code in `MatchesTab.tsx:321-357`, `src/hooks/useDivisionData.ts`, `usePDLData.ts`, `src/lib/api/groups.ts`, `stats-lab/season.ts`; new `src/features/results/` and `src/features/formats/domain/standings/`.
- **Design.** ADR-11.
  - `domain/`: `identifyTeams`, `selectMatch`, `seriesState(format, games)`, `standings(format, config, matches)` with tie-break order as data. Defaults reproduce what each tournament shows today (the fixtures prove it). Where two pages disagree today, the division table's order wins and the difference is listed in the report for the owner.
  - `commands.ts`: `recordGame`, `deleteGame`, `forfeitMatch`, `revertForfeit`, `setManualResult`, `addExtraMatch`, `banTeam`, `skipGame`. Each ends by enqueuing `recompute` (until WP-14 exists, by calling the recompute function directly).
  - The existing `/api/manage/pdl/*` URLs stay and call the new commands, so the admin tabs do not change. The manual score edit in `MatchesTab` calls `setManualResult` in place of its browser batch.
  - Fixes that change behaviour, each with a test: a full-series forfeit updates standings; a forfeited game in a bo3 does not complete the series at two game documents; a manual edit updates standings.
- **Acceptance.** `pdl-admin-actions.ts` is gone or under 200 lines of re-exports; golden-fixture tests pass on the new code; the three fixes have tests; standings on the division page, the home page and the stats hub agree for both fixture tournaments; no function name contains `PDL`.
- **Tests.** Level 1 for the domain with property tests; level 4 for each command.
- **Risks and rollback.** A subtle change in which match a game is attached to. The golden fixtures and a dry-run mode (`recordGame` with `dryRun` returns what it would write) reduce it; the owner can compare a dry run against production data before copying this WP to production.
- **Dependencies.** WP-07, WP-12.
- **Size.** L. **Review.** Fable.

### WP-14. The job queue

- **Goal.** Background work is a visible, retried, per-tournament queue. The five-minute orchestrate call stops being the only scheduler.
- **Files.** New `src/platform/jobs/` (queue, runner, registry), `src/app/api/jobs/tick/route.ts`, `src/app/api/manage/bot/orchestrate/route.ts` (becomes: convert pending `botSyncTasks` into jobs, then run the tick; same URL and secret, so the bot needs no change), `src/server/notify/events.ts` (`sendMatchReminders`), `src/server/card-lab/duels.ts` (`settleStale`), `rewards.ts` (`roundRewards`), `firestore.indexes.json` (jobs: `status` + `runAt`), a platform-admin page listing jobs.
- **Design.** ADR-09.
  - Job types: `import-results`, `apply-forfeit`, `recompute`, `send-reminder`, `settle-duel`, `round-rewards`.
  - Reminders become jobs created when a match gets or changes its time (in the scheduling commands; until those exist, a sweep with one indexed collection-group query on `matches` by `scheduledFor`, not a loop over tournaments).
  - The runner claims with a transaction, runs up to N tournaments in parallel within a time budget, one job per tournament at a time, and reports failures through WP-04's alert.
  - An enqueue pokes the tick endpoint without waiting.
- **Acceptance.** A bot-reported game on the emulator results in standings updated within seconds of the tick; two runners never run the same job; a failing job retries with growing delay and ends `failed` with an alert; one tournament's slow import does not delay another's (test with an artificial delay); `sendMatchReminders` makes no per-tournament query; the orchestrate route's response shape is unchanged for the bot.
- **Tests.** `TEST_STRATEGY.md` level 4, jobs paragraph; an idempotency test per job type.
- **Risks and rollback.** Double processing during the switch. `import-results` is already idempotent through `processedGames`; keep `botSyncTasks` as the record until WP-21. A flag falls back to the old in-route processing.
- **Dependencies.** WP-07, WP-13.
- **Size.** L. **Review.** Fable.

### WP-15. The `stats` feature: one compute, a stored dataset

- **Goal.** Everything derived from results is computed by one pure function after each change and stored. No visitor waits for a rebuild, and the old calculators are deleted.
- **Files.** `src/lib/stats-lab/*` (moves into `src/features/stats/domain`), `src/app/api/stats/dataset/route.ts`, `src/lib/comprehensive-stats-calculator.ts`, `stats-calculator-basic.ts`, `stats-calculator-admin.ts`, `stats-service-simple.ts`, `stats-definitions.ts`, `stats-types.ts`, `post-sync-recalculations.ts`, `performance-rankings-calculator.ts`, `src/components/tournament/RankingsView.tsx`, `admin/tabs/StatsTab.tsx`, `src/server/card-lab/collection.ts`, `api/stats/recalculate`, `api/rankings/recalculate`.
- **Design.** ADR-11, ADR-12.
  - The `recompute` job builds the dataset (as `build-dataset.ts` does), runs `computeTournament`, and stores: the dataset as a gzip file in Storage at `tournaments/{id}/derived/dataset-v{n}.json.gz` with a pointer document, and standings in `tournaments/{id}/derived/standings`.
  - The dataset endpoint serves the stored file with the `stats` tag; on a missing file it enqueues a recompute and answers 202 with the previous version if any.
  - The rankings view derives from the dataset with `calcPerformanceScore`; `performanceRankings` is no longer written.
  - Stop writing `playerStats`, `teamStats`, `stats/*` and `playerGameHistory`. Leave existing documents. The admin stats tab shows the recompute status and a "recompute now" button that enqueues the job.
  - The card game reads the same stored dataset.
- **Acceptance.** After a recorded game, the dataset file and standings are updated by the job; the stats hub, rankings and teams section show the same numbers as before for the fixture tournaments (snapshot comparison); the first request after a change is as fast as any other; the listed calculator files are deleted; `any` count drops by at least 120.
- **Tests.** Level 1 for `computeTournament` on the golden fixtures; level 4 for the job and the endpoint; a read-count ceiling for the recompute.
- **Risks and rollback.** A stat that only the old calculator produced turns out to be shown somewhere. The explorer report found only the admin tab; the implementer re-checks with grep before deleting. Flag per tournament to switch the endpoint between old and new.
- **Dependencies.** WP-14.
- **Size.** L. **Review.** Fable.

### WP-16. Fantasy and pick'em scoring in the pipeline

- **Goal.** Fantasy and pick'em produce points and a ranking for tournament-scoped data, from one formula per tournament.
- **Files.** `src/lib/pdl-fantasy-scoring.ts`, `opendota.ts:285` (`calculateFantasyPoints`), `fantasy-scoring-admin.ts`, `src/lib/firestore.ts` (fantasy and pick'em helpers), `src/app/api/fantasy/*`, `api/home/fantasy-leader`, `src/app/[tournamentSlug]/{fantasy,pickem}/page.tsx`, `components/fantasy/FantasyScoreCalculator.tsx`, `admin/tabs/FantasyPickemTab.tsx`, new `src/features/stats/domain/{fantasy,pickem}.ts`, `src/features/{fantasy,pickem}/`.
- **Design.** ADR-11. Depends on the owner's answer to question 8 (which scoring preset new tournaments use, and whether fantasy is revived now).
  - `scoreFantasy(performance, preset)` with presets `pdl-flat` and `role-based` reproducing the two live formulas exactly; the roll-up formula in the stats calculator is dropped.
  - `computeTournament` adds per-round user totals from lineups stored at `tournaments/{id}/fantasyLineups/{uid}/rounds/{r}`, and a leaderboard document. Lineup saving becomes a command that enforces the round lock on the server.
  - Pick'em: a scoring function comparing picks with final placements, and a leaderboard. Picks lock by a server-checked deadline. Lineups and picks of other users are not readable before the lock.
  - The scoring guide text is generated from the preset, not hand-copied.
  - The viewer screens get the minimum needed to show points and rank using existing components; their redesign is S2's.
- **Acceptance.** On the seeded tournament, a user's lineup scores after a recorded game and appears in the ranking; saving after the lock is refused by the server; pick'em ranks users after the final; preset functions return the pinned numbers for the recorded games; the dead root-collection fantasy routes are deleted.
- **Tests.** Level 1 for both scoring functions; level 4 for the commands and the lock; end-to-end flow 10.
- **Dependencies.** WP-15. Question 8.
- **Size.** L. **Review.** Opus.

---

## M3. The server owns writes

### WP-17. Captain flows through commands

- **Goal.** Everything a captain does is a server command; the captain page writes nothing to Firestore directly.
- **Files.** `src/components/team/MyTeamView.tsx` (1,859 lines, 17 browser write sites; split by concern), `SquadView.tsx`, `MatchPanel.tsx`, `StandinRequestModal.tsx`, `src/lib/team-actions.ts`, `standin-actions.ts`, `reschedule-rules.ts`, `src/app/[tournamentSlug]/register/page.tsx`, `api/register-*`, new `src/features/teams/` and `src/features/schedule/`; `firestore.rules`.
- **Design.** ADR-07; `CONVENTIONS.md` section 6.
  - Commands: `registerTeam`, `updateRoster`, `proposeReschedule`, `answerReschedule`, `requestStandin`, `decideStandin`, `cancelStandin`, `appealStandin`, `postScrimSlot`, `removeScrimSlot`, `recordTransfer`.
  - Each command updates the lobby session if one exists (through the `lobby` feature) and enqueues notifications.
  - The public lobby state a captain needs is read from a small document or endpoint (ADR-16), replacing the denied `botLobbySessions` query.
  - In the same WP, the rules for `teams`, `players`, `matches` (captain part), `standinRequests`, `scrimSlots` and `transfers` change to deny browser writes.
- **Acceptance.** No `setDoc`, `updateDoc`, `addDoc`, `deleteDoc` or `writeBatch` remains in the listed files; each command has the four standard tests; the rules matrix shows captains can no longer write those collections; end-to-end flows 3, 4 and 6 pass; `MyTeamView.tsx` is split into files under 400 lines.
- **Risks and rollback.** Captains are the most active writers during a season. Ship behind a per-tournament flag; rules tighten only after the flag is on everywhere. The owner should copy this to production between match days.
- **Dependencies.** WP-07, WP-13, WP-14.
- **Size.** L. **Review.** Fable.

### WP-18. Admin writes through commands, area by area

- **Goal.** The admin panel's 150 browser writes become commands that S2's new admin screens and the old tabs can both call.
- **Split.** 18a tournament settings, theme, lifecycle, admins (`GeneralTab`, `TournamentStructureTab`, `TournamentLaunchCard`, `api/tournaments.ts`). 18b teams and divisions (`TeamsTab`, `DivisionsTab`, `TransfersTab`). 18c schedule and matches (`SchedulingTab`, `MatchesTab` remaining writes, `api/groups.ts`). 18d formats (`SwissTab` with `lib/swiss/actions.ts`, `lan-qualifier/actions.ts`, `PlayoffsTab`). 18e content and viewer features (`RulesTab`, `NewsTab`, `PrizesTab`, `FantasyPickemTab`, `CardsTab`).
- **Design.** ADR-07. Each part: move the business rules out of the tab into `domain/`, define commands, replace the tab's writes with calls, invalidate tags, tighten that area's rules. The creator wizard's `createTournament` becomes a command that also writes the slug index and (after WP-24) the organization link.
- **Coordination with S2.** S2 redesigns these screens. Build the commands first and switch the old tabs to them with the smallest possible UI change; do not polish tabs that S2 will replace. If S2's WPs are ready, do each part together with the matching new screen.
- **Acceptance (per part).** No browser Firestore write remains in the part's files; commands have the standard tests; rules deny browser writes for the part's collections; the tab works as before (step list in the report); files touched end under 400 lines or are scheduled for replacement by a named S2 WP.
- **Risks and rollback.** `lib/swiss/actions.ts` has 26 write sites with ordering that matters (draft, commit, reopen). Convert with emulator tests that replay a three-round tournament before and after.
- **Dependencies.** WP-17 (pattern proven), WP-13.
- **Size.** XL in total; each part M to L. **Review.** Fable for 18a and 18d; Opus for the rest.

### WP-19. Lock the rules

- **Goal.** The security rules say what the architecture says: clients write nothing and read only their own private documents and the live-update documents.
- **Files.** `firestore.rules`, `storage.rules`, the rules tests, the lint allowlist for the browser SDK.
- **Design.** ADR-07 end state. Storage uploads go through signed upload URLs issued by a command, or stay direct with strict per-user paths; choose the simpler one that passes the matrix.
- **Acceptance.** `firestore.rules` is under 120 lines; the matrix proves no client write is allowed anywhere; the browser SDK import allowlist contains only the live-update components; end-to-end flows 1-11 pass.
- **Dependencies.** WP-17, WP-18 (all parts), WP-16.
- **Size.** M. **Review.** Fable.

---

## M4. A bot we can maintain

### WP-20. Bring the bot's source under control

- **Goal.** The tournament bot is TypeScript in `src/`, built by the Docker image, with its dry-run scripts as automated tests. Behaviour does not change.
- **Files.** `bot-worker/dist/{conductor,runner,runner-logic,scheduling,dota-client,firebase,logger}.js` (become `bot-worker/src/*.ts`), `dist/_drytest-*.js` (become `src/**/*.test.ts`), legacy `dist/{manager,command-handler,event-emitter,index}.js` (delete), `bot-worker/{Dockerfile,tsconfig.json,package.json,.gitignore}`, `ecosystem.config.cjs`, `deploy-bot.ps1`, `setup-vps.sh` (delete), new `bot-worker/RELEASE_CHECK.md`.
- **Design.** ADR-10 point 1.
  1. First commit: copy each hand-written file to `src/` as `.ts` with `// @ts-nocheck`, change nothing else, compile, and prove the compiled output is equivalent to the committed `dist` file (same statements; a normalised diff in the report).
  2. Then remove `@ts-nocheck` file by file, adding types, starting with `runner-logic` and `scheduling`. No logic changes; any bug found is written down, not fixed here.
  3. The Dockerfile builds from source (`npm ci`, `tsc`), keeps the protobuf patch step, and `dist/` is removed from git.
  4. A `DotaClient` interface is extracted from `dota-client`, with a fake implementation for tests (`TEST_STRATEGY.md` level 5).
- **Acceptance.** `git ls-files bot-worker/dist` is empty; the Docker image builds locally; the six dry-run scenarios run under vitest in CI; `tsc --noEmit` passes with at most `dota-client.ts` still unchecked; the release checklist exists and names the manual lobby test.
- **Tests.** The converted dry-runs; unit tests for `runner-logic`.
- **Risks and rollback.** The live bot. Never push `feature/multi-tournament-platform` (Railway deploys from it). The owner deploys this between match days after the manual lobby test on staging; rollback is redeploying the previous image in Railway.
- **Dependencies.** WP-03 (CI). Independent of M1-M3.
- **Size.** L. **Review.** Fable.

### WP-21. The contract, and self-contained lobby sessions

- **Goal.** The website and the bot exchange only documents defined in `contract/`, and the bot stops reading the website's own collections.
- **Files.** New `contract/` (schemas for lobby session request and state, bot config, sync task or job payloads, worker heartbeat), `src/types/lobby-bot.ts` (713 lines; replaced by the contract), `src/lib/bot/*` (becomes `src/features/lobby/`), `bot-worker/src/{scheduling,runner,conductor}.ts`, `tsconfig` paths on both sides, `src/lib/standin-actions.ts` callers of `syncLobbySessionStandins`.
- **Design.** ADR-10 points 2-4; section 2.3.
  - Both builds import `contract/` by path alias; it has no dependency except zod.
  - The website becomes the only creator of sessions: when a match gets a time and the bot is enabled, `features/lobby` writes the session with rosters, stand-ins, casters, settings and a `createAt` time, and updates it on every relevant command. The Conductor's own session creation stays behind a flag until this is proven, then is deleted along with the bot's reads of `tournaments`, `teams` and `matches`.
  - Delete: the `botCommands` `set_teams` writes, `scheduleLobbyForMatch` duplication, `botEvents` rules and types, unused fields.
  - Series completion is decided by the website only; the bot asks the session document whether another game is needed.
- **Acceptance.** `grep` in `bot-worker/src` finds no read of `tournaments/*/matches` or `teams`; contract fixtures for the current version parse on both sides; the level-5 scenarios pass, including reschedule and late stand-in; the website type file is gone.
- **Tests.** `TEST_STRATEGY.md` level 5, all three parts.
- **Risks and rollback.** A field the runner needs is missing from the session. Run the new path in shadow first: the website writes sessions with a `shadow` marker for one staging tournament and a test compares them with the Conductor's own.
- **Dependencies.** WP-20; WP-17 for the commands that update sessions (before WP-17, hook the existing server actions).
- **Size.** L. **Review.** Fable.

### WP-22. No idle cost, real secrets, visible waiting

- **Goal.** The Conductor does work only when there is work; bot credentials are encrypted; a missing account is visible.
- **Files.** `bot-worker/src/{conductor,scheduling}.ts`, `src/app/api/manage/bot/accounts/**`, `src/features/lobby/`, `firestore.indexes.json`, a migration script for existing accounts.
- **Design.** ADR-10 points 5-6.
  - Replace the per-minute read of every tournament and its `config/bot` with one indexed query: sessions with `state == 'pending'` and `createAt <= now`.
  - Encrypt `password` and `steamGuardSharedSecret` with AES-GCM using a key from the worker's and website's environment; the migration re-encrypts existing accounts and keeps the old field until the worker confirms a login with the new one. The website never returns secrets to the browser.
  - A session that waits for an account longer than a threshold alerts the platform admin and shows "waiting for a bot" to the organizer and captains.
- **Acceptance.** With 1,000 seeded idle tournaments on the emulator, a Conductor tick performs a constant number of reads (asserted); no plain or base64 password remains after migration; the waiting state is shown in the session document and raises one alert.
- **Dependencies.** WP-21.
- **Size.** M. **Review.** Fable.

### WP-23. Measure and scale the lobby workers

- **Goal.** Know how many concurrent lobbies one worker holds, and be able to add workers.
- **Files.** `bot-worker/src/conductor.ts`, new `bot-worker/src/worker-claim.ts`, `docs/overhaul/spikes/WP-23.md`.
- **Design.** ADR-10 point 7. Part 1 (measure): memory and CPU per runner process with the fake client and, by hand on staging, with real accounts; write the numbers and the per-worker limit. Part 2 (only if part 1 or demand calls for it): workers register capacity in `workers/{id}`, claim sessions in a transaction up to capacity, and release on shutdown; a crashed worker's sessions are reclaimed after its heartbeat goes stale.
- **Acceptance.** Part 1: the report states lobbies per worker and the cost per concurrent lobby. Part 2: two workers on the emulator share ten sessions without double-claiming; killing one moves its sessions.
- **Dependencies.** WP-22.
- **Size.** S for part 1, L for part 2. **Review.** Fable for part 2.

---

## M5. A platform

### WP-24. Organizations and roles

- **Goal.** An organizer account that owns several tournaments, with members and roles, checked by the one permission function.
- **Files.** New `src/features/organizations/`, `src/platform/auth/` (role table), `scripts/migrations/002-organizations.ts`, `src/lib/api/tournaments.ts`, `src/lib/slug-namespace.ts`, `src/app/organizer/page.tsx`, `api/manage/tournament-admins`, `tournament-creators`, `api/creator/access`, `firestore.rules`.
- **Design.** ADR-05, ADR-06.
  - Migration: one organization per distinct `organizerId`; set `orgId` on its tournaments; set `seriesId` from the current slug-namespace grouping; write the organizer as `owner`. `organizerId` stays.
  - `authorize` gains the organization roles and the `referee` role. Tournament admin documents get `role` read at last.
  - Commands: create organization, invite member (by e-mail or Discord name, accepted by the invitee), change role, remove member, transfer ownership.
  - The creator allowlist remains as a platform flag "public sign-up off".
  - Screens are minimal and functional; S2 designs the real ones.
- **Acceptance.** The role table test covers every role and action; an admin of organization A has no access to B (emulator test through three commands and the rules); the migration is idempotent and old code still reads `organizerId`; an invited referee can set a result and cannot edit settings (end-to-end flow 11).
- **Dependencies.** WP-07; best after WP-18a.
- **Size.** L. **Review.** Fable.

### WP-25. Letnia moves into the model; legacy code is removed

- **Goal.** No top-level tournament collections, no `null` tournament id, no `isLegacyTournament`.
- **Files.** `scripts/migrations/003-letnia.ts`, `src/lib/firestore.ts` (913 lines; dissolved), `src/lib/actions.ts`, `admin-actions.ts`, `team-players-loader.ts`, `playoff-management.ts`, `stats-lab/build-dataset.ts` and the other files with a `'letnia'` or `null` branch (listed in the stats explorer notes: `route.ts:9`, `kit.tsx:80`, `collection.ts:31,39`, `finds.ts:59`, `draft-prep/context/route.ts:9`), `TournamentContext.tsx`, `next.config.mjs` redirects, `api/validate-steam`, `api/register-standin`, `firestore.rules` (legacy matches), remaining root pages.
- **Design.** ADR-05.
  - The script copies each root collection (with subcollections) under the Letnia tournament document, mapping old shapes to the tournament-scoped ones where they differ (record every mapping; stats explorer notes mention the legacy `playerId = document id` trap). It verifies counts and a checksum per collection and can be re-run.
  - Readers switch to the tournament-scoped path; then the legacy code and rules are deleted. The root data is left in place, unread, until the owner removes it.
- **Acceptance.** The Letnia site on staging (seeded from a copy the owner provides, or from a public capture as in WP-12) shows the same teams, schedule, standings and stats before and after; `grep -ri "isLegacyTournament\|=== 'letnia'" src` is empty; no code reads a root `teams`, `matches`, `groups`, `standins`, `pickems` or `fantasyLineups` collection.
- **Risks and rollback.** Data migration of a finished tournament: low traffic, but public history. The script is additive; rollback is reverting the code, since the old data is untouched.
- **Dependencies.** WP-15 (dataset), WP-13. Needs the owner to run the script on production (it writes), so it is prepared and rehearsed, not executed, by the implementer.
- **Size.** L. **Review.** Fable.

### WP-26. Custom domains, one link helper, sign-in from any domain

- **Goal.** A tournament can be served on an organizer's own domain, with working links and sign-in.
- **Files.** `src/middleware.ts`, new `src/features/tournaments/domain/{links,domains}.ts`, every hand-built `/${slug}/...` link (find with grep; `getTournamentPath` in `TournamentContext` is the start), `src/server/accounts/identity.ts` (`ORIGINS`), `src/context/AuthContext.tsx`, `api/login/**`, `api/connect/steam/**`, new `domains/{hostname}` collection and commands, hosting-domain API client.
- **Design.** ADR-08 (domains and sign-in).
  - `tournamentHref(tournament, path)` everywhere. On a custom host the prefix is empty.
  - Middleware: look up the host (cached), rewrite to `/{slug}/...`; unknown hosts get a plain "not connected" page. Platform paths that are not tournaments keep working on the platform domain only.
  - Sign-in hand-off: generalise the Discord flow to "sign in on the platform origin, return a custom token to an allowed origin". Google sign-in moves to the same flow. Allowed origins come from `domains/` plus configuration.
  - Commands: add domain (returns the DNS records to set), check verification, remove. Attach and detach through the hosting API. Cache tags include the host mapping.
- **Acceptance.** On staging, a test domain serves a tournament at its root; every link stays on the domain; sign-in with Discord and Google works there and on the platform domain; removing the domain stops serving it; end-to-end flow 12 passes; `grep` finds no hand-built tournament path.
- **Risks and rollback.** Sign-in on the live domain. Keep the current popup flow behind a flag until the new one is proven on staging and on production with one admin account.
- **Dependencies.** WP-06 outcome (hosting), WP-08, WP-24 (who may add a domain).
- **Size.** L. **Review.** Fable.

### WP-27. Theme tokens with guard rails, and visual tests

- **Goal.** A validated theme format that the server renders, limits that keep every tournament readable, and screenshots that prove pages hold under any theme.
- **Files.** `src/types/tournament.ts` (`TournamentTheme`, about 40 fields), `src/features/tournaments/domain/theme.ts`, `src/lib/themes/*`, `division-themes.ts`, `google-fonts.ts`, `dynamic-fonts.ts`, components with hard-coded colours (`docs/THEME_COLOR_AUDIT.md` is the list), `src/components/themed/*`, Playwright visual suite.
- **Design.** ADR-08 (theming); `TEST_STRATEGY.md` level 8. S2 decides which tokens organizers see; this WP builds the schema (versioned, with a migration from the current fields that changes nothing visible), the contrast and size checks, font loading without blocking, and removes hard-coded colours.
- **Acceptance.** Existing tournaments render identically after the theme migration (screenshots); a theme that fails contrast cannot be published; the extreme test theme breaks no layout at three widths; no component reads a slug to pick a style.
- **Dependencies.** WP-08. Coordinate with S2's customization WPs.
- **Size.** L. **Review.** Opus, with the owner looking at the screenshots.

### WP-28. Move the database to Europe

- **Goal.** Firestore runs in `eur3`; writes and cache misses lose about 100-150 ms each.
- **Files.** `scripts/migrations/eu-move/` (runbook and scripts), `firebase.json` (rules and indexes for the named database), configuration on the website and the bot (database id variable from WP-07), a maintenance-mode flag that makes commands answer "back in a few minutes".
- **Design.** ADR-04. Rehearse twice on staging-like copies; measure the freeze time; write the runbook with exact commands, checks (document counts per collection, spot checks, a smoke run) and the point of no return (first write to the new database). The owner runs it; an agent must not.
- **Acceptance.** A rehearsal report with timings; the runbook reviewed; after the owner's run, latency of a warm read from the server is under 30 ms and the smoke test passes.
- **Risks and rollback.** Writes made after cutover are lost if rolling back. Keep the window short, announce it, do it outside match days.
- **Dependencies.** WP-07, WP-14 (jobs can be paused), question 7.
- **Size.** M to prepare. **Review.** Fable.

### WP-29. One translation system

- **Goal.** All UI text comes from `messages/*.json` through `next-intl`; `lib/translations.ts` (1,830 lines) and `useTranslation` are gone; a tournament with `locale: 'en'` shows no Polish UI text on public pages.
- **Files.** `src/lib/translations.ts`, `src/hooks/useTranslation.ts`, the 67 files that use them, `messages/{pl,en}.json`, components with hard-coded Polish on public pages.
- **Design.** ADR-08 (language). Public pages first; the admin panel follows S2's rebuild. A CI check compares the key sets of the two message files.
- **Acceptance.** The old system is deleted; the key check passes; the seeded English tournament's public pages contain no Polish UI strings (a test scans rendered HTML against a word list).
- **Dependencies.** WP-08, WP-09.
- **Size.** L. **Review.** Opus.

---

## M6. Proven

### WP-30. The full end-to-end suite

- **Goal.** The twelve flows of `TEST_STRATEGY.md` level 6 run in CI on every pull request.
- **Files.** `e2e/`, `playwright.config.ts`, CI workflow, the fake-bot script from WP-21.
- **Design.** `TEST_STRATEGY.md` level 6. Flows are added as their WPs land (flow 1 in WP-08, 3/4/6 in WP-17, 10 in WP-16, 11 in WP-24, 12 in WP-26); this WP completes the rest and makes the suite stable and under ten minutes.
- **Acceptance.** Twelve flows green three runs in a row; a failed run uploads its trace.
- **Dependencies.** M1-M3.
- **Size.** M. **Review.** Opus.

### WP-31. Load test at 1,000 tournaments

- **Goal.** Evidence that the platform holds the target size, and a list of what breaks first.
- **Files.** `scripts/load/` (seed for 1,000 tournaments on staging, k6 scenarios), `docs/overhaul/spikes/WP-31.md`.
- **Design.** `TEST_STRATEGY.md` level 9, with its pass marks.
- **Acceptance.** The three scenarios run against staging; the report gives the numbers against each pass mark, the cost of the run from the billing console (the owner reads it out), and follow-up WPs for anything that failed.
- **Dependencies.** M1, M2, WP-22. Staging budget approved by the owner.
- **Size.** M. **Review.** Fable.

---

## Things deliberately left out of S1's packages

- The new admin panel and wizard (S2), the card game (S3), business material (S4).
- A redesign of the bot's lobby logic. Open bot gaps recorded in the owner's notes (forfeit voting, coin toss, Immortal Draft seat) are product work to schedule after WP-20.
- Per-visitor language switching, free subdomains, organization-owned bot pools, billing. Each has a place in the design (ADR-08, ADR-10, ADR-05) and no package yet.
