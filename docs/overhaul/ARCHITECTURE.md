# Architecture

Written in S1 (2026-11-13) by Fable. It describes how the product is built today, what is wrong with that, and how it should be built to serve thousands of tournaments, feel fast on every page, and stay readable and testable. The plan for getting there is in `ROADMAP.md`. Coding rules are in `CONVENTIONS.md`, and testing is in `TEST_STRATEGY.md`.

The facts come from the S0 inventories and from four explorer reports made in S1. The claims that decisions rest on were re-checked in the code by Fable; those are marked "(S1 checked)".

**The short version.** Today the server sends every visitor an empty page, and the browser then builds the page by reading the database directly. The browser also writes to the database directly, so the security rules are the only guard on most data. Background work is one HTTP call every five minutes that the bot makes to the website. The target turns each of these around:

1. The server renders every public page from cached per-tournament data, and a content delivery network (CDN) serves the result.
2. Every write goes through one kind of server function that validates the input, checks permission, writes, and then invalidates the caches that changed. The browser has no access to the database.
3. The data moves from Firestore to PostgreSQL, with one structure for every tournament, Letnia included.
4. Background work is a queue of jobs in the database. Nothing loops over all tournaments.
5. Results, standings, stats and fantasy are computed in one place, by pure functions, with ranking rules the organizer can set.
6. The website and the bot share one written contract, and the bot's source code is brought back under version control.
7. The new platform is built beside the old site and takes over one tournament at a time. Production does not change until then.

Part 1 describes the old site and stays true until it retires. Part 2 was revised on 2026-11-13 after the owner's answers in `STATUS.md`.

## Part 1. The current architecture

### 1.1 One page

**Hosting.** The website is a Next.js 15.5 app (React 18). It is deployed by hand with `firebase deploy` through the Firebase Hosting frameworks adapter, which runs it on Cloud Run in `europe-west1` (up to 10 instances, 1 GiB each). The domain `dota2inhouse.pl` belongs to a separate community site on Vercel. That site forwards every path it does not own to the Firebase address. There is one Firebase project, `tournament-tracker-f35tb`, and it is production. Its Firestore database is in the US (`nam5`).

**Reading.** 41 of 50 pages are client components. The server sends the same 63 KB shell with no content for every URL, marked `private, no-store`. In the browser, a provider in the root layout reads the whole `tournaments` collection and the current tournament's document. Only then do pages mount and start their own Firestore reads. Nothing is shared between pages. The one exception is the stats hub, which reads a cached server endpoint (`/api/stats/dataset`).

**Writing.** There are three ways to write, used side by side:

- 27 browser files write Firestore directly at 165 call sites (the admin tabs, the captain's team page, pick'em). `firestore.rules` (570 lines, no tests) is their only guard.
- 77 API routes use the Admin SDK, which bypasses the rules. They check the caller in five different ways.
- Nine `'use server'` files export server actions that use the Admin SDK.

**Tenancy.** A tournament is a document in `tournaments/` with an auto-generated id and a `slug` field. Its data lives in about 28 kinds of subcollection under it. The oldest tournament, Letnia, still lives in about 18 top-level collections, and special cases for it run through the code (`isLegacyTournament`, `tournamentId === null`).

**Roles.** A platform admin is a document in `admins/{uid}`. A tournament admin is a document in `tournaments/{id}/admins/{uid}`. The organizer is the `organizerId` field on the tournament. A captain is `captainId` on a team. People who may create tournaments are on an allowlist, `tournamentCreators/{uid}`.

**Results.** A finished game is imported from the Steam league and OpenDota by `syncPDLMatchesAdmin`, saved by `savePDLGameResultsAdmin`, and followed by several recalculations. Stats shown to viewers are derived in the browser from the dataset endpoint.

**Background work.** The bot's Conductor process calls `/api/manage/bot/orchestrate` every five minutes. That one call imports results, sends match reminders, and settles card duels and card rewards.

**The bot.** One container on Railway runs `node dist/conductor.js`. It forks one process per open lobby. It talks to the website only through shared Firestore collections and that five-minute call.

### 1.2 The bad decisions

Each has its evidence and what it costs today. They are ordered by how much they shape the rest.

**B1. The browser is the application.** Every page is a client shell that reads Firestore after hydration, behind a gate that waits for the tournament document (`[tournamentSlug]/layout.tsx:217`).
- Cost: this is the slow-subpage problem (section 2.1). A hard load needs about 0.3 s for the shell, 420-440 KB of scripts, then about 1 s for the first Firestore connection to the US, and only then the page's own reads.
- Cost: every page view reads the whole `tournaments` collection (`TournamentContext.tsx:162`), 19 KB per tournament. Reads grow with page views times tournaments. At 1,000 tournaments that is about 19 MB per page load.
- Cost: search engines and link previews get no content. No page has its own title or preview image (`generateMetadata` is used nowhere).

**B2. Browser writes guarded only by untested rules.** (S1 checked the rules quoted here.)
- A captain can rewrite any field of their match, including the score and the status (`firestore.rules` 203-205).
- Any signed-in user can create a team in any tournament with any `captainId` (line 188).
- A captain of a match can approve a stand-in request against their own team's opponent by writing `status` (334-338).
- Any tournament admin can delete the other admins, including the owner (182).
- Cost: the integrity of results rests on nobody trying. Business rules live in components, so they cannot be tested or reused.

**B3. Server actions that check no caller.** (S1 checked.) `src/lib/standin-actions.ts`, `src/lib/bot/bot-config-actions.ts`, `playoff-sync-actions.ts`, `player-profile-actions.ts` and `fake-team-action.ts` are `'use server'` files that use the Admin SDK and never look at who is calling. A server action is a public HTTP endpoint. Client components import these files (`MyTeamView`, `MatchPanel`, `StandinsTab`, `MatchesTab`), so their action ids are in the JavaScript sent to every visitor.
- Cost: anyone can approve or reject stand-in requests, and can probably call the bot account and bot config functions as well. This is live in production. It is question 4 in `STATUS.md` and work package WP-01.

**B4. No single place for permission checks.** 24 routes use `requireAdmin`, about 16 hand-roll a token check, and two bot routes answer any signed-in user (`bot/config` GET, `bot/sessions` GET). `/api/pickem/export` is public and returns user ids and Discord names.
- Cost: this pattern produced the open bot-account routes that S0 fixed. Each new route is a new chance to get it wrong.

**B5. The live bot has no source code.** (S1 checked.) `bot-worker/dist/conductor.js`, `runner.js` (1,746 lines), `scheduling.js`, `runner-logic.js` and `dota-client.js` are hand-edited JavaScript. There is no TypeScript source for them; the file itself says "this sourceless file". `dist/` is force-added to git, and the Dockerfile copies it as it is.
- Cost: no types, no tests and no review tooling on the product's main selling point. The inhouse and Discord half of the same folder is real TypeScript that compiles into the same `dist/`, so one wrong build step can overwrite or drop live code.

**B6. No contract between the website and the bot.** They share `botLobbySessions`, `botAccounts`, `botSyncTasks`, `config/bot`, and the match and team documents. The website has types (`src/types/lobby-bot.ts`), and the bot has none. The bot reads tournament, team and match documents directly, so any change to the website's schema can break it without an error.
- Evidence of drift: the website still writes `set_teams` commands to `botCommands` that no process reads. The website's `scheduleLobbyForMatch` and the bot's `scheduling.js` are two copies of the same rule. Series completion is implemented once on each side.
- Bot passwords are stored in a field named `encryptedPassword` that is only base64.

**B7. One HTTP call is the scheduler for everything.** Result imports, reminders, card duel settlement and round rewards all hang on the Conductor's five-minute call. It runs only if two environment variables are set on Railway. If either is missing, it does nothing and reports nothing.
- Cost: a result appears 5 to 10 minutes after the game at best. One slow tournament import delays every other tournament, because the work is sequential in one request. The Conductor also reads every tournament and every tournament's bot config each minute, active or not.

**B8. Results, stats and fantasy were never one design.**
- Per-player fantasy points have three formulas with different weights (`opendota.ts:285`, `pdl-fantasy-scoring.ts`, `comprehensive-stats-calculator.ts:1956`), and a fourth copy in viewer-facing text.
- Standings are computed in at least seven places with different tie-break orders. A viewer can see two orders for the same division on two pages.
- A full-series forfeit and a manual score edit do not update the stored standings.
- The 2,172-line `comprehensive-stats-calculator.ts` rewrites `playerStats` and `teamStats` after every sync. No viewer page reads them; only the admin stats tab does.
- **Fantasy does not work for any tournament except legacy Letnia.** (S1 checked.) The tournament fantasy page shows a placeholder where the ranking should be, and every recalculation function reads and writes the legacy root collections. Pick'em stores picks and never scores them.
- A tournament with no Steam league id silently imports Letnia's games (`getLeagueId` falls back to 18559, `definitions.ts:254`).

**B9. Deploys are manual and there is one environment.** Production is built from a working copy. There is no staging project, so nothing can be tried against real infrastructure before it is live. `firebase-tools` is not pinned. A local build once read production data (S0 incident). The hosting adapter in use is the older of Firebase's two; `apphosting.yaml` is a leftover.

**B10. Two generations of everything remain.** Legacy root collections with their own pages, rules and code paths; two playoff systems; two Admin SDK init files; two i18n systems (and English cannot be selected, because nothing ever sets the `NEXT_LOCALE` cookie, yet reading that cookie makes every page uncacheable); 108 unreachable files (18,075 lines); 119 scripts nobody refers to.
- Cost: every reader, human or AI, pays for the dead half in context and mistakes.

**B11. No error monitoring and no audit trail.** Errors go to `console.error` (428 call sites). The bot has no health endpoint and no alert. Nobody is told when result syncing stops. There is no record of who changed a result.

**B12. State that lives in one server instance.** The rate limiter, the rulebook cache and `unstable_cache` are per instance, with up to 10 instances. The stats dataset is rebuilt per instance every 10 minutes and is not invalidated when a game is imported. The first visitor after expiry waits up to 7.8 s.

**B13. The database is on another continent.** Users and servers are in Europe, the database is in the US. A first request costs about 0.95 s and a warm one 0.18 s from Poland. Each move in a card duel costs about 0.5 s.

## Part 2. The target architecture

**Revised on 2026-11-13 after the owner's answers.** Four answers changed this part, and the text below already includes them:

1. The owner does not need Firestore and wants the data restructured from the ground up. The tournament platform moves to PostgreSQL (ADR-04).
2. Nothing changes in production until the new platform is ready. The new platform is built beside the old site and takes over one tournament at a time (ADR-15).
3. The budget is free or basic plans until there is income. Every service below starts on a free plan, with a stated trigger for the first paid one (section 2.4 and `COSTS.md`).
4. Letnia becomes an ordinary tournament at `/letnia` (ADR-05), and organizers choose and order their tie-breakers (ADR-11).

### 2.1 Why subpages are slow, and how every page becomes fast

**Why.** The home page and the subpages do the same slow work: wait for JavaScript, wait for the tournament document, then read Firestore from the browser. The home page hides it behind one loading screen that is also waiting for fonts and the hero video, and it pays once, because its sections switch without a page load. A subpage pays on every visit and shows a second loading screen. Deep links to stats, rankings and team pages pay twice, because they redirect to the home page after hydration. Details are in `inventory/PAGES.md` section 1.

**How it becomes fast.** The measurements already show the answer. The server renders the shell in 10-17 ms locally. A cached response from the CDN arrives in 0.16-0.23 s. So if the HTML contains the content and the CDN holds it, every page arrives complete in about 0.2 s, before any JavaScript runs.

The design, in order of effect:

1. **The server renders content.** `[tournamentSlug]/layout.tsx` becomes a server component. It loads the tournament once, writes the theme as CSS variables into the HTML, and sets the title and preview image. Pages are server components that load their data through cached query functions (ADR-02) and pass it to client components as props.
2. **No gate.** Content is in the first response, so there is nothing to wait for. The full-screen loading screen stays only where the owner wants it as a design element (the home page hero), and it never blocks content for longer than a set budget.
3. **Pages are cacheable.** The root layout stops reading a cookie (ADR-08 moves the language choice to the tournament). Pages become static per tournament and are regenerated when their data changes (ADR-02, ADR-12).
4. **The home page keeps its design.** The full-screen, snap-scrolling shell stays a client component. It receives teams, matches and standings from the server as props, where today it makes about ten browser reads. Sections that are heavy and below the first screen (stats hub, cards) still load on demand. `/stats`, `/rankings` and `/teams/[id]` render the same shell with the right section open, with no redirect.
5. **Navigation is prefetched.** With server-rendered pages, `<Link>` prefetches the next page's data. Moving between pages then feels like the home page's section switch.
6. **Less JavaScript.** No page imports the Firestore browser SDK. The Auth SDK loads after the page is interactive. The budget is in `TEST_STRATEGY.md`.

Per-user parts of a page (the account button, the notification bell, the captain's controls) are small client components that fetch after load. They never make the page itself uncacheable. A draft tournament is the exception: it is rendered per request and not cached, because only its admins and holders of the preview link may see it.

### 2.2 The decisions

Each decision is a short record: context, options, choice, reason, cost.

---

#### ADR-01. The server renders public pages; the browser adds interaction

**Context.** B1. Every page is an empty shell filled in by the browser.

**Options.**
1. Keep client rendering and add a shared client cache (for example react-query) so pages stop re-reading. Removes the second loader, keeps the empty first response and the SDK weight.
2. Keep client rendering but have every page read one cached endpoint, like the stats hub. Faster data, still no content in the HTML.
3. Render on the server from cached data, with client components only for interaction.

**Choice.** Option 3.

**Why.** It is the only option that puts content in the first response, which fixes speed, search engines and link previews together. It also removes the reason for browsers to reach the database at all (ADR-07).

**Cost.** Each public page is rewritten from "component with an effect" to "server page plus client view". The view components keep their look. About 100 components read `useTournament()`; they keep working, because the provider stays and is seeded from the server's data.

---

#### ADR-02. Cached query functions per tournament

**Context.** Server rendering needs data that is fast to get and that changes when an organizer changes something.

**Term.** A *query* is a server function that returns data for display, for example `getTeams(tournamentId)`.

**Options.**
1. Query the database on every request. Simple and always fresh, but every page view costs database work, and a traffic spike on one tournament loads the database for all.
2. Store a ready-made copy of every page's data and keep it in step with every write. Fastest reads, but every write path must maintain it.
3. Wrap each query in the framework's data cache, tagged per tournament and per kind of data, and invalidate the tag when that data changes.

**Choice.** Option 3.

- Queries live in each feature's `queries.ts` and are wrapped by one helper: `cachedQuery(fn, { tags: [tags.teams(id)] })`.
- Every command (ADR-07) ends by invalidating the tags it touched. All writes are commands, so freshness is exact: a change shows on the next request.
- Derived data (standings, the stats dataset, leaderboards) is computed inside cached queries by pure functions (ADR-11). With PostgreSQL the inputs arrive in a few queries, so nothing derived is stored at the start. If a measurement shows a compute above about 300 ms, that one result gets stored by a job.
- A tournament is found by a unique index on `tournaments.slug` and on `domains.hostname`. "Is this slug free" is a unique constraint, not a scan.

**Why.** There is no second copy of the data, so nothing can drift. It can be introduced one query at a time.

**Cost.** The data cache must be shared between server instances, or an invalidation reaches only one of them. That depends on the hosting choice (ADR-03). A wrong tag means stale data, so tags are defined once in one file and tested.

---

#### ADR-03. Host the web app on Vercel, on the free plan until there is income

**Context.** B9, B12. The target needs four things from hosting: a cache shared by all instances with invalidation by tag; a CDN that caches HTML; automatic deploys from git with a preview per branch; and TLS for thousands of organizer domains. Today's Firebase Hosting adapter gives none of the four. The domain is already on Vercel. The owner cannot pay for large plans yet.

**Options.**
1. Stay on the Firebase Hosting frameworks adapter. No migration. Cache is per instance, deploys stay manual, and the adapter is the older product.
2. Firebase App Hosting. Git deploys, same cloud. Tag invalidation across the CDN and custom domains at this scale are not documented as supported.
3. Cloudflare Workers through the OpenNext adapter. The cheapest at scale and allowed for commercial use on its free plan. It adds an adapter between Next.js and the platform that we would have to keep working.
4. Its own Vercel project. The community site keeps `dota2inhouse.pl` and forwards to it exactly as it forwards to Firebase today.

**Choice.** Option 4, confirmed by a measured trial before anything depends on it (WP-06). Functions run in Frankfurt, next to the database.

**The plan to pay for it.**
- **Hobby (free) while the site earns nothing.** Vercel allows Hobby only for non-commercial use. A free community league site fits. Its limits per month: 1,000,000 CDN requests, 100 GB of transfer, 1,000,000 function calls, 4 hours of active CPU, 50 domains per project. When a limit is passed, the feature stops until 30 days have gone by, so usage is watched (ADR-13).
- **Pro ($20 per developer seat per month) from the first of these:** the platform takes money in any form (organizer plans, ads, paid sponsor placement); CDN requests approach the limit (estimated at 10-15 active tournaments with today's traffic); an organizer needs domain number 51.
- Scheduled work does not depend on the plan. Hobby runs scheduled functions once a day at most; the job queue is driven from the database (ADR-09).

**Why.**
- All four needs are standard features there, and it runs Next.js with no adapter of ours to maintain.
- A preview deployment per branch, pointed at the staging database, is the staging environment (ADR-15).
- The cutover is one setting on the community site (`TOURNAMENT_ORIGIN`), and the new app forwards tournaments it does not have to the old site (ADR-15). Rollback is setting it back.

**Cost.** Server functions have a time limit (300 s), so long work must be a job. More dependence on one vendor for hosting; the way back is option 1 or 3, and nothing in this design prevents either.

**If the trial fails.** Option 3 is tried next; it has the same four features. Option 1 with time-based caching is the last resort.

---

#### ADR-04. PostgreSQL replaces Firestore for the tournament platform

**Context.** B2, B8, B10, B13. The first version of this record kept Firestore, because moving looked like a rewrite for its own sake. Two things changed. The owner said Firestore was a beginner's choice with no reason to keep it, and asked for a clean structure. And the rest of this design already rewrites every read (ADR-01, ADR-02) and every write (ADR-07). So the move costs far less than it would alone, and there will never be a cheaper moment: four tournaments, no outside organizers.

**Options.**
1. Stay on Firestore and move it to Europe.
2. PostgreSQL.
3. One SQLite database per tournament (Turso, Cloudflare D1). Elegant isolation and regions, but anything across tournaments (player profiles, the card game, platform statistics) becomes hard.

**Choice.** Option 2.

- **PostgreSQL, hosted on Supabase, in Frankfurt.** Supabase is used as a database host only: a connection string for the server and the bot. Its client library, its sign-in and its browser API are not used, so moving to any other PostgreSQL host is a dump, a restore and a new connection string.
- **Drizzle** defines the schema in TypeScript and generates SQL migrations. Tests run against an in-process PostgreSQL (PGlite), with no Docker and no Java.
- **Firebase keeps two jobs:** sign-in (Firebase Auth, so no user has to do anything and user ids stay the same) and files (Storage, so no file or link moves). The Firestore database stays only for the old site until it retires and for the inhouse Discord bot, which is outside this overhaul.

**Why PostgreSQL.**
- The data is relational: teams play matches, matches have games, games have performances, and almost every screen is a table or a sum over them. In Firestore each of those needed a hand-kept copy or a browser-side calculation; that is where the seven standings implementations and the three stats calculators came from.
- The database enforces what today only code promises: a slug is unique, a match's teams exist and belong to the same tournament, a game is imported once. Bad data is refused at the door, which matters most when AI agents write the code.
- No bill per read. A mistake in a query costs time, not money.
- The schema is one readable file, and changes are migrations in git. An agent that opens it knows the whole data model.
- Jobs, rate limits, audit and the bot's work list are plain tables with transactions (ADR-09, ADR-10).

**Why Supabase and not another host.** The bot and the job scheduler talk to the database around the clock. Supabase's free plan is a small always-on database, so that costs nothing. The main alternative, Neon, bills by the hour the database is awake (100 hours of its smallest size are free per month; always-on would use about 180). Supabase's free plan also lets the database call a URL on a schedule (`pg_cron` with `pg_net`), which is the job scheduler (ADR-09). Its free limits: 500 MB of database, two projects (production and staging), no automatic backups, and a project that sees no activity for a week is paused. The paid plan is $25 a month with daily backups and 8 GB.

**Rules that make this safe.**
1. The browser never talks to the database. The Supabase browser API is switched off, tables live in a schema it does not expose, and every table has row-level security enabled with no policy, as a second lock.
2. Because the free plan has no backups, a nightly dump runs from CI to private storage from the first day there is production data (WP-36).
3. The bot connects with its own database role that can touch only the bot's tables (ADR-10).

**The shape of the data.** The full schema is designed in WP-32. Its outline:

| Group | Tables | Notes |
|---|---|---|
| Platform | `users`, `user_links` (Discord, Steam), `organizations`, `organization_members`, `domains`, `players` (one per Steam id), `audit_log`, `jobs`, `rate_limits` | `users.id` is the Firebase user id |
| Tournament | `tournaments`, `tournament_members`, `stages`, `groups`, `teams`, `team_members`, `matches`, `games`, `performances`, `standin_requests`, `reschedule_requests`, `announcements`, `rule_sections`, `rule_paragraphs`, `prizes`, `fantasy_rounds`, `fantasy_lineups`, `pickem_picks` | every row carries `tournament_id` |
| Bot (own schema) | `lobby_sessions`, `workers`, `accounts` | the only tables the bot's role can use |

- **One model for every format.** A tournament has ordered *stages* (round robin, Swiss, bracket). A stage has *groups* (a league's divisions and a group stage's groups are the same thing). A playoff match is an ordinary match with a bracket position. This replaces `divisions`, `groups`, `swissRounds`, `playoffs` and `playoff_matches` with its mirror into `matches`.
- **Typed columns for what is queried, JSON for what is only displayed.** Theme, format settings and ranking rules are JSON columns validated by a schema in code. Raw OpenDota responses are not stored in the database.
- The card game's tables are designed by S3. Until then the card game is not on the new platform.

**How the data gets there.** An import tool reads Firestore data (a read-only export the owner makes) and writes the new tables, one tournament at a time, and can be run again without duplicating anything. It has an adapter for Letnia's old layout. It prints a comparison report: counts, standings and totals on both sides (WP-33). Production Firestore is only ever read.

**Cost.**
- Server features that sit on Firestore today and were going to stay as they are must be moved: accounts and notifications, casters, draft preparation, the rules assistant's quota, captain-change codes (WP-38).
- Live listeners go away (ADR-16).
- Two databases exist until the old site retires. Account data changed on one side after an import is not seen by the other; the import is re-run at each step to bring accounts up to date.
- The bot's Steam accounts are leased through Firestore by both the tournament bot and the inhouse bot today. WP-21 decides between a split pool and keeping the lease where it is.

---

#### ADR-05. The tournament is the unit of isolation; organizations sit above it

**Context.** Tenancy today is "a tournament document plus subcollections", with Letnia outside that tree and with slugs hard-coded in places.

**Choice.**
- **Tournament.** Every row that belongs to a tournament carries its `tournament_id`. The id is permanent and opaque. The slug is a changeable, unique name.
- **Organization.** Every tournament belongs to an organization: name, branding defaults, plan, members. Editions of one league (pdl, pdl-s2) are tournaments of one organization that share a `series_id`; this replaces deriving "series" from slug prefixes. The import creates one organization per current organizer.
- **Global data** is only what really is global: users and their links, player profiles keyed by Steam id, organizations, domains, jobs, bot accounts.
- **Letnia is an ordinary tournament.** The import writes it into the same tables with the slug `letnia`. There is no legacy layout, no `null` tournament id and no `isLegacyTournament` in the new code.

**Isolation rules.**
1. Every query and command takes a `tournamentId`, and every statement filters by it. Foreign keys between tournament tables include `tournament_id`, so a row cannot point at another tournament's row. A test walks the schema and fails if a tournament table lacks the column.
2. No code branches on a slug or a tournament id. Behaviour differences are fields on the tournament (format, features, scoring preset).
3. Statements across tournaments exist only in platform jobs and are limited to due work (ADR-09, ADR-10).
4. Shared resources have per-tournament limits: the rules assistant quota, bot accounts, job concurrency. One tournament cannot starve the rest.
5. A tournament can be exported to a file and imported again, by one tool (WP-36). This is the backup of a single tournament, the way to copy a real tournament to staging, and what makes a later move to another region possible (ADR-17).

**Why not a database per organizer.** It would multiply migrations, connections and costs for no gain at this size.

**Cost.** The isolation rests on every statement carrying the filter. The query layer builds it in (a helper that scopes a table to a tournament), and the schema test and the command tests ("an id from another tournament is not found") guard it.

---

#### ADR-06. One permission function, roles stored as memberships

**Context.** B4. Roles exist as scattered documents; `role: 'owner'` is written and never read.

**Choice.**

| Role | Scope | Stored in | Can |
|---|---|---|---|
| Platform admin | everything | `users.platform_role` | everything, including bot accounts and other organizations |
| Organization owner | one organization | `organization_members`, role `owner` | billing, domains, members, deleting tournaments |
| Organization admin | one organization | same, role `admin` | create and manage all its tournaments |
| Tournament admin | one tournament | `tournament_members`, role `admin` | everything inside that tournament except its admins and deletion |
| Tournament referee | one tournament | same, role `referee` | matches, results, stand-ins, schedule |
| Caster | one tournament | same, role `caster` | caster tools |
| Captain | one team | `teams.captain_user_id` | own roster, reschedule requests, stand-in requests |
| Signed-in user | self | `users` | own fantasy, pick'em, cards, profile |

- One function decides: `authorize(actor, action, scope)`. Actions are a fixed list of strings (`'match.setResult'`, `'tournament.editTheme'`). The table from role to actions is one file. S2 may rename or split roles; the mechanism does not change.
- Memberships are rows, not custom claims in the sign-in token. Claims are limited in size and go stale until the token refreshes; a user may be in many tournaments.
- The actor comes from the Firebase ID token in the `Authorization` header. The token is verified with a small library against Google's public keys, so ordinary requests do not load the Firebase Admin SDK. The `session` cookie is removed: nothing reads it, and cookies would make pages uncacheable.
- Anyone may create an organization and a tournament once the platform is public. Until then a platform setting keeps creation to an allowlist.
- Every command writes an audit row: who, what, when, on which tournament.

**Why.** One place to read, test and change. Permission bugs so far all came from checks written per route.

**Cost.** The referee role and the organization level are new UI, which S2 designs.

---

#### ADR-07. All writes go through commands; the browser has no database access

**Context.** B2, B3, B4.

**Term.** A *command* is a server function that changes data. It always does the same steps: parse the input with a schema, authorize, run domain logic, write in a transaction, record an audit row, invalidate cache tags, enqueue jobs.

**Options.**
1. Keep browser writes and harden the rules. Rules cannot express most business logic (deadlines, formats, "only the reschedule field"), and they cannot invalidate a cache or start a job.
2. Server actions. Convenient, but their ids change with each deploy, they need an allowlist of origins that would have to include every organizer domain, and their ease of export is what produced B3.
3. Route handlers under `/api/v1/`, each defined through one helper, called from the client with the ID token.

**Choice.** Option 3. `defineCommand({ input, action, scope, handler })` produces the route handler. `'use server'` is a lint error.

**What replaces the security rules.** Nothing has to: the browser cannot reach PostgreSQL, so there is no rule file to get wrong. The one place the browser still talks to Firebase directly is file upload, and that goes through an upload address issued by a command, so `storage.rules` can deny all client writes.

**Why.** Validation, permission, audit and cache invalidation happen in one place for every write. Domain logic moves out of 2,000-line components into functions that tests can call.

**Cost.** This is the largest part of the work: the 165 browser write sites become commands. The old admin tabs are not converted. S2 designs the new admin screens, and they are built on the commands directly, so no screen is built twice. A write now takes a round trip through the server where it was direct before; optimistic UI covers the difference.

---

#### ADR-08. Theme tokens rendered on the server; domains resolved in middleware; language set per tournament

**Context.** The theme is applied by a client effect, with a session cache and an inline script to hide the flash. There is no custom-domain support at all. Sign-in is tied to a hard-coded list of origins.

**Theming.**
- The theme is a validated set of tokens (colours, fonts, radius, background, navbar style, hero layout) with a version number. The server turns it into CSS variables inside the tournament layout's HTML. The inline script, the session cache and the font gate go away.
- Fonts are declared with `font-display: swap` and a preload for the heading font. Text is never hidden while a font loads.
- Guard rails are part of the schema: minimum contrast between text and background, limits on sizes. A theme that fails cannot be published. S2 designs what organizers can change and how they preview it; this record fixes only the mechanism.
- No component may hard-code a colour that a theme should control, and none may branch on a slug.

**Custom domains.**
- The `domains` table maps a hostname to a tournament or an organization, with a verification state.
- Middleware reads the Host header. On an organizer's domain it rewrites `/teams` to `/{slug}/teams` internally. On the platform domain, paths keep their `/{slug}` prefix.
- All internal links are built by one helper that knows which form applies.
- The organizer adds a DNS record; the platform attaches the domain to the hosting project through its API and shows the state.
- Free subdomains (`{slug}.dota2inhouse.pl`) are possible the same way with one wildcard record. This is offered as a product option to S2 and S4, not built first.

**Sign-in on any domain.** Discord sign-in already works by redirecting to our own endpoint and returning a Firebase custom token in the URL fragment with a nonce. That becomes the one sign-in path for every provider: the organizer's domain sends the user to the platform domain, the user signs in there (Discord or Google), and comes back with a custom token. The allowed return origins are looked up in `domains`. No per-domain setup at Discord, Google or Firebase is needed.

**Language.** The language is a column on the tournament (`locale`, default `pl`). The cookie read is removed. An English tournament is an English site; a per-visitor language switch is not offered. The second, older translation system (`lib/translations.ts`) is folded into the `messages/*.json` files.

**Why.** Each of the three removes a per-request input (session storage, cookie, hard-coded origin) that today prevents caching or multi-domain use.

**Cost.** The link helper touches many files. The sign-in change must be tested carefully. A visitor cannot choose a language different from the tournament's; nobody can today either.

---

#### ADR-09. Background work is a job queue in the database

**Context.** B7.

**Choice.**
- One table, `jobs`: `type`, `tournament_id`, `payload`, `run_at`, `status`, `attempts`, `dedupe_key`, `last_error`.
- A command or the bot inserts a job. A unique index on `dedupe_key` for waiting jobs means ten games in a minute cause one recompute.
- A runner endpoint claims due jobs with `FOR UPDATE SKIP LOCKED`, which is PostgreSQL's built-in way for several runners to share a queue without taking the same row. It runs them inside a time budget, several tournaments in parallel, one job per tournament at a time.
- **The scheduler is the database.** Every minute `pg_cron` checks whether a job is due and, only if one is, calls the runner endpoint (`pg_net`). An idle platform makes no function calls. An insert also calls the runner at once, so a result is processed in seconds.
- Failures retry with growing delays and end in a `failed` state that raises an alert (ADR-13).
- Job types at the start: `import-results`, `apply-forfeit`, `recompute`, `send-reminder`, `refresh-avatars`.
- **Nothing loops over tournaments.** Work that is due at a time (a reminder one hour before a match, a retry of an unparsed game in ten minutes) is a job with a `run_at`.

**Options not chosen.** Google Cloud Tasks or a hosted queue (a second system to pay for, operate and fake in tests). The hosting platform's cron (once a day on the free plan). Running jobs inside the bot's container (would tie result processing to the Steam worker's health and deploys).

**Why.** One visible list of what is waiting, running and failed, per tournament. One slow import no longer blocks the others. No new service.

**Cost.** Every job must be safe to run twice; a test per job type proves it. The scheduler depends on two database extensions; if the database host ever changes, any process that can call a URL each minute replaces them.

---

#### ADR-10. The bot: source under control, a written contract, its own corner of the database

**Context.** B5, B6, and the pool of Steam accounts as the hard limit on concurrent lobbies.

**Choice.**

1. **Source.** The hand-written files move to `bot-worker/src/` as TypeScript, first with behaviour unchanged. The Docker build compiles them. `dist/` leaves git. The existing dry-run scripts become real tests with a fake Dota client.
2. **Contract.** A folder `contract/` at the repository root holds the schemas of everything the two sides exchange: lobby session request and state, game reports, worker heartbeat. Both sides import it. Each schema has a version. A change that is not backward compatible fails a test.
3. **The bot's own tables, enforced by the database.** The bot connects with a database role that can read and write only the `bot` schema and insert jobs. It cannot read teams, matches or tournaments, so the website's schema can change freely. Today that separation is a hope; here the database refuses anything else.
4. **Self-contained lobby requests.** A `lobby_sessions` row carries everything the runner needs: rosters with Steam ids, stand-ins, casters, lobby settings, series format, and the time to create the lobby. The website writes and updates it. The duplicate scheduling rule and the dead `botCommands` writes disappear.
5. **Results come back as facts.** The runner reports "game N of session S ended, Dota match id M" by inserting a job. The website alone decides scores and series completion.
6. **Due-work scheduling.** The bot asks one question on a short interval: which sessions are due and unclaimed? It claims them with `SKIP LOCKED`. Idle tournaments cost nothing.
7. **Accounts.** Passwords and Steam Guard secrets are encrypted with a key held in the bot's environment, never stored readable. When no account is free, the session waits visibly and the organizer and platform admin are told.
8. **Scaling out.** Because claiming is a database lock, running more workers raises capacity without new code. How many lobbies one worker can hold is not known; it is measured before more is built (WP-23).
9. **The old bot keeps running the old site's matches** until those tournaments finish. The new bot is a second Railway service with its own Steam accounts.

**Why the database as the transport, and not an HTTP API on the website.** The bot writes lobby state often and must keep working while the website deploys. A direct connection with a narrow role is simpler and has one less thing that can be down.

**Cost.** The conversion to TypeScript touches the code that runs live matches. It is done in small steps, each proven by the dry-run tests and one test lobby. Two bots run for a while, so the Steam accounts are split between them.

**A limit this design does not remove.** Each concurrent series needs one Steam account, and Valve limits how fast an account can create lobbies. A thousand tournaments playing on the same evening need hundreds of accounts. Whether Valve tolerates that is a business risk for S4, not an engineering one.

---

#### ADR-11. Results, standings, stats, fantasy and pick'em are one pipeline, and ranking rules are data

**Context.** B8. An explorer counted nine places that order a table today, with different rules, and found that nothing about ranking is configurable: points are 2/1/0 in code, and teams are placed into playoff slots by hand from a dropdown. The owner wants organizers to choose which tie-breakers apply and in which order, to use tiebreaker matches, and to rank teams from different groups against each other for playoff places and seeding.

**Choice.** Two features with one flow between them.

```
sources                 results                      stats
(bot report,     ->  recordGame()  ->  invalidate ->  computeTournament()
 Steam league,       forfeit()         tags, job      pure function of the tournament's
 OpenDota,           editResult()      for side       matches, games and performances;
 manual entry)       deleteGame()      effects        runs inside cached queries
```

- **`results`** owns matches, games and performances. Every way a result can change goes through its commands: a saved game, a forfeit, a manual correction, a deletion, a ban. The pure parts that exist today inside `pdl-admin-actions.ts` are extracted and tested: matching a Dota game to teams by player ids, choosing the match, deciding series completion.
- **`stats`** owns everything derived. `computeTournament(input)` is a pure function. It returns standings, per-player and per-team aggregates, performance scores and rankings, fantasy points and leaderboards, and pick'em scores. It is the only implementation of each.
- **Fantasy points** have one function, `scoreFantasy(performance, scoring)`. `scoring` is a named preset on the tournament (`pdl-flat`, `role-based`), so past seasons keep their numbers.
- **A tournament without a Steam league id cannot sync**, and says so. The fallback to Letnia's league is removed.
- **Removed:** every stats calculator, `post-sync-recalculations.ts`, `fantasy-scoring-admin.ts`, and all stored statistics. Nothing derived is stored (ADR-02).

**Ranking rules.** Each stage stores its rules as data:

```
ranking: {
  points:      { win: 2, draw: 1, loss: 0 },
  tiebreakers: ['head_to_head', 'game_difference', 'neustadtl', 'tiebreak_match', 'manual'],
}
advancement: [
  { from: { group: 'A', place: 1 },              to: { stage: 'playoffs', slot: 'UB-R2-1' } },
  { from: { place: 3, best: 2, by: [...] },      to: { stage: 'playoffs', slot: 'LB-R1-4' } },
]
```

- **A catalogue of tie-breakers,** each a small pure function: head-to-head (a real mini-table among the tied teams), game difference, games won, Neustadtl, Buchholz (Swiss), lower team MMR, tiebreaker match, manual decision. The organizer picks which apply and their order. The rules are applied in order to each set of tied teams, and again inside any subset that is still tied.
- **Tiebreaker match.** When this rule is reached and teams are still tied, the standings mark the tie as open and the organizer gets one action that creates the match or matches. Its result orders the teams and does not count as points. An option limits this to ties that decide something (a playoff place, relegation, a prize).
- **Manual decision.** The organizer orders the tied teams by hand, with a reason, recorded in the audit log.
- **Still tied after every rule:** the teams share the place on the page. Where an advancement rule needs an order, the organizer is asked; nothing is decided silently.
- **Ranking across groups.** An advancement entry can say "the best two third-placed teams". Those teams are compared by a list of rules that make sense across groups: points per match, game difference per match, games won per match, tiebreaker match, manual.
- **From places to bracket slots.** The advancement list maps each place to a bracket slot, so a first place can enter in a later round or in the upper bracket, and a fourth place in the lower bracket. Seeding is the same list. The bracket generator takes this list as its input; today it takes only a team count.
- **Defaults reproduce what each tournament shows today.** Where two pages disagree today, the division table's order is the default.
- S2 designs how an organizer sets this up (presets such as "top two per group", "top two plus best thirds", and a custom editor). WP-13 and WP-34 build the rules.

**Why compute on read.** A season is 100-300 games, about 3,000 performance rows. PostgreSQL returns them in a few milliseconds, and the result is cached until the next change. There is no stored copy to drift, and a fix to a formula applies to every past season at once.

**Cost.** Fantasy and pick'em scoring are new behaviour, because today they do nothing outside Letnia. Which scoring rules they use is a product decision (question 8).

---

#### ADR-12. Caching, layer by layer

| Layer | Holds | Lifetime | Invalidated by |
|---|---|---|---|
| CDN | HTML and navigation payloads of public pages; images | until invalidated | the tag of the data shown |
| Server data cache | results of cached queries, tagged per tournament and kind | until invalidated | commands, jobs |
| Browser | per-user data fetched after load; nothing public | the visit | — |

- Kinds of tag: `core` (tournament, theme, navigation), `teams`, `matches`, `standings`, `bracket`, `content` (rules, news, prizes), `stats`, `fantasy`. They are defined in one file.
- A page lists the tags of the queries it uses; nothing else is needed to keep it fresh.
- Responses that depend on the user are never cached by the CDN and never share a URL with public data.
- No client polls an endpoint that renders a page (ADR-16).
- Rate limits and the rules-assistant quota move from instance memory to a table, keyed per tournament. The client address comes from the forwarding header that the front proxy sets, read in one helper.

---

#### ADR-13. Observability

**Choice.**
- **Errors.** Sentry in the browser, the server and the bot. Every event carries the release (git commit), the tournament id and the user id.
- **Logs.** One `log` helper that writes structured lines (`event`, `tournamentId`, fields). `console.log` is a lint error in new code.
- **Jobs.** The `jobs` table is the record. A platform-admin page lists waiting, running and failed jobs per tournament.
- **Bot.** A heartbeat row per worker. A job checks it and alerts when it is stale, when a session waits too long for an account, or when a runner gives up.
- **Alerts** go to a private Discord channel through a webhook: failed jobs, stale heartbeat, result import failing for a tournament, error rate, and usage of a free plan passing 70% of a limit.
- **Uptime.** An external check on the home page of one tournament and on a health endpoint.
- **Audit.** The `audit_log` table, written by every command.
- **Performance.** Real-user web vitals reported per route.

**Cost.** A Sentry account (the free plan is enough to start) and a Discord webhook, both created by the owner. The owner agreed (question 9).

---

#### ADR-14. Module boundaries

**Choice.** One repository, three parts: the web app (`src/`), the bot (`bot-worker/`), and the contract between them (`contract/`).

Inside `src/`:

```
src/
  app/                 routes only: pages, layouts, route handlers. Thin.
  features/<name>/     one folder per product area
    domain/            pure logic. No database, no Next, no React.
    queries.ts         cached reads (server only)
    commands.ts        writes (server only)
    components/        React components of this feature
    index.ts           what other features may import
  platform/            shared server machinery: db (schema, migrations, client),
                       auth, authorize, cache, jobs, log, errors, http
  ui/                  design-system components without business knowledge
```

Features: `tournaments` (lifecycle, settings, theme, domains), `organizations`, `accounts`, `teams` (registration, rosters, stand-ins, transfers), `schedule`, `formats` (stages, standings, ranking rules, brackets, Swiss), `results`, `stats` (with fantasy and pick'em scoring), `fantasy` and `pickem` (the viewer side), `cards`, `casters`, `notifications`, `content` (rules, news, prizes, rules assistant), `lobby` (the website's side of the bot), `draft-prep`.

Rules of dependency:
1. `app` imports features and `ui`. It contains no database call and no business rule.
2. A feature imports `platform`, `ui`, and other features only through their `index.ts`.
3. `domain/` imports nothing but other `domain/` code and plain libraries.
4. Only `platform/db` and the features' `queries.ts` and `commands.ts` touch the database. No file imports `firebase/firestore`. Firebase Auth and Storage are imported only in `platform/auth` and `platform/files`.
5. `platform` imports no feature.

A lint rule enforces all five. Old code in `src/lib` and `src/components` is exempt until it is replaced, and it only shrinks: new code never goes there.

**Why features and not layers.** A change to "stand-ins" should touch one folder. Today it touches `lib`, `components`, `app/api`, `server` and the rules file.

**Cost.** Old and new code live side by side on the `overhaul` branch until each area is replaced; the old half is deleted with the work package that replaces it.

---

#### ADR-15. Environments, and going live one tournament at a time

**Context.** B9. The owner decided that production does not change until the new platform is ready. With a new database, a gradual change of the live site would also need every write to go to two databases at once. So the new platform is built beside the old site.

**Environments.**

| Environment | Database | Web app | Sign-in and files | Bot |
|---|---|---|---|---|
| Local and CI | in-process PostgreSQL (PGlite), seeded | `next build` + `next start` | Firebase Auth and Storage emulators, or fakes | fake Dota client |
| Staging | Supabase project 2 | Vercel preview deployments | staging Firebase project | a small worker, on when needed |
| New production | Supabase project 1 | Vercel production deployment | the existing Firebase project | new Railway service |
| Old production | Firestore | Firebase Hosting, as today | the existing Firebase project | the existing Railway service |

- **Deploys come from git.** A push to a work-package branch gives a preview against staging. A merge to `overhaul` deploys new production once it exists. Database migrations run in CI with an approval step. Nobody deploys from a working copy, and no build reads a database.

**Going live.**
1. **Old production is frozen for features.** The production branch gets fixes only. Anything new is built on the new platform. Otherwise the two drift and the import tool chases a moving target.
2. **The new app sits in front.** The community site forwards to the new app. The new app serves the tournaments it has and forwards every other path to the old site, as the community site forwards to it today. Visitors and links see one site.
3. **Step one: the archive.** Letnia, which nobody can open today, and finished seasons are imported and served by the new platform. This puts the new stack in front of real visitors with nothing at stake, and it can happen as soon as the public pages are done (after M1).
4. **Step two: new seasons.** A new season is created on the new platform once organizers can run one there (after M3). A running season is not moved; it ends on the old site, or the owner moves it between match days with the same import tool.
5. **Step three: the old site retires.** When its last tournament has ended and been imported, the old hosting and the old bot are switched off. The Firestore data is kept as an export.

Rollback of any step is removing that tournament from the new database or switching the forwarding back; the old site and its data are untouched until step three.

- **Feature flags** are columns on the tournament or a platform settings row, read on the server.
- **Branches.** `overhaul` becomes the new production branch. After step three it is renamed `main` and `master` is retired (question 10; the owner asked to be reminded).

**Cost.** Two systems run side by side for a while, including two bots. Sign-in is shared (same Firebase project, same domain), so a user is signed in on both. Account links changed on one side appear on the other only after the next import run.

---

#### ADR-16. Live updates

**Context.** Some things should update without a reload: the state of a lobby before a match, notifications, live scores, a card duel. Firestore listeners did this; PostgreSQL has no browser listener, and rule 1 of ADR-04 keeps the browser away from the database.

**Choice.** A small JSON endpoint per live thing, cached for a few seconds and invalidated by the command or job that changes it. The page asks it on an interval only while the thing is live (a lobby is open, a match is being played) and while the tab is visible. Thousands of viewers of one match cost one database read every few seconds, because the CDN answers the rest. Per-user things (notifications) are fetched on page load and on focus, not on a timer.

**If that is not live enough** (S3 may want it for card duels): Supabase's Realtime service can push messages from the server to browsers without giving browsers database access. It is an addition to this design, not a change.

---

#### ADR-17. One region now; the design keeps a second one possible

**Context.** The owner would like organizers to choose the region of their tournament's database and hosting, because Dota players are spread over Europe, Russia, Peru and South-East Asia.

**What a region changes, and what it does not.**
- **Viewers do not feel the database's region.** Public pages are served by the CDN from a location near the viewer, wherever the database is. A viewer in Lima gets a cached page from a server in South America.
- **Players in a match do not feel it either.** Ping in the game depends on the Dota server region of the lobby, which is a lobby setting per tournament and has nothing to do with our database.
- **Organizers and captains feel it on writes.** Saving a change from Peru or Singapore to a database in Frankfurt adds about 0.2 to 0.3 seconds per action. That is noticeable and acceptable.

**Options.**
1. One region (Frankfurt).
2. A database and functions per region, with a global directory that says where each tournament lives.

**Choice.** Option 1 now. Option 2 when a real organizer far from Europe reports slow admin actions, or asks for data to stay in their region. Each extra region is a second database to pay for, migrate and back up, and data that spans tournaments (accounts, player profiles, cards) has to live in one place anyway.

**What keeps option 2 open.** A tournament's rows are a closed set: every one carries `tournament_id` and points only at its own tournament or at global tables. The export and import tool (ADR-05 rule 5) can lift a tournament out of one database and into another. The database client is obtained in one place (`platform/db`), which is where a per-tournament choice of database would go. Nothing else would change.

**What organizers can choose from the start:** the Dota server region for their lobbies, the time zone, and the language.

### 2.3 How the website and the bot talk

After ADR-09 and ADR-10 there are four exchanges, all through tables that the bot's role may use and all described in `contract/`:

| Direction | Where | Meaning |
|---|---|---|
| website → bot | `bot.lobby_sessions` (request columns) | "create this lobby at this time with these players and settings"; updated on reschedule, stand-in or caster change; cancelled by the website |
| bot → website | `bot.lobby_sessions` (state columns) | lobby state, ready check, current game, problems |
| bot → website | a row in `jobs` of type `import-results` or `apply-forfeit` | "game ended, Dota match id M" or "team T did not show" |
| bot → website | `bot.workers` | heartbeat and capacity |

The website never calls the bot, and the bot cannot read the website's tables. The Conductor's five-minute HTTP call disappears.

### 2.4 Cost

`COSTS.md` has the full report: what is paid today, what each phase adds, and what triggers each step. The short version, per month:

| Phase | What is true | New cost |
|---|---|---|
| Building | staging and previews exist; production unchanged | $0 |
| Archive and first seasons live, no income | new platform on free plans; old site winding down | $0 to $5 (a second small bot service) |
| Public launch, first income | paid hosting and database for backups and the commercial licence | about $45 to $70 |
| About 100 active tournaments | more bot capacity, a paid OpenDota key | about $80 to $130 |
| About 1,000 active tournaments | larger database, several bot workers, CDN usage | about $300 to $500, so $0.30 to $0.50 per tournament |

Why the cost per tournament is low and flat:

| Item | Today | Target |
|---|---|---|
| Database work per page view | 10 or more billed reads, plus the whole `tournaments` collection | none on a cache hit; no bill per read at all |
| Idle tournament | about 86,000 reads a month from the bot's polling | nothing |
| Stats | dataset rebuilt every 10 minutes per server instance | computed once after a change |
| Result import | sequential in one request for all tournaments | one job per tournament |

Three costs do not shrink with engineering and belong in S4's plan: Steam accounts for concurrent lobbies, OpenDota's rate limits (a paid key is needed beyond a few tournaments), and the Gemini rules assistant, whose shared daily cap must become a per-organization allowance.

### 2.5 What stays as it is

- Next.js, React, Tailwind, Firebase Auth, Firebase Storage, Railway for the bot, Bunny for video, the domain on the community site.
- The home page's design and the visual language of the teams, stats and schedule sections.
- The pure engines that are already good and tested or testable: Swiss pairing, reschedule rules, the card engine, the draft-prep engine, `stats-lab` derivations, the playoff bracket generator.
- The bot's lobby logic. It is converted to TypeScript and tested, not redesigned.
- The old site, its Firestore data and its bot, untouched, until its last tournament has ended.

## Sources for outside facts

Checked on 2026-11-13. Prices and plan limits change; re-check them when an account is created.

- [Vercel Hobby plan](https://vercel.com/docs/plans/hobby) — included usage, 50 domains per project, $20 per developer seat on Pro.
- [Vercel multi-tenant limits](https://vercel.com/docs/multi-tenant/limits) — custom domains per project by plan.
- [Vercel cron usage and pricing](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing) — once a day on Hobby.
- [Vercel: the CDN respects cache headers from external origins](https://vercel.com/changelog/vercels-cdn-now-respects-cache-control-headers-from-external-origins-by-default).
- [Supabase pricing](https://supabase.com/pricing) — free plan: 500 MB, two projects, paused after a week without activity, no backups; Pro from $25 with daily backups.
- [Neon plans](https://neon.com/docs/introduction/plans) — free plan: 100 compute hours per project, suspends after 5 minutes; Launch $0.106 per compute hour.
- [Railway pricing](https://docs.railway.com/reference/pricing/plans) — Hobby $5 a month including $5 of usage.
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits) — 100,000 requests a day on the free plan.
- [Firebase App Hosting custom domains](https://firebase.google.com/docs/app-hosting/custom-domain) — no documented support found for tag invalidation or for domains at this scale.
