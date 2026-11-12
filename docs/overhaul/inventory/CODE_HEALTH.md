# Code health inventory

Written in S0 (2026-11-13). An explorer agent built an import graph and read the stats and fantasy modules. Opus checked the fantasy formulas and recounted everything after S0's deletions.

Size after S0: 638 `.ts/.tsx/.js` files and 140,514 lines in `src` (before S0: about 736 files and 156k lines), 323 files with `"use client"`, and 26 test files.

## 1. Largest files (top 30 after S0, `wc -l`)

| Lines | File | What it does |
|---|---|---|
| 3070 | `src/app/[tournamentSlug]/admin/tabs/BotTab.tsx` | Lobby-bot admin UI |
| 2754 | `src/app/[tournamentSlug]/admin/tabs/GeneralTab.tsx` | Tournament settings tab (uses `checkAdmin`) |
| 2417 | `src/app/[tournamentSlug]/admin/tabs/MatchesTab.tsx` | Match admin tab |
| 2200 | `src/lib/pdl-admin-actions.ts` | PDL match import, game save and delete server logic (25 exports) |
| 2172 | `src/lib/comprehensive-stats-calculator.ts` | Writes tournament, player and team record stats to Firestore |
| 2108 | `src/components/tournament/TeamsView.tsx` | Teams view. Unreachable from non-admin roots, so dead |
| 1859 | `src/components/team/MyTeamView.tsx` | Captain "my team" page |
| 1830 | `src/lib/translations.ts` | Hard-coded PL/EN dictionary (3 importers) |
| 1743 | `src/components/card-lab/OutpostsGame.tsx` | Card-lab game |
| 1561 | `src/lib/admin-actions.ts` | Legacy `'use server'` match/team admin actions (32 exports) |
| 1427 | `src/app/[tournamentSlug]/admin/tabs/SchedulingTab.tsx` | Scheduling admin |
| 1385 | `src/app/[tournamentSlug]/admin/tabs/TeamsTab.tsx` | Teams admin |
| 1304 | `src/app/[tournamentSlug]/admin/tabs/SwissTab.tsx` | Swiss admin |
| 1259 | `src/components/app/PlayoffBracketDisplay.tsx` | Live legacy bracket, used by `app/playoffs/page.tsx:5` |
| 1250 | `src/components/app/PlayoffBracketDisplay-old.tsx` | Dead backup copy |
| 1142 | `src/components/tournament/FullScreenHomePage.tsx` | Home page |
| 1127 | `src/app/[tournamentSlug]/register/page.tsx` | Pickem page |
| 1091 | `src/lib/playoff-management.ts` | Legacy playoff data and advancement |
| 1028 | `src/components/team/SquadView.tsx` | Squad view |
| 1004 | `src/components/layout/TournamentNavbar.tsx` | Navbar |
| 986 | `src/app/stats/page.tsx` | Pickem page |
| 972 | `src/app/[tournamentSlug]/admin/tabs/DivisionsTab.tsx` | Divisions admin |
| 953 | `src/app/[tournamentSlug]/admin/tabs/RulesTab.tsx` | Rules admin |
| 913 | `src/lib/firestore.ts` | Browser-SDK Firestore helpers (35 exports) |
| 899 | `src/lib/draft-prep/engine.ts` | Draft-prep engine |
| 886 | `src/types/tournament.ts` | Tournament types |
| 840 | `src/components/pdl/my-team/PDLStandinRequest.tsx` | PDL standin request. Unreachable |
| 793 | `src/app/[tournamentSlug]/pickem/page.tsx` | Pickem page |
| 763 | `src/lib/animations.ts` | Framer Motion presets (not read in detail) |
| 763 | `src/components/ui/sidebar.tsx` | shadcn/ui sidebar, unused |

## 2. Duplicated logic

### 2a. Stats and fantasy module map

"Non-admin importers" excludes `api/admin`. The last column is importers from `api/admin` only.

| Module (lines) | Non-admin importers | Admin | Computes |
|---|---|---|---|
| `comprehensive-stats-calculator.ts` (2171) | `pdl-admin-actions`, `stats-calculator-admin`, `stats-service-simple` | 1 | Tournament, player and team records, including `calculateTotalFantasyPoints` (`:1956`) |
| `stats-calculator-basic.ts` (443) | `stats-service-simple` imports it but never calls `recalculateBasicTournamentStats` (S0 checked); `stats-calculator-admin` uses its helpers | 0 | Basic tournament stats, bloodiest match, richest player |
| `stats-calculator-admin.ts` (119) | `post-sync-recalculations` | 0 | Admin wrapper for the basic stats, including a `...Legacy` variant |
| `stats-service-simple.ts` (51) | `api/import-match`, `api/manage/bot/orchestrate`, `api/stats/recalculate`, `admin-match-actions-server` | 0 | Orchestrator: `recalculateBasicTournamentStats` → comprehensive → `performance-rankings-calculator` (`:5,16,22`) |
| `stats-definitions.ts` (253) / `stats-types.ts` (167) | the comprehensive, basic and old calculators | 0 | Definitions and types |
| `performance-score.ts` (103) | `card-lab/cards`, `performance-rankings-calculator`, `stats-lab/derive` | 0 | Per-game rating v2 (`calcPerformanceScore`) |
| `performance-rankings-calculator.ts` (303) | `api/admin-sync-matches`, `api/rankings/recalculate`, `RankingsView`, `pdl-admin-actions`, `stats-service-simple` | 0 | Rankings |
| `fantasy-scoring-admin.ts` (348) | `match-reprocessing-admin`, `post-sync-recalculations`, `unified-game-save` | 5 | Does NOT compute per-player points. It sums stored `perf.fantasyPoints` into user lineups (`:28-34`, `:60-66`) |
| `pdl-fantasy-scoring.ts` (86) | `pdl-admin-actions` only | 0 | Flat per-player formula, used at `pdl-admin-actions.ts:1102,1298,1452` |
| `fantasy-types.ts` | `fantasy-enhanced-admin` (admin-only), `components/fantasy/PlayerDetailModal` (unreachable) | 0 | ADMIN-ONLY in effect |
| `post-sync-recalculations.ts` (250) | `api/import-match`, `unified-game-save` | 0 | Orchestrates stats and fantasy recalculation. It has its own `recalculateFantasyScoresAdmin` (`:153`) |
| `unified-game-save.ts` (308) | `admin-actions` (dead, many dynamic imports), `admin-match-actions-server` | 3 | Game save |
| `stats-lab/*` (9 files, 1399 lines total) | 54 importers for `derive` alone: stats-hub, stats-lab, draft-prep, card-lab, teams-section, `api/stats/dataset` | 0 | A separate, live, client-side derived-stats layer. Its own `derive/metrics/season/achievements` re-derive MVP (`derive.ts:200`) and records |

### 2b. The same quantity computed differently: per-player fantasy points

Four live or semi-live formulas exist.

1. **Role-based, at import time.** `src/lib/opendota.ts:285` `calculateFantasyPoints(p, player, isRadiant)` is called from `transformMatchData` at `:589` and stored as `fantasyPoints` at `:623`. It has a per-role branch for Carry, Mid, Offlane, Soft Support and Hard Support.
   - Win `+5` (`:316`), first blood `+12`, `towerDamage / 1000`, courier kills `*10`.
   - `deaths * -0.7` (`:328`). Kills are `kills * 2.5` for Carry (`:337`), `3.8` for Mid (`:359`), `3.0` for Offlane (`:397`), `1.9` for Soft Support (`:435`), and `1.6` or `1.3` for Hard Support (`:455`, `:460`).
   - Used by `actions.ts`, `admin-actions.ts`, `match-reprocessing-admin.ts` and `api/import-match`.
2. **PDL flat formula.** `pdl-fantasy-scoring.ts:8-60`:
   ```
   killPoints 0.3, deathPoints 0, assistPoints 0.15, lastHitPoints 0.003,
   gpmPoints 0.002, xpmPoints 0.002, towerKillPoints 0.75, roshanKillPoints 0.5,
   obs/sen 0.05, teamWinPoints 4
   ```
   It is applied by `pdl-admin-actions.ts:1102` ("Recalculate fantasy points using PDL scoring"), which overwrites the stored values for PDL.
3. **Roll-up formula.** `comprehensive-stats-calculator.ts:1956-2008` `calculateTotalFantasyPoints`, labelled "standard fantasy scoring formula", feeds `totalFantasyPoints` at `:526`.
   - Win `+5`, `kills*2`, `assists*1`, `-deaths*0.5`, a GPM bonus above 400, a CS-per-minute bonus, a damage-per-minute bonus.
   - Obs `*1`, sentry `*0.5`, floored at 0 per game, then rounded.
   - It ignores the stored `fantasyPoints`, so an aggregate total can disagree with the sum of stored per-game points.
4. **UI copy.** `components/fantasy/FantasyScoreCalculator.tsx:118,164` hard-codes `Mid Kills × 3.8` and `Carry Kills × 2.5`, mirroring formula 1 by hand. The `opendota.ts` comments say "MAJOR increase from 3.0".

Side by side on kills and deaths:

| Source | Kill | Death | Win bonus |
|---|---|---|---|
| `opendota.ts:337` (Carry) | 2.5 | -0.7 (`:328`) | 5 |
| `pdl-fantasy-scoring.ts:9-10` | 0.3 | 0 | 4 |
| `comprehensive-stats-calculator.ts:1978` | 2 | -0.5 | 5 |

Other repeated computations:
- `scripts/` holds 22 fantasy/scoring scripts, such as `balanced-fantasy-scoring.js`, `equalized-fantasy-scoring.js` and `exact-fantasy-formula.js`. They are probably older formula experiments (inferred).
- KDA is computed inline in `comprehensive-stats-calculator.ts:1012` and `:1075`. Other copies were not checked.
- `performance-score.ts` is a fifth scoring formula (rating, not fantasy points).
- Fantasy user-total aggregation exists in `fantasy-scoring-admin.ts`, `fantasy-enhanced-admin.ts:631`, `fantasy-recalc-fixed.ts:96` and `post-sync-recalculations.ts:153`, plus `firestore.ts:470` `getFantasyLeaderboard`.

### 2c. Other duplicate layers

| Area | Files | Fact |
|---|---|---|
| Firestore helpers | `firestore.ts` (browser SDK, 35 exports, 23 non-admin importers), `actions.ts` (5 exports, 3 importers), `admin-actions.ts` (32 exports, `'use server'`, Admin SDK), `pdl-admin-actions.ts`, `lib/api/*` (`tournaments.ts` 594 lines), `lib/api.ts` (26-line fetch wrapper, only `api/index.ts` imports it, both UNREACHABLE) | `src/lib/api.ts` and `src/lib/api/` coexist. `getTeamById` is defined in both `firestore.ts:205` and `api/teams.ts:62` |
| Team loaders | `firestore.ts:179` `getAllTeams`, `admin-actions.ts:10` `getAllTeamsAdmin` (+ `getTeams` alias `:698`), `server/lib/getAllAdmin.ts:4` (UNREACHABLE; also named `getAllTeamsAdmin`), `team-players-loader.ts:71`, `lib/team.ts` (30 lines, UNREACHABLE) | Raw `collection(...'teams')` appears in 53 files (`grep`) |
| Steam ID | canonical `steam-id-utils.ts:17,31` (9 non-admin importers) | The literal `76561197960265728` is inlined in 34 places across 18 files (`grep`) |
| Admin SDK init | `src/server/lib/admin.ts` vs `src/lib/admin.ts` (13 importers). A third, `src/lib/firebase-admin.ts`, was deleted in S0 | Two files for one concern |
| Admin-lists | `src/server/lib/getAllAdmin.ts`, `getAllMatchesAdmin.ts` | Wrappers; `getAllMatchesAdmin` is ADMIN-ONLY |
| Playoff systems | Legacy: `playoff-management.ts` (1091 lines; importers `app/playoffs/page.tsx`, `PlayoffContext`, `playoff-automation`), `playoff-automation.ts` (UNREACHABLE), `PlayoffContext.tsx` (UNREACHABLE), `PlayoffBracketDisplay.tsx` (used by `app/playoffs/page.tsx`), `bracketConverter.ts` (unreachable; `gLootBracketConverter.ts` deleted in S0) | The root `/playoffs` page still builds but `next.config.mjs:143` redirects it to `/letnia/playoffs`, so the legacy playoff path is never served |
| | New: `playoff-bracket-generator.ts` (10 importers), `playoff-advancement.ts`, `playoff-mirror.ts`, `playoff-result-bridge.ts`, `playoff-sync-actions.ts`, `components/playoffs/MirroredPlayoffBracket.tsx`, `[tournamentSlug]/playoffs/page.tsx` | |
| | Dead copies: `PlayoffBracketDisplay-old/-new/-backup/.backup.tsx`, `app/playoffs/page-new.tsx`, `components/playoffs/PlayoffBracket.tsx` and `PlayoffBracketView.tsx` | `pdl-admin-actions.ts` imports `playoff-result-bridge` |

## 2d. Deleted in S0

Commit `e486269` deleted the closed routes and everything that only they used. Each step was checked with `tsc`.

- `src/app/api/admin/**` (60 routes), `src/app/api/admin-sync-matches` and `src/app/api/admin-import-manual-matches`. The middleware returned 410 for all of them, because they share the `/api/admin` prefix. The 410 rule stays.
- 21 modules left with no importer, found in two rounds: `admin-match-actions`, `announcement-actions`, `api.ts`, `api/index`, `api/matches`, `api/teams`, `bot/bot-agent` (1,452 lines), `bot/lobby-lifecycle`, `bracketStyles`, `cron-sync.js`, `fantasy-enhanced-admin`, `fantasy-recalc-fixed`, `firebase-admin`, `gLootBracketConverter`, `group-actions`, `match-reprocessing-admin`, `stats-calculator`, `stats-service` (empty), `team`, `server/lib/getAllAdmin` (the root `server/lib/` copy is the one `api/import-match` uses) and `server/lib/getAllMatchesAdmin`.
- Root one-off scripts: `test-fantasy-data.js`, `test-firestore-write.js`, `test-import.js`, `test-match-import.js`, `test-stats-update.js`, `encode_sa.py`, `fetch-league-matches.py` (empty), `cleanup-archive.mjs` and `_pickem_analysis/`.

That is about 15,000 lines. Callers of `/api/admin` remain in five places, all already broken by the 410:

- localhost debug calls in `scripts/complete-detailed-leaderboard.js`, `find-gandalf1k-all-games-database.js`, `simple-fantasy-leaderboard.js`, `trigger-full-recalculation.js` and `verify-gandalf1k-database.js`;
- operator instructions in `docs/LOBBY_BOT_SYSTEM.md:274-279,545-558,712`, `docs/LOBBY_BOT_TESTING.md:1190` and `docs/LOBBY_BOT_ABUSE_ANALYSIS.md:318`;
- comments only: `MatchesTab.tsx:513` and `bot-worker/dist/scheduling.js:4`.

## 3. Dead code still present

Method: an import graph over `src` (static, dynamic and `require` imports, `@/` and relative paths). It starts from every `page`, `layout`, `route`, `loading`, `error`, `not-found`, `robots` and `sitemap` file, plus `middleware.ts`, `i18n/request.ts`, the tests and `src/ai/*`. After S0, **108 files (18,075 lines) are unreachable**:

- Admin tabs that are never mounted: `GroupsTab.tsx` (512 lines), `StandinsTransfersTab.tsx` (418) and `tabs/index.ts`.
- Bracket copies: `PlayoffBracketDisplay-old.tsx` (1,250), `-new` (491), `-backup` (422) and `.backup.tsx`; `app/playoffs/page-new.tsx` (323); `components/playoffs/PlayoffBracket.tsx` and `PlayoffBracketView.tsx`; `context/PlayoffContext.tsx`.
- Whole families of old home and team views:
  - `components/tournament/TeamsView.tsx` (2,108), `LeagueHomePage` and `MmrTournamentHomePage`;
  - `components/tournament/mmr/*` (9 files);
  - `components/pdl/*` (10) and `components/pdl/my-team/*` (10);
  - `components/letnia/*` (9), `components/themed/*` (5) and `components/landing/*` (3);
  - `components/divisions/{DivisionRecords, DivisionStatsDashboard, QuickStatsCards, TeamComparisonTool}`.
- Fantasy experiments: `components/fantasy/*Leaderboards*`, `Simple3DTest*`, `EnhancedLoadingScreen`, `PlayerDetailModal` and `TestLeaderboards`; `app/fantasy/LeaderboardRow.tsx`.
- Single files:
  - `components/admin/{GameDeleteModal, MatchImportModal, PlayoffMonitor}`;
  - `components/app/{HeroPieChart, MatchListItem, PlayoffProgress}` and `components/app/admin/FakeTeamGenerator`;
  - `components/app/home/{HomeBanner, InfoWidgets, getHomePageData}` and `components/app/my-team/{NextMatchCard, PlayerAvatar}`;
  - `components/layout/{Logo, ThemeProvider}`.
- Unused shadcn/ui parts: `ui/{MatchSummary, PremiumDropdown (empty), chart, command, menubar, radio-group, sidebar, skeleton, slider}`.
- Hooks: `use-websocket`, `useGlobalPlayerProfile` and `usePageSize`.
- `src/lib` modules reachable only from the dead files above: `bracketConverter`, `fake-team-action`, `fantasy-types`, `playoff-automation` and `twitch`.

Some legacy pages still build but cannot be opened. The root pages `src/app/{teams, groups, schedule, playoffs, fantasy, pickem, stats, rules, faq, standins, register, my-team}/page.tsx` are permanently redirected to `/letnia/...` by `next.config.mjs:132-151`, but each `page.tsx` still counts as an entry point. `src/app/teams/[teamId]` and its `players/[playerId]` page are not covered by the redirects and are still served. These pages keep much of `src/lib/firestore.ts` and the root (legacy) collections alive.

Candidates outside `src`, which S0 does not delete in `_archive/`, `docs/` or `scripts/`:

- Root files:
  - `PERFORMANCE_IMPROVEMENTS.md` and `PERFORMANCE_OPTIMIZATION_REPORT.md`, from January 2026.
  - `database_schema.md`, which documents only the legacy root schema.
  - `hero-data.json` (5,035 lines). Nothing in `src` reads it; `scripts/fetch-hero-data.js` writes it.
  - `.modified`, an empty marker file.
  - `firestore-secure.rules`, which `firebase.json` does not reference.
- `scripts/`: 119 files.
  - No `package.json` script refers to any of them.
  - Many are one-off `debug-*`, `analyze-*`, `delete-*` and `backfill-*` scripts, and 22 are fantasy-formula experiments.
  - Five call the closed `/api/admin` routes (section 2d).
- `_archive/archive-2026-01-28/`: 119 tracked files.
- `docs/`: about 20 planning and spec files. Several describe the pre-rebuild bot and the closed routes.

## 4. `any` hotspots

671 occurrences of `: any`, `as any` or `<any>` in 118 files of `src` after S0 (counted per occurrence, not per line). Top 20:

| Count | File |
|---|---|
| 179 | `src/app/stats/page.tsx` |
| 120 | `src/lib/comprehensive-stats-calculator.ts` |
| 38 | `src/lib/admin-actions.ts` |
| 22 | `src/lib/pdl-admin-actions.ts` |
| 20 | `src/components/team/MyTeamView.tsx` |
| 15 | `src/lib/draft-prep/server.ts` |
| 13 | `src/lib/opendota.ts` |
| 13 | `src/components/tournament/TeamsView.tsx` |
| 11 | `src/lib/pdl-registration-actions.ts` |
| 7 | `src/lib/standin-actions.ts` |
| 7 | `src/lib/firestore.ts` |
| 7 | `src/lib/api/tournaments.ts` |
| 7 | `src/lib/actions.ts` |
| 6 | `src/lib/match-players-action.ts` |
| 6 | `src/app/fantasy/page.tsx` |
| 6 | `src/app/[tournamentSlug]/teams/page.tsx` |
| 5 | `src/lib/bracketConverter.ts` |
| 5 | `src/context/PlayoffContext.tsx` |
| 5 | `src/components/creator/steps/ReviewStep.tsx` |
| 5 | `src/app/faq/page.tsx` |

ESLint (set up in S0, `next/core-web-vitals`) does not enable `no-explicit-any`. It reports 0 errors and 76 warnings (`no-img-element` 39, `exhaustive-deps` 35).

## 5. Mixed patterns (non-admin file counts, `grep -l`)

| Concern | Variants found |
|---|---|
| Data fetching | Browser Firestore (`firebase/firestore` in 72 files; `@/lib/firebase` in 55), Admin SDK (84 files), `fetch('/api...')` (35 files), `'use server'` actions (11 files), `onSnapshot` (5 files) |
| Auth on API routes | `requireAdmin(req, tournamentId?)` in `server/lib/require-admin.ts:21` (22 files); `requireUser` in `server/lib/require-user.ts:13`; hand-rolled `verifyIdToken` (34 files); `isAdmin` (10 files); `checkAdmin` in `api/checkAdmin/route.ts` (reimplements the admin check inline: `verifyIdToken` + `admins` collection), `lib/auth.ts` and `GeneralTab.tsx` call it |
| Error and toast | `useToast`/`toast(` in 38 files (`hooks/use-toast.ts`); `ErrorBoundary.tsx`; `lib/error-reporting.ts`; `console.error` plus JSON `{success,message}` returns (e.g. `fantasy-scoring-admin.ts:99-104`) |
| Styling | Tailwind `className=` in 317 files; inline `style={{` in 198 files; `styled-components` is in `package.json:71` but has 0 imports |
| i18n | `next-intl` in 32 files (`error.tsx`, `layout.tsx`, `register/page.tsx`, `[tournamentSlug]/playoffs/page.tsx`, ...) with `messages/pl.json` (1193 lines) and `en.json` (1092 lines); the custom `hooks/useTranslation.ts` reading `lib/translations.ts` (3 importers, 67 files mention `useTranslation`); Polish diacritics hard-coded in 456 files outside `translations.ts` |
| Dates | `date-fns` in 12 files; `date-fns-tz` is in `package.json:49` with 0 imports; `new Date(` in 151 files; `toLocale*String`/`Intl.DateTimeFormat` in 64 files; `context/TimeContext.tsx` |
| State | React Context (16 files, 6 in `src/context`), local `useState`; no redux, zustand, swr or react-query |

## 6. Conventions actually followed

- Folders: `src/app` (routes, plus `[tournamentSlug]/...` multi-tenant), `src/components/<domain>/`, `src/lib/` (flat, about 100 files plus subfolders `bot`, `card-lab`, `draft-prep`, `stats-lab`, `swiss`, `lan-qualifier`, `api`), `src/server/` (accounts, card-lab, casters, notify, lib; the newer server-only code), `src/context`, `src/hooks`, `src/types`, `src/config`, `src/i18n`.
- Naming: `lib/*` is mostly kebab-case (`pdl-admin-actions.ts`), with a few camelCase (`bracketConverter.ts`, `gLootBracketConverter.ts`, `bracketStyles.ts`). Hooks are mixed (`use-toast.ts`, `useTranslation.ts`). Components are PascalCase `.tsx`. Suffixes `-admin` and `-actions` mark Admin-SDK or server-action modules. Backups are kept as `-old/-new/-backup` siblings.
- Server/client split: `'use server'` files are in `lib/*-actions.ts`. A `"use client"` directive appears in 316 `.tsx` files, so client is the default. Routes use `route.ts` under `app/api`, with the admin API at `/api/manage/*` (28 `requireAdmin` files).
- Types: `lib/definitions.ts` (685 lines; 131 non-admin importers) is the main shared type file. Also `types/tournament.ts` (886 lines), `types/lobby-bot.ts`, `lib/fantasy-types.ts`, `lib/stats-types.ts`, `lib/stats-lab/types.ts`, `lib/notify-types.ts`.
- Tests: vitest (`package.json:12`), 26 files all under `src/__tests__/` (plus `setup.ts` and `stubs/`), none co-located. They cover only small utils (rules, swiss, slug, plural and similar). No tests found for stats or fantasy scoring.

## Problems seen

- Per-player fantasy points have three different live formulas: role-based at import (`opendota.ts:285`), the flat PDL formula that overwrites them for PDL imports (`pdl-fantasy-scoring.ts:8-60`, applied at `pdl-admin-actions.ts:1102`), and the roll-up in `comprehensive-stats-calculator.ts:1956`. Kill, death and win weights differ (2.5 / -0.7 / 5, 0.3 / 0 / 4, and 2 / -0.5 / 5; S0 checked). The roll-up ignores the stored per-game points, so a player's total can disagree with the sum of their games.
- The role-based formula is copied by hand into the viewer-facing `FantasyScoreCalculator.tsx:118,164`.
- Fantasy user totals are summed in `fantasy-scoring-admin.ts`, `post-sync-recalculations.ts:153` and `firestore.ts:470`.
- The live `/api/import-match` route recalculates the legacy root (Letnia) collections for every import, whatever the tournament (`post-sync-recalculations.ts:205`).
- 108 unreachable files (18,075 lines) remain in `src`, including `TeamsView.tsx` (2,108 lines) and four copies of the bracket display. Twelve legacy root pages still build although their URLs are redirected.
- The Steam64 offset `76561197960265728` is written out 34 times in 19 files, beside `steam-id-utils.ts`.
- Two Admin SDK init modules (`src/server/lib/admin.ts`, `src/lib/admin.ts`). `getAllTeamsAdmin` is defined in both `admin-actions.ts` and the root-level `server/lib/getAllAdmin.ts`, and the root `server/` folder sits outside `src`.
- Admin routes check callers in two ways: `requireAdmin` in 24 route files and a hand-written `verifyIdToken` in 23. The hand-written kind is how four bot routes ended up open to every signed-in user (fixed in S0). `api/checkAdmin` reimplements the admin lookup.
- Dependencies `styled-components` and `date-fns-tz` are installed but never imported.
- Admin tab files are 1,000-3,000 lines each. `pdl-admin-actions.ts` (2,200) and `comprehensive-stats-calculator.ts` (2,171, one exported function) hold most of the result and stats logic.
- 671 uses of `any` in 118 files, most of them in the stats page and the stats calculator.
- Two i18n systems run side by side (`next-intl` with `messages/*.json`, and `lib/translations.ts`), and Polish text is hard-coded in about 456 files.
- `scripts/` has 119 files that nothing refers to, five of them calling routes that no longer exist.
- Lint had never run before S0. There are no tests for scoring, stats, standings or any Firestore write.
