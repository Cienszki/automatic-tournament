# Overhaul status

Every session updates this file as it works, not only at the end. A new session, on any model, must be able to continue from it alone.

## Next step

The owner answered the S0 and S1 questions on 2026-11-13, and S1 revised the plan the same day. **Read "Decisions that changed the plan" below before anything else**: they override parts of `BRIEF.md` that assume Firestore and a gradual change of the live site.

What can start now, with nothing from the owner:

- **WP-05** (delete dead code), **WP-12** (capture real tournaments and what the old site publishes) and **WP-20** (bot source to TypeScript). Use the S5 prompt in `PROMPTS.md`.
- **S2 (organizer experience).** It is now a prerequisite of WP-18, because the old admin tabs are not converted: S2's screens are built directly on the new commands. Its prototype review needs a browser, which the agent sandbox blocks (question 2), so that part waits for the owner or runs in CI.

What waits for the owner: the staging accounts (question 5) for WP-03's staging part and WP-06; `npm ci` in the worktree (question 13) for running lint and the new tests locally; question 8 for WP-16.

After WP-12: **WP-32** (database schema). It has a Fable review of `SCHEMA.md` before any migration is written.

## Decisions that changed the plan (owner, 2026-11-13)

1. **Firestore is not required.** The tournament platform moves to PostgreSQL with a clean structure (`ARCHITECTURE.md` ADR-04). Firebase keeps sign-in and files. Fable chose Supabase (free plan, Frankfurt) as the host, used as plain PostgreSQL.
2. **Production does not change until the new platform is ready.** This includes the two security fixes (questions 1 and 4). The new platform is built on `overhaul` beside the old site and takes over one tournament at a time, starting with archived ones (ADR-15). The brief's rules still hold: no deploy by agents, no writes to production Firestore, no script with production credentials. The brief's rule "change the Firestore schema only additively" no longer applies, because the Firestore schema is not changed at all.
3. **Letnia becomes an ordinary tournament** at `/letnia`, imported into the same tables as the others (WP-33). It is not reachable today, so it is the first tournament to go live on the new platform.
4. **Free or basic plans until there is income.** Every service starts free; `COSTS.md` gives the triggers for paying.
5. **Organizers choose their tie-breakers and their order,** can use tiebreaker matches, and can rank teams from different groups for playoff places and seeding (ADR-11, WP-13a, WP-34).
6. **Region per tournament** is not built now. The design keeps it possible, and the reasons are in ADR-17.

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
| WP-04 | Error monitoring and structured logs | `wp/04-observability` | planned | S, Opus review. Runs beside anything |
| WP-05 | Delete dead code | `wp/05-dead-code` | in review | M, Opus review. 385 files and 801k lines deleted (27k in `src`, 749k in `_archive/`); `scripts/tools/unreachable.mjs` runs in CI; 3 unreachable files kept for WP-13a and WP-16. Local build not run (disk full); CI builds it |
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
| WP-16 | Fantasy and pick'em scoring | `wp/16-fantasy-pickem` | planned | L, Opus review. Waits for question 8 |
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
| WP-37 | Go-live steps two and three: new seasons, old site retires | `wp/37-go-live-2-3` | planned | M, Fable review. The owner runs it |
| WP-38 | Move the remaining server features (accounts, notifications, casters, draft prep) | `wp/38-remaining-features` | planned | L, split in two. Fable for accounts |

## Questions for the owner

Each question has the asking session, the recommendation, the owner's answer if given, and what follows.

### Open

2. **(S0) Browser measurements.** The owner said: run it, and install what is needed. S1 tried on 2026-11-13: `puppeteer-core` is not installed anywhere on this machine, and installing it into a new folder was refused twice by the session's permission system. The fastest way is for the owner to run these once, in the `overhaul` worktree, after question 13's `npm ci`:
   ```
   node scripts/tools/measure-pages.js https://dota2inhouse.pl pages.json /wiosenna /wiosenna/teams /wiosenna/schedule /pdl-s2 /pdl-s2/teams /pdl-s2/schedule
   ```
   and leave `pages.json` in the worktree. For agents to do this themselves in future, a Bash permission rule that allows `npm` installs and launching Edge headless outside the sandbox is needed. The numbers are useful as a "before" picture; no decision waits for them.
5. **(S1) Create the staging accounts.** The list changed with the new database and is in `TEST_STRATEGY.md`, "What the owner must create" (points 1 to 7; all free). WP-03's staging part and WP-06 wait for it. Not answered yet beyond the general notes.
8. **(S1) Fantasy and pick'em do not work for any tournament except old Letnia.** (a) Build the scoring in WP-16, or leave both out of the new platform until S2 has redesigned them? (b) Which fantasy formula do new tournaments use: the flat PDL one, or the role-based one? Recommended: (a) build it in WP-16; (b) flat as the default, role-based as a preset. Not answered. WP-16 waits; nothing else does.
12. **(S1 revision) Freeze the old site for new features?** From now on the production branch would get fixes only, and anything new is built on the new platform. Otherwise the two drift apart and the import keeps chasing changes. Recommended: yes. Work continues on that assumption.
13. **(S1 revision) Run `npm ci` in the `overhaul` worktree.** The worktree has no `node_modules`; it borrows the main working copy's, which lacks ESLint, Playwright, `puppeteer-core` and every package the new platform adds. Agents are not allowed to install into a new folder, and the disk has 8 GB free. Needed: about 3 GB free, then `npm ci` in `.claude/worktrees/overhaul`, and again when a work package adds packages (its report will say so). Until then agents rely on CI on GitHub for lint and new tests, which is slower.
14. **(S1 revision) Three facts for the cost report** (`COSTS.md`, section 5): what is paid today per service; whether the site already earns anything (paid sponsors, fees, ads), because Vercel's free plan is for non-commercial use only; and which Vercel plan the community site is on.
15. **(S1 revision) The card game on the new platform.** Its tables are left to S3. Until S3's packages are built, tournaments on the new platform have no card game; archived ones do not need it. Should S3 run before the first new season starts there, or may a new season start without cards? Recommended: run S3 after S2, and decide when M3 is in sight.
16. **(S1 revision) Confirm the database and hosting choice,** or say what to change: PostgreSQL on Supabase's free plan in Frankfurt; the web app on Vercel's free plan; Firebase kept for sign-in and files only. Work continues on this. WP-06 measures it before anything depends on it.

### Answered

1. **(S0) Copy the bot-route security fix `3db4e3e` to production?** Owner: "yes please". But see 4, which the owner answered later and more broadly. Read together: not now. The fix stays ready; say the word and it is a ten-minute cherry-pick and deploy by the owner.
3. **(S0) `firestore.rules` changed on `overhaul`** (reserved slugs). No longer matters: the old rules are not deployed from `overhaul`, and on the new platform reserved slugs are a list in code checked by the create-tournament command.
4. **(S1) Copy WP-01 to production?** Owner: finish everything first and only then change production; traffic is low and the risk is accepted for now. WP-01 is kept "on request". The new platform cannot have this class of hole (ADR-07).
6. **(S1) Host on Vercel?** Owner: no large payments; free or basic plans until there is income. Decision: Vercel's free plan first, the $20 plan at the first income or limit (ADR-03, `COSTS.md`).
7. **(S1) Move the database to Europe?** Replaced by decision 1: the new database is created in Frankfurt.
9. **(S1) Sentry and a Discord alert webhook.** Owner: yes. They are points 6 in the staging list.
10. **(S1) Rename the branch to `main` at the end.** Owner: at the end; remind me. It is the last step of WP-37.
11. **(S1) One tie-break order.** Owner: yes, and organizers must be able to choose which tie-breakers apply and in which order, use tiebreaker matches, and rank teams from different groups (as in Wiosenna: 12 playoff places from two groups, some entering later). Designed in ADR-11; built by WP-13a and WP-34; S2 designs the screens.

## Log

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
