# Architecture

Written in S1 (2026-11-13) by Fable. It describes how the product is built today, what is wrong with that, and how it should be built to serve thousands of tournaments, feel fast on every page, and stay readable and testable. The plan for getting there is in `ROADMAP.md`. Coding rules are in `CONVENTIONS.md`, and testing is in `TEST_STRATEGY.md`.

The facts come from the S0 inventories and from four explorer reports made in S1. The claims that decisions rest on were re-checked in the code by Fable; those are marked "(S1 checked)".

**The short version.** Today the server sends every visitor an empty page, and the browser then builds the page by reading the database directly. The browser also writes to the database directly, so the security rules are the only guard on most data. Background work is one HTTP call every five minutes that the bot makes to the website. The target turns each of these around:

1. The server renders every public page from cached per-tournament data, and a content delivery network (CDN) serves the result. Browsers stop reading Firestore for public pages.
2. Every write goes through one kind of server function that validates the input, checks permission, writes, and then invalidates the caches that changed.
3. Background work is a queue of jobs. Nothing loops over all tournaments.
4. Results, standings, stats and fantasy are computed in one place, by pure functions, after each saved game.
5. The website and the bot share one written contract, and the bot's source code is brought back under version control.

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

### 2.1 Why subpages are slow, and how every page becomes fast

**Why.** The home page and the subpages do the same slow work: wait for JavaScript, wait for the tournament document, then read Firestore from the browser. The home page hides it behind one loading screen that is also waiting for fonts and the hero video, and it pays once, because its sections switch without a page load. A subpage pays on every visit and shows a second loading screen. Deep links to stats, rankings and team pages pay twice, because they redirect to the home page after hydration. Details are in `inventory/PAGES.md` section 1.

**How it becomes fast.** The measurements already show the answer. The server renders the shell in 10-17 ms locally. A cached response from the CDN arrives in 0.16-0.23 s. So if the HTML contains the content and the CDN holds it, every page arrives complete in about 0.2 s, before any JavaScript runs.

The design, in order of effect:

1. **The server renders content.** `[tournamentSlug]/layout.tsx` becomes a server component. It loads the tournament once, writes the theme as CSS variables into the HTML, and sets the title and preview image. Pages are server components that load their data through cached query functions (ADR-02) and pass it to client components as props.
2. **No gate.** Content is in the first response, so there is nothing to wait for. The full-screen loading screen stays only where the owner wants it as a design element (the home page hero), and it never blocks content for longer than a set budget.
3. **Pages are cacheable.** The root layout stops reading a cookie (ADR-08 moves the language choice to the tournament). Pages become static per tournament and are regenerated when their data changes (ADR-02, ADR-12).
4. **The home page keeps its design.** The full-screen, snap-scrolling shell stays a client component. It receives teams, matches and standings from the server as props, where today it makes about ten browser reads. Sections that are heavy and below the first screen (stats hub, cards) still load on demand. `/stats`, `/rankings` and `/teams/[id]` render the same shell with the right section open, with no redirect.
5. **Navigation is prefetched.** With server-rendered pages, `<Link>` prefetches the next page's data. Moving between pages then feels like the home page's section switch.
6. **Less JavaScript.** Public pages do not import the Firestore browser SDK. The Auth SDK loads after the page is interactive. The budget is in `TEST_STRATEGY.md`.

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

**Why.** It is the only option that puts content in the first response, which fixes speed, search engines and link previews together. It also removes the reason for browsers to read Firestore, which is what lets the security rules shrink (ADR-07).

**Cost.** Each public page is rewritten from "component with an effect" to "server page plus client view". About 100 components read `useTournament()`; they keep working, because the provider stays and is seeded from the server's data. The work is page by page and each step can ship alone.

---

#### ADR-02. Cached query functions per tournament, and stored results only for expensive data

**Context.** Server rendering needs data that is fast to get and that changes when an organizer changes something.

**Terms.** A *query* is a server function that returns data for display, for example `getTeams(tournamentId)`. A *read model* is a result that is computed once and stored, for example the stats dataset.

**Options.**
1. Query Firestore on every request. Simple and always fresh, but 100-200 ms per read to the US and a cost per view.
2. Store a ready-made copy of every page's data and keep it in step with every write. Fastest reads, but every write path must maintain it, and today most writes come from the browser.
3. Wrap each query in the framework's data cache, tagged per tournament and per kind of data, and invalidate the tag when that data changes. Store a read model only where computing is expensive.

**Choice.** Option 3.

- Queries live in each feature's `queries.ts` and are wrapped by one helper: `cachedQuery(fn, { tags: ['t:{id}:teams'], revalidate: 300 })`.
- Every command (ADR-07) ends by invalidating the tags it touched.
- While some writes still come from the browser, two things keep data fresh: a 5-minute time limit on every cached query, and a small authenticated endpoint that the old admin tabs call after a save to invalidate a tag.
- Stored read models: the stats dataset, standings, and fantasy and pick'em leaderboards (ADR-11). They are rebuilt by a job after each saved game, never during a page view.
- Tournaments are found through two small index collections: `slugs/{slug}` and `domains/{hostname}`, each holding a tournament id. This replaces the three places that scan the whole `tournaments` collection, and it makes "is this slug free" a single transactional write.

**Why.** It needs no second copy of ordinary data, so there is nothing to drift. Freshness is exact for server writes and bounded at five minutes for the rest. It can be introduced one query at a time.

**Cost.** The data cache must be shared between server instances, or an invalidation reaches only one of them. That depends on the hosting choice (ADR-03). A wrong tag means stale data, so tags are defined once in one file and tested.

---

#### ADR-03. Host the web app on Vercel; keep Firebase for Auth, Firestore and Storage

**Context.** B9, B12. The target needs four things from hosting: a cache shared by all instances with invalidation by tag; a CDN that caches HTML; automatic deploys from git with a preview per branch; and TLS for thousands of organizer domains. Today's Firebase Hosting adapter gives none of the four. The domain is already on Vercel.

**Options.**
1. Stay on the Firebase Hosting frameworks adapter. No migration. Cache is per instance, deploys stay manual, and the adapter is the older product.
2. Move to Firebase App Hosting. Git deploys, same cloud. Tag invalidation across the CDN and custom domains at this scale are not documented as supported; this was searched for in S1 and not found.
3. Keep Cloud Run as the origin and use the Vercel community project as the CDN in front. Vercel now caches forwarded responses that carry cache headers and can purge them by tag. But organizer domains would hang on the community site's project, and deploys stay manual.
4. Deploy the web app as its own Vercel project. The community site keeps `dota2inhouse.pl` and forwards to it exactly as it forwards to Firebase today.

**Choice.** Option 4, confirmed by a measured trial before anything depends on it (WP-06).

**Why.**
- All four needs are standard features there. Vercel's documentation gives Pro projects unlimited custom domains with a soft limit of 100,000 per project, at no cost per domain.
- A preview deployment per branch, pointed at the staging Firebase project, is the staging environment (ADR-15).
- The cutover is one setting: the community site's `TOURNAMENT_ORIGIN`. Rollback is setting it back. The Firebase deployment can stay alive beside it until the new one is proven.
- The app code does not change shape. It is still a Next.js app that uses the Admin SDK with a service account, as it does now.

**Cost.**
- A Vercel Pro plan (about $20 per member per month plus usage; the owner must confirm the current price and which plan the community site is on, question 6).
- Server functions have a time limit, so long work must be a job (ADR-09). That is wanted anyway.
- Functions run in Europe and the database is in the US until ADR-04 is carried out. This matters only when the cache misses.
- More dependence on one vendor for hosting. The way back is Cloud Run with a custom cache handler, and nothing in this design prevents it.

**If the trial fails or the owner declines.** Fall back to option 1 with time-based CDN caching only (`s-maxage` on pages, no purge). Pages are still fast, and an organizer's change takes up to a minute to appear. Custom domains then need another front (option 3 or Cloudflare).

---

#### ADR-04. Stay on Firestore; move it to a European database before the public launch

**Context.** B13. Also: is a document database still the right store for a multi-tenant platform?

**Options.**
1. Stay on Firestore where it is.
2. Stay on Firestore and move the data to a new database in Europe (`eur3`) inside the same project. Firestore supports several databases per project. A location cannot be changed in place; the move is an export and an import.
3. Move to PostgreSQL.

**Choice.** Option 2. Staying on Firestore is firm. The move to Europe is recommended and is the owner's decision (question 7), because it needs a short write freeze.

**Why stay on Firestore.** The data is naturally one tree per tournament, which is exactly the isolation the platform needs. Two years of data, rules and bot logic are built on it. Real-time listeners are useful for duels and lobby status. When public pages are cached, its cost per tournament is cents (section 2.4). PostgreSQL would be a rewrite of everything for benefits (joins, ad-hoc reporting) that the read models and a later analytics export cover.

**Why move to Europe.** After caching, the database's distance is felt on every write and every cache miss: 100-180 ms per operation, where a database in the same region answers in about 10-20 ms. Organizer actions and card duels are the interactions that must feel instant. Data kept in the EU is also an argument when selling to schools, universities and companies. The move is cheapest now, with four tournaments.

**How.** The database id comes from one environment variable on the website and the bot. The staging project is created in `eur3` from the start. The move is rehearsed on a copy, then done in a quiet hour: freeze writes, export, import, switch the variable, check, unfreeze. Rollback is switching back; the old database is kept unchanged.

**Cost.** One maintenance window of about 30-60 minutes. Indexes and rules must be deployed to the new database. Until the move, everything works as now.

---

#### ADR-05. The tournament is the unit of isolation; organizations sit above it

**Context.** Tenancy today is "a tournament document plus subcollections", with Letnia outside that tree and with slugs hard-coded in places.

**Choice.**
- **Tournament.** All data of a tournament lives under `tournaments/{tournamentId}/`. The id is permanent and opaque. The slug is a changeable name in `slugs/{slug}`.
- **Organization.** New collection `organizations/{orgId}`: name, branding defaults, plan, members. Every tournament has an `orgId`. Editions of one league (pdl, pdl-s2) are tournaments of one organization that share a `seriesId`; this replaces deriving "series" from slug prefixes. `organizerId` stays readable during the change.
- **Global data** is only what really is global: accounts and their links, player profiles keyed by Steam id, bot accounts and sessions, jobs, the two index collections.
- **Card game data** is keyed by tournament today (`cardCollections/{key}__{uid}`). It keeps its place; S3 decides whether collections become per organization.
- **Letnia moves in.** Its root collections are copied to `tournaments/{letniaId}/...` by a migration script. After that there is no `null` tournament id and no `isLegacyTournament`.

**Isolation rules.**
1. Every query and command takes a `tournamentId` and builds paths through one path module. Raw `collection('tournaments')` strings outside the data-access layer are a lint error.
2. No code branches on a slug or a tournament id. Behaviour differences are fields on the tournament (format, features, scoring preset).
3. Queries across tournaments exist only in platform jobs, use an indexed collection-group query, and are limited to due work (ADR-09, ADR-10).
4. Shared resources have per-tournament limits: the rules assistant quota, bot accounts, job concurrency. One tournament cannot starve the rest.

**Why not a database or project per organizer.** It would multiply deploys, indexes and costs for no gain at this size. Path-based isolation, enforced in one layer and tested, is enough.

**Cost.** One additive migration for organizations, one for Letnia, and one for the slug index. Old and new code both work during each (the brief's rule).

---

#### ADR-06. One permission function, roles stored as memberships

**Context.** B4. Roles exist as scattered documents; `role: 'owner'` is written and never read.

**Choice.**

| Role | Scope | Stored at | Can |
|---|---|---|---|
| Platform admin | everything | `admins/{uid}` | everything, including bot accounts and other organizations |
| Organization owner | one organization | `organizations/{orgId}/members/{uid}` with `role: 'owner'` | billing, domains, members, deleting tournaments |
| Organization admin | one organization | same, `role: 'admin'` | create and manage all its tournaments |
| Tournament admin | one tournament | `tournaments/{id}/admins/{uid}` with `role: 'admin'` | everything inside that tournament except its admins and deletion |
| Tournament referee | one tournament | same, `role: 'referee'` | matches, results, stand-ins, schedule |
| Captain | one team | `captainId` on the team | own roster, reschedule requests, stand-in requests |
| Caster | one tournament | `tournaments/{id}/casters/{uid}` | caster tools |
| Signed-in user | self | account | own fantasy, pick'em, cards, profile |

- One function decides: `authorize(actor, action, scope)`. Actions are a fixed list of strings (`'match.setResult'`, `'tournament.editTheme'`). The table from role to actions is one file. S2 may rename or split roles; the mechanism does not change.
- Memberships are documents, not custom claims. Claims are limited in size and go stale until the token refreshes; a user may be in many tournaments.
- The actor comes from the Firebase ID token in the `Authorization` header, as `requireAdmin` does now. The `session` cookie is removed: nothing reads it, and cookies would make pages uncacheable.
- Anyone may create an organization and a tournament once the platform is public. Until then the creator allowlist stays.
- Every command writes an audit entry: who, what, when, on which tournament.

**Why.** One place to read, test and change. Permission bugs so far all came from checks written per route.

**Cost.** Every route moves to the helper (WP-01 does the dangerous ones first). The referee role and the organization level are new UI, which S2 designs.

---

#### ADR-07. All writes go through commands; browsers stop writing Firestore

**Context.** B2, B3, B4.

**Term.** A *command* is a server function that changes data. It always does the same steps: parse the input with a schema, authorize, run domain logic, write, record an audit entry, invalidate cache tags, enqueue jobs.

**Options.**
1. Keep browser writes and harden the rules. Rules cannot express most business logic (deadlines, formats, "only the reschedule field"), and they cannot invalidate a cache or start a job.
2. Server actions. Convenient, but their ids change with each deploy, they need an allowlist of origins that would have to include every organizer domain, and their ease of export is what produced B3.
3. Route handlers under `/api/v1/`, each defined through one helper, called from the client with the ID token.

**Choice.** Option 3. `defineCommand({ input, action, scope, handler })` produces the route handler. `'use server'` is a lint error outside a short allowlist that shrinks to zero.

**Rules, in step with the code.** Rules tighten as each area moves to commands. The end state: clients may read their own private documents and the few documents that need live updates; clients may write nothing. Public data is not read from the browser at all, so its read rules can close too.

**Why.** Validation, permission, audit and cache invalidation happen in one place for every write. Domain logic moves out of 2,000-line components into functions that tests can call.

**Cost.** This is the largest part of the work: 165 browser write sites. It is done area by area, captain flows first (highest risk), admin areas together with S2's new admin panel so screens are not rebuilt twice. A write now takes a round trip through the server where it was direct before; optimistic UI covers the difference.

---

#### ADR-08. Theme tokens rendered on the server; domains resolved in middleware; language set per tournament

**Context.** The theme is applied by a client effect, with a session cache and an inline script to hide the flash. There is no custom-domain support at all. Sign-in is tied to a hard-coded list of origins.

**Theming.**
- The theme is a validated set of tokens (colours, fonts, radius, background, navbar style, hero layout) with a version number. The server turns it into CSS variables inside the tournament layout's HTML. The inline script, the session cache and the font gate go away.
- Fonts are declared with `font-display: swap` and a preload for the heading font. Text is never hidden while a font loads.
- Guard rails are part of the schema: minimum contrast between text and background, limits on sizes. A theme that fails cannot be published. S2 designs what organizers can change and how they preview it; this record fixes only the mechanism.
- No component may hard-code a colour that a theme should control, and none may branch on a slug (the postponed theme-colour audit becomes part of this work).

**Custom domains.**
- `domains/{hostname}` maps a hostname to a tournament or an organization, with a verification state.
- Middleware reads the Host header. On an organizer's domain it rewrites `/teams` to `/{slug}/teams` internally. On the platform domain, paths keep their `/{slug}` prefix.
- All internal links are built by one helper that knows which form applies. Hard-coded `/${slug}/...` strings are replaced.
- The organizer adds a DNS record; the platform attaches the domain to the hosting project through its API and shows the state.
- Free subdomains (`{slug}.dota2inhouse.pl`) are possible the same way with one wildcard record. This is offered as a product option to S2 and S4, not built first.

**Sign-in on any domain.** Discord sign-in already works by redirecting to our own endpoint and returning a Firebase custom token in the URL fragment with a nonce. That becomes the one sign-in path for every provider: the organizer's domain sends the user to the platform domain, the user signs in there (Discord or Google), and comes back with a custom token. The allowed return origins are looked up in `domains/` in place of the hard-coded list. No per-domain setup at Discord, Google or Firebase is needed.

**Language.** The language is a field on the tournament (`locale`, default `pl`). The cookie read is removed. An English tournament is an English site; a per-visitor language switch is not offered. The second, older translation system (`lib/translations.ts`) is folded into the `messages/*.json` files.

**Why.** Each of the three removes a per-request input (session storage, cookie, hard-coded origin) that today prevents caching or multi-domain use.

**Cost.** The link helper touches many files. The sign-in change must be tested carefully on the live domain. A visitor cannot choose a language different from the tournament's; nobody can today either.

---

#### ADR-09. Background work is a job queue

**Context.** B7.

**Choice.**
- One collection, `jobs/{id}`: `type`, `tournamentId`, `payload`, `runAt`, `status`, `attempts`, `dedupeKey`, `lastError`.
- A command or the bot enqueues a job. A job with the same `dedupeKey` that is still waiting is not added twice (for example `recompute:{tournamentId}`), so ten games in a minute cause one recompute.
- A runner endpoint claims due jobs in a transaction and runs them with a time budget, several tournaments in parallel, at most one job per tournament at a time. A scheduler calls it every minute, and an enqueue also pokes it at once, so a result is processed in seconds, not minutes.
- Failures retry with growing delays and end in a `failed` state that raises an alert (ADR-13).
- Job types at the start: `import-results`, `recompute`, `send-reminder`, `settle-duel`, `round-rewards`, `refresh-avatars`.
- **Nothing loops over tournaments.** Work that is due at a time (a reminder one hour before a match, a retry of an unparsed game in ten minutes) is a job with a `runAt`. Sweeps that must exist use one indexed query for due items.
- The scheduler is replaceable: the Conductor's existing call at first, then the hosting platform's cron.

**Options not chosen.** Google Cloud Tasks (good, but a second system to operate and to emulate in tests). Running jobs inside the bot's container (would tie result processing to the Steam worker's health and deploys).

**Why.** One visible list of what is waiting, running and failed, per tournament. One slow import no longer blocks the others.

**Cost.** Every job must be safe to run twice. The existing import already is (it checks `processedGames`); this becomes a written rule with a test per job type.

---

#### ADR-10. The bot: source under control, a written contract, due-work scheduling, room to scale out

**Context.** B5, B6, and the pool of Steam accounts as the hard limit on concurrent lobbies.

**Choice.**

1. **Source.** The hand-written files move to `bot-worker/src/` as TypeScript, first with behaviour unchanged. The Docker build compiles them. `dist/` leaves git. The existing dry-run scripts become real tests with a fake Dota client.
2. **Contract.** A folder `contract/` at the repository root holds schemas for every document the two sides exchange: lobby session, sync task, bot config, bot account status. Both sides import it. Each schema has a version field. A change that is not backward compatible fails a test (see `TEST_STRATEGY.md`).
3. **Self-contained lobby requests.** The session document carries everything the runner needs: the rosters with Steam ids, stand-ins, casters, lobby settings, series format. The website writes and updates it. The bot stops reading tournament, team and match documents, so the website's schema can change freely. The dead `botCommands` writes and the duplicate scheduling rule on the website are deleted.
4. **Results come back as facts.** The runner reports "game N of session S ended, Dota match id M" (as `botSyncTasks` does today, renamed into the job queue). The website alone decides scores and series completion.
5. **Due-work scheduling.** The Conductor stops reading all tournaments each minute. The website creates the lobby session when a match gets or changes its time, with a `createAt` time. The Conductor makes one indexed query for sessions that are due. Idle tournaments cost nothing.
6. **Accounts.** Passwords and Steam Guard secrets are encrypted with a key held in the bot's environment, never in Firestore. Accounts belong to a pool; the platform pool is the default, and an organization can later bring its own pool. When no account is free, the session waits visibly and the organizer and platform admin are told.
7. **Scaling out.** A worker claims sessions up to its own capacity in a transaction, as accounts are claimed today. Running more workers then raises capacity without new code. How many lobbies one worker can hold is not known; it is measured before this is built (WP-23).

**Why keep Firestore as the transport.** It is durable, both sides already use it, the bot needs no open port, and it can be tested on the emulator.

**Cost.** The conversion to TypeScript touches the code that runs live matches. It is done in small steps, each proven by the dry-run tests and one test lobby, with the previous image one click away on Railway.

**A limit this design does not remove.** Each concurrent series needs one Steam account, and Valve limits how fast an account can create lobbies. A thousand tournaments playing on the same evening need hundreds of accounts. Whether Valve tolerates that is a business risk for S4, not an engineering one.

---

#### ADR-11. Results, standings, stats, fantasy and pick'em are one pipeline

**Context.** B8.

**Choice.** Two features with one flow between them.

```
sources                 results                         stats
(bot report,     ->  recordGame()  ->  job: recompute  ->  computeTournament()  ->  stored read models
 Steam league,       forfeit()         (one per            pure function            - standings
 OpenDota,           editResult()      tournament,         of the tournament's      - stats dataset
 manual entry)       deleteGame()      deduplicated)       matches, games and       - fantasy leaderboard
                                                           performances             - pick'em leaderboard
```

- **`results`** owns matches, games and performances. Every way a result can change goes through its commands: a saved game, a forfeit, a manual correction, a deletion, a ban. Each ends by enqueuing `recompute`. The pure parts that exist today inside `pdl-admin-actions.ts` are extracted and tested: matching a Dota game to teams by player ids, choosing the match, deciding series completion.
- **`stats`** owns everything derived. `computeTournament(input)` is a pure function. It returns standings, per-player and per-team aggregates, performance scores and rankings, fantasy points and leaderboards, and pick'em scores. It is the only implementation of each.
- **Standings** have one implementation per format (league and groups, Swiss), with the points and tie-break order as data on the tournament. The seven current copies are deleted. Both the division table and the stats hub read the stored result.
- **Fantasy points** have one function, `scoreFantasy(performance, scoring)`. `scoring` is a named preset on the tournament (`pdl-flat`, `role-based`), so past seasons keep their numbers. Points are computed from the stored raw performance at recompute time; the stored `fantasyPoints` field stops being the source.
- **The dataset** is built by the job and stored as a compressed file; the endpoint serves the file. No visitor waits for a rebuild.
- **Removed:** `comprehensive-stats-calculator.ts`, `stats-calculator-*`, `post-sync-recalculations.ts`, `fantasy-scoring-admin.ts`, the stored `playerStats`, `teamStats`, `stats/*` and `playerGameHistory` writes, and `performanceRankings` once the rankings view reads the dataset. Their data is left in place and no longer written.
- **A tournament without a Steam league id cannot sync**, and says so. The fallback to Letnia's league is removed.

**Why a full recompute per game.** A season is 100-300 games. Recomputing everything from stored games is simple, cannot drift, and costs about 1,500-9,000 document reads, which is under one cent. Incremental updates are an optimisation to make only if measurements ask for it; the first step then is to store each game's ten performances inside one document.

**Cost.** Fantasy and pick'em scoring are new behaviour, because today they do nothing outside Letnia. Which scoring rules they use is a product decision (question 8). Moving the admin stats tab to the new data is part of the work.

---

#### ADR-12. Caching, layer by layer

| Layer | Holds | Lifetime | Invalidated by |
|---|---|---|---|
| CDN | HTML and navigation payloads of public pages; the dataset file; images | until invalidated; at most 5 minutes while browser writes remain | the tag of the data shown |
| Server data cache | results of cached queries, tagged `t:{id}:{kind}` | same | commands, jobs |
| Stored read models | standings, dataset, leaderboards | until the next recompute | the `recompute` job |
| Browser | per-user data fetched after load; nothing public | the visit | — |

- Kinds of tag: `core` (tournament, theme, navigation), `teams`, `matches`, `standings`, `bracket`, `content` (rules, news, prizes), `stats`, `fantasy`. They are defined in one file.
- A page lists the tags of the queries it uses; nothing else is needed to keep it fresh.
- Responses that depend on the user are never cached by the CDN and never share a URL with public data.
- Polling endpoints (notification bell, duel lobby) are either replaced by a Firestore listener on the user's own document or made cheap and short-cached. No client polls an endpoint that renders a page.
- Rate limits and the rules-assistant cache move from instance memory to Firestore or the platform's shared store, keyed per tournament. The client address comes from the forwarding header that the front proxy sets, read in one helper.

---

#### ADR-13. Observability

**Choice.**
- **Errors.** Sentry in the browser, the server and the bot. Every event carries the release (git commit), the tournament id and the user id. `lib/error-reporting.ts` already has a pluggable provider; it gets one.
- **Logs.** One `log` helper that writes structured lines (`event`, `tournamentId`, fields). `console.log` becomes a lint error in new code.
- **Jobs.** The `jobs` collection is the record. A platform-admin page lists waiting, running and failed jobs per tournament.
- **Bot.** A heartbeat document per worker. A job checks it each minute and alerts when it is stale, when a session waits too long for an account, or when a runner gives up.
- **Alerts** go to a private Discord channel through a webhook: failed jobs, stale heartbeat, result import failing for a tournament, error rate.
- **Uptime.** An external check on the home page of one tournament and on a health endpoint.
- **Audit.** `tournaments/{id}/audit/{id}` written by every command.
- **Performance.** Real-user web vitals reported per route, so "is it fast" has a number that is watched, in place of a yearly audit.

**Cost.** A Sentry account (the free tier is enough to start) and a Discord webhook, both created by the owner (question 9).

---

#### ADR-14. Module boundaries

**Choice.** One repository, three parts: the web app (`src/`), the bot (`bot-worker/`), and the contract between them (`contract/`).

Inside `src/`:

```
src/
  app/                 routes only: pages, layouts, route handlers. Thin.
  features/<name>/     one folder per product area
    domain/            pure logic. No Firebase, no Next, no React.
    queries.ts         cached reads (server only)
    commands.ts        writes (server only)
    components/        React components of this feature
    index.ts           what other features may import
  platform/            shared server machinery: firestore, auth, authorize,
                       cache, jobs, log, errors, http
  ui/                  design-system components without business knowledge
```

Features: `tournaments` (lifecycle, settings, theme, domains), `organizations`, `accounts`, `teams` (registration, rosters, stand-ins, transfers), `schedule`, `formats` (groups, league, Swiss, playoffs), `results`, `stats` (with fantasy and pick'em scoring), `fantasy` and `pickem` (the viewer side), `cards`, `casters`, `notifications`, `content` (rules, news, prizes, rules assistant), `lobby` (the website's side of the bot), `draft-prep`.

Rules of dependency:
1. `app` imports features and `ui`. It contains no Firestore call and no business rule.
2. A feature imports `platform`, `ui`, and other features only through their `index.ts`.
3. `domain/` imports nothing but other `domain/` code and plain libraries.
4. Only `platform/firestore` and the features' `queries.ts` and `commands.ts` touch the Admin SDK. Only the few components that need live updates touch the browser SDK.
5. `platform` imports no feature.

A lint rule enforces all five. Old code in `src/lib` and `src/components` is exempt until it is moved, and it only shrinks: new code never goes there.

**Why features and not layers.** A change to "stand-ins" should touch one folder. Today it touches `lib`, `components`, `app/api`, `server` and the rules file.

**Cost.** Moving code is spread over the roadmap; each work package moves what it touches. A big-bang reorganisation is rejected: it would conflict with the owner's ongoing work on the production branch.

---

#### ADR-15. Environments and delivery

**Choice.**
- **Three environments.** Local (Firebase emulator, fixtures), staging (its own Firebase project, its own bot worker when needed), production.
- **Deploys come from git.** A push to a work-package branch gives a preview deployment against staging. A merge to the production branch deploys production. Firestore rules and indexes deploy from CI with a manual approval step. Nobody deploys from a working copy.
- **Builds never read production.** The sitemap is generated at request time and cached, so a build needs no credentials.
- **The production branch** stays `feature/multi-tournament-platform` until the overhaul is proven; then `overhaul` is merged into it. Renaming it to `main` afterwards is recommended (question 10).
- **Feature flags** are fields on the tournament or a platform config document, read on the server. New pipelines run beside the old ones on one tournament before the rest.

**Cost.** The owner creates the staging project and the accounts (`TEST_STRATEGY.md` lists exactly what). Hot fixes take a commit and a few minutes of CI, where before they were a command.

---

#### ADR-16. Live updates

**Context.** Some things should update without a reload: a card duel, the state of a lobby before a match, notifications, live scores.

**Choice.** A browser listener on one narrow document that the user is allowed to read (`cardDuels/{id}/views/{uid}` already works this way), or a short-cached public endpoint for things everyone sees (live score). Never a listener on a collection of public data, and never polling of a page-rendering route. The public lobby state for captains becomes a small document written by the website from the session; today the captain page queries `botLobbySessions`, which the rules deny for non-admins.

### 2.3 How the website and the bot talk

After ADR-09 and ADR-10 there are four exchanges, all through Firestore and all described in `contract/`:

| Direction | Document | Meaning |
|---|---|---|
| website → bot | `botLobbySessions/{id}` (request part) | "create this lobby at this time with these players and settings"; updated on reschedule, stand-in or caster change; cancelled by the website |
| bot → website | `botLobbySessions/{id}` (state part) | lobby state, ready check, current game, problems |
| bot → website | `jobs/{id}` of type `import-results` or `apply-forfeit` | "game ended, Dota match id M" or "team T did not show" |
| bot → website | `workers/{id}` | heartbeat and capacity |

The website never calls the bot, and the bot never reads the website's own collections. The Conductor's five-minute HTTP call disappears once the platform's own scheduler runs the jobs.

### 2.4 Cost per tournament

Estimates, using the S0 model tournament: 16 teams, 120 games a season, 2,500 page views a month. Firestore reads at $0.06 per 100,000.

| Item | Today | Target |
|---|---|---|
| Reads per page view | 10 or more, plus the whole `tournaments` collection (grows with platform size) | 0 on a cache hit |
| Page views, 1,000 tournaments, 2.5M views a month | about 2.5 billion reads, about $1,500 a month, and 19 MB per page load | about $0 in reads; hosting requests about $5 beyond the plan's allowance |
| Conductor idle cost | about 86,000 reads per tournament per month, active or not | 0 for an idle tournament |
| Stats | dataset rebuilt every 10 minutes per instance, about $4 per tournament per month per instance, plus a full aggregate rewrite per sync | one recompute per saved game, about 180,000 reads a season, about $0.11 |
| Result import | sequential in one request for all tournaments | one job per tournament; cost is the OpenDota and Steam calls |
| Variable cost per active tournament per month | not bounded | under $0.50, most of it video delivery (Bunny) if a hero video is used |
| Fixed platform cost per month | Firebase usage, Railway | hosting plan about $20, Railway worker(s), Firebase usage, error monitoring free tier; about $50-100 before bot scale-out |

Three costs do not shrink with engineering and belong in S4's plan: Steam accounts for concurrent lobbies, OpenDota's rate limits (a paid key is needed beyond a few tournaments), and the Gemini rules assistant, whose shared daily cap must become a per-organization allowance.

### 2.5 What stays as it is

- Next.js, React, Tailwind, Firestore, Firebase Auth, Firebase Storage, Railway for the bot, Bunny for video.
- The home page's design and the visual language of the teams, stats and schedule sections.
- The pure engines that are already good and tested or testable: Swiss pairing, reschedule rules, the card engine, the draft-prep engine, `stats-lab` derivations, the playoff bracket generator.
- The `/api/manage/*` routes that already use `requireAdmin`; they move into features over time without changing behaviour.
- The bot's lobby logic. It is converted to TypeScript and tested, not redesigned.

## Sources for outside facts

Checked on 2026-11-13. The Vercel price and the Firebase App Hosting gaps should be re-checked when the decision is made.

- [Vercel multi-tenant limits](https://vercel.com/docs/multi-tenant/limits) — custom domains per project by plan.
- [Vercel: the CDN respects cache headers from external origins](https://vercel.com/changelog/vercels-cdn-now-respects-cache-control-headers-from-external-origins-by-default) and [cache tags for external origins](https://vercel.com/kb/guide/how-to-manage-cache-tags-for-external-origins).
- [Vercel Pro plan](https://vercel.com/docs/plans/pro-plan).
- [Firestore: move data between databases](https://firebase.google.com/docs/firestore/manage-data/move-data) — a location cannot be changed in place; export and import.
- [Firebase App Hosting custom domains](https://firebase.google.com/docs/app-hosting/custom-domain) — no documented support found for tag invalidation or for domains at this scale.
