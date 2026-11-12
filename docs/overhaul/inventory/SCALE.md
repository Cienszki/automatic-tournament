# Scale inventory: cost and time that grow with tournaments, teams, matches and users

Written in S0 (2026-11-13) by an explorer agent and corrected by Opus. The live lobby bot is `bot-worker/` in this repo (Railway builds it from `feature/multi-tournament-platform`). The separate `inhouse bot/dota2-lobby-bot` repo is the old worker and is not deployed (memory note `inhouse-worker-website-contract.md`; its last commit is from 2026-08-10), so its polling loops are left out here.

Scope: website worktree `overhaul` including the live bot in `bot-worker/`, and the community-site repo (read only, nothing run). The closed `src/app/api/admin/**` routes are deleted.

All dollar figures are estimates (labelled "est."). Assumptions:
- One tournament has 16 teams, 80 players, 60 matches and 2 games per match, so 120 games and about 1,200 performance docs.
- 500 viewers and about 2,500 page views per tournament per month.
- Firestore reads cost $0.06 per 100k.
- Cloud Run and Gemini prices are not computed from a price list, only described.

## Summary: top 5 drivers

1. **Every page view reads the whole `tournaments` collection from the browser.** `TournamentProvider` is mounted in the root layout and calls `fetchTournaments()`, which does `getDocs(collection(db,'tournaments'))`. Total reads = page views × number of tournaments, so cost grows roughly with the square of platform size (est.: 1M views/month at N=1000 is about 1B reads, about $600).
2. **Post-game sync plus full-tournament stats recalculation.** Each finished game queues a `botSyncTasks` entry. It triggers `syncPDLMatchesAdmin` and `recalculateAllStats(tournamentId)`, and a task not yet parsed by OpenDota retries every 10 minutes for up to 24 hours. Per-game cost grows with the games already in that tournament, so per-tournament cost grows roughly with its games squared (inferred, I did not read the calculator).
3. **The stats dataset is rebuilt from scratch every 10 minutes per instance.** About 1.5k reads per rebuild (est.). The cache is instance-local, with up to 10 instances.
4. **The Steam account pool is the hard concurrency ceiling.** One account is held per open lobby, from creation to match end. The pool size lives only in Firestore (`botAccounts`) and is not stated in any repo file I read.
5. **Per-instance in-memory state.** Rate limiter, rulebook cache, `unstable_cache` and the Gemini burst limiter are all per instance, which is shared poorly with `maxInstances: 10`.

## Inventory

| Item | Where | Trigger and frequency | Grows with | Current behaviour | Est. cost per tournament per month |
|---|---|---|---|---|---|
| Conductor POSTs `/api/manage/bot/orchestrate` | `src/app/api/manage/bot/orchestrate/route.ts:2-3` (header says "every 5min by the Railway Conductor"); I did not find the caller in `bot-worker/src` (inferred) | Every 5 min, 288 per day | Tasks, active tournaments, duels | Drains up to 25 `botSyncTasks` (`:145-149`), then runs `sendMatchReminders`, `settleStale`, `roundRewards` (lines ~65-80) | The route's own fixed cost is shared across tournaments; Cloud Run wakes every 5 min, so it never fully scales to zero |
| `sendMatchReminders` | `src/server/notify/events.ts:134-150` | Every 5 min | Active tournaments | One query for `tournaments where status==active`, then one matches query per active tournament, sequentially. Config and team reads only when a match is due. | 288 × 30 ≈ 8.6k reads (est. $0.005) plus sequential latency per tournament |
| `settleStale` | `src/server/card-lab/duels.ts:262-270` | Every 5 min | Live card duels | Reads all `duels where status=='play'`, then filters by age in memory | Not per tournament |
| Post-game sync task | `orchestrate/route.ts:120-136` | Per game; retries every 10 min for up to 24 h | Games per tournament | `syncPDLMatchesAdmin` (OpenDota import) then `recalculateAllStats(tournamentId)` (`src/lib/stats-service-simple.ts:10`) then `recalculatePerformanceRankings` | est. $0.1-0.3 in reads at 120 games; also OpenDota calls (inferred) |
| Conductor schedule loop (live bot, `bot-worker/`) | `bot-worker/dist/conductor.js:54,92-108`; `scheduling.js:141-150` | Every 60 s, always on | **Total tournaments**, plus open matches of bot-enabled ones | Reads the whole `tournaments` collection, then one `config/bot` doc per tournament **in sequence** (the 60 s config cache equals the tick, so it is re-read about every tick), then the `scheduled/upcoming/pending` matches of each enabled tournament | About 2 reads per tournament per minute: 1440 × 2 ≈ 2.9k reads per tournament per day, about 86k per month (est. $0.05), whether or not the tournament is active. At 1,000 tournaments the sequential config reads alone take an estimated 30-50 s of each 60 s tick (inferred). |
| Conductor work loop | `bot-worker/dist/conductor.js:53,130-140,182,287` | Every 20 s | Lobby sessions and accounts, not tournaments | Queries pending and active `botLobbySessions` and idle `botAccounts` | Fixed, about 13k queries per day |
| Conductor sync loop | `bot-worker/dist/conductor.js:64,344` | Every 5 min | n/a | POSTs `WEB_SYNC_URL` (the orchestrate route, row above) | see orchestrate row |
| Inhouse runner/command queue | `bot-worker/src/inhouse/command-queue.ts:21,74` | Poll every 2 s; runner heartbeat 30 s (`runner.ts:47`) | Inhouse games and runners | Same pattern as above | n/a |
| Sitemap | `src/app/sitemap.ts:89` | Per sitemap generation (cache not verified) | Tournaments | Reads every tournament doc | N reads per generation |
| Account throwaway check | `src/server/accounts/store.ts:66-69` | On Discord link | Tournaments | `tournaments.get()`, then 3 reads per tournament | N × 3 reads per link |
| `refreshCaster` | `src/server/casters/casters.ts:54-57` | When a user links or unlinks Steam or Discord | Tournaments | Reads all tournaments, then one caster doc each | N reads per event |
| Global `collectionGroup('games'/'performances')` | `src/lib/stats-calculator-basic.ts:422,426` | Never called (S0 checked: imported by `stats-service-simple.ts:5`, not invoked) | All games on the platform | Dead code, but it would read every game and performance on the platform | none while dead |
| Slug claim check | `src/lib/api/tournaments.ts:493` (`checkSlugClaim`), `:543`, `:584` (`fetchOwnedSlugs`, name inferred) | Client-side on creator page and General tab | Tournaments | `getDocs(collection(db,'tournaments'))`, filtered in the client | N reads per check |
| Tournament list for every visitor | `src/context/TournamentContext.tsx:162`; provider mounted at `src/app/layout.tsx:83` | Every full page load, every visitor | Page views × tournaments | Client Firestore read of the whole collection, no server cache | See driver 1 |
| Stats dataset API | `src/app/api/stats/dataset/route.ts:5-23`; `src/lib/stats-lab/build-dataset.ts:33-80` | Each cache miss | Games, teams, players | `force-dynamic`. `unstable_cache` with `revalidate: 600`. Response header `public, s-maxage=300, stale-while-revalidate=600`. Reads matches, teams, per-team `players` subcollection, then games and performances (the rest of the file is not read). | est. 1.5k reads per rebuild. At one rebuild per 10 min per warm instance, about 4.3k rebuilds per month, about 6.5M reads, about $3.9. Up to 10× with 10 instances. |
| Card-lab dataset | `src/server/card-lab/collection.ts:31` | Same key pattern, revalidate 600 | Same | Separate `unstable_cache` entry (`stats-dataset-v5`), so one extra full build per instance per 10 min | Same order as the row above |
| Home fantasy leader | `src/app/api/home/fantasy-leader/route.ts:5,54` | revalidate 300, s-maxage 300 | Fantasy users | Cached | Small |
| Fantasy leaderboards | `src/app/api/fantasy/leaderboards/route.ts:5,73` | revalidate 60, s-maxage 60 | Users | Cached 60 s | Small |
| Draft-prep context, history, matchups, heroes, meta | `src/app/api/draft-prep/*/route.ts` | `unstable_cache` 120 s to 24 h; history 6 h per account | Players looked up | History makes 2 OpenDota calls per player (`src/app/api/player-heroes/route.ts:31`, `cache:'no-store'`, optional `OPENDOTA_API_KEY`) | OpenDota quota rather than money |
| Client polling | `NotificationBell.tsx:29` (90 s); `useDuel.ts:57` (lobby 5 s) and `:35` (ping 10 s); `Home.tsx:360` (12 s); `LanQualifierSection.tsx:16` (60 s, tab visible); `InfoWidgets.tsx:37` (Twitch 60 s); admin `BotTab.tsx:257` and `PlayoffMonitor.tsx:40` (10 s) | Per open tab | Concurrent users | Each poll is an SSR route hit on Cloud Run, not cacheable per user | 500 viewers × bell polling = about 330 requests per minute at peak (est.) |
| Twitch live | `src/app/api/twitch/live/route.ts:20` | `revalidate: 60` | Fixed | One upstream call per instance per minute | Negligible |
| Stats image proxy | `src/app/api/stats/img/route.ts:24,32` | `revalidate: 86400`, `s-maxage=604800` | Distinct images | Good caching | Small |

## Measured in S0

- The whole `tournaments` collection, which every visitor downloads on every full page load, is 77 KB as Firestore REST JSON for 4 tournament documents, so about 19 KB per tournament. At 1,000 tournaments that is about 19 MB per page load before any page content, if documents stay this size (est.).
- A Firestore read from Poland to the `nam5` (US) database takes about 0.95 s on a new connection and 0.18 s on a warm one (curl, 2026-11-13).
- `/api/stats/dataset`: first request after the cache expired took 7.8 s for wiosenna and 1.4 s for pdl-s2. Cached responses (Firebase CDN HIT) took 0.16-0.23 s. Sizes are 100 KB and 18 KB gzipped.
- `/sitemap.xml` is prerendered at build time (`○` in the build output) and reads every tournament with the service account during `next build`, so it only changes on a redeploy.

## Lobby bot Steam account pool

- Accounts live in the Firestore collection `botAccounts`. For tournaments, the Conductor claims one idle, enabled account per pending lobby session, with a 2-minute cooldown per account against Valve's create throttle, and forks one `runner.js` per session (`bot-worker/dist/conductor.js:55,130-140`). The number of accounts is not in any repo file; it lives in Firestore.
- Allocation: `leaseAccount` reads all enabled accounts and tries each in a transaction (`packages/core/src/lease.ts:38`, `bot-worker/src/inhouse/core/lease.ts:37-60`). The lease lasts from lobby creation until match end, with a 3-minute heartbeat timeout (`LEASE_TIMEOUT_MS = 3 * 60_000`, `lease.ts:19`). Its own comment says the pool must be sized for concurrent open lobbies.
- The docs say at least 1 account per concurrent match and 8+ accounts for 8+ simultaneous matches (`docs/LOBBY_BOT_SYSTEM.md:440, 627-632`). The account list is static and managed by hand through `/api/manage/bot/accounts`.
- Inhouse default `DEFAULT_MAX_OPEN_LOBBIES = 2` (`bot-worker/src/inhouse/core/store.ts:72`). The pool is shared between the tournament bot and the inhouse bot (`lease.ts:74`).
- Many tournaments at once: when no account is free the result is `none_available` (`lease.ts:~25`). I did not read how the tournament Conductor handles this, so queueing behaviour is unverified.
- Failure handling: the Conductor respawns a crashed gateway up to `MAX_RESPAWNS = 5` and then stops (`conductor-hook.ts:37,174`). A runner that crashes 5 times marks the game failed (`:388`).
- Fixed cost: the Conductor loops in the inventory table. Runners exist only while a lobby is open.

## Gemini rules assistant

- Model: `process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'` (`src/app/api/rules-assistant/route.ts:15`), called over REST with a 30 s timeout (`:148`).
- Prompt size: the full numbered rulebook goes in the system instruction on every question (`:140`). Cost per question grows with rulebook length. Size is not measured here.
- Inputs: question ≤ 500 chars, history ≤ 6 messages of ≤ 1,200 chars, answer ≤ 2,000 chars (`src/lib/rules-assistant.ts:9-13`).
- Shared quota, stored in Firestore (`src/lib/rules-assistant-quota.ts:24-29`): global 10 per minute and 500 per day, and per user 10 per hour and 30 per day. It is one global bucket for all tournaments, written by a Firestore transaction that touches 4 docs per question. The file's comment says it is set to stay inside the free tier.
- Burst limiter: `checkRateLimit(request, 'rules-assistant:${uid}', {limit: 4,…})` (`route.ts:95`). It is in-memory per instance, and the key is `${ip}:${key}` (`rate-limit.ts:55`). The IP is `x-forwarded-for[0]` (`:40`). Behind the Vercel rewrite that is Vercel's address (the brief states this; I did not test it), so the IP half of the key is the same for all users. The uid half still separates users.
- Rulebook cache: a module-level `rulesCache` map with a TTL of `RULES_CACHE_MS` (`route.ts:22-23`), per instance. A miss reads the tournament doc, the `rules` section collection and one `paragraphs` subcollection per section (`:27-30`).
- Cost: the free tier means $0 until the global cap (500 per day) is reached. Beyond that, answers are refused rather than billed. A paid-tier figure is not computed.

## Cloud Run and hosting

- `firebase.json` `frameworksBackend`: europe-west1, `maxInstances: 10`, 1 GiB, 1 vCPU, concurrency 80, timeout 540 s. `apphosting.yaml` has the same values plus `minInstances: 0` (`apphosting.yaml:1-6`). I could not confirm which file the deploy actually uses (inferred: the Hosting `frameworksBackend`).
- `minInstances: 0` means cold starts with a 1 GiB Next server (inferred). The 5-minute orchestrate call keeps at least one instance warm in practice (inferred).
- The community site rewrites unknown paths to the Firebase origin through `rewrites().fallback` (`dota2-community-site/next.config.ts:36-42`). Static assets are loaded from the Firebase origin directly through `assetPrefix` (`next.config.mjs`), and the tournament SPA reads Firestore and Storage directly from the browser.
- Whether Firebase Hosting's CDN caches SSR responses that pass through the Vercel proxy is not verified.

## Caching

- `unstable_cache` is used in the stats dataset, card-lab collection and draft-prep routes. Tags exist for `stats-dataset-<id>` and `draft-prep-heroes`. I saw `revalidateTag` only for `draft-prep-heroes` (`manage/draft-prep-heroes/route.ts:31`), so the stats dataset is not invalidated when games are imported (searched `revalidateTag`).
- Many routes are `force-dynamic` (`cards`, `casters`, `notify`, `account`, `inbox` and others), so they always run on Cloud Run.
- `revalidatePath` calls in `src/lib/admin-actions.ts` still refer to `/admin`, `/groups`, `/schedule` and `/my-team`, which are not the `[tournamentSlug]` routes.
- Static assets (images, js, css) get `max-age=31536000, immutable` (`firebase.json`).
- In-memory and per-instance state: `rate-limit.ts` store, `rulesCache`, `unstable_cache` (default file or memory cache per instance, inferred), the card-lab `useDuel` server state (not read).

## External APIs and storage

- OpenDota: per-player hero history (`player-heroes/route.ts:31`, key optional), draft-prep history and search, and the match import in `syncPDLMatchesAdmin`. `player-heroes/route.ts:118` adds a delay between players "to respect OpenDota rate limits". I did not read the sync code, so calls per sync are not counted. The free anonymous limit is shared across all instances and tournaments (inferred).
- Steam Web API: `validate-steam` (10 per 10 min per IP, in-memory), Steam avatar sync, and the lobby bot's Steam logins.
- Twitch: one cached call per minute per instance (`twitch/live/route.ts:20`).
- Bunny Stream: hero videos (`src/server/lib/bunny-stream.ts`, `src/config/bunny.ts`, upload through `manage/hero-video`). Video egress is billed by Bunny. Pricing and viewing counts were not checked, so no estimate.
- Firebase Storage for images, which load directly from Google (the community-site comment). No egress estimate made.

## Problems seen

- `TournamentContext.tsx:162` reads all tournaments from the client on every page load, with no cache.
- `stats-calculator-basic.ts:422,426` uses `collectionGroup` across all tournaments with no tournament filter.
- `sitemap.ts:89`, `accounts/store.ts:66`, `casters.ts:54` and `tournaments.ts:493/543/584` list all tournaments, and the last two do so on user actions.
- `sendMatchReminders` queries each active tournament one after another every 5 min.
- Stats dataset: `unstable_cache` keyed per tournament is instance-local and revalidates on a timer. I found no tag invalidation on import.
- The in-memory rate limiter uses `x-forwarded-for` (`rate-limit.ts:40`), which behind the Vercel rewrite is not the real client IP. It is also per instance, with up to 10 instances.
- The Conductor re-reads every tournament and every tournament's `config/bot` every minute, one after another, including finished and inactive tournaments.
- The pool size is a manual Firestore list, and the concurrency ceiling is the number of enabled accounts.
- `src/lib/cron-sync.js` (a `setInterval` script referenced nowhere) was deleted in S0.
- `LOBBY_BOT_SYSTEM.md:553,712` still tells the operator to call `/api/admin/bot/orchestrate`, which is dead.
- The Gemini global cap (500 per day, 10 per minute) is one bucket for the whole platform.
- `minInstances: 0` with a 1 GiB server, and many client polls that are `force-dynamic`.
- Not checked: the exact size of the stats dataset JSON, Gemini paid pricing, Bunny pricing, Cloud Scheduler jobs (none found in the repo; there is no `.github` workflow folder or `vercel.json` cron in the website, and the community site has no `vercel.json`), the Firestore query behaviour of `comprehensive-stats-calculator`, and the real Steam account count.
