# Product inventory: what dota2inhouse.pl delivers against its selling points

Written in S0 (2026-11-13) by an explorer agent; Opus checked the league-id fallback, the wizard's `leagueId: null`, the hard-coded Twitch channel and which bot code is deployed.

Repos: WEB = `.../automatic-tournament/.claude/worktrees/overhaul` (paths below are relative to it). BOT = `bot-worker/` inside WEB (the live one). I did not trace card-game or caster-corner internals, Discord notification delivery, or the Firestore rules in depth. I ran nothing against production. Items marked "(inferred)" were not traced end to end.

## Summary

| Selling point | Exists | End-to-end | Partial / manual | Missing |
|---|---|---|---|---|
| 1. Automatic lobbies | Conductor plus per-match runners on Railway create, invite, run and finish series lobbies | Proven live only in dry-runs with a few testers; no real-player run recorded | Super admin owns the Steam bot pool. The organizer must enable the bot in BotTab, set a league ID, and give every match a `scheduledFor`. Lobbies are skipped for matches without one. | Bot cannot be self-served. Nothing in the wizard touches the bot. Single Steam bot pool. |
| 2. Automatic results | Bot enqueues `botSyncTasks`; Conductor POSTs to web `/api/manage/bot/orchestrate` every 5 min; the same code as the admin "Synchronizuj mecze" button imports from the Steam league, then OpenDota, then standings and stats | Works for PDL-style tournaments | Needs a valid Steam league ID per tournament. Without one it falls back to the 2025 Letnia league. Not all derived data refreshes automatically. | Nothing for manual or off-lobby games except admin force-import. No Pick'em scoring found. |
| 3. Creator wizard | 3 templates plus "custom" (same 3 types), writes the tournament doc, makes the creator owner and creates one division | Draft tournament page renders from its Firestore doc | Gated to super admins and an allowlist. Wizard output is `draft`/`inactive`. Teams, schedule, league ID, bot, rules and publishing happen in the admin panel. | GSL/LAN format is not in the wizard. No bot step. |
| 4. Customization | Theme, fonts and division themes are stored per tournament and applied at runtime | Works per path slug | Wizard fonts come from a fixed preset list; the Google font picker lives in admin. Some theme code is hard-coded to pdl/letnia. | Custom domains: nothing exists |
| 5. Viewer features | Stats hub, fantasy, pick'em, cards, casters, inbox/Discord DMs, Twitch widgets | Stats and fantasy are driven by sync plus an admin recalc | Twitch is a single hard-coded channel. Pick'em has no scoring code. | Per-tournament Twitch. Swiss has no fantasy or pick'em. |

## 1. Automatic lobbies

**What exists**
- The Conductor (`bot-worker/dist/conductor.js`) scans every tournament each 60 s. For those with `config/bot.enabled` it calls `scheduleUpcomingMatches` (`conductor.js:90-105`).
- `bot-worker/dist/scheduling.js:141-160` creates one `botLobbySessions` doc per match. It does so when `scheduledFor` is within `lobbyCreationLeadMinutes` (default 10) and not more than 30 min past. It only considers matches with status `scheduled`, `upcoming` or `pending`.
- Assignment: it claims an idle, enabled `botAccounts` doc with a 2 min cooldown (`conductor.js:54-60`, `:137-139`).
- One `runner.js` process then drives the whole series: lobby, invites, ready check, start, game end, next game.
- Series format falls back to `group_id ? bo2 : bo3` (`scheduling.js:170`).
- Admin UI: BotTab (`src/app/[tournamentSlug]/admin/tabs/BotTab.tsx:1047`, enable switch).
- Config API (`src/app/api/manage/bot/config/route.ts:102-107`) lets a super admin or a tournament admin save the config, including `enabled`.
- Bot account management is super-admin only (`src/app/api/manage/bot/accounts/route.ts:2`).

**End to end**
- The flow is enabled, then match gets `scheduledFor`, then session, bot assigned, lobby, game, `botSyncTasks`.
- Live dry-runs with testers proved lobby creation, joining and `game_started` with a real match ID (memory `lobby-bot-known-gaps.md`).
- Later stalls were found and patched in `dist/runner.js`: stuck bots, a missed POSTGAME that blocked game 2, and the caster-slot launch failure.
- Production PDL S2 matches have used it (inferred from the notes).

**Manual or partial**
- **Bot pool:** a super admin must register and enable the Steam bot accounts. Credentials are base64 in Firestore.
- **Per tournament:**
  - The organizer must set `enabled` in BotTab. The wizard never creates `config/bot` (`src/lib/api/tournaments.ts:110-340` writes no bot config).
  - The whitelist and lobby `leagueId` (BotTab:1211) are set there too.
- **Per match:** `scheduledFor` must exist. Matches without it never get a lobby.
- **Players:** both teams need valid `steamId32` on their rosters. Players without one are silently filtered out (`scheduling.js:62-66`).
- **Late-arrival forfeit voting:** opt-in, default off, never run with real players.
- **Deploys:** a redeploy while games are live can strand bots. Auto-deploy was checked working 2026-10-26.
- Known weak points still open per memory: credential storage and manager restart-spam. The Immortal Draft path likely still has the caster-slot problem.

**Missing**
- Self-service for organizers: no UI to add their own Steam accounts.
- Multi-pool. The whole platform shares one pool, and Valve rate-limits lobby creation per account.
- The dead flag `lobbySettings.botLobbyEnabled` still exists in `src/types/tournament.ts`. Memory says nothing writes it.
- `inhouse bot/dota2-lobby-bot` is the old, undeployed worker (last commit Aug 2026; `inhouse-worker-website-contract.md`).

## 2. Automatic results

**Flow** (all verified in code)
1. The runner writes `botSyncTasks` on game end. It also polls OpenDota every 120 s as a fallback if the GC event is lost (per `lobby-bot-known-gaps.md`, in `dist/runner.js`).
2. The Conductor `syncLoop` POSTs to `WEB_SYNC_URL` with `CRON_SECRET` every 5 min (`conductor.js:50-62`, `:110-125`). It is OFF unless both env vars are set on Railway.
3. `src/app/api/manage/bot/orchestrate/route.ts` drains the tasks. The route's `executePendingSyncTasks` runs `syncPDLMatchesAdmin(tournamentId)` then `recalculateAllStats` once per tournament. It retries every 10 min and gives up after 24 h (`:107-110`).
4. `syncPDLMatchesAdmin` (`src/lib/pdl-admin-actions.ts:938-1030`):
   - Reads the league ID: Firestore `tournaments/{id}.leagueId`, else `getLeagueId(slug)`.
   - Lists the Steam league's matches and skips processed or skipped games.
   - Fetches each match from OpenDota and requests a parse if unparsed.
   - Matches teams by player IDs, saves games, updates match scores, standings and fantasy points per player.
5. The same route also sends "match in an hour" reminders and settles stale card duels and round packs (`orchestrate/route.ts:60-82`).

**Manual or partial**
- The wizard sets `leagueId: null` (`src/lib/api/tournaments.ts:155`). The organizer must enter a real Steam league ID in GeneralTab (`GeneralTab.tsx:667`, `:501`). The league must be a Valve ticket league, which is an external, non-automatable prerequisite.
- If `leagueId` is null, `getLeagueId` returns the hard-coded Letnia league 18559 (`src/lib/definitions.ts:241-256`). A new tournament would then import another tournament's games. This is a latent cross-tournament bug.
- Without the Railway env vars, nothing triggers sync except the admin button (MatchesTab:1095, `handleSyncMatches`).
- The admin button also runs a post-sync recalc: standings for `type === 'league'` only, then stats (`MatchesTab.tsx:496-536`). The bot path runs `syncPDLMatchesAdmin` + `recalculateAllStats` only, and I did not verify it triggers the league-standings recalc. `syncPDLMatchesAdmin` has an internal standings step (the route's comment says it recalculates standings), and playoff bracket sync is invoked from `updatePDLMatchScoresAdmin` (`pdl-admin-actions.ts:643`). The fantasy leaderboard doc requires a "fixed fantasy recalculation" run first (`src/app/api/fantasy/leaderboards/route.ts:25`). I found no automatic trigger for it (inferred).
- OpenDota parse delays and unparsed games go through retry queues.
- Lobbies are only matched if rosters carry `steamId32`.
- Competitor claim ("no competitor does this") is not something I checked.

**Missing**
- Games played outside the league or with wrong team names need admin Force Import.
- Pick'em scoring was not found (see section 5).

## 3. Creator wizard

**What exists**
- Entry `src/app/creator/page.tsx`: 3 template cards (MMR-limited, "Liga Profesjonalna", Swiss) plus a "custom" link. All of these map to the same 3 types (`TournamentStructureStep.tsx:24-33`, `:99-120`). The custom path is not a new format.
- Steps: BasicInfo, Branding, Structure, Review (`src/components/creator/steps/*`).
- Submit (`src/app/creator/new/page.tsx:100-134`) calls `checkSlugClaim` then `createTournament`, which is a client-side Firestore write. It then redirects to `/{slug}/admin?welcome=true`.
- `createTournament` (`src/lib/api/tournaments.ts:110-340`) writes:
  - the tournament doc with theme, fantasy, pickem, standins and playoffs blocks, with `status: 'draft'`, `visibility: 'inactive'` and a `previewToken`;
  - the `admins/{uid}` owner doc;
  - one initial division.
- Access: only super admins or `tournamentCreators` allowlist members (`src/app/api/creator/access/route.ts`; Firestore rules at `firestore.rules:25`, `:149`). The allowlist is managed through `/api/manage/tournament-creators`.
- `/organizer` (`src/app/organizer/page.tsx`) lists one's tournaments and sets redirects between seasons (e.g. `/pdl` to `/pdl-s2`).

**What it covers**
- Three formats only: MMR-limited groups plus playoffs, league with divisions and promotion/relegation, and Swiss.
- Playoff format and Bo-formats are choices (single or double elimination; semifinal, final and grand-final BO3/BO5).
- Missing from the wizard: the GSL top-4 plus Swiss plus LAN format that PDL S2 uses. That lives in `src/app/[tournamentSlug]/format-lan` and `lib/lan-qualifier` (inferred), admin-only.

**Manual steps after the wizard**
- Add the Steam league ID.
- Open registration and publish. The tournament is `draft`/`inactive` after creation, and I did not verify the exact publish control in the admin panel.
- Handle teams, divisions and groups (Teams, Divisions, Groups tabs), the schedule (SchedulingTab, MatchesTab) and playoffs.
- Write the rules (RulesTab; the pdl-s2 rulebook lives in Firestore `rules/paragraphs`).
- Enable the bot in BotTab.
- Upload the logo, favicon and background.
- Prizes are disabled by default (`prizesEnabled: false`).
- Swiss fantasy and pick'em are forced off by the wizard (`src/lib/api/tournaments.ts:176-189`).
- The Polish UI is hard-coded throughout.

Net: the wizard produces a skeleton tournament. It is not "nearly all the work".

## 4. Customization

**What exists**
- The theme is stored on the tournament doc and read at runtime (`src/context/TournamentContext.tsx:122`: `tournament?.theme || pendingTheme || DEFAULT_THEME`). CSS variables are applied at `:395-423`. A session cache avoids a flash.
- The wizard writes about 25 theme fields (`src/lib/api/tournaments.ts:197-229`). These include colours, fonts, background, overlay, blur, card style, navbar and glow. Fonts are written as `var(--font-<name>)`.
- Fonts: wizard dropdowns use a preset list (`BrandingStep.tsx:112-114`, `:305-324`). Google fonts: `src/lib/google-fonts.ts` (253 lines, catalogue and URL helpers); `src/lib/dynamic-fonts.ts` (111 lines); `DynamicFontLoader.tsx`, `ThemeFontApplier.tsx`; admin `FontManagement.tsx`, used by GeneralTab.
- Division themes: `src/lib/division-themes.ts`, used by `DivisionsTab.tsx`, `DivisionHero.tsx`, `DivisionTable.tsx`, `InlineDivisionView.tsx`.
- Extended theme: heading, title, section and primary-text colours (`TournamentContext.tsx:412-418`).
- Hero video and Bunny Stream hosting are available to super admins.

**Hard-coded leftovers**
- `getThemeBySlug` only knows `pdl` and `letnia`, defaulting to Letnia (`src/lib/themes/index.ts:181-190`).
- `TournamentContext.tsx` has literal letnia/pdl branches: `:70-77`, `:136` (`isLegacyTournament = tournamentSlug === 'letnia'`), `:206-220`, `:292`, `:351`.
- `src/components/themed/*`, `stats-lab/kit.tsx` and `card-lab/ui.tsx` (comment "wiosenna" light theme) reference slugs.
- A planned theme-colour audit is postponed (memory `theme-color-audit-planned.md`): some hard-coded colours bypass the theme.

**Custom domains: nothing exists**
- `src/middleware.ts` does only two things: it returns 410 for `/api/admin*`, and it strips `.rsc` / `.prefetch.rsc` suffixes. Its matcher is `['/(.*\\.rsc)', '/api/admin(.*)']`. It does not read the host header.
- Tournaments resolve only from the first path segment: `src/app/[tournamentSlug]/layout.tsx:25-26` takes `params.tournamentSlug`, and `TournamentContext` does `fetchTournamentBySlug`.
- A tournament doc has no domain field (grep for "domain" finds nothing relevant). The only domain-related code is the community-site cutover.
- The community site (`dota2-community-site/next.config.*`) has one fallback rewrite, `/:path* -> ${TOURNAMENT_ORIGIN}/:path*`, forwarding every path it does not own to the Firebase app. Domain ownership stays with the Vercel project.
- There is no Host-to-slug mapping, no per-tenant domain in Firebase Hosting, no Firebase Auth authorised-domain automation and no assetPrefix per host. `next.config.mjs` pins `assetPrefix` and `images.path` to `tournament-tracker-f35tb.web.app`.
- The root `/` redirects to `/wiosenna` (`src/app/page.tsx:13`). The comment says the full split landing is not restored.

## 5. Viewer features

| Feature | Evidence | State |
|---|---|---|
| Stats hub | `src/app/[tournamentSlug]/stats/page.tsx`, `/rankings`, `src/lib/stats-lab`, `/api/stats/dataset` | Live per memory `stats-hub.md`. Stats are recomputed by `recalculateAllStats`, run by sync. `build-dataset.ts` references hard-coded slugs (inferred from grep). Achievements thresholds were tuned on PDL/Wiosenna data. |
| Fantasy | `/[slug]/fantasy`, `src/app/api/fantasy/*`, `src/lib/pdl-fantasy-scoring.ts` | Player fantasy points are written at import (`pdl-admin-actions.ts:1102`, `:1298`, `:1452`). The leaderboards route reads a precomputed doc and returns "run fixed fantasy recalculation first" if absent (`leaderboards/route.ts:25`). The recalc is in FantasyPickemTab (admin); I did not confirm any automatic trigger. Wizard forces it off for Swiss. |
| Pick'em | `/[slug]/pickem/page.tsx`, `/api/pickem/export` | Users save a final-placement bracket in `tournaments/{id}/pickems/{uid}` (`page.tsx:252`, `:373`). The page maps score values up to 16 teams (`page.tsx:20-23`). I found no scoring or leaderboard code; the admin tab offers an export (`FantasyPickemTab.tsx:163`). Pick'em looks like submit-and-export only (inferred). A legacy root `pickems` collection is still used in `src/lib/firestore.ts:393-409`. |
| Card game | `/[slug]/cards`, `src/server/card-lab/*`, CardsTab, `/api/cards`, `/api/manage/cards` | Packs, finds, duels, round packs. Round packs and duel settling run from the orchestrate cron (`orchestrate/route.ts:70-82`). |
| Caster tools | `src/server/casters/casters.ts`, `/api/casters`, `src/components/account/CasterDesk.tsx`; `/[slug]/caster` per memory | Caster registration and take/drop of matches exist. The prototype versions in `caster-corner.md` were not verified as shipped. |
| Notifications / inbox | `src/server/notify/{events,notify,discord-dm}.ts`, `/api/inbox`, `/api/notify` | Events: reschedule, standin request, announcement, match time and "match in an hour" reminders. Reminders only fire when the orchestrate endpoint is called by the Conductor (`orchestrate/route.ts:60-64`). |
| Twitch | `src/app/api/twitch/live/route.ts` | The channel is hard-coded: `const TWITCH_CHANNEL = 'polishdota2inhouse'` (`:5`). A per-tournament `twitchUrl` exists (wizard and GeneralTab) and `TwitchEmbed` exists. The "channel points for packs" plan is TODO (`twitch-channel-points-plan.md`). |

## Single-tenant assumptions

- Slugs and IDs:
  - `getLeagueId` map for `letnia`, `letnia-2025`, `pdl`, `pdl-s1` (`definitions.ts:246-251`), fallback to 18559.
  - `TournamentContext.tsx` literals for `letnia`, `letnia-2025`, `pdl`.
  - Root redirect to `/wiosenna`; Footer fallback to `/wiosenna/account` (`src/components/layout/Footer.tsx:155`).
  - Slug list in `reserved-slugs.ts`; `sitemap.ts`.
- Hard-coded Polish in the wizard (all strings) and the pages.
- One Steam bot pool for the whole platform.
- The Discord gateway and inhouse code share the same Railway worker.
- The bot team-name matching uses PDL-style player IDs.

## Problems seen

- Two of the three repos in the brief's table are not what it says: the lobby bot that Railway runs is `bot-worker/` in the website repo, built from `feature/multi-tournament-platform`. The `inhouse bot/dota2-lobby-bot` repo is the old worker and is not deployed.
- Until S0's fix (`3db4e3e`, not yet in production), any signed-in visitor could change or delete the bot's Steam accounts through `/api/manage/bot/accounts`, which would stop automatic lobbies for every tournament.

- The wizard sets `leagueId: null` and `getLeagueId` falls back to Letnia's league 18559, so a new tournament with no league ID would sync Letnia's games (`tournaments.ts:155`; `definitions.ts:241`, `:255`).
- The creator page promises "wszystko w jednym miejscu" (everything in one place) and lists Fantasy League and Pick'em, but pick'em has no scoring code and Swiss tournaments get neither. It says nothing about lobbies, bot, results or domain, so I found no marketing claim for these on the pages I read (the creator and about pages; I did not read the landing or FAQ copy).
- No custom-domain support exists anywhere in the three repos. Tournaments are `/slug` paths only.
- Automatic results depend on the Conductor having `WEB_SYNC_URL` and `CRON_SECRET` set in the Railway dashboard (`conductor.js:50-62`). If either is missing the loop silently does nothing; per memory the old cron never fired on Firebase.
- Match reminders and card-pack rewards ride on that same 5-minute call, so they fail together with it.
- `getThemeBySlug` defaults every unknown slug to the Letnia theme, a fallback only used when the Firestore theme is absent (inferred).
- Twitch live check is hard-coded to one channel and ignores each tournament's `twitchUrl`.
- The wizard cannot create the current PDL S2 format (GSL/LAN).
- Bot is not wired to the wizard, and the dead `lobbySettings.botLobbyEnabled` flag misled `my-team` before 2026-10-22 (fixed).
- The `inhouse bot/dota2-lobby-bot` repo is not the deployed worker.
- `src/app/api/admin/**` is dead (middleware 410) and was ignored as instructed.
