# Overhaul status

Every session updates this file as it works, not only at the end. A new session, on any model, must be able to continue from it alone.

## Next step

S1 is done (2026-11-13). Two things can start now, in either order or side by side:

- **Implementation (S5 prompt in `PROMPTS.md`), starting with WP-01.** WP-01 closes security holes that are live in production (question 4). WP-02, WP-04, WP-05 and WP-12 need no answer from the owner. WP-03 and WP-06 need the staging project and the hosting answer (questions 5 and 6); do the parts that do not, and mark the rest as waiting.
- **S2 (organizer experience)**, which reads `ARCHITECTURE.md` and adds its own work packages to `ROADMAP.md`.

The owner should answer questions 1, 4, 5 and 6 first; the others can wait.

## Sessions

| Session | Model | State | Output |
|---|---|---|---|
| S0 Groundwork: safety net + inventories | Opus | done 2026-11-13 | `inventory/*.md`, CI, green tests |
| S1 Architecture, scale, code health, testing | Fable | done 2026-11-13 | `ARCHITECTURE.md`, `TEST_STRATEGY.md`, `ROADMAP.md`, `CONVENTIONS.md` |
| S2 Organizer experience: admin, wizard, customization | Fable | not started | `ORGANIZER_UX.md`, prototypes |
| S3 Card game | Fable | not started | `GAME_DESIGN.md` |
| S4 Business and marketing | Opus, or Fable if quota is left | not started | `docs/business/*` |
| S5+ Implementation of the roadmap | Fable or Opus as orchestrator | not started | `wp/*` branches merged into `overhaul` |

## Work packages

Filled in by S1, and later by S2 and S3. One line per WP: id, name, branch, state (planned / in progress / in review / merged / dropped), notes.

| WP | Name | Branch | State | Notes |
|---|---|---|---|---|
| WP-01 | Close unauthenticated server actions and weak routes | `wp/01-server-action-auth` | planned | M, Fable review. Cherry-pick to production (question 4) |
| WP-02 | Test the Firestore and Storage rules, close holes | `wp/02-rules-tests` | planned | L, Fable review |
| WP-03 | Staging, fixtures, deploys from git | `wp/03-staging-ci` | planned | L, Opus review. Needs question 5 for the staging part |
| WP-04 | Error monitoring, logs, bot heartbeat | `wp/04-observability` | planned | M, Opus review. Question 9 |
| WP-05 | Delete dead code, remove single-tenant fallbacks | `wp/05-dead-code` | planned | M, Opus review |
| WP-06 | Trial: server-rendered, CDN-cached page on new hosting | `wp/06-hosting-trial` | planned | M, Fable review. Decision gate for ADR-03. Questions 5, 6 |
| WP-07 | Platform kernel and enforced boundaries | `wp/07-platform-kernel` | planned | L, Fable review |
| WP-08 | Server-rendered shell | `wp/08-server-shell` | planned | L, Fable review |
| WP-09 | Public subpages on cached queries (09a, 09b, 09c) | `wp/09a-teams-schedule, wp/09b-standings-playoffs, wp/09c-content` | planned | L, Opus review; Fable for 09b |
| WP-10 | Home page on server data, deep links without redirects | `wp/10-home-server-data` | planned | L, Fable review |
| WP-11 | Performance budgets in CI, lighter bundle | `wp/11-perf-budgets` | planned | M, Opus review |
| WP-12 | Characterisation tests and golden fixtures for results | `wp/12-results-fixtures` | planned | M, Opus review. Can run beside M1 |
| WP-13 | `results` feature: one way to change a result | `wp/13-results-feature` | planned | L, Fable review. Question 11 |
| WP-14 | Job queue | `wp/14-jobs` | planned | L, Fable review |
| WP-15 | `stats` feature: one compute, stored dataset | `wp/15-stats-feature` | planned | L, Fable review |
| WP-16 | Fantasy and pick'em scoring | `wp/16-fantasy-pickem` | planned | L, Opus review. Waits for question 8 |
| WP-17 | Captain flows through commands | `wp/17-captain-commands` | planned | L, Fable review |
| WP-18 | Admin writes through commands (18a-18e) | `wp/18a-settings ... wp/18e-content` | planned | XL, split. Fable for 18a, 18d. Coordinate with S2 |
| WP-19 | Lock the rules | `wp/19-rules-lock` | planned | M, Fable review |
| WP-20 | Bot source under control (TypeScript, tests) | `wp/20-bot-source` | planned | L, Fable review. Owner deploys between match days |
| WP-21 | Contract and self-contained lobby sessions | `wp/21-bot-contract` | planned | L, Fable review |
| WP-22 | Bot: no idle cost, encrypted credentials, visible waiting | `wp/22-bot-due-work` | planned | M, Fable review |
| WP-23 | Measure and scale lobby workers | `wp/23-bot-scale` | planned | S + L, Fable review for part 2 |
| WP-24 | Organizations and roles | `wp/24-organizations` | planned | L, Fable review |
| WP-25 | Letnia into the model, legacy removed | `wp/25-letnia-migration` | planned | L, Fable review. Owner runs the migration |
| WP-26 | Custom domains, link helper, sign-in from any domain | `wp/26-custom-domains` | planned | L, Fable review |
| WP-27 | Theme tokens with guard rails, visual tests | `wp/27-theme-tokens` | planned | L, Opus review. Coordinate with S2 |
| WP-28 | Move the database to Europe | `wp/28-eu-database` | planned | M to prepare, Fable review. Question 7. Owner runs it |
| WP-29 | One translation system | `wp/29-i18n` | planned | L, Opus review |
| WP-30 | Full end-to-end suite | `wp/30-e2e` | planned | M, Opus review |
| WP-31 | Load test at 1,000 tournaments | `wp/31-load-test` | planned | M, Fable review |

## Questions for the owner

Each question has the asking session, the recommended answer, and whether work continued on that recommendation.

1. **(S0, urgent) Copy the bot-route security fix into production?** Commit `3db4e3e` on `overhaul`. In production, any signed-in visitor can list, add, re-password, disable or delete the lobby bot's Steam accounts, and edit any tournament's lobby whitelist (`/api/manage/bot/accounts`, `accounts/[id]`, `pool-status`, `whitelist` only check that a token is valid). Recommended: cherry-pick `3db4e3e` onto `feature/multi-tournament-platform` and deploy soon. It touches four route files and one line of `BotTab.tsx`. Not done by S0, because S0 may not deploy or push that branch.
2. **(S0) Browser measurements for PAGES.md.** The headless browser (Edge through puppeteer-core) cannot start inside this session's command sandbox, and running it outside the sandbox was refused. TTFB, page weight and Firestore round-trip times were measured with curl instead. Recommended: run `node scripts/measure-pages.js` yourself once (see `inventory/PAGES.md`), or allow the browser for the S1 session. Work continued without it.
3. **(S0) `firestore.rules` changed on `overhaul`** (reserved slugs `card-lab`, `stats-lab`, `opengraph-image`). Not deployed. Recommended: deploy with the next rules deploy; it only rejects more slugs.

4. **(S1, urgent) Copy WP-01 to production as soon as it is merged?** Several server functions use admin rights and never check who is calling (`src/lib/standin-actions.ts`, `src/lib/bot/bot-config-actions.ts`, `playoff-sync-actions.ts`, `player-profile-actions.ts`; S1 checked the code). Client pages import them, so they are public endpoints: anyone can approve or reject stand-in requests today, and probably change bot settings and bot accounts. Not tested against production. Recommended: run WP-01 first and cherry-pick its merge onto `feature/multi-tournament-platform`, together with `3db4e3e` from question 1. Work continues on that plan.
5. **(S1) Create the staging environment.** `TEST_STRATEGY.md`, "What the owner must create", lists it exactly: a Firebase project `dota2inhouse-staging` on Blaze with Firestore in `eur3`, Google sign-in, Storage, a web app and a service account key; a Discord application for staging; the GitHub secrets. Recommended: yes, this week; WP-03 and WP-06 wait for it. Work continues on the parts that do not need it.
6. **(S1) Host the web app on Vercel as its own project?** (`ARCHITECTURE.md`, ADR-03.) Firebase stays for sign-in, database and files. The community site keeps the domain and forwards to the new project as it forwards to Firebase today; cutover and rollback are one setting. It needs a Vercel Pro plan (about $20 per member per month plus usage; please confirm the price and which plan the community site is on). Recommended: yes, subject to the measured trial in WP-06. If no: pages are still made fast with time-based caching on Firebase, but an organizer's change takes up to a minute to show, deploys stay manual, and custom domains need another solution.
7. **(S1) Move the database from the US to Europe before opening to outside organizers?** (ADR-04.) It needs one write freeze of about 30-60 minutes outside match days, rehearsed first (WP-28). Recommended: yes. Nothing else waits for this answer.
8. **(S1) Fantasy and pick'em do not work for any tournament except old Letnia.** The fantasy page shows a placeholder ranking and nothing computes points; pick'em stores picks and never scores them. Two decisions: (a) build the scoring in WP-16, or hide both features until S2 has redesigned them? (b) which fantasy formula do new tournaments use: the flat PDL one, or the role-based one? Recommended: (a) build the scoring in WP-16, because viewer features are a selling point and the creator page already advertises them; (b) the flat PDL formula as the default, with the role-based one as a preset. Work continues on other packages; WP-16 waits.
9. **(S1) Accounts for monitoring:** a Sentry organization (free tier) with two projects, and a private Discord channel with a webhook for alerts (ADR-13). Recommended: yes. WP-04 can be built without them and switched on later.
10. **(S1) Branch naming after the overhaul is proven:** merge `overhaul` into the production branch and rename it `main`, and retire `master` (228 commits behind, unused)? Recommended: yes. Easy to decide later.
11. **(S1) One tie-break order for standings.** Pages disagree today (division table: head-to-head, then Neustadtl, then lower MMR; stats hub: game difference, games won, name). WP-13 makes the division table's order the single rule, stored per tournament. Recommended: accept; say so if a league's rulebook says otherwise.

## Log

- 2026-11-13 (S1): done. Wrote `ARCHITECTURE.md` (current state, 13 bad decisions with evidence, target design, 16 decision records), `CONVENTIONS.md`, `TEST_STRATEGY.md` and `ROADMAP.md` (31 work packages in 7 milestones). Four explorer agents checked the inventories and filled gaps; Fable re-checked the claims the decisions rest on. Findings beyond S0: server actions with admin rights and no caller check (question 4); the live tournament bot has no source code, only hand-edited JavaScript in `bot-worker/dist/`; fantasy and pick'em compute nothing outside legacy Letnia (question 8); the security rules let a captain rewrite their match's score. No spike was run: the hosting trial (WP-06) needs the staging project and a hosting account that only the owner can create.
- 2026-11-13 (S0): Part B done: `inventory/{PAGES, ADMIN, DATA, SCALE, PRODUCT, TESTS, CARDS, CODE_HEALTH}.md`. Explorer agents drafted them; Opus checked and corrected them. PAGES.md has curl and build measurements but no browser measurements (question 2). The repo table in BRIEF.md is corrected: the live lobby bot is `bot-worker/`. CI passed on GitHub (run 43327108507, commit `62fbe0b`).
- 2026-11-13 (S0): Part A done. Tests green (reserved slug `card-lab`; Swiss pairing search sped up about 4x with identical output). CI added (`.github/workflows/ci.yml`); ESLint set up for the first time (0 errors). Deleted `src/app/api/admin/**` plus two prefix-sharing routes, 21 orphaned modules and 9 root one-off scripts (about 15,000 lines). Fixed open bot-account routes (`3db4e3e`).
- 2026-11-13 (S0) **Incident, read-only:** the first local `next build` loaded the worktree's `.env.local`, which holds the production service account, and prerendering `/sitemap.xml` read the production `tournaments` collection once (no writes). Every later local build and `next start` ran with `FIREBASE_SERVICE_ACCOUNT_BASE64=` and the other secrets blanked, checked by the sitemap coming out empty. Future sessions: always blank them, or the sitemap and any prerendered page read production. The underlying problem (the sitemap is built from production data at build time) is in `inventory/PAGES.md`.
- 2026-11-12: restore tag `restore/pre-overhaul-2026-11-12` pushed in all three repos. Branch `overhaul` and worktree `.claude/worktrees/overhaul` created from `feature/multi-tournament-platform` at `0fe0974`. Brief, agents and prompts written.
