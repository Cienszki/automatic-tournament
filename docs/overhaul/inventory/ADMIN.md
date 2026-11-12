# Admin inventory: the per-tournament admin panel and admin-like screens

Written in S0 (2026-11-13) by an explorer agent; Opus verified the bot-route auth gap (and fixed it, `3db4e3e`) and the dead fantasy-recalculation routes.

Method: read page.tsx, grepped every tab for fetch, Firestore writes, server actions and headings, and spot-read handlers. Cells marked "(inferred)" were not confirmed in code. I did not check Firestore security rules, the bot-worker, or the public pages beyond targeted greps for who reads a field. Line refs are in `src/app/[tournamentSlug]/admin/` unless noted. `T/` means `src/app/[tournamentSlug]/admin/tabs/`.

## Summary

- `page.tsx` (293 lines, 2026-11-06) mounts 16 tabs: general, structure, swiss, divisions, scheduling, teams, transfers, standins, matches, fantasy, playoffs, news, stats, rules, prizes, cards, bot. That is 17 ids (page.tsx:142-167).
- `TournamentLaunchCard` (draft publish checklist) renders above the tabs (page.tsx:213-216).
- Two tab files are not mounted: `GroupsTab` (512 lines, only re-exported by `T/index.ts:5`) and `StandinsTransfersTab` (418 lines, no importer). `index.ts` itself omits Swiss, Playoffs, Bot and Cards.
- Sizes (lines): BotTab 3070, GeneralTab 2753, MatchesTab 2417, SchedulingTab 1427, TeamsTab 1385, SwissTab 1304, DivisionsTab 972, RulesTab 953, StandinsTab 637, PlayoffsTab 642, PrizesTab 618, NewsTab 518, TournamentStructureTab 459, FantasyPickem 455, StatsTab 310, TransfersTab 287, CardsTab 255, ExtraMatchDialog 225, MatchPrepDataCard 134, swiss/LanQualifierCards 295. Total about 20.3k lines.
- Gating (page.tsx:63-76, 174-180):
  - Access is `checkIfAdmin(user, tournament.id)`, which POSTs `/api/checkAdmin`. It is true for a super admin (`admins/{uid}`) or a tournament admin (`tournaments/{id}/admins/{uid}`) (`api/checkAdmin/route.ts:25-43`).
  - There is no per-tab role split. Every admin sees every tab.
  - Only 4 tabs are filtered, by `tournament.type`: swiss is Swiss only; divisions and scheduling are league and mmr-limited; transfers is league only. A missing `type` shows all.
  - Format sub-gating inside tabs: `swiss.format==='lan-qualifier'` (SwissTab:123), `isMmrLimited` (DivisionsTab:848), `fantasy.enabled` and `pickem.enabled` (FantasyPickemTab:150-151), `isLegacyTournament` (slug `letnia`, `TournamentContext.tsx:136`) in StatsTab.
  - Super-admin-only UI is inside GeneralTab: the creators manager (GeneralTab:2601) and Bunny video deletion (GeneralTab:581).
- Dead API: `src/app/api/admin/**` was closed by `src/middleware.ts:16-20` (410) and was deleted in S0, with the modules only it used.
- Live write paths are three kinds:
  - Browser Firestore writes. These are most of the tabs, including `lib/swiss/actions.ts`, `lib/lan-qualifier/actions.ts` and `lib/api/groups.ts`, which are client-SDK code.
  - `/api/manage/**` routes.
  - Server actions: `lib/standin-actions.ts` ("use server") and `lib/playoff-sync-actions.ts`.
- Format coverage (inferred from the gating above): groups, Swiss and league each have a separate set-up tab.

## 1. Set up the tournament

| Control | Tab (file:line) | What it does | Writes | Formats | Last changed | Flag |
|---|---|---|---|---|---|---|
| Launch card (checklist, preview link, Publish) | page.tsx:215 -> `components/admin/TournamentLaunchCard.tsx:122,141` | Shown while draft. Publish sets status to registration and visibility to active. Creates/rotates `previewToken` | Firestore `tournaments/{id}` {status, visibility, previewToken} | all | 2026-11-07 | ok. The "Bot config" check tests `lobbySettings.leagueName` (:93), which only the General tab writes, though the hint points at the Bot tab (inferred mismatch) |
| Basic info (name, shortName, description, hero title/layout/media/video, leagueId, social URLs, Discord guild gate, trailer) | GeneralTab:642 | One big form; a single Save at the top | direct `updateDoc tournaments/{id}` (GeneralTab:491-560) | all | 2026-11-06 | ok. `leagueId` overlaps the Bot tab's "League ID (Valve)" (BotTab:1208), duplicate (inferred) |
| Status select (draft / registration / active / completed / archived) + visibility | GeneralTab:1341 | Lifecycle switch, manual | `tournaments/{id}.status`, `.visibility` | all | 2026-11-06 | ok |
| Dates and registration (start/end, reg start/end, maxTeams) | GeneralTab:1411 | Dates, team cap | `tournaments/{id}` | all | 2026-11-06 | ok |
| Tournament type (league / mmr-limited / swiss, mmrCap) | GeneralTab:1499 | Changes `type`, which changes which tabs show | `tournaments/{id}.type`, `.mmrCap` | all | 2026-11-06 | ok. Changing it mid-tournament is not guarded (inferred) |
| Lobby settings (leagueName, gameMode, server, visibility, DotaTV delay, late-penalty minutes) | GeneralTab:1251 | Used by player-facing match panels (`components/team/MatchPanel.tsx:271`, `PDLMatchRules.tsx:84`) and `api/manage/bot/sessions/route.ts:146` | `tournaments/{id}.lobbySettings` | all | 2026-11-06 | duplicate: the Bot tab has its own lobby settings and late policy (section 6) |
| Structure: teamSize, coachMode, schedulingMethod | TournamentStructureTab:142 (save :80) | Team size, coach rule, captain- vs admin-scheduled default | `tournaments/{id}` {teamSize, coachMode, schedulingMethod} | all (shown for Swiss too) | 2026-10-11 | ok. `coachMode` is read by `lib/coach-rules.ts` and MyTeamView; `teamSize` by team UI (inferred) |
| Structure: roundsPerSeason, defaultMatchFormat | TournamentStructureTab:203 | Rounds and default BOx | `tournaments/{id}` | league / mmr | 2026-10-11 | roundsPerSeason has no reader besides types and defaults (grep: only `TournamentContext`, `lib/api/tournaments.ts`, types). defaultMatchFormat is read by `about/page.tsx` only |
| Structure: promotionRelegation toggle | TournamentStructureTab:371 | Sets `promotionRelegationEnabled` | `tournaments/{id}` | league | 2026-10-11 | deprecated/dead: no reader outside defaults and types |
| Structure: playoffs on/off + teamsCount | TournamentStructureTab:279 | Sets `playoffs.enabled` and `.teamsCount`; the Playoffs tab refuses to open when off (PlayoffsTab:267-285) | `tournaments/{id}.playoffs.*` | all | 2026-10-11 | duplicate: `teamsCount` is also rewritten from the Playoffs bracket config (PlayoffsTab:210-218) |
| Structure: "playoff match format" and "grand final format" selects | TournamentStructureTab:62-63, 330-360 | Local state only, never saved (not in the :80 update) | none | any | 2026-10-11 | deprecated/dead controls. Formats are actually set in the Playoffs tab |
| Structure save triggers a full page reload | TournamentStructureTab:~95 | `window.location.reload()` after 1 s | | | | note |
| Fantasy and Pick'em enable | none in admin | `fantasy.enabled` and `pickem.enabled` are set at creation from the wizard (`lib/api/tournaments.ts:193,218`). Swiss forces false | | | | The panel has no toggle (verified: no admin write found); the Fantasy tab only shows "disabled" |
| Creator wizard (4 steps, 4 templates) | `src/app/creator/new/page.tsx:32-35` | Basic info, branding, structure, review -> `createTournament` | client Firestore `tournaments` + slug claim | all | 2026-11-06 | ok |

## 2. Branding and content

| Control | Tab | What it does | Writes | Last changed | Flag |
|---|---|---|---|---|---|
| Branding and colors (logo, inline logo, organizer logo, primary/secondary/accent/glow) | GeneralTab:1615 | Theme basics; Storage uploads via `lib/storage.ts` (`uploadTournamentLogo` etc.) | `tournaments/{id}.theme.*` | 2026-11-06 | ok |
| Text hierarchy colors | GeneralTab:1754 | Heading/title/section/primary/secondary text colors with preview | `theme.*` | 2026-11-06 | ok |
| Background settings | GeneralTab:1887 | Image, overlay, blur, position, favicon | `theme.*` | 2026-11-06 | ok |
| Advanced theme (card opacity/blur/radius, navbar style/colors, themeStyle) | GeneralTab:2010 | Expert knobs | `theme.*` | 2026-11-06 | unknown value: 30+ low-level fields (inferred) |
| Typography (fonts, custom fonts) | GeneralTab:2232 + `components/admin/FontManagement.tsx` (705 lines) | Header/text/readable/rules fonts; upload custom fonts | `theme.*Font`, `customFonts` | 2026-11-06 | ok |
| Navbar sponsor strip | GeneralTab:2377 | Slides, link, interval, width | `navbarSponsor` | 2026-11-06 | ok |
| Hero panels editor (image or video per panel, Bunny) | GeneralTab:1100 + `components/admin/HeroPanelsEditor.tsx` | Hero media; Bunny video via `/api/manage/hero-video` | `heroMedia`, `heroLayout`, `heroLeftImageUrl`, `heroRightImageUrl` | 2026-11-07 | duplicate: `heroLeftImageUrl`/`heroRightImageUrl`/`promotionalImageUrl` still saved beside `heroMedia` (inferred legacy) |
| News: create/edit/delete/publish posts + notify | NewsTab:278 (save :128-160, notify :112) | Posts with markdown/image | `tournaments/{id}/announcements` (direct); POST `/api/notify` | 2026-11-06 | ok |
| Rules: sections and numbered paragraphs, markdown toolbar | RulesTab:735, save :536 | Full-replace rewrite of rules via a write batch | `tournaments/{id}/rules/{s}` and `/paragraphs/{p}` (batch set/delete) | 2026-10-22 | ok. Save rewrites everything (inferred last-writer-wins). The `/api/rules-assistant` is player-side, not admin |
| Prizes: enable switch, display mode, image upload, prize CRUD, visibility | PrizesTab:97, 154-242 | Prize list or one image | `tournaments/{id}/prizes/*`; `tournaments/{id}.prizesEnabled/.prizesDisplayMode/.prizesImageUrl` | 2026-10-21 | ok |

## 3. Manage teams and players

| Control | Tab | What it does | Writes | Formats | Last changed | Flag |
|---|---|---|---|---|---|---|
| Team table: status select (pending / verified / rejected / eliminated), bulk Save | TeamsTab:459, 1077 | Registration approval via status | batch `teams/{id}.status` | all | 2026-10-22 | ok |
| Change captain (generates code) | TeamsTab:631 | Issues a one-time code | POST `/api/manage/captain-change-code` | all | 2026-10-22 | ok |
| Ban team | TeamsTab:598 | Ban with reason | POST `/api/manage/ban-team` | all | 2026-10-22 | ok |
| Delete team | TeamsTab:574 | Deletes team and players | batch delete `teams/{id}` + `players` | all | 2026-10-22 | ok |
| Sync Steam avatars | TeamsTab:260 | Refresh avatars and names | POST `/api/manage/sync-steam-avatars` | all | 2026-10-22 | ok |
| Refresh hero data | TeamsTab:293 | "Most played heroes" via OpenDota | POST `/api/player-heroes` | all | 2026-10-22 | overlaps `PlayerDataCard` in Stats (below) (inferred) |
| Swiss: edit team average MMR | TeamsTab:100-210, 544 | Saves immediately and renumbers seeds | `lib/swiss/actions saveSeedMmr`, `renumberSeeds` -> `teams/{id}` | swiss | 2026-10-22 | duplicate of Swiss tab seed list (comment at TeamsTab:1052) |
| Smurf URL resolving | TeamsTab:413-450 | Resolves vanity URLs | POST `/api/validate-steam` | all | 2026-10-22 | ok |
| Transfer window + limits | TransfersTab:68 | `transferWindowOpen`, per-window and per-season limits; read by `MyTeamView.tsx:369,1665` | `tournaments/{id}` | league only | 2026-02-17 | ok (oldest file) |
| "Recent transfers" and "Transfer window schedule" cards | TransfersTab:248, 268 | Static empty placeholders; the "Zaplanuj okno" button has no handler | none | league | 2026-02-17 | deprecated/placeholder |
| Standin appeals: approve / reject / undo, history, all requests list | StandinsTab:353, 506, 577 (actions :178, 209, 240) | Resolve appeals against rejected standin requests | server actions `approveStandinAppeal`, `rejectStandinAppeal`, `undoStandinAppealResolution` (`lib/standin-actions.ts:508-622`); reads `standinRequests` | all | 2026-10-22 | ok |
| Standin rules (maxPerRound, requireOpponentApproval) + window + mock requests | `StandinsTransfersTab` (unmounted; save :99) | Never reachable; contains hard-coded mock requests (:62) | `tournaments/{id}.standins.*`, `transferWindowOpen` | league | 2026-10-22 | deprecated/dead. No reader found for `standins.maxPerRound` outside the tab, so the live panel has no UI for standin limits |
| Casters manager | GeneralTab:2750 -> `components/admin/CastersManager.tsx` | Manage casters | `/api/manage/casters` | all | 2026-11-07 | ok, but filed under General |

## 4. Build the structure

| Control | Tab | What it does | Writes | Formats | Last changed | Flag |
|---|---|---|---|---|---|---|
| Divisions/groups CRUD (name, tier, color, medal upload, theme, highlights) | DivisionsTab:402-660, save :195 | Tab label is "Dywizje" for league, "Grupy" for mmr-limited | `tournaments/{id}/divisions/{d}` setDoc, deleteDoc; Storage `.../divisions/{d}/medal.png` | league, mmr | 2026-10-22 | ok |
| Team assignment to division | DivisionsTab:710, :336-344 | Moves teams | `teams/{id}.divisionId` | league, mmr | 2026-10-22 | duplicate: the old Groups tab used `groupId` instead (below) |
| Generate group round-robin matches | DivisionsTab:848-905 | Creates all pairs with a captain-scheduling deadline; skips existing | `lib/api/groups.generateGroupMatches` (client SDK) -> `matches` | mmr-limited only | 2026-10-22 | duplicate: Scheduling tab also generates matches (section 5) |
| Recalculate division standings | DivisionsTab:926, fetch :942 | Recompute W/L/pts | POST `/api/manage/pdl/recalculate-standings` | all | 2026-10-22 | duplicate: same button logic is in MatchesTab (section 7) |
| GroupsTab (assign teams to `groups`, group CRUD) | `T/GroupsTab.tsx:219` | Unmounted. Writes `teams.groupId` and `groups` | `lib/api/groups saveGroup`, `teams/{id}.groupId` | n/a | 2026-10-22 | deprecated/dead (page.tsx never imports it) |
| Swiss tab: tournament field (setup, bye team) | SwissTab:611-655 | Sets Swiss division, seeds, bye | `setupSwissField`, `ensureByeTeam` -> `teams`, `divisions/swiss`, `tournaments/{id}` | swiss | 2026-11-06 | ok |
| Swiss: MMR pairing band | SwissTab:367, 677 | `swiss.pairingBand` with an advisor | `tournaments/{id}.swiss.pairingBand` | swiss (MMR seeding) | 2026-11-06 | ok |
| Swiss: seed list and edit MMR | SwissTab:814 | | `saveSeedMmr`, `renumberSeeds` | swiss | 2026-11-06 | duplicate: also in TeamsTab |
| Swiss: round draft (generate, save pairings/scheduling, commit, reopen, mark complete, round "reschedule latest") | SwissTab:926-1260 | Sequential round workflow. Commit turns a draft into `matches` | `lib/swiss/actions` -> `swissRounds/{n}`, `matches`, `tournaments/{id}` | swiss | 2026-11-06 | ok. `forceMatchResult` and `deleteRoundDraft` exist in lib but SwissTab does not use them (grep) |
| Swiss: standings table (points, Buchholz) | SwissTab:1245 | Read-only; "advance to playoffs by hand" (text) | none | swiss (standard) | 2026-11-06 | ok |
| LAN qualifier: format switch, Group A pick, tiebreak decision, status cards, GSL group stages | SwissTab:605, 875-895, 1241; `T/swiss/LanQualifierCards.tsx` | Alternate Swiss format `swiss.format==='lan-qualifier'` | `lib/lan-qualifier/actions` -> `tournaments/{id}.swiss.*`, `swissRounds/{n}` | swiss, LAN | 2026-11-06 | ok |
| Playoffs: bracket config (format, UB/LB teams, round formats), seed teams, generate/regenerate, per-match edit | PlayoffsTab:314-640, save :150-218 | Writes `playoff_matches` and mirrors each playable match into `matches` with the same id | direct `setDoc` `playoff_matches/*`, `matches/*` (merge for mirror), `tournaments/{id}.playoffs.*` | all (not gated by type) | 2026-10-21 | ok. Shown for Swiss and unclear whether it applies (inferred) |
| Playoffs visibility toggle | PlayoffsTab:236 | `playoffs.playoffsVisible` | `tournaments/{id}` | all | 2026-10-21 | ok |

## 5. Schedule

| Control | Tab | What it does | Writes | Formats | Last changed | Flag |
|---|---|---|---|---|---|---|
| 2-phase schedule generator (pairs, then dates) -> finalize | SchedulingTab:704, 317, 370 | Generates round matches (`lib/schedule-generator.ts`) with admin-set dates; notify prompt after | batched `setDoc` `matches/*` (500 per batch, :471-476) | league, mmr | 2026-11-06 | duplicate of DivisionsTab "generate group matches" |
| Delete round matches | SchedulingTab:559 | Batch-delete matches of a round | batch delete `matches` | league, mmr | 2026-11-06 | ok |
| Reschedule rules (range days, final date, earlier-only) | SchedulingTab:1100, 1166 | Used by `lib/reschedule-rules.ts` | `tournaments/{id}.reschedule*` | league, mmr | 2026-11-06 | ok |
| Reschedule requests list | SchedulingTab:1206 | Read-only; no buttons (:1240-1275) | none | league, mmr | 2026-11-06 | unknown/partial (inferred: resolution happens elsewhere) |
| "Created matches" list | SchedulingTab:1279 | Overview | none | | 2026-11-06 | ok |
| Matchdays list, manual entry (comment "Legacy") | SchedulingTab:984, 1370; save :258 | Manual matchday editor | `tournaments/{id}.matchdays` | league, mmr | 2026-11-06 | deprecated: `matchdays` is written only here (no reader found by grep; the carousel builds its own) |

## 6. Run matches (bot, lobbies, casters)

| Control | Tab | What it does | Writes | Last changed | Flag |
|---|---|---|---|---|---|
| Bot view switcher (settings, monitor, accounts) | BotTab:759 | 3 sub-views in 3070 lines | | 2026-10-22 | ok |
| Bot enable, status | BotTab:1044 | `config.enabled` | POST `/api/manage/bot/config` -> `tournaments/{id}/config/bot` | 2026-10-22 | ok |
| Lobby settings (mode, server, pauses, DotaTV, league ID, lobby open minutes, spectators, cheats, fill) | BotTab:1068-1270 | | same | 2026-10-22 | duplicate of GeneralTab lobby settings (`lobbySettings`) |
| Ready check: ready/not-ready commands | BotTab:1286 | | same | 2026-10-22 | ok |
| Chat messages and custom commands | BotTab:1387, 1495 | | same | 2026-10-22 | ok |
| Post-match (auto-sync, delay, close phases) | BotTab:1574-1730 | | same | 2026-10-22 | ok |
| Enforcement (kick unauthorized, show password) | BotTab:1757 | | same | 2026-10-22 | ok |
| Late policy (forfeit thresholds, wait vote) | BotTab:1804-1870 | | same | 2026-10-22 | duplicate: GeneralTab has `latePenaltyGameMinutes` and `latePenaltySeriesMinutes` |
| Bot personality | BotTab:2040 | | same | 2026-10-22 | unknown purpose (inferred cosmetic) |
| Lobby whitelist | BotTab:2134 | Allowed players; managed separately | `/api/manage/bot/whitelist` | 2026-10-22 | ok |
| Bot pool, manual test (create session), run orchestrator, active sessions | BotTab:2327, 2385, 2473 | | `/api/manage/bot/pool-status`, `/sessions`, `/orchestrate` | 2026-10-22 | ok |
| Bot Steam accounts (add/edit/delete) | BotTab:2601-2858 | Credentials for bot accounts | `/api/manage/bot/accounts[/id]` | 2026-10-22 | ok, but see Problems (auth) |
| Casters | GeneralTab:2750 | see section 3 | | | |

## 7. Fix results (imports, forfeits, recalcs)

All in MatchesTab (2417 lines, 2026-11-06) unless noted.

| Control | Line | What it does | Writes | Formats | Flag |
|---|---|---|---|---|---|
| Match list table (score inputs, status, Save) | :1384, save :321 | Hand-edit scores/status. Score input is clamped to 0-3 (:671). Derives `winnerId`, then syncs playoff bracket via `syncPlayoffResultFromMirror` | direct batch `matches/{id}` {teamA.score, teamB.score, status, winnerId} | all | ok. 0-3 clamp contradicts BO5 (inferred) |
| Sync matches (pull Dota results; then standings + stats recalc) | :552, :501-518 | | POST `/api/manage/pdl/sync-matches`, then `/api/manage/pdl/recalculate-standings` (league only), `/api/stats/recalculate` | all | ok. The Stats tab and Divisions tab have their own recalc buttons, duplicate |
| Add match (tiebreak, showmatch, rematch) | ExtraMatchDialog:120 (renders in MatchesTab:1066) | Out-of-plan matches; rematch replaces the original | POST `/api/manage/extra-match`; DELETE same | all | ok |
| Games dialog: view and delete a game | :1678, delete :774 | | POST `/api/manage/pdl/delete-game` | all | ok |
| Force import game (preview -> import) | :1107, :390-490 | Import by Dota match ID | POST `/api/manage/pdl/preview-game`, `/force-import-game` | all | ok |
| Force schedule | :1784, :879 | Admin sets a time | POST `/api/manage/pdl/force-schedule-match` | all | ok |
| Walkover / forfeit and revert | :1861, :920; :2131, :820 | | POST `/pdl/forfeit-match`, `/pdl/revert-forfeit` | all | ok |
| Draft penalty (add/remove) | :2013, :677-699 | | direct `matches/{id}.draftPenalties` | all | ok |
| Skipped games (add/remove, list) | :2220, :2345; :194-244 | Exclude Dota games from import | `/api/manage/pdl/skipped-games` | all | ok |
| Delete one match / Delete ALL matches | :1639, :1605 (deleteAll :749) | Extra matches go through the API; others delete directly | DELETE `/api/manage/extra-match` or direct `deleteDoc`; all-delete is a direct batch on the whole `matches` collection | all | ok. "Delete all" has no tournament-type guard (inferred) |
| "Import match from OpenDota" dialog | :1281, handler :602 | `handleImportMatch` is a stub (`// TODO`, `setTimeout`). Nothing opens the dialog (`setShowImportDialog(true)` is never called) | none | | deprecated/dead |
| Stats: Recalculate stats / Recalculate rankings | StatsTab:90, :124 | | POST `/api/stats/recalculate`, `/api/rankings/recalculate` (rankings disabled for legacy `letnia`) | all | duplicate of MatchesTab post-sync recalc |
| Match-prep data card (draft heroes) and player data card | MatchPrepDataCard:17, :69 (rendered StatsTab:306-307) | Refresh the hero/history cache used by match prep | `/api/manage/draft-prep-heroes`, `/draft-prep-histories`, `/api/player-heroes` | all | overlaps TeamsTab "refresh heroes" (inferred) |
| Stats preview of existing data | StatsTab:263 | "Most-picked hero" preview reading `playerStats`/`teamStats` | none (reads) | all | ok |

## 8. Viewer features

| Control | Tab | What it does | Writes | Last changed | Flag |
|---|---|---|---|---|---|
| Fantasy rounds (create, set current, delete, lock deadline) | FantasyPickemTab:87-139 | Only shown if `fantasy.enabled` | direct `tournaments/{id}/fantasyRounds` | 2026-10-21 | ok. The fantasy recalculation routes (`recalculateFantasy*`) existed only under the closed `/api/admin` and were deleted in S0 with their modules. No admin control recalculates fantasy totals |
| Pick'em settings (bye count, deadline, instructions) + CSV export | FantasyPickemTab:167, 161 | | direct `tournaments/{id}.pickem.*`; GET `/api/pickem/export` | 2026-10-21 | ok |
| Cards: settings (packs per round, how-to text, Twitch channels) | CardsTab:121 | | PUT `/api/manage/cards` | 2026-11-06 | ok |
| Cards: give packs by hand | CardsTab:153 | | GET search, POST grants | 2026-11-06 | ok |
| Cards: bug reports (list, download, mark done) | CardsTab:227 | | GET/PATCH `/api/manage/cards` | 2026-11-06 | ok |
| Stats, Prizes, News | see sections 2 and 7 | | | | |

## 9. Access and roles

| Control | Where | What it does | Writes | Flag |
|---|---|---|---|---|
| Tournament admins (list, search user by email, add, remove) | GeneralTab:2606; lines 358-460 | Visible to every admin. API routes check the `admins` collection (super admin) | `/api/manage/tournament-admins`, `/api/manage/search-user` -> `tournaments/{id}/admins/{uid}` | ok. A non-super tournament admin sees the card but the calls return 403 (inferred from `tournament-admins/route.ts:23-30,85-90`) |
| Tournament creators allowlist | GeneralTab:2601 (super only) -> `components/admin/TournamentCreatorsManager.tsx` | Who may use the wizard | `/api/manage/tournament-creators` -> `tournamentCreators/{uid}` | ok |
| Organizer dashboard `/organizer` (354 lines, 2026-11-06) | `src/app/organizer/page.tsx` | "Your tournaments", "Redirects between editions" (`redirectToSlug`), "Your series" | client `setTournamentRedirect` -> `tournaments/{id}.redirectToSlug` (`lib/api/tournaments.ts:571`) | ok. GeneralTab deliberately does not write `redirectToSlug` (GeneralTab:~533 comment) |
| Creator `/creator` (233 lines) and `/creator/new` (307 lines) | `src/app/creator/` | Template picker (mmr-limited, league, swiss, custom) + wizard. Access via `/api/creator/access` (super admin or allowlist) | `createTournament` (client Firestore) | ok |
| `/api/checkAdmin`, dev `/api/dev/makeAdmin` | `src/app/api/` | Admin check; the dev route returns 403 when `NODE_ENV==='production'` | `admins/{uid}` | ok |

## 10. Unknown or unreferenced

- `components/admin/GameDeleteModal.tsx`, `MatchImportModal.tsx`, `PlayoffMonitor.tsx`, `components/app/admin/FakeTeamGenerator.tsx` have no importer (grep). They are orphans.
- Bot "Personality" (BotTab:2040): purpose is unclear from the label.
- GeneralTab "Advanced theme": 30+ fields, likely rarely used (inferred).

## Problems seen

- The panel is a flat 17-tab strip with no role split. Setup, live operations, and destructive actions are all in one place.
- Unmounted code: `GroupsTab`, `StandinsTransfersTab` (with hard-coded mock requests), and 4 orphan components.
- Duplicate jobs:
  - Generating group matches: DivisionsTab:848 and SchedulingTab:317.
  - Standings recompute: DivisionsTab:942, MatchesTab:501 and the Extra-match API.
  - Stats recalc: StatsTab:96 and MatchesTab:518.
  - Lobby settings: GeneralTab `lobbySettings` vs BotTab `config/bot`; `leagueId` vs Valve League ID; the late-penalty minutes in two places.
  - Hero refresh: TeamsTab:293 and MatchPrepDataCard.
  - Swiss seed MMR: TeamsTab and SwissTab.
  - Playoff `teamsCount`: Structure tab and Playoffs tab.
  - Two group models exist side by side: `teams.divisionId` (live) and `teams.groupId` + `groups` (dead tab).
- Dead or no-op controls:
  - Structure playoff and grand-final format selects (never saved).
  - `promotionRelegationEnabled` and `roundsPerSeason` (no behavioural reader).
  - TransfersTab history and schedule cards.
  - The MatchesTab OpenDota import dialog (stub, unreachable).
  - SchedulingTab "Legacy" matchdays list (`matchdays` unread).
  - Reschedule requests are shown with no actions.
  - No UI to change standin limits (`standins.*`).
- Structure tab is shown for Swiss, but its league-oriented fields (rounds, promotion) are meaningless there (inferred). The Playoffs tab is shown for all types.
- Auth gap, fixed on `overhaul` in S0 (`3db4e3e`) but still live in production: `/api/manage/bot/accounts`, `accounts/[id]`, `pool-status` and `whitelist` verified only that the caller had a valid Firebase token, so any signed-in visitor could manage the bot's Steam accounts. `bot/config`, `bot/sessions`, `captain-change-code`, `pdl/sync-matches` and `hero-video` still use their own `admins` lookups instead of `requireAdmin` (not reviewed for correctness).
- Many direct browser Firestore writes (teams, matches, rules, divisions, swissRounds, playoff_matches, "delete all matches"). Enforcement depends entirely on `firestore.rules`, which I did not read.
- Two save patterns: GeneralTab is one giant form-save writing about 90 fields; others save immediately. Several tabs call `window.location.reload()` after saving (Structure, Scheduling).
- Several tabs have an `alert()`-based save and `console.log`-heavy handlers (SchedulingTab:~470-520).
- Staleness: `TransfersTab` last changed 2026-02-17, `TournamentStructureTab` 2026-10-11, and most tabs 2026-10-21 to 2026-11-06. Dates are per file, so the big files hide individual older sections.
- The Launch card checks `lobbySettings.leagueName` but tells the user to use the Bot tab. Fantasy and Pick'em have no on/off switch after creation.
- Not checked: `firestore.rules`, bot-worker, `lib/api/tournaments.ts` `createTournament` field list, the exact UI of `components/creator/steps/*`.
