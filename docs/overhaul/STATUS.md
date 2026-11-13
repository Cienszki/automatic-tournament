# Overhaul status

Every session updates this file as it works, not only at the end. A new session, on any model, must be able to continue from it alone.

## Next step

Three implementers are running: **WP-05**, **WP-12**, **WP-20**. They were stopped once by the usage limit and resumed on 2026-11-13. When each reports, review it (reviewer agent for 05 and 12, Fable for 20), merge with `--no-ff`, and remove its worktree.

Then: **WP-32** (database schema; Fable reviews `SCHEMA.md` before migrations are written), then WP-33, WP-03, WP-06.

The owner is filling in the staging accounts with `SETUP_STAGING.md`. When they say a step is done, check the value by using it, then load the file into GitHub secrets (`gh secret set --env-file .env.staging.local`) and Vercel. The file `.env.staging.local` in the `overhaul` worktree is git-ignored; never print its values.

**S2 (organizer experience)** is a prerequisite of WP-18. Its prototype review needs a browser, which the agent sandbox blocks (question 2).

## Decisions that changed the plan (owner, 2026-11-13)

1. **Firestore is not required.** The tournament platform moves to PostgreSQL with a clean structure (`ARCHITECTURE.md` ADR-04). Firebase keeps sign-in and files. Fable chose Supabase (free plan, Frankfurt) as the host, used as plain PostgreSQL.
2. **Production does not change until the new platform is ready.** This includes the two security fixes (questions 1 and 4). The new platform is built on `overhaul` beside the old site and takes over one tournament at a time, starting with archived ones (ADR-15). The brief's rules still hold: no deploy by agents, no writes to production Firestore, no script with production credentials. The brief's rule "change the Firestore schema only additively" no longer applies, because the Firestore schema is not changed at all.
3. **Letnia becomes an ordinary tournament** at `/letnia`, imported into the same tables as the others (WP-33). It is not reachable today, so it is the first tournament to go live on the new platform.
4. **Free or basic plans until there is income.** Every service starts free; `COSTS.md` gives the triggers for paying.
5. **Organizers choose their tie-breakers and their order,** can use tiebreaker matches, and can rank teams from different groups for playoff places and seeding (ADR-11, WP-13a, WP-34).
6. **Region per tournament** is not built now. The design keeps it possible, and the reasons are in ADR-17.
7. **PDL S2 is the real-world test.** It is mirrored onto the new platform while it is played on the old site, compared every day (WP-39), and then moved to the new platform between two match days while still running (WP-37). The owner handles the players. The card game must work there, so it is moved as it is (WP-40).
8. **No commercial use today.** Vercel's free plan is allowed; the paid plan starts with the first income.
9. **The old site is frozen for features** from 2026-11-13: fixes only.
10. **The owner prefers the terminal to websites.** Setup steps are commands or scripts wherever the service allows it; `SETUP_STAGING.md` follows this.
11. **Fantasy:** the role-based formula is the default for new tournaments.

## Sessions

| Session | Model | State | Output |
|---|---|---|---|
| S0 Groundwork: safety net + inventories | Opus | done 2026-11-13 | `inventory/*.md`, CI, green tests |
| S1 Architecture, scale, code health, testing | Fable | done 2026-11-13; revised 2026-11-13 after the owner's answers | `ARCHITECTURE.md`, `TEST_STRATEGY.md`, `ROADMAP.md`, `CONVENTIONS.md`, `COSTS.md` |
| S2 Organizer experience: admin, wizard, customization | Fable | not started; needed before WP-18 | `ORGANIZER_UX.md`, prototypes |
| S3 Card game | Fable | not started; decides when cards arrive on the new platform (question 15) | `GAME_DESIGN.md` |
| S4 Business and marketing | Opus, or Fable if quota is left | not started | `docs/business/*` |
| S5+ Implementation of the roadmap | Fable or Opus as orchestrator | started 2026-11-13 with WP-05, WP-12, WP-20 | `wp/*` branches merged into `overhaul` |

## Work packages

One line per WP: id, name, branch, state (planned / in progress / in review / merged / dropped / on request), notes. The order to run them in is the milestone table in `ROADMAP.md`, not the id.

| WP | Name | Branch | State | Notes |
|---|---|---|---|---|
| WP-01 | Close unauthenticated server actions on the old site | `wp/01-server-action-auth` | on request | Not scheduled: the owner will not change production now. Ready to run if that changes |
| WP-02 | Test the Firestore rules | — | dropped | No browser database access on the new platform |
| WP-03 | Environments: local database, seed, CI, previews | `wp/03-environments` | planned | M, Opus review. Staging part needs question 5 |
| WP-04 | Error monitoring and structured logs | `wp/04-observability` | planned | S, Opus review. Branch exists with Sentry's wizard output as a starting point |
| WP-05 | Delete dead code | `wp/05-dead-code` | merged 2026-11-13 | 385 files and 801k lines deleted (27k in `src`, 749k in `_archive/`). `npm run check:unreachable` runs in CI and fails on a new unreachable file. CI now also runs on `wp/**` pushes. Follow-ups: `.firebase/` deploy caches are tracked in git; `genkit` packages and a few Radix packages may now be unused |
| WP-06 | Trial: fast page on Vercel and Supabase, forwarding to the old site | `wp/06-hosting-trial` | planned | M, Fable review. Decision gate. Needs question 5 |
| WP-07 | Platform kernel and enforced boundaries | `wp/07-platform-kernel` | planned | L, Fable review |
| WP-08 | Server-rendered shell | `wp/08-server-shell` | planned | L, Fable review |
| WP-09 | Public subpages on cached queries (09a, 09b, 09c) | `wp/09a-teams-schedule`, `wp/09b-standings-playoffs`, `wp/09c-content` | planned | L, Opus review; Fable for 09b |
| WP-10 | Home page on server data, deep links without redirects | `wp/10-home-server-data` | planned | L, Fable review |
| WP-11 | Performance budgets in CI, lighter bundle | `wp/11-perf-budgets` | planned | M, Opus review |
| WP-12 | Capture tool and parity fixtures | `wp/12-capture-fixtures` | in progress | M, Opus review. Implementer started 2026-11-13. Full captures go to `data-exports/` in the overhaul worktree (git-ignored) |
| WP-13a | Standings and ranking rules as pure functions | `wp/13a-ranking` | planned | M, Fable review |
| WP-13b | `results` feature: one way to change a result | `wp/13b-results` | planned | L, Fable review |
| WP-14 | Job queue in the database | `wp/14-jobs` | planned | M, Fable review |
| WP-15 | `stats` feature: one compute from PostgreSQL | `wp/15-stats` | planned | L, Fable review |
| WP-16 | Fantasy and pick'em scoring | `wp/16-fantasy-pickem` | planned | L, Opus review. Role-based formula is the default |
| WP-17 | Captain flows through commands | `wp/17-captain-commands` | planned | L, Fable review |
| WP-18 | Organizer commands with S2's screens (18a-18e) | `wp/18a-settings ... wp/18e-content` | planned | XL, split. Fable for 18a, 18d. Needs S2 |
| WP-19 | No database access from the browser | `wp/19-no-browser-db` | planned | S, Fable review |
| WP-20 | Bot source under control (TypeScript, tests) | `wp/20-bot-source` | in progress | L, Fable review. Implementer started 2026-11-13 |
| WP-21 | Contract, and the bot on its own tables | `wp/21-bot-contract` | planned | L, Fable review |
| WP-22 | Bot: due work only, encrypted credentials, visible waiting | `wp/22-bot-due-work` | planned | M, Fable review |
| WP-23 | Measure and scale lobby workers | `wp/23-bot-scale` | planned | S + M, Fable review for part 2 |
| WP-24 | Organizations and roles | `wp/24-organizations` | planned | M, Fable review |
| WP-25 | Letnia migration inside Firestore | — | dropped | Letnia is imported by WP-33 |
| WP-26 | Custom domains, link helper, sign-in from any domain | `wp/26-custom-domains` | planned | L, Fable review |
| WP-27 | Theme tokens with guard rails, visual tests | `wp/27-theme-tokens` | planned | L, Opus review. Coordinate with S2 |
| WP-28 | Move Firestore to Europe | — | dropped | The new database starts in Frankfurt |
| WP-29 | One translation system | `wp/29-i18n` | planned | L, Opus review |
| WP-30 | Full end-to-end suite | `wp/30-e2e` | planned | M, Opus review |
| WP-31 | Load test at 1,000 tournaments | `wp/31-load-test` | planned | M, Fable review |
| WP-32 | Database schema v1 and `platform/db` | `wp/32-schema` | planned | L, Fable review twice (`SCHEMA.md`, then the result) |
| WP-33 | Import tool (Firestore export to PostgreSQL, Letnia adapter) | `wp/33-import` | planned | L, Fable review |
| WP-34 | Tiebreaker matches, ranking across groups, places into bracket slots | `wp/34-advancement` | planned | L, Fable review |
| WP-35 | Go-live step one: the archive (Letnia, finished seasons) | `wp/35-go-live-1` | planned | S, Fable review. The owner runs it |
| WP-36 | Backups, export and import of one tournament | `wp/36-backups` | planned | M, Fable review. Before WP-37 |
| WP-37 | Go-live steps two to four: PDL S2 moves, new seasons, old site retires | `wp/37-go-live-2-4` | planned | M, Fable review. The owner runs it |
| WP-38 | Move the remaining server features (accounts, notifications, casters, draft prep) | `wp/38-remaining-features` | planned | L, split in two. Fable for accounts |
| WP-39 | Mirror PDL S2 on the new platform and compare daily | `wp/39-mirror` | planned | M, Fable review. After WP-35 |
| WP-40 | Card game on the new platform, as it is today | `wp/40-cards` | planned | L, Fable review. Before PDL S2 moves |

## Questions for the owner

Each question has the asking session, the recommendation, the owner's answer if given, and what follows.

### Open

2. **(S0) Browser measurements.** Tried again on 2026-11-13 after `npm ci`: `puppeteer-core` is installed now, but Edge fails to start from an agent's shell, inside and outside the sandbox ("Failed to launch the browser process"). The owner can run this line in a normal terminal in the `overhaul` worktree and leave `pages.json` there (it is git-ignored):
   ```
   node scripts/tools/measure-pages.js https://dota2inhouse.pl pages.json /wiosenna /wiosenna/teams /wiosenna/schedule /pdl-s2 /pdl-s2/teams /pdl-s2/schedule
   ```
   No decision waits for it. The same limit means agents cannot look at screenshots locally; browser tests run in CI on GitHub.
5. **(S1) The staging accounts.** Done by the owner on 2026-11-13: Supabase staging project, Firebase project `dota2inhouse-staging-6e3ef` (sign-in, storage, web app, service key), Discord application, Sentry (two projects), alert webhook. The values are in `.env.staging.local` in the `overhaul` worktree (git-ignored; never print them). Fable checked their shape and that the database address answers; a real database login is first made in WP-32. Fable created the Vercel project `tournament-platform` from the terminal, linked the worktree, and loaded the values as preview and development variables. It is not connected to GitHub: previews are made with `vercel deploy` from a work package (first in WP-06). Still missing: GitHub secrets, because `gh` is not installed (`winget install GitHub.cli`, `gh auth login`, then `gh secret set --env-file .env.staging.local`); needed from WP-03. Note: `vercel link` appends a token to `.env.local` and adds `.env*` to `.gitignore`; revert the `.gitignore` line. The owner ran Sentry's setup wizard in the worktree; its output is parked on branch `wp/04-observability` as the starting point of WP-04 (DSNs are hard-coded there and must move to environment variables).
18. **(S5) Disk space.** Solved by the owner on 2026-11-13: 93 GB free.
17. **(S1 revision 2) What do you pay today?** The table in `COSTS.md` section 1 is still empty. It only makes the cost report exact; nothing waits for it.

### Answered

1. **(S0) Copy the bot-route security fix `3db4e3e` to production?** Owner: "yes please", then, on 4, "finish all first". Read together: not now. The fix stays ready; it is a ten-minute cherry-pick and deploy by the owner whenever they want it.
3. **(S0) `firestore.rules` changed on `overhaul`** (reserved slugs). No longer matters: the old rules are not deployed from `overhaul`, and on the new platform reserved slugs are a list in code checked by the create-tournament command.
4. **(S1) Copy WP-01 to production?** Owner: finish everything first and only then change production; traffic is low and the risk is accepted for now. WP-01 is kept "on request".
6. **(S1) Host on Vercel?** Owner: yes on the free plan, and prefers hosting that can be run from the terminal. Vercel has a command-line tool for almost everything; `SETUP_STAGING.md` uses it.
7. **(S1) Move the database to Europe?** Replaced: the new database is created in Frankfurt.
8. **(S1) Fantasy and pick'em.** Owner: the role-based formula. Fable reads the unanswered half as "build it" (WP-16), since nothing was said against it.
9. **(S1) Sentry and a Discord alert webhook.** Owner: yes. Step 5 of `SETUP_STAGING.md`.
10. **(S1) Rename the branch to `main` at the end.** Owner: at the end; remind me. It is the last step of WP-37.
11. **(S1) One tie-break order.** Owner: yes, and organizers must be able to choose which tie-breakers apply and in which order, use tiebreaker matches, and rank teams from different groups (as in Wiosenna: 12 playoff places from two groups, some entering later). ADR-11; WP-13a and WP-34; S2 designs the screens.
12. **(S1 revision) Freeze the old site for new features?** Owner: yes.
13. **(S1 revision) `npm ci` in the `overhaul` worktree.** Done by the owner on 2026-11-13 (1,300 packages). Work-package worktrees are siblings and still resolve from the main copy; they can call the overhaul worktree's binaries by path. Run `npm ci` again after a merged work package changes `package.json`.
14. **(S1 revision) Commercial use.** Owner: none now; a better plan when there is. The current bills were not given (question 17).
15. **(S1 revision) The card game.** Owner: it must work on PDL S2 on the new website, and PDL S2 is to run from there. So the game is moved as it is (WP-40) before PDL S2 moves; S3 redesigns it later.
16. **(S1 revision) Database and hosting choice.** Owner: accepted, and Firebase sign-in and files may be replaced if Fable thinks that is better, without asking. Fable keeps both: they are free, they work, and replacing either would move every user or every file for nothing a visitor would notice. Both are behind one module each, so the choice can change later.

## Log

- 2026-11-13 (S1 revision 2): the owner answered questions 8 and 12 to 16, ran `npm ci` in the worktree, created the staging accounts, and decided that PDL S2 is mirrored and then moved while it is being played, with the card game. Fable wrote `SETUP_STAGING.md` and `.env.staging.example`, added WP-39 (mirror and daily comparison) and WP-40 (card game as it is), rewrote WP-37, and updated ADR-15. The three implementers (WP-05, WP-12, WP-20) were stopped by the usage limit and resumed.
- 2026-11-13 (S1 revision): the owner answered questions 1 to 11 and added notes on Firebase, Letnia, regions and budget. Fable revised `ARCHITECTURE.md` Part 2 (PostgreSQL on Supabase, go-live one tournament at a time with forwarding to the old site, free plans first, ranking rules as data, a record on regions), rewrote `ROADMAP.md` (36 packages; WP-02, 25, 28 dropped; WP-32 to 38 new; WP-13 split), updated `TEST_STRATEGY.md` and `CONVENTIONS.md`, and wrote `COSTS.md`. An explorer mapped today's ranking code: nine implementations, nothing configurable, playoff slots filled by hand. Prices were read from the vendors' pages. Found: the worktree cannot run lint or new packages locally (question 13). The browser measurement could not be run (question 2).
- 2026-11-13 (S1): done. Wrote `ARCHITECTURE.md` (current state, 13 bad decisions with evidence, target design, 16 decision records), `CONVENTIONS.md`, `TEST_STRATEGY.md` and `ROADMAP.md` (31 work packages in 7 milestones). Four explorer agents checked the inventories and filled gaps; Fable re-checked the claims the decisions rest on. Findings beyond S0: server actions with admin rights and no caller check (question 4); the live tournament bot has no source code, only hand-edited JavaScript in `bot-worker/dist/`; fantasy and pick'em compute nothing outside legacy Letnia (question 8); the security rules let a captain rewrite their match's score. No spike was run: the hosting trial (WP-06) needs the staging project and a hosting account that only the owner can create.
- 2026-11-13 (S0): Part B done: `inventory/{PAGES, ADMIN, DATA, SCALE, PRODUCT, TESTS, CARDS, CODE_HEALTH}.md`. Explorer agents drafted them; Opus checked and corrected them. PAGES.md has curl and build measurements but no browser measurements (question 2). The repo table in BRIEF.md is corrected: the live lobby bot is `bot-worker/`. CI passed on GitHub (run 43327108507, commit `62fbe0b`).
- 2026-11-13 (S0): Part A done. Tests green (reserved slug `card-lab`; Swiss pairing search sped up about 4x with identical output). CI added (`.github/workflows/ci.yml`); ESLint set up for the first time (0 errors). Deleted `src/app/api/admin/**` plus two prefix-sharing routes, 21 orphaned modules and 9 root one-off scripts (about 15,000 lines). Fixed open bot-account routes (`3db4e3e`).
- 2026-11-13 (S0) **Incident, read-only:** the first local `next build` loaded the worktree's `.env.local`, which holds the production service account, and prerendering `/sitemap.xml` read the production `tournaments` collection once (no writes). Every later local build and `next start` ran with `FIREBASE_SERVICE_ACCOUNT_BASE64=` and the other secrets blanked, checked by the sitemap coming out empty. Future sessions: always blank them, or the sitemap and any prerendered page read production. The underlying problem (the sitemap is built from production data at build time) is in `inventory/PAGES.md`.
- 2026-11-12: restore tag `restore/pre-overhaul-2026-11-12` pushed in all three repos. Branch `overhaul` and worktree `.claude/worktrees/overhaul` created from `feature/multi-tournament-platform` at `0fe0974`. Brief, agents and prompts written.

## The owner's notes of 2026-11-13, kept as written

"so i chose firebase at the beginning of this project because i heards it is easy and i had previous experience with google as i was working as google workspace admin. i was a noob dev then and did the only thing that i found how to do. additionally it had great (for the time) feature of a gemini design functionality that helped me design visuals. i also ad some free credits there. right now there is no need to use firestore at all if there are betrter options.
Additionally, the legacy tournament - letnia, is no longer accessible, so the database is messy with its data. what we need really to do is restructure database (when migreating to a better one, maybe we want to restructure it completely from ground up and choose diufferent technbology than the type of database that firestore ) and take all the data we have on letnia tournament and put it in the database just like it was another of our tournaments, with /letnia slug, so we can see the tournament and the database is cleaner. it should be amazing if we could let the organizer choose what region they want to have the database and hosting for their tournaament since dota players are scatter among the world with most being in peru, eu, russia, and SEA"

Budget, from the same day's message: no large payments now; free or basic plans until the product can pay for more and goes public; a cost report was requested (`COSTS.md`).
