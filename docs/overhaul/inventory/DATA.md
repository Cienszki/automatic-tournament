# Data inventory: Firestore and Storage

Written in S0 (2026-11-13) by an explorer agent from a read of the code; the claims marked "S0 checked" were verified by Opus. No production data was counted. S0 deleted the closed `/api/admin` routes and 21 orphaned modules; rows below that named them are marked "(deleted in S0)".

Scope: read-only code scan of the worktree (`src/`, `bot-worker/src/`, `scripts/`, `server/`), plus the lobby bot repo (`dota2-lobby-bot/src`, `packages/core/src`). No production access. There is no `functions/` folder (`ls functions` failed). `server/lib/getAllAdmin.ts` and `server/lib/getAllMatchesAdmin.ts` (copies of the `src/server/lib/` files) are the only non-`src` server code.

## Summary

- **Rules file live:** `firestore.rules` (570 lines). `firebase.json:85-88` points at `firestore.rules` and `firestore.indexes.json`. `firestore-secure.rules` is not referenced by `firebase.json` or any other config, so it is not deployed (last touched in commit 6a1d8df "fixed stats"). It contains only the legacy top-level rules; I read only its first 20 lines.
- **Storage rules:** `storage.rules`, set at `firebase.json:89-91`.
- **Collection count (about 70 distinct names, inferred from grep):**
  - 28 per-tournament subcollection kinds under `tournaments/{id}/`. Some have sub-subcollections.
  - About 17 global collections still in use.
  - 14 inhouse and bot collections used by the lobby bot, the bot-worker and the website's bot code.
  - About 18 legacy top-level collections left over from before multi-tournament.
- **Client versus server:** every Firestore rule is enforced only for the browser SDK. All server code uses the Admin SDK (`src/server/lib/admin.ts`, `src/lib/admin.ts`) and bypasses rules.
- **Dead code:** `src/app/api/admin/**` returns 410 (`src/middleware.ts:16-29`). I did not count callers that exist only there. One live caller still hits the closed prefix: `MatchesTab.tsx:513` mentions `/api/admin/recalculateStandings`, but only in a comment (inferred dead).
- **Legacy pages are redirected away.** `next.config.mjs:132-151` redirects `/teams`, `/groups`, `/schedule`, `/playoffs`, `/fantasy`, `/pickem`, `/stats`, `/rules`, `/standins`, `/register`, `/my-team` and `/admin` to `/letnia/...`. The top-level page files under `src/app/{teams,groups,fantasy,my-team,pickem,register,schedule,standins,stats}` that read root collections are therefore shadowed (inferred). Exception: `src/app/teams/[teamId]/**` is not matched by the exact-path redirect and is still reachable. It reads root `teams` and `matches`.

## Collection table

Sizes are estimates from code, not measured. "Admin SDK" means the server bypasses rules.

### Per tournament: `tournaments/{slug}/...`

| Path | Writers | Readers | Size per tournament | Indexes | Rules |
|---|---|---|---|---|---|
| `tournaments/{id}` | Client: wizard and tabs via `src/lib/api/tournaments.ts` (create at 294-458), `GeneralTab.tsx`, `TournamentStructureTab.tsx`, `TournamentLaunchCard.tsx` | Client: `getDocs(collection(db,'tournaments'))` at `tournaments.ts:493,543,584`. Server: `src/app/sitemap.ts:89`, notify, casters, card rewards | 1 doc, probably a few KB (inferred) | `status` queried in `events.ts:135` and `rewards.ts:86`, no composite index | Read is public. Create needs a usable slug plus admin or creator (`firestore.rules` ~L170). Update by admin, or by a tournament admin excluding `slug` and `organizerId`. Delete by super admin only. |
| `.../admins/{uid}` | Client: creator bootstrap, TournamentAdmins API `src/app/api/manage/tournament-admins` | Rules (`isTournamentAdmin`); many API routes | Handful of docs | none | Read needs admin access. A creator may create their own doc. |
| `.../teams/{teamId}` | Client: `register/page.tsx:476`, `MyTeamView.tsx`, `TeamsTab`, `DivisionsTab`, `GroupsTab`. Server: `register-team`, `register-pdl-team`, captain-change redeem | Nearly every tournament page (59 call sites) | 8 to 64 docs (inferred) | `divisionId`+`name` | Read is public. Any logged-in user can create. Update by admin or the team's captain. Delete by admin. |
| `.../teams/{id}/players/{pid}` | Client: `TeamsTab.tsx:579`, `MyTeamView.tsx:1413`. Server: `admin-actions.ts` | Teams page, stats, draft-prep, stats-lab | 5 to 7 per team, so 40 to 450 | none | Read is public. Write by admin or captain. |
| `.../teams/{id}/transfers` | Client: `MyTeamView.tsx:1456` | Not found | Small | none | **No rule (default deny)** |
| `.../matches/{id}` | Client: `MatchesTab`, `SchedulingTab`, `MyTeamView` (captain reschedule). Server: `manage/extra-match`, bot orchestrate, `pdl-admin-actions.ts`, `unified-game-save.ts`, `import-match` | Many (41 call sites); `MyTeamView.tsx:133` reads the whole collection | 30 to 300 docs (inferred) | `status`+`scheduledFor`; `divisionId`+`round` | Read is public. Create and delete by admin. Update by admin or captain (reschedule only). |
| `.../matches/{m}/games/{g}` and `.../performances/{playerId}` | Server: `pdl-admin-actions.ts`, `import-match`, bot orchestrate, extra-match | `MatchDetailModal.tsx:122`, stats calculators, stats-lab, card-lab | About 1 to 3 games per match, and 10 performance docs per game, so roughly 3k to 9k docs at 300 matches | Collection-group scans, no index file entry | Read is public. Write by admin. |
| `.../playoff_matches/{id}` | Client: `PlayoffsTab`, `playoff-automation.ts`, `playoff-management.ts`, `MyTeamView`. Server: `playoff-result-bridge.ts`, `standin-actions.ts` | `playoffs/page.tsx:95`, `MirroredPlayoffBracket`, `LanQualifierSection` | 10 to 60 | none | Public read; admin create and delete; captain update |
| `.../divisions/{id}` | Client: `DivisionsTab`, `pdl-admin-actions` | Navbar, `MatchdayCarousel`, `divisions/[divisionId]/page.tsx` | 1 to 8 | none | Public read; admin write |
| `.../groups/{id}`, `.../standings/{id}` | Client: `group-actions.ts`, `GroupsTab`. Server: `group-actions-admin.ts`, `post-sync-recalculations.ts` | Groups pages | Few docs | none | Public read; admin write |
| `.../swissRounds/{round}` | Client: `src/lib/swiss/actions.ts`, `SwissTab` | Swiss UI | 1 doc per round, holds pairings plus a standings snapshot | none | Public read; admin write |
| `.../playoffs/{id}` | Client and server: `playoff-management.ts`, `playoff-automation.ts` | Playoffs pages | Few | none | Public read; admin write |
| `.../announcements/{id}` | Client: `NewsTab`, `announcement-actions.ts` | `news/page.tsx:50`, `MyTeamView.tsx:605` | Tens | `published`+`createdAt` (the single-field index entry in `firestore.indexes.json` named `announcements`; applies as collection scope, so it covers this and root `announcements`) | Public read; admin write |
| `.../rules/{section}` and `.../paragraphs/{p}` | Client: `RulesTab` | `rules/page.tsx:59`, `api/rules-assistant` | Sections times paragraphs, maybe 50 to 200 docs. The page does N+1 reads (one per section). | none | Public read; admin write |
| `.../prizes/{id}` | Client: `PrizesTab` | `prizes/page.tsx` | Few | none | Public read; admin write |
| `.../fantasyLineups/{uid}` and `/rounds/{r}` | Client: `firestore.ts:547-555`, fantasy page. Server: `fantasy-scoring-admin.ts` (writes root, see Legacy) | Fantasy page, `getFantasyLeaderboard` (`firestore.ts:470`) | 1 doc per user plus 1 per round per user. Unbounded. | none | **Public read**, so lineups are visible to everyone. Write by the owner or admin. |
| `.../fantasyRounds/{id}` | Client: `FantasyPickemTab.tsx:69-139` | `fantasy/page.tsx:56`, `firestore.ts:490` | Few | none | **No rule, so default deny.** The client reads and writes in `FantasyPickemTab.tsx` would fail (inferred from the rules file: `grep -c fantasyRounds firestore.rules` returns 0). |
| `.../pickems/{uid}` | Client: `pickem/page.tsx`. Server: `pickem/export` reads | Pickem page | 1 doc per user | none | **Public read**; write by the owner or admin |
| `.../standins/{uid}` | Client: `standins` flows. Server: `register-standin` writes root | Standins pages, stats | Tens | `status`+`mmr` desc | Public read. Create by the user, update by the user or admin, delete by admin. |
| `.../standinRequests/{id}` | Client: `MyTeamView.tsx` (many), `StandinsTab`. Server: `standin-actions.ts` | Same, plus `comprehensive-stats-calculator.ts:324` | Tens to hundreds | none | Public read. Create by a captain of the match. Rules do `get()` of the match for every check. |
| `.../scrimSlots/{id}` | Client: `MyTeamView.tsx:413,740` | Same | Tens | none | Public read; captain create, update and delete |
| `.../commentators`, `.../commentatorRequests` | Client | Client | Few | none | Public read. Request create by any logged-in user. |
| `.../casters/{uid}` | Server: `src/server/casters/casters.ts:19-139` | `casters.ts`, `store.ts:68` | Few | none | **No rule, so default deny** (server only) |
| `.../config/bot` | Server: `manage/bot/config`, `casters.ts:93` | `events.ts:146`, bot code | 1 doc | none | No rule, server only |
| `.../stats/{doc}`, `playerStats`, `teamStats`, `performanceRankings` | Server: `comprehensive-stats-calculator.ts:903-917` (clears then rewrites), `performance-rankings-calculator.ts:186` | `StatsTab.tsx:68`, `RankingsView.tsx`, stats pages | `playerStats` is 1 doc per player, `teamStats` 1 per team (about 40 to 450 docs, all rewritten on every recalc) | none | Public read; admin write |
| `.../stats/players/{id}`, `.../stats/teams/{id}`, `.../stats/heroes/{id}` | Defined in `paths.ts:128,131` and in rules | Not found in use | n/a | none | Rules `match /stats/players/{playerId}` has 3 path segments, which cannot address a document (inferred: dead rule). |
| `.../playerGameHistory/{steam64}` and `/games/{g}` | Server: `pdl-admin-actions.ts:516,1537` | `TeamsView.tsx:487` | 1 doc per player plus 1 per game played. Grows without bound. | none | Public read; admin write |
| `.../processedGames`, `.../skippedGames`, `.../unparsedMatches` | Server: `pdl-admin-actions.ts:204-453,2131` | Same file | 1 doc per Dota match id seen. Hundreds to low thousands. | none | No tournament-level rule, server only |
| `.../draftPrepData`, `.../tournamentPlayers` | Not found under a tournament | n/a | n/a | n/a | n/a |

### Global (not tournament scoped)

| Path | Writers | Readers | Size | Indexes | Rules |
|---|---|---|---|---|---|
| `admins/{uid}` | Server: `dev/makeAdmin`, scripts | Rules plus ~25 API routes | Few | none | Used by rules; only the generic catch-all (deny) applies to reads/writes |
| `tournamentCreators/{uid}` | Server: `manage/tournament-creators` | `creator/access` | Few | none | Read by admin or self; write by admin |
| `users/{uid}` | Server: `api/account/route.ts:115`. Client: `firestore.ts:429-456` | Client profile | 1 per user | none | Owner or admin read and write |
| `players/{steamId64}` | Server: `src/lib/player-profiles.ts:132-316`, `sync-steam-avatars` | `useGlobalPlayerProfile.ts:33-112` (client), card-lab, notify | 1 per player (thousands) | none | Public read; admin write |
| `accounts/{uid}` and `/inbox/{id}` | Server: `src/server/accounts/store.ts`, `notify/notify.ts:45` | `NotificationBell.tsx` (client), `api/inbox`, `api/account` | 1 per user; inbox grows without bound | none | Read by the owner only; write false |
| `discordLinks/{discordId}`, `steamLinks/{id}` | Server: `store.ts:45-92` | `notify.ts:88-122` | 1 per link | none | Denied to clients |
| `dmLog/{sha1}` | Server: `notify.ts:108` | same | 1 per notification sent | none | No rule (denied) |
| `cardCollections/{key__uid}` | Server: `collection.ts:45`, `rewards.ts` | Same | 1 per user per tournament | none | Denied to clients |
| `cardDuels/{id}`, `/views/{uid}`, `/meta/history` | Server: `duels.ts:27-140` | `useDuel.ts` (client, reads own `views/{uid}`) | 1 per duel; views embed a JSON string | none | `views/{uid}` readable by the owner; else denied |
| `cardRankings/{key}/players` and `/pairs` | Server: `duels.ts:175-286` | same | 1 per player; `pairs` keyed per day and pair, so grows | none | Denied |
| `cardActivity/{uid}`, `cardRewards/{tid}`, `cardGrants`, `cardReports`, `cardReportLimits` | Server: `finds.ts:25`, `rewards.ts:91-125`, `cards/report/route.ts:33-57`, `manage/cards` | same | small to medium | none | cardRewards/Grants/Reports/Limits/Activity have no rule (denied) |
| `draftPrepData/{history|heroes}` and `heroes/matchups/{h}` | Server: `src/lib/draft-prep/server.ts:283-410` | same | Big cached docs (inferred) | none | No rule (denied) |
| `captainChangeCodes/{code}` | Server: `manage/captain-change-code`, `captain-change/redeem` | same | Few | none | No rule (denied) |
| `rulesAssistantUsage/{bucket}` | Server: `rules-assistant-quota.ts:77` | same | 1 doc per rate-limit bucket (TTL expected, `rules-assistant-quota.ts:6`) | none | No rule (denied) |

### Bot and inhouse

| Path | Writers | Readers | Indexes | Rules |
|---|---|---|---|---|
| `botAccounts/{id}` | Website `bot-pool-manager.ts:160,225`; bot-worker `inhouse/runner.ts:196-996`, `core/lease.ts:38-130`; lobby bot `packages/core/src/lease.ts` | Same | `enabled`+`status` | Admin read; write false |
| `botCommands/{botId}/queue/{id}` | website `bot-agent.ts` (deleted in S0; it was unreachable); bot-worker/lobby bot consume (`command-queue.ts:94`, `command-handler.ts:106`) | Same | collection-group `queue`: `status`+`createdAt` | Admin read; write false |
| `botEvents/{id}` | Bots (`command-handler.ts:500`), website `bot-agent.ts` (deleted in S0; it was unreachable) | website `bot-agent.ts` (deleted in S0; it was unreachable), bot `watcher.ts:113` | `processed`+`createdAt` | Admin read; write false |
| `botLobbySessions/{id}` | website `bot-agent.ts` (deleted in S0; it was unreachable), `bot-config-actions.ts` | `MyTeamView.tsx` (client read), `manage/bot/sessions` | `state`+`createdAt`; `matchId`+`createdAt` desc; `matchId`+`currentGameNumber`+`state` | Admin read; write false. `MyTeamView.tsx` appears to read this collection, which would fail for non-admin captains (inferred, query not read). |
| `botSyncTasks/{id}` | website `bot-agent.ts` (deleted in S0; it was unreachable), `manage/bot/orchestrate` | same | `status`+`syncAt` | Admin read; write false |
| `inhouseGames/{id}` plus `memberships`, `reservations`, `waitlist` subcollections | Lobby bot (`packages/core/src/store.ts`, `game-service.ts`, `scheduler.ts`, `watcher.ts`); bot-worker `inhouse/core/store.ts` | Same; `inhouseGames` also read by `board.ts` | none in file | No rule (denied) |
| `inhousePlayers/{discordId}` (+`teammates`), `inhouseModeration`, `inhouseBans`, `inhouseAttendance`, `inhouseLinkCodes`, `inhouseReadyPool`, `inhouseCounters`, `inhouseConfig` (`global`, `lobby`, `admins`, `records`, `discord`, `schedule`), `inhouseScheduleRuns` | Lobby bot and bot-worker | Website reads only `inhousePlayers`: `src/server/accounts/store.ts:32`, `notify/notify.ts:95` | none | No rule (denied) |

## Legacy top-level collections

Collections: `teams` (+`players`), `matches` (+`games`/`performances`), `groups`, `standins`, `standinRequests`, `playoffs`, `pickems`, `fantasyLineups` (+`rounds`), `tournament/status`, `announcements`, `stages`, `configs`, `tournamentStats`, `playerStats`, `teamStats`, `metaStats`, `processedGames`, `blockedGames`. Fantasy extras: `fantasyLeaderboards`, `fantasyPlayerStats`, `fantasyUserSummaries`, `fantasyUserTotals`, `tournamentPlayers`, `playerRoundStats`. Also `userProfiles`.

Live (non-dead) code that still reads or writes them:

| Legacy collection | Path:line |
|---|---|
| `teams`, `matches`, `groups`, `announcements`, `tournament/status`, `pickems`, `fantasyLineups`, `standins`, `standinRequests`, `users` (all via `src/lib/firestore.ts`) | `firestore.ts:22-864` |
| Importers of `firestore.ts` | `src/app/{fantasy,groups,my-team,pickem,register,schedule,teams}/**`, `teams/[teamId]/page.tsx:33`, `teams/[teamId]/players/[playerId]/page.tsx:6`; and tournament-scoped pages that import the same legacy functions: `[tournamentSlug]/{diploma,fantasy,pickem,schedule,teams}/page.tsx`, `MatchImportModal.tsx:10`, `getHomePageData.ts:1`, `StandinRequestModal.tsx:20`, `MyTeamView.tsx:25`, `lib/actions.ts:65`, `lib/team-actions.ts:7` |
| `teams` | `api/validate-steam/route.ts:30,39`; `api/captain-change/redeem/route.ts:67`; `admin-actions.ts:19` (inferred root) |
| `matches`/`games` | `api/import-match/route.ts:117,123` (live route writing root, not tournament-scoped); `stats-calculator-admin.ts:26`; `fantasy-scoring-admin.ts:29-317` |
| `fantasyLineups` (root) | `fantasy-scoring-admin.ts:46-317`; `api/fantasy/*` reads the derived collections below |
| `fantasyLeaderboards`, `fantasyPlayerStats`, `fantasyUserSummaries` | Read by `api/fantasy/leaderboards/route.ts:13`, `api/home/fantasy-leader/route.ts:13`, `api/fantasy/playerStats/[playerId]/route.ts:15`, `api/fantasy/userSummary/[userId]/route.ts:15`. Their only writers, `fantasy-enhanced-admin.ts` and `fantasy-recalc-fixed.ts`, were reachable only through the closed `/api/admin` routes and were deleted in S0. Nothing writes these collections now, yet `/api/fantasy/leaderboards` (fetched by `src/app/fantasy/page.tsx:291`) and `/api/home/fantasy-leader` still serve them, so that data is frozen (S0 checked by grep). |
| `tournamentStats`, `playerStats`, `teamStats` (root) | `comprehensive-stats-calculator.ts:929-939` (when no tournamentId); `stats-calculator-basic.ts:418-435` (client SDK, also uses `collectionGroup`); `app/stats/page.tsx:324-352` |
| `standins` | `api/register-standin/route.ts:35`; `app/standins/page.tsx:92`; `comprehensive-stats-calculator.ts:293` |
| `userProfiles` | `api/pickem/export/route.ts:43` |
| `blockedGames` | `admin-match-actions.ts:12` (client), `admin-match-actions-server.ts:18` |
| `processedGames` (root) | rules only; pdl code uses the tournament-scoped one |
| draft-prep and stats-lab fallbacks | `draft-prep/server.ts:57,215`, `stats-lab/build-dataset.ts:35` fall back to root collections when no `tournamentId` is given |

I also found `performances` fallback paths with no `tournamentId` in `comprehensive-stats-calculator.ts:173-177`.

The legacy rules (`firestore.rules` ~L100-120, L430-500) still allow public read for `teams`, `matches`, `groups`, `stages`, `configs`, `tournament`, `playerStats`, `teamStats`, `tournamentStats`, `fantasyLineups`, `pickems`, `standins`, `standinRequests`, `playoffs`.

Tournament-unaware recalculation on a live path (S0 checked): `/api/import-match` (`route.ts:137`) and `unified-game-save.ts:105` call `runAllPostSyncRecalculations()` (`post-sync-recalculations.ts:205`). It takes no tournament id and recomputes the legacy root collections: root `groups` standings (`:11`), root fantasy totals (`:153`), and basic stats from root `matches` (`stats-calculator-admin.ts:26`).

## collectionGroup queries

| Use | Path:line | Notes |
|---|---|---|
| `getDocs(collectionGroup(db,'games'))` and `(db,'performances')` in client SDK | `src/lib/stats-calculator-basic.ts:422,426` | Would scan every tournament's games and performances, with no `where`. Dead: `recalculateBasicTournamentStats` is imported by `stats-service-simple.ts:5` but never called (S0 checked). |
| Admin SDK `collectionGroup('performances')` | `scripts/*` (7 one-off analysis scripts, e.g. `hero-statistics-analysis.js:73`) | Scripts only; I did not run them |
| Index `queue` COLLECTION_GROUP `status`+`createdAt` | `firestore.indexes.json` | Applies to `botCommands/*/queue` |

## Storage

Rules are in `storage.rules` (49 lines). Callers are in `src/lib/storage.ts`.

| Path | Writers | Rule |
|---|---|---|
| `screenshots/{teamId}/{uuid}` | `storage.ts:7` | Read and write: any signed-in user |
| `team-logos/{file}` | `storage.ts:16` | Public read; any signed-in user can write |
| `standin-screenshots/{file}` | `storage.ts:25` | Public read; any signed-in user can write |
| `tournament-assets/{slug}/**` | `storage.ts:34-98` (logos, backgrounds, hero) | Public read; write only if the user is in `admins` or `tournamentCreators` (any slug) |
| `tournaments/{id}/divisions/{file}` | `DivisionsTab.tsx:374` | Public read; write by super admin or tournament admin |
| everything else | n/a | Read for any signed-in user; no write rule, so write denied |

## Problems seen

- `fantasyRounds` and `teams/{id}/transfers` are accessed by the client but no rule exists, so default deny applies (`firestore.rules` catch-all). The fantasy round admin and the transfer history would fail (inferred).
- `fantasyLineups` and `pickems` (per tournament and root) are publicly readable. Users' picks are visible before round close.
- Any logged-in user can create a team doc (`teams` create rule `request.auth.uid != null`) and any logged-in user can create `commentatorRequests`. There are no field validations.
- Team captain update rules allow full-document updates by a captain (only reschedule deletion is guarded).
- `standinRequests` rules call `get()` on the match for every check (extra reads per operation).
- Storage: `screenshots/` and `standin-screenshots/` allow any signed-in user to write anywhere in that folder, including overwriting other users' files. `standin-screenshots` and `team-logos` are public-read. Fallback rule lets any signed-in user read all other paths.
- `/api/import-match` writes a game to root `matches` and then recalculates root-level (legacy Letnia) standings, fantasy and stats, whatever tournament the admin is working on.
- The root fantasy leaderboard collections have readers but, since S0, no writer. They were already only writable through closed routes, so the fantasy leaderboard is frozen.
- `firestore.rules` has legacy rules (root `teams`, `matches`, `playoffs` etc.) still active and public-readable. Rule path `stats/players/{playerId}` cannot match a document.
- `import-match` writes to root `matches` (`import-match/route.ts:117`) while checking tournament admin (`:47`). Admin-checked by uid, but the target is the legacy collection.
- The stats pipeline clears and rewrites all `playerStats`/`teamStats` docs for a tournament on each recalc (`comprehensive-stats-calculator.ts:906-917`).
- Unbounded growth: `playerGameHistory/*/games`, `accounts/*/inbox`, `cardRankings/*/pairs`, `processedGames`, `dmLog`, per-user `fantasyLineups/*/rounds`.
- `firestore-secure.rules` exists but is undeployed, and its contents differ from the deployed file (not compared line by line).
- Collection-group `queue` index is global; any other collection named `queue` shares it.
- The legacy top-level pages that import `firestore.ts` remain in the build although redirected (inferred).

**Not checked:** document counts or sizes in production; whether `rulesAssistantUsage` has a TTL policy configured; `scripts/` contents beyond grep (about 70 one-off scripts); `database_schema.md` beyond its first 80 lines. It documents only the legacy top-level schema (`admins`, `teams`, `players`, `tournament/status`) and is outdated.
